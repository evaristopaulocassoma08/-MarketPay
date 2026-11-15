import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { AmmDatabase } from '../db';
import {
  AuthenticatedRequest,
  rateLimit,
  requireAdminMiddleware,
  requireMasterAdminMiddleware,
  verifyFirebaseRequest,
} from '../auth';
import { getAccountsMap, reconcileAccounts } from '../accounting';
import { getOrderBook, reconcileUserClobBalance } from '../clobEngine';
import { writeSecurityAudit } from '../adminControls';
import { createFirestoreDoc, patchFirestoreFields } from '../firestoreSync';
import { getLatencySeries, getRecentErrors, probeSystemHealth } from '../healthMonitor';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

interface PeriodBounds {
  fromMs: number;
  toMs: number;
  fromIso: string;
  toIso: string;
  prevFromIso: string;
  prevToIso: string;
  granularity: 'hour' | 'day' | 'month';
}

function resolvePeriodBounds(query: Record<string, any>): PeriodBounds {
  const now = new Date();
  const period = String(query.period || '7d');
  let toDate = query.to ? new Date(String(query.to)) : now;
  if (isNaN(toDate.getTime())) toDate = now;
  // If custom date string YYYY-MM-DD, include entire end day
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to))) {
    toDate = new Date(`${query.to}T23:59:59.999Z`);
  }

  let fromDate: Date;
  let granularity: 'hour' | 'day' | 'month' = 'day';

  if (period === 'today') {
    fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    granularity = 'hour';
  } else if (period === '24h') {
    fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    granularity = 'hour';
  } else if (period === '7d') {
    fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    granularity = 'day';
  } else if (period === '30d') {
    fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    granularity = 'day';
  } else if (period === '90d') {
    fromDate = new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    granularity = 'day';
  } else if (period === 'year') {
    fromDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    granularity = 'month';
  } else if (period === 'custom' && query.from) {
    const parsedFrom = new Date(String(query.from));
    fromDate = isNaN(parsedFrom.getTime()) ? new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000) : parsedFrom;
    const spanHours = (toDate.getTime() - fromDate.getTime()) / (60 * 60 * 1000);
    granularity = spanHours <= 48 ? 'hour' : spanHours > 120 * 24 ? 'month' : 'day';
  } else {
    fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    granularity = 'day';
  }

  const spanMs = Math.max(60_000, toDate.getTime() - fromDate.getTime());
  const prevToDate = new Date(fromDate.getTime() - 1);
  const prevFromDate = new Date(prevToDate.getTime() - spanMs);

  return {
    fromMs: fromDate.getTime(),
    toMs: toDate.getTime(),
    fromIso: fromDate.toISOString(),
    toIso: toDate.toISOString(),
    prevFromIso: prevFromDate.toISOString(),
    prevToIso: prevToDate.toISOString(),
    granularity,
  };
}

function getBucketKeyAndLabel(isoStr: string, granularity: 'hour' | 'day' | 'month'): { key: string; label: string } {
  const d = new Date(isoStr);
  if (granularity === 'hour') {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
    const label = `${String(d.getHours()).padStart(2, '0')}:00`;
    return { key, label };
  }
  if (granularity === 'month') {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return { key, label };
  }
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { key, label };
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function decodeFirestoreField(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(decodeFirestoreField);
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      out[k] = decodeFirestoreField(v);
    }
    return out;
  }
  return null;
}

