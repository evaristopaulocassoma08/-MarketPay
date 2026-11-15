import { randomUUID } from 'crypto';
import { AmmDatabase, nextClobSeq } from './db';
import { postJournalEntry, recordPnlSnapshot } from './accounting';
import { checkAmmRiskAllowance, evaluateAndPersistMarketRisk } from './riskEngine';
import { ammCancelOrderInternal } from './clobHelpers';

export const AMM_COMPANY_USER_ID = 'AMM_MERCADOAO_COMPANY';

export interface PlaceOrderInput {
  marketId: string;
  userId: string;
  isAmm?: boolean;
  side: 'Buy' | 'Sell';
  outcome: 'Yes' | 'No';
  orderType: 'LIMIT' | 'MARKET';
  priceCents: number; // Limit price, or max acceptable price (Buy) / min acceptable price (Sell) for protected MARKET orders
  quantity: number; // integer shares (> 0)
  idempotencyKey?: string;
}

export interface PlaceOrderResult {
  orderId: string;
  status: string;
  filledQuantity: number;
  remainingQuantity: number;
  avgExecutionPriceCents: number | null;
  executions: Array<{
    executionId: string;
    makerOrderId: string;
    takerOrderId: string;
    priceCents: number;
    quantity: number;
    notionalCents: number;
    feeCents: number;
  }>;
  yesPriceCents: number;
  noPriceCents: number;
}

