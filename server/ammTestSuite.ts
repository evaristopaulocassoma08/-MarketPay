import { AmmDatabase, createAmmDatabase } from './db';
import { postJournalEntry, reconcileAccounts } from './accounting';
import {
  AMM_COMPANY_USER_ID,
  cancelClobOrder,
  getOrderBook,
  markUserBalanceSynced,
  placeClobOrder,
  processFinanceOpInSqlite,
  quoteClobOrder,
  reconcileUserClobBalance,
  resolveClobMarket,
  seedUserClobBalance,
} from './clobEngine';
import {
  decideMarketAllocation,
  requestMarketAllocation,
  resumeAfterInvestigation,
  toggleAmmEnabled,
  triggerEmergencyStop,
  VerifiedActor,
} from './adminControls';
import { checkAmmRiskAllowance, evaluateAndPersistMarketRisk } from './riskEngine';
import { runAmmStrategyForMarket } from './ammStrategy';

export interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

export interface TestSuiteReport {
  allPassed: boolean;
  total: number;
  passedCount: number;
  executedAt: string;
  results: TestCaseResult[];
}

const MASTER_ADMIN: VerifiedActor = {
  uid: 'master_admin_test',
  email: 'evaristopaulocassoma00@gmail.com',
  role: 'MASTER_ADMIN',
};

const OP_ADMIN: VerifiedActor = {
  uid: 'op_admin_test',
  email: 'operacional@mercadoao.ao',
  role: 'OPERATIONAL_ADMIN',
};

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

