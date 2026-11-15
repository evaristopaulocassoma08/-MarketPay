import { randomUUID } from 'crypto';
import { AmmDatabase } from './db';
import { ammCancelMarketQuotesInternal } from './clobHelpers';
import { recordPnlSnapshot } from './accounting';
import { ensureMarketRecord } from './clobEngine';

export type AdminRole = 'MASTER_ADMIN' | 'OPERATIONAL_ADMIN' | 'USER';

export interface VerifiedActor {
  uid: string;
  email: string;
  role: AdminRole;
  ip?: string;
}

export function writeSecurityAudit(
  db: AmmDatabase,
  actor: VerifiedActor,
  action: string,
  targetId: string | null,
  justification: string,
  details: any = {}
) {
  db.prepare(`
    INSERT INTO amm_security_audit (
      id, actor_id, actor_email, actor_role, action, target_id, justification, details_json, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    actor.uid,
    actor.email,
    actor.role,
    action,
    targetId,
    justification,
    JSON.stringify(details),
    actor.ip || null,
    new Date().toISOString()
  );
}

function requireMasterAdmin(actor: VerifiedActor, actionName: string) {
  if (actor.role !== 'MASTER_ADMIN') {
    throw new Error(`PERMISSAO_NEGADA: Apenas o Master Admin pode executar "${actionName}".`);
  }
}

function requireAnyAdmin(actor: VerifiedActor, actionName: string) {
  if (actor.role !== 'MASTER_ADMIN' && actor.role !== 'OPERATIONAL_ADMIN') {
    throw new Error(`PERMISSAO_NEGADA: Acesso administrativo necessário para "${actionName}".`);
  }
}

function requireJustification(justification: string, minLen: number = 8) {
  if (!justification || justification.trim().length < minLen) {
    throw new Error(`JUSTIFICACAO_OBRIGATORIA: Insira uma justificação clara (mínimo ${minLen} caracteres) para registo de auditoria.`);
  }
}

export function requestMarketAllocation(
  db: AmmDatabase,
  actor: VerifiedActor,
  params: {
    marketId: string;
    marketQuestion: string;
    allocatedCapitalCents: number;
    yesPriceCents?: number;
    noPriceCents?: number;
    justification: string;
  }
) {
  requireAnyAdmin(actor, 'Solicitar Alocação de Mercado');
  requireJustification(params.justification, 5);

  if (!Number.isInteger(params.allocatedCapitalCents) || params.allocatedCapitalCents <= 0) {
    throw new Error('Capital alocado deve ser um valor inteiro positivo em cêntimos.');
  }

  return db.transaction(() => {
    const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
    const now = new Date().toISOString();

    ensureMarketRecord(db, params.marketId, params.marketQuestion);

    // Check total sum of allocations across all OTHER active/approved/pending/suspended markets
    const otherSumRow = db
      .prepare(`
        SELECT COALESCE(SUM(allocated_capital_cents), 0) AS sum_cents
        FROM amm_market_allocations
        WHERE market_id != ? AND status IN ('APPROVED', 'PENDING', 'SUSPENDED') AND market_resolved = 0
      `)
      .get(params.marketId) as { sum_cents: number };

    const projectedTotal = otherSumRow.sum_cents + params.allocatedCapitalCents;
    if (projectedTotal > settings.max_allocation_budget_cents) {
      throw new Error(
        `ORCAMENTO_EXCEDIDO: A soma das alocações (${(projectedTotal / 100).toLocaleString()} Kz) ultrapassa o orçamento máximo de ${(settings.max_allocation_budget_cents / 100).toLocaleString()} Kz. A reserva protegida de 50.000 Kz nunca pode ser alocada.`
      );
    }

    const lossLimitCents = Math.floor((params.allocatedCapitalCents * settings.halt_loss_bps) / 10000);
    const yesPrice = Math.max(1, Math.min(99, Math.round(params.yesPriceCents ?? 50)));
    const noPrice = 100 - yesPrice;

    const approvalId = randomUUID();
    db.prepare(`
      UPDATE amm_market_allocations
      SET market_question = ?,
          allocated_capital_cents = ?,
          loss_limit_cents = ?,
          status = 'PENDING',
          yes_price_cents = ?,
          no_price_cents = ?,
          requested_by = ?,
          justification = ?,
          updated_at = ?
      WHERE market_id = ?
    `).run(
      params.marketQuestion,
      params.allocatedCapitalCents,
      lossLimitCents,
      yesPrice,
      noPrice,
      actor.uid,
      params.justification.trim(),
      now,
      params.marketId
    );

    db.prepare(`
      INSERT INTO amm_admin_approvals (
        id, action_type, target_id, requested_by, requested_by_email,
        status, justification, payload_json, created_at
      ) VALUES (?, 'MARKET_ALLOCATION', ?, ?, ?, 'PENDING', ?, ?, ?)
    `).run(
      approvalId,
      params.marketId,
      actor.uid,
      actor.email,
      params.justification.trim(),
      JSON.stringify({
        marketId: params.marketId,
        allocatedCapitalCents: params.allocatedCapitalCents,
        lossLimitCents,
      }),
      now
    );

    writeSecurityAudit(db, actor, 'REQUEST_MARKET_ALLOCATION', params.marketId, params.justification.trim(), {
      allocatedCapitalCents: params.allocatedCapitalCents,
      lossLimitCents,
    });

    recordPnlSnapshot(db, params.marketId);

    return {
      approvalId,
      marketId: params.marketId,
      allocatedCapitalCents: params.allocatedCapitalCents,
      lossLimitCents,
      status: 'PENDING',
    };
  })();
}

export function decideMarketAllocation(
  db: AmmDatabase,
  actor: VerifiedActor,
  params: {
    marketId: string;
    decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    allocatedCapitalCents?: number;
    justification: string;
  }
) {
  requireMasterAdmin(actor, 'Autorizar/Rejeitar/Suspender Alocação de Mercado');
  requireJustification(params.justification, 5);

  return db.transaction(() => {
    const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
    const alloc = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(params.marketId) as any;
    if (!alloc) {
      throw new Error(`Alocação não encontrada para mercado ${params.marketId}.`);
    }

    const now = new Date().toISOString();
    const nextAllocCents =
      params.allocatedCapitalCents !== undefined ? params.allocatedCapitalCents : alloc.allocated_capital_cents;

    if (params.decision === 'APPROVED') {
      if (nextAllocCents <= 0) {
        throw new Error('Capital alocado deve ser superior a 0 Kz para aprovação.');
      }
      const otherSumRow = db
        .prepare(`
          SELECT COALESCE(SUM(allocated_capital_cents), 0) AS sum_cents
          FROM amm_market_allocations
          WHERE market_id != ? AND status IN ('APPROVED', 'SUSPENDED') AND market_resolved = 0
        `)
        .get(params.marketId) as { sum_cents: number };

      if (otherSumRow.sum_cents + nextAllocCents > settings.max_allocation_budget_cents) {
        throw new Error(
          `ORCAMENTO_EXCEDIDO: Total alocado excederia o teto de ${(settings.max_allocation_budget_cents / 100).toLocaleString()} Kz.`
        );
      }

      if (alloc.risk_state === 'HALTED') {
        throw new Error(
          'BLOQUEIO_SILENCIOSO_IMPEDIDO: Este mercado está em estado HALTED (perda >= 5%). Utilize o fluxo formal de investigação e retoma após auditoria.'
        );
      }
    }

    const nextLossLimitCents =
      params.decision === 'REJECTED'
        ? 0
        : Math.floor((nextAllocCents * settings.halt_loss_bps) / 10000);
    const finalAllocCents = params.decision === 'REJECTED' ? 0 : nextAllocCents;

    if (params.decision === 'SUSPENDED' || params.decision === 'REJECTED') {
      ammCancelMarketQuotesInternal(db, params.marketId, `ADMIN_${params.decision}`, false);
    }

    db.prepare(`
      UPDATE amm_market_allocations
      SET allocated_capital_cents = ?,
          loss_limit_cents = ?,
          status = ?,
          approved_by = ?,
          justification = ?,
          updated_at = ?
      WHERE market_id = ?
    `).run(finalAllocCents, nextLossLimitCents, params.decision, actor.uid, params.justification.trim(), now, params.marketId);

    // Update pending approval records for this market
    db.prepare(`
      UPDATE amm_admin_approvals
      SET status = ?, approved_by = ?, approved_by_email = ?, decided_at = ?
      WHERE target_id = ? AND action_type = 'MARKET_ALLOCATION' AND status = 'PENDING'
    `).run(params.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED', actor.uid, actor.email, now, params.marketId);

    // Record explicit approval log
    db.prepare(`
      INSERT INTO amm_admin_approvals (
        id, action_type, target_id, requested_by, requested_by_email,
        approved_by, approved_by_email, status, justification, payload_json, created_at, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      `ALLOCATION_${params.decision}`,
      params.marketId,
      actor.uid,
      actor.email,
      actor.uid,
      actor.email,
      params.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
      params.justification.trim(),
      JSON.stringify({ marketId: params.marketId, allocatedCapitalCents: finalAllocCents, lossLimitCents: nextLossLimitCents }),
      now,
      now
    );

    writeSecurityAudit(db, actor, `ALLOCATION_${params.decision}`, params.marketId, params.justification.trim(), {
      allocatedCapitalCents: finalAllocCents,
      lossLimitCents: nextLossLimitCents,
    });

    recordPnlSnapshot(db, params.marketId);

    return {
      marketId: params.marketId,
      status: params.decision,
      allocatedCapitalCents: finalAllocCents,
      lossLimitCents: nextLossLimitCents,
    };
  })();
}

