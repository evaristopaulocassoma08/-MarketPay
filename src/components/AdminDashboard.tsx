import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Category, Market, User } from '../types';
import { firebaseService } from '../lib/firebase-service';
import { ammApi } from '../lib/amm-api';

import {
  AdminAlertItem,
  AdminSectionId,
  AdminShell,
  PeriodFilter,
} from './admin/AdminShell';
import { StatsDashboard } from './admin/StatsDashboard';
import { UsersAndFinancePanel } from './admin/UsersAndFinancePanel';
import { ClobControlPanel } from './admin/ClobControlPanel';
import { FinancialPnlAndRecon } from './admin/FinancialPnlAndRecon';
import { SystemHealthAndSecurity } from './admin/SystemHealthAndSecurity';
import { MarketManager } from './admin/MarketManager';
import { AmmControlCenter } from './admin/AmmControlCenter';
import { BotControlHub } from './admin/BotControlHub';
import { PostManager } from './admin/PostManager';

function resolveClientPeriodBounds(period: PeriodFilter): { fromMs: number; toMs: number; granularity: 'hour' | 'day' | 'month' } {
  const now = new Date();
  let toDate = period.preset === 'custom' && period.to ? new Date(`${period.to}T23:59:59.999Z`) : now;
  if (isNaN(toDate.getTime())) toDate = now;
  let fromDate: Date;
  let granularity: 'hour' | 'day' | 'month' = 'day';

  if (period.preset === 'today') {
    fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    granularity = 'hour';
  } else if (period.preset === '24h') {
    fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    granularity = 'hour';
  } else if (period.preset === '7d') {
    fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    granularity = 'day';
  } else if (period.preset === '30d') {
    fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    granularity = 'day';
  } else if (period.preset === '90d') {
    fromDate = new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    granularity = 'day';
  } else if (period.preset === 'year') {
    fromDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    granularity = 'month';
  } else if (period.preset === 'custom' && period.from) {
    fromDate = new Date(period.from);
    if (isNaN(fromDate.getTime())) fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const spanHours = (toDate.getTime() - fromDate.getTime()) / 3_600_000;
    granularity = spanHours <= 48 ? 'hour' : spanHours > 120 * 24 ? 'month' : 'day';
  } else {
    fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return { fromMs: fromDate.getTime(), toMs: toDate.getTime(), granularity };
}

function formatBucket(isoOrDate: any, granularity: 'hour' | 'day' | 'month'): { key: string; label: string } | null {
  if (!isoOrDate) return null;
  const d = isoOrDate?.seconds ? new Date(isoOrDate.seconds * 1000) : new Date(isoOrDate);
  if (isNaN(d.getTime())) return null;
  if (granularity === 'hour') {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
    return { key, label: `${String(d.getHours()).padStart(2, '0')}:00` };
  }
  if (granularity === 'month') {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { key, label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` };
  }
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { key, label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` };
}

export const AdminDashboard = ({
  user: currentUser,
  markets: initialMarkets,
  trades,
  addToast,
}: {
  user: User | null;
  markets: Market[];
  trades: any[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<AdminSectionId>('admin_overview');
  const [period, setPeriod] = useState<PeriodFilter>({
    preset: '7d',
    from: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  // Backend verified actor role
  const [actorRole, setActorRole] = useState<'MASTER_ADMIN' | 'OPERATIONAL_ADMIN' | 'USER'>('OPERATIONAL_ADMIN');
  const [actorEmail, setActorEmail] = useState<string>(currentUser?.email || '');

  // Firestore & SQLite core states
  const [users, setUsers] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>(initialMarkets);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [allTrades, setAllTrades] = useState<any[]>(trades || []);
  const [sqlAccounts, setSqlAccounts] = useState<any[]>([]);
  const [sqlPositions, setSqlPositions] = useState<any[]>([]);

  const [backendOverview, setBackendOverview] = useState<any>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<'ONLINE' | 'DEGRADED' | 'ERROR' | 'CHECKING'>('CHECKING');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [platformSettings, setPlatformSettings] = useState({
    tradingFee: 2.5,
    minDeposit: 1000,
    minWithdrawal: 5000,
    maintenanceMode: false,
    platformName: 'MercadoAO',
  });

  const fetchAllAdminData = useCallback(async () => {
    setLoading(true);
    setOverviewError(null);
    try {
      const [
        actorRes,
        overviewRes,
        healthRes,
        reconUsersRes,
        fetchedUsers,
        fetchedMarkets,
        fetchedRequests,
        fetchedPosts,
        fetchedCategories,
        fetchedSettings,
        fetchedLogs,
        fetchedTrades,
      ] = await Promise.all([
        ammApi.getAdminActor().catch(() => null),
        ammApi.getDashboardOverview({ period: period.preset, from: period.from, to: period.to }).catch((e) => ({ __err: e?.message || 'Erro' })),
        ammApi.getSystemHealth().catch(() => null),
        ammApi.getUsersReconciliation().catch(() => ({ accounts: [], positions: [] })),
        firebaseService.getUsers().catch(() => []),
        firebaseService.getMarkets().catch(() => []),
        firebaseService.getFinanceRequests().catch(() => []),
        firebaseService.getPosts().catch(() => []),
        firebaseService.getCategories().catch(() => []),
        firebaseService.getPlatformSettings().catch(() => null),
        firebaseService.getAuditLogs(60).catch(() => []),
        firebaseService.getTrades(2000).catch(() => []),
      ]);

      if (actorRes?.role) {
        setActorRole(actorRes.role);
        setActorEmail(actorRes.email || currentUser?.email || '');
      }

      if (overviewRes?.__err) {
        setOverviewError(overviewRes.__err);
        setBackendOverview(null);
      } else {
        setBackendOverview(overviewRes);
      }

      if (healthRes?.services) {
        const hasError = healthRes.services.some((s: any) => s.status === 'ERROR');
        const hasDeg = healthRes.services.some((s: any) => s.status === 'DEGRADED');
        setSystemStatus(hasError ? 'ERROR' : hasDeg ? 'DEGRADED' : 'ONLINE');
      } else {
        setSystemStatus('DEGRADED');
      }

      setSqlAccounts(reconUsersRes?.accounts || []);
      setSqlPositions(reconUsersRes?.positions || []);
      setUsers(fetchedUsers || []);
      setAllTrades(fetchedTrades || []);
      setMarkets(fetchedMarkets && fetchedMarkets.length > 0 ? fetchedMarkets : initialMarkets);
      setRequests(fetchedRequests || []);
      setPosts(fetchedPosts || []);
      setCategories(fetchedCategories || []);
      if (fetchedSettings) {
        setPlatformSettings({
          tradingFee: Number(fetchedSettings.tradingFee ?? 2.5),
          minDeposit: Number(fetchedSettings.minDeposit ?? 1000),
          minWithdrawal: Number(fetchedSettings.minWithdrawal ?? 5000),
          maintenanceMode: Boolean(fetchedSettings.maintenanceMode),
          platformName: String(fetchedSettings.platformName || 'MercadoAO'),
        });
      }
      setAuditLogs(fetchedLogs || []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err: any) {
      setOverviewError(err?.message || 'Erro ao sincronizar painel administrativo.');
    } finally {
      setLoading(false);
    }
  }, [period.preset, period.from, period.to, currentUser?.email, initialMarkets]);

  useEffect(() => {
    if (currentUser?.is_admin) {
      fetchAllAdminData();
    }
  }, [currentUser?.is_admin, fetchAllAdminData]);

  // Period-filtered Firestore metrics & series
  const periodMetrics = useMemo(() => {
    const { fromMs, toMs, granularity } = resolveClientPeriodBounds(period);

    // Active users in period from Firestore trades & finance requests
    const activeSet = new Set<string>();
    for (const t of allTrades) {
      const ts = t.timestamp?.seconds ? t.timestamp.seconds * 1000 : new Date(t.timestamp || 0).getTime();
      if (ts >= fromMs && ts <= toMs && t.user_id && !String(t.user_id).startsWith('bot_')) {
        activeSet.add(t.user_id);
      }
    }
    for (const r of requests) {
      const ts = new Date(r.created_at || r.timestamp || 0).getTime();
      if (ts >= fromMs && ts <= toMs && r.user_id) {
        activeSet.add(r.user_id);
      }
    }

    const activeMarkets = markets.filter((m) => !m.resolved && m.status !== 'closed' && m.status !== 'blocked').length;
    const closedMarkets = markets.filter((m) => m.resolved || m.status === 'closed').length;

    const pendingDeposits = requests.filter((r) => (r.status || 'pending') === 'pending' && r.type === 'deposit');
    const pendingWithdrawals = requests.filter((r) => (r.status || 'pending') === 'pending' && r.type === 'withdrawal');
    const pendingKyc = users.filter((u) => u.status === 'pending_verification' || u.verification_status === 'pending').length;
    const expiredUnresolved = markets.filter((m) => !m.resolved && m.end_date && new Date(m.end_date).getTime() <= Date.now());

    // User growth series
    const userBuckets = new Map<string, { key: string; label: string; newUsers: number; totalUsers: number }>();
    const sortedUsers = [...users]
      .filter((u) => u.created_at)
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());

    let runningBefore = 0;
    for (const u of sortedUsers) {
      const ts = new Date(u.created_at!).getTime();
      if (ts < fromMs) {
        runningBefore += 1;
        continue;
      }
      if (ts > toMs) continue;
      const b = formatBucket(u.created_at, granularity);
      if (!b) continue;
      const cur = userBuckets.get(b.key) || { key: b.key, label: b.label, newUsers: 0, totalUsers: runningBefore };
      cur.newUsers += 1;
      userBuckets.set(b.key, cur);
    }
    let cumulative = runningBefore;
    const userGrowthSeries = Array.from(userBuckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => {
        cumulative += item.newUsers;
        return { label: item.label, newUsers: item.newUsers, totalUsers: cumulative };
      });

    // Finance flow series (Deposits vs Withdrawals in period)
    const finBuckets = new Map<string, { key: string; label: string; depositsKz: number; withdrawalsKz: number }>();
    for (const r of requests) {
      if (r.status === 'rejected') continue;
      const rawDate = r.created_at || r.timestamp;
      const ts = new Date(rawDate || 0).getTime();
      if (isNaN(ts) || ts < fromMs || ts > toMs) continue;
      const b = formatBucket(rawDate, granularity);
      if (!b) continue;
      const cur = finBuckets.get(b.key) || { key: b.key, label: b.label, depositsKz: 0, withdrawalsKz: 0 };
      if (r.type === 'deposit') cur.depositsKz = Number((cur.depositsKz + Number(r.amount || 0)).toFixed(2));
      if (r.type === 'withdrawal') cur.withdrawalsKz = Number((cur.withdrawalsKz + Number(r.amount || 0)).toFixed(2));
      finBuckets.set(b.key, cur);
    }
    const financeFlowSeries = Array.from(finBuckets.values()).sort((a, b) => a.key.localeCompare(b.key));

    // Combine server alerts + pending deposits/withdrawals/expired markets
    const combinedAlerts: AdminAlertItem[] = [...(backendOverview?.alerts || [])];
    if (expiredUnresolved.length > 0) {
      combinedAlerts.unshift({
        id: 'alert_expired_markets',
        severity: 'warning',
        title: `${expiredUnresolved.length} Mercado(s) Expirado(s) por Resolver`,
        detail: 'Existem mercados cuja data limite já expirou e aguardam declaração do resultado vencedor.',
        timestamp: new Date().toISOString(),
      });
    }
    if (pendingWithdrawals.length > 0) {
      combinedAlerts.push({
        id: 'alert_pending_wd',
        severity: 'info',
        title: `${pendingWithdrawals.length} Levantamento(s) Pendente(s)`,
        detail: `Total a aguardar validação: ${pendingWithdrawals.reduce((s, r) => s + Number(r.amount || 0), 0).toLocaleString('pt-PT')} Kz.`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      kpis: {
        registeredUsers: users.length,
        activeUsersInPeriod: activeSet.size,
        activeMarkets,
        closedMarkets,
        executedVolumeKz: backendOverview?.kpis?.executedVolumeKz ?? 0,
        executedVolumeDeltaPct: backendOverview?.kpis?.executedVolumeDeltaPct ?? null,
        feesCollectedKz: backendOverview?.kpis?.feesCollectedKz ?? 0,
        feesDeltaPct: backendOverview?.kpis?.feesDeltaPct ?? null,
        pendingDepositsCount: pendingDeposits.length,
        pendingDepositsKz: pendingDeposits.reduce((s, r) => s + Number(r.amount || 0), 0),
        pendingWithdrawalsCount: pendingWithdrawals.length,
        pendingWithdrawalsKz: pendingWithdrawals.reduce((s, r) => s + Number(r.amount || 0), 0),
        openClobOrdersCount: backendOverview?.kpis?.openClobOrdersCount ?? 0,
        executionsCount: backendOverview?.kpis?.executionsCount ?? 0,
        executionsDeltaPct: backendOverview?.kpis?.executionsDeltaPct ?? null,
      },
      userGrowthSeries,
      financeFlowSeries,
      expiredUnresolvedCount: expiredUnresolved.length,
      pendingDepositsCount: pendingDeposits.length,
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingKyc,
      combinedAlerts,
    };
  }, [period, users, markets, requests, allTrades, backendOverview]);

  if (!currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-market-bg flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
        <AlertTriangle className="w-12 h-12 text-market-red" />
        <h2 className="text-xl font-bold uppercase tracking-wider">Acesso Restrito</h2>
        <p className="text-xs text-market-text-muted max-w-sm leading-relaxed">
          Esta área é exclusiva para contas administrativas verificadas do MercadoAO.
        </p>
        <button onClick={() => navigate('/')} className="market-button-outline text-xs px-5 py-2.5">
          Voltar aos Mercados
        </button>
      </div>
    );
  }

  const renderSection = () => {
    if (loading && !lastUpdatedAt) {
      return (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-market-text-muted market-card">
          <Loader2 className="w-8 h-8 animate-spin text-market-green" />
          <span className="text-xs font-bold uppercase tracking-widest">A sincronizar dados operacionais...</span>
        </div>
      );
    }

    switch (activeSection) {
      case 'admin_overview':
      case 'master_overview':
        return (
          <div className="space-y-6">
            {periodMetrics.expiredUnresolvedCount > 0 && (
              <div className="market-card p-4 border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">
                      {periodMetrics.expiredUnresolvedCount} mercado(s) expirado(s) aguardando resolução oficial
                    </p>
                    <p className="text-[11px] text-market-text-muted">
                      Declare o resultado vencedor no gestor de mercados para liquidar as posições CLOB e AMM.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSection('admin_markets')}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  Resolver Mercados
                </button>
              </div>
            )}
            <StatsDashboard
              isMasterView={activeSection === 'master_overview'}
              kpis={periodMetrics.kpis}
              volumeSeries={backendOverview?.volumeSeries || []}
              userGrowthSeries={periodMetrics.userGrowthSeries}
              financeFlowSeries={periodMetrics.financeFlowSeries}
              topMarkets={backendOverview?.topMarkets || []}
              orderActivitySeries={backendOverview?.orderActivitySeries || []}
              participation={
                backendOverview?.participation || {
                  humanExecutionsCount: 0,
                  botExecutionsCount: 0,
                  ammExecutionsCount: 0,
                  totalExecutionsCount: 0,
                }
              }
              generatedAt={backendOverview?.generatedAt || lastUpdatedAt}
              error={overviewError}
            />
          </div>
        );

      case 'admin_users':
      case 'admin_wallets':
      case 'admin_deposits':
      case 'admin_withdrawals':
      case 'admin_kyc': {
        const modeMap = {
          admin_users: 'users',
          admin_wallets: 'wallets',
          admin_deposits: 'deposits',
          admin_withdrawals: 'withdrawals',
          admin_kyc: 'kyc',
        } as const;
        return (
          <UsersAndFinancePanel
            mode={modeMap[activeSection]}
            users={users}
            requests={requests}
            trades={allTrades}
            sqlAccounts={sqlAccounts}
            sqlPositions={sqlPositions}
            actorRole={actorRole}
            platformFeePct={platformSettings.tradingFee}
            addToast={addToast}
            onRefreshData={fetchAllAdminData}
          />
        );
      }

      case 'admin_markets':
      case 'admin_categories':
      case 'master_market_perf':
        return (
          <MarketManager
            markets={markets}
            categories={categories}
            trades={allTrades}
            addToast={addToast}
            onRefreshData={fetchAllAdminData}
            initialSubTab={activeSection === 'admin_categories' ? 'categories' : 'markets'}
          />
        );

      case 'admin_clob_orders':
      case 'admin_orderbook':
      case 'master_clob':
        return (
          <ClobControlPanel
            markets={markets}
            period={period}
            initialMode={
              activeSection === 'admin_orderbook'
                ? 'orderbook'
                : activeSection === 'master_clob'
                  ? 'master_clob'
                  : 'orders'
            }
            addToast={addToast}
          />
        );

      case 'admin_amm_liquidity':
      case 'master_capital':
      case 'master_allocations':
      case 'master_amm':
      case 'master_risk':
      case 'master_accounting':
      case 'master_liquidity_analytics':
      case 'master_approvals': {
        const subTabMap: Record<string, 'overview' | 'markets' | 'strategy' | 'accounting' | 'risk' | 'tests'> = {
          admin_amm_liquidity: 'markets',
          master_capital: 'overview',
          master_allocations: 'markets',
          master_amm: 'strategy',
          master_risk: 'risk',
          master_accounting: 'accounting',
          master_liquidity_analytics: 'overview',
          master_approvals: 'risk',
        };
        return (
          <AmmControlCenter
            markets={markets}
            addToast={addToast}
            initialSubTab={subTabMap[activeSection] || 'overview'}
          />
        );
      }

      case 'admin_bots':
        return <BotControlHub markets={markets} addToast={addToast} onRefreshData={fetchAllAdminData} />;

      case 'admin_posts':
        return <PostManager posts={posts} categories={categories} addToast={addToast} onRefreshData={fetchAllAdminData} />;

      case 'master_pnl':
      case 'master_reconciliation':
      case 'admin_reports': {
        const finMode =
          activeSection === 'master_pnl'
            ? 'pnl'
            : activeSection === 'master_reconciliation'
              ? 'reconciliation'
              : 'reports';
        return (
          <FinancialPnlAndRecon
            mode={finMode}
            period={period}
            markets={markets}
            users={users}
            requests={requests}
            actorRole={actorRole}
            addToast={addToast}
            onRefreshData={fetchAllAdminData}
          />
        );
      }

      case 'master_health':
      case 'master_security':
      case 'admin_audit':
      case 'master_audit':
      case 'admin_settings':
      case 'master_fin_config': {
        const secModeMap = {
          master_health: 'health',
          master_security: 'security',
          admin_audit: 'audit',
          master_audit: 'master_audit',
          admin_settings: 'settings',
          master_fin_config: 'fin_config',
        } as const;
        return (
          <SystemHealthAndSecurity
            mode={secModeMap[activeSection]}
            actorRole={actorRole}
            users={users}
            auditLogs={auditLogs}
            platformSettings={platformSettings}
            addToast={addToast}
            onRefreshData={fetchAllAdminData}
          />
        );
      }
    }
  };

  return (
    <AdminShell
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      actorRole={actorRole}
      actorEmail={actorEmail}
      period={period}
      onChangePeriod={setPeriod}
      systemStatus={systemStatus}
      alerts={periodMetrics.combinedAlerts}
      lastUpdatedAt={lastUpdatedAt}
      loading={loading}
      onRefresh={fetchAllAdminData}
      badges={{
        admin_deposits: periodMetrics.pendingDepositsCount,
        admin_withdrawals: periodMetrics.pendingWithdrawalsCount,
        admin_kyc: periodMetrics.pendingKyc,
        admin_markets: periodMetrics.expiredUnresolvedCount,
      }}
      onExitAdmin={() => navigate('/')}
    >
      {renderSection()}
    </AdminShell>
  );
};

export default AdminDashboard;
