import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { AmmDatabase } from './db';
import { reconcileAccounts } from './accounting';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

export interface ApiMetricSample {
  id: string;
  timestamp: string;
  tsMs: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  errorMessage?: string;
}

const MAX_METRICS = 400;
const MAX_ERRORS = 100;
const metricBuffer: ApiMetricSample[] = [];
const errorBuffer: ApiMetricSample[] = [];
const serverStartedAt = new Date().toISOString();

export function recordApiError(pathStr: string, method: string, status: number, errorMessage: string, durationMs = 0) {
  const now = Date.now();
  const sample: ApiMetricSample = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(now).toISOString(),
    tsMs: now,
    method,
    path: pathStr,
    status,
    durationMs: Number(durationMs.toFixed(2)),
    errorMessage,
  };
  errorBuffer.unshift(sample);
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.length = MAX_ERRORS;
  }
}

export function apiMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    const now = Date.now();
    const sample: ApiMetricSample = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(now).toISOString(),
      tsMs: now,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };
    metricBuffer.push(sample);
    if (metricBuffer.length > MAX_METRICS) {
      metricBuffer.shift();
    }
    if (res.statusCode >= 500) {
      recordApiError(req.path, req.method, res.statusCode, `HTTP ${res.statusCode} em ${req.method} ${req.path}`, durationMs);
    }
  });
  next();
}

