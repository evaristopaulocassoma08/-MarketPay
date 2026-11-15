import React, { useState } from 'react';
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  DollarSign,
  Layers,
  TrendingUp,
  Users,
} from 'lucide-react';

export interface OverviewKpiProps {
  registeredUsers: number;
  activeUsersInPeriod: number;
  activeMarkets: number;
  closedMarkets: number;
  executedVolumeKz: number;
  executedVolumeDeltaPct: number | null;
  feesCollectedKz: number;
  feesDeltaPct: number | null;
  pendingDepositsCount: number;
  pendingDepositsKz: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsKz: number;
  openClobOrdersCount: number;
  executionsCount: number;
  executionsDeltaPct: number | null;
}

const DeltaTag = ({ delta }: { delta: number | null | undefined }) => {
  if (delta === null || delta === undefined) {
    return <span className="text-[11px] font-mono text-market-text-muted">Sem base anterior</span>;
  }
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold tabular-nums ${
        positive ? 'text-market-green' : 'text-market-red'
      }`}
    >
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {positive ? '+' : ''}
      {delta}% vs período anterior
    </span>
  );
};

const EmptyChartState = ({ message }: { message: string }) => (
  <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-4 border border-dashed border-market-border rounded-lg bg-market-bg/40">
    <BarChart3 className="w-6 h-6 text-market-text-muted/60 mb-2" />
    <p className="text-xs font-medium text-market-text-muted">{message}</p>
  </div>
);

export const StatsDashboard = ({
  isMasterView = false,
  kpis,
  volumeSeries,
  userGrowthSeries,
  financeFlowSeries,
  topMarkets,
  orderActivitySeries,
  participation,
  generatedAt,
  error,
}: {
  isMasterView?: boolean;
  kpis: OverviewKpiProps;
  volumeSeries: Array<{ label: string; volumeKz: number; feesKz: number; trades: number }>;
  userGrowthSeries: Array<{ label: string; newUsers: number; totalUsers: number }>;
  financeFlowSeries: Array<{ label: string; depositsKz: number; withdrawalsKz: number }>;
  topMarkets: Array<{ marketId: string; marketQuestion: string; volumeKz: number; feesKz: number; tradesCount: number }>;
  orderActivitySeries: Array<{ label: string; created: number; filled: number; cancelled: number; rejected: number }>;
  participation: {
    humanExecutionsCount: number;
    botExecutionsCount: number;
    ammExecutionsCount: number;
    totalExecutionsCount: number;
  };
  generatedAt: string | null;
  error?: string | null;
}) => {
  const [volChartMode, setVolChartMode] = useState<'area' | 'bar' | 'line'>('area');

  if (error) {
    return (
      <div className="market-card p-6 border-market-red/40 flex items-center gap-3 text-market-red">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div>
          <p className="text-sm font-bold">Erro ao carregar métricas reais do servidor</p>
          <p className="text-xs text-market-text-muted mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Utilizadores Registados',
      value: kpis.registeredUsers.toLocaleString('pt-PT'),
      sub: 'Total de contas no Firestore',
    },
    {
      label: 'Utilizadores Ativos (Período)',
      value: kpis.activeUsersInPeriod.toLocaleString('pt-PT'),
      sub: 'Contas com ordens ou transações',
    },
    {
      label: 'Mercados Ativos',
      value: kpis.activeMarkets.toLocaleString('pt-PT'),
      sub: 'Abertos para negociação CLOB',
    },
    {
      label: 'Mercados Encerrados',
      value: kpis.closedMarkets.toLocaleString('pt-PT'),
      sub: 'Resolvidos ou fechados',
    },
    {
      label: 'Volume Total Negociado',
      value: `${kpis.executedVolumeKz.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`,
      delta: kpis.executedVolumeDeltaPct,
    },
    {
      label: 'Comissões Recebidas (CLOB)',
      value: `${kpis.feesCollectedKz.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`,
      delta: kpis.feesDeltaPct,
    },
    {
      label: 'Depósitos Pendentes',
      value: `${kpis.pendingDepositsKz.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} Kz`,
      sub: `${kpis.pendingDepositsCount} pedido(s) por validar`,
    },
    {
      label: 'Levantamentos Pendentes',
      value: `${kpis.pendingWithdrawalsKz.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} Kz`,
      sub: `${kpis.pendingWithdrawalsCount} pedido(s) por processar`,
    },
    {
      label: 'Ordens Abertas no CLOB',
      value: kpis.openClobOrdersCount.toLocaleString('pt-PT'),
      sub: 'Livro ativo (OPEN + PARTIAL)',
    },
    {
      label: 'Negociações Executadas',
      value: kpis.executionsCount.toLocaleString('pt-PT'),
      delta: kpis.executionsDeltaPct,
    },
  ];

  const humanPct =
    participation.totalExecutionsCount > 0
      ? Number(((participation.humanExecutionsCount / participation.totalExecutionsCount) * 100).toFixed(1))
      : 0;
  const botPct =
    participation.totalExecutionsCount > 0
      ? Number(((participation.botExecutionsCount / participation.totalExecutionsCount) * 100).toFixed(1))
      : 0;
  const ammPct =
    participation.totalExecutionsCount > 0
      ? Number(((participation.ammExecutionsCount / participation.totalExecutionsCount) * 100).toFixed(1))
      : 0;

  return (
    <div className="space-y-6">
      {/* Header Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-market-text-muted">
        <span>
          {isMasterView
            ? 'Visão executiva consolidada (Firestore + Motor CLOB/AMM + Contabilidade SQLite)'
            : 'Resumo operacional em tempo real com dados executados e reconciliados'}
        </span>
        {generatedAt && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            Atualizado: {new Date(generatedAt).toLocaleString('pt-PT')}
          </span>
        )}
      </div>

      {/* 10 Real KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="market-card p-4 flex flex-col justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-market-text-muted">
              {card.label}
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-white">{card.value}</span>
            {'delta' in card && card.delta !== undefined ? (
              <DeltaTag delta={card.delta} />
            ) : (
              <span className="text-[11px] text-market-text-muted">{card.sub}</span>
            )}
          </div>
        ))}
      </div>

      {/* Row 1: Volume + Fees */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Executed Trading Volume */}
        <div className="lg:col-span-7 market-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-market-green" />
                Volume de Negociação Executado (Kz)
              </h3>
              <p className="text-xs text-market-text-muted mt-0.5">
                Apenas negócios liquidados no CLOB (`clob_executions`). Ordens canceladas ou abertas não entram no cálculo.
              </p>
            </div>
            <div className="flex bg-market-bg border border-market-border rounded-lg p-0.5">
              {(['area', 'bar', 'line'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setVolChartMode(mode)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                    volChartMode === mode ? 'bg-market-green text-black' : 'text-market-text-muted hover:text-white'
                  }`}
                >
                  {mode === 'area' ? 'Área' : mode === 'bar' ? 'Barras' : 'Linha'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[260px]">
            {volumeSeries.length === 0 ? (
              <EmptyChartState message="Sem execuções CLOB registadas no período selecionado." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {volChartMode === 'area' ? (
                  <AreaChart data={volumeSeries}>
                    <defs>
                      <linearGradient id="clobVolGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00c853" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00c853" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                    <XAxis dataKey="label" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} Kz`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }}
                      formatter={(val: any) => [`${Number(val).toLocaleString('pt-PT')} Kz`, 'Volume Executado']}
                    />
                    <Area type="monotone" dataKey="volumeKz" name="Volume (Kz)" stroke="#00c853" strokeWidth={2} fill="url(#clobVolGrad)" />
                  </AreaChart>
                ) : volChartMode === 'bar' ? (
                  <BarChart data={volumeSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                    <XAxis dataKey="label" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} Kz`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }}
                      formatter={(val: any) => [`${Number(val).toLocaleString('pt-PT')} Kz`, 'Volume Executado']}
                    />
                    <Bar dataKey="volumeKz" name="Volume (Kz)" fill="#00c853" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={volumeSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                    <XAxis dataKey="label" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} Kz`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }}
                      formatter={(val: any) => [`${Number(val).toLocaleString('pt-PT')} Kz`, 'Volume Executado']}
                    />
                    <Line type="monotone" dataKey="volumeKz" name="Volume (Kz)" stroke="#00c853" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2. Platform Fee Revenue */}
        <div className="lg:col-span-5 market-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              Receitas de Comissões da Plataforma (Kz)
            </h3>
            <p className="text-xs text-market-text-muted mt-0.5">
              Comissões cobradas sobre execuções reais. Depósitos de utilizadores não são receita.
            </p>
          </div>
          <div className="h-[260px]">
            {volumeSeries.length === 0 ? (
              <EmptyChartState message="Sem comissões geradas no período selecionado." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                  <XAxis dataKey="label" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} Kz`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }}
                    formatter={(val: any) => [`${Number(val).toLocaleString('pt-PT')} Kz`, 'Comissões']}
                  />
                  <Bar dataKey="feesKz" name="Comissões (Kz)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: User Growth + Deposits vs Withdrawals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. User Growth */}
        <div className="market-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Crescimento de Utilizadores Registados
            </h3>
            <p className="text-xs text-market-text-muted mt-0.5">
              Evolução real de contas criadas no Firestore ao longo do período selecionado.
            </p>
          </div>
          <div className="h-[240px]">
            {userGrowthSeries.length === 0 ? (
              <EmptyChartState message="Sem registos de utilizadores no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowthSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                  <XAxis dataKey="label" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="totalUsers" name="Total Acumulado" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="newUsers" name="Novos no Dia" stroke="#00c853" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 4. Deposits vs Withdrawals */}
        <div className="market-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Fluxo de Depósitos e Levantamentos (Kz)
            </h3>
            <p className="text-xs text-market-text-muted mt-0.5">
              Comparação de pedidos aprovados de entrada e saída de fundos dos utilizadores.
            </p>
          </div>
          <div className="h-[240px]">
            {financeFlowSeries.length === 0 ? (
              <EmptyChartState message="Sem depósitos ou levantamentos registados no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeFlowSeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                  <XAxis dataKey="label" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} Kz`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }}
                    formatter={(val: any) => `${Number(val).toLocaleString('pt-PT')} Kz`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="depositsKz" name="Depósitos (Kz)" fill="#00c853" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="withdrawalsKz" name="Levantamentos (Kz)" fill="#ff3d00" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Top Markets Horizontal Bar + CLOB Activity & Real Participation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 5. Top Traded Markets (Horizontal Bar) */}
        <div className="lg:col-span-6 market-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-market-green" />
              Mercados Mais Negociados (Volume Executado)
            </h3>
            <p className="text-xs text-market-text-muted mt-0.5">
              Ranking real por volume executado no livro CLOB durante o período selecionado.
            </p>
          </div>
          <div className="h-[260px]">
            {topMarkets.length === 0 ? (
              <EmptyChartState message="Nenhum mercado registou negociações no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMarkets} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#21262d" />
                  <XAxis type="number" stroke="#8b949e" fontSize={11} tickFormatter={(v) => `${v} Kz`} />
                  <YAxis
                    type="category"
                    dataKey="marketQuestion"
                    width={150}
                    stroke="#8b949e"
                    fontSize={10}
                    tickFormatter={(v) => (String(v).length > 24 ? `${String(v).slice(0, 24)}…` : String(v))}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }}
                    formatter={(val: any) => [`${Number(val).toLocaleString('pt-PT')} Kz`, 'Volume']}
                  />
                  <Bar dataKey="volumeKz" name="Volume (Kz)" radius={[0, 4, 4, 0]}>
                    {topMarkets.map((m, idx) => (
                      <Cell key={m.marketId} fill={idx === 0 ? '#00c853' : idx < 3 ? '#3b82f6' : '#64748b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 6. CLOB Order Activity + Real Human/Bot/AMM Share */}
        <div className="lg:col-span-6 market-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Atividade de Ordens no CLOB
              </h3>
              <p className="text-xs text-market-text-muted mt-0.5">
                Ordens submetidas, executadas e canceladas/rejeitadas, com origem real das contrapartes.
              </p>
            </div>
          </div>

          <div className="h-[190px]">
            {orderActivitySeries.length === 0 ? (
              <EmptyChartState message="Sem ordens CLOB submetidas no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderActivitySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                  <XAxis dataKey="label" stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8b949e" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="filled" name="Executadas" fill="#00c853" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="created" name="Submetidas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cancelled" name="Canceladas" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="rejected" name="Rejeitadas" fill="#ff3d00" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Real counterparty participation (never hardcoded!) */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-market-border">
            <div className="bg-market-bg border border-market-border rounded-lg p-2.5">
              <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Humanos</span>
              <span className="text-sm font-mono font-bold text-market-green tabular-nums">
                {humanPct}% ({participation.humanExecutionsCount})
              </span>
            </div>
            <div className="bg-market-bg border border-market-border rounded-lg p-2.5">
              <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Bots Sandbox</span>
              <span className="text-sm font-mono font-bold text-purple-400 tabular-nums">
                {botPct}% ({participation.botExecutionsCount})
              </span>
            </div>
            <div className="bg-market-bg border border-market-border rounded-lg p-2.5">
              <span className="text-[10px] uppercase text-market-text-muted font-semibold block">AMM Empresa</span>
              <span className="text-sm font-mono font-bold text-blue-400 tabular-nums">
                {ammPct}% ({participation.ammExecutionsCount})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