export function toggleAmmEnabled(
  db: AmmDatabase,
  actor: VerifiedActor,
  enable: boolean,
  justification: string
) {
  requireMasterAdmin(actor, enable ? 'Ativar Fornecedor Automático' : 'Desativar Fornecedor Automático');
  requireJustification(justification, 8);

  return db.transaction(() => {
    const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
    const now = new Date().toISOString();

    if (enable) {
      if (settings.emergency_halted === 1) {
        throw new Error('PARAGEM_EMERGENCIA_ATIVA: Levante primeiro a paragem de emergência após investigação formal.');
      }
      if (settings.sandbox_tests_passed !== 1) {
        throw new Error('TESTES_SANDBOX_PENDENTES: O AMM só pode ser ativado no Sandbox após conclusão e aprovação dos testes obrigatórios.');
      }
    } else {
      // Cancel all active AMM quotes when disabling
      const activeMarkets = db.prepare(`SELECT market_id FROM amm_market_allocations`).all() as Array<{ market_id: string }>;
      for (const m of activeMarkets) {
        ammCancelMarketQuotesInternal(db, m.market_id, 'AMM_DISABLED_BY_MASTER_ADMIN', false);
      }
    }

    db.prepare(`UPDATE amm_settings SET amm_enabled = ?, updated_by = ?, updated_at = ? WHERE id = 1`)
      .run(enable ? 1 : 0, actor.uid, now);

    db.prepare(`
      INSERT INTO amm_admin_approvals (
        id, action_type, target_id, requested_by, requested_by_email,
        approved_by, approved_by_email, status, justification, payload_json, created_at, decided_at
      ) VALUES (?, ?, 'GLOBAL_AMM', ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?)
    `).run(
      randomUUID(),
      enable ? 'ENABLE_AMM_SANDBOX' : 'DISABLE_AMM_SANDBOX',
      actor.uid,
      actor.email,
      actor.uid,
      actor.email,
      justification.trim(),
      JSON.stringify({ ammEnabled: enable, platformMode: settings.platform_mode }),
      now,
      now
    );

    writeSecurityAudit(db, actor, enable ? 'ENABLE_AMM' : 'DISABLE_AMM', 'GLOBAL_AMM', justification.trim());
    return { ammEnabled: enable };
  })();
}

