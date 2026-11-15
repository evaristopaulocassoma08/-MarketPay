import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  DollarSign,
  FileBarChart2,
  FileText,
  Flame,
  FolderKanban,
  Gauge,
  GitCompare,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  Scale,
  ServerCrash,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

export type AdminSectionId =
  // 16 Operational Admin sections
  | 'admin_overview'
  | 'admin_users'
  | 'admin_markets'
  | 'admin_clob_orders'
  | 'admin_orderbook'
  | 'admin_amm_liquidity'
  | 'admin_deposits'
  | 'admin_withdrawals'
  | 'admin_wallets'
  | 'admin_kyc'
  | 'admin_bots'
  | 'admin_categories'
  | 'admin_posts'
  | 'admin_reports'
  | 'admin_audit'
  | 'admin_settings'
  // 16 Master Admin Control Center sections
  | 'master_overview'
  | 'master_capital'
  | 'master_allocations'
  | 'master_amm'
  | 'master_clob'
  | 'master_risk'
  | 'master_accounting'
  | 'master_pnl'
  | 'master_liquidity_analytics'
  | 'master_market_perf'
  | 'master_reconciliation'
  | 'master_health'
  | 'master_security'
  | 'master_audit'
  | 'master_fin_config'
  | 'master_approvals';

export type PeriodPreset = 'today' | '24h' | '7d' | '30d' | '90d' | 'year' | 'custom';

export interface PeriodFilter {
  preset: PeriodPreset;
  from: string;
  to: string;
}

export interface NavItemConfig {
  id: AdminSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'admin' | 'master';
  masterOnly?: boolean;
  badgeCount?: number;
}

export interface AdminAlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  timestamp: string;
}

export const ADMIN_NAV_ITEMS: NavItemConfig[] = [
  { id: 'admin_overview', label: 'Visão Geral', icon: LayoutDashboard, group: 'admin' },
  { id: 'admin_users', label: 'Utilizadores', icon: Users, group: 'admin' },
  { id: 'admin_markets', label: 'Mercados', icon: TrendingUp, group: 'admin' },
  { id: 'admin_clob_orders', label: 'Ordens CLOB', icon: Layers, group: 'admin' },
  { id: 'admin_orderbook', label: 'Livro de Ofertas', icon: BookOpen, group: 'admin' },
  { id: 'admin_amm_liquidity', label: 'Liquidez AMM', icon: Zap, group: 'admin' },
  { id: 'admin_deposits', label: 'Depósitos', icon: ArrowDownToLine, group: 'admin' },
  { id: 'admin_withdrawals', label: 'Levantamentos', icon: ArrowUpFromLine, group: 'admin' },
  { id: 'admin_wallets', label: 'Carteiras', icon: Wallet, group: 'admin' },
  { id: 'admin_kyc', label: 'Verificação KYC', icon: ShieldCheck, group: 'admin' },
  { id: 'admin_bots', label: 'Gestão de Bots', icon: Cpu, group: 'admin' },
  { id: 'admin_categories', label: 'Categorias', icon: FolderKanban, group: 'admin' },
  { id: 'admin_posts', label: 'Publicações', icon: FileText, group: 'admin' },
  { id: 'admin_reports', label: 'Relatórios', icon: FileBarChart2, group: 'admin' },
  { id: 'admin_audit', label: 'Auditoria', icon: History, group: 'admin' },
  { id: 'admin_settings', label: 'Configurações', icon: Settings, group: 'admin' },
];

