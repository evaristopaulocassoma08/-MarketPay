import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

export type AmmDatabase = Database.Database;

export const INITIAL_COMPANY_CAPITAL_CENTS = 25_000_000; // 250.000,00 Kz
export const MAX_ALLOCATION_BUDGET_CENTS = 20_000_000; // 200.000,00 Kz
export const PROTECTED_RESERVE_CENTS = 5_000_000; // 50.000,00 Kz
export const DEFAULT_WARNING_LOSS_BPS = 300; // 3.00%
export const DEFAULT_PROTECTION_LOSS_BPS = 400; // 4.00%
export const DEFAULT_HALT_LOSS_BPS = 500; // 5.00%

export function createAmmDatabase(dbPath?: string): AmmDatabase {
  const resolvedPath = dbPath || path.resolve(process.cwd(), 'amm_engine.db');
  const db = new Database(resolvedPath);

  if (resolvedPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  initializeSchema(db);
  seedInitialEnterpriseState(db);

  return db;
}

function initializeSchema(db: AmmDatabase) {
  db.exec(`
    -- 1. amm_settings
    CREATE TABLE IF NOT EXISTS amm_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      platform_mode TEXT NOT NULL DEFAULT 'SANDBOX' CHECK (platform_mode IN ('SANDBOX')),
      amm_enabled INTEGER NOT NULL DEFAULT 0 CHECK (amm_enabled IN (0, 1)),
      emergency_halted INTEGER NOT NULL DEFAULT 0 CHECK (emergency_halted IN (0, 1)),
      engine_mode TEXT NOT NULL DEFAULT 'CLOB_AMM' CHECK (engine_mode IN ('CLOB_AMM')),
      autonomy_mode TEXT NOT NULL DEFAULT 'CONTROLLED_AUTO' CHECK (autonomy_mode IN ('CONTROLLED_AUTO', 'MANUAL')),
      company_capital_cents INTEGER NOT NULL DEFAULT 25000000 CHECK (company_capital_cents >= 0),
      max_allocation_budget_cents INTEGER NOT NULL DEFAULT 20000000 CHECK (max_allocation_budget_cents >= 0),
      protected_reserve_cents INTEGER NOT NULL DEFAULT 5000000 CHECK (protected_reserve_cents >= 5000000),
      warning_loss_bps INTEGER NOT NULL DEFAULT 300 CHECK (warning_loss_bps > 0 AND warning_loss_bps < protection_loss_bps),
      protection_loss_bps INTEGER NOT NULL DEFAULT 400 CHECK (protection_loss_bps < halt_loss_bps),
      halt_loss_bps INTEGER NOT NULL DEFAULT 500 CHECK (halt_loss_bps > 0),
      sandbox_tests_passed INTEGER NOT NULL DEFAULT 0 CHECK (sandbox_tests_passed IN (0, 1)),
      last_test_report_json TEXT,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    -- 2. amm_capital_accounts (8 enterprise accounts + equity + reserve)
    CREATE TABLE IF NOT EXISTS amm_capital_accounts (
      account_code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
      balance_cents INTEGER NOT NULL DEFAULT 0,
      is_protected INTEGER NOT NULL DEFAULT 0 CHECK (is_protected IN (0, 1)),
      updated_at TEXT NOT NULL
    );

    -- Double-entry immutable journal
    CREATE TABLE IF NOT EXISTS amm_journal_entries (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      market_id TEXT,
      description TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS amm_journal_lines (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL REFERENCES amm_journal_entries(id),
      account_code TEXT NOT NULL REFERENCES amm_capital_accounts(account_code),
      debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
      credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
      created_at TEXT NOT NULL,
      CHECK ((debit_cents > 0 AND credit_cents = 0) OR (credit_cents > 0 AND debit_cents = 0))
    );

    -- 3. amm_market_allocations
    CREATE TABLE IF NOT EXISTS amm_market_allocations (
      market_id TEXT PRIMARY KEY,
      market_question TEXT NOT NULL,
      allocated_capital_cents INTEGER NOT NULL DEFAULT 0 CHECK (allocated_capital_cents >= 0),
      used_capital_cents INTEGER NOT NULL DEFAULT 0 CHECK (used_capital_cents >= 0),
      reserved_capital_cents INTEGER NOT NULL DEFAULT 0 CHECK (reserved_capital_cents >= 0),
      loss_limit_cents INTEGER NOT NULL DEFAULT 0 CHECK (loss_limit_cents >= 0),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
      risk_state TEXT NOT NULL DEFAULT 'NORMAL' CHECK (risk_state IN ('NORMAL', 'WARNING', 'PROTECTION', 'HALTED')),
      yes_price_cents INTEGER NOT NULL DEFAULT 50 CHECK (yes_price_cents >= 1 AND yes_price_cents <= 99),
      no_price_cents INTEGER NOT NULL DEFAULT 50 CHECK (no_price_cents >= 1 AND no_price_cents <= 99),
      market_resolved INTEGER NOT NULL DEFAULT 0 CHECK (market_resolved IN (0, 1)),
      resolution_outcome TEXT CHECK (resolution_outcome IN ('Yes', 'No') OR resolution_outcome IS NULL),
      requested_by TEXT NOT NULL,
      approved_by TEXT,
      justification TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 4. amm_quotes
    CREATE TABLE IF NOT EXISTS amm_quotes (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL REFERENCES amm_market_allocations(market_id),
      outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
      bid_price_cents INTEGER NOT NULL CHECK (bid_price_cents >= 1 AND bid_price_cents <= 99),
      ask_price_cents INTEGER NOT NULL CHECK (ask_price_cents >= 1 AND ask_price_cents <= 99),
      bid_shares INTEGER NOT NULL CHECK (bid_shares >= 0),
      ask_shares INTEGER NOT NULL CHECK (ask_shares >= 0),
      spread_bps INTEGER NOT NULL CHECK (spread_bps >= 0),
      risk_state TEXT NOT NULL,
      bid_order_id TEXT,
      ask_order_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 5. amm_inventory
    CREATE TABLE IF NOT EXISTS amm_inventory (
      market_id TEXT PRIMARY KEY REFERENCES amm_market_allocations(market_id),
      shares_sim INTEGER NOT NULL DEFAULT 0 CHECK (shares_sim >= 0),
      shares_no INTEGER NOT NULL DEFAULT 0 CHECK (shares_no >= 0),
      avg_cost_sim_cents INTEGER NOT NULL DEFAULT 0 CHECK (avg_cost_sim_cents >= 0),
      avg_cost_no_cents INTEGER NOT NULL DEFAULT 0 CHECK (avg_cost_no_cents >= 0),
      cost_basis_sim_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_basis_sim_cents >= 0),
      cost_basis_no_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_basis_no_cents >= 0),
      net_exposure_cents INTEGER NOT NULL DEFAULT 0,
      worst_case_liability_cents INTEGER NOT NULL DEFAULT 0 CHECK (worst_case_liability_cents >= 0),
      realized_pnl_cents INTEGER NOT NULL DEFAULT 0,
      unrealized_pnl_cents INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- 6. amm_positions
    CREATE TABLE IF NOT EXISTS amm_positions (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL REFERENCES amm_market_allocations(market_id),
      outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
      shares INTEGER NOT NULL DEFAULT 0 CHECK (shares >= 0),
      avg_entry_price_cents INTEGER NOT NULL DEFAULT 0,
      cost_basis_cents INTEGER NOT NULL DEFAULT 0,
      mark_price_cents INTEGER NOT NULL DEFAULT 50,
      unrealized_pnl_cents INTEGER NOT NULL DEFAULT 0,
      realized_pnl_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SETTLED')),
      updated_at TEXT NOT NULL,
      UNIQUE (market_id, outcome)
    );

    -- 7. amm_trades
    CREATE TABLE IF NOT EXISTS amm_trades (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL REFERENCES amm_market_allocations(market_id),
      clob_order_id TEXT NOT NULL,
      execution_id TEXT NOT NULL,
      counterparty_user_id TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('Buy', 'Sell')),
      outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
      price_cents INTEGER NOT NULL CHECK (price_cents >= 1 AND price_cents <= 99),
      shares INTEGER NOT NULL CHECK (shares > 0),
      notional_cents INTEGER NOT NULL CHECK (notional_cents > 0),
      fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
      realized_pnl_cents INTEGER NOT NULL DEFAULT 0,
      is_amm_maker INTEGER NOT NULL DEFAULT 1 CHECK (is_amm_maker IN (0, 1)),
      idempotency_key TEXT,
      created_at TEXT NOT NULL
    );

    -- 8. amm_pnl
    CREATE TABLE IF NOT EXISTS amm_pnl (
      id TEXT PRIMARY KEY,
      market_id TEXT,
      company_capital_cents INTEGER NOT NULL,
      available_cash_cents INTEGER NOT NULL,
      allocated_capital_cents INTEGER NOT NULL,
      protected_reserve_cents INTEGER NOT NULL,
      reserved_cash_cents INTEGER NOT NULL,
      positions_sim_value_cents INTEGER NOT NULL,
      positions_no_value_cents INTEGER NOT NULL,
      exposure_cents INTEGER NOT NULL,
      liabilities_cents INTEGER NOT NULL,
      realized_pnl_cents INTEGER NOT NULL,
      unrealized_pnl_cents INTEGER NOT NULL,
      current_loss_cents INTEGER NOT NULL,
      utilization_pct REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 9. amm_risk_limits
    CREATE TABLE IF NOT EXISTS amm_risk_limits (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'MARKET')),
      market_id TEXT,
      warning_loss_bps INTEGER NOT NULL DEFAULT 300,
      protection_loss_bps INTEGER NOT NULL DEFAULT 400,
      halt_loss_bps INTEGER NOT NULL DEFAULT 500,
      max_market_exposure_cents INTEGER NOT NULL DEFAULT 5000000,
      max_single_order_cents INTEGER NOT NULL DEFAULT 1500000,
      min_spread_bps INTEGER NOT NULL DEFAULT 200,
      updated_by TEXT NOT NULL,
      justification TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 10. amm_risk_events
    CREATE TABLE IF NOT EXISTS amm_risk_events (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL,
      previous_state TEXT NOT NULL,
      new_state TEXT NOT NULL,
      loss_cents INTEGER NOT NULL,
      loss_bps INTEGER NOT NULL,
      worst_case_loss_cents INTEGER NOT NULL,
      trigger_reason TEXT NOT NULL,
      notified_master_admin INTEGER NOT NULL DEFAULT 0 CHECK (notified_master_admin IN (0, 1)),
      acknowledged_by TEXT,
      resolution_justification TEXT,
      created_at TEXT NOT NULL
    );

    -- 11. amm_admin_approvals
    CREATE TABLE IF NOT EXISTS amm_admin_approvals (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      requested_by_email TEXT,
      approved_by TEXT,
      approved_by_email TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
      justification TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );

    -- 12. amm_decision_logs
    CREATE TABLE IF NOT EXISTS amm_decision_logs (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL,
      decision_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      shares INTEGER NOT NULL,
      capital_used_cents INTEGER NOT NULL,
      reason TEXT NOT NULL,
      risk_state TEXT NOT NULL,
      risk_validation_passed INTEGER NOT NULL CHECK (risk_validation_passed IN (0, 1)),
      spread_bps INTEGER NOT NULL,
      book_depth_json TEXT NOT NULL,
      result_summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- CLOB Orders & Executions
    CREATE TABLE IF NOT EXISTS clob_orders (
      id TEXT PRIMARY KEY,
      seq INTEGER NOT NULL,
      market_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_amm INTEGER NOT NULL DEFAULT 0 CHECK (is_amm IN (0, 1)),
      side TEXT NOT NULL CHECK (side IN ('Buy', 'Sell')),
      outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
      order_type TEXT NOT NULL CHECK (order_type IN ('LIMIT', 'MARKET')),
      price_cents INTEGER NOT NULL CHECK (price_cents >= 1 AND price_cents <= 99),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      filled_quantity INTEGER NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0),
      remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
      reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0),
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED')),
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clob_executions (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL,
      maker_order_id TEXT NOT NULL REFERENCES clob_orders(id),
      taker_order_id TEXT NOT NULL REFERENCES clob_orders(id),
      maker_user_id TEXT NOT NULL,
      taker_user_id TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
      price_cents INTEGER NOT NULL CHECK (price_cents >= 1 AND price_cents <= 99),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      notional_cents INTEGER NOT NULL CHECK (notional_cents > 0),
      fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
      created_at TEXT NOT NULL,
      CHECK (maker_user_id != taker_user_id)
    );

    -- User Sandbox / CLOB collateral & share custody (strictly segregated from AMM funds!)
    CREATE TABLE IF NOT EXISTS user_clob_accounts (
      user_id TEXT PRIMARY KEY,
      available_cents INTEGER NOT NULL DEFAULT 0 CHECK (available_cents >= 0),
      reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0),
      last_synced_firestore_balance_cents INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applied_finance_ops (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      op_type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_clob_positions (
      user_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
      available_shares INTEGER NOT NULL DEFAULT 0 CHECK (available_shares >= 0),
      reserved_shares INTEGER NOT NULL DEFAULT 0 CHECK (reserved_shares >= 0),
      avg_price_cents INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, market_id, outcome)
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      user_id TEXT NOT NULL,
      response_json TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS amm_security_audit (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_email TEXT,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT,
      justification TEXT NOT NULL,
      details_json TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    -- Sequence counter for deterministic price/time priority
    CREATE TABLE IF NOT EXISTS clob_seq (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      val INTEGER NOT NULL DEFAULT 0
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_clob_book ON clob_orders(market_id, outcome, side, status, price_cents, seq);
    CREATE INDEX IF NOT EXISTS idx_clob_user ON clob_orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON amm_journal_lines(entry_id);
    CREATE INDEX IF NOT EXISTS idx_journal_lines_acc ON amm_journal_lines(account_code);
    CREATE INDEX IF NOT EXISTS idx_amm_trades_market ON amm_trades(market_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_amm_decisions_market ON amm_decision_logs(market_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_amm_risk_events_market ON amm_risk_events(market_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_amm_pnl_created ON amm_pnl(created_at);
  `);

  // Safe additive column migration for existing amm_engine.db files
  const cols = db.prepare(`PRAGMA table_info(user_clob_accounts)`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'last_synced_firestore_balance_cents')) {
    db.exec(`ALTER TABLE user_clob_accounts ADD COLUMN last_synced_firestore_balance_cents INTEGER`);
  }
}

