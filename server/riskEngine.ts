import { randomUUID } from 'crypto';
import { AmmDatabase } from './db';
import { ammCancelMarketQuotesInternal } from './clobHelpers';

export type RiskState = 'NORMAL' | 'WARNING' | 'PROTECTION' | 'HALTED';

export interface MarketRiskAssessment {
  marketId: string;
  allocatedCapitalCents: number;
  lossLimitCents: number;
  realizedPnlCents: number;
  unrealizedPnlCents: number;
  closingCostCents: number;
  pendingExposureCents: number;
  worstCaseResolutionPnlCents: number;
  worstCaseLossCents: number;
  currentLossCents: number;
  lossBps: number;
  previousState: RiskState;
  riskState: RiskState;
  stateChanged: boolean;
  quoteAggressiveness: number; // 1.0 in NORMAL, 0.5 in WARNING, 0 in PROTECTION/HALTED for risk-increasing
}

export function computeMarketRiskMetrics(
  db: AmmDatabase,
  marketId: string,
  overrideYesPriceCents?: number,
  overrideNoPriceCents?: number
): MarketRiskAssessment {
  const alloc = db
    .prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`)
    .get(marketId) as any;

  if (!alloc) {
    throw new Error(`Alocação de mercado não encontrada para ${marketId}.`);
  }

  const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
  const globalLimits = db
    .prepare(`SELECT * FROM amm_risk_limits WHERE id = 'GLOBAL_DEFAULT'`)
    .get() as any;
  const marketLimits = db
    .prepare(`SELECT * FROM amm_risk_limits WHERE scope = 'MARKET' AND market_id = ?`)
    .get(marketId) as any;

  const warningBps = marketLimits?.warning_loss_bps ?? settings.warning_loss_bps ?? 300;
  const protectionBps = marketLimits?.protection_loss_bps ?? settings.protection_loss_bps ?? 400;
  const haltBps = marketLimits?.halt_loss_bps ?? settings.halt_loss_bps ?? 500;

  const yesPrice = overrideYesPriceCents ?? alloc.yes_price_cents ?? 50;
  const noPrice = overrideNoPriceCents ?? alloc.no_price_cents ?? (100 - yesPrice);

  const inv = db
    .prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`)
    .get(marketId) as any;

  const sharesSim = inv?.shares_sim ?? 0;
  const sharesNo = inv?.shares_no ?? 0;
  const costSim = inv?.cost_basis_sim_cents ?? 0;
  const costNo = inv?.cost_basis_no_cents ?? 0;
  const realizedPnlCents = inv?.realized_pnl_cents ?? 0;

  // Mark-to-market value of open inventory
  const mtmValueCents = sharesSim * yesPrice + sharesNo * noPrice;
  const totalCostBasisCents = costSim + costNo;
  const unrealizedPnlCents = mtmValueCents - totalCostBasisCents;

  // Closing cost estimate (spread + exit fee of 1% + 1 cent/share slippage on net directional imbalance)
  const netImbalanceShares = Math.abs(sharesSim - sharesNo);
  const closingCostCents = netImbalanceShares > 0 ? Math.max(1, Math.round(netImbalanceShares * 2)) : 0;

  // Pending AMM orders exposure
  const pendingOrders = db
    .prepare(`
      SELECT COALESCE(SUM(reserved_cents), 0) AS reserved_sum,
             COALESCE(SUM(CASE WHEN side = 'Buy' THEN remaining_quantity * price_cents ELSE 0 END), 0) AS buy_notional
      FROM clob_orders
      WHERE market_id = ? AND is_amm = 1 AND status IN ('OPEN', 'PARTIAL')
    `)
    .get(marketId) as { reserved_sum: number; buy_notional: number };

  // Worst-case resolution scenario
  const scenarioSimWins = sharesSim * 100 - totalCostBasisCents + realizedPnlCents;
  const scenarioNoWins = sharesNo * 100 - totalCostBasisCents + realizedPnlCents;
  const worstCaseResolutionPnlCents = Math.min(scenarioSimWins, scenarioNoWins) - closingCostCents;
  const worstCaseLossCents = worstCaseResolutionPnlCents < 0 ? Math.abs(worstCaseResolutionPnlCents) : 0;

  // Current effective loss (realized + unrealized - closing cost)
  const netMtmPnlCents = realizedPnlCents + unrealizedPnlCents - closingCostCents;
  const currentLossCents = netMtmPnlCents < 0 ? Math.abs(netMtmPnlCents) : 0;

  const allocatedCapitalCents = alloc.allocated_capital_cents || 0;
  const lossLimitCents = alloc.loss_limit_cents || Math.floor((allocatedCapitalCents * haltBps) / 10000);

  const lossBps =
    allocatedCapitalCents > 0
      ? Math.round((currentLossCents / allocatedCapitalCents) * 10000)
      : currentLossCents > 0
        ? haltBps
        : 0;

  const previousState = (alloc.risk_state || 'NORMAL') as RiskState;
  let riskState: RiskState = 'NORMAL';

  // HALTED is sticky until Master Admin investigates & resumes with justification
  if (previousState === 'HALTED' || settings.emergency_halted === 1) {
    riskState = 'HALTED';
  } else if (lossBps >= haltBps || (lossLimitCents > 0 && currentLossCents >= lossLimitCents)) {
    riskState = 'HALTED';
  } else if (lossBps >= protectionBps) {
    riskState = 'PROTECTION';
  } else if (lossBps >= warningBps) {
    riskState = 'WARNING';
  } else {
    riskState = 'NORMAL';
  }

  const quoteAggressiveness =
    riskState === 'NORMAL' ? 1.0 : riskState === 'WARNING' ? 0.5 : 0.0;

  return {
    marketId,
    allocatedCapitalCents,
    lossLimitCents,
    realizedPnlCents,
    unrealizedPnlCents,
    closingCostCents,
    pendingExposureCents: pendingOrders.reserved_sum || 0,
    worstCaseResolutionPnlCents,
    worstCaseLossCents,
    currentLossCents,
    lossBps,
    previousState,
    riskState,
    stateChanged: riskState !== previousState,
    quoteAggressiveness,
  };
}

