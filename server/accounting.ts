import { randomUUID } from 'crypto';
import { AmmDatabase, PROTECTED_RESERVE_CENTS } from './db';

export interface JournalLineInput {
  accountCode:
    | 'amm_cash'
    | 'amm_reserved_cash'
    | 'amm_protected_reserve'
    | 'amm_positions_sim'
    | 'amm_positions_no'
    | 'amm_collateral'
    | 'amm_realized_pnl'
    | 'amm_unrealized_pnl'
    | 'amm_liabilities'
    | 'amm_company_equity';
  debitCents?: number;
  creditCents?: number;
}

export interface PostJournalInput {
  idempotencyKey?: string;
  referenceType: string;
  referenceId: string;
  marketId?: string | null;
  description: string;
  actorId: string;
  lines: JournalLineInput[];
}

export function postJournalEntry(db: AmmDatabase, input: PostJournalInput): string {
  if (!input.lines || input.lines.length < 2) {
    throw new Error('Contabilidade: Lançamento de dupla entrada exige pelo menos 2 partidas.');
  }

  if (input.idempotencyKey) {
    const existing = db
      .prepare(`SELECT id FROM amm_journal_entries WHERE idempotency_key = ?`)
      .get(input.idempotencyKey) as { id: string } | undefined;
    if (existing) {
      return existing.id;
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of input.lines) {
    const d = line.debitCents || 0;
    const c = line.creditCents || 0;
    if (!Number.isInteger(d) || !Number.isInteger(c) || d < 0 || c < 0) {
      throw new Error(`Contabilidade: Valores monetários devem ser inteiros não-negativos (conta ${line.accountCode}).`);
    }
    if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
      throw new Error(`Contabilidade: Cada linha deve ter apenas débito OU crédito > 0 (conta ${line.accountCode}).`);
    }
    if (line.accountCode === 'amm_protected_reserve' && c > 0) {
      throw new Error(
        'RESERVA_PROTEGIDA_INVIOLAVEL: A reserva protegida de 50.000 Kz não pode ser debitada/utilizada para financiar posições, cobrir perdas ou aumentar liquidez.'
      );
    }
    totalDebit += d;
    totalCredit += c;
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Contabilidade: Partida dobrada desequilibrada! Débitos (${totalDebit}) != Créditos (${totalCredit}).`
    );
  }

  const now = new Date().toISOString();
  const entryId = randomUUID();

  db.prepare(`
    INSERT INTO amm_journal_entries (id, idempotency_key, reference_type, reference_id, market_id, description, actor_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entryId,
    input.idempotencyKey || null,
    input.referenceType,
    input.referenceId,
    input.marketId || null,
    input.description,
    input.actorId,
    now
  );

  const insertLine = db.prepare(`
    INSERT INTO amm_journal_lines (id, entry_id, account_code, debit_cents, credit_cents, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const getAcc = db.prepare(`SELECT account_code, account_type, balance_cents, is_protected FROM amm_capital_accounts WHERE account_code = ?`);
  const updateAcc = db.prepare(`UPDATE amm_capital_accounts SET balance_cents = ?, updated_at = ? WHERE account_code = ?`);

  for (const line of input.lines) {
    const d = line.debitCents || 0;
    const c = line.creditCents || 0;

    const acc = getAcc.get(line.accountCode) as
      | { account_code: string; account_type: string; balance_cents: number; is_protected: number }
      | undefined;

    if (!acc) {
      throw new Error(`Contabilidade: Conta ${line.accountCode} não encontrada.`);
    }

    const isDebitNormal = acc.account_type === 'ASSET' || acc.account_type === 'EXPENSE';
    const delta = isDebitNormal ? d - c : c - d;
    const nextBalance = acc.balance_cents + delta;

    if (
      (line.accountCode === 'amm_cash' ||
        line.accountCode === 'amm_reserved_cash' ||
        line.accountCode === 'amm_collateral') &&
      nextBalance < 0
    ) {
      throw new Error(
        `SALDO_INSUFICIENTE_CONTA: Operação deixaria a conta ${line.accountCode} negativa (${nextBalance} cêntimos).`
      );
    }

    if (line.accountCode === 'amm_protected_reserve' && nextBalance < PROTECTED_RESERVE_CENTS) {
      throw new Error('RESERVA_PROTEGIDA_INVIOLAVEL: Reserva protegida nunca pode ficar abaixo de 50.000 Kz.');
    }

    insertLine.run(randomUUID(), entryId, line.accountCode, d, c, now);
    updateAcc.run(nextBalance, now, line.accountCode);
  }

  return entryId;
}

export function getAccountsMap(db: AmmDatabase): Record<string, number> {
  const rows = db.prepare(`SELECT account_code, balance_cents FROM amm_capital_accounts`).all() as Array<{
    account_code: string;
    balance_cents: number;
  }>;
  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.account_code] = r.balance_cents;
  }
  return map;
}

export function reconcileAccounts(db: AmmDatabase) {
  const ledgerTotals = db
    .prepare(`SELECT COALESCE(SUM(debit_cents), 0) AS total_debits, COALESCE(SUM(credit_cents), 0) AS total_credits FROM amm_journal_lines`)
    .get() as { total_debits: number; total_credits: number };

  const accounts = db
    .prepare(`SELECT account_code, name, account_type, balance_cents, is_protected FROM amm_capital_accounts`)
    .all() as Array<{
    account_code: string;
    name: string;
    account_type: string;
    balance_cents: number;
    is_protected: number;
  }>;

  let totalAssets = 0;
  let totalLiabilitiesAndEquity = 0;
  for (const acc of accounts) {
    if (acc.account_type === 'ASSET' || acc.account_type === 'EXPENSE') {
      totalAssets += acc.balance_cents;
    } else {
      totalLiabilitiesAndEquity += acc.balance_cents;
    }
  }

  const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
  const allocSum = db
    .prepare(`SELECT COALESCE(SUM(allocated_capital_cents), 0) AS total_alloc FROM amm_market_allocations WHERE status IN ('APPROVED', 'SUSPENDED') AND market_resolved = 0`)
    .get() as { total_alloc: number };

  const protectedAccount = accounts.find(a => a.account_code === 'amm_protected_reserve');
  const ledgerBalanced = ledgerTotals.total_debits === ledgerTotals.total_credits;
  const balanceSheetBalanced = totalAssets === totalLiabilitiesAndEquity;
  const protectedReserveIntact = (protectedAccount?.balance_cents || 0) >= settings.protected_reserve_cents;
  const allocationWithinBudget = allocSum.total_alloc <= settings.max_allocation_budget_cents;

  return {
    reconciled: ledgerBalanced && balanceSheetBalanced && protectedReserveIntact && allocationWithinBudget,
    ledgerBalanced,
    balanceSheetBalanced,
    protectedReserveIntact,
    allocationWithinBudget,
    totalDebitsCents: ledgerTotals.total_debits,
    totalCreditsCents: ledgerTotals.total_credits,
    totalAssetsCents: totalAssets,
    totalLiabilitiesAndEquityCents: totalLiabilitiesAndEquity,
    discrepancyCents: totalAssets - totalLiabilitiesAndEquity,
    totalAllocatedCents: allocSum.total_alloc,
    maxAllocationBudgetCents: settings.max_allocation_budget_cents,
    accounts,
  };
}

export function recordPnlSnapshot(db: AmmDatabase, marketId: string | null = null) {
  const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
  const acc = getAccountsMap(db);

  const allocStats = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('APPROVED', 'SUSPENDED') AND market_resolved = 0 THEN allocated_capital_cents ELSE 0 END), 0) AS allocated_cents,
        COALESCE(SUM(CASE WHEN status IN ('APPROVED', 'SUSPENDED') AND market_resolved = 0 THEN used_capital_cents ELSE 0 END), 0) AS used_cents,
        COALESCE(SUM(CASE WHEN status IN ('APPROVED', 'SUSPENDED') AND market_resolved = 0 THEN reserved_capital_cents ELSE 0 END), 0) AS reserved_cents
      FROM amm_market_allocations
    `)
    .get() as { allocated_cents: number; used_cents: number; reserved_cents: number };

  const invStats = db
    .prepare(`
      SELECT
        COALESCE(SUM(worst_case_liability_cents), 0) AS liabilities_cents,
        COALESCE(SUM(ABS(net_exposure_cents)), 0) AS exposure_cents,
        COALESCE(SUM(unrealized_pnl_cents), 0) AS unrealized_pnl_cents,
        COALESCE(SUM(realized_pnl_cents), 0) AS realized_pnl_cents
      FROM amm_inventory
    `)
    .get() as {
    liabilities_cents: number;
    exposure_cents: number;
    unrealized_pnl_cents: number;
    realized_pnl_cents: number;
  };

  const netPnlCents = invStats.realized_pnl_cents + invStats.unrealized_pnl_cents;
  const currentLossCents = netPnlCents < 0 ? Math.abs(netPnlCents) : 0;
  const budgetCents = settings.max_allocation_budget_cents || 1;
  const utilizationPct = Number(((allocStats.allocated_cents / budgetCents) * 100).toFixed(2));

  db.prepare(`
    INSERT INTO amm_pnl (
      id, market_id, company_capital_cents, available_cash_cents, allocated_capital_cents,
      protected_reserve_cents, reserved_cash_cents, positions_sim_value_cents, positions_no_value_cents,
      exposure_cents, liabilities_cents, realized_pnl_cents, unrealized_pnl_cents, current_loss_cents,
      utilization_pct, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    marketId,
    settings.company_capital_cents,
    acc.amm_cash || 0,
    allocStats.allocated_cents,
    acc.amm_protected_reserve || 0,
    acc.amm_reserved_cash || 0,
    acc.amm_positions_sim || 0,
    acc.amm_positions_no || 0,
    invStats.exposure_cents,
    invStats.liabilities_cents,
    invStats.realized_pnl_cents,
    invStats.unrealized_pnl_cents,
    currentLossCents,
    utilizationPct,
    new Date().toISOString()
  );
}