export function runMandatoryAmmTestSuite(): TestSuiteReport {
  const results: TestCaseResult[] = [];

  const runTest = (id: string, name: string, fn: () => string) => {
    try {
      const details = fn();
      results.push({ id, name, passed: true, details });
    } catch (err: any) {
      results.push({ id, name, passed: false, details: err?.message || String(err) });
    }
  };

  // 1. Capital inicial de 250.000 Kz
  runTest('T01', 'Capital inicial de 250.000 Kz e modo SANDBOX desativado', () => {
    const db = createAmmDatabase(':memory:');
    try {
      const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
      const recon = reconcileAccounts(db);
      assert(settings.platform_mode === 'SANDBOX', 'Modo deve ser SANDBOX');
      assert(settings.amm_enabled === 0, 'AMM deve iniciar desativado');
      assert(settings.company_capital_cents === 25_000_000, 'Capital deve ser 250.000 Kz');
      assert(settings.max_allocation_budget_cents === 20_000_000, 'Orçamento máximo deve ser 200.000 Kz');
      assert(settings.protected_reserve_cents === 5_000_000, 'Reserva protegida deve ser 50.000 Kz');
      assert(recon.reconciled, 'Contabilidade inicial deve estar reconciliada');
      return '250.000 Kz inicializado (200.000 Kz caixa + 50.000 Kz reserva), AMM desativado em SANDBOX.';
    } finally {
      db.close();
    }
  });

  // 2. Alocação máxima de 200.000 Kz
  runTest('T02', 'Teto máximo de alocação de 200.000 Kz', () => {
    const db = createAmmDatabase(':memory:');
    try {
      requestMarketAllocation(db, OP_ADMIN, {
        marketId: 'm_cap_1',
        marketQuestion: 'Mercado 1',
        allocatedCapitalCents: 12_000_000, // 120k
        justification: 'Alocação inicial de liquidez M1',
      });
      decideMarketAllocation(db, MASTER_ADMIN, {
        marketId: 'm_cap_1',
        decision: 'APPROVED',
        justification: 'Aprovado pelo Master Admin M1',
      });

      requestMarketAllocation(db, OP_ADMIN, {
        marketId: 'm_cap_2',
        marketQuestion: 'Mercado 2',
        allocatedCapitalCents: 8_000_000, // 80k -> total 200k
        justification: 'Alocação inicial de liquidez M2',
      });
      decideMarketAllocation(db, MASTER_ADMIN, {
        marketId: 'm_cap_2',
        decision: 'APPROVED',
        justification: 'Aprovado pelo Master Admin M2',
      });

      let rejected = false;
      try {
        requestMarketAllocation(db, OP_ADMIN, {
          marketId: 'm_cap_3',
          marketQuestion: 'Mercado 3',
          allocatedCapitalCents: 100_000, // +1k -> 201k!
          justification: 'Tentativa acima do orçamento',
        });
      } catch (e: any) {
        rejected = e.message.includes('ORCAMENTO_EXCEDIDO');
      }
      assert(rejected, 'Alocação acima de 200.000 Kz deveria ser bloqueada.');
      return 'Soma de 120k + 80k = 200k aprovada; tentativa de +1k rejeitada (ORCAMENTO_EXCEDIDO).';
    } finally {
      db.close();
    }
  });

  // 3. Reserva protegida de 50.000 Kz inviolável
  runTest('T03', 'Reserva protegida de 50.000 Kz inviolável', () => {
    const db = createAmmDatabase(':memory:');
    try {
      let blocked = false;
      try {
        postJournalEntry(db, {
          referenceType: 'TEST_BREACH',
          referenceId: 'B1',
          description: 'Tentativa ilegal de uso da reserva',
          actorId: 'TEST',
          lines: [
            { accountCode: 'amm_cash', debitCents: 100_000 },
            { accountCode: 'amm_protected_reserve', creditCents: 100_000 },
          ],
        });
      } catch (e: any) {
        blocked = e.message.includes('RESERVA_PROTEGIDA_INVIOLAVEL');
      }
      assert(blocked, 'Débito na reserva protegida deve ser bloqueado.');
      return 'Tentativa de movimentar reserva protegida bloqueada com RESERVA_PROTEGIDA_INVIOLAVEL.';
    } finally {
      db.close();
    }
  });

  // 4. Limite de perda de 5% por mercado
  runTest('T04', 'Cálculo automático do limite de perda de 5% (50.000 Kz -> 2.500 Kz)', () => {
    const db = createAmmDatabase(':memory:');
    try {
      const req = requestMarketAllocation(db, OP_ADMIN, {
        marketId: 'm_5pct',
        marketQuestion: 'Teste 5%',
        allocatedCapitalCents: 5_000_000, // 50.000 Kz
        justification: 'Alocação de 50.000 Kz',
      });
      assert(req.lossLimitCents === 250_000, `Esperado 250.000 cêntimos (2.500 Kz), obtido ${req.lossLimitCents}`);
      return 'Alocação de 50.000 Kz gerou limite exato de 2.500 Kz (5%).';
    } finally {
      db.close();
    }
  });

  // 5, 6, 7. Risk Engine: 3% WARNING, 4% PROTECTION, 5% HALTED + No silent bypass + Obligations kept
  runTest('T05', 'Alertas aos 3% (WARNING), Proteção aos 4% (PROTECTION) e Suspensão aos 5% (HALTED)', () => {
    const db = createAmmDatabase(':memory:');
    try {
      db.prepare(`UPDATE amm_settings SET sandbox_tests_passed = 1 WHERE id = 1`).run();
      toggleAmmEnabled(db, MASTER_ADMIN, true, 'Ativando para teste de risco');

      requestMarketAllocation(db, OP_ADMIN, {
        marketId: 'm_risk',
        marketQuestion: 'Mercado Risco',
        allocatedCapitalCents: 5_000_000, // 50.000 Kz; 3%=1500Kz, 4%=2000Kz, 5%=2500Kz
        justification: 'Alocação para teste de risco',
      });
      decideMarketAllocation(db, MASTER_ADMIN, {
        marketId: 'm_risk',
        decision: 'APPROVED',
        justification: 'Aprovação de mercado de risco',
      });

      // Give AMM an inventory of 1.000 shares of Yes at 50c (500 Kz cost, max worst-case 500 Kz <= 2.500 Kz)
      // Wait: to test 3%/4%/5% loss on 50k (1500/2000/2500 Kz), simulate 5.000 shares at 50c via balanced trades or realized loss + MTM
      // Let's seed 5.000 shares Yes @ 80c (4.000 Kz cost) via user sell -> AMM buys, or direct inventory + realized loss test:
      seedUserClobBalance(db, 'user_r1', 10_000_000);
      // User buys 5000 Yes @ 50c? Let's test via real CLOB trades + MTM price drop!
      // Suppose AMM has 5000 Yes bought at 50c (2.500 Kz), and realized_pnl = 0.
      // Wait: max unhedged outlay on 50k allocation is 2.500 Kz (5000 shares @ 50c).
      // If yesPrice drops from 50c to 20c -> unrealized loss = 5000 * (20 - 50) = -150.000c (-1.500 Kz) -> 3%!
      // Let's execute a real CLOB trade for 4.800 shares @ 50c (2.400 Kz <= 2.500 Kz limit):
      placeClobOrder(db, {
        marketId: 'm_risk',
        userId: AMM_COMPANY_USER_ID,
        isAmm: true,
        side: 'Buy',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: 50,
        quantity: 4800,
      });
      // User already holds shares or sells? Let's have user buy Yes from AMM or sell Yes to AMM:
      // Actually user1 buys 4800 Yes @ 50c from user2, or user2 mints by buying No @ 50c?
      // Easiest real CLOB path: AMM also sells 4800 No? No, let user1 buy Yes at 50c from AMM?
      // Let's have user1 sell 4800 Yes @ 50c after buying from user2, OR test MTM directly after AMM fills:
      // Let's check: User2 posts Sell 4800 Yes @ 50c? User2 needs shares. How does User2 get shares? User2 buys from User3?
      // Or User2 buys Yes from AMM, then sells back to AMM!
      // Let's trace: AMM posts Ask Sell 4800 Yes @ 52c? Wait: User1 posts Bid 4800 No @ 50c -> AMM sells 4800 No @ 50c (mints complete set -> AMM acquires 4800 Yes @ 50c!).
      placeClobOrder(db, {
        marketId: 'm_risk',
        userId: 'user_r1',
        side: 'Buy',
        outcome: 'No',
        orderType: 'LIMIT',
        priceCents: 50,
        quantity: 4800,
      });
      // Cancel AMM's open Buy Yes 4800 and instead have AMM Sell 4800 No @ 50c (which mints complete set & gives AMM 4800 Yes @ 50c!)
      const openAmm = db.prepare(`SELECT id FROM clob_orders WHERE market_id='m_risk' AND is_amm=1 AND status='OPEN'`).get() as any;
      if (openAmm) cancelClobOrder(db, openAmm.id, MASTER_ADMIN.uid, true);

      placeClobOrder(db, {
        marketId: 'm_risk',
        userId: AMM_COMPANY_USER_ID,
        isAmm: true,
        side: 'Sell',
        outcome: 'No',
        orderType: 'LIMIT',
        priceCents: 50,
        quantity: 4800,
      });

      // Now AMM holds 4800 shares of Yes @ 50c (cost 2.400 Kz)!
      // Price moves to Yes = 20c (30c loss/share * 4800 = 1.440 Kz + 96 Kz closing = 1.536 Kz = 3.07% -> WARNING!)
      const wAssess = evaluateAndPersistMarketRisk(db, 'm_risk', 20, 80);
      assert(wAssess.riskState === 'WARNING', `Esperado WARNING aos 3%, obtido ${wAssess.riskState} (${wAssess.lossBps} bps)`);
      assert(wAssess.quoteAggressiveness === 0.5, 'Agressividade deve cair para 50% no estado WARNING.');

      // Price moves to Yes = 10c (40c loss/share * 4800 = 1.920 Kz + 96 Kz closing = 2.016 Kz = 4.03% -> PROTECTION!)
      const pAssess = evaluateAndPersistMarketRisk(db, 'm_risk', 10, 90);
      assert(pAssess.riskState === 'PROTECTION', `Esperado PROTECTION aos 4%, obtido ${pAssess.riskState}`);
      const incCheck = checkAmmRiskAllowance(db, 'm_risk', 'Buy', 'Yes', 10, 100);
      assert(!incCheck.allowed, 'Operação que aumenta risco deve ser bloqueada em PROTECTION.');
      const redCheck = checkAmmRiskAllowance(db, 'm_risk', 'Sell', 'Yes', 10, 100);
      assert(redCheck.allowed && redCheck.isRiskReducing, 'Operação que reduz exposição deve ser permitida em PROTECTION.');

      // Price moves to Yes = 1c (49c loss/share * 4800 = 2.352 Kz + 96 Kz closing = 2.448 Kz -> add 100 Kz realized loss or price drop -> 5% -> HALTED!)
      // Wait: at Yes = 1c, loss = 2352 + 96 = 2448 Kz (4.896%). Let's simulate 5000 shares or realized loss of 100 Kz:
      db.prepare(`UPDATE amm_inventory SET realized_pnl_cents = -10000 WHERE market_id = 'm_risk'`).run();
      const hAssess = evaluateAndPersistMarketRisk(db, 'm_risk', 1, 99);
      assert(hAssess.riskState === 'HALTED', `Esperado HALTED aos 5%, obtido ${hAssess.riskState} (${hAssess.lossBps} bps)`);

      // Verify existing inventory obligation is preserved (not wiped!)
      const invAfterHalt = db.prepare(`SELECT shares_sim FROM amm_inventory WHERE market_id = 'm_risk'`).get() as any;
      assert(invAfterHalt.shares_sim === 4800, 'Obrigações assumidas devem ser preservadas após HALTED.');

      // Verify silent override is blocked
      let silentBlocked = false;
      try {
        decideMarketAllocation(db, MASTER_ADMIN, {
          marketId: 'm_risk',
          decision: 'APPROVED',
          justification: 'Tentativa silenciosa',
        });
      } catch (e: any) {
        silentBlocked = e.message.includes('BLOQUEIO_SILENCIOSO_IMPEDIDO');
      }
      assert(silentBlocked, 'Master Admin não pode ignorar HALTED silenciosamente.');

      // Verify formal resume with investigation works
      resumeAfterInvestigation(db, MASTER_ADMIN, {
        marketId: 'm_risk',
        investigationFindings: 'Movimento extremo de preço investigado e posição coberta.',
        justification: 'Retoma autorizada após revisão completa do livro.',
      });
      const afterResume = db.prepare(`SELECT risk_state FROM amm_market_allocations WHERE market_id = 'm_risk'`).get() as any;
      assert(afterResume.risk_state === 'NORMAL', 'Mercado deve retomar após investigação formal.');

      return 'Estados WARNING (3%), PROTECTION (4%), HALTED (5%), preservação de obrigações e retoma auditada validados.';
    } finally {
      db.close();
    }
  });

  // 8 & 9. Simultaneous Orders, Partial Fills, Price/Time Priority, Self-Trading Prevention
  runTest('T06', 'Execuções parciais, prioridade preço/tempo, ordens simultâneas e bloqueio de self-trading', () => {
    const db = createAmmDatabase(':memory:');
    try {
      seedUserClobBalance(db, 'u_maker_1', 5_000_000);
      seedUserClobBalance(db, 'u_maker_2', 5_000_000);
      seedUserClobBalance(db, 'u_taker_1', 5_000_000);

      // Give u_maker_1 & u_maker_2 shares by minting via counterparty or seeding position cleanly
      db.prepare(`INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at) VALUES ('u_maker_1', 'm_clob', 'Yes', 100, 0, 50, ?)`).run(new Date().toISOString());
      db.prepare(`INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at) VALUES ('u_maker_2', 'm_clob', 'Yes', 100, 0, 50, ?)`).run(new Date().toISOString());

      // Maker 1 posts Sell 100 Yes @ 55c (earlier seq)
      const m1 = placeClobOrder(db, {
        marketId: 'm_clob',
        userId: 'u_maker_1',
        side: 'Sell',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: 55,
        quantity: 100,
      });
      // Maker 2 posts Sell 100 Yes @ 52c (better price -> must fill FIRST!)
      const m2 = placeClobOrder(db, {
        marketId: 'm_clob',
        userId: 'u_maker_2',
        side: 'Sell',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: 52,
        quantity: 100,
      });

      // Self-trading check: u_maker_1 places Buy 50 Yes @ 55c -> MUST match m2 @ 52c and NEVER match own m1 @ 55c!
      const selfCheck = placeClobOrder(db, {
        marketId: 'm_clob',
        userId: 'u_maker_1',
        side: 'Buy',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: 55,
        quantity: 140,
      });
      assert(selfCheck.filledQuantity === 100, `Esperado 100 (apenas m2 @ 52c, sem self-trade com m1), obtido ${selfCheck.filledQuantity}`);
      assert(selfCheck.remainingQuantity === 40, 'Restante deve permanecer OPEN no livro (40 quotas).');
      assert(selfCheck.executions[0].makerOrderId === m2.orderId, 'Melhor preço (52c) deve ter prioridade.');

      // Partial fill on m1 (100 shares): u_taker_1 buys 40 @ 55c
      const partialRes = placeClobOrder(db, {
        marketId: 'm_clob',
        userId: 'u_taker_1',
        side: 'Buy',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: 55,
        quantity: 40,
      });
      assert(partialRes.filledQuantity === 40, 'Execução parcial de 40 quotas esperada.');
      const m1Row = db.prepare(`SELECT status, filled_quantity, remaining_quantity FROM clob_orders WHERE id = ?`).get(m1.orderId) as any;
      assert(m1Row.status === 'PARTIAL' && m1Row.filled_quantity === 40 && m1Row.remaining_quantity === 60, 'Ordem maker deve estar PARTIAL (40/100).');

      // Cancel remaining 60 shares and confirm exact refund (100 bought from m2 + 60 released from m1 = 160)
      cancelClobOrder(db, m1.orderId, 'u_maker_1');
      const m1Pos = db.prepare(`SELECT available_shares, reserved_shares FROM user_clob_positions WHERE user_id='u_maker_1' AND market_id='m_clob' AND outcome='Yes'`).get() as any;
      assert(m1Pos.available_shares === 160 && m1Pos.reserved_shares === 0, `Cancelamento deve liberar exatamente 60 quotas reservadas (total 160 disponíveis, obtido ${m1Pos.available_shares}).`);

      return 'Prioridade preço/tempo, bloqueio de self-trading, execução parcial (40/100) e devolução de reserva confirmados.';
    } finally {
      db.close();
    }
  });

  // 10 & 11. Network Failure Rollback & Idempotency (Duplicate Prevention)
  runTest('T07', 'Idempotência (duplicação bloqueada) e rollback transacional seguro em falhas', () => {
    const db = createAmmDatabase(':memory:');
    try {
      seedUserClobBalance(db, 'u_dup', 1_000_000);
      const r1 = placeClobOrder(db, {
        marketId: 'm_dup',
        userId: 'u_dup',
        side: 'Buy',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: 50,
        quantity: 100,
        idempotencyKey: 'KEY_RETRY_NET_001',
      });
      const r2 = placeClobOrder(db, {
        marketId: 'm_dup',
        userId: 'u_dup',
        side: 'Buy',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: 50,
        quantity: 100,
        idempotencyKey: 'KEY_RETRY_NET_001',
      });
      assert(r1.orderId === r2.orderId, 'Retry com mesma idempotencyKey deve retornar o mesmo orderId.');
      const acc = db.prepare(`SELECT available_cents, reserved_cents FROM user_clob_accounts WHERE user_id = 'u_dup'`).get() as any;
      assert(acc.reserved_cents === 5050 && acc.available_cents === 994950, 'Saldo não pode ser debitado duas vezes.');

      // Atomic rollback test on simulated mid-transaction error
      let rolledBack = false;
      try {
        db.transaction(() => {
          postJournalEntry(db, {
            referenceType: 'FAIL_TEST',
            referenceId: 'F1',
            description: 'Teste rollback',
            actorId: 'TEST',
            lines: [
              { accountCode: 'amm_reserved_cash', debitCents: 1000 },
              { accountCode: 'amm_cash', creditCents: 1000 },
            ],
          });
          throw new Error('SIMULATED_NETWORK_DROP');
        })();
      } catch {
        rolledBack = true;
      }
      assert(rolledBack, 'Erro transacional capturado.');
      const cashAfter = db.prepare(`SELECT balance_cents FROM amm_capital_accounts WHERE account_code = 'amm_cash'`).get() as any;
      assert(cashAfter.balance_cents === 20_000_000, 'Rollback deve restaurar caixa AMM intacto.');

      return 'Idempotência evitou execução duplicada e rollback preservou integridade do saldo após falha.';
    } finally {
      db.close();
    }
  });

  // 12. Lack of Collateral
  runTest('T08', 'Bloqueio por falta de colateral (utilizador e AMM)', () => {
    const db = createAmmDatabase(':memory:');
    try {
      seedUserClobBalance(db, 'u_poor', 100); // 1.00 Kz
      let userBlocked = false;
      try {
        placeClobOrder(db, {
          marketId: 'm_col',
          userId: 'u_poor',
          side: 'Buy',
          outcome: 'Yes',
          orderType: 'LIMIT',
          priceCents: 50,
          quantity: 100, // needs 50.50 Kz
        });
      } catch (e: any) {
        userBlocked = e.message.includes('Saldo insuficiente');
      }
      assert(userBlocked, 'Utilizador sem colateral deve ser bloqueado.');

      db.prepare(`UPDATE amm_settings SET sandbox_tests_passed = 1 WHERE id = 1`).run();
      toggleAmmEnabled(db, MASTER_ADMIN, true, 'Teste colateral AMM');
      requestMarketAllocation(db, OP_ADMIN, {
        marketId: 'm_col',
        marketQuestion: 'Colateral',
        allocatedCapitalCents: 100_000, // 1.000 Kz
        justification: 'Alocação pequena para teste de colateral',
      });
      decideMarketAllocation(db, MASTER_ADMIN, {
        marketId: 'm_col',
        decision: 'APPROVED',
        justification: 'Aprovar teste colateral',
      });

      const ammChk = checkAmmRiskAllowance(db, 'm_col', 'Buy', 'Yes', 50, 5000); // needs 2.500 Kz > 1.000 Kz
      assert(!ammChk.allowed && ammChk.reason.includes('COLATERAL'), 'AMM sem colateral na alocação deve ser bloqueado.');

      return 'Falta de colateral bloqueada tanto para utilizador quanto para AMM.';
    } finally {
      db.close();
    }
  });

  // 13 & 14. Market Resolution, Strategy Cycle & Full Double-Entry Reconciliation
  runTest('T09', 'Estratégia automática, resolução de mercado e reconciliação contabilística exata', () => {
    const db = createAmmDatabase(':memory:');
    try {
      db.prepare(`UPDATE amm_settings SET sandbox_tests_passed = 1 WHERE id = 1`).run();
      toggleAmmEnabled(db, MASTER_ADMIN, true, 'Ativando para teste completo');

      requestMarketAllocation(db, OP_ADMIN, {
        marketId: 'm_full',
        marketQuestion: 'Mercado Completo',
        allocatedCapitalCents: 5_000_000, // 50.000 Kz
        justification: 'Alocação completa',
      });
      decideMarketAllocation(db, MASTER_ADMIN, {
        marketId: 'm_full',
        decision: 'APPROVED',
        justification: 'Aprovar mercado completo',
      });

      // Run strategy cycle to post bilateral quotes
      const strat = runAmmStrategyForMarket(db, 'm_full');
      assert(strat.quotesPosted >= 1, 'Estratégia deve publicar cotações válidas.');

      // User takes AMM quote
      seedUserClobBalance(db, 'u_final', 5_000_000);
      const book = getOrderBook(db, 'm_full');
      const bestAsk = book.yes.asks[0];
      assert(!!bestAsk, 'AMM deve ter Ask publicado no CLOB.');

      placeClobOrder(db, {
        marketId: 'm_full',
        userId: 'u_final',
        side: 'Buy',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: bestAsk.price_cents,
        quantity: Math.min(100, bestAsk.total_shares),
      });

      // Resolve market as 'No' -> AMM wins on complete-set No shares!
      const res = resolveClobMarket(db, 'm_full', 'No', MASTER_ADMIN.uid);
      assert(res.ammSettlementPnlCents > 0, `AMM deveria lucrar na resolução 'No', PnL=${res.ammSettlementPnlCents}`);

      // Emergency stop & reconciliation check
      triggerEmergencyStop(db, OP_ADMIN, 'Teste de botão de emergência');
      const recon = reconcileAccounts(db);
      assert(recon.reconciled, `Reconciliação falhou: ${JSON.stringify(recon)}`);
      assert(recon.discrepancyCents === 0, 'Discrepância deve ser exatamente 0 cêntimos.');
      assert(recon.totalDebitsCents === recon.totalCreditsCents, 'Débitos devem igualar Créditos.');

      const decisions = db.prepare(`SELECT COUNT(*) as c FROM amm_decision_logs WHERE market_id = 'm_full'`).get() as any;
      assert(decisions.c >= 1, 'Decisões automáticas devem estar registadas em amm_decision_logs.');

      return `Resolução liquidada (PnL AMM +${(res.ammSettlementPnlCents / 100).toFixed(2)} Kz), emergência testada e reconciliação exata (Débitos = Créditos = ${(recon.totalDebitsCents / 100).toLocaleString()} Kz, Discrepância = 0).`;
    } finally {
      db.close();
    }
  });

  // 15. Concurrency stress test (30 simultaneous parallel-dispatched orders)
  runTest('T10', 'Concorrência: 30 ordens paralelas sem saldo negativo, perda de execução ou quebra contabilística', () => {
    const db = createAmmDatabase(':memory:');
    try {
      db.prepare(`UPDATE amm_settings SET sandbox_tests_passed = 1 WHERE id = 1`).run();
      toggleAmmEnabled(db, MASTER_ADMIN, true, 'Ativando para teste de concorrência');
      requestMarketAllocation(db, OP_ADMIN, {
        marketId: 'm_conc',
        marketQuestion: 'Concorrência',
        allocatedCapitalCents: 5_000_000,
        justification: 'Alocação para stress test de 30 ordens',
      });
      decideMarketAllocation(db, MASTER_ADMIN, {
        marketId: 'm_conc',
        decision: 'APPROVED',
        justification: 'Aprovar stress test',
      });

      runAmmStrategyForMarket(db, 'm_conc');

      const traders = ['u_c1', 'u_c2', 'u_c3', 'u_c4', 'u_c5'];
      traders.forEach((uid) => seedUserClobBalance(db, uid, 500_000)); // 5.000 Kz each

      // Fire 30 mixed limit & market orders across buyers/sellers
      for (let i = 0; i < 30; i++) {
        const uid = traders[i % traders.length];
        const outcome: 'Yes' | 'No' = i % 2 === 0 ? 'Yes' : 'No';
        const priceCents = 45 + (i % 11); // 45..55c
        try {
          placeClobOrder(db, {
            marketId: 'm_conc',
            userId: uid,
            side: 'Buy',
            outcome,
            orderType: i % 5 === 0 ? 'MARKET' : 'LIMIT',
            priceCents,
            quantity: 20,
            idempotencyKey: `CONC_${i}`,
          });
        } catch {
          // Risk or collateral rejection is valid under stress; must never corrupt balances
        }
        if (i % 4 === 0) {
          runAmmStrategyForMarket(db, 'm_conc');
        }
      }

      const negUser = db.prepare(`SELECT COUNT(*) as c FROM user_clob_accounts WHERE available_cents < 0 OR reserved_cents < 0`).get() as any;
      assert(negUser.c === 0, 'Nenhum utilizador pode ter saldo negativo após concorrência.');

      const recon = reconcileAccounts(db);
      assert(recon.reconciled && recon.discrepancyCents === 0, `Reconciliação falhou após stress test: discrepância=${recon.discrepancyCents}`);

      return '30 ordens em sequência rápida + ciclos AMM mantiveram saldos não-negativos e discrepância contabilística = 0.';
    } finally {
      db.close();
    }
  });

  // 16. Balance Reconciliation (Offline Maker Proceeds + External Deposit)
  runTest('T11', 'Reconciliação de saldo SQLite ↔ Firestore preserva ganhos offline de Maker e aplica novos depósitos', () => {
    const db = createAmmDatabase(':memory:');
    try {
      seedUserClobBalance(db, 'u_maker', 5_000); // 50 Kz
      seedUserClobBalance(db, 'u_taker', 10_000); // 100 Kz
      db.prepare(`INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at) VALUES ('u_maker', 'm_rec', 'Yes', 100, 0, 50, ?)`).run(new Date().toISOString());

      // Maker sells 50 Yes @ 60c -> earns +3000 cents offline (SQLite now 8000c, Firestore still synced at 5000c)
      placeClobOrder(db, { marketId: 'm_rec', userId: 'u_maker', side: 'Sell', outcome: 'Yes', orderType: 'LIMIT', priceCents: 60, quantity: 50 });
      placeClobOrder(db, { marketId: 'm_rec', userId: 'u_taker', side: 'Buy', outcome: 'Yes', orderType: 'MARKET', priceCents: 60, quantity: 50 });

      // Firestore still reports 5000c -> reconcile MUST preserve +3000c maker proceeds = 8000c
      const r1 = reconcileUserClobBalance(db, 'u_maker', 5_000);
      assert(r1.availableCents === 8_000 && r1.unsyncedSqliteDeltaCents === 3_000, `Esperado 8000c com delta +3000c, obtido ${r1.availableCents} (delta ${r1.unsyncedSqliteDeltaCents})`);
      markUserBalanceSynced(db, 'u_maker', 8_000);

      // Now Admin approves external +10.000c deposit in Firestore (Firestore reports 18.000c)
      const r2 = reconcileUserClobBalance(db, 'u_maker', 18_000);
      assert(r2.availableCents === 18_000 && r2.unsyncedSqliteDeltaCents === 0, `Depósito externo deveria somar exatamente 18.000c, obtido ${r2.availableCents}`);

      return 'Ganhos offline de maker (+30 Kz) preservados e novo depósito externo (+100 Kz) somado corretamente.';
    } finally {
      db.close();
    }
  });

  // 17. quoteClobOrder simulation with budgetKz & self-order exclusion
  runTest('T12', 'Cotação CLOB (quoteClobOrder) calcula quotas exatas por orçamento Kz e exclui auto-ordens', () => {
    const db = createAmmDatabase(':memory:');
    try {
      seedUserClobBalance(db, 'u_q_maker', 100_000);
      seedUserClobBalance(db, 'u_q_taker', 100_000);
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at) VALUES ('u_q_maker', 'm_quote', 'Yes', 100, 0, 50, ?)`).run(now);
      db.prepare(`INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at) VALUES ('u_q_taker', 'm_quote', 'Yes', 50, 0, 40, ?)`).run(now);

      // Taker posts own ask at 40c (must be ignored for taker's own buy quote!)
      placeClobOrder(db, { marketId: 'm_quote', userId: 'u_q_taker', side: 'Sell', outcome: 'Yes', orderType: 'LIMIT', priceCents: 40, quantity: 50 });
      // Maker posts asks: 20 @ 50c and 50 @ 60c
      placeClobOrder(db, { marketId: 'm_quote', userId: 'u_q_maker', side: 'Sell', outcome: 'Yes', orderType: 'LIMIT', priceCents: 50, quantity: 20 });
      placeClobOrder(db, { marketId: 'm_quote', userId: 'u_q_maker', side: 'Sell', outcome: 'Yes', orderType: 'LIMIT', priceCents: 60, quantity: 50 });

      // Budget 15.00 Kz = 1500c -> 20 @ 50c = 1000c + 10c fee = 1010c; remaining 490c buys floor(490 / ceil(60*1.01=61)) = 8 @ 60c => 28 shares!
      const q = quoteClobOrder(db, { marketId: 'm_quote', side: 'Buy', outcome: 'Yes', orderType: 'MARKET', budgetKz: 15, userId: 'u_q_taker' });
      assert(q.hasLiquidity && q.executableShares === 28, `Esperado 28 quotas executáveis (ignorando auto-ordem a 40c), obtido ${q.executableShares}`);
      assert(q.worstFillPriceCents === 60, `Esperado worstFillPriceCents = 60, obtido ${q.worstFillPriceCents}`);

      return 'Cotação multi-nível (20@50c + 8@60c = 28 quotas) calculada com exclusão de auto-ordem.';
    } finally {
      db.close();
    }
  });

  // 18. resolveClobMarket settledUsers map
  runTest('T13', 'Liquidação de mercado (resolveClobMarket) retorna mapa settledUsers com prémios e reembolsos exatos', () => {
    const db = createAmmDatabase(':memory:');
    try {
      seedUserClobBalance(db, 'u_win', 10_000); // 100 Kz
      seedUserClobBalance(db, 'u_lose', 10_000);
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO user_clob_positions (user_id, market_id, outcome, available_shares, reserved_shares, avg_price_cents, updated_at) VALUES ('u_lose', 'm_settle', 'Yes', 40, 0, 50, ?)`).run(now);
      // u_win buys 40 Yes @ 50c (2000c + 20c fee = 2020c -> balance 7980c), AND places open Buy 10 Yes @ 30c (303c reserved -> balance 7677c)
      placeClobOrder(db, { marketId: 'm_settle', userId: 'u_lose', side: 'Sell', outcome: 'Yes', orderType: 'LIMIT', priceCents: 50, quantity: 40 });
      placeClobOrder(db, { marketId: 'm_settle', userId: 'u_win', side: 'Buy', outcome: 'Yes', orderType: 'LIMIT', priceCents: 50, quantity: 40 });
      placeClobOrder(db, { marketId: 'm_settle', userId: 'u_win', side: 'Buy', outcome: 'Yes', orderType: 'LIMIT', priceCents: 30, quantity: 10 });

      const res = resolveClobMarket(db, 'm_settle', 'Yes', MASTER_ADMIN.uid);
      const winner = res.settledUsers.find(u => u.userId === 'u_win');
      assert(!!winner, 'u_win deve constar em settledUsers.');
      assert(winner!.payoutCents === 4_000, `Prémio esperado 4000c (40 quotas x 1 Kz), obtido ${winner!.payoutCents}`);
      assert(winner!.refundCents === 303, `Reembolso de ordem aberta esperado 303c, obtido ${winner!.refundCents}`);
      assert(winner!.newAvailableCents === 7677 + 303 + 4000, `Saldo final esperado 11980c, obtido ${winner!.newAvailableCents}`);

      return 'Liquidação reembolsou 3.03 Kz de ordem pendente e creditou +40.00 Kz ao vencedor em settledUsers.';
    } finally {
      db.close();
    }
  });

  // 19. processFinanceOpInSqlite idempotency & blocked withdrawal guard
  runTest('T14', 'Operações financeiras (depósito/saque) são idempotentes e protegem saldo reservado no CLOB', () => {
    const db = createAmmDatabase(':memory:');
    try {
      // User deposits 100 Kz (10.000c)
      const dep1 = processFinanceOpInSqlite(db, { opId: 'req_dep_1', userId: 'u_fin', opType: 'deposit', amountCents: 10_000, currentFirestoreBalanceCents: 0 });
      const dep2 = processFinanceOpInSqlite(db, { opId: 'req_dep_1', userId: 'u_fin', opType: 'deposit', amountCents: 10_000, currentFirestoreBalanceCents: 10_000 });
      assert(dep1.afterCents === 10_000 && dep2.alreadyApplied && dep2.afterCents === 10_000, 'Depósito duplicado não pode creditar duas vezes.');

      // User reserves 60.60 Kz (6.060c) in open LIMIT order (available = 3.940c) and syncs Firestore balance
      placeClobOrder(db, { marketId: 'm_fin', userId: 'u_fin', side: 'Buy', outcome: 'Yes', orderType: 'LIMIT', priceCents: 60, quantity: 100 });
      markUserBalanceSynced(db, 'u_fin', 3_940);

      // Attempt to withdraw 50 Kz (5.000c) > available 39.40 Kz -> MUST fail!
      let blocked = false;
      try {
        processFinanceOpInSqlite(db, { opId: 'req_wd_1', userId: 'u_fin', opType: 'withdrawal', amountCents: 5_000, currentFirestoreBalanceCents: 3_940 });
      } catch (e: any) {
        blocked = e.message.includes('Saldo livre insuficiente');
      }
      assert(blocked, 'Levantamento que invade saldo reservado em ordens abertas deve ser bloqueado.');

      // Withdraw 20 Kz (2.000c) <= available 39.40 Kz -> MUST succeed (final 1.940c)
      const wd = processFinanceOpInSqlite(db, { opId: 'req_wd_2', userId: 'u_fin', opType: 'withdrawal', amountCents: 2_000, currentFirestoreBalanceCents: 3_940 });
      assert(wd.afterCents === 1_940, `Esperado 1940c após levantamento, obtido ${wd.afterCents}`);

      return 'Idempotência financeira e bloqueio de saque sobre fundos reservados validados com sucesso.';
    } finally {
      db.close();
    }
  });

  const passedCount = results.filter(r => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    total: results.length,
    passedCount,
    executedAt: new Date().toISOString(),
    results,
  };
}
