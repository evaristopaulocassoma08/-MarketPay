import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Cpu,
  DollarSign,
  FlaskConical,
  History,
  Lock,
  Play,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Square,
  TrendingUp,
  Unlock,
  XCircle,
  Zap,
  Loader2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Market } from '../../types';
import { ammApi } from '../../lib/amm-api';

const formatKz = (cents: number | undefined | null) => {
  const val = (cents || 0) / 100;
  return `${val.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Kz`;
};

const RiskBadge = ({ state }: { state: string }) => {
  const styles: Record<string, string> = {
    NORMAL: 'bg-market-green/15 text-market-green border-market-green/30',
    WARNING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    PROTECTION: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    HALTED: 'bg-market-red/20 text-market-red border-market-red/40 animate-pulse',
    EMERGENCY_HALT: 'bg-market-red/25 text-market-red border-market-red/50 animate-pulse',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
        styles[state] || 'bg-slate-800 text-slate-300 border-slate-700'
      }`}
    >
      {state}
    </span>
  );
};

export const AmmControlCenter = ({
  markets,
  addToast,
  initialSubTab = 'overview',
}: {
  markets: Market[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialSubTab?: 'overview' | 'markets' | 'strategy' | 'accounting' | 'risk' | 'tests';
}) => {
  const [subTab, setSubTab] = useState<'overview' | 'markets' | 'strategy' | 'accounting' | 'risk' | 'tests'>(initialSubTab);
  const [overview, setOverview] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [userRecon, setUserRecon] = useState<{ accounts: any[]; positions: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Market allocation & inspection states
  const [selectedMarketId, setSelectedMarketId] = useState<string>('');
  const [allocAmountKz, setAllocAmountKz] = useState<string>('50000');
  const [allocJustification, setAllocJustification] = useState<string>('');
  const [marketDetails, setMarketDetails] = useState<any>(null);

  // Modals for justification-required actions
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [showResumeModal, setShowResumeModal] = useState<{ open: boolean; targetMarketId: string }>({
    open: false,
    targetMarketId: 'GLOBAL',
  });
  const [investigationFindings, setInvestigationFindings] = useState('');
  const [resumeJustification, setResumeJustification] = useState('');
  const [toggleJustification, setToggleJustification] = useState('');
  const [showToggleModal, setShowToggleModal] = useState(false);

  // Limits editor
  const [limitWarningPct, setLimitWarningPct] = useState('3');
  const [limitProtectionPct, setLimitProtectionPct] = useState('4');
  const [limitHaltPct, setLimitHaltPct] = useState('5');
  const [limitBudgetKz, setLimitBudgetKz] = useState('200000');
  const [limitJustification, setLimitJustification] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [ov, led, recon] = await Promise.all([
        ammApi.getOverview(),
        ammApi.getLedger(),
        ammApi.getUsersReconciliation().catch(() => null),
      ]);
      setOverview(ov);
      setLedgerData(led);
      setUserRecon(recon);
      if (ov?.settings) {
        setLimitWarningPct(String((ov.settings.warning_loss_bps || 300) / 100));
        setLimitProtectionPct(String((ov.settings.protection_loss_bps || 400) / 100));
        setLimitHaltPct(String((ov.settings.halt_loss_bps || 500) / 100));
        setLimitBudgetKz(String((ov.settings.max_allocation_budget_cents || 20000000) / 100));
      }
      if (!selectedMarketId && markets.length > 0) {
        setSelectedMarketId(markets[0].id);
      }
    } catch (err: any) {
      addToast(err.message || 'Erro ao carregar AMM Control Center', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, markets, selectedMarketId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedMarketId) {
      ammApi
        .getMarketDetails(selectedMarketId)
        .then(setMarketDetails)
        .catch(() => setMarketDetails(null));
    }
  }, [selectedMarketId, overview]);

  if (loading && !overview) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-market-text-muted bg-market-card/30 rounded-2xl border border-market-border">
        <Loader2 className="w-8 h-8 animate-spin text-market-green" />
        <span className="text-xs font-black uppercase tracking-widest">Carregando AMM Control Center...</span>
      </div>
    );
  }

  const settings = overview?.settings || {};
  const metrics = overview?.metrics || {};
  const reconciliation = overview?.reconciliation || {};
  const isMasterAdmin = overview?.actorRole === 'MASTER_ADMIN';
  const unackRiskEvents = (overview?.riskEvents || []).filter(
    (e: any) => !e.acknowledged_by && ['WARNING', 'PROTECTION', 'HALTED', 'EMERGENCY_HALT'].includes(e.new_state)
  );

  const selectedMarketObj = markets.find(m => m.id === selectedMarketId);
  const selectedMarketAlloc = (overview?.allocations || []).find((a: any) => a.market_id === selectedMarketId);

  const chartData = (overview?.pnlHistory || []).map((row: any, idx: number) => ({
    label: row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `#${idx + 1}`,
    disponivel: Number(((row.available_cash_cents || 0) / 100).toFixed(2)),
    alocado: Number(((row.allocated_capital_cents || 0) / 100).toFixed(2)),
    reserva: Number(((row.protected_reserve_cents || 0) / 100).toFixed(2)),
    reservadoOrdens: Number(((row.reserved_cash_cents || 0) / 100).toFixed(2)),
    pnlRealizado: Number(((row.realized_pnl_cents || 0) / 100).toFixed(2)),
    pnlNaoRealizado: Number(((row.unrealized_pnl_cents || 0) / 100).toFixed(2)),
    exposicao: Number(((row.exposure_cents || 0) / 100).toFixed(2)),
    obrigacoes: Number(((row.liabilities_cents || 0) / 100).toFixed(2)),
  }));

  const handleRequestAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMarketObj) return;
    setBusy(true);
    try {
      await ammApi.requestAllocation({
        marketId: selectedMarketObj.id,
        marketQuestion: selectedMarketObj.question,
        allocatedCapitalKz: Number(allocAmountKz),
        yesPriceCents: Math.round((selectedMarketObj.yes_price || 0.5) * 100),
        noPriceCents: Math.round((selectedMarketObj.no_price || 0.5) * 100),
        justification: allocJustification,
      });
      addToast('Solicitação de alocação registada! Aguardando autorização do Master Admin.', 'success');
      setAllocJustification('');
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDecideAllocation = async (marketId: string, decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    const just = allocJustification.trim() || `Decisão administrativa ${decision} via AMM Control Center`;
    setBusy(true);
    try {
      await ammApi.decideAllocation(marketId, {
        decision,
        allocatedCapitalKz: decision === 'APPROVED' ? Number(allocAmountKz) : undefined,
        justification: just,
      });
      addToast(`Alocação do mercado ${decision} com sucesso!`, 'success');
      setAllocJustification('');
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAmm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ammApi.toggleAmm(!settings.amm_enabled, toggleJustification);
      addToast(
        !settings.amm_enabled ? 'Fornecedor Automático ATIVADO no Sandbox!' : 'Fornecedor Automático DESATIVADO.',
        'success'
      );
      setShowToggleModal(false);
      setToggleJustification('');
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleEmergencyStop = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ammApi.emergencyStop(emergencyReason);
      addToast('PARAGEM DE EMERGÊNCIA EXECUTADA! Todas as cotações foram canceladas.', 'error');
      setShowEmergencyModal(false);
      setEmergencyReason('');
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ammApi.resumeAfterInvestigation({
        marketId: showResumeModal.targetMarketId,
        investigationFindings,
        justification: resumeJustification,
      });
      addToast('Retoma autorizada após investigação e registo de auditoria!', 'success');
      setShowResumeModal({ open: false, targetMarketId: 'GLOBAL' });
      setInvestigationFindings('');
      setResumeJustification('');
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRunTests = async () => {
    setBusy(true);
    try {
      const report = await ammApi.runSandboxTests();
      addToast(
        report.allPassed
          ? `Todos os ${report.total} testes obrigatórios passaram!`
          : `${report.passedCount}/${report.total} testes passaram.`,
        report.allPassed ? 'success' : 'error'
      );
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleStrategyTick = async () => {
    setBusy(true);
    try {
      const res = await ammApi.triggerStrategyTick(selectedMarketId || undefined);
      addToast(`Ciclo estratégico executado (${res.cycles?.length || 0} mercados analisados).`, 'info');
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await ammApi.updateLimits({
        warningPct: Number(limitWarningPct),
        protectionPct: Number(limitProtectionPct),
        haltPct: Number(limitHaltPct),
        maxAllocationBudgetKz: Number(limitBudgetKz),
        justification: limitJustification,
      });
      addToast('Limites financeiros e de risco atualizados com registo de auditoria.', 'success');
      setLimitJustification('');
      await loadData();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Governance & Emergency Bar */}
      <div className="market-card p-6 bg-slate-900/90 border border-market-border flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-black uppercase tracking-widest">
              PLATFORM_MODE = {settings.platform_mode || 'SANDBOX'}
            </span>
            <span className="px-2.5 py-1 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase tracking-widest">
              MOTOR: CLOB + AMM
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-market-border text-[10px] font-black uppercase tracking-widest">
              PERFIL: {isMasterAdmin ? 'MASTER ADMIN' : 'ADMIN OPERACIONAL'}
            </span>
            <span
              className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
                settings.emergency_halted
                  ? 'bg-market-red/20 text-market-red border-market-red/40 animate-pulse'
                  : settings.amm_enabled
                    ? 'bg-market-green/20 text-market-green border-market-green/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              {settings.emergency_halted
                ? 'EMERGÊNCIA ATIVA (HALT)'
                : settings.amm_enabled
                  ? 'AMM ATIVO (CONTROLADO)'
                  : 'AMM DESATIVADO (SANDBOX)'}
            </span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-market-green" />
            AMM Control Center — Fornecedor Automático de Liquidez Empresarial
          </h2>
          <p className="text-xs text-market-text-muted">
            Capital próprio segregado das carteiras dos utilizadores • Reserva protegida de 50.000 Kz inviolável • Limite de perda automático de 5% por mercado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={busy}
            className="market-button-outline px-4 py-2.5 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            onClick={handleStrategyTick}
            disabled={busy || !settings.amm_enabled || settings.emergency_halted}
            className="market-button-outline px-4 py-2.5 text-xs flex items-center gap-1.5 disabled:opacity-40"
          >
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            Executar Ciclo AMM
          </button>

          {isMasterAdmin && (
            <button
              onClick={() => setShowToggleModal(true)}
              disabled={busy}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                settings.amm_enabled
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-market-green text-market-bg border-market-green hover:opacity-90'
              }`}
            >
              {settings.amm_enabled ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {settings.amm_enabled ? 'Desativar AMM' : 'Ativar AMM (Sandbox)'}
            </button>
          )}

          {settings.emergency_halted && isMasterAdmin && (
            <button
              onClick={() => setShowResumeModal({ open: true, targetMarketId: 'GLOBAL' })}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-sky-500 text-white hover:bg-sky-600 flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Autorizar Retoma Global
            </button>
          )}

          <button
            onClick={() => setShowEmergencyModal(true)}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-market-red text-white hover:bg-red-600 shadow-lg shadow-market-red/25 flex items-center gap-1.5"
          >
            <AlertOctagon className="w-4 h-4" />
            Botão de Emergência
          </button>
        </div>
      </div>

      {/* Risk Alerts Banner (3% / 4% / 5% / Emergency) */}
      {unackRiskEvents.length > 0 && (
        <div className="bg-market-red/10 border border-market-red/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-market-red uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
              Notificações Críticas do Risk Engine ({unackRiskEvents.length})
            </h4>
          </div>
          <div className="space-y-2">
            {unackRiskEvents.slice(0, 4).map((ev: any) => (
              <div
                key={ev.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-market-bg/70 p-3 rounded-xl border border-market-border"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <RiskBadge state={ev.new_state} />
                    <span className="text-xs font-bold text-white font-mono">Mercado: {ev.market_id}</span>
                    <span className="text-[10px] text-market-text-muted">
                      {new Date(ev.created_at).toLocaleString('pt-PT')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{ev.trigger_reason}</p>
                </div>
                {isMasterAdmin && (
                  <button
                    onClick={() => setShowResumeModal({ open: true, targetMarketId: ev.market_id })}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black uppercase tracking-wider hover:bg-sky-500 hover:text-white shrink-0"
                  >
                    Investigar & Retomar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'overview', label: 'Visão Geral & Gráficos', icon: BarChart3 },
          { id: 'markets', label: 'Gestão por Mercado', icon: TrendingUp },
          { id: 'strategy', label: 'Estratégia & Decisões', icon: Cpu },
          { id: 'accounting', label: 'Contabilidade Dupla Entrada', icon: Scale },
          { id: 'risk', label: 'Risco, Aprovações & Auditoria', icon: ShieldAlert },
          { id: 'tests', label: 'Testes Obrigatórios (Sandbox)', icon: FlaskConical },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                subTab === t.id
                  ? 'bg-market-green/15 text-market-green border-market-green/40'
                  : 'bg-market-card border-market-border text-market-text-muted hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB: OVERVIEW & CHARTS */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Mandatory Financial Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Capital Empresarial</span>
              <div className="text-xl font-black text-white font-mono">{formatKz(metrics.companyCapitalCents)}</div>
              <span className="text-[10px] text-market-text-muted">Património exclusivo MercadoAO</span>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Capital Disponível</span>
              <div className="text-xl font-black text-market-green font-mono">{formatKz(metrics.availableCashCents)}</div>
              <span className="text-[10px] text-market-text-muted">Caixa operacional livre (amm_cash)</span>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Capital Alocado</span>
              <div className="text-xl font-black text-sky-400 font-mono">{formatKz(metrics.allocatedCapitalCents)}</div>
              <span className="text-[10px] text-market-text-muted">
                Teto máximo: {formatKz(metrics.maxAllocationBudgetCents)} ({metrics.utilizationPct || 0}%)
              </span>
            </div>

            <div className="market-card p-5 space-y-1 border-amber-500/30 bg-amber-500/5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-3 h-3" /> Reserva Protegida
              </span>
              <div className="text-xl font-black text-amber-300 font-mono">{formatKz(metrics.protectedReserveCents)}</div>
              <span className="text-[10px] text-amber-200/70">Intocável por automação</span>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Reservado em Ordens</span>
              <div className="text-xl font-black text-white font-mono">{formatKz(metrics.reservedCashCents)}</div>
              <span className="text-[10px] text-market-text-muted">Cotações ativas no CLOB</span>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Posições SIM</span>
              <div className="text-lg font-black text-market-green font-mono">{formatKz(metrics.positionsSimValueCents)}</div>
              <span className="text-[10px] text-market-text-muted">{(metrics.positionsSimShares || 0).toLocaleString()} quotas SIM</span>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Posições NÃO</span>
              <div className="text-lg font-black text-market-red font-mono">{formatKz(metrics.positionsNoValueCents)}</div>
              <span className="text-[10px] text-market-text-muted">{(metrics.positionsNoShares || 0).toLocaleString()} quotas NÃO</span>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Exposição Financeira</span>
              <div className="text-lg font-black text-white font-mono">{formatKz(metrics.exposureCents)}</div>
              <span className="text-[10px] text-market-text-muted">Obrigações: {formatKz(metrics.liabilitiesCents)}</span>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Lucro Realizado / Não Real.</span>
              <div className="text-sm font-black font-mono flex flex-col">
                <span className={(metrics.realizedPnlCents || 0) >= 0 ? 'text-market-green' : 'text-market-red'}>
                  Real.: {(metrics.realizedPnlCents || 0) >= 0 ? '+' : ''}{formatKz(metrics.realizedPnlCents)}
                </span>
                <span className={(metrics.unrealizedPnlCents || 0) >= 0 ? 'text-sky-400' : 'text-orange-400'}>
                  Não Real.: {(metrics.unrealizedPnlCents || 0) >= 0 ? '+' : ''}{formatKz(metrics.unrealizedPnlCents)}
                </span>
              </div>
            </div>

            <div className="market-card p-5 space-y-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Perda Atual & Reconciliação</span>
              <div className={`text-lg font-black font-mono ${(metrics.currentLossCents || 0) > 0 ? 'text-market-red' : 'text-white'}`}>
                {formatKz(metrics.currentLossCents)}
              </div>
              <span className={`text-[10px] font-bold ${reconciliation.reconciled ? 'text-market-green' : 'text-market-red'}`}>
                {reconciliation.reconciled ? 'Contabilidade Reconciliada (0 diff)' : 'Divergência Contabilística!'}
              </span>
            </div>
          </div>

          {/* Real Charts from amm_pnl */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="market-card p-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Evolução do Capital (Kz)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="disponivel" name="Caixa Livre" stroke="#00ff88" fill="#00ff88" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="alocado" name="Alocado" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="reserva" name="Reserva 50k" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="market-card p-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Resultados Financeiros (PnL)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="pnlRealizado" name="PnL Realizado" stroke="#00ff88" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pnlNaoRealizado" name="PnL Não Realizado" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="market-card p-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Exposição & Obrigações</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="exposicao" name="Exposição Líquida" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="obrigacoes" name="Obrigações Liquidação" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Capital Distribution Donut (200k Operational vs 50k Protected Reserve) */}
          <div className="market-card p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Caixa Livre (Disponível)', value: Math.max(0, (metrics.availableCashCents || 0) / 100) },
                      { name: 'Alocado em Mercados', value: Math.max(0, (metrics.allocatedCapitalCents || 0) / 100) },
                      { name: 'Reserva Protegida (50k)', value: Math.max(0, (metrics.protectedReserveCents || 0) / 100) },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    <Cell fill="#00c853" />
                    <Cell fill="#38bdf8" />
                    <Cell fill="#fbbf24" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 11 }}
                    formatter={(val: any) => `${Number(val).toLocaleString('pt-PT')} Kz`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-7 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-white">
                Distribuição do Capital Empresarial (250.000 Kz)
              </h4>
              <p className="text-xs text-market-text-muted">
                O orçamento operacional de até 200.000 Kz pode ser alocado por mercado; a reserva de 50.000 Kz permanece
                estritamente intocável pela automação.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-market-bg border border-market-border">
                  <span className="text-[10px] text-market-green uppercase block">Caixa Livre</span>
                  <span className="font-bold text-white">{formatKz(metrics.availableCashCents)}</span>
                </div>
                <div className="p-3 rounded-lg bg-market-bg border border-market-border">
                  <span className="text-[10px] text-sky-400 uppercase block">Alocado Mercados</span>
                  <span className="font-bold text-white">{formatKz(metrics.allocatedCapitalCents)}</span>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[10px] text-amber-300 uppercase block">Reserva Protegida</span>
                  <span className="font-bold text-amber-200">{formatKz(metrics.protectedReserveCents)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Market Risk Status Table */}
          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-white">Estado de Risco por Mercado</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-market-border text-[10px] font-black uppercase text-market-text-muted">
                    <th className="pb-3">Mercado</th>
                    <th className="pb-3 text-right">Alocado</th>
                    <th className="pb-3 text-right">Limite Perda (5%)</th>
                    <th className="pb-3 text-right">SIM / NÃO</th>
                    <th className="pb-3 text-right">PnL (Real. / N.Real.)</th>
                    <th className="pb-3 text-center">Estado Alocação</th>
                    <th className="pb-3 text-center">Estado Risco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border/40">
                  {(overview?.allocations || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-market-text-muted italic">
                        Nenhum mercado possui alocação AMM registada ainda. Configure na aba "Gestão por Mercado".
                      </td>
                    </tr>
                  ) : (
                    overview.allocations.map((a: any) => (
                      <tr key={a.market_id} className="hover:bg-white/[0.02]">
                        <td className="py-3 pr-4">
                          <div className="font-bold text-white line-clamp-1">{a.market_question}</div>
                          <div className="text-[10px] font-mono text-market-text-muted">{a.market_id}</div>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-white">{formatKz(a.allocated_capital_cents)}</td>
                        <td className="py-3 text-right font-mono text-amber-400">{formatKz(a.loss_limit_cents)}</td>
                        <td className="py-3 text-right font-mono text-slate-300">
                          {a.shares_sim || 0} / {a.shares_no || 0}
                        </td>
                        <td className="py-3 text-right font-mono">
                          <span className={a.realized_pnl_cents >= 0 ? 'text-market-green' : 'text-market-red'}>
                            {formatKz(a.realized_pnl_cents)}
                          </span>{' '}
                          /{' '}
                          <span className={a.unrealized_pnl_cents >= 0 ? 'text-sky-400' : 'text-orange-400'}>
                            {formatKz(a.unrealized_pnl_cents)}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-800 text-slate-200 border border-market-border">
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <RiskBadge state={a.risk_state} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GESTÃO DE CAPITAL POR MERCADO */}
      {subTab === 'markets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 market-card p-6 space-y-5">
            <h4 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-market-green" />
              Configurar Alocação de Capital por Mercado
            </h4>

            <div>
              <label className="block text-[10px] font-bold text-market-text-muted uppercase mb-2">Selecionar Mercado</label>
              <select
                value={selectedMarketId}
                onChange={e => setSelectedMarketId(e.target.value)}
                className="market-input w-full text-xs bg-market-bg"
              >
                {markets.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.question} ({m.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleRequestAllocation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-market-text-muted uppercase mb-2">
                  Capital Alocado (Kz) — Teto global restante: {formatKz((metrics.maxAllocationBudgetCents || 20000000) - (metrics.allocatedCapitalCents || 0))}
                </label>
                <input
                  type="number"
                  min={1000}
                  max={200000}
                  step={500}
                  required
                  value={allocAmountKz}
                  onChange={e => setAllocAmountKz(e.target.value)}
                  className="market-input w-full font-mono font-bold"
                />
                <p className="text-[11px] text-amber-400 mt-1.5 font-mono">
                  Limite de perda automático (5%): {(Number(allocAmountKz || 0) * 0.05).toLocaleString('pt-PT')} Kz
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-market-text-muted uppercase mb-2">
                  Justificação Obrigatória (Auditoria)
                </label>
                <textarea
                  required
                  value={allocJustification}
                  onChange={e => setAllocJustification(e.target.value)}
                  placeholder="Explique o critério de liquidez e risco para esta alocação..."
                  className="market-input w-full h-20 text-xs resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !selectedMarketObj}
                className="market-button-outline w-full py-2.5 text-xs font-black uppercase tracking-wider"
              >
                Solicitar Alocação (Pendente Master Admin)
              </button>
            </form>

            {isMasterAdmin && selectedMarketObj && (
              <div className="pt-4 border-t border-market-border space-y-2">
                <span className="text-[10px] font-black text-market-green uppercase tracking-widest block">
                  Autorização Direta — Master Admin
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleDecideAllocation(selectedMarketObj.id, 'APPROVED')}
                    disabled={busy}
                    className="py-2 rounded-xl bg-market-green/20 text-market-green border border-market-green/30 text-[10px] font-black uppercase hover:bg-market-green hover:text-market-bg"
                  >
                    Autorizar
                  </button>
                  <button
                    onClick={() => handleDecideAllocation(selectedMarketObj.id, 'REJECTED')}
                    disabled={busy}
                    className="py-2 rounded-xl bg-market-red/15 text-market-red border border-market-red/30 text-[10px] font-black uppercase hover:bg-market-red hover:text-white"
                  >
                    Rejeitar
                  </button>
                  <button
                    onClick={() => handleDecideAllocation(selectedMarketObj.id, 'SUSPENDED')}
                    disabled={busy}
                    className="py-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase hover:bg-amber-500 hover:text-black"
                  >
                    Suspender
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected Market Live Financial & Risk Inspection */}
          <div className="lg:col-span-7 market-card p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-market-border pb-4">
              <div>
                <span className="text-[10px] font-mono text-market-text-muted">MERCADO SELECIONADO: {selectedMarketId}</span>
                <h4 className="text-base font-black text-white mt-0.5">{selectedMarketObj?.question || selectedMarketId}</h4>
              </div>
              {selectedMarketAlloc && <RiskBadge state={selectedMarketAlloc.risk_state} />}
            </div>

            {selectedMarketAlloc ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-market-bg rounded-xl border border-market-border">
                  <span className="text-[10px] text-market-text-muted uppercase block">Capital Alocado</span>
                  <strong className="text-white font-mono text-sm">{formatKz(selectedMarketAlloc.allocated_capital_cents)}</strong>
                </div>
                <div className="p-3 bg-market-bg rounded-xl border border-market-border">
                  <span className="text-[10px] text-market-text-muted uppercase block">Limite de Perda (5%)</span>
                  <strong className="text-amber-400 font-mono text-sm">{formatKz(selectedMarketAlloc.loss_limit_cents)}</strong>
                </div>
                <div className="p-3 bg-market-bg rounded-xl border border-market-border">
                  <span className="text-[10px] text-market-text-muted uppercase block">Capital Utilizado / Reservado</span>
                  <strong className="text-sky-400 font-mono text-sm">
                    {formatKz(selectedMarketAlloc.used_capital_cents)} / {formatKz(selectedMarketAlloc.reserved_capital_cents)}
                  </strong>
                </div>
                <div className="p-3 bg-market-bg rounded-xl border border-market-border">
                  <span className="text-[10px] text-market-text-muted uppercase block">Inventário SIM / NÃO</span>
                  <strong className="text-white font-mono text-sm">
                    {marketDetails?.inventory?.shares_sim || 0} SIM / {marketDetails?.inventory?.shares_no || 0} NÃO
                  </strong>
                </div>
                <div className="p-3 bg-market-bg rounded-xl border border-market-border">
                  <span className="text-[10px] text-market-text-muted uppercase block">Obrigações Pior Cenário</span>
                  <strong className="text-market-red font-mono text-sm">
                    {formatKz(marketDetails?.inventory?.worst_case_liability_cents || 0)}
                  </strong>
                </div>
                <div className="p-3 bg-market-bg rounded-xl border border-market-border">
                  <span className="text-[10px] text-market-text-muted uppercase block">PnL Realizado</span>
                  <strong className="text-market-green font-mono text-sm">
                    {formatKz(marketDetails?.inventory?.realized_pnl_cents || 0)}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-market-text-muted bg-market-bg rounded-xl border border-market-border">
                Este mercado ainda não possui alocação de liquidez empresarial configurada.
              </div>
            )}

            <div className="space-y-2">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-market-text-muted">
                Histórico Financeiro e Execuções do AMM neste Mercado
              </h5>
              <div className="max-h-64 overflow-y-auto bg-market-bg rounded-xl border border-market-border p-3 space-y-2 text-xs font-mono">
                {(marketDetails?.trades || []).length === 0 ? (
                  <p className="text-market-text-muted italic text-center py-6">Sem execuções AMM neste mercado.</p>
                ) : (
                  marketDetails.trades.map((t: any) => (
                    <div key={t.id} className="flex justify-between items-center border-b border-market-border/30 pb-2 last:border-b-0">
                      <span>
                        <strong className={t.side === 'Buy' ? 'text-market-green' : 'text-market-red'}>{t.side}</strong> {t.shares} {t.outcome} @ {t.price_cents}c
                      </span>
                      <span className="text-market-text-muted">{formatKz(t.notional_cents)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ESTRATÉGIA & DECISÕES */}
      {subTab === 'strategy' && (
        <div className="space-y-6">
          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-white">Cotações Ativas do AMM no Livro CLOB</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-market-border text-[10px] text-market-text-muted uppercase">
                    <th className="pb-2">Mercado</th>
                    <th className="pb-2">Resultado</th>
                    <th className="pb-2 text-right">Bid (Compra)</th>
                    <th className="pb-2 text-right">Ask (Venda)</th>
                    <th className="pb-2 text-right">Spread</th>
                    <th className="pb-2 text-center">Estado Risco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border/30">
                  {(overview?.activeQuotes || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-market-text-muted italic font-sans">
                        Nenhuma cotação ativa publicada pelo AMM neste momento.
                      </td>
                    </tr>
                  ) : (
                    overview.activeQuotes.map((q: any) => (
                      <tr key={q.id}>
                        <td className="py-3 text-white">{q.market_id}</td>
                        <td className="py-3">{q.outcome}</td>
                        <td className="py-3 text-right text-market-green">{q.bid_price_cents}c ({q.bid_shares} sh)</td>
                        <td className="py-3 text-right text-market-red">{q.ask_price_cents}c ({q.ask_shares} sh)</td>
                        <td className="py-3 text-right text-slate-300">{q.spread_bps} bps</td>
                        <td className="py-3 text-center"><RiskBadge state={q.risk_state} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-white">
              Registo Imutável de Decisões Automáticas (amm_decision_logs)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-market-border text-[10px] text-market-text-muted uppercase">
                    <th className="pb-2">Data</th>
                    <th className="pb-2">Mercado</th>
                    <th className="pb-2">Decisão</th>
                    <th className="pb-2 text-right">Preço / Qtd</th>
                    <th className="pb-2 text-right">Capital</th>
                    <th className="pb-2">Motivo & Resultado</th>
                    <th className="pb-2 text-center">Risco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border/30">
                  {(overview?.decisionLogs || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-market-text-muted italic">
                        Nenhuma decisão automática registada ainda.
                      </td>
                    </tr>
                  ) : (
                    overview.decisionLogs.map((d: any) => (
                      <tr key={d.id}>
                        <td className="py-3 text-[10px] font-mono text-market-text-muted">
                          {new Date(d.created_at).toLocaleTimeString('pt-PT')}
                        </td>
                        <td className="py-3 font-mono text-white">{d.market_id}</td>
                        <td className="py-3 font-bold text-sky-400">{d.decision_type} ({d.outcome})</td>
                        <td className="py-3 text-right font-mono">{d.price_cents}c × {d.shares}</td>
                        <td className="py-3 text-right font-mono">{formatKz(d.capital_used_cents)}</td>
                        <td className="py-3 text-slate-300 max-w-md">
                          <div>{d.reason}</div>
                          <div className="text-[10px] text-market-text-muted font-mono">{d.result_summary}</div>
                        </td>
                        <td className="py-3 text-center">
                          <RiskBadge state={d.risk_state} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CONTABILIDADE DUPLA ENTRADA */}
      {subTab === 'accounting' && (
        <div className="space-y-6">
          <div className="market-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-market-border pb-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-market-green" />
                  Balancete das Contas Empresariais (Segregadas dos Clientes)
                </h4>
                <p className="text-xs text-market-text-muted mt-1">
                  Partida dobrada com valores monetários inteiros (cêntimos). Débitos totais: {formatKz(reconciliation.totalDebitsCents)} | Créditos totais: {formatKz(reconciliation.totalCreditsCents)}
                </p>
              </div>
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border ${
                  reconciliation.reconciled
                    ? 'bg-market-green/15 text-market-green border-market-green/30'
                    : 'bg-market-red/20 text-market-red border-market-red/40'
                }`}
              >
                {reconciliation.reconciled ? 'RECONCILIADO (0,00 Kz DIVERGÊNCIA)' : 'ALERTA DE RECONCILIAÇÃO'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(reconciliation.accounts || []).map((acc: any) => (
                <div
                  key={acc.account_code}
                  className={`p-4 rounded-xl border ${
                    acc.is_protected ? 'bg-amber-500/5 border-amber-500/30' : 'bg-market-bg border-market-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-market-text-muted">{acc.account_code}</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {acc.account_type}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white mt-1">{acc.name}</div>
                  <div className="text-lg font-black font-mono text-market-green mt-2">{formatKz(acc.balance_cents)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="market-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-market-border pb-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-sky-400" />
                  Reconciliação de Contas CLOB ↔ Firestore
                </h4>
                <p className="text-xs text-market-text-muted mt-1">
                  Saldos de clientes em SQLite (`user_clob_accounts`) comparados com a última sincronização Firestore e quotas custodiadas (`user_clob_positions`).
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 font-bold">
                  Contas: {(userRecon?.accounts || []).length}
                </span>
                <span className="px-2.5 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                  Posições Ativas: {(userRecon?.positions || []).length}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-market-border text-[10px] text-market-text-muted uppercase">
                    <th className="pb-2">Conta / Utilizador</th>
                    <th className="pb-2 text-right">Disponível (SQLite)</th>
                    <th className="pb-2 text-right">Reservado Ordens</th>
                    <th className="pb-2 text-right">Firestore Sync</th>
                    <th className="pb-2 text-right">Divergência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border/30">
                  {(userRecon?.accounts || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-market-text-muted italic">
                        Sem contas de clientes registadas no motor CLOB.
                      </td>
                    </tr>
                  ) : (
                    (userRecon?.accounts || []).map((acc: any) => {
                      const syncVal = acc.last_synced_firestore_balance_cents;
                      const diffCents =
                        syncVal === null || syncVal === undefined
                          ? 0
                          : Number(acc.available_cents || 0) - Number(syncVal || 0);
                      return (
                        <tr key={acc.user_id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 font-mono text-[11px] text-white">{acc.user_id}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-market-green">
                            {formatKz(acc.available_cents)}
                          </td>
                          <td className="py-2.5 text-right font-mono text-amber-400">
                            {formatKz(acc.reserved_cents)}
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-300">
                            {syncVal === null || syncVal === undefined ? 'Pendente' : formatKz(syncVal)}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold">
                            <span className={diffCents === 0 ? 'text-market-green' : 'text-market-red'}>
                              {diffCents === 0 ? '0,00 Kz' : formatKz(diffCents)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {(userRecon?.positions || []).length > 0 && (
              <div className="pt-3 border-t border-market-border/50">
                <div className="text-[10px] font-black uppercase tracking-widest text-market-text-muted mb-2">
                  Custódia de Quotas no CLOB (`user_clob_positions`)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(userRecon?.positions || []).map((p: any, i: number) => (
                    <div
                      key={`${p.user_id}_${p.market_id}_${p.outcome}_${i}`}
                      className="p-2.5 rounded-lg bg-market-bg border border-market-border/60 text-[11px] font-mono flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate">{p.user_id}</div>
                        <div className="text-[10px] text-market-text-muted truncate">
                          {p.market_id} • {p.outcome === 'Yes' ? 'SIM' : 'NÃO'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-market-green font-black">{p.available_shares} disp.</div>
                        {p.reserved_shares > 0 && (
                          <div className="text-[10px] text-amber-400">{p.reserved_shares} res.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-white">
              Diário Contabilístico Imutável (Dupla Entrada)
            </h4>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {(ledgerData?.entries || []).map((entry: any) => (
                <div key={entry.id} className="p-4 bg-market-bg rounded-xl border border-market-border space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <span className="font-black text-sky-400 uppercase tracking-wider text-[10px]">
                      {entry.reference_type} • {entry.market_id || 'GLOBAL'}
                    </span>
                    <span className="text-[10px] font-mono text-market-text-muted">
                      {new Date(entry.created_at).toLocaleString('pt-PT')}
                    </span>
                  </div>
                  <p className="text-white">{entry.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 font-mono text-[11px]">
                    {(entry.lines || []).map((l: any) => (
                      <div key={l.id} className="flex justify-between bg-slate-900/60 px-2.5 py-1 rounded">
                        <span className="text-slate-300">{l.account_code}</span>
                        {l.debit_cents > 0 ? (
                          <span className="text-market-green">D: {formatKz(l.debit_cents)}</span>
                        ) : (
                          <span className="text-amber-400">C: {formatKz(l.credit_cents)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: RISCO, APROVAÇÕES & AUDITORIA */}
      {subTab === 'risk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 market-card p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Limites Financeiros & Risco (Apenas Master Admin)
            </h4>
            <form onSubmit={handleUpdateLimits} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-market-text-muted uppercase block mb-1">Alerta (%)</label>
                  <input type="number" step="0.5" value={limitWarningPct} onChange={e => setLimitWarningPct(e.target.value)} className="market-input w-full text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-market-text-muted uppercase block mb-1">Proteção (%)</label>
                  <input type="number" step="0.5" value={limitProtectionPct} onChange={e => setLimitProtectionPct(e.target.value)} className="market-input w-full text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-market-text-muted uppercase block mb-1">Suspensão (%)</label>
                  <input type="number" step="0.5" value={limitHaltPct} onChange={e => setLimitHaltPct(e.target.value)} className="market-input w-full text-xs font-mono" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-market-text-muted uppercase block mb-1">
                  Orçamento Máximo de Alocação (Kz — Máx. 200.000 Kz)
                </label>
                <input type="number" value={limitBudgetKz} onChange={e => setLimitBudgetKz(e.target.value)} className="market-input w-full text-xs font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-market-text-muted uppercase block mb-1">Justificação Formal</label>
                <textarea
                  required
                  value={limitJustification}
                  onChange={e => setLimitJustification(e.target.value)}
                  placeholder="Motivo detalhado da alteração (mínimo 10 caracteres)..."
                  className="market-input w-full h-20 text-xs resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !isMasterAdmin}
                className="market-button-primary w-full py-2.5 text-xs uppercase font-black disabled:opacity-40"
              >
                {isMasterAdmin ? 'Guardar Novos Limites (Com Auditoria)' : 'Exclusivo Master Admin'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 market-card p-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              Aprovações Administrativas & Trilha de Segurança
            </h4>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 text-xs">
              {(overview?.auditLogs || []).map((log: any) => (
                <div key={log.id} className="p-3 bg-market-bg rounded-xl border border-market-border space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="font-black text-market-green">
                      {log.actor_role} • {log.actor_email || log.actor_id}
                    </span>
                    <span className="font-mono text-market-text-muted">{new Date(log.created_at).toLocaleString('pt-PT')}</span>
                  </div>
                  <div className="font-bold text-white">{log.action} ({log.target_id || 'GLOBAL'})</div>
                  <div className="text-slate-300">Justificação: {log.justification}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: TESTES OBRIGATÓRIOS (SANDBOX) */}
      {subTab === 'tests' && (
        <div className="market-card p-6 space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-market-border pb-4">
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-market-green" />
                Suite de Validação Financeira e de Segurança (Sandbox)
              </h4>
              <p className="text-xs text-market-text-muted mt-1">
                O AMM só pode ser ativado no Sandbox após execução e aprovação integral de todos os cenários obrigatórios em ambiente isolado.
              </p>
            </div>
            <button
              onClick={handleRunTests}
              disabled={busy}
              className="market-button-primary px-6 py-2.5 text-xs font-black uppercase tracking-wider flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Executar Todos os Testes Obrigatórios
            </button>
          </div>

          {settings.last_test_report ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  Resultado: {settings.last_test_report.passedCount}/{settings.last_test_report.total} testes aprovados
                </span>
                <span className="text-market-text-muted font-mono">
                  Executado em: {new Date(settings.last_test_report.executedAt).toLocaleString('pt-PT')}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(settings.last_test_report.results || []).map((r: any) => (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border ${
                      r.passed ? 'bg-market-green/5 border-market-green/30' : 'bg-market-red/10 border-market-red/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">
                        {r.id} — {r.name}
                      </span>
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-market-green shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-market-red shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1.5">{r.details}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-market-text-muted">
              Clique em "Executar Todos os Testes Obrigatórios" para validar capital inicial, reserva de 50.000 Kz, limites 3%/4%/5%, CLOB, idempotência e reconciliação.
            </div>
          )}
        </div>
      )}

      {/* MODAL: TOGGLE AMM */}
      {showToggleModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-market-card border border-market-border rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {settings.amm_enabled ? 'Desativar Fornecedor Automático' : 'Ativar Fornecedor Automático (SANDBOX)'}
            </h3>
            <form onSubmit={handleToggleAmm} className="space-y-4">
              <textarea
                required
                value={toggleJustification}
                onChange={e => setToggleJustification(e.target.value)}
                placeholder="Justificação administrativa obrigatória (mín. 8 caracteres)..."
                className="market-input w-full h-24 text-xs resize-none"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowToggleModal(false)} className="market-button-outline flex-1 py-2.5 text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={busy} className="market-button-primary flex-1 py-2.5 text-xs">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMERGENCY STOP */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-market-card border border-market-red/40 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-market-red uppercase tracking-wider flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" />
              Confirmar Paragem de Emergência (Kill Switch)
            </h3>
            <p className="text-xs text-slate-300">
              Isto cancela imediatamente todas as cotações ativas do AMM e bloqueia novas operações de risco até investigação formal pelo Master Admin.
            </p>
            <form onSubmit={handleEmergencyStop} className="space-y-4">
              <textarea
                required
                value={emergencyReason}
                onChange={e => setEmergencyReason(e.target.value)}
                placeholder="Motivo da paragem de emergência..."
                className="market-input w-full h-24 text-xs resize-none"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowEmergencyModal(false)} className="market-button-outline flex-1 py-2.5 text-xs">
                  Cancelar
                </button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-market-red text-white font-black text-xs uppercase">
                  Executar Emergência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESUME AFTER INVESTIGATION */}
      {showResumeModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-market-card border border-sky-500/40 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              Retoma Após Investigação ({showResumeModal.targetMarketId})
            </h3>
            <form onSubmit={handleResume} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-market-text-muted uppercase block mb-1">
                  Conclusões da Investigação (mín. 10 caracteres)
                </label>
                <textarea
                  required
                  value={investigationFindings}
                  onChange={e => setInvestigationFindings(e.target.value)}
                  placeholder="Descreva a causa raiz identificada e medidas corretivas..."
                  className="market-input w-full h-20 text-xs resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-market-text-muted uppercase block mb-1">
                  Justificação da Autorização Master Admin (mín. 10 caracteres)
                </label>
                <textarea
                  required
                  value={resumeJustification}
                  onChange={e => setResumeJustification(e.target.value)}
                  placeholder="Justificação formal para retomar operações..."
                  className="market-input w-full h-20 text-xs resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowResumeModal({ open: false, targetMarketId: 'GLOBAL' })}
                  className="market-button-outline flex-1 py-2.5 text-xs"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white font-black text-xs uppercase">
                  Autorizar Retoma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