export const MASTER_NAV_ITEMS: NavItemConfig[] = [
  { id: 'master_overview', label: 'Master Overview', icon: Gauge, group: 'master', masterOnly: true },
  { id: 'master_capital', label: 'Capital Empresarial', icon: DollarSign, group: 'master', masterOnly: true },
  { id: 'master_allocations', label: 'Gestão de Alocações', icon: Scale, group: 'master', masterOnly: true },
  { id: 'master_amm', label: 'AMM Control Center', icon: Zap, group: 'master', masterOnly: true },
  { id: 'master_clob', label: 'CLOB Control Center', icon: Layers, group: 'master', masterOnly: true },
  { id: 'master_risk', label: 'Risk Management', icon: ShieldAlert, group: 'master', masterOnly: true },
  { id: 'master_accounting', label: 'Financial Accounting', icon: BookOpen, group: 'master', masterOnly: true },
  { id: 'master_pnl', label: 'Profit & Loss', icon: TrendingUp, group: 'master', masterOnly: true },
  { id: 'master_liquidity_analytics', label: 'Liquidity Analytics', icon: BarChart3, group: 'master', masterOnly: true },
  { id: 'master_market_perf', label: 'Market Performance', icon: Flame, group: 'master', masterOnly: true },
  { id: 'master_reconciliation', label: 'Reconciliation Center', icon: GitCompare, group: 'master', masterOnly: true },
  { id: 'master_health', label: 'System Health', icon: Database, group: 'master', masterOnly: true },
  { id: 'master_security', label: 'Segurança e Permissões', icon: KeyRound, group: 'master', masterOnly: true },
  { id: 'master_audit', label: 'Auditoria Global', icon: Shield, group: 'master', masterOnly: true },
  { id: 'master_fin_config', label: 'Configuração Financeira', icon: Settings, group: 'master', masterOnly: true },
  { id: 'master_approvals', label: 'Aprovações Pendentes', icon: CheckCircle2, group: 'master', masterOnly: true },
];

const PERIOD_PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'year', label: 'Este ano' },
  { id: 'custom', label: 'Personalizado' },
];

