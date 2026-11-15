import { randomUUID } from 'crypto';
import { AmmDatabase } from './db';
import { AMM_COMPANY_USER_ID, getOrderBook, placeClobOrder } from './clobEngine';
import { ammCancelMarketQuotesInternal } from './clobHelpers';
import { checkAmmRiskAllowance, evaluateAndPersistMarketRisk } from './riskEngine';
import { recordPnlSnapshot } from './accounting';

export interface StrategyCycleResult {
  marketId: string;
  executedActions: string[];
  riskState: string;
  quotesPosted: number;
  skippedReason?: string;
}

function logAmmDecision(
  db: AmmDatabase,
  params: {
    marketId: string;
    decisionType: string;
    outcome: 'Yes' | 'No';
    priceCents: number;
    shares: number;
    capitalUsedCents: number;
    reason: string;
    riskState: string;
    riskValidationPassed: boolean;
    spreadBps: number;
    bookDepth: any;
    resultSummary: string;
  }
) {
  db.prepare(`
    INSERT INTO amm_decision_logs (
      id, market_id, decision_type, outcome, price_cents, shares,
      capital_used_cents, reason, risk_state, risk_validation_passed,
      spread_bps, book_depth_json, result_summary, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    params.marketId,
    params.decisionType,
    params.outcome,
    params.priceCents,
    params.shares,
    params.capitalUsedCents,
    params.reason,
    params.riskState,
    params.riskValidationPassed ? 1 : 0,
    params.spreadBps,
    JSON.stringify(params.bookDepth),
    params.resultSummary,
    new Date().toISOString()
  );
}

export function runAmmStrategyForMarket(db: AmmDatabase, marketId: string): StrategyCycleResult {
  const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
  const alloc = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;

  if (!alloc) {
    throw new Error(`Alocação não encontrada para mercado ${marketId}`);
  }

  const book = getOrderBook(db, marketId);
  const assessment = evaluateAndPersistMarketRisk(db, marketId);
  const now = new Date().toISOString();

  // Check global / market halt conditions
  if (settings.emergency_halted === 1 || settings.amm_enabled !== 1 || alloc.status !== 'APPROVED' || alloc.market_resolved === 1) {
    const reason =
      settings.emergency_halted === 1
        ? 'Paragem de emergência ativa.'
        : settings.amm_enabled !== 1
          ? 'AMM desativado no Sandbox.'
          : alloc.market_resolved === 1
            ? 'Mercado já resolvido.'
            : `Alocação no estado ${alloc.status}.`;

    ammCancelMarketQuotesInternal(db, marketId, 'STRATEGY_GUARD_HALT');
    logAmmDecision(db, {
      marketId,
      decisionType: 'RISK_SUSPEND',
      outcome: 'Yes',
      priceCents: alloc.yes_price_cents,
      shares: 0,
      capitalUsedCents: 0,
      reason,
      riskState: assessment.riskState,
      riskValidationPassed: false,
      spreadBps: 0,
      bookDepth: { yesBids: book.yes.bids.length, yesAsks: book.yes.asks.length },
      resultSummary: 'Operações suspensas pelo guardião de segurança.',
    });

    return { marketId, executedActions: [], riskState: assessment.riskState, quotesPosted: 0, skippedReason: reason };
  }

  if (assessment.riskState === 'HALTED') {
    ammCancelMarketQuotesInternal(db, marketId, 'RISK_HALTED_5PCT');
    logAmmDecision(db, {
      marketId,
      decisionType: 'RISK_SUSPEND',
      outcome: 'Yes',
      priceCents: alloc.yes_price_cents,
      shares: 0,
      capitalUsedCents: 0,
      reason: 'Perda >= 5%: Estado HALTED. Cotações suspensas aguardando investigação do Master Admin.',
      riskState: assessment.riskState,
      riskValidationPassed: false,
      spreadBps: 0,
      bookDepth: { yesBids: book.yes.bids.length, yesAsks: book.yes.asks.length },
      resultSummary: 'Cotações canceladas; obrigações existentes mantidas.',
    });
    return { marketId, executedActions: [], riskState: 'HALTED', quotesPosted: 0, skippedReason: 'RISCO_HALTED_5PCT' };
  }

  // Cancel old AMM quotes before computing fresh two-sided quotes & inventory skew
  ammCancelMarketQuotesInternal(db, marketId, 'QUOTE_CYCLE_REFRESH');

  const inv = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
  const sharesSim = inv?.shares_sim ?? 0;
  const sharesNo = inv?.shares_no ?? 0;
  const netSharesSkew = sharesSim - sharesNo; // >0 means long Yes; <0 means long No

  // Compute inventory skew adjustment in cents (-4 to +4 cents)
  const skewCents = Math.max(-4, Math.min(4, Math.round(netSharesSkew / 500)));

  // Spread calculation based on Risk State
  const baseHalfSpread = assessment.riskState === 'WARNING' ? 4 : 2; // 4c (800bps) in WARNING, 2c (400bps) in NORMAL
  const spreadBps = baseHalfSpread * 2 * 100;

  const fairYes = Math.max(5, Math.min(95, alloc.yes_price_cents - skewCents));
  const fairNo = 100 - fairYes;

  const yesBid = Math.max(2, fairYes - baseHalfSpread);
  const yesAsk = Math.min(98, fairYes + baseHalfSpread);
  const noBid = Math.max(2, fairNo - baseHalfSpread);
  const noAsk = Math.min(98, fairNo + baseHalfSpread);

  const executedActions: string[] = [];
  let quotesPosted = 0;

  // Determine available capital in this market's allocation
  const freshAlloc = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;
  const availableAllocCents = Math.max(
    0,
    freshAlloc.allocated_capital_cents - freshAlloc.used_capital_cents - freshAlloc.reserved_capital_cents
  );

  // Target order size bounded by aggressiveness & loss limit (worst-case protection)
  // Keep single unhedged quote size conservative so bilateral quoting remains within 5% worst-case budget
  const maxQuoteCapital = Math.min(
    Math.floor(availableAllocCents * 0.2),
    Math.floor(assessment.lossLimitCents * 0.45)
  );
  const quoteAggressiveness = assessment.riskState === 'WARNING' ? 0.5 : 1.0;

  // Step 1: Check for opportunistic / rebalancing trades against resting user orders
  const userBestYesAsk = book.yes.asks.find((a: any) => a.total_shares > a.amm_shares);
  const userBestYesBid = book.yes.bids.find((b: any) => b.total_shares > b.amm_shares);

  if (assessment.riskState === 'PROTECTION') {
    // Only risk-reducing orders allowed!
    if (sharesSim > sharesNo) {
      const reduceQty = Math.min(sharesSim - sharesNo, 500);
      if (reduceQty > 0) {
        const sellCheck = checkAmmRiskAllowance(db, marketId, 'Sell', 'Yes', yesAsk, reduceQty);
        if (sellCheck.allowed) {
          const res = placeClobOrder(db, {
            marketId,
            userId: AMM_COMPANY_USER_ID,
            isAmm: true,
            side: 'Sell',
            outcome: 'Yes',
            orderType: 'LIMIT',
            priceCents: yesAsk,
            quantity: reduceQty,
          });
          quotesPosted++;
          executedActions.push(`REBALANCE_SELL_YES:${reduceQty}@${yesAsk}c`);
          logAmmDecision(db, {
            marketId,
            decisionType: 'REBALANCE_REDUCE',
            outcome: 'Yes',
            priceCents: yesAsk,
            shares: reduceQty,
            capitalUsedCents: 0,
            reason: `Estado PROTECTION (4%): reduzindo excesso de ${reduceQty} quotas SIM.`,
            riskState: assessment.riskState,
            riskValidationPassed: true,
            spreadBps,
            bookDepth: { userBestYesBid, userBestYesAsk },
            resultSummary: `Ordem redutora ${res.orderId} (${res.status})`,
          });
        }
      }
    } else if (sharesNo > sharesSim) {
      const reduceQty = Math.min(sharesNo - sharesSim, 500);
      if (reduceQty > 0) {
        const sellCheck = checkAmmRiskAllowance(db, marketId, 'Sell', 'No', noAsk, reduceQty);
        if (sellCheck.allowed) {
          const res = placeClobOrder(db, {
            marketId,
            userId: AMM_COMPANY_USER_ID,
            isAmm: true,
            side: 'Sell',
            outcome: 'No',
            orderType: 'LIMIT',
            priceCents: noAsk,
            quantity: reduceQty,
          });
          quotesPosted++;
          executedActions.push(`REBALANCE_SELL_NO:${reduceQty}@${noAsk}c`);
          logAmmDecision(db, {
            marketId,
            decisionType: 'REBALANCE_REDUCE',
            outcome: 'No',
            priceCents: noAsk,
            shares: reduceQty,
            capitalUsedCents: 0,
            reason: `Estado PROTECTION (4%): reduzindo excesso de ${reduceQty} quotas NÃO.`,
            riskState: assessment.riskState,
            riskValidationPassed: true,
            spreadBps,
            bookDepth: { userBestYesBid, userBestYesAsk },
            resultSummary: `Ordem redutora ${res.orderId} (${res.status})`,
          });
        }
      }
    }
    recordPnlSnapshot(db, marketId);
    return { marketId, executedActions, riskState: assessment.riskState, quotesPosted };
  }

  // NORMAL or WARNING mode: post balanced two-sided quotes (Bid/Ask on Yes)
  if (maxQuoteCapital >= 100 && quoteAggressiveness > 0) {
    const bidQty = Math.max(10, Math.floor((maxQuoteCapital * quoteAggressiveness) / yesBid));
    const askQty = Math.max(10, Math.floor((maxQuoteCapital * quoteAggressiveness) / (100 - yesAsk)));

    // Check opportunistic buy if resting user ask is cheaper than fair value
    if (userBestYesAsk && userBestYesAsk.price_cents <= yesBid) {
      const oppQty = Math.min(bidQty, userBestYesAsk.total_shares - userBestYesAsk.amm_shares);
      if (oppQty > 0) {
        const chk = checkAmmRiskAllowance(db, marketId, 'Buy', 'Yes', userBestYesAsk.price_cents, oppQty);
        if (chk.allowed) {
          const res = placeClobOrder(db, {
            marketId,
            userId: AMM_COMPANY_USER_ID,
            isAmm: true,
            side: 'Buy',
            outcome: 'Yes',
            orderType: 'LIMIT',
            priceCents: userBestYesAsk.price_cents,
            quantity: oppQty,
          });
          executedActions.push(`OPPORTUNISTIC_BUY_YES:${res.filledQuantity}@${userBestYesAsk.price_cents}c`);
          logAmmDecision(db, {
            marketId,
            decisionType: 'OPPORTUNISTIC_BUY',
            outcome: 'Yes',
            priceCents: userBestYesAsk.price_cents,
            shares: oppQty,
            capitalUsedCents: oppQty * userBestYesAsk.price_cents,
            reason: `Oportunidade de compra detectada no livro CLOB abaixo do valor justo (${fairYes}c).`,
            riskState: assessment.riskState,
            riskValidationPassed: true,
            spreadBps,
            bookDepth: { bestAsk: userBestYesAsk.price_cents, fairYes },
            resultSummary: `Executado ${res.filledQuantity}/${oppQty} quotas`,
          });
        }
      }
    }

    let bidOrderId: string | null = null;
    let askOrderId: string | null = null;

    // Post resting Bid on Yes
    const bidAllow = checkAmmRiskAllowance(db, marketId, 'Buy', 'Yes', yesBid, bidQty);
    if (bidAllow.allowed) {
      const bidRes = placeClobOrder(db, {
        marketId,
        userId: AMM_COMPANY_USER_ID,
        isAmm: true,
        side: 'Buy',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: yesBid,
        quantity: bidQty,
      });
      bidOrderId = bidRes.orderId;
      quotesPosted++;
      executedActions.push(`QUOTE_BID_YES:${bidQty}@${yesBid}c`);
    }

    // Post resting Ask on Yes
    const askAllow = checkAmmRiskAllowance(db, marketId, 'Sell', 'Yes', yesAsk, askQty);
    if (askAllow.allowed) {
      const askRes = placeClobOrder(db, {
        marketId,
        userId: AMM_COMPANY_USER_ID,
        isAmm: true,
        side: 'Sell',
        outcome: 'Yes',
        orderType: 'LIMIT',
        priceCents: yesAsk,
        quantity: askQty,
      });
      askOrderId = askRes.orderId;
      quotesPosted++;
      executedActions.push(`QUOTE_ASK_YES:${askQty}@${yesAsk}c`);
    }

    if (bidOrderId || askOrderId) {
      db.prepare(`
        INSERT INTO amm_quotes (
          id, market_id, outcome, bid_price_cents, ask_price_cents, bid_shares, ask_shares,
          spread_bps, risk_state, bid_order_id, ask_order_id, status, created_at, updated_at
        ) VALUES (?, ?, 'Yes', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        randomUUID(),
        marketId,
        yesBid,
        yesAsk,
        bidOrderId ? bidQty : 0,
        askOrderId ? askQty : 0,
        spreadBps,
        assessment.riskState,
        bidOrderId,
        askOrderId,
        now,
        now
      );

      logAmmDecision(db, {
        marketId,
        decisionType: 'QUOTE_REFRESH',
        outcome: 'Yes',
        priceCents: fairYes,
        shares: (bidOrderId ? bidQty : 0) + (askOrderId ? askQty : 0),
        capitalUsedCents: (bidOrderId ? bidQty * yesBid : 0) + (askOrderId ? askQty * (100 - yesAsk) : 0),
        reason: `Cotações bilaterais ajustadas (skew=${skewCents}c, spread=${spreadBps}bps, estado=${assessment.riskState}).`,
        riskState: assessment.riskState,
        riskValidationPassed: true,
        spreadBps,
        bookDepth: { yesBid, yesAsk, noBid, noAsk, netSharesSkew },
        resultSummary: `Bid ${yesBid}c (${bidOrderId ? bidQty : 0}) / Ask ${yesAsk}c (${askOrderId ? askQty : 0})`,
      });
    }
  }

  recordPnlSnapshot(db, marketId);
  return { marketId, executedActions, riskState: assessment.riskState, quotesPosted };
}
