import { Router } from 'express';
import { randomUUID } from 'crypto';
import { AmmDatabase } from '../db';
import {
  AuthenticatedRequest,
  optionalFirebaseRequest,
  rateLimit,
  requireAdminMiddleware,
  requireMasterAdminMiddleware,
  verifyFirebaseRequest,
} from '../auth';
import { getAccountsMap, reconcileAccounts, recordPnlSnapshot } from '../accounting';
import {
  AMM_COMPANY_USER_ID,
  cancelClobOrder,
  ensureMarketRecord,
  ensureUserClobAccount,
  getMarketExecutions,
  getMarketPositionsFromClob,
  getOrderBook,
  markUserBalanceSynced,
  placeClobOrder,
  processFinanceOpInSqlite,
  quoteClobOrder,
  reconcileUserClobBalance,
  resolveClobMarket,
} from '../clobEngine';
import {
  decideMarketAllocation,
  requestMarketAllocation,
  resumeAfterInvestigation,
  toggleAmmEnabled,
  triggerEmergencyStop,
  updateRiskLimits,
} from '../adminControls';
import { runAmmStrategyForMarket } from '../ammStrategy';
import { runMandatoryAmmTestSuite } from '../ammTestSuite';
import {
  fetchFirestoreDoc,
  getFreshFirestoreBalanceCents,
  mirrorAmmStateToFirestore,
  recordFirestoreLedgerEntry,
  syncAdminBalanceToFirestore,
  syncClobTradeToFirestore,
  syncFinanceProcessToFirestore,
  syncMarketSettlementToFirestore,
  syncUserPositionToFirestore,
  updateFirestoreUserBalanceCents,
} from '../firestoreSync';

// Simple per-process async mutex queue to guarantee sequential non-racing financial mutations
let lockTail: Promise<void> = Promise.resolve();
function withSerializedLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = lockTail;
  let release!: () => void;
  lockTail = new Promise<void>(resolve => {
    release = resolve;
  });
  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

const SANDBOX_BOTS = [
  { id: 'bot_ango_01', name: 'AngoBot_01', initialCents: 50_000_000 },
  { id: 'bot_soba_risk', name: 'SobaTrader', initialCents: 25_000_000 },
  { id: 'bot_candengue', name: 'CandengueTrader', initialCents: 15_000_000 },
  { id: 'bot_kwanza_king', name: 'KwanzaKing', initialCents: 100_000_000 },
  { id: 'bot_preditor', name: 'PreditorElite', initialCents: 40_000_000 },
];

function ensureAndMintCompleteSetForBot(
  db: AmmDatabase,
  botId: string,
  marketId: string,
  qty: number
) {
  db.transaction(() => {
    ensureUserClobAccount(db, botId, 50_000_000);
    const acc = db.prepare(`SELECT available_cents FROM user_clob_accounts WHERE user_id = ?`).get(botId) as {
      available_cents: number;
    };
    const costCents = qty * 100;
    if ((acc?.available_cents ?? 0) < costCents) {
      db.prepare(`UPDATE user_clob_accounts SET available_cents = available_cents + ?, updated_at = ? WHERE user_id = ?`).run(
        50_000_000,
        new Date().toISOString(),
        botId
      );
    }
    const now = new Date().toISOString();
    db.prepare(`UPDATE user_clob_accounts SET available_cents = available_cents - ?, updated_at = ? WHERE user_id = ?`).run(
      costCents,
      now,
      botId
    );
    for (const out of ['Yes', 'No'] as const) {
      db.prepare(`
        INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at)
        VALUES (?, ?, ?, ?, 0, 50, ?)
        ON CONFLICT(user_id, market_id, outcome) DO UPDATE SET
          available_shares = user_clob_positions.available_shares + excluded.available_shares,
          updated_at = excluded.updated_at
      `).run(botId, marketId, out, qty, now);
    }
  })();
}