export function triggerEmergencyStop(db: AmmDatabase, actor: VerifiedActor, justification: string) {
  requireAnyAdmin(actor, 'Botão de Emergência (Emergency Halt)');
  requireJustification(justification, 5);

  return db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare(`UPDATE amm_settings SET emergency_halted = 1, amm_enabled = 0, updated_by = ?, updated_at = ? WHERE id = 1`)
      .run(actor.uid, now);

    const markets = db.prepare(`SELECT market_id FROM amm_market_allocations`).all() as Array<{ market_id: string }>;
    let cancelledTotal = 0;
    for (const m of markets) {
      cancelledTotal += ammCancelMarketQuotesInternal(db, m.market_id, 'EMERGENCY_STOP_TRIGGERED', false);
    }

    db.prepare(`
      INSERT INTO amm_risk_events (
        id, market_id, previous_state, new_state, loss_cents, loss_bps,
        worst_case_loss_cents, trigger_reason, notified_master_admin, created_at
      ) VALUES (?, 'GLOBAL', 'ACTIVE', 'EMERGENCY_HALT', 0, 0, 0, ?, 1, ?)
    `).run(randomUUID(), `EMERGÊNCIA ACIONADA por ${actor.email}: ${justification.trim()}`, now);

    writeSecurityAudit(db, actor, 'EMERGENCY_STOP', 'GLOBAL_AMM', justification.trim(), {
      cancelledOrders: cancelledTotal,
    });

    return { emergencyHalted: true, cancelledOrders: cancelledTotal };
  })();
}