function seedInitialEnterpriseState(db: AmmDatabase) {
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO clob_seq (id, val) VALUES (1, 0)`).run();

    const existingSettings = db.prepare(`SELECT id FROM amm_settings WHERE id = 1`).get();
    if (!existingSettings) {
      db.prepare(`
        INSERT INTO amm_settings (
          id, platform_mode, amm_enabled, emergency_halted, engine_mode, autonomy_mode,
          company_capital_cents, max_allocation_budget_cents, protected_reserve_cents,
          warning_loss_bps, protection_loss_bps, halt_loss_bps, sandbox_tests_passed, updated_by, updated_at
        ) VALUES (1, 'SANDBOX', 0, 0, 'CLOB_AMM', 'CONTROLLED_AUTO', ?, ?, ?, ?, ?, ?, 0, 'SYSTEM_INIT', ?)
      `).run(
        INITIAL_COMPANY_CAPITAL_CENTS,
        MAX_ALLOCATION_BUDGET_CENTS,
        PROTECTED_RESERVE_CENTS,
        DEFAULT_WARNING_LOSS_BPS,
        DEFAULT_PROTECTION_LOSS_BPS,
        DEFAULT_HALT_LOSS_BPS,
        now
      );
    }

    // Seed all enterprise accounts required by Section 8
    const accounts: Array<[string, string, string, number, number]> = [
      ['amm_cash', 'Caixa Operacional Livre (AMM)', 'ASSET', 0, 0],
      ['amm_reserved_cash', 'Caixa Reservado em Ordens (CLOB)', 'ASSET', 0, 0],
      ['amm_protected_reserve', 'Reserva Protegida Intocável (50.000 Kz)', 'ASSET', 0, 1],
      ['amm_positions_sim', 'Posições SIM (Ativo/Custo)', 'ASSET', 0, 0],
      ['amm_positions_no', 'Posições NÃO (Ativo/Custo)', 'ASSET', 0, 0],
      ['amm_collateral', 'Colateral Imobilizado', 'ASSET', 0, 0],
      ['amm_realized_pnl', 'Lucro/Prejuízo Realizado', 'REVENUE', 0, 0],
      ['amm_unrealized_pnl', 'Lucro/Prejuízo Não Realizado', 'REVENUE', 0, 0],
      ['amm_liabilities', 'Obrigações de Liquidação (Passivo)', 'LIABILITY', 0, 0],
      ['amm_company_equity', 'Capital Social Empresarial MercadoAO', 'EQUITY', 0, 0],
    ];

    const insertAcc = db.prepare(`
      INSERT OR IGNORE INTO amm_capital_accounts (account_code, name, account_type, balance_cents, is_protected, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const acc of accounts) {
      insertAcc.run(acc[0], acc[1], acc[2], acc[3], acc[4], now);
    }

    // Check if initial capitalization journal entry exists
    const initEntry = db.prepare(`SELECT id FROM amm_journal_entries WHERE idempotency_key = 'INIT_COMPANY_CAPITAL_250000'`).get();
    if (!initEntry) {
      const entryId = randomUUID();
      db.prepare(`
        INSERT INTO amm_journal_entries (id, idempotency_key, reference_type, reference_id, market_id, description, actor_id, created_at)
        VALUES (?, 'INIT_COMPANY_CAPITAL_250000', 'CAPITAL_CONTRIBUTION', 'CAPITAL_INIT', NULL, 'Aporte inicial de capital empresarial MercadoAO: 200.000 Kz operacionais + 50.000 Kz reserva protegida (Total 250.000 Kz)', 'SYSTEM_INIT', ?)
      `).run(entryId, now);

      const insertLine = db.prepare(`
        INSERT INTO amm_journal_lines (id, entry_id, account_code, debit_cents, credit_cents, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      // Debit Assets (200k cash + 50k protected reserve = 250k)
      insertLine.run(randomUUID(), entryId, 'amm_cash', MAX_ALLOCATION_BUDGET_CENTS, 0, now);
      insertLine.run(randomUUID(), entryId, 'amm_protected_reserve', PROTECTED_RESERVE_CENTS, 0, now);
      // Credit Equity (250k)
      insertLine.run(randomUUID(), entryId, 'amm_company_equity', 0, INITIAL_COMPANY_CAPITAL_CENTS, now);

      // Update account balances (Assets: +debit -credit; Equity/Liability/Revenue: +credit -debit or signed net)
      // Store signed balances where Debit-normal (ASSET, EXPENSE) = +debit -credit, Credit-normal (LIABILITY, EQUITY, REVENUE) = +credit -debit
      db.prepare(`UPDATE amm_capital_accounts SET balance_cents = ?, updated_at = ? WHERE account_code = 'amm_cash'`).run(MAX_ALLOCATION_BUDGET_CENTS, now);
      db.prepare(`UPDATE amm_capital_accounts SET balance_cents = ?, updated_at = ? WHERE account_code = 'amm_protected_reserve'`).run(PROTECTED_RESERVE_CENTS, now);
      db.prepare(`UPDATE amm_capital_accounts SET balance_cents = ?, updated_at = ? WHERE account_code = 'amm_company_equity'`).run(INITIAL_COMPANY_CAPITAL_CENTS, now);
    }

    // Seed global risk limits
    const globalLimit = db.prepare(`SELECT id FROM amm_risk_limits WHERE id = 'GLOBAL_DEFAULT'`).get();
    if (!globalLimit) {
      db.prepare(`
        INSERT INTO amm_risk_limits (
          id, scope, market_id, warning_loss_bps, protection_loss_bps, halt_loss_bps,
          max_market_exposure_cents, max_single_order_cents, min_spread_bps, updated_by, justification, updated_at
        ) VALUES ('GLOBAL_DEFAULT', 'GLOBAL', NULL, 300, 400, 500, 5000000, 1500000, 200, 'SYSTEM_INIT', 'Configuração inicial obrigatória: 5% perda máxima, 3% alerta, 4% proteção', ?)
      `).run(now);
    }

    // Seed initial PnL snapshot if empty
    const pnlCount = db.prepare(`SELECT COUNT(*) as c FROM amm_pnl`).get() as { c: number };
    if (pnlCount.c === 0) {
      db.prepare(`
        INSERT INTO amm_pnl (
          id, market_id, company_capital_cents, available_cash_cents, allocated_capital_cents,
          protected_reserve_cents, reserved_cash_cents, positions_sim_value_cents, positions_no_value_cents,
          exposure_cents, liabilities_cents, realized_pnl_cents, unrealized_pnl_cents, current_loss_cents,
          utilization_pct, created_at
        ) VALUES (?, NULL, ?, ?, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0.0, ?)
      `).run(randomUUID(), INITIAL_COMPANY_CAPITAL_CENTS, MAX_ALLOCATION_BUDGET_CENTS, PROTECTED_RESERVE_CENTS, now);
    }
  });

  tx();
}

export function nextClobSeq(db: AmmDatabase): number {
  db.prepare(`UPDATE clob_seq SET val = val + 1 WHERE id = 1`).run();
  const row = db.prepare(`SELECT val FROM clob_seq WHERE id = 1`).get() as { val: number };
  return row.val;
}