export const AdminShell = ({
  activeSection,
  onSelectSection,
  actorRole,
  actorEmail,
  period,
  onChangePeriod,
  systemStatus,
  alerts,
  lastUpdatedAt,
  loading,
  onRefresh,
  badges,
  onExitAdmin,
  children,
}: {
  activeSection: AdminSectionId;
  onSelectSection: (id: AdminSectionId) => void;
  actorRole: 'MASTER_ADMIN' | 'OPERATIONAL_ADMIN' | 'USER';
  actorEmail: string;
  period: PeriodFilter;
  onChangePeriod: (p: PeriodFilter) => void;
  systemStatus: 'ONLINE' | 'DEGRADED' | 'ERROR' | 'CHECKING';
  alerts: AdminAlertItem[];
  lastUpdatedAt: string | null;
  loading: boolean;
  onRefresh: () => void;
  badges?: Partial<Record<AdminSectionId, number>>;
  onExitAdmin: () => void;
  children: React.ReactNode;
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const isMaster = actorRole === 'MASTER_ADMIN';
  const activeItem = [...ADMIN_NAV_ITEMS, ...MASTER_NAV_ITEMS].find((i) => i.id === activeSection);
  const criticalAlertsCount = alerts.filter((a) => a.severity === 'critical').length;

  const statusBadge = (() => {
    if (systemStatus === 'ERROR') {
      return {
        label: 'Erro Crítico',
        cls: 'text-market-red bg-market-red/10 border-market-red/30',
        Icon: ServerCrash,
      };
    }
    if (systemStatus === 'DEGRADED') {
      return {
        label: 'Degradado',
        cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        Icon: AlertTriangle,
      };
    }
    if (systemStatus === 'CHECKING') {
      return {
        label: 'A verificar',
        cls: 'text-market-text-muted bg-market-card border-market-border',
        Icon: Activity,
      };
    }
    return {
      label: 'Sistema Operacional',
      cls: 'text-market-green bg-market-green/10 border-market-green/30',
      Icon: CheckCircle2,
    };
  })();

  const renderSidebarNav = (isMobileDrawer: boolean) => (
    <div className="flex flex-col h-full bg-[#0d1117] border-r border-market-border select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-market-border flex items-center justify-between gap-2 shrink-0">
        {(!sidebarCollapsed || isMobileDrawer) && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-market-green/15 border border-market-green/30 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-market-green" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-black tracking-tight text-white block truncate">MercadoAO</span>
              <span className="text-[10px] font-mono text-market-text-muted block truncate">
                {isMaster ? 'MASTER CONTROL' : 'ADMIN OPERACIONAL'}
              </span>
            </div>
          </div>
        )}
        {isMobileDrawer ? (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-market-text-muted hover:text-white hover:bg-market-card"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-market-text-muted hover:text-white hover:bg-market-card ml-auto"
            title={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Lists */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6">
        {/* Operational Admin Group */}
        <div>
          {(!sidebarCollapsed || isMobileDrawer) && (
            <div className="px-2.5 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-market-text-muted">
                Painel Admin
              </span>
              <span className="text-[10px] font-mono text-market-text-muted">16</span>
            </div>
          )}
          <nav className="space-y-0.5">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const badge = badges?.[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectSection(item.id);
                    if (isMobileDrawer) setMobileMenuOpen(false);
                  }}
                  title={sidebarCollapsed && !isMobileDrawer ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-market-green/15 text-market-green font-semibold'
                      : 'text-market-text-muted hover:text-white hover:bg-market-card'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-market-green' : ''}`} />
                  {(!sidebarCollapsed || isMobileDrawer) && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono text-[10px] font-bold tabular-nums">
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Master Admin Control Center Group */}
        <div className="pt-2 border-t border-market-border/80">
          {(!sidebarCollapsed || isMobileDrawer) && (
            <div className="px-2.5 mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                {!isMaster && <Lock className="w-3 h-3" />}
                Master Control Center
              </span>
              <span className="text-[10px] font-mono text-amber-400/80">16</span>
            </div>
          )}
          <nav className="space-y-0.5">
            {MASTER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const badge = badges?.[item.id];
              const locked = !isMaster;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectSection(item.id);
                    if (isMobileDrawer) setMobileMenuOpen(false);
                  }}
                  title={sidebarCollapsed && !isMobileDrawer ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 font-semibold'
                      : locked
                        ? 'text-market-text-muted/50 hover:text-market-text-muted hover:bg-market-card/50'
                        : 'text-market-text-muted hover:text-white hover:bg-market-card'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : ''}`} />
                  {(!sidebarCollapsed || isMobileDrawer) && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>
                      {locked ? (
                        <Lock className="w-3 h-3 text-market-text-muted/60 shrink-0" />
                      ) : badge !== undefined && badge > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold tabular-nums">
                          {badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Exit Action */}
      <div className="p-3 border-t border-market-border shrink-0">
        <button
          onClick={onExitAdmin}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-market-text-muted hover:text-white hover:bg-market-card transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(!sidebarCollapsed || isMobileDrawer) && <span>Voltar aos Mercados</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-market-bg text-white flex">
      {/* Desktop Fixed Sidebar */}
      <aside className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-all duration-200 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        {renderSidebarNav(false)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[120] lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{renderSidebarNav(true)}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Sticky Top Bar */}
        <header className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-market-border px-4 lg:px-6 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Mobile Trigger + Title + Role Tag */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-market-border text-market-text-muted hover:text-white"
                aria-label="Abrir navegação administrativa"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base font-bold text-white truncate">
                    {activeItem?.label || 'Painel Administrativo'}
                  </h1>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      isMaster
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    }`}
                  >
                    {isMaster ? 'Master Admin' : 'Admin Operacional'}
                  </span>
                </div>
                <p className="text-[11px] text-market-text-muted font-mono truncate hidden sm:block">
                  {actorEmail || 'Sessão verificada'}
                  {lastUpdatedAt ? ` · Atualizado ${new Date(lastUpdatedAt).toLocaleTimeString('pt-PT')}` : ''}
                </p>
              </div>
            </div>

            {/* Right: Period Filter, System Status, Alerts, Refresh */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Period Presets */}
              <div className="hidden md:flex items-center bg-market-bg border border-market-border rounded-lg p-0.5">
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onChangePeriod({ ...period, preset: p.id })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      period.preset === p.id
                        ? 'bg-market-card-lighter text-white'
                        : 'text-market-text-muted hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Compact Mobile Period Select */}
              <select
                value={period.preset}
                onChange={(e) => onChangePeriod({ ...period, preset: e.target.value as PeriodPreset })}
                className="md:hidden bg-market-bg border border-market-border rounded-lg px-2 py-1.5 text-xs text-white"
              >
                {PERIOD_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              {period.preset === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={period.from}
                    onChange={(e) => onChangePeriod({ ...period, from: e.target.value })}
                    className="bg-market-bg border border-market-border rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-xs text-market-text-muted">—</span>
                  <input
                    type="date"
                    value={period.to}
                    onChange={(e) => onChangePeriod({ ...period, to: e.target.value })}
                    className="bg-market-bg border border-market-border rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                </div>
              )}

              {/* System Health Button */}
              <button
                onClick={() => onSelectSection(isMaster ? 'master_health' : 'admin_audit')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${statusBadge.cls}`}
                title="Estado real dos serviços Express, SQLite, Firebase, CLOB e AMM"
              >
                <statusBadge.Icon className="w-3.5 h-3.5" />
                <span>{statusBadge.label}</span>
              </button>

              {/* Alerts Popover */}
              <div className="relative">
                <button
                  onClick={() => setAlertsOpen((o) => !o)}
                  className={`relative p-2 rounded-lg border text-market-text-muted hover:text-white transition-colors ${
                    criticalAlertsCount > 0
                      ? 'border-market-red/40 bg-market-red/10 text-market-red'
                      : 'border-market-border bg-market-bg'
                  }`}
                  title="Alertas operacionais e de risco"
                >
                  <Bell className="w-4 h-4" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-market-red text-white text-[9px] font-mono font-bold flex items-center justify-center">
                      {alerts.length}
                    </span>
                  )}
                </button>

                {alertsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#12161d] border border-market-border rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-market-border flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        Alertas do Sistema ({alerts.length})
                      </span>
                      <button onClick={() => setAlertsOpen(false)} className="text-xs text-market-text-muted hover:text-white">
                        Fechar
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-market-border">
                      {alerts.length === 0 ? (
                        <div className="p-6 text-center text-xs text-market-text-muted">
                          Sem alertas ativos no momento.
                        </div>
                      ) : (
                        alerts.map((a) => (
                          <div key={a.id} className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  a.severity === 'critical'
                                    ? 'bg-market-red/15 text-market-red'
                                    : a.severity === 'warning'
                                      ? 'bg-amber-500/15 text-amber-400'
                                      : 'bg-blue-500/15 text-blue-400'
                                }`}
                              >
                                {a.severity === 'critical' ? 'Crítico' : a.severity === 'warning' ? 'Aviso' : 'Info'}
                              </span>
                              <span className="text-[10px] font-mono text-market-text-muted">
                                {new Date(a.timestamp).toLocaleTimeString('pt-PT')}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-white">{a.title}</p>
                            <p className="text-[11px] text-market-text-muted leading-snug">{a.detail}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-market-border bg-market-card text-xs font-semibold text-white hover:border-market-green/40 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-market-green' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          {activeItem?.masterOnly && !isMaster ? (
            <div className="market-card p-8 max-w-xl mx-auto mt-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Acesso Exclusivo do Master Admin</h2>
              <p className="text-xs text-market-text-muted leading-relaxed">
                A secção <strong>{activeItem.label}</strong> pertence ao Master Admin Control Center e exige verificação
                autenticada da conta Master Admin no servidor Express. A sua conta atual opera com nível{' '}
                <span className="font-mono text-white">{actorRole}</span>.
              </p>
              <button
                onClick={() => onSelectSection('admin_overview')}
                className="market-button-outline text-xs px-5 py-2.5"
              >
                Voltar à Visão Geral Operacional
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
};