async function listFirestoreUsersViaToken(idToken: string): Promise<any[]> {
  const users: any[] = [];
  let pageToken = '';
  for (let i = 0; i < 5; i++) {
    const qs = new URLSearchParams({ pageSize: '200' });
    if (pageToken) qs.set('pageToken', pageToken);
    const resp = await fetch(`${FIRESTORE_BASE}/users?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) {
      throw new Error(`Falha ao consultar coleção users no Firestore (HTTP ${resp.status}).`);
    }
    const json = (await resp.json()) as any;
    for (const doc of json.documents || []) {
      const docId = String(doc.name || '').split('/').pop() || '';
      const out: Record<string, any> = { id: docId };
      for (const [k, v] of Object.entries(doc.fields || {})) {
        out[k] = decodeFirestoreField(v);
      }
      users.push(out);
    }
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return users;
}

export function createAdminAnalyticsRouter(db: AmmDatabase): Router {
  const router = Router();

  // --- 1. VERIFIED ACTOR & PERMISSION LEVEL ---
  router.get('/admin/actor', verifyFirebaseRequest, requireAdminMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({
      uid: req.actor!.uid,
      email: req.actor!.email,
      role: req.actor!.role,
      isMasterAdmin: req.actor!.role === 'MASTER_ADMIN',
    });
  });

  // --- 2. PUBLIC REAL OHLCV CANDLESTICKS FROM CLOB EXECUTIONS ---
  router.get('/clob/candles/:marketId', rateLimit(90, 10_000), (req, res) => {
    try {
      const marketId = req.params.marketId;
      const outcome = req.query.outcome === 'No' ? 'No' : 'Yes';
      const interval = String(req.query.interval || '1h');
      const intervalMs =
        interval === '5m'
          ? 5 * 60_000
          : interval === '15m'
            ? 15 * 60_000
            : interval === '4h'
              ? 4 * 60 * 60_000
              : interval === '1d'
                ? 24 * 60 * 60_000
                : 60 * 60_000;

      const rows = db
        .prepare(
          `SELECT outcome, price_cents, quantity, notional_cents, created_at
           FROM clob_executions
           WHERE market_id = ?
           ORDER BY created_at ASC
           LIMIT 2000`
        )
        .all(marketId) as Array<{
        outcome: 'Yes' | 'No';
        price_cents: number;
        quantity: number;
        notional_cents: number;
        created_at: string;
      }>;

      if (rows.length === 0) {
        res.json({ marketId, outcome, interval, candles: [] });
        return;
      }

      const buckets = new Map<
        number,
        { bucketTs: number; open: number; high: number; low: number; close: number; volumeKz: number; trades: number }
      >();

      for (const r of rows) {
        const ts = new Date(r.created_at).getTime();
        if (isNaN(ts)) continue;
        const bucketTs = Math.floor(ts / intervalMs) * intervalMs;
        // Convert binary fill price strictly to requested outcome cents
        const priceCents = r.outcome === outcome ? r.price_cents : 100 - r.price_cents;
        const clamped = Math.max(1, Math.min(99, priceCents));
        const volKz = r.notional_cents / 100;

        const existing = buckets.get(bucketTs);
        if (!existing) {
          buckets.set(bucketTs, {
            bucketTs,
            open: clamped,
            high: clamped,
            low: clamped,
            close: clamped,
            volumeKz: Number(volKz.toFixed(2)),
            trades: 1,
          });
        } else {
          existing.high = Math.max(existing.high, clamped);
          existing.low = Math.min(existing.low, clamped);
          existing.close = clamped;
          existing.volumeKz = Number((existing.volumeKz + volKz).toFixed(2));
          existing.trades += 1;
        }
      }

      const candles = Array.from(buckets.values())
        .sort((a, b) => a.bucketTs - b.bucketTs)
        .map((c) => ({
          timestamp: new Date(c.bucketTs).toISOString(),
          time:
            interval === '1d'
              ? new Date(c.bucketTs).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
              : new Date(c.bucketTs).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volumeKz: c.volumeKz,
          trades: c.trades,
          isUp: c.close >= c.open,
        }));

      res.json({ marketId, outcome, interval, candles });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao calcular velas OHLCV.' });
    }
  });

  // --- 3. EXECUTIVE DASHBOARD OVERVIEW (ADMIN + MASTER ADMIN) ---
  router.get(
    '/admin/dashboard/overview',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(60, 10_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const bounds = resolvePeriodBounds(req.query as Record<string, any>);

        const curExecs = db
          .prepare(
            `SELECT e.id, e.market_id, e.maker_user_id, e.taker_user_id, e.outcome, e.price_cents, e.quantity, e.notional_cents, e.fee_cents, e.created_at,
                    a.market_question
             FROM clob_executions e
             LEFT JOIN amm_market_allocations a ON e.market_id = a.market_id
             WHERE e.created_at >= ? AND e.created_at <= ?
             ORDER BY e.created_at ASC`
          )
          .all(bounds.fromIso, bounds.toIso) as any[];

        const prevExecStats = db
          .prepare(
            `SELECT COALESCE(SUM(notional_cents), 0) AS vol_cents,
                    COALESCE(SUM(fee_cents), 0) AS fee_cents,
                    COUNT(*) AS trades_count
             FROM clob_executions
             WHERE created_at >= ? AND created_at <= ?`
          )
          .get(bounds.prevFromIso, bounds.prevToIso) as { vol_cents: number; fee_cents: number; trades_count: number };

        const curOrders = db
          .prepare(
            `SELECT status, side, is_amm, user_id, created_at
             FROM clob_orders
             WHERE created_at >= ? AND created_at <= ?
             ORDER BY created_at ASC`
          )
          .all(bounds.fromIso, bounds.toIso) as any[];

        const liveOpenOrdersCount = (
          db.prepare(`SELECT COUNT(*) AS c FROM clob_orders WHERE status IN ('OPEN', 'PARTIAL')`).get() as any
        ).c;

        const executedVolumeCents = curExecs.reduce((s, r) => s + (r.notional_cents || 0), 0);
        const feesCollectedCents = curExecs.reduce((s, r) => s + (r.fee_cents || 0), 0);

        // Volume & Fees time series strictly from executed trades
        const volBucketMap = new Map<
          string,
          { key: string; label: string; volumeKz: number; feesKz: number; trades: number; humanTrades: number; botTrades: number }
        >();

        let humanExecutionsCount = 0;
        let botExecutionsCount = 0;
        let ammExecutionsCount = 0;

        const marketTotals = new Map<
          string,
          { marketId: string; marketQuestion: string; volumeCents: number; feesCents: number; tradesCount: number }
        >();

        for (const e of curExecs) {
          const { key, label } = getBucketKeyAndLabel(e.created_at, bounds.granularity);
          const cur = volBucketMap.get(key) || {
            key,
            label,
            volumeKz: 0,
            feesKz: 0,
            trades: 0,
            humanTrades: 0,
            botTrades: 0,
          };
          cur.volumeKz = Number((cur.volumeKz + (e.notional_cents || 0) / 100).toFixed(2));
          cur.feesKz = Number((cur.feesKz + (e.fee_cents || 0) / 100).toFixed(2));
          cur.trades += 1;

          const isBot =
            String(e.taker_user_id || '').startsWith('bot_') || String(e.maker_user_id || '').startsWith('bot_');
          const isAmm =
            e.taker_user_id === 'AMM_MERCADOAO_COMPANY' || e.maker_user_id === 'AMM_MERCADOAO_COMPANY';
          if (isAmm) ammExecutionsCount += 1;
          if (isBot) {
            botExecutionsCount += 1;
            cur.botTrades += 1;
          } else {
            humanExecutionsCount += 1;
            cur.humanTrades += 1;
          }
          volBucketMap.set(key, cur);

          const mAgg = marketTotals.get(e.market_id) || {
            marketId: e.market_id,
            marketQuestion: e.market_question || e.market_id,
            volumeCents: 0,
            feesCents: 0,
            tradesCount: 0,
          };
          mAgg.volumeCents += e.notional_cents || 0;
          mAgg.feesCents += e.fee_cents || 0;
          mAgg.tradesCount += 1;
          marketTotals.set(e.market_id, mAgg);
        }

        // Order activity series
        const orderBucketMap = new Map<
          string,
          { key: string; label: string; created: number; filled: number; cancelled: number; rejected: number }
        >();
        for (const o of curOrders) {
          const { key, label } = getBucketKeyAndLabel(o.created_at, bounds.granularity);
          const cur = orderBucketMap.get(key) || { key, label, created: 0, filled: 0, cancelled: 0, rejected: 0 };
          cur.created += 1;
          if (o.status === 'FILLED' || o.status === 'PARTIAL') cur.filled += 1;
          if (o.status === 'CANCELLED') cur.cancelled += 1;
          if (o.status === 'REJECTED') cur.rejected += 1;
          orderBucketMap.set(key, cur);
        }

        // Real alerts
        const settings = db.prepare(`SELECT * FROM amm_settings WHERE id = 1`).get() as any;
        const reconciliation = reconcileAccounts(db);
        const riskAlerts = db
          .prepare(
            `SELECT id, market_id, new_state, loss_bps, trigger_reason, created_at
             FROM amm_risk_events
             WHERE acknowledged_by IS NULL
             ORDER BY created_at DESC LIMIT 15`
          )
          .all() as any[];
        const pendingAllocations = db
          .prepare(`SELECT market_id, market_question, allocated_capital_cents, created_at FROM amm_market_allocations WHERE status = 'PENDING'`)
          .all() as any[];
        const rejectedRecent = db
          .prepare(`SELECT COUNT(*) AS c FROM clob_orders WHERE status = 'REJECTED' AND created_at >= ?`)
          .get(bounds.fromIso) as { c: number };

        const alerts: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; detail: string; timestamp: string }> = [];

        if (settings?.emergency_halted === 1) {
          alerts.push({
            id: 'alert_emergency_halt',
            severity: 'critical',
            title: 'Paragem de Emergência Global Ativa',
            detail: 'O fornecedor automático AMM foi travado. Investigação formal do Master Admin necessária.',
            timestamp: settings.updated_at,
          });
        }
        if (!reconciliation.protectedReserveIntact) {
          alerts.push({
            id: 'alert_protected_reserve',
            severity: 'critical',
            title: 'Violação da Reserva Protegida (50.000 Kz)',
            detail: 'A reserva intocável empresarial está abaixo do mínimo exigido.',
            timestamp: new Date().toISOString(),
          });
        }
        if (!reconciliation.reconciled) {
          alerts.push({
            id: 'alert_accounting_mismatch',
            severity: 'critical',
            title: 'Divergência Contabilística Detetada',
            detail: `Diferença de ${(reconciliation.discrepancyCents / 100).toFixed(2)} Kz entre ativos e passivo+capital.`,
            timestamp: new Date().toISOString(),
          });
        }
        for (const ra of riskAlerts) {
          alerts.push({
            id: `risk_${ra.id}`,
            severity: ra.new_state === 'HALTED' || ra.new_state === 'EMERGENCY_HALT' ? 'critical' : 'warning',
            title: `Risco ${ra.new_state} — ${ra.market_id}`,
            detail: `${ra.trigger_reason} (${(ra.loss_bps / 100).toFixed(2)}%)`,
            timestamp: ra.created_at,
          });
        }
        if (pendingAllocations.length > 0) {
          alerts.push({
            id: 'alert_pending_allocs',
            severity: 'info',
            title: `${pendingAllocations.length} Alocação(ões) AMM Pendente(s)`,
            detail: 'Aguarda aprovação ou rejeição pelo Master Admin.',
            timestamp: pendingAllocations[0].created_at,
          });
        }
        if (rejectedRecent.c > 0) {
          alerts.push({
            id: 'alert_rejected_orders',
            severity: 'warning',
            title: `${rejectedRecent.c} Ordem(ns) CLOB Rejeitada(s) no Período`,
            detail: 'Verifique ordens rejeitadas no livro CLOB.',
            timestamp: new Date().toISOString(),
          });
        }
        const recentApiErrors = getRecentErrors(5);
        if (recentApiErrors.length > 0) {
          alerts.push({
            id: 'alert_api_errors',
            severity: 'warning',
            title: `${recentApiErrors.length} Erro(s) HTTP 5xx Recente(s)`,
            detail: recentApiErrors[0].errorMessage || 'Consulte System Health para detalhes.',
            timestamp: recentApiErrors[0].timestamp,
          });
        }

        res.json({
          generatedAt: new Date().toISOString(),
          period: {
            fromIso: bounds.fromIso,
            toIso: bounds.toIso,
            granularity: bounds.granularity,
          },
          kpis: {
            executedVolumeKz: Number((executedVolumeCents / 100).toFixed(2)),
            executedVolumeDeltaPct: calcDeltaPct(executedVolumeCents, prevExecStats.vol_cents),
            feesCollectedKz: Number((feesCollectedCents / 100).toFixed(2)),
            feesDeltaPct: calcDeltaPct(feesCollectedCents, prevExecStats.fee_cents),
            executionsCount: curExecs.length,
            executionsDeltaPct: calcDeltaPct(curExecs.length, prevExecStats.trades_count),
            openClobOrdersCount: liveOpenOrdersCount,
            periodOrdersCount: curOrders.length,
          },
          participation: {
            humanExecutionsCount,
            botExecutionsCount,
            ammExecutionsCount,
            totalExecutionsCount: curExecs.length,
          },
          volumeSeries: Array.from(volBucketMap.values()).sort((a, b) => a.key.localeCompare(b.key)),
          orderActivitySeries: Array.from(orderBucketMap.values()).sort((a, b) => a.key.localeCompare(b.key)),
          topMarkets: Array.from(marketTotals.values())
            .sort((a, b) => b.volumeCents - a.volumeCents)
            .slice(0, 8)
            .map((m) => ({
              marketId: m.marketId,
              marketQuestion: m.marketQuestion,
              volumeKz: Number((m.volumeCents / 100).toFixed(2)),
              feesKz: Number((m.feesCents / 100).toFixed(2)),
              tradesCount: m.tradesCount,
            })),
          alerts,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao carregar resumo executivo.' });
      }
    }
  );

  // --- 4. CLOB CONTROL CENTER & ORDERBOOK OVERVIEW ---
  router.get(
    '/admin/clob/overview',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(60, 10_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const bounds = resolvePeriodBounds(req.query as Record<string, any>);
        const marketId = req.query.marketId ? String(req.query.marketId) : '';
        const status = req.query.status ? String(req.query.status) : '';
        const side = req.query.side ? String(req.query.side) : '';
        const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(5, Number(req.query.limit || 25)));
        const offset = (page - 1) * limit;

        const whereParts: string[] = ['o.created_at >= ?', 'o.created_at <= ?'];
        const whereArgs: any[] = [bounds.fromIso, bounds.toIso];
        if (marketId) {
          whereParts.push('o.market_id = ?');
          whereArgs.push(marketId);
        }
        if (status) {
          whereParts.push('o.status = ?');
          whereArgs.push(status);
        }
        if (side) {
          whereParts.push('o.side = ?');
          whereArgs.push(side);
        }
        if (search) {
          whereParts.push('(LOWER(o.id) LIKE ? OR LOWER(o.user_id) LIKE ? OR LOWER(o.market_id) LIKE ?)');
          whereArgs.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereSql = whereParts.join(' AND ');

        const summary = db
          .prepare(
            `SELECT
               COUNT(*) AS total_orders,
               SUM(CASE WHEN o.status = 'OPEN' THEN 1 ELSE 0 END) AS open_orders,
               SUM(CASE WHEN o.status = 'PARTIAL' THEN 1 ELSE 0 END) AS partial_orders,
               SUM(CASE WHEN o.status = 'FILLED' THEN 1 ELSE 0 END) AS filled_orders,
               SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_orders,
               SUM(CASE WHEN o.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_orders,
               SUM(CASE WHEN o.side = 'Buy' THEN 1 ELSE 0 END) AS buy_orders,
               SUM(CASE WHEN o.side = 'Sell' THEN 1 ELSE 0 END) AS sell_orders
             FROM clob_orders o
             WHERE ${whereSql}`
          )
          .get(...whereArgs) as any;

        const orders = db
          .prepare(
            `SELECT o.*, a.market_question
             FROM clob_orders o
             LEFT JOIN amm_market_allocations a ON o.market_id = a.market_id
             WHERE ${whereSql}
             ORDER BY o.seq DESC
             LIMIT ? OFFSET ?`
          )
          .all(...whereArgs, limit, offset) as any[];

        const execWhereParts: string[] = ['e.created_at >= ?', 'e.created_at <= ?'];
        const execArgs: any[] = [bounds.fromIso, bounds.toIso];
        if (marketId) {
          execWhereParts.push('e.market_id = ?');
          execArgs.push(marketId);
        }
        if (search) {
          execWhereParts.push('(LOWER(e.id) LIKE ? OR LOWER(e.maker_user_id) LIKE ? OR LOWER(e.taker_user_id) LIKE ? OR LOWER(e.market_id) LIKE ?)');
          execArgs.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        const execWhereSql = execWhereParts.join(' AND ');

        const execTotals = db
          .prepare(
            `SELECT COUNT(*) AS count, COALESCE(SUM(e.notional_cents), 0) AS volume_cents, COALESCE(SUM(e.fee_cents), 0) AS fees_cents
             FROM clob_executions e
             WHERE ${execWhereSql}`
          )
          .get(...execArgs) as { count: number; volume_cents: number; fees_cents: number };

        const executions = db
          .prepare(
            `SELECT e.*, a.market_question
             FROM clob_executions e
             LEFT JOIN amm_market_allocations a ON e.market_id = a.market_id
             WHERE ${execWhereSql}
             ORDER BY e.created_at DESC
             LIMIT ? OFFSET ?`
          )
          .all(...execArgs, limit, offset) as any[];

        // Activity time-series
        const allExecsForSeries = db
          .prepare(`SELECT notional_cents, fee_cents, created_at FROM clob_executions WHERE ${execWhereSql.replaceAll('e.', '')} ORDER BY created_at ASC`)
          .all(...execArgs) as any[];
        const seriesMap = new Map<string, { key: string; label: string; executions: number; volumeKz: number; feesKz: number }>();
        for (const ex of allExecsForSeries) {
          const { key, label } = getBucketKeyAndLabel(ex.created_at, bounds.granularity);
          const cur = seriesMap.get(key) || { key, label, executions: 0, volumeKz: 0, feesKz: 0 };
          cur.executions += 1;
          cur.volumeKz = Number((cur.volumeKz + (ex.notional_cents || 0) / 100).toFixed(2));
          cur.feesKz = Number((cur.feesKz + (ex.fee_cents || 0) / 100).toFixed(2));
          seriesMap.set(key, cur);
        }

        const orderBook = marketId ? getOrderBook(db, marketId) : null;

        res.json({
          generatedAt: new Date().toISOString(),
          page,
          limit,
          totalOrders: summary?.total_orders || 0,
          totalExecutions: execTotals.count,
          kpis: {
            totalOrders: summary?.total_orders || 0,
            openOrders: summary?.open_orders || 0,
            partialOrders: summary?.partial_orders || 0,
            filledOrders: summary?.filled_orders || 0,
            cancelledOrders: summary?.cancelled_orders || 0,
            rejectedOrders: summary?.rejected_orders || 0,
            buyOrders: summary?.buy_orders || 0,
            sellOrders: summary?.sell_orders || 0,
            executedVolumeKz: Number((execTotals.volume_cents / 100).toFixed(2)),
            totalFeesKz: Number((execTotals.fees_cents / 100).toFixed(2)),
            executionsCount: execTotals.count,
          },
          distribution: [
            { name: 'Compra', value: summary?.buy_orders || 0 },
            { name: 'Venda', value: summary?.sell_orders || 0 },
            { name: 'Executadas', value: summary?.filled_orders || 0 },
            { name: 'Abertas', value: (summary?.open_orders || 0) + (summary?.partial_orders || 0) },
            { name: 'Canceladas', value: summary?.cancelled_orders || 0 },
            { name: 'Rejeitadas', value: summary?.rejected_orders || 0 },
          ],
          activitySeries: Array.from(seriesMap.values()).sort((a, b) => a.key.localeCompare(b.key)),
          orders,
          executions,
          orderBook,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao carregar controlo CLOB.' });
      }
    }
  );

  // --- 5. PROFIT & LOSS (EXCLUDES USER DEPOSITS AND COMPANY CAPITAL) ---
  router.get(
    '/admin/pnl',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(60, 10_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const bounds = resolvePeriodBounds(req.query as Record<string, any>);
        const marketId = req.query.marketId ? String(req.query.marketId) : '';
        const source = req.query.source ? String(req.query.source) : 'all'; // all | fees | amm

        const execWhere = marketId
          ? `WHERE created_at >= ? AND created_at <= ? AND market_id = ?`
          : `WHERE created_at >= ? AND created_at <= ?`;
        const execArgs = marketId ? [bounds.fromIso, bounds.toIso, marketId] : [bounds.fromIso, bounds.toIso];

        const executions = db
          .prepare(`SELECT market_id, notional_cents, fee_cents, created_at FROM clob_executions ${execWhere} ORDER BY created_at ASC`)
          .all(...execArgs) as any[];

        const ammTrades = db
          .prepare(`SELECT market_id, notional_cents, fee_cents, realized_pnl_cents, created_at FROM amm_trades ${execWhere} ORDER BY created_at ASC`)
          .all(...execArgs) as any[];

        // Current unrealized & realized AMM inventory snapshot
        const invRows = db
          .prepare(
            `SELECT i.market_id, i.realized_pnl_cents, i.unrealized_pnl_cents, a.market_question
             FROM amm_inventory i
             LEFT JOIN amm_market_allocations a ON i.market_id = a.market_id`
          )
          .all() as any[];

        // Market creation / explicit operational expense journal lines in period
        const expenseRow = db
          .prepare(
            `SELECT COALESCE(SUM(l.debit_cents - l.credit_cents), 0) AS net_exp_cents
             FROM amm_journal_lines l
             JOIN amm_capital_accounts c ON l.account_code = c.account_code
             WHERE c.account_type = 'EXPENSE' AND l.created_at >= ? AND l.created_at <= ?`
          )
          .get(bounds.fromIso, bounds.toIso) as { net_exp_cents: number };

        // User deposit totals shown ONLY as explicit non-revenue informational separation
        const depositInfo = db
          .prepare(
            `SELECT COALESCE(SUM(CASE WHEN op_type = 'deposit' THEN amount_cents ELSE 0 END), 0) AS deposits_cents,
                    COALESCE(SUM(CASE WHEN op_type = 'withdrawal' THEN amount_cents ELSE 0 END), 0) AS withdrawals_cents
             FROM applied_finance_ops
             WHERE created_at >= ? AND created_at <= ?`
          )
          .get(bounds.fromIso, bounds.toIso) as { deposits_cents: number; withdrawals_cents: number };

        const accounts = getAccountsMap(db);
        const seriesMap = new Map<
          string,
          { key: string; label: string; feeRevenueKz: number; ammRealizedKz: number; operationalCostsKz: number; netProfitKz: number; cumulativeProfitKz: number }
        >();

        let totalFeesCents = 0;
        let totalVolumeCents = 0;
        let totalAmmRealizedCents = 0;
        const marketMap = new Map<
          string,
          { marketId: string; marketQuestion: string; volumeCents: number; feesCents: number; ammRealizedCents: number; ammUnrealizedCents: number; trades: number }
        >();

        for (const r of invRows) {
          if (marketId && r.market_id !== marketId) continue;
          marketMap.set(r.market_id, {
            marketId: r.market_id,
            marketQuestion: r.market_question || r.market_id,
            volumeCents: 0,
            feesCents: 0,
            ammRealizedCents: 0,
            ammUnrealizedCents: r.unrealized_pnl_cents || 0,
            trades: 0,
          });
        }

        if (source === 'all' || source === 'fees') {
          for (const e of executions) {
            totalFeesCents += e.fee_cents || 0;
            totalVolumeCents += e.notional_cents || 0;
            const { key, label } = getBucketKeyAndLabel(e.created_at, bounds.granularity);
            const cur = seriesMap.get(key) || {
              key,
              label,
              feeRevenueKz: 0,
              ammRealizedKz: 0,
              operationalCostsKz: 0,
              netProfitKz: 0,
              cumulativeProfitKz: 0,
            };
            cur.feeRevenueKz = Number((cur.feeRevenueKz + (e.fee_cents || 0) / 100).toFixed(2));
            cur.netProfitKz = Number((cur.feeRevenueKz + cur.ammRealizedKz - cur.operationalCostsKz).toFixed(2));
            seriesMap.set(key, cur);

            const m = marketMap.get(e.market_id) || {
              marketId: e.market_id,
              marketQuestion: e.market_id,
              volumeCents: 0,
              feesCents: 0,
              ammRealizedCents: 0,
              ammUnrealizedCents: 0,
              trades: 0,
            };
            m.volumeCents += e.notional_cents || 0;
            m.feesCents += e.fee_cents || 0;
            m.trades += 1;
            marketMap.set(e.market_id, m);
          }
        }

        if (source === 'all' || source === 'amm') {
          for (const t of ammTrades) {
            totalAmmRealizedCents += t.realized_pnl_cents || 0;
            const { key, label } = getBucketKeyAndLabel(t.created_at, bounds.granularity);
            const cur = seriesMap.get(key) || {
              key,
              label,
              feeRevenueKz: 0,
              ammRealizedKz: 0,
              operationalCostsKz: 0,
              netProfitKz: 0,
              cumulativeProfitKz: 0,
            };
            cur.ammRealizedKz = Number((cur.ammRealizedKz + (t.realized_pnl_cents || 0) / 100).toFixed(2));
            cur.netProfitKz = Number((cur.feeRevenueKz + cur.ammRealizedKz - cur.operationalCostsKz).toFixed(2));
            seriesMap.set(key, cur);

            const m = marketMap.get(t.market_id) || {
              marketId: t.market_id,
              marketQuestion: t.market_id,
              volumeCents: 0,
              feesCents: 0,
              ammRealizedCents: 0,
              ammUnrealizedCents: 0,
              trades: 0,
            };
            m.ammRealizedCents += t.realized_pnl_cents || 0;
            marketMap.set(t.market_id, m);
          }
        }

        const sortedSeries = Array.from(seriesMap.values()).sort((a, b) => a.key.localeCompare(b.key));
        let running = 0;
        for (const item of sortedSeries) {
          running = Number((running + item.netProfitKz).toFixed(2));
          item.cumulativeProfitKz = running;
        }

        const operationalCostsCents = Math.max(0, expenseRow?.net_exp_cents || 0);
        const totalAmmUnrealizedCents = invRows
          .filter((r) => !marketId || r.market_id === marketId)
          .reduce((s, r) => s + (r.unrealized_pnl_cents || 0), 0);
        const netRealizedProfitCents = totalFeesCents + totalAmmRealizedCents - operationalCostsCents;

        res.json({
          generatedAt: new Date().toISOString(),
          summary: {
            clobFeesKz: Number((totalFeesCents / 100).toFixed(2)),
            ammRealizedPnlKz: Number((totalAmmRealizedCents / 100).toFixed(2)),
            ammUnrealizedPnlKz: Number((totalAmmUnrealizedCents / 100).toFixed(2)),
            operationalCostsKz: Number((operationalCostsCents / 100).toFixed(2)),
            netPlatformProfitKz: Number((netRealizedProfitCents / 100).toFixed(2)),
            executedVolumeKz: Number((totalVolumeCents / 100).toFixed(2)),
            // Explicit informational exclusions so deposits & company equity are never counted as profit:
            excludedUserDepositsKz: Number((depositInfo.deposits_cents / 100).toFixed(2)),
            excludedUserWithdrawalsKz: Number((depositInfo.withdrawals_cents / 100).toFixed(2)),
            excludedCompanyEquityKz: Number(((accounts.amm_company_equity || 0) / 100).toFixed(2)),
          },
          dailySeries: sortedSeries,
          byMarket: Array.from(marketMap.values())
            .sort((a, b) => b.volumeCents - a.volumeCents)
            .map((m) => ({
              marketId: m.marketId,
              marketQuestion: m.marketQuestion,
              volumeKz: Number((m.volumeCents / 100).toFixed(2)),
              feesKz: Number((m.feesCents / 100).toFixed(2)),
              ammRealizedKz: Number((m.ammRealizedCents / 100).toFixed(2)),
              ammUnrealizedKz: Number((m.ammUnrealizedCents / 100).toFixed(2)),
              netResultKz: Number(((m.feesCents + m.ammRealizedCents) / 100).toFixed(2)),
              trades: m.trades,
            })),
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao calcular Profit & Loss.' });
      }
    }
  );

  // --- 6. RECONCILIATION CENTER (FIRESTORE vs SQLITE + DOUBLE-ENTRY LEDGER) ---
  router.get(
    '/admin/reconciliation/overview',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(30, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const enterprise = reconcileAccounts(db);
        const sqlAccounts = db
          .prepare(`SELECT user_id, available_cents, reserved_cents, last_synced_firestore_balance_cents, updated_at FROM user_clob_accounts`)
          .all() as any[];
        const sqlMap = new Map(sqlAccounts.map((a) => [a.user_id, a]));

        const posRows = db
          .prepare(`SELECT user_id, COUNT(*) AS active_positions, COALESCE(SUM(available_shares + reserved_shares), 0) AS total_shares FROM user_clob_positions WHERE available_shares > 0 OR reserved_shares > 0 GROUP BY user_id`)
          .all() as any[];
        const posMap = new Map(posRows.map((p) => [p.user_id, p]));

        let firestoreUsers: any[] = [];
        let firestoreFetchError: string | null = null;
        try {
          firestoreUsers = await listFirestoreUsersViaToken(req.idToken!);
        } catch (err: any) {
          firestoreFetchError = err?.message || 'Erro ao ler utilizadores do Firestore';
        }

        const seenIds = new Set<string>();
        const rows: any[] = [];

        for (const u of firestoreUsers) {
          seenIds.add(u.id);
          const fsBalCents = Math.round(Number(u.balance || 0) * 100);
          const sql = sqlMap.get(u.id);
          const pos = posMap.get(u.id);
          const sqlAvailableCents = sql ? sql.available_cents : fsBalCents;
          const sqlReservedCents = sql ? sql.reserved_cents : 0;
          const diffCents = sql ? sql.available_cents - fsBalCents : 0;

          let status: 'SINCRONIZADO' | 'PENDENTE' | 'DIVERGENCIA' | 'ERRO' = 'SINCRONIZADO';
          if (!sql) {
            status = 'PENDENTE';
          } else if (sql.available_cents < 0 || sql.reserved_cents < 0) {
            status = 'ERRO';
          } else if (diffCents !== 0 || (sql.last_synced_firestore_balance_cents !== null && sql.last_synced_firestore_balance_cents !== fsBalCents)) {
            status = 'DIVERGENCIA';
          }

          rows.push({
            userId: u.id,
            name: u.name || u.email || u.id,
            email: u.email || '',
            firestoreBalanceKz: Number((fsBalCents / 100).toFixed(2)),
            sqliteAvailableKz: Number((sqlAvailableCents / 100).toFixed(2)),
            sqliteReservedKz: Number((sqlReservedCents / 100).toFixed(2)),
            differenceKz: Number((diffCents / 100).toFixed(2)),
            activePositions: pos?.active_positions || 0,
            totalShares: pos?.total_shares || 0,
            status,
            updatedAt: sql?.updated_at || u.created_at || null,
          });
        }

        for (const sql of sqlAccounts) {
          if (seenIds.has(sql.user_id)) continue;
          const isBotOrAmm = sql.user_id.startsWith('bot_') || sql.user_id === 'AMM_MERCADOAO_COMPANY';
          if (isBotOrAmm) continue;
          rows.push({
            userId: sql.user_id,
            name: sql.user_id,
            email: 'Sem perfil Firestore',
            firestoreBalanceKz: 0,
            sqliteAvailableKz: Number((sql.available_cents / 100).toFixed(2)),
            sqliteReservedKz: Number((sql.reserved_cents / 100).toFixed(2)),
            differenceKz: Number((sql.available_cents / 100).toFixed(2)),
            activePositions: posMap.get(sql.user_id)?.active_positions || 0,
            totalShares: posMap.get(sql.user_id)?.total_shares || 0,
            status: 'ERRO',
            updatedAt: sql.updated_at,
          });
        }

        const counts = {
          synchronized: rows.filter((r) => r.status === 'SINCRONIZADO').length,
          pending: rows.filter((r) => r.status === 'PENDENTE').length,
          divergent: rows.filter((r) => r.status === 'DIVERGENCIA').length,
          errors: rows.filter((r) => r.status === 'ERRO').length,
        };

        res.json({
          generatedAt: new Date().toISOString(),
          firestoreFetchError,
          enterprise,
          counts,
          accounts: rows,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao carregar reconciliação.' });
      }
    }
  );

  router.post(
    '/admin/reconciliation/run',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(10, 30_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const justification = String(req.body?.justification || '').trim();
        if (justification.length < 8) {
          throw new Error('Justificação obrigatória (mínimo 8 caracteres) para executar reconciliação auditada.');
        }

        const firestoreUsers = await listFirestoreUsersViaToken(req.idToken!);
        let syncedCount = 0;
        let divergentFlagged = 0;

        db.transaction(() => {
          for (const u of firestoreUsers) {
            const fsBalCents = Math.round(Number(u.balance || 0) * 100);
            const resSync = reconcileUserClobBalance(db, u.id, fsBalCents);
            if (resSync.availableCents === fsBalCents) {
              syncedCount += 1;
            } else {
              divergentFlagged += 1;
            }
          }
          writeSecurityAudit(db, req.actor!, 'MASTER_RECONCILIATION_RUN', 'GLOBAL_RECONCILIATION', justification, {
            checkedUsers: firestoreUsers.length,
            syncedCount,
            divergentFlagged,
          });
        })();

        await createFirestoreDoc(req.idToken!, 'audit_logs', {
          action: 'MASTER_RECONCILIATION_RUN',
          admin_id: req.actor!.uid,
          details: `Master Admin ${req.actor!.email} executou reconciliação Firestore↔SQLite (${syncedCount} sincronizadas, ${divergentFlagged} divergências assinaladas). Motivo: ${justification}`,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });

        res.json({
          reconciled: true,
          checkedUsers: firestoreUsers.length,
          syncedCount,
          divergentFlagged,
          enterprise: reconcileAccounts(db),
        });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao executar reconciliação.' });
      }
    }
  );

  // --- 7. SYSTEM HEALTH & TELEMETRY ---
  router.get(
    '/admin/system-health',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(30, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const health = await probeSystemHealth(db, req.idToken);
        res.json({
          ...health,
          latencySeries: getLatencySeries(),
          recentErrors: getRecentErrors(30),
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao verificar estado do sistema.' });
      }
    }
  );

  // --- 8. GLOBAL AUDIT & MASTER SECURITY ---
  router.get(
    '/admin/audit-global',
    verifyFirebaseRequest,
    requireAdminMiddleware,
    rateLimit(60, 10_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const actionFilter = req.query.action ? String(req.query.action) : '';
        const limit = Math.min(200, Math.max(10, Number(req.query.limit || 100)));

        const securityAudit = actionFilter
          ? db.prepare(`SELECT * FROM amm_security_audit WHERE action = ? ORDER BY created_at DESC LIMIT ?`).all(actionFilter, limit)
          : db.prepare(`SELECT * FROM amm_security_audit ORDER BY created_at DESC LIMIT ?`).all(limit);

        const approvals = db.prepare(`SELECT * FROM amm_admin_approvals ORDER BY created_at DESC LIMIT ?`).all(limit);
        const riskEvents = db.prepare(`SELECT * FROM amm_risk_events ORDER BY created_at DESC LIMIT ?`).all(limit);

        res.json({
          securityAudit,
          approvals,
          riskEvents,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao carregar auditoria global.' });
      }
    }
  );

  // --- 9. MASTER ADMIN EXCLUSIVE: GRANT/REVOKE OPERATIONAL ADMIN ROLE ---
  router.post(
    '/admin/users/:uid/role',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(15, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const targetUid = req.params.uid;
        const { grantOperationalAdmin, justification } = req.body || {};
        if (!justification || String(justification).trim().length < 5) {
          throw new Error('Justificação obrigatória para alterar privilégios administrativos.');
        }

        const enable = Boolean(grantOperationalAdmin);
        await patchFirestoreFields(
          req.idToken!,
          'users',
          targetUid,
          {
            is_admin: enable,
            role: enable ? 'operational_admin' : 'user',
          },
          true
        );

        writeSecurityAudit(
          db,
          req.actor!,
          enable ? 'GRANT_OPERATIONAL_ADMIN' : 'REVOKE_OPERATIONAL_ADMIN',
          targetUid,
          String(justification).trim(),
          { is_admin: enable }
        );

        await createFirestoreDoc(req.idToken!, 'audit_logs', {
          action: enable ? 'GRANT_OPERATIONAL_ADMIN' : 'REVOKE_OPERATIONAL_ADMIN',
          admin_id: req.actor!.uid,
          details: `Master Admin ${req.actor!.email} ${enable ? 'concedeu' : 'revogou'} acesso Admin Operacional a ${targetUid}. Motivo: ${String(justification).trim()}`,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });

        res.json({ uid: targetUid, is_admin: enable, role: enable ? 'OPERATIONAL_ADMIN' : 'USER' });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao atualizar permissões do utilizador.' });
      }
    }
  );

  // --- 10. MASTER ADMIN EXCLUSIVE: CRITICAL PLATFORM FINANCIAL CONFIG ---
  router.post(
    '/admin/platform-settings',
    verifyFirebaseRequest,
    requireMasterAdminMiddleware,
    rateLimit(15, 10_000),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tradingFee, minDeposit, minWithdrawal, maintenanceMode, platformName, justification } = req.body || {};
        if (!justification || String(justification).trim().length < 5) {
          throw new Error('Justificação obrigatória para alterar configurações financeiras críticas.');
        }

        const fee = Number(tradingFee);
        const minDep = Number(minDeposit);
        const minWd = Number(minWithdrawal);
        if (isNaN(fee) || fee < 0 || fee > 15 || isNaN(minDep) || minDep < 0 || isNaN(minWd) || minWd < 0) {
          throw new Error('Parâmetros financeiros inválidos (taxa entre 0% e 15%, mínimos >= 0).');
        }

        const payload = {
          tradingFee: fee,
          minDeposit: minDep,
          minWithdrawal: minWd,
          maintenanceMode: Boolean(maintenanceMode),
          platformName: String(platformName || 'MercadoAO').trim(),
          updated_at: new Date().toISOString(),
          updated_by: req.actor!.email,
        };

        await patchFirestoreFields(req.idToken!, 'settings', 'platform', payload, true);

        writeSecurityAudit(db, req.actor!, 'UPDATE_PLATFORM_FINANCIAL_CONFIG', 'settings/platform', String(justification).trim(), payload);

        await createFirestoreDoc(req.idToken!, 'audit_logs', {
          action: 'UPDATE_PLATFORM_FINANCIAL_CONFIG',
          admin_id: req.actor!.uid,
          details: `Master Admin ${req.actor!.email} atualizou configuração financeira global: taxa=${fee}%, minDep=${minDep} Kz, minSaq=${minWd} Kz, manutenção=${Boolean(maintenanceMode)}. Motivo: ${String(justification).trim()}`,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        });

        res.json({ updated: true, settings: payload });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao guardar configuração financeira.' });
      }
    }
  );

  return router;
}