export function createAmmRouter(db: AmmDatabase): Router {
  const router = Router();

  // --- PUBLIC / MARKET ORDERBOOK, QUOTE, EXECUTIONS & HOLDERS ---
  router.get('/clob/book/:marketId', rateLimit(60, 10_000), (req, res) => {
    try {
      const book = getOrderBook(db, req.params.marketId);
      res.json(book);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao carregar livro de ordens.' });
    }
  });

  router.get('/clob/quote', optionalFirebaseRequest, rateLimit(60, 10_000), (req: AuthenticatedRequest, res) => {
    try {
      const marketId = String(req.query.marketId || '');
      const side = String(req.query.side || 'Buy') as 'Buy' | 'Sell';
      const outcome = String(req.query.outcome || 'Yes') as 'Yes' | 'No';
      const orderType = String(req.query.orderType || 'MARKET') === 'LIMIT' ? 'LIMIT' : 'MARKET';
      const budgetKz = req.query.budgetKz !== undefined ? Number(req.query.budgetKz) : 0;
      const quantity = req.query.quantity !== undefined ? Number(req.query.quantity) : 0;
      const limitPriceCents = req.query.limitPriceCents !== undefined ? Number(req.query.limitPriceCents) : undefined;

      if (!marketId || !['Buy', 'Sell'].includes(side) || !['Yes', 'No'].includes(outcome)) {
        res.status(400).json({ error: 'Parâmetros de cotação inválidos.' });
        return;
      }

      const quote = quoteClobOrder(db, {
        marketId,
        side,
        outcome,
        orderType,
        budgetKz: isNaN(budgetKz) ? 0 : budgetKz,
        quantity: isNaN(quantity) ? 0 : quantity,
        limitPriceCents: limitPriceCents && !isNaN(limitPriceCents) ? Math.round(limitPriceCents) : undefined,
        userId: req.actor?.uid,
      });
      res.json(quote);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao calcular cotação no CLOB.' });
    }
  });

  router.get('/clob/executions/:marketId', rateLimit(60, 10_000), (req, res) => {
    try {
      const limitCount = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
      const executions = getMarketExecutions(db, req.params.marketId, limitCount);
      res.json({ executions });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao carregar execuções do CLOB.' });
    }
  });

  router.get('/clob/positions/:marketId', rateLimit(60, 10_000), (req, res) => {
    try {
      const rows = getMarketPositionsFromClob(db, req.params.marketId) as any[];
      const positions = rows
        .filter((r) => r.user_id !== AMM_COMPANY_USER_ID)
        .map((r) => ({
          id: `${r.user_id}_${r.market_id}_${r.outcome}`,
          userId: r.user_id,
          userLabel: r.user_id.startsWith('bot_')
            ? r.user_id.replace('bot_', 'Bot ').toUpperCase()
            : `Trader #${r.user_id.slice(0, 5)}`,
          isBot: r.user_id.startsWith('bot_'),
          marketId: r.market_id,
          outcome: r.outcome,
          shares: r.total_shares,
          availableShares: r.available_shares,
          reservedShares: r.reserved_shares,
          avg_price: Number(((r.avg_price_cents || 0) / 100).toFixed(2)),
        }));
      res.json({ positions });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao carregar detentores do mercado.' });
    }
  });

  // --- AUTHENTICATED USER CLOB ENDPOINTS ---
  router.get(
    '/clob/orders/my',
    verifyFirebaseRequest,
    rateLimit(40, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const data = await withSerializedLock(async () => {
          const uid = req.actor!.uid;
          const idToken = req.idToken!;
          const marketId = req.query.marketId as string | undefined;

          try {
            const fsBalanceCents = await getFreshFirestoreBalanceCents(idToken, uid);
            const recon = reconcileUserClobBalance(db, uid, fsBalanceCents);
            if (recon.unsyncedSqliteDeltaCents !== 0) {
              await updateFirestoreUserBalanceCents(idToken, uid, recon.availableCents);
              markUserBalanceSynced(db, uid, recon.availableCents);
            }
          } catch {
            // Non-blocking fallback to SQLite cache if Firestore lookup transiently fails
          }

          const orders = marketId
            ? db
                .prepare(`SELECT * FROM clob_orders WHERE user_id = ? AND market_id = ? ORDER BY seq DESC LIMIT 50`)
                .all(uid, marketId)
            : db.prepare(`SELECT * FROM clob_orders WHERE user_id = ? ORDER BY seq DESC LIMIT 100`).all(uid);

          const positions = db
            .prepare(`SELECT * FROM user_clob_positions WHERE user_id = ? AND (available_shares > 0 OR reserved_shares > 0)`)
            .all(uid);

          const account = db.prepare(`SELECT * FROM user_clob_accounts WHERE user_id = ?`).get(uid) || {
            user_id: uid,
            available_cents: 0,
            reserved_cents: 0,
          };

          return { orders, positions, account };
        });
        res.json(data);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao consultar ordens do utilizador.' });
      }
    }
  );

  router.post(
    '/clob/order',
    verifyFirebaseRequest,
    rateLimit(20, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const uid = req.actor!.uid;
          const idToken = req.idToken!;
          const idempotencyKey =
            (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

          if (idempotencyKey) {
            const cached = db
              .prepare(`SELECT response_json, status_code FROM idempotency_keys WHERE key = ? AND user_id = ?`)
              .get(idempotencyKey, uid) as { response_json: string; status_code: number } | undefined;
            if (cached) {
              return { status: cached.status_code, body: JSON.parse(cached.response_json), cached: true };
            }
          }

          const { marketId, side, outcome, orderType, priceCents, quantity, budgetKz } = req.body || {};
          if (!marketId || !['Buy', 'Sell'].includes(side) || !['Yes', 'No'].includes(outcome)) {
            throw new Error('Parâmetros da ordem inválidos (marketId, side, outcome).');
          }

          // Validate user & market operational state in Firestore
          const [userDoc, marketDoc] = await Promise.all([
            fetchFirestoreDoc(idToken, 'users', uid).catch(() => null),
            fetchFirestoreDoc(idToken, 'markets', marketId).catch(() => null),
          ]);
          if (userDoc?.status === 'blocked') {
            throw new Error('A sua conta encontra-se bloqueada para negociações.');
          }
          if (marketDoc) {
            if (marketDoc.resolved) {
              throw new Error('Este mercado já foi resolvido e não aceita novas ordens.');
            }
            if (marketDoc.status === 'blocked') {
              throw new Error('Este mercado foi temporariamente bloqueado pelo administrador.');
            }
            if (marketDoc.is_multi) {
              throw new Error('Mercados multi-opção ainda não são compatíveis com o livro CLOB.');
            }
          }

          const normalizedType = orderType === 'MARKET' ? 'MARKET' : 'LIMIT';

          // Read & reconcile authoritative balance before matching
          const firestoreBalanceCents = await getFreshFirestoreBalanceCents(idToken, uid);
          const recon = reconcileUserClobBalance(db, uid, firestoreBalanceCents);
          const beforeKz = Number((recon.availableCents / 100).toFixed(2));

          let parsedPrice = Math.round(Number(priceCents));
          let parsedQty = Math.round(Number(quantity));

          if (normalizedType === 'MARKET' && side === 'Buy' && Number(budgetKz) > 0 && (!parsedQty || isNaN(parsedQty))) {
            const quote = quoteClobOrder(db, {
              marketId,
              side: 'Buy',
              outcome,
              orderType: 'MARKET',
              budgetKz: Number(budgetKz),
              userId: uid,
            });
            if (!quote.hasLiquidity || quote.executableShares <= 0) {
              throw new Error('Sem liquidez disponível no livro CLOB para este resultado.');
            }
            parsedQty = quote.executableShares;
            parsedPrice = Math.max(1, Math.min(99, quote.worstFillPriceCents));
          } else if (normalizedType === 'MARKET' && side === 'Sell') {
            parsedQty = Math.round(Number(quantity));
            if (isNaN(parsedPrice) || parsedPrice < 1 || parsedPrice > 99) {
              parsedPrice = 1; // Market sell accepts any resting bid >= 1c
            }
            const quote = quoteClobOrder(db, {
              marketId,
              side: 'Sell',
              outcome,
              orderType: 'MARKET',
              quantity: parsedQty,
              userId: uid,
            });
            if (!quote.hasLiquidity || quote.executableShares <= 0) {
              throw new Error('Sem compradores no livro CLOB neste momento para fechar esta posição a mercado.');
            }
          }

          const orderResult = placeClobOrder(db, {
            marketId,
            userId: uid,
            isAmm: false,
            side,
            outcome,
            orderType: normalizedType,
            priceCents: parsedPrice,
            quantity: parsedQty,
            idempotencyKey: idempotencyKey || undefined,
          });

          const updatedAcc = db
            .prepare(`SELECT available_cents, reserved_cents FROM user_clob_accounts WHERE user_id = ?`)
            .get(uid) as { available_cents: number; reserved_cents: number };
          const afterKz = Number((updatedAcc.available_cents / 100).toFixed(2));

          if (updatedAcc.available_cents !== firestoreBalanceCents) {
            await updateFirestoreUserBalanceCents(idToken, uid, updatedAcc.available_cents);
            markUserBalanceSynced(db, uid, updatedAcc.available_cents);
            const deltaKz = Number(((updatedAcc.available_cents - recon.availableCents) / 100).toFixed(2));
            if (deltaKz !== 0) {
              await recordFirestoreLedgerEntry(idToken, {
                userId: uid,
                type: side === 'Buy' ? 'COMPRA_QUOTAS' : 'VENDA_QUOTAS',
                amountKz: deltaKz,
                balanceBeforeKz: beforeKz,
                balanceAfterKz: afterKz,
                reference: `${marketId}:CLOB:${orderResult.orderId}`,
              });
            }
          }

          const userPosRows = db
            .prepare(`SELECT outcome, available_shares, reserved_shares, avg_price_cents FROM user_clob_positions WHERE user_id = ? AND market_id = ?`)
            .all(uid, marketId) as Array<{ outcome: 'Yes' | 'No'; available_shares: number; reserved_shares: number; avg_price_cents: number }>;

          await syncClobTradeToFirestore(idToken, {
            marketId,
            side,
            outcome,
            uid,
            filledQuantity: orderResult.filledQuantity,
            avgExecutionPriceCents: orderResult.avgExecutionPriceCents,
            yesPriceCents: orderResult.yesPriceCents,
            noPriceCents: orderResult.noPriceCents,
            executions: orderResult.executions,
            positionRows: userPosRows,
          });

          // Trigger AMM strategy refresh if AMM is enabled & market is approved
          const settings = db.prepare(`SELECT amm_enabled, emergency_halted FROM amm_settings WHERE id = 1`).get() as any;
          const alloc = db.prepare(`SELECT status FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;
          if (settings?.amm_enabled === 1 && settings?.emergency_halted === 0 && alloc?.status === 'APPROVED') {
            try {
              runAmmStrategyForMarket(db, marketId);
            } catch (stratErr) {
              console.warn('AMM strategy tick post-trade warning:', stratErr);
            }
          }

          const responsePayload = {
            ...orderResult,
            availableCents: updatedAcc.available_cents,
            reservedCents: updatedAcc.reserved_cents,
          };

          if (idempotencyKey) {
            db.prepare(`
              INSERT OR IGNORE INTO idempotency_keys (key, endpoint, user_id, response_json, status_code, created_at)
              VALUES (?, '/api/clob/order', ?, ?, 200, ?)
            `).run(idempotencyKey, uid, JSON.stringify(responsePayload), new Date().toISOString());
          }

          return { status: 200, body: responsePayload, cached: false };
        });

        res.status(result.status).json(result.body);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao executar ordem no CLOB.' });
      }
    }
  );

  router.post(
    '/clob/order/:orderId/cancel',
    verifyFirebaseRequest,
    rateLimit(25, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const uid = req.actor!.uid;
          const idToken = req.idToken!;
          const isAdmin = req.actor!.role === 'MASTER_ADMIN' || req.actor!.role === 'OPERATIONAL_ADMIN';

          const orderRow = db.prepare(`SELECT user_id, market_id FROM clob_orders WHERE id = ?`).get(req.params.orderId) as
            | { user_id: string; market_id: string }
            | undefined;
          if (!orderRow) {
            throw new Error('Ordem não encontrada.');
          }
          const targetUserId = orderRow.user_id;

          if (targetUserId !== AMM_COMPANY_USER_ID) {
            const fsBal = await getFreshFirestoreBalanceCents(idToken, targetUserId);
            reconcileUserClobBalance(db, targetUserId, fsBal);
          }

          const beforeAcc = db
            .prepare(`SELECT available_cents FROM user_clob_accounts WHERE user_id = ?`)
            .get(targetUserId) as { available_cents: number } | undefined;
          const beforeCents = beforeAcc?.available_cents ?? 0;

          const cancelRes = cancelClobOrder(db, req.params.orderId, uid, isAdmin);

          if (targetUserId !== AMM_COMPANY_USER_ID) {
            const updatedAcc = db
              .prepare(`SELECT available_cents FROM user_clob_accounts WHERE user_id = ?`)
              .get(targetUserId) as { available_cents: number } | undefined;
            if (updatedAcc) {
              await updateFirestoreUserBalanceCents(idToken, targetUserId, updatedAcc.available_cents);
              markUserBalanceSynced(db, targetUserId, updatedAcc.available_cents);
              if ((cancelRes.refundedCents || 0) > 0) {
                await recordFirestoreLedgerEntry(idToken, {
                  userId: targetUserId,
                  type: 'CANCELAMENTO_ORDEM',
                  amountKz: Number((cancelRes.refundedCents / 100).toFixed(2)),
                  balanceBeforeKz: Number((beforeCents / 100).toFixed(2)),
                  balanceAfterKz: Number((updatedAcc.available_cents / 100).toFixed(2)),
                  reference: `${orderRow.market_id}:CANCEL:${req.params.orderId}`,
                });
              }
            }
            const userPosRows = db
              .prepare(`SELECT outcome, available_shares, reserved_shares, avg_price_cents FROM user_clob_positions WHERE user_id = ? AND market_id = ?`)
              .all(targetUserId, orderRow.market_id) as any[];
            await syncUserPositionToFirestore(idToken, targetUserId, orderRow.market_id, userPosRows);
          }
          return cancelRes;
        });

        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao cancelar ordem.' });
      }
    }
  );

  // --- ADMIN FINANCE & USER BALANCE ENDPOINTS ---
  router.post(
    '/finance/process',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(25, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const idToken = req.idToken!;
          const adminUid = req.actor!.uid;
          const { requestId, status } = req.body || {};
          if (!requestId || !['approved', 'rejected'].includes(status)) {
            throw new Error('Parâmetros inválidos (requestId, status).');
          }

          const reqDoc = await fetchFirestoreDoc(idToken, 'finance_requests', requestId);
          if (!reqDoc) {
            throw new Error('Solicitação financeira não encontrada no Firestore.');
          }
          if (reqDoc.status && reqDoc.status !== 'pending') {
            throw new Error('Esta solicitação já foi processada anteriormente.');
          }
          const reqType = reqDoc.type === 'withdrawal' ? 'withdrawal' : 'deposit';
          const amountCents = Math.round(Number(reqDoc.amount || 0) * 100);
          const targetUserId = String(reqDoc.user_id || '');
          if (!targetUserId || amountCents <= 0) {
            throw new Error('Dados financeiros da solicitação inválidos.');
          }

          const fsBalCents = await getFreshFirestoreBalanceCents(idToken, targetUserId);
          let beforeCents = fsBalCents;
          let afterCents = fsBalCents;

          if (status === 'approved') {
            const sqlRes = processFinanceOpInSqlite(db, {
              opId: `fin_${requestId}`,
              userId: targetUserId,
              opType: reqType,
              amountCents,
              currentFirestoreBalanceCents: fsBalCents,
            });
            beforeCents = sqlRes.beforeCents;
            afterCents = sqlRes.afterCents;
          }

          await syncFinanceProcessToFirestore(idToken, {
            requestId,
            status,
            adminUid,
            userId: targetUserId,
            type: reqType,
            amountCents,
            beforeCents,
            afterCents,
          });

          if (status === 'approved') {
            markUserBalanceSynced(db, targetUserId, afterCents);
          }

          return {
            requestId,
            status,
            userId: targetUserId,
            beforeKz: Number((beforeCents / 100).toFixed(2)),
            afterKz: Number((afterCents / 100).toFixed(2)),
          };
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao processar solicitação financeira.' });
      }
    }
  );

  router.post(
    '/admin/users/:userId/balance',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(25, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const idToken = req.idToken!;
          const adminUid = req.actor!.uid;
          const userId = req.params.userId;
          const { newBalanceKz, reason } = req.body || {};
          const parsedKz = Number(newBalanceKz);
          if (isNaN(parsedKz) || parsedKz < 0) {
            throw new Error('O novo saldo deve ser um valor numérico não negativo.');
          }
          const finalReason = String(reason || 'Ajuste manual via Master Admin').trim();
          const newBalanceCents = Math.round(parsedKz * 100);
          const fsBalCents = await getFreshFirestoreBalanceCents(idToken, userId);

          const sqlRes = processFinanceOpInSqlite(db, {
            opId: `adm_bal_${randomUUID()}`,
            userId,
            opType: 'admin_set',
            amountCents: newBalanceCents,
            currentFirestoreBalanceCents: fsBalCents,
          });

          await syncAdminBalanceToFirestore(idToken, {
            userId,
            beforeCents: sqlRes.beforeCents,
            afterCents: sqlRes.afterCents,
            adminUid,
            reason: finalReason,
          });

          markUserBalanceSynced(db, userId, sqlRes.afterCents);
          db.prepare(`
            INSERT INTO amm_security_audit (
              id, actor_id, actor_email, actor_role, action, target_id, justification, details_json, ip_address, created_at
            ) VALUES (?, ?, ?, ?, 'MASTER_MANUAL_BALANCE_ADJUST', ?, ?, ?, ?, ?)
          `).run(
            randomUUID(),
            req.actor!.uid,
            req.actor!.email,
            req.actor!.role,
            userId,
            finalReason,
            JSON.stringify({ beforeCents: sqlRes.beforeCents, afterCents: sqlRes.afterCents }),
            req.actor!.ip || null,
            new Date().toISOString()
          );

          return {
            userId,
            beforeKz: Number((sqlRes.beforeCents / 100).toFixed(2)),
            afterKz: Number((sqlRes.afterCents / 100).toFixed(2)),
            reservedKz: Number((sqlRes.reservedCents / 100).toFixed(2)),
          };
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao ajustar saldo do utilizador.' });
      }
    }
  );

  // --- AMM CONTROL CENTER READ ENDPOINTS (Admin + Master Admin) ---
  router.get(
    '/amm/reconciliation/users',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(40, 10_000),
    (_req: AuthenticatedRequest, res) => {
      try {
        const accounts = db
          .prepare(`SELECT user_id, available_cents, reserved_cents, last_synced_firestore_balance_cents, updated_at FROM user_clob_accounts ORDER BY updated_at DESC LIMIT 100`)
          .all() as any[];
        const positions = db
          .prepare(`SELECT user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents FROM user_clob_positions WHERE available_shares > 0 OR reserved_shares > 0`)
          .all() as any[];
        res.json({ accounts, positions });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao carregar reconciliação de contas.' });
      }
    }
  );

  router.get(
    '/amm/overview',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(60, 10_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
        const accounts = getAccountsMap(db);
        const reconciliation = reconcileAccounts(db);

        const allocations = db
          .prepare(`
            SELECT a.*,
                   COALESCE(i.shares_sim, 0) AS shares_sim,
                   COALESCE(i.shares_no, 0) AS shares_no,
                   COALESCE(i.cost_basis_sim_cents, 0) AS cost_basis_sim_cents,
                   COALESCE(i.cost_basis_no_cents, 0) AS cost_basis_no_cents,
                   COALESCE(i.net_exposure_cents, 0) AS net_exposure_cents,
                   COALESCE(i.worst_case_liability_cents, 0) AS worst_case_liability_cents,
                   COALESCE(i.realized_pnl_cents, 0) AS realized_pnl_cents,
                   COALESCE(i.unrealized_pnl_cents, 0) AS unrealized_pnl_cents
            FROM amm_market_allocations a
            LEFT JOIN amm_inventory i ON a.market_id = i.market_id
            ORDER BY a.updated_at DESC
          `)
          .all() as any[];

        const activeQuotes = db
          .prepare(`SELECT * FROM amm_quotes WHERE status = 'ACTIVE' ORDER BY updated_at DESC`)
          .all();

        const pnlHistory = db
          .prepare(`SELECT * FROM amm_pnl ORDER BY created_at ASC LIMIT 200`)
          .all();

        const riskEvents = db
          .prepare(`SELECT * FROM amm_risk_events ORDER BY created_at DESC LIMIT 50`)
          .all();

        const approvals = db
          .prepare(`SELECT * FROM amm_admin_approvals ORDER BY created_at DESC LIMIT 50`)
          .all();

        const decisionLogs = db
          .prepare(`SELECT * FROM amm_decision_logs ORDER BY created_at DESC LIMIT 60`)
          .all();

        const auditLogs = db
          .prepare(`SELECT * FROM amm_security_audit ORDER BY created_at DESC LIMIT 60`)
          .all();

        const recentTrades = db
          .prepare(`SELECT * FROM amm_trades ORDER BY created_at DESC LIMIT 50`)
          .all();

        const totalAllocatedCents = allocations
          .filter(a => ['APPROVED', 'SUSPENDED'].includes(a.status) && a.market_resolved === 0)
          .reduce((s, a) => s + (a.allocated_capital_cents || 0), 0);

        const totalSimShares = allocations.reduce((s, a) => s + (a.shares_sim || 0), 0);
        const totalNoShares = allocations.reduce((s, a) => s + (a.shares_no || 0), 0);
        const totalExposureCents = allocations.reduce((s, a) => s + Math.abs(a.net_exposure_cents || 0), 0);
        const totalLiabilitiesCents = allocations.reduce((s, a) => s + (a.worst_case_liability_cents || 0), 0);
        const totalRealizedPnlCents = allocations.reduce((s, a) => s + (a.realized_pnl_cents || 0), 0);
        const totalUnrealizedPnlCents = allocations.reduce((s, a) => s + (a.unrealized_pnl_cents || 0), 0);
        const netPnlCents = totalRealizedPnlCents + totalUnrealizedPnlCents;
        const currentLossCents = netPnlCents < 0 ? Math.abs(netPnlCents) : 0;
        const utilizationPct =
          settings.max_allocation_budget_cents > 0
            ? Number(((totalAllocatedCents / settings.max_allocation_budget_cents) * 100).toFixed(2))
            : 0;

        res.json({
          actorRole: req.actor!.role,
          settings: {
            ...settings,
            amm_enabled: settings.amm_enabled === 1,
            emergency_halted: settings.emergency_halted === 1,
            sandbox_tests_passed: settings.sandbox_tests_passed === 1,
            last_test_report: settings.last_test_report_json ? JSON.parse(settings.last_test_report_json) : null,
          },
          metrics: {
            companyCapitalCents: settings.company_capital_cents,
            maxAllocationBudgetCents: settings.max_allocation_budget_cents,
            availableCashCents: accounts.amm_cash || 0,
            allocatedCapitalCents: totalAllocatedCents,
            protectedReserveCents: accounts.amm_protected_reserve || 0,
            reservedCashCents: accounts.amm_reserved_cash || 0,
            positionsSimValueCents: accounts.amm_positions_sim || 0,
            positionsNoValueCents: accounts.amm_positions_no || 0,
            positionsSimShares: totalSimShares,
            positionsNoShares: totalNoShares,
            collateralCents: accounts.amm_collateral || 0,
            exposureCents: totalExposureCents,
            liabilitiesCents: totalLiabilitiesCents,
            realizedPnlCents: totalRealizedPnlCents,
            unrealizedPnlCents: totalUnrealizedPnlCents,
            currentLossCents,
            utilizationPct,
          },
          reconciliation,
          allocations,
          activeQuotes,
          pnlHistory,
          riskEvents,
          approvals,
          decisionLogs,
          auditLogs,
          recentTrades,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao carregar AMM Control Center.' });
      }
    }
  );

  router.get(
    '/amm/markets/:marketId',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    (req, res) => {
      try {
        const marketId = req.params.marketId;
        const allocation = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(marketId);
        const inventory = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId);
        const positions = db.prepare(`SELECT * FROM amm_positions WHERE market_id = ?`).all(marketId);
        const quotes = db.prepare(`SELECT * FROM amm_quotes WHERE market_id = ? ORDER BY created_at DESC LIMIT 20`).all(marketId);
        const trades = db.prepare(`SELECT * FROM amm_trades WHERE market_id = ? ORDER BY created_at DESC LIMIT 50`).all(marketId);
        const decisions = db.prepare(`SELECT * FROM amm_decision_logs WHERE market_id = ? ORDER BY created_at DESC LIMIT 50`).all(marketId);
        const riskEvents = db.prepare(`SELECT * FROM amm_risk_events WHERE market_id = ? ORDER BY created_at DESC LIMIT 20`).all(marketId);
        const book = getOrderBook(db, marketId);

        res.json({ allocation, inventory, positions, quotes, trades, decisions, riskEvents, book });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao consultar detalhes do mercado AMM.' });
      }
    }
  );

  router.get('/amm/ledger', verifyFirebaseRequest, requireAdminMiddleware, (req, res) => {
    try {
      const reconciliation = reconcileAccounts(db);
      const entries = db
        .prepare(`SELECT * FROM amm_journal_entries ORDER BY created_at DESC LIMIT 100`)
        .all() as any[];

      const getLines = db.prepare(`SELECT * FROM amm_journal_lines WHERE entry_id = ?`);
      const enrichedEntries = entries.map(e => ({
        ...e,
        lines: getLines.all(e.id),
      }));

      res.json({ reconciliation, entries: enrichedEntries });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao carregar livro razão AMM.' });
    }
  });

  // --- ALLOCATION MANAGEMENT ---
  router.post(
    '/amm/allocations/request',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(15, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const { marketId, marketQuestion, allocatedCapitalKz, yesPriceCents, noPriceCents, justification } = req.body || {};
          const allocatedCapitalCents = Math.round(Number(allocatedCapitalKz) * 100);
          const out = requestMarketAllocation(db, req.actor!, {
            marketId,
            marketQuestion: marketQuestion || marketId,
            allocatedCapitalCents,
            yesPriceCents,
            noPriceCents,
            justification,
          });
          await mirrorAmmStateToFirestore(req.idToken!, 'amm_market_allocations', marketId, {
            market_id: marketId,
            allocated_capital_cents: out.allocatedCapitalCents,
            loss_limit_cents: out.lossLimitCents,
            status: out.status,
            updated_at: new Date().toISOString(),
          });
          return out;
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao solicitar alocação.' });
      }
    }
  );

  router.post(
    '/amm/allocations/:marketId/decide',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(15, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const { decision, allocatedCapitalKz, justification } = req.body || {};
          const allocatedCapitalCents =
            allocatedCapitalKz !== undefined ? Math.round(Number(allocatedCapitalKz) * 100) : undefined;
          const out = decideMarketAllocation(db, req.actor!, {
            marketId: req.params.marketId,
            decision,
            allocatedCapitalCents,
            justification,
          });
          await mirrorAmmStateToFirestore(req.idToken!, 'amm_market_allocations', req.params.marketId, {
            market_id: req.params.marketId,
            allocated_capital_cents: out.allocatedCapitalCents,
            loss_limit_cents: out.lossLimitCents,
            status: out.status,
            updated_at: new Date().toISOString(),
          });
          return out;
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao decidir alocação.' });
      }
    }
  );

  // --- MASTER ADMIN CONTROLS & EMERGENCY ---
  router.post(
    '/amm/toggle',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(10, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const { enable, justification } = req.body || {};
          const out = toggleAmmEnabled(db, req.actor!, Boolean(enable), justification);
          await mirrorAmmStateToFirestore(req.idToken!, 'amm_settings', 'singleton', {
            amm_enabled: out.ammEnabled,
            platform_mode: 'SANDBOX',
            updated_at: new Date().toISOString(),
          });
          return out;
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao alterar estado do AMM.' });
      }
    }
  );

  router.post(
    '/amm/emergency-stop',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(10, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const { justification } = req.body || {};
          const out = triggerEmergencyStop(db, req.actor!, justification || 'Acionamento imediato de botão de emergência');
          await mirrorAmmStateToFirestore(req.idToken!, 'amm_settings', 'singleton', {
            emergency_halted: true,
            amm_enabled: false,
            updated_at: new Date().toISOString(),
          });
          return out;
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao acionar paragem de emergência.' });
      }
    }
  );

  router.post(
    '/amm/resume',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(10, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(() => {
          const { marketId, investigationFindings, justification } = req.body || {};
          return resumeAfterInvestigation(db, req.actor!, {
            marketId,
            investigationFindings,
            justification,
          });
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao autorizar retoma.' });
      }
    }
  );

  router.post(
    '/amm/limits',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(10, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(() => {
          const { warningPct, protectionPct, haltPct, maxAllocationBudgetKz, justification } = req.body || {};
          return updateRiskLimits(db, req.actor!, {
            warningLossBps: Math.round(Number(warningPct) * 100),
            protectionLossBps: Math.round(Number(protectionPct) * 100),
            haltLossBps: Math.round(Number(haltPct) * 100),
            maxAllocationBudgetCents: Math.round(Number(maxAllocationBudgetKz) * 100),
            justification,
          });
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao atualizar limites.' });
      }
    }
  );

  router.post(
    '/amm/strategy/tick',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(20, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(() => {
          const { marketId } = req.body || {};
          if (marketId) {
            return { cycles: [runAmmStrategyForMarket(db, marketId)] };
          }
          const approvedMarkets = db
            .prepare(`SELECT market_id FROM amm_market_allocations WHERE status = 'APPROVED' AND market_resolved = 0`)
            .all() as Array<{ market_id: string }>;
          const cycles = approvedMarkets.map(m => runAmmStrategyForMarket(db, m.market_id));
          return { cycles };
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao executar ciclo da estratégia AMM.' });
      }
    }
  );

  // --- ADMIN SANDBOX BOT LIQUIDITY (CLOB MATCHING, NO LMSR) ---
  router.post(
    '/amm/sandbox/bot-liquidity',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(30, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const idToken = req.idToken!;
          const { marketId, botId, outcome = 'Yes', amountKz = 500 } = req.body || {};
          if (!marketId || !['Yes', 'No'].includes(outcome)) {
            throw new Error('marketId e outcome (Yes ou No) são obrigatórios.');
          }
          const mDoc = await fetchFirestoreDoc(idToken, 'markets', marketId).catch(() => null);
          if (mDoc?.resolved || mDoc?.status === 'blocked' || mDoc?.is_multi) {
            throw new Error('Mercado indisponível, bloqueado ou multi-opção.');
          }

          ensureMarketRecord(db, marketId, mDoc?.question || marketId);
          const alloc = db.prepare(`SELECT yes_price_cents, no_price_cents FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;
          const baseYes = alloc?.yes_price_cents ?? Math.max(5, Math.min(95, Math.round((mDoc?.yes_price || 0.5) * 100)));
          const drift = Math.floor(Math.random() * 5) - 2; // -2 to +2c organic move
          const targetPriceCents =
            outcome === 'Yes'
              ? Math.max(5, Math.min(95, baseYes + drift))
              : Math.max(5, Math.min(95, 100 - baseYes + drift));

          const qty = Math.max(1, Math.min(5000, Math.round((Number(amountKz) * 100) / targetPriceCents)));
          const takerBot = SANDBOX_BOTS.find((b) => b.id === botId) || SANDBOX_BOTS[0];
          const makerBot = SANDBOX_BOTS.find((b) => b.id !== takerBot.id) || SANDBOX_BOTS[1];

          ensureUserClobAccount(db, takerBot.id, takerBot.initialCents);
          ensureAndMintCompleteSetForBot(db, makerBot.id, marketId, qty);

          // Maker bot rests a Sell LIMIT on CLOB; Taker bot executes Buy LIMIT to create real CLOB trade
          placeClobOrder(db, {
            marketId,
            userId: makerBot.id,
            isAmm: false,
            side: 'Sell',
            outcome,
            orderType: 'LIMIT',
            priceCents: targetPriceCents,
            quantity: qty,
          });

          const takerRes = placeClobOrder(db, {
            marketId,
            userId: takerBot.id,
            isAmm: false,
            side: 'Buy',
            outcome,
            orderType: 'LIMIT',
            priceCents: targetPriceCents,
            quantity: qty,
          });

          await syncClobTradeToFirestore(idToken, {
            marketId,
            side: 'Buy',
            outcome,
            uid: takerBot.id,
            filledQuantity: takerRes.filledQuantity,
            avgExecutionPriceCents: takerRes.avgExecutionPriceCents,
            yesPriceCents: takerRes.yesPriceCents,
            noPriceCents: takerRes.noPriceCents,
            executions: takerRes.executions,
            positionRows: [],
          });

          return {
            marketId,
            botId: takerBot.id,
            botName: takerBot.name,
            makerBotId: makerBot.id,
            outcome,
            quantity: takerRes.filledQuantity,
            priceCents: targetPriceCents,
            yesPriceCents: takerRes.yesPriceCents,
            noPriceCents: takerRes.noPriceCents,
            notionalKz: Number(((takerRes.filledQuantity * targetPriceCents) / 100).toFixed(2)),
          };
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao executar liquidez sandbox de bot no CLOB.' });
      }
    }
  );

  router.post(
    '/clob/market/:marketId/resolve',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(10, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await withSerializedLock(async () => {
          const { winningOutcome, motive } = req.body || {};
          if (!['Yes', 'No'].includes(winningOutcome)) {
            throw new Error('Resultado vencedor inválido (Yes ou No).');
          }
          const finalMotive = String(motive || 'Resolução oficial pelo administrador via Painel CLOB+AMM').trim();
          const marketId = req.params.marketId;

          ensureMarketRecord(db, marketId);
          const settleRes = resolveClobMarket(db, marketId, winningOutcome, req.actor!.uid);

          await syncMarketSettlementToFirestore(req.idToken!, {
            marketId,
            winningOutcome,
            motive: finalMotive,
            resolvedBy: req.actor!.uid,
            settledUsers: settleRes.settledUsers,
          });

          for (const u of settleRes.settledUsers) {
            markUserBalanceSynced(db, u.userId, u.newAvailableCents);
          }

          return settleRes;
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao resolver mercado no CLOB/AMM.' });
      }
    }
  );

  // --- MANDATORY SANDBOX TEST RUNNER ---
  router.post(
    '/amm/sandbox/run-tests',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(10, 30_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const report = await withSerializedLock(() => {
          const testReport = runMandatoryAmmTestSuite();
          db.prepare(`
            UPDATE amm_settings
            SET sandbox_tests_passed = ?,
                last_test_report_json = ?,
                updated_by = ?,
                updated_at = ?
            WHERE id = 1
          `).run(
            testReport.allPassed ? 1 : 0,
            JSON.stringify(testReport),
            req.actor!.uid,
            new Date().toISOString()
          );
          recordPnlSnapshot(db, null);
          return testReport;
        });
        res.json(report);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao executar bateria de testes obrigatórios.' });
      }
    }
  );

  return router;
}