export function getLatencySeries(fromMs?: number, toMs?: number) {
  const filtered = metricBuffer.filter((m) => {
    if (fromMs !== undefined && m.tsMs < fromMs) return false;
    if (toMs !== undefined && m.tsMs > toMs) return false;
    return true;
  });

  if (filtered.length === 0) return [];

  const buckets = new Map<string, { label: string; sumMs: number; maxMs: number; count: number; errors: number; ts: number }>();
  for (const m of filtered) {
    const d = new Date(m.tsMs);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}:${String(Math.floor(d.getUTCMinutes() / 5) * 5).padStart(2, '0')}`;
    const label = `${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, '0')}`;
    const existing = buckets.get(key) || { label, sumMs: 0, maxMs: 0, count: 0, errors: 0, ts: m.tsMs };
    existing.sumMs += m.durationMs;
    existing.maxMs = Math.max(existing.maxMs, m.durationMs);
    existing.count += 1;
    if (m.status >= 500) existing.errors += 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.ts - b.ts)
    .map((b) => ({
      time: b.label,
      avgLatencyMs: Number((b.sumMs / b.count).toFixed(2)),
      maxLatencyMs: Number(b.maxMs.toFixed(2)),
      requests: b.count,
      errors: b.errors,
    }));
}

export function getRecentErrors(limit = 30) {
  return errorBuffer.slice(0, limit);
}

export async function probeSystemHealth(db: AmmDatabase, idToken?: string) {
  const checkedAt = new Date().toISOString();

  // 1. SQLite Live Probe
  let sqliteStatus: 'ONLINE' | 'DEGRADED' | 'ERROR' = 'ONLINE';
  let sqliteLatencyMs = 0;
  let sqliteError: string | null = null;
  let walMode = 'unknown';
  let tableCounts = {
    orders: 0,
    openOrders: 0,
    executions: 0,
    journalEntries: 0,
    usersClob: 0,
  };

  try {
    const t0 = process.hrtime.bigint();
    db.prepare(`SELECT 1 AS ok`).get();
    const journalRow = db.prepare(`PRAGMA journal_mode`).get() as any;
    walMode = String(journalRow?.journal_mode || 'unknown');
    tableCounts = {
      orders: (db.prepare(`SELECT COUNT(*) AS c FROM clob_orders`).get() as any).c,
      openOrders: (db.prepare(`SELECT COUNT(*) AS c FROM clob_orders WHERE status IN ('OPEN', 'PARTIAL')`).get() as any).c,
      executions: (db.prepare(`SELECT COUNT(*) AS c FROM clob_executions`).get() as any).c,
      journalEntries: (db.prepare(`SELECT COUNT(*) AS c FROM amm_journal_entries`).get() as any).c,
      usersClob: (db.prepare(`SELECT COUNT(*) AS c FROM user_clob_accounts`).get() as any).c,
    };
    sqliteLatencyMs = Number((Number(process.hrtime.bigint() - t0) / 1_000_000).toFixed(2));
    if (sqliteLatencyMs > 250) sqliteStatus = 'DEGRADED';
  } catch (err: any) {
    sqliteStatus = 'ERROR';
    sqliteError = err?.message || 'Erro ao consultar SQLite';
  }

  // 2. Firebase Auth Probe
  let firebaseAuthStatus: 'ONLINE' | 'DEGRADED' | 'ERROR' | 'UNCHECKED' = 'UNCHECKED';
  let firebaseAuthLatencyMs: number | null = null;
  let firebaseAuthError: string | null = null;
  if (idToken) {
    try {
      const t0 = process.hrtime.bigint();
      const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      firebaseAuthLatencyMs = Number((Number(process.hrtime.bigint() - t0) / 1_000_000).toFixed(2));
      firebaseAuthStatus = resp.ok ? (firebaseAuthLatencyMs > 1500 ? 'DEGRADED' : 'ONLINE') : 'ERROR';
      if (!resp.ok) firebaseAuthError = `HTTP ${resp.status}`;
    } catch (err: any) {
      firebaseAuthStatus = 'ERROR';
      firebaseAuthError = err?.message || 'Falha na ligação Firebase Auth';
    }
  }

  // 3. Firestore Probe
  let firestoreStatus: 'ONLINE' | 'DEGRADED' | 'ERROR' | 'UNCHECKED' = 'UNCHECKED';
  let firestoreLatencyMs: number | null = null;
  let firestoreError: string | null = null;
  if (idToken) {
    try {
      const t0 = process.hrtime.bigint();
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/settings/platform`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
      firestoreLatencyMs = Number((Number(process.hrtime.bigint() - t0) / 1_000_000).toFixed(2));
      firestoreStatus = resp.ok || resp.status === 404 ? (firestoreLatencyMs > 1500 ? 'DEGRADED' : 'ONLINE') : 'ERROR';
      if (!resp.ok && resp.status !== 404) firestoreError = `HTTP ${resp.status}`;
    } catch (err: any) {
      firestoreStatus = 'ERROR';
      firestoreError = err?.message || 'Falha na ligação Firestore';
    }
  }

  // 4. Engines & Accounting State
  const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
  const reconciliation = reconcileAccounts(db);
  const haltedMarketsCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM amm_market_allocations WHERE risk_state = 'HALTED' AND market_resolved = 0`).get() as any
  ).c;
  const warningMarketsCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM amm_market_allocations WHERE risk_state IN ('WARNING', 'PROTECTION') AND market_resolved = 0`).get() as any
  ).c;
  const pendingAllocationsCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM amm_market_allocations WHERE status = 'PENDING'`).get() as any
  ).c;

  const recentWindow = metricBuffer.slice(-50);
  const avgApiLatencyMs =
    recentWindow.length > 0
      ? Number((recentWindow.reduce((s, m) => s + m.durationMs, 0) / recentWindow.length).toFixed(2))
      : null;

  return {
    checkedAt,
    serverStartedAt,
    uptimeSeconds: Math.round(process.uptime()),
    services: [
      {
        id: 'express_api',
        name: 'Express API Server',
        status: sqliteStatus === 'ERROR' ? 'DEGRADED' : 'ONLINE',
        latencyMs: avgApiLatencyMs,
        detail: `${metricBuffer.length} pedidos registados desde o arranque`,
      },
      {
        id: 'sqlite_db',
        name: 'Base de Dados SQLite (WAL)',
        status: sqliteStatus,
        latencyMs: sqliteLatencyMs,
        detail: sqliteError || `Modo ${walMode.toUpperCase()} · ${tableCounts.orders} ordens · ${tableCounts.executions} execuções`,
      },
      {
        id: 'firebase_auth',
        name: 'Firebase Authentication',
        status: firebaseAuthStatus,
        latencyMs: firebaseAuthLatencyMs,
        detail: firebaseAuthError || 'Validação de identidade e tokens Bearer',
      },
      {
        id: 'firestore_sync',
        name: 'Firestore Sync & Dados',
        status: firestoreStatus,
        latencyMs: firestoreLatencyMs,
        detail: firestoreError || `Projeto ${firebaseConfig.projectId}`,
      },
      {
        id: 'clob_engine',
        name: 'Motor CLOB (Livro de Ofertas)',
        status: sqliteStatus === 'ONLINE' ? 'ONLINE' : 'ERROR',
        latencyMs: sqliteLatencyMs,
        detail: `${tableCounts.openOrders} ordens ativas · ${tableCounts.executions} negócios liquidados`,
      },
      {
        id: 'amm_engine',
        name: 'Motor AMM Empresarial',
        status: settings?.emergency_halted === 1 ? 'ERROR' : settings?.amm_enabled === 1 ? 'ONLINE' : 'DEGRADED',
        latencyMs: null,
        detail:
          settings?.emergency_halted === 1
            ? 'PARAGEM DE EMERGÊNCIA ATIVA'
            : settings?.amm_enabled === 1
              ? 'Ativo em Sandbox Controlado'
              : 'Em pausa (desativado pelo Master Admin)',
      },
      {
        id: 'risk_engine',
        name: 'Risk Engine (3% / 4% / 5%)',
        status: haltedMarketsCount > 0 ? 'ERROR' : warningMarketsCount > 0 ? 'DEGRADED' : 'ONLINE',
        latencyMs: null,
        detail:
          haltedMarketsCount > 0
            ? `${haltedMarketsCount} mercado(s) em HALTED`
            : warningMarketsCount > 0
              ? `${warningMarketsCount} mercado(s) em alerta/proteção`
              : 'Todos os mercados dentro dos limites',
      },
      {
        id: 'accounting_engine',
        name: 'Accounting (Partidas Dobradas)',
        status: reconciliation.reconciled ? 'ONLINE' : 'ERROR',
        latencyMs: null,
        detail: reconciliation.reconciled
          ? `Reconciliado · ${tableCounts.journalEntries} lançamentos · Reserva 50.000 Kz intacta`
          : `Divergência detetada: ${reconciliation.discrepancyCents} cêntimos`,
      },
    ],
    queues: {
      pendingAllocations: pendingAllocationsCount,
      openClobOrders: tableCounts.openOrders,
      haltedMarkets: haltedMarketsCount,
      warningMarkets: warningMarketsCount,
      recentServerErrors: errorBuffer.length,
    },
    tableCounts,
    latencySeries: getLatencySeries(),
    recentErrors: getRecentErrors(30),
  };
}