export function evaluateAndPersistMarketRisk(
  db: AmmDatabase,
  marketId: string,
  overrideYesPriceCents?: number,
  overrideNoPriceCents?: number
): MarketRiskAssessment {
  const assessment = computeMarketRiskMetrics(
    db,
    marketId,
    overrideYesPriceCents,
    overrideNoPriceCents
  );
  const now = new Date().toISOString();

  // Update inventory MTM & worst-case liability
  db.prepare(`
    UPDATE amm_inventory
    SET unrealized_pnl_cents = ?,
        worst_case_liability_cents = ?,
        net_exposure_cents = ?,
        updated_at = ?
    WHERE market_id = ?
  `).run(
    assessment.unrealizedPnlCents,
    assessment.worstCaseLossCents,
    (assessment.unrealizedPnlCents < 0 ? -assessment.currentLossCents : assessment.worstCaseLossCents),
    now,
    marketId
  );

  // Sync amm_positions mark prices and allocation reference prices
  if (overrideYesPriceCents !== undefined || overrideNoPriceCents !== undefined) {
    const nextYes = overrideYesPriceCents ?? (100 - (overrideNoPriceCents ?? 50));
    const nextNo = overrideNoPriceCents ?? (100 - nextYes);
    db.prepare(`UPDATE amm_market_allocations SET yes_price_cents = ?, no_price_cents = ?, updated_at = ? WHERE market_id = ?`)
      .run(nextYes, nextNo, now, marketId);
    db.prepare(`UPDATE amm_positions SET mark_price_cents = ?, updated_at = ? WHERE market_id = ? AND outcome = 'Yes'`)
      .run(nextYes, now, marketId);
    db.prepare(`UPDATE amm_positions SET mark_price_cents = ?, updated_at = ? WHERE market_id = ? AND outcome = 'No'`)
      .run(nextNo, now, marketId);
  }

  // Persist risk state change
  if (assessment.stateChanged) {
    const newStatus = assessment.riskState === 'HALTED' ? 'SUSPENDED' : undefined;
    if (newStatus) {
      db.prepare(`UPDATE amm_market_allocations SET risk_state = ?, status = ?, updated_at = ? WHERE market_id = ?`)
        .run(assessment.riskState, newStatus, now, marketId);
    } else {
      db.prepare(`UPDATE amm_market_allocations SET risk_state = ?, updated_at = ? WHERE market_id = ?`)
        .run(assessment.riskState, now, marketId);
    }

    const triggerReason =
      assessment.riskState === 'HALTED'
        ? `Perda de ${(assessment.lossBps / 100).toFixed(2)}% (${(assessment.currentLossCents / 100).toFixed(2)} Kz) atingiu ou excedeu o limite máximo de 5% (${(assessment.lossLimitCents / 100).toFixed(2)} Kz). Novas posições de risco suspensas; obrigações assumidas preservadas.`
        : assessment.riskState === 'PROTECTION'
          ? `Perda de ${(assessment.lossBps / 100).toFixed(2)}% atingiu nível de PROTEÇÃO (4%). Bloqueadas operações que aumentem risco; priorizando redução de exposição.`
          : assessment.riskState === 'WARNING'
            ? `Perda de ${(assessment.lossBps / 100).toFixed(2)}% atingiu nível de ALERTA (3%). Master Admin notificado; agressividade das cotações reduzida em 50%.`
            : `Perda voltou para ${(assessment.lossBps / 100).toFixed(2)}%. Estado normalizado.`;

    db.prepare(`
      INSERT INTO amm_risk_events (
        id, market_id, previous_state, new_state, loss_cents, loss_bps,
        worst_case_loss_cents, trigger_reason, notified_master_admin, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      marketId,
      assessment.previousState,
      assessment.riskState,
      assessment.currentLossCents,
      assessment.lossBps,
      assessment.worstCaseLossCents,
      triggerReason,
      assessment.riskState === 'NORMAL' ? 0 : 1,
      now
    );

    // If HALTED or PROTECTION, cancel active risk-increasing AMM quotes immediately
    if (assessment.riskState === 'HALTED') {
      ammCancelMarketQuotesInternal(db, marketId, 'RISK_HALTED_5PCT');
    } else if (assessment.riskState === 'PROTECTION') {
      ammCancelMarketQuotesInternal(db, marketId, 'RISK_PROTECTION_4PCT', true);
    }
  }

  return assessment;
}

export function checkAmmRiskAllowance(
  db: AmmDatabase,
  marketId: string,
  side: 'Buy' | 'Sell',
  outcome: 'Yes' | 'No',
  priceCents: number,
  quantity: number
): { allowed: boolean; reason: string; isRiskReducing: boolean; assessment: MarketRiskAssessment } {
  const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
  const alloc = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(marketId) as any;

  if (!alloc) {
    throw new Error(`Mercado ${marketId} não possui alocação de capital configurada.`);
  }

  const assessment = computeMarketRiskMetrics(db, marketId);

  if (settings.emergency_halted === 1) {
    return {
      allowed: false,
      reason: 'PARAGEM_EMERGENCIA_ATIVA: Botão de emergência acionado. Novas cotações e operações bloqueadas.',
      isRiskReducing: false,
      assessment,
    };
  }

  if (settings.amm_enabled !== 1) {
    return {
      allowed: false,
      reason: 'AMM_DESATIVADO: Fornecedor automático desativado no Sandbox.',
      isRiskReducing: false,
      assessment,
    };
  }

  if (alloc.status !== 'APPROVED') {
    return {
      allowed: false,
      reason: `ALOCACAO_NAO_APROVADA: Estado atual da alocação é ${alloc.status}.`,
      isRiskReducing: false,
      assessment,
    };
  }

  if (alloc.market_resolved === 1) {
    return {
      allowed: false,
      reason: 'MERCADO_RESOLVIDO: Mercado já encerrado.',
      isRiskReducing: false,
      assessment,
    };
  }

  const inv = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
  const sharesSim = inv?.shares_sim ?? 0;
  const sharesNo = inv?.shares_no ?? 0;

  // Determine if operation reduces net directional exposure or sells existing inventory
  let isRiskReducing = false;
  if (side === 'Sell') {
    const held = outcome === 'Yes' ? sharesSim : sharesNo;
    if (held >= quantity) {
      isRiskReducing = true;
    }
  } else if (side === 'Buy') {
    // Buying the opposite outcome balances existing unhedged inventory!
    if (outcome === 'Yes' && sharesNo > sharesSim) {
      isRiskReducing = true;
    } else if (outcome === 'No' && sharesSim > sharesNo) {
      isRiskReducing = true;
    }
  }

  if (assessment.riskState === 'HALTED') {
    return {
      allowed: false,
      reason: 'RISCO_HALTED_5PCT: Perda >= 5%. Novas cotações e posições de risco suspensas até investigação e autorização do Master Admin.',
      isRiskReducing,
      assessment,
    };
  }

  if (assessment.riskState === 'PROTECTION' && !isRiskReducing) {
    return {
      allowed: false,
      reason: 'RISCO_PROTECTION_4PCT: Perda >= 4%. Apenas operações redutoras de exposição são permitidas.',
      isRiskReducing,
      assessment,
    };
  }

  // Capital / Collateral check (NEVER touch protected reserve!)
  if (side === 'Buy') {
    const requiredCents = priceCents * quantity;
    const availableInAlloc = alloc.allocated_capital_cents - alloc.used_capital_cents - alloc.reserved_capital_cents;
    if (requiredCents > availableInAlloc) {
      return {
        allowed: false,
        reason: `COLATERAL_ALOCACAO_INSUFICIENTE: Necessário ${(requiredCents / 100).toFixed(2)} Kz, disponível na alocação do mercado ${(availableInAlloc / 100).toFixed(2)} Kz.`,
        isRiskReducing,
        assessment,
      };
    }

    const cashRow = db.prepare(`SELECT balance_cents FROM amm_capital_accounts WHERE account_code = 'amm_cash'`).get() as { balance_cents: number };
    if (requiredCents > cashRow.balance_cents) {
      return {
        allowed: false,
        reason: `CAIXA_OPERACIONAL_INSUFICIENTE: Caixa AMM livre (${(cashRow.balance_cents / 100).toFixed(2)} Kz) insuficiente. Reserva protegida de 50.000 Kz é intocável.`,
        isRiskReducing,
        assessment,
      };
    }

    // Worst-case resolution risk projection check if NOT risk-reducing
    if (!isRiskReducing) {
      const nextSharesSim = outcome === 'Yes' ? sharesSim + quantity : sharesSim;
      const nextSharesNo = outcome === 'No' ? sharesNo + quantity : sharesNo;
      const nextCost = (inv?.cost_basis_sim_cents ?? 0) + (inv?.cost_basis_no_cents ?? 0) + requiredCents;
      const projectedWorstScenario = Math.min(nextSharesSim * 100, nextSharesNo * 100) - nextCost + (inv?.realized_pnl_cents ?? 0);
      const projectedWorstLoss = projectedWorstScenario < 0 ? Math.abs(projectedWorstScenario) : 0;

      // Allow bounded unhedged inventory only up to max single market risk cap (or lossLimit if strictly hedged)
      // Specifically: worst-case unhedged loss on a single directional fill cannot breach the 5% market loss limit unless hedged,
      // Wait: if market has 50.000 Kz allocation (loss limit 2.500 Kz), max unhedged directional outlay is 2.500 Kz (250.000 cents)!
      if (projectedWorstLoss > assessment.lossLimitCents) {
        return {
          allowed: false,
          reason: `EXPOSICAO_PIOR_CENARIO_EXCEDIDA: Pior cenário projetado (${(projectedWorstLoss / 100).toFixed(2)} Kz) ultrapassa o limite de perda de 5% do mercado (${(assessment.lossLimitCents / 100).toFixed(2)} Kz). Reduza tamanho ou faça hedge bilateral.`,
          isRiskReducing,
          assessment,
        };
      }
    }
  } else if (side === 'Sell') {
    const held = outcome === 'Yes' ? sharesSim : sharesNo;
    if (held < quantity) {
      // Selling shares we don't hold requires collateralizing the complementary outcome (100 - priceCents) * quantity
      const deficit = quantity - held;
      const requiredCollateral = (100 - priceCents) * deficit;
      const availableInAlloc = alloc.allocated_capital_cents - alloc.used_capital_cents - alloc.reserved_capital_cents;
      if (requiredCollateral > availableInAlloc) {
        return {
          allowed: false,
          reason: `COLATERAL_VENDA_INSUFICIENTE: Necessário ${(requiredCollateral / 100).toFixed(2)} Kz de colateral para venda sem inventário prévio.`,
          isRiskReducing,
          assessment,
        };
      }
    }
  }

  return {
    allowed: true,
    reason: 'VALIDACAO_RISCO_APROVADA',
    isRiskReducing,
    assessment,
  };
}