export function resumeAfterInvestigation(
  db: AmmDatabase,
  actor: VerifiedActor,
  params: {
    marketId?: string; // if omitted, lifts global emergency halt
    investigationFindings: string;
    justification: string;
  }
) {
  requireMasterAdmin(actor, 'Autorizar Retoma Após Investigação');
  requireJustification(params.investigationFindings, 10);
  requireJustification(params.justification, 10);

  return db.transaction(() => {
    const now = new Date().toISOString();

    if (!params.marketId || params.marketId === 'GLOBAL') {
      db.prepare(`UPDATE amm_settings SET emergency_halted = 0, updated_by = ?, updated_at = ? WHERE id = 1`)
        .run(actor.uid, now);
    } else {
      const alloc = db.prepare(`SELECT * FROM amm_market_allocations WHERE market_id = ?`).get(params.marketId) as any;
      if (!alloc) throw new Error('Mercado não encontrado.');

      // Reset market risk state to NORMAL / APPROVED only if findings & justification provided
      db.prepare(`
        UPDATE amm_market_allocations
        SET risk_state = 'NORMAL', status = 'APPROVED', updated_at = ?
        WHERE market_id = ?
      `).run(now, params.marketId);
    }

    db.prepare(`
      UPDATE amm_risk_events
      SET acknowledged_by = ?, resolution_justification = ?
      WHERE (market_id = ? OR ? = 'GLOBAL') AND acknowledged_by IS NULL
    `).run(
      actor.uid,
      `Investigação: ${params.investigationFindings.trim()} | Justificação: ${params.justification.trim()}`,
      params.marketId || 'GLOBAL',
      params.marketId || 'GLOBAL'
    );

    db.prepare(`
      INSERT INTO amm_admin_approvals (
        id, action_type, target_id, requested_by, requested_by_email,
        approved_by, approved_by_email, status, justification, payload_json, created_at, decided_at
      ) VALUES (?, 'RESUME_AFTER_INVESTIGATION', ?, ?, ?, ?, ?, 'APPROVED', ?, ?, ?, ?)
    `).run(
      randomUUID(),
      params.marketId || 'GLOBAL',
      actor.uid,
      actor.email,
      actor.uid,
      actor.email,
      params.justification.trim(),
      JSON.stringify({ investigationFindings: params.investigationFindings.trim() }),
      now,
      now
    );

    writeSecurityAudit(
      db,
      actor,
      'RESUME_AFTER_INVESTIGATION',
      params.marketId || 'GLOBAL',
      params.justification.trim(),
      { investigationFindings: params.investigationFindings.trim() }
    );

    return { resumed: true, target: params.marketId || 'GLOBAL' };
  })();
}

export function updateRiskLimits(
  db: AmmDatabase,
  actor: VerifiedActor,
  params: {
    warningLossBps: number;
    protectionLossBps: number;
    haltLossBps: number;
    maxAllocationBudgetCents: number;
    justification: string;
  }
) {
  requireMasterAdmin(actor, 'Alterar Limites Financeiros e de Risco');
  requireJustification(params.justification, 10);

  if (
    params.warningLossBps <= 0 ||
    params.warningLossBps >= params.protectionLossBps ||
    params.protectionLossBps >= params.haltLossBps ||
    params.haltLossBps > 2000
  ) {
    throw new Error('Limites inválidos: Alerta < Proteção < Suspensão <= 20%.');
  }

  return db.transaction(() => {
    const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
    const maxAllowedBudget = settings.company_capital_cents - settings.protected_reserve_cents;
    if (params.maxAllocationBudgetCents > maxAllowedBudget || params.maxAllocationBudgetCents < 0) {
      throw new Error(
        `ORCAMENTO_INVALIDO: O orçamento de alocação não pode ultrapassar ${(maxAllowedBudget / 100).toLocaleString()} Kz porque a reserva de 50.000 Kz é protegida.`
      );
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE amm_settings
      SET warning_loss_bps = ?, protection_loss_bps = ?, halt_loss_bps = ?,
          max_allocation_budget_cents = ?, updated_by = ?, updated_at = ?
      WHERE id = 1
    `).run(
      params.warningLossBps,
      params.protectionLossBps,
      params.haltLossBps,
      params.maxAllocationBudgetCents,
      actor.uid,
      now
    );

    db.prepare(`
      INSERT INTO amm_risk_limits (
        id, scope, market_id, warning_loss_bps, protection_loss_bps, halt_loss_bps,
        max_market_exposure_cents, max_single_order_cents, min_spread_bps, updated_by, justification, updated_at
      ) VALUES (?, 'GLOBAL', NULL, ?, ?, ?, ?, 1500000, 200, ?, ?, ?)
    `).run(
      randomUUID(),
      params.warningLossBps,
      params.protectionLossBps,
      params.haltLossBps,
      params.maxAllocationBudgetCents,
      actor.uid,
      params.justification.trim(),
      now
    );

    writeSecurityAudit(db, actor, 'UPDATE_RISK_LIMITS', 'GLOBAL_LIMITS', params.justification.trim(), params);
    return { updated: true };
  })();
}