export function ensureMarketRecord(db: AmmDatabase, marketId: string, question: string = marketId) {
  const existing = db.prepare(`SELECT market_id FROM amm_market_allocations WHERE market_id = ?`).get(marketId);
  if (!existing) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO amm_market_allocations (
        market_id, market_question, allocated_capital_cents, used_capital_cents, reserved_capital_cents,
        loss_limit_cents, status, risk_state, yes_price_cents, no_price_cents, requested_by, justification, created_at, updated_at
      ) VALUES (?, ?, 0, 0, 0, 0, 'PENDING', 'NORMAL', 50, 50, 'SYSTEM', 'Auto-registrado pelo motor CLOB', ?, ?)
    `).run(marketId, question, now, now);

    db.prepare(`
      INSERT OR IGNORE INTO amm_inventory (market_id, updated_at) VALUES (?, ?)
    `).run(marketId, now);
  }
}

export function ensureUserClobAccount(db: AmmDatabase, userId: string, initialAvailableCents: number = 0) {
  const existing = db.prepare(`SELECT user_id FROM user_clob_accounts WHERE user_id = ?`).get(userId);
  if (!existing) {
    const safeCents = Math.max(0, Math.round(initialAvailableCents));
    db.prepare(`
      INSERT INTO user_clob_accounts (user_id, available_cents, reserved_cents, last_synced_firestore_balance_cents, updated_at)
      VALUES (?, ?, 0, ?, ?)
    `).run(userId, safeCents, safeCents, new Date().toISOString());
  }
}

export function seedUserClobBalance(db: AmmDatabase, userId: string, availableCents: number) {
  const now = new Date().toISOString();
  const safeCents = Math.max(0, Math.round(availableCents));
  db.prepare(`
    INSERT INTO user_clob_accounts (user_id, available_cents, reserved_cents, last_synced_firestore_balance_cents, updated_at)
    VALUES (?, ?, 0, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      available_cents = excluded.available_cents,
      last_synced_firestore_balance_cents = excluded.last_synced_firestore_balance_cents,
      updated_at = excluded.updated_at
  `).run(userId, safeCents, safeCents, now);
}

/**
 * Reconciles SQLite user_clob_accounts with Firestore balance without ever
 * overwriting offline maker-fill proceeds or pending settlement payouts earned in SQLite.
 */
export function reconcileUserClobBalance(
  db: AmmDatabase,
  userId: string,
  firestoreBalanceCents: number
): { availableCents: number; reservedCents: number; unsyncedSqliteDeltaCents: number } {
  const now = new Date().toISOString();
  const safeFsCents = Math.max(0, Math.round(firestoreBalanceCents));
  const row = db
    .prepare(`SELECT available_cents, reserved_cents, last_synced_firestore_balance_cents FROM user_clob_accounts WHERE user_id = ?`)
    .get(userId) as
    | { available_cents: number; reserved_cents: number; last_synced_firestore_balance_cents: number | null }
    | undefined;

  if (!row) {
    db.prepare(`
      INSERT INTO user_clob_accounts (user_id, available_cents, reserved_cents, last_synced_firestore_balance_cents, updated_at)
      VALUES (?, ?, 0, ?, ?)
    `).run(userId, safeFsCents, safeFsCents, now);
    return { availableCents: safeFsCents, reservedCents: 0, unsyncedSqliteDeltaCents: 0 };
  }

  let nextAvailable = row.available_cents;
  if (row.last_synced_firestore_balance_cents === null || row.last_synced_firestore_balance_cents === undefined) {
    // First sync after migration: if account was never used in SQLite, adopt Firestore balance; otherwise preserve SQLite balance.
    if (row.available_cents === 0 && row.reserved_cents === 0 && safeFsCents > 0) {
      nextAvailable = safeFsCents;
    }
    db.prepare(`
      UPDATE user_clob_accounts
      SET available_cents = ?, last_synced_firestore_balance_cents = ?, updated_at = ?
      WHERE user_id = ?
    `).run(nextAvailable, safeFsCents, now, userId);
  } else {
    const externalDelta = safeFsCents - row.last_synced_firestore_balance_cents;
    if (externalDelta !== 0) {
      nextAvailable = Math.max(0, row.available_cents + externalDelta);
      db.prepare(`
        UPDATE user_clob_accounts
        SET available_cents = ?, last_synced_firestore_balance_cents = ?, updated_at = ?
        WHERE user_id = ?
      `).run(nextAvailable, safeFsCents, now, userId);
    }
  }

  return {
    availableCents: nextAvailable,
    reservedCents: row.reserved_cents,
    unsyncedSqliteDeltaCents: nextAvailable - safeFsCents,
  };
}

export function markUserBalanceSynced(db: AmmDatabase, userId: string, syncedCents: number) {
  db.prepare(`
    UPDATE user_clob_accounts
    SET last_synced_firestore_balance_cents = ?, updated_at = ?
    WHERE user_id = ?
  `).run(Math.max(0, Math.round(syncedCents)), new Date().toISOString(), userId);
}

export function placeClobOrder(db: AmmDatabase, input: PlaceOrderInput): PlaceOrderResult {
  const {
    marketId,
    userId,
    isAmm = false,
    side,
    outcome,
    orderType,
    priceCents,
    quantity,
    idempotencyKey,
  } = input;

  if (!marketId || !userId) {
    throw new Error('ID do mercado e do utilizador são obrigatórios.');
  }
  if (!Number.isInteger(priceCents) || priceCents < 1 || priceCents > 99) {
    throw new Error('Preço inválido: deve ser um inteiro entre 1 e 99 cêntimos (0.01 a 0.99 Kz).');
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantidade inválida: deve ser um inteiro positivo de quotas.');
  }

  const runTx = db.transaction((): PlaceOrderResult => {
    // 1. Idempotency check inside transaction
    if (idempotencyKey) {
      const existingOrder = db
        .prepare(`SELECT * FROM clob_orders WHERE idempotency_key = ?`)
        .get(idempotencyKey) as any;
      if (existingOrder) {
        const alloc = db.prepare(`SELECT yes_price_cents, no_price_cents FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;
        return {
          orderId: existingOrder.id,
          status: existingOrder.status,
          filledQuantity: existingOrder.filled_quantity,
          remainingQuantity: existingOrder.remaining_quantity,
          avgExecutionPriceCents: existingOrder.price_cents,
          executions: [],
          yesPriceCents: alloc?.yes_price_cents ?? 50,
          noPriceCents: alloc?.no_price_cents ?? 50,
        };
      }
    }

    ensureMarketRecord(db, marketId);
    const alloc = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;
    if (alloc.market_resolved === 1) {
      throw new Error('Mercado já foi resolvido; negociações encerradas.');
    }

    const now = new Date().toISOString();
    const orderId = randomUUID();
    const seq = nextClobSeq(db);
    let reservedCents = 0;

    // 2. Collateral / Risk Reservation
    if (isAmm) {
      if (userId !== AMM_COMPANY_USER_ID) {
        throw new Error('Identidade AMM inválida.');
      }
      const allowance = checkAmmRiskAllowance(db, marketId, side, outcome, priceCents, quantity);
      if (!allowance.allowed) {
        throw new Error(allowance.reason);
      }

      if (side === 'Buy') {
        reservedCents = priceCents * quantity;
        db.prepare(`
          UPDATE amm_market_allocations
          SET reserved_capital_cents = reserved_capital_cents + ?, updated_at = ?
          WHERE market_id = ?
        `).run(reservedCents, now, marketId);

        postJournalEntry(db, {
          idempotencyKey: `AMM_RESERVE_BUY_${orderId}`,
          referenceType: 'AMM_ORDER_RESERVE',
          referenceId: orderId,
          marketId,
          description: `Reserva de capital AMM para compra de ${quantity} quotas ${outcome} @ ${priceCents}c`,
          actorId: AMM_COMPANY_USER_ID,
          lines: [
            { accountCode: 'amm_reserved_cash', debitCents: reservedCents },
            { accountCode: 'amm_cash', creditCents: reservedCents },
          ],
        });
      } else {
        // AMM Sell: subtract shares already committed to other open AMM Sell orders to avoid double-use
        const inv = db.prepare(`SELECT shares_sim, shares_no FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
        const held = outcome === 'Yes' ? (inv?.shares_sim ?? 0) : (inv?.shares_no ?? 0);
        const lockedRow = db
          .prepare(`
            SELECT COALESCE(SUM(remaining_quantity), 0) AS locked
            FROM clob_orders
            WHERE market_id = ? AND is_amm = 1 AND side = 'Sell' AND outcome = ? AND status IN ('OPEN', 'PARTIAL')
          `)
          .get(marketId, outcome) as { locked: number };
        const freeHeld = Math.max(0, held - (lockedRow?.locked ?? 0));
        const uncovered = Math.max(0, quantity - freeHeld);
        reservedCents = uncovered * (100 - priceCents);

        if (reservedCents > 0) {
          db.prepare(`
            UPDATE amm_market_allocations
            SET reserved_capital_cents = reserved_capital_cents + ?, updated_at = ?
            WHERE market_id = ?
          `).run(reservedCents, now, marketId);

          postJournalEntry(db, {
            idempotencyKey: `AMM_RESERVE_SELL_${orderId}`,
            referenceType: 'AMM_ORDER_RESERVE',
            referenceId: orderId,
            marketId,
            description: `Colateral reservado AMM para venda de ${uncovered} quotas ${outcome} @ ${priceCents}c`,
            actorId: AMM_COMPANY_USER_ID,
            lines: [
              { accountCode: 'amm_reserved_cash', debitCents: reservedCents },
              { accountCode: 'amm_cash', creditCents: reservedCents },
            ],
          });
        }
      }
    } else {
      // User order reservation (strictly segregated from AMM!)
      ensureUserClobAccount(db, userId, 0);
      if (side === 'Buy') {
        const maxNotional = priceCents * quantity;
        const maxFee = Math.round(maxNotional * 0.01);
        reservedCents = maxNotional + maxFee;

        const userAcc = db.prepare(`SELECT available_cents FROM user_clob_accounts WHERE user_id = ?`).get(userId) as { available_cents: number };
        if (!userAcc || userAcc.available_cents < reservedCents) {
          throw new Error(
            `Saldo insuficiente na carteira do utilizador. Necessário ${(reservedCents / 100).toFixed(2)} Kz (incl. taxa 1%), disponível ${((userAcc?.available_cents || 0) / 100).toFixed(2)} Kz.`
          );
        }

        db.prepare(`
          UPDATE user_clob_accounts
          SET available_cents = available_cents - ?,
              reserved_cents = reserved_cents + ?,
              updated_at = ?
          WHERE user_id = ?
        `).run(reservedCents, reservedCents, now, userId);
      } else {
        const pos = db
          .prepare(`SELECT available_shares FROM user_clob_positions WHERE user_id = ? AND market_id = ? AND outcome = ?`)
          .get(userId, marketId, outcome) as { available_shares: number } | undefined;

        if (!pos || pos.available_shares < quantity) {
          throw new Error(
            `Quotas insuficientes para venda. Possui ${pos?.available_shares || 0} quotas de ${outcome}, tentou vender ${quantity}.`
          );
        }

        db.prepare(`
          UPDATE user_clob_positions
          SET available_shares = available_shares - ?,
              reserved_shares = reserved_shares + ?,
              updated_at = ?
          WHERE user_id = ? AND market_id = ? AND outcome = ?
        `).run(quantity, quantity, now, userId, marketId, outcome);
      }
    }

    // Insert taker order
    db.prepare(`
      INSERT INTO clob_orders (
        id, seq, market_id, user_id, is_amm, side, outcome, order_type,
        price_cents, quantity, filled_quantity, remaining_quantity, reserved_cents,
        status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'OPEN', ?, ?, ?)
    `).run(
      orderId,
      seq,
      marketId,
      userId,
      isAmm ? 1 : 0,
      side,
      outcome,
      orderType,
      priceCents,
      quantity,
      quantity,
      reservedCents,
      idempotencyKey || null,
      now,
      now
    );

    // 3. Match against resting orders strictly by Price / Time priority (NO self-trading, NO AMM priority)
    const oppositeSide = side === 'Buy' ? 'Sell' : 'Buy';
    const matchingQuery =
      side === 'Buy'
        ? `SELECT * FROM clob_orders
           WHERE market_id = ? AND outcome = ? AND side = ? AND status IN ('OPEN', 'PARTIAL')
             AND price_cents <= ? AND user_id != ?
           ORDER BY price_cents ASC, seq ASC`
        : `SELECT * FROM clob_orders
           WHERE market_id = ? AND outcome = ? AND side = ? AND status IN ('OPEN', 'PARTIAL')
             AND price_cents >= ? AND user_id != ?
           ORDER BY price_cents DESC, seq ASC`;

    const candidates = db
      .prepare(matchingQuery)
      .all(marketId, outcome, oppositeSide, priceCents, userId) as any[];

    let remaining = quantity;
    let filledTotal = 0;
    let totalNotional = 0;
    let lastExecPrice: number | null = null;
    const executions: PlaceOrderResult['executions'] = [];

    for (const maker of candidates) {
      if (remaining <= 0) break;
      if (maker.user_id === userId) continue; // Double check self-trading prevention

      const fillQty = Math.min(remaining, maker.remaining_quantity);
      if (fillQty <= 0) continue;

      const execPrice = maker.price_cents; // Maker's resting price (price/time priority)
      const notional = fillQty * execPrice;
      const executionId = randomUUID();

      // Calculate fee (1% on user side; AMM does not pay platform fee to itself)
      const buyerIsAmm = side === 'Buy' ? isAmm : maker.is_amm === 1;
      const sellerIsAmm = side === 'Sell' ? isAmm : maker.is_amm === 1;
      const feeCents = !buyerIsAmm ? Math.round(notional * 0.01) : !sellerIsAmm ? Math.round(notional * 0.01) : 0;

      // Update Maker Order
      const makerNewFilled = maker.filled_quantity + fillQty;
      const makerNewRemaining = maker.remaining_quantity - fillQty;
      const makerNewStatus = makerNewRemaining === 0 ? 'FILLED' : 'PARTIAL';

      // Proportional maker reserve release
      const makerReserveUsed =
        maker.remaining_quantity > 0
          ? makerNewRemaining === 0
            ? maker.reserved_cents
            : Math.floor((maker.reserved_cents * fillQty) / maker.remaining_quantity)
          : 0;

      db.prepare(`
        UPDATE clob_orders
        SET filled_quantity = ?, remaining_quantity = ?,
            reserved_cents = MAX(0, reserved_cents - ?),
            status = ?, updated_at = ?
        WHERE id = ?
      `).run(makerNewFilled, makerNewRemaining, makerReserveUsed, makerNewStatus, now, maker.id);

      // Update Taker Order running reserve
      const takerReserveUsed =
        remaining > 0
          ? remaining - fillQty === 0
            ? reservedCents
            : Math.floor((reservedCents * fillQty) / remaining)
          : 0;
      reservedCents = Math.max(0, reservedCents - takerReserveUsed);

      // Record execution
      db.prepare(`
        INSERT INTO clob_executions (
          id, market_id, maker_order_id, taker_order_id, maker_user_id, taker_user_id,
          outcome, price_cents, quantity, notional_cents, fee_cents, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        executionId,
        marketId,
        maker.id,
        orderId,
        maker.user_id,
        userId,
        outcome,
        execPrice,
        fillQty,
        notional,
        feeCents,
        now
      );

      // Settle Buyer & Seller sides cleanly
      const buyOrder = side === 'Buy' ? { id: orderId, user_id: userId, is_amm: isAmm ? 1 : 0, price_cents: priceCents, reserveUsed: takerReserveUsed } : { id: maker.id, user_id: maker.user_id, is_amm: maker.is_amm, price_cents: maker.price_cents, reserveUsed: makerReserveUsed };
      const sellOrder = side === 'Sell' ? { id: orderId, user_id: userId, is_amm: isAmm ? 1 : 0, price_cents: priceCents, reserveUsed: takerReserveUsed } : { id: maker.id, user_id: maker.user_id, is_amm: maker.is_amm, price_cents: maker.price_cents, reserveUsed: makerReserveUsed };

      // Settle BUYER
      if (buyOrder.is_amm === 1) {
        settleAmmBuyFill(db, {
          executionId,
          orderId: buyOrder.id,
          marketId,
          counterpartyUserId: sellOrder.user_id,
          outcome,
          execPrice,
          fillQty,
          reservedUsed: buyOrder.reserveUsed,
          isMaker: side === 'Sell',
        });
      } else {
        const buyerFee = Math.round(notional * 0.01);
        const actualBuyerCost = notional + buyerFee;
        const refundExcess = Math.max(0, buyOrder.reserveUsed - actualBuyerCost);
        db.prepare(`
          UPDATE user_clob_accounts
          SET reserved_cents = MAX(0, reserved_cents - ?),
              available_cents = available_cents + ?,
              updated_at = ?
          WHERE user_id = ?
        `).run(buyOrder.reserveUsed, refundExcess, now, buyOrder.user_id);

        creditUserPosition(db, buyOrder.user_id, marketId, outcome, fillQty, execPrice, now);
      }

      // Settle SELLER
      if (sellOrder.is_amm === 1) {
        settleAmmSellFill(db, {
          executionId,
          orderId: sellOrder.id,
          marketId,
          counterpartyUserId: buyOrder.user_id,
          outcome,
          execPrice,
          fillQty,
          reservedUsed: sellOrder.reserveUsed,
          isMaker: side === 'Buy',
        });
      } else {
        const sellerFee = buyOrder.is_amm === 1 ? 0 : 0; // Fee charged on buyer or taker; keep seller proceeds clean or net
        const sellerProceeds = notional - sellerFee;
        db.prepare(`
          UPDATE user_clob_positions
          SET reserved_shares = MAX(0, reserved_shares - ?),
              updated_at = ?
          WHERE user_id = ? AND market_id = ? AND outcome = ?
        `).run(fillQty, now, sellOrder.user_id, marketId, outcome);

        ensureUserClobAccount(db, sellOrder.user_id, 0);
        db.prepare(`
          UPDATE user_clob_accounts
          SET available_cents = available_cents + ?, updated_at = ?
          WHERE user_id = ?
        `).run(sellerProceeds, now, sellOrder.user_id);
      }

      remaining -= fillQty;
      filledTotal += fillQty;
      totalNotional += notional;
      lastExecPrice = execPrice;

      executions.push({
        executionId,
        makerOrderId: maker.id,
        takerOrderId: orderId,
        priceCents: execPrice,
        quantity: fillQty,
        notionalCents: notional,
        feeCents,
      });
    }

    // 4. Finalize Taker Order Status (Market orders are Immediate-Or-Cancel; refund any unfilled reserve)
    let finalStatus = remaining === 0 ? 'FILLED' : filledTotal > 0 ? 'PARTIAL' : 'OPEN';
    if (orderType === 'MARKET' && remaining > 0) {
      finalStatus = filledTotal > 0 ? 'FILLED' : 'CANCELLED';
      if (!isAmm) {
        if (side === 'Buy' && reservedCents > 0) {
          db.prepare(`
            UPDATE user_clob_accounts
            SET available_cents = available_cents + ?,
                reserved_cents = MAX(0, reserved_cents - ?),
                updated_at = ?
            WHERE user_id = ?
          `).run(reservedCents, reservedCents, now, userId);
          reservedCents = 0;
        } else if (side === 'Sell') {
          db.prepare(`
            UPDATE user_clob_positions
            SET available_shares = available_shares + ?,
                reserved_shares = MAX(0, reserved_shares - ?),
                updated_at = ?
            WHERE user_id = ? AND market_id = ? AND outcome = ?
          `).run(remaining, remaining, now, userId, marketId, outcome);
        }
      } else if (reservedCents > 0) {
        // Refund unfilled AMM market order reserve
        db.prepare(`
          UPDATE amm_market_allocations
          SET reserved_capital_cents = MAX(0, reserved_capital_cents - ?), updated_at = ?
          WHERE market_id = ?
        `).run(reservedCents, now, marketId);
        postJournalEntry(db, {
          idempotencyKey: `AMM_IOC_REFUND_${orderId}`,
          referenceType: 'AMM_IOC_REFUND',
          referenceId: orderId,
          marketId,
          description: `Devolução de reserva não executada de ordem de mercado AMM`,
          actorId: AMM_COMPANY_USER_ID,
          lines: [
            { accountCode: 'amm_cash', debitCents: reservedCents },
            { accountCode: 'amm_reserved_cash', creditCents: reservedCents },
          ],
        });
        reservedCents = 0;
      }
      remaining = 0;
    }

    db.prepare(`
      UPDATE clob_orders
      SET filled_quantity = ?, remaining_quantity = ?, reserved_cents = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(filledTotal, remaining, reservedCents, finalStatus, now, orderId);

    // 5. Update market reference prices if execution happened
    let yesPriceCents = alloc.yes_price_cents;
    let noPriceCents = alloc.no_price_cents;
    if (lastExecPrice !== null) {
      if (outcome === 'Yes') {
        yesPriceCents = Math.max(1, Math.min(99, lastExecPrice));
        noPriceCents = 100 - yesPriceCents;
      } else {
        noPriceCents = Math.max(1, Math.min(99, lastExecPrice));
        yesPriceCents = 100 - noPriceCents;
      }
      db.prepare(`
        UPDATE amm_market_allocations
        SET yes_price_cents = ?, no_price_cents = ?, updated_at = ?
        WHERE market_id = ?
      `).run(yesPriceCents, noPriceCents, now, marketId);
    }

    // 6. Re-evaluate Risk Engine & PnL Snapshot if market has allocation
    if (alloc.allocated_capital_cents > 0 || filledTotal > 0) {
      evaluateAndPersistMarketRisk(db, marketId, yesPriceCents, noPriceCents);
      recordPnlSnapshot(db, marketId);
    }

    return {
      orderId,
      status: finalStatus,
      filledQuantity: filledTotal,
      remainingQuantity: remaining,
      avgExecutionPriceCents: filledTotal > 0 ? Math.round(totalNotional / filledTotal) : null,
      executions,
      yesPriceCents,
      noPriceCents,
    };
  });

  return runTx();
}

function creditUserPosition(
  db: AmmDatabase,
  userId: string,
  marketId: string,
  outcome: 'Yes' | 'No',
  shares: number,
  priceCents: number,
  now: string
) {
  const existing = db
    .prepare(`SELECT available_shares, avg_price_cents FROM user_clob_positions WHERE user_id = ? AND market_id = ? AND outcome = ?`)
    .get(userId, marketId, outcome) as { available_shares: number; avg_price_cents: number } | undefined;

  if (!existing) {
    db.prepare(`
      INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(userId, marketId, outcome, shares, priceCents, now);
  } else {
    const newShares = existing.available_shares + shares;
    const newAvg = Math.round((existing.available_shares * existing.avg_price_cents + shares * priceCents) / newShares);
    db.prepare(`
      UPDATE user_clob_positions
      SET available_shares = ?, avg_price_cents = ?, updated_at = ?
      WHERE user_id = ? AND market_id = ? AND outcome = ?
    `).run(newShares, newAvg, now, userId, marketId, outcome);
  }
}

function settleAmmBuyFill(
  db: AmmDatabase,
  params: {
    executionId: string;
    orderId: string;
    marketId: string;
    counterpartyUserId: string;
    outcome: 'Yes' | 'No';
    execPrice: number;
    fillQty: number;
    reservedUsed: number;
    isMaker: boolean;
  }
) {
  const { executionId, orderId, marketId, counterpartyUserId, outcome, execPrice, fillQty, reservedUsed, isMaker } = params;
  const now = new Date().toISOString();
  const actualCost = fillQty * execPrice;
  const excessRefund = Math.max(0, reservedUsed - actualCost);
  const posAccount = outcome === 'Yes' ? 'amm_positions_sim' : 'amm_positions_no';

  const lines: any[] = [
    { accountCode: posAccount, debitCents: actualCost },
    { accountCode: 'amm_reserved_cash', creditCents: reservedUsed },
  ];
  if (excessRefund > 0) {
    lines.push({ accountCode: 'amm_cash', debitCents: excessRefund });
  }

  postJournalEntry(db, {
    idempotencyKey: `AMM_BUY_FILL_${executionId}`,
    referenceType: 'AMM_TRADE_BUY',
    referenceId: executionId,
    marketId,
    description: `AMM comprou ${fillQty} quotas ${outcome} @ ${execPrice}c`,
    actorId: AMM_COMPANY_USER_ID,
    lines,
  });

  db.prepare(`
    UPDATE amm_market_allocations
    SET reserved_capital_cents = MAX(0, reserved_capital_cents - ?),
        used_capital_cents = used_capital_cents + ?,
        updated_at = ?
    WHERE market_id = ?
  `).run(reservedUsed, actualCost, now, marketId);

  addAmmInventory(db, marketId, outcome, fillQty, actualCost, now);

  db.prepare(`
    INSERT INTO amm_trades (
      id, market_id, clob_order_id, execution_id, counterparty_user_id, side, outcome,
      price_cents, shares, notional_cents, fee_cents, realized_pnl_cents, is_amm_maker, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Buy', ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(randomUUID(), marketId, orderId, executionId, counterpartyUserId, outcome, execPrice, fillQty, actualCost, isMaker ? 1 : 0, now);
}

function settleAmmSellFill(
  db: AmmDatabase,
  params: {
    executionId: string;
    orderId: string;
    marketId: string;
    counterpartyUserId: string;
    outcome: 'Yes' | 'No';
    execPrice: number;
    fillQty: number;
    reservedUsed: number;
    isMaker: boolean;
  }
) {
  const { executionId, orderId, marketId, counterpartyUserId, outcome, execPrice, fillQty, reservedUsed, isMaker } = params;
  const now = new Date().toISOString();

  // First release any reserved cash on the Sell order back to amm_cash
  if (reservedUsed > 0) {
    db.prepare(`
      UPDATE amm_market_allocations
      SET reserved_capital_cents = MAX(0, reserved_capital_cents - ?),
          updated_at = ?
      WHERE market_id = ?
    `).run(reservedUsed, now, marketId);

    postJournalEntry(db, {
      idempotencyKey: `AMM_SELL_REL_${executionId}`,
      referenceType: 'AMM_SELL_RESERVE_RELEASE',
      referenceId: executionId,
      marketId,
      description: `Liberação de colateral reservado para execução de venda AMM`,
      actorId: AMM_COMPANY_USER_ID,
      lines: [
        { accountCode: 'amm_cash', debitCents: reservedUsed },
        { accountCode: 'amm_reserved_cash', creditCents: reservedUsed },
      ],
    });
  }

  const inv = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
  const held = outcome === 'Yes' ? (inv?.shares_sim ?? 0) : (inv?.shares_no ?? 0);
  const heldCost = outcome === 'Yes' ? (inv?.cost_basis_sim_cents ?? 0) : (inv?.cost_basis_no_cents ?? 0);

  const fromInventory = Math.min(held, fillQty);
  const mintedQty = fillQty - fromInventory;
  let totalRealizedPnl = 0;

  if (fromInventory > 0) {
    const costOfSold = fromInventory === held ? heldCost : Math.round((heldCost * fromInventory) / held);
    const proceeds = fromInventory * execPrice;
    const realizedPnl = proceeds - costOfSold;
    totalRealizedPnl += realizedPnl;

    const posAccount = outcome === 'Yes' ? 'amm_positions_sim' : 'amm_positions_no';
    const lines: any[] = [
      { accountCode: 'amm_cash', debitCents: proceeds },
      { accountCode: posAccount, creditCents: costOfSold },
    ];
    if (realizedPnl > 0) {
      lines.push({ accountCode: 'amm_realized_pnl', creditCents: realizedPnl });
    } else if (realizedPnl < 0) {
      lines.push({ accountCode: 'amm_realized_pnl', debitCents: Math.abs(realizedPnl) });
    }

    postJournalEntry(db, {
      idempotencyKey: `AMM_SELL_INV_${executionId}`,
      referenceType: 'AMM_TRADE_SELL',
      referenceId: executionId,
      marketId,
      description: `AMM vendeu ${fromInventory} quotas ${outcome} do inventário @ ${execPrice}c (PnL ${(realizedPnl / 100).toFixed(2)} Kz)`,
      actorId: AMM_COMPANY_USER_ID,
      lines,
    });

    db.prepare(`
      UPDATE amm_market_allocations
      SET used_capital_cents = MAX(0, used_capital_cents - ?),
          updated_at = ?
      WHERE market_id = ?
    `).run(costOfSold, now, marketId);

    removeAmmInventory(db, marketId, outcome, fromInventory, costOfSold, realizedPnl, now);
  }

  if (mintedQty > 0) {
    // Minting complete set: buyer pays execPrice * mintedQty for `outcome`,
    // AMM pays (100 - execPrice) * mintedQty from `amm_cash` and acquires `mintedQty` of `oppositeOutcome`!
    const oppositeOutcome: 'Yes' | 'No' = outcome === 'Yes' ? 'No' : 'Yes';
    const ammMintCost = mintedQty * (100 - execPrice);
    const posAccount = oppositeOutcome === 'Yes' ? 'amm_positions_sim' : 'amm_positions_no';

    postJournalEntry(db, {
      idempotencyKey: `AMM_MINT_SET_${executionId}`,
      referenceType: 'AMM_COMPLETE_SET_MINT',
      referenceId: executionId,
      marketId,
      description: `AMM emitiu conjunto completo na venda de ${mintedQty} ${outcome} @ ${execPrice}c, adquirindo ${mintedQty} ${oppositeOutcome} @ ${100 - execPrice}c`,
      actorId: AMM_COMPANY_USER_ID,
      lines: [
        { accountCode: posAccount, debitCents: ammMintCost },
        { accountCode: 'amm_cash', creditCents: ammMintCost },
      ],
    });

    db.prepare(`
      UPDATE amm_market_allocations
      SET used_capital_cents = used_capital_cents + ?,
          updated_at = ?
      WHERE market_id = ?
    `).run(ammMintCost, now, marketId);

    addAmmInventory(db, marketId, oppositeOutcome, mintedQty, ammMintCost, now);
  }

  db.prepare(`
    INSERT INTO amm_trades (
      id, market_id, clob_order_id, execution_id, counterparty_user_id, side, outcome,
      price_cents, shares, notional_cents, fee_cents, realized_pnl_cents, is_amm_maker, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Sell', ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(randomUUID(), marketId, orderId, executionId, counterpartyUserId, outcome, execPrice, fillQty, fillQty * execPrice, totalRealizedPnl, isMaker ? 1 : 0, now);
}

function addAmmInventory(
  db: AmmDatabase,
  marketId: string,
  outcome: 'Yes' | 'No',
  addShares: number,
  addCostCents: number,
  now: string
) {
  const inv = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
  const curShares = outcome === 'Yes' ? (inv?.shares_sim ?? 0) : (inv?.shares_no ?? 0);
  const curCost = outcome === 'Yes' ? (inv?.cost_basis_sim_cents ?? 0) : (inv?.cost_basis_no_cents ?? 0);
  const nextShares = curShares + addShares;
  const nextCost = curCost + addCostCents;
  const nextAvg = nextShares > 0 ? Math.round(nextCost / nextShares) : 0;

  if (outcome === 'Yes') {
    db.prepare(`
      UPDATE amm_inventory
      SET shares_sim = ?, cost_basis_sim_cents = ?, avg_cost_sim_cents = ?, updated_at = ?
      WHERE market_id = ?
    `).run(nextShares, nextCost, nextAvg, now, marketId);
  } else {
    db.prepare(`
      UPDATE amm_inventory
      SET shares_no = ?, cost_basis_no_cents = ?, avg_cost_no_cents = ?, updated_at = ?
      WHERE market_id = ?
    `).run(nextShares, nextCost, nextAvg, now, marketId);
  }

  // Upsert amm_positions
  db.prepare(`
    INSERT INTO amm_positions (id, market_id, outcome, shares, avg_entry_price_cents, cost_basis_cents, mark_price_cents, unrealized_pnl_cents, realized_pnl_cents, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'OPEN', ?)
    ON CONFLICT(market_id, outcome) DO UPDATE SET
      shares = excluded.shares,
      avg_entry_price_cents = excluded.avg_entry_price_cents,
      cost_basis_cents = excluded.cost_basis_cents,
      status = 'OPEN',
      updated_at = excluded.updated_at
  `).run(`${marketId}_${outcome}`, marketId, outcome, nextShares, nextAvg, nextCost, nextAvg, now);
}

function removeAmmInventory(
  db: AmmDatabase,
  marketId: string,
  outcome: 'Yes' | 'No',
  soldShares: number,
  soldCostCents: number,
  realizedPnlCents: number,
  now: string
) {
  const inv = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
  const curShares = outcome === 'Yes' ? (inv?.shares_sim ?? 0) : (inv?.shares_no ?? 0);
  const curCost = outcome === 'Yes' ? (inv?.cost_basis_sim_cents ?? 0) : (inv?.cost_basis_no_cents ?? 0);
  const nextShares = Math.max(0, curShares - soldShares);
  const nextCost = Math.max(0, curCost - soldCostCents);
  const nextAvg = nextShares > 0 ? Math.round(nextCost / nextShares) : 0;

  if (outcome === 'Yes') {
    db.prepare(`
      UPDATE amm_inventory
      SET shares_sim = ?, cost_basis_sim_cents = ?, avg_cost_sim_cents = ?,
          realized_pnl_cents = realized_pnl_cents + ?, updated_at = ?
      WHERE market_id = ?
    `).run(nextShares, nextCost, nextAvg, realizedPnlCents, now, marketId);
  } else {
    db.prepare(`
      UPDATE amm_inventory
      SET shares_no = ?, cost_basis_no_cents = ?, avg_cost_no_cents = ?,
          realized_pnl_cents = realized_pnl_cents + ?, updated_at = ?
      WHERE market_id = ?
    `).run(nextShares, nextCost, nextAvg, realizedPnlCents, now, marketId);
  }

  db.prepare(`
    UPDATE amm_positions
    SET shares = ?, avg_entry_price_cents = ?, cost_basis_cents = ?,
        realized_pnl_cents = realized_pnl_cents + ?,
        status = CASE WHEN ? = 0 THEN 'SETTLED' ELSE 'OPEN' END,
        updated_at = ?
    WHERE market_id = ? AND outcome = ?
  `).run(nextShares, nextAvg, nextCost, realizedPnlCents, nextShares, now, marketId, outcome);
}

export function cancelClobOrder(db: AmmDatabase, orderId: string, requesterId: string, isAdmin: boolean = false) {
  return db.transaction(() => {
    const order = db.prepare(`SELECT * FROM clob_orders WHERE id = ?`).get(orderId) as any;
    if (!order) {
      throw new Error('Ordem não encontrada.');
    }
    if (!isAdmin && order.user_id !== requesterId) {
      throw new Error('Sem permissão para cancelar esta ordem.');
    }
    if (!['OPEN', 'PARTIAL'].includes(order.status)) {
      throw new Error(`Ordem já está no estado ${order.status}.`);
    }

    if (order.is_amm === 1) {
      ammCancelOrderInternal(db, orderId, 'ADMIN_OR_STRATEGY_CANCEL', requesterId);
      return { orderId, status: 'CANCELLED', refundedCents: order.reserved_cents };
    }

    const now = new Date().toISOString();
    const refundedCents = order.reserved_cents || 0;
    const refundedShares = order.side === 'Sell' ? order.remaining_quantity : 0;

    db.prepare(`
      UPDATE clob_orders
      SET status = 'CANCELLED', reserved_cents = 0, updated_at = ?
      WHERE id = ?
    `).run(now, orderId);

    if (order.side === 'Buy' && refundedCents > 0) {
      db.prepare(`
        UPDATE user_clob_accounts
        SET available_cents = available_cents + ?,
            reserved_cents = MAX(0, reserved_cents - ?),
            updated_at = ?
        WHERE user_id = ?
      `).run(refundedCents, refundedCents, now, order.user_id);
    } else if (order.side === 'Sell' && refundedShares > 0) {
      db.prepare(`
        UPDATE user_clob_positions
        SET available_shares = available_shares + ?,
            reserved_shares = MAX(0, reserved_shares - ?),
            updated_at = ?
        WHERE user_id = ? AND market_id = ? AND outcome = ?
      `).run(refundedShares, refundedShares, now, order.user_id, order.market_id, order.outcome);
    }

    return { orderId, status: 'CANCELLED', refundedCents, refundedShares };
  })();
}

export function resolveClobMarket(
  db: AmmDatabase,
  marketId: string,
  winningOutcome: 'Yes' | 'No',
  actorId: string
) {
  return db.transaction(() => {
    const now = new Date().toISOString();
    const alloc = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;
    if (!alloc) {
      throw new Error('Mercado não encontrado no motor CLOB/AMM.');
    }
    if (alloc.market_resolved === 1) {
      throw new Error('Este mercado já foi resolvido anteriormente.');
    }

    // 1. Cancel all unfilled open CLOB orders (refunding reserved cash/shares)
    const openOrders = db
      .prepare(`SELECT id, user_id, is_amm FROM clob_orders WHERE market_id = ? AND status IN ('OPEN', 'PARTIAL')`)
      .all(marketId) as any[];
    const userSettlementMap = new Map<string, { payoutCents: number; refundCents: number; losingShares: number }>();
    const addSettlementNote = (uid: string, payoutDelta: number, refundDelta: number, losingDelta: number) => {
      const prev = userSettlementMap.get(uid) || { payoutCents: 0, refundCents: 0, losingShares: 0 };
      userSettlementMap.set(uid, {
        payoutCents: prev.payoutCents + payoutDelta,
        refundCents: prev.refundCents + refundDelta,
        losingShares: prev.losingShares + losingDelta,
      });
    };

    for (const ord of openOrders) {
      if (ord.is_amm === 1) {
        ammCancelOrderInternal(db, ord.id, 'MARKET_RESOLVED', actorId);
      } else {
        const o = db.prepare(`SELECT * FROM clob_orders WHERE id = ?`).get(ord.id) as any;
        db.prepare(`UPDATE clob_orders SET status = 'CANCELLED', reserved_cents = 0, updated_at = ? WHERE id = ?`).run(now, o.id);
        if (o.side === 'Buy' && o.reserved_cents > 0) {
          db.prepare(`UPDATE user_clob_accounts SET available_cents = available_cents + ?, reserved_cents = MAX(0, reserved_cents - ?), updated_at = ? WHERE user_id = ?`)
            .run(o.reserved_cents, o.reserved_cents, now, o.user_id);
          addSettlementNote(o.user_id, 0, o.reserved_cents, 0);
        } else if (o.side === 'Sell' && o.remaining_quantity > 0) {
          db.prepare(`UPDATE user_clob_positions SET available_shares = available_shares + ?, reserved_shares = MAX(0, reserved_shares - ?), updated_at = ? WHERE user_id = ? AND market_id = ? AND outcome = ?`)
            .run(o.remaining_quantity, o.remaining_quantity, now, o.user_id, marketId, o.outcome);
        }
      }
    }

    // 2. Settle all User Positions (1 winning share = 100 cents = 1.00 Kz)
    const userPositions = db
      .prepare(`SELECT * FROM user_clob_positions WHERE market_id = ? AND available_shares > 0`)
      .all(marketId) as any[];
    let totalUserPayoutCents = 0;

    for (const up of userPositions) {
      if (up.outcome === winningOutcome) {
        const payout = up.available_shares * 100;
        totalUserPayoutCents += payout;
        ensureUserClobAccount(db, up.user_id, 0);
        db.prepare(`UPDATE user_clob_accounts SET available_cents = available_cents + ?, updated_at = ? WHERE user_id = ?`)
          .run(payout, now, up.user_id);
        addSettlementNote(up.user_id, payout, 0, 0);
      } else {
        addSettlementNote(up.user_id, 0, 0, up.available_shares);
      }
      db.prepare(`UPDATE user_clob_positions SET available_shares = 0, updated_at = ? WHERE user_id = ? AND market_id = ? AND outcome = ?`)
        .run(now, up.user_id, marketId, up.outcome);
    }

    const settledUsers = Array.from(userSettlementMap.entries()).map(([uid, info]) => {
      const acc = db.prepare(`SELECT available_cents FROM user_clob_accounts WHERE user_id = ?`).get(uid) as { available_cents: number } | undefined;
      return {
        userId: uid,
        payoutCents: info.payoutCents,
        refundCents: info.refundCents,
        losingShares: info.losingShares,
        newAvailableCents: acc?.available_cents ?? 0,
      };
    });

    // 3. Settle AMM Inventory & Post Balanced Settlement Journal Entries
    const inv = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
    const sharesSim = inv?.shares_sim ?? 0;
    const sharesNo = inv?.shares_no ?? 0;
    const costSim = inv?.cost_basis_sim_cents ?? 0;
    const costNo = inv?.cost_basis_no_cents ?? 0;

    const simPayout = winningOutcome === 'Yes' ? sharesSim * 100 : 0;
    const noPayout = winningOutcome === 'No' ? sharesNo * 100 : 0;
    const totalAmmPayout = simPayout + noPayout;
    const totalCost = costSim + costNo;
    const settlementPnl = totalAmmPayout - totalCost;

    if (totalCost > 0 || totalAmmPayout > 0) {
      const lines: any[] = [];
      if (totalAmmPayout > 0) {
        lines.push({ accountCode: 'amm_cash', debitCents: totalAmmPayout });
      }
      if (costSim > 0) {
        lines.push({ accountCode: 'amm_positions_sim', creditCents: costSim });
      }
      if (costNo > 0) {
        lines.push({ accountCode: 'amm_positions_no', creditCents: costNo });
      }
      if (settlementPnl > 0) {
        lines.push({ accountCode: 'amm_realized_pnl', creditCents: settlementPnl });
      } else if (settlementPnl < 0) {
        lines.push({ accountCode: 'amm_realized_pnl', debitCents: Math.abs(settlementPnl) });
      }

      if (lines.length >= 2) {
        postJournalEntry(db, {
          idempotencyKey: `AMM_SETTLE_${marketId}`,
          referenceType: 'MARKET_RESOLUTION',
          referenceId: marketId,
          marketId,
          description: `Liquidação do mercado ${marketId} com resultado ${winningOutcome}: Payout ${(totalAmmPayout / 100).toFixed(2)} Kz vs Custo ${(totalCost / 100).toFixed(2)} Kz (PnL ${(settlementPnl / 100).toFixed(2)} Kz)`,
          actorId: actorId,
          lines,
        });
      }
    }

    // Zero out AMM inventory and mark positions SETTLED
    db.prepare(`
      UPDATE amm_inventory
      SET shares_sim = 0, shares_no = 0,
          cost_basis_sim_cents = 0, cost_basis_no_cents = 0,
          avg_cost_sim_cents = 0, avg_cost_no_cents = 0,
          net_exposure_cents = 0, worst_case_liability_cents = 0,
          unrealized_pnl_cents = 0,
          realized_pnl_cents = realized_pnl_cents + ?,
          updated_at = ?
      WHERE market_id = ?
    `).run(settlementPnl, now, marketId);

    db.prepare(`
      UPDATE amm_positions
      SET shares = 0, cost_basis_cents = 0, unrealized_pnl_cents = 0,
          realized_pnl_cents = realized_pnl_cents + CASE WHEN outcome = ? THEN ? - cost_basis_cents ELSE -cost_basis_cents END,
          status = 'SETTLED', updated_at = ?
      WHERE market_id = ?
    `).run(winningOutcome, winningOutcome === 'Yes' ? simPayout : noPayout, now, marketId);

    db.prepare(`UPDATE amm_quotes SET status = 'EXPIRED', updated_at = ? WHERE market_id = ? AND status = 'ACTIVE'`)
      .run(now, marketId);

    db.prepare(`
      UPDATE amm_market_allocations
      SET market_resolved = 1,
          resolution_outcome = ?,
          used_capital_cents = 0,
          reserved_capital_cents = 0,
          yes_price_cents = ?,
          no_price_cents = ?,
          updated_at = ?
      WHERE market_id = ?
    `).run(
      winningOutcome,
      winningOutcome === 'Yes' ? 99 : 1,
      winningOutcome === 'No' ? 99 : 1,
      now,
      marketId
    );

    recordPnlSnapshot(db, marketId);

    return {
      marketId,
      winningOutcome,
      ammPayoutCents: totalAmmPayout,
      ammCostCents: totalCost,
      ammSettlementPnlCents: settlementPnl,
      totalUserPayoutCents,
      settledUsers,
    };
  })();
}

export interface OrderBookLevel {
  price_cents: number;
  total_shares: number;
  amm_shares: number;
  order_count: number;
}

export function getOrderBook(db: AmmDatabase, marketId: string) {
  const yesBids = db
    .prepare(`
      SELECT price_cents, SUM(remaining_quantity) AS total_shares,
             SUM(CASE WHEN is_amm = 1 THEN remaining_quantity ELSE 0 END) AS amm_shares,
             COUNT(*) AS order_count
      FROM clob_orders
      WHERE market_id = ? AND outcome = 'Yes' AND side = 'Buy' AND status IN ('OPEN', 'PARTIAL')
      GROUP BY price_cents
      ORDER BY price_cents DESC
      LIMIT 15
    `)
    .all(marketId) as OrderBookLevel[];

  const yesAsks = db
    .prepare(`
      SELECT price_cents, SUM(remaining_quantity) AS total_shares,
             SUM(CASE WHEN is_amm = 1 THEN remaining_quantity ELSE 0 END) AS amm_shares,
             COUNT(*) AS order_count
      FROM clob_orders
      WHERE market_id = ? AND outcome = 'Yes' AND side = 'Sell' AND status IN ('OPEN', 'PARTIAL')
      GROUP BY price_cents
      ORDER BY price_cents ASC
      LIMIT 15
    `)
    .all(marketId) as OrderBookLevel[];

  const noBids = db
    .prepare(`
      SELECT price_cents, SUM(remaining_quantity) AS total_shares,
             SUM(CASE WHEN is_amm = 1 THEN remaining_quantity ELSE 0 END) AS amm_shares,
             COUNT(*) AS order_count
      FROM clob_orders
      WHERE market_id = ? AND outcome = 'No' AND side = 'Buy' AND status IN ('OPEN', 'PARTIAL')
      GROUP BY price_cents
      ORDER BY price_cents DESC
      LIMIT 15
    `)
    .all(marketId) as OrderBookLevel[];

  const noAsks = db
    .prepare(`
      SELECT price_cents, SUM(remaining_quantity) AS total_shares,
             SUM(CASE WHEN is_amm = 1 THEN remaining_quantity ELSE 0 END) AS amm_shares,
             COUNT(*) AS order_count
      FROM clob_orders
      WHERE market_id = ? AND outcome = 'No' AND side = 'Sell' AND status IN ('OPEN', 'PARTIAL')
      GROUP BY price_cents
      ORDER BY price_cents ASC
      LIMIT 15
    `)
    .all(marketId) as OrderBookLevel[];

  const alloc = db
    .prepare(`SELECT yes_price_cents, no_price_cents, risk_state, status FROM amm_market_allocations WHERE market_id = ?`)
    .get(marketId) as any;

  return {
    marketId,
    yesPriceCents: alloc?.yes_price_cents ?? 50,
    noPriceCents: alloc?.no_price_cents ?? 50,
    ammStatus: alloc?.status ?? 'PENDING',
    riskState: alloc?.risk_state ?? 'NORMAL',
    yes: { bids: yesBids, asks: yesAsks },
    no: { bids: noBids, asks: noAsks },
  };
}

export interface ClobQuoteResult {
  marketId: string;
  side: 'Buy' | 'Sell';
  outcome: 'Yes' | 'No';
  orderType: 'LIMIT' | 'MARKET';
  executableShares: number;
  avgPriceCents: number;
  worstFillPriceCents: number;
  estimatedNotionalCents: number;
  estimatedFeeCents: number;
  estimatedTotalCents: number;
  hasLiquidity: boolean;
  referencePriceCents: number;
}

/**
 * Simulates a CLOB Market or Limit order against current resting orders without mutating state.
 * For MARKET Buy with budgetKz, computes the exact integer shares and max fill price cap affordable within budget.
 */
export function quoteClobOrder(
  db: AmmDatabase,
  params: {
    marketId: string;
    side: 'Buy' | 'Sell';
    outcome: 'Yes' | 'No';
    orderType: 'LIMIT' | 'MARKET';
    budgetKz?: number;
    quantity?: number;
    limitPriceCents?: number;
    userId?: string;
  }
): ClobQuoteResult {
  const { marketId, side, outcome, orderType, budgetKz = 0, quantity = 0, limitPriceCents, userId } = params;
  const alloc = db
    .prepare(`SELECT yes_price_cents, no_price_cents FROM amm_market_allocations WHERE market_id = ?`)
    .get(marketId) as { yes_price_cents: number; no_price_cents: number } | undefined;
  const refPrice = outcome === 'Yes' ? (alloc?.yes_price_cents ?? 50) : (alloc?.no_price_cents ?? 50);

  const oppositeSide = side === 'Buy' ? 'Sell' : 'Buy';
  const excludeUid = userId || '__NONE__';
  const rows = db
    .prepare(
      side === 'Buy'
        ? `SELECT price_cents, remaining_quantity FROM clob_orders
           WHERE market_id = ? AND outcome = ? AND side = ? AND status IN ('OPEN', 'PARTIAL') AND user_id != ?
           ORDER BY price_cents ASC, seq ASC`
        : `SELECT price_cents, remaining_quantity FROM clob_orders
           WHERE market_id = ? AND outcome = ? AND side = ? AND status IN ('OPEN', 'PARTIAL') AND user_id != ?
           ORDER BY price_cents DESC, seq ASC`
    )
    .all(marketId, outcome, oppositeSide, excludeUid) as Array<{ price_cents: number; remaining_quantity: number }>;

  if (orderType === 'LIMIT' && limitPriceCents && limitPriceCents >= 1 && limitPriceCents <= 99) {
    const qty = side === 'Buy'
      ? (quantity > 0 ? Math.floor(quantity) : Math.floor((budgetKz * 100) / (limitPriceCents * 1.01)))
      : Math.floor(quantity);
    let remaining = Math.max(0, qty);
    let filled = 0;
    let notionalCents = 0;
    let worstPrice = limitPriceCents;
    for (const r of rows) {
      if (remaining <= 0) break;
      if (side === 'Buy' && r.price_cents > limitPriceCents) break;
      if (side === 'Sell' && r.price_cents < limitPriceCents) break;
      const take = Math.min(remaining, r.remaining_quantity);
      filled += take;
      notionalCents += take * r.price_cents;
      worstPrice = r.price_cents;
      remaining -= take;
    }
    const fee = side === 'Buy' ? Math.round((filled > 0 ? notionalCents : qty * limitPriceCents) * 0.01) : 0;
    const totalNotional = filled > 0 ? notionalCents : qty * limitPriceCents;
    return {
      marketId,
      side,
      outcome,
      orderType,
      executableShares: qty,
      avgPriceCents: qty > 0 ? Math.round(totalNotional / qty) : limitPriceCents,
      worstFillPriceCents: worstPrice,
      estimatedNotionalCents: totalNotional,
      estimatedFeeCents: fee,
      estimatedTotalCents: side === 'Buy' ? totalNotional + fee : totalNotional,
      hasLiquidity: filled > 0,
      referencePriceCents: refPrice,
    };
  }

  // MARKET order simulation
  if (side === 'Buy') {
    const targetBudgetCents = quantity > 0 ? Math.round(quantity * 99 * 1.01) : Math.round(budgetKz * 100);
    let budgetLeft = Math.max(0, targetBudgetCents);
    let shares = 0;
    let notionalCents = 0;
    let worstPrice = refPrice;
    const maxWantedShares = quantity > 0 ? Math.floor(quantity) : Number.MAX_SAFE_INTEGER;

    for (const r of rows) {
      if (shares >= maxWantedShares || budgetLeft <= 0) break;
      // Each share at r.price_cents costs roughly r.price_cents * 1.01
      const perShareWithFee = Math.ceil(r.price_cents * 1.01);
      if (perShareWithFee <= 0) continue;
      const affordable = Math.floor(budgetLeft / perShareWithFee);
      if (affordable <= 0) break;
      const take = Math.min(r.remaining_quantity, affordable, maxWantedShares - shares);
      if (take <= 0) break;
      const levelNotional = take * r.price_cents;
      const levelFee = Math.round(levelNotional * 0.01);
      shares += take;
      notionalCents += levelNotional;
      budgetLeft -= levelNotional + levelFee;
      worstPrice = r.price_cents;
    }
    const fee = Math.round(notionalCents * 0.01);
    return {
      marketId,
      side,
      outcome,
      orderType: 'MARKET',
      executableShares: shares,
      avgPriceCents: shares > 0 ? Math.round(notionalCents / shares) : refPrice,
      worstFillPriceCents: shares > 0 ? worstPrice : refPrice,
      estimatedNotionalCents: notionalCents,
      estimatedFeeCents: fee,
      estimatedTotalCents: notionalCents + fee,
      hasLiquidity: shares > 0,
      referencePriceCents: refPrice,
    };
  } else {
    let remaining = Math.max(0, Math.floor(quantity));
    let shares = 0;
    let notionalCents = 0;
    let worstPrice = refPrice;
    for (const r of rows) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, r.remaining_quantity);
      shares += take;
      notionalCents += take * r.price_cents;
      worstPrice = r.price_cents;
      remaining -= take;
    }
    return {
      marketId,
      side: 'Sell',
      outcome,
      orderType: 'MARKET',
      executableShares: shares,
      avgPriceCents: shares > 0 ? Math.round(notionalCents / shares) : refPrice,
      worstFillPriceCents: shares > 0 ? worstPrice : refPrice,
      estimatedNotionalCents: notionalCents,
      estimatedFeeCents: 0,
      estimatedTotalCents: notionalCents,
      hasLiquidity: shares > 0,
      referencePriceCents: refPrice,
    };
  }
}

export function getMarketExecutions(db: AmmDatabase, marketId: string, limitCount: number = 50) {
  return db
    .prepare(
      `SELECT id, market_id, maker_order_id, taker_order_id, maker_user_id, taker_user_id,
              outcome, price_cents, quantity, notional_cents, fee_cents, created_at
       FROM clob_executions
       WHERE market_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(marketId, limitCount);
}

export function getMarketPositionsFromClob(db: AmmDatabase, marketId: string) {
  return db
    .prepare(
      `SELECT user_id, market_id, outcome, available_shares, reserved_shares,
              (available_shares + reserved_shares) AS total_shares, avg_price_cents, updated_at
       FROM user_clob_positions
       WHERE market_id = ? AND (available_shares > 0 OR reserved_shares > 0)
       ORDER BY total_shares DESC`
    )
    .all(marketId);
}

export function processFinanceOpInSqlite(
  db: AmmDatabase,
  params: {
    opId: string;
    userId: string;
    opType: 'deposit' | 'withdrawal' | 'admin_set';
    amountCents: number;
    currentFirestoreBalanceCents: number;
  }
): { beforeCents: number; afterCents: number; reservedCents: number; alreadyApplied: boolean } {
  return db.transaction(() => {
    const existing = db.prepare(`SELECT id FROM applied_finance_ops WHERE id = ?`).get(params.opId);
    if (existing) {
      const acc = db.prepare(`SELECT available_cents, reserved_cents FROM user_clob_accounts WHERE user_id = ?`).get(params.userId) as any;
      return {
        beforeCents: acc?.available_cents ?? 0,
        afterCents: acc?.available_cents ?? 0,
        reservedCents: acc?.reserved_cents ?? 0,
        alreadyApplied: true,
      };
    }

    const reconciled = reconcileUserClobBalance(db, params.userId, params.currentFirestoreBalanceCents);
    const beforeCents = reconciled.availableCents;
    let afterCents = beforeCents;

    if (params.opType === 'deposit') {
      if (params.amountCents <= 0) throw new Error('Montante de depósito inválido.');
      afterCents = beforeCents + params.amountCents;
    } else if (params.opType === 'withdrawal') {
      if (params.amountCents <= 0) throw new Error('Montante de levantamento inválido.');
      if (beforeCents < params.amountCents) {
        throw new Error(
          `Saldo livre insuficiente no motor CLOB. Disponível: ${(beforeCents / 100).toFixed(2)} Kz (Reservado em ordens abertas: ${(reconciled.reservedCents / 100).toFixed(2)} Kz).`
        );
      }
      afterCents = beforeCents - params.amountCents;
    } else {
      if (params.amountCents < 0) throw new Error('O novo saldo não pode ser negativo.');
      afterCents = params.amountCents;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE user_clob_accounts
      SET available_cents = ?, last_synced_firestore_balance_cents = ?, updated_at = ?
      WHERE user_id = ?
    `).run(afterCents, afterCents, now, params.userId);

    db.prepare(`
      INSERT INTO applied_finance_ops (id, user_id, op_type, amount_cents, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(params.opId, params.userId, params.opType, params.amountCents, now);

    return {
      beforeCents,
      afterCents,
      reservedCents: reconciled.reservedCents,
      alreadyApplied: false,
    };
  })();
}
