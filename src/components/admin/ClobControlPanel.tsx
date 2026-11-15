import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  BookOpen,
  CandlestickChart,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { Market } from '../../types';
import { ammApi } from '../../lib/amm-api';
import { PeriodFilter } from './AdminShell';

const DIST_COLORS = ['#00c853', '#3b82f6', '#10b981', '#06b6d4', '#f59e0b', '#ff3d00'];

export const ClobControlPanel = ({
  markets,
  period,
  initialMode = 'orders',
  addToast,
}: {
  markets: Market[];
  period: PeriodFilter;
  initialMode?: 'orders' | 'orderbook' | 'master_clob';
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const [selectedMarketId, setSelectedMarketId] = useState<string>(markets[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sideFilter, setSideFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [tableTab, setTableTab] = useState<'orders' | 'executions'>(initialMode === 'master_clob' ? 'executions' : 'orders');
  const [candleInterval, setCandleInterval] = useState<'5m' | '15m' | '1h' | '1d'>('1h');

  const [data, setData] = useState<any>(null);
  const [candles, setCandles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClob = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetMarket = selectedMarketId || (initialMode === 'orderbook' ? markets[0]?.id || '' : '');
      const [clobRes, candleRes] = await Promise.all([
        ammApi.getClobOverview({
          period: period.preset,
          from: period.from,
          to: period.to,
          marketId: targetMarket || undefined,
          status: statusFilter || undefined,
          side: sideFilter || undefined,
          search: search || undefined,
          page,
          limit: 20,
        }),
        targetMarket ? ammApi.getClobCandles(targetMarket, candleInterval, 'Yes').catch(() => ({ candles: [] })) : Promise.resolve({ candles: [] }),
      ]);
      setData(clobRes);
      setCandles(candleRes.candles || []);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados do CLOB.');
    } finally {
      setLoading(false);
    }
  }, [period.preset, period.from, period.to, selectedMarketId, statusFilter, sideFilter, search, page, candleInterval, initialMode, markets]);

  useEffect(() => {
    loadClob();
  }, [loadClob]);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await ammApi.cancelClobOrder(orderId);
      addToast(`Ordem ${orderId.slice(0, 8)} cancelada e colateral desbloqueado.`, 'success');
      loadClob();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao cancelar ordem.', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const kpis = data?.kpis || {
    totalOrders: 0,
    openOrders: 0,
    partialOrders: 0,
    filledOrders: 0,
    cancelledOrders: 0,
    rejectedOrders: 0,
    executedVolumeKz: 0,
    totalFeesKz: 0,
    executionsCount: 0,
  };

  const book = data?.orderBook;

  // Build cumulative depth arrays cleanly from bids/asks
  const yesBidsDepth = (() => {
    const levels = book?.yes?.bids || [];
    let acc = 0;
    return levels.slice(0, 10).map((l: any) => {
      acc += l.quantity || 0;
      return { ...l, cumulative: acc };
    });
  })();

  const yesAsksDepth = (() => {
    const levels = book?.yes?.asks || [];
    let acc = 0;
    return levels.slice(0, 10).map((l: any) => {
      acc += l.quantity || 0;
      return { ...l, cumulative: acc };
    });
  })();

  return (
    <div className="space-y-6">
      {/* Top Filters Bar */}
      <div className="market-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedMarketId}
            onChange={(e) => {
              setSelectedMarketId(e.target.value);
              setPage(1);
            }}
            className="bg-market-bg border border-market-border rounded-lg px-3 py-2 text-xs text-white max-w-xs"
          >
            <option value="">Todos os Mercados</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.question}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-market-bg border border-market-border rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="">Todos Estados</option>
            <option value="OPEN">OPEN</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="FILLED">FILLED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="REJECTED">REJECTED</option>
          </select>

          <select
            value={sideFilter}
            onChange={(e) => {
              setSideFilter(e.target.value);
              setPage(1);
            }}
            className="bg-market-bg border border-market-border rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="">Compra e Venda</option>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-market-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ID ordem, utilizador ou mercado..."
              className="bg-market-bg border border-market-border rounded-lg pl-8 pr-3 py-2 text-xs text-white w-56"
            />
          </div>
        </div>

        <button
          onClick={loadClob}
          disabled={loading}
          className="market-button-outline text-xs px-3 py-2 inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-market-green' : ''}`} />
          Atualizar CLOB
        </button>
      </div>

      {error && (
        <div className="market-card p-4 border-market-red/40 text-xs text-market-red flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Ordens', val: kpis.totalOrders, cls: 'text-white' },
          { label: 'Abertas / Parciais', val: kpis.openOrders + kpis.partialOrders, cls: 'text-blue-400' },
          { label: 'Executadas (Filled)', val: kpis.filledOrders, cls: 'text-market-green' },
          { label: 'Canceladas', val: kpis.cancelledOrders, cls: 'text-amber-400' },
          { label: 'Rejeitadas', val: kpis.rejectedOrders, cls: 'text-market-red' },
          { label: 'Volume Executado', val: `${Number(kpis.executedVolumeKz).toLocaleString('pt-PT')} Kz`, cls: 'text-market-green' },
          { label: 'Comissões CLOB', val: `${Number(kpis.totalFeesKz).toLocaleString('pt-PT')} Kz`, cls: 'text-cyan-400' },
        ].map((c) => (
          <div key={c.label} className="market-card p-3.5 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-market-text-muted block">{c.label}</span>
            <span className={`text-lg font-mono font-bold tabular-nums block ${c.cls}`}>{c.val}</span>
          </div>
        ))}
      </div>

      {/* Live Order Book + Real OHLCV Candlesticks (when a market is selected or in OrderBook view) */}
      {(selectedMarketId || initialMode === 'orderbook') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Order Book Depth */}
          <div className="lg:col-span-6 market-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-market-green" />
                  Livro de Ofertas (Contrato SIM)
                </h3>
                <p className="text-xs text-market-text-muted">
                  Profundidade real ordenada por prioridade Preço/Tempo (`clob_orders`).
                </p>
              </div>
              {book?.yes && (
                <div className="text-right font-mono text-xs">
                  <span className="text-market-text-muted block text-[10px]">Spread</span>
                  <span className="text-white font-bold">
                    {book.yes.bestAskCents && book.yes.bestBidCents
                      ? `${book.yes.bestAskCents - book.yes.bestBidCents}¢`
                      : 'Sem spread'}
                  </span>
                </div>
              )}
            </div>

            {!selectedMarketId ? (
              <p className="text-xs text-market-text-muted py-10 text-center">
                Selecione um mercado no filtro acima para inspecionar o livro de ofertas completo.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <div className="flex justify-between text-[10px] uppercase text-market-green font-bold pb-1.5 border-b border-market-border">
                    <span>Compra (Bids)</span>
                    <span>Qtd / Acum.</span>
                  </div>
                  <div className="divide-y divide-market-border/50 mt-1">
                    {yesBidsDepth.length === 0 ? (
                      <p className="py-6 text-center text-market-text-muted text-[11px]">Sem ofertas de compra</p>
                    ) : (
                      yesBidsDepth.map((lvl: any) => (
                        <div key={`bid-${lvl.priceCents}`} className="py-1.5 flex justify-between tabular-nums">
                          <span className="text-market-green font-bold">{lvl.priceCents}¢</span>
                          <span className="text-white">
                            {lvl.quantity} <span className="text-market-text-muted">({lvl.cumulative})</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] uppercase text-market-red font-bold pb-1.5 border-b border-market-border">
                    <span>Venda (Asks)</span>
                    <span>Qtd / Acum.</span>
                  </div>
                  <div className="divide-y divide-market-border/50 mt-1">
                    {yesAsksDepth.length === 0 ? (
                      <p className="py-6 text-center text-market-text-muted text-[11px]">Sem ofertas de venda</p>
                    ) : (
                      yesAsksDepth.map((lvl: any) => (
                        <div key={`ask-${lvl.priceCents}`} className="py-1.5 flex justify-between tabular-nums">
                          <span className="text-market-red font-bold">{lvl.priceCents}¢</span>
                          <span className="text-white">
                            {lvl.quantity} <span className="text-market-text-muted">({lvl.cumulative})</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real OHLC Candlestick Chart from clob_executions */}
          <div className="lg:col-span-6 market-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CandlestickChart className="w-4 h-4 text-blue-400" />
                  Velas OHLCV Reais (Execuções CLOB)
                </h3>
                <p className="text-xs text-market-text-muted">
                  Abertura, máximo, mínimo e fecho calculados estritamente de `clob_executions`.
                </p>
              </div>
              <div className="flex bg-market-bg border border-market-border rounded-lg p-0.5">
                {(['5m', '15m', '1h', '1d'] as const).map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setCandleInterval(iv)}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${
                      candleInterval === iv ? 'bg-blue-500 text-white' : 'text-market-text-muted hover:text-white'
                    }`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[220px]">
              {candles.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-market-text-muted border border-dashed border-market-border rounded-lg">
                  Sem execuções CLOB suficientes neste mercado para formar velas OHLCV.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={candles}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                    <XAxis dataKey="time" stroke="#8b949e" fontSize={10} />
                    <YAxis domain={[0, 100]} stroke="#8b949e" fontSize={10} tickFormatter={(v) => `${v}¢`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }}
                      formatter={(val: any, name: string) => [`${val}¢`, name]}
                    />
                    <Bar dataKey="high" name="Máxima (¢)" fill="#3b82f620" />
                    <Line type="monotone" dataKey="close" name="Fecho (¢)" stroke="#00c853" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="open" name="Abertura (¢)" stroke="#8b949e" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity + Order Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 market-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-market-green" />
              Atividade de Negociação CLOB no Período
            </h3>
            <p className="text-xs text-market-text-muted">Volume executado (Kz) e número de execuções reais</p>
          </div>
          <div className="h-[220px]">
            {(data?.activitySeries || []).length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-market-text-muted border border-dashed border-market-border rounded-lg">
                Sem execuções CLOB no período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.activitySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                  <XAxis dataKey="label" stroke="#8b949e" fontSize={11} />
                  <YAxis stroke="#8b949e" fontSize={11} tickFormatter={(v) => `${v} Kz`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="volumeKz" name="Volume (Kz)" stroke="#00c853" strokeWidth={2} />
                  <Line type="monotone" dataKey="feesKz" name="Taxas (Kz)" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 market-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Distribuição de Ordens</h3>
            <p className="text-xs text-market-text-muted">Estados e direção das ordens filtradas</p>
          </div>
          <div className="h-[220px]">
            {(data?.distribution || []).every((d: any) => d.value === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-market-text-muted border border-dashed border-market-border rounded-lg">
                Sem ordens no filtro atual.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.distribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3}>
                    {data.distribution.map((_: any, i: number) => (
                      <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Orders & Executions Paginated Tables */}
      <div className="market-card overflow-hidden">
        <div className="p-4 border-b border-market-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTableTab('orders');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                tableTab === 'orders' ? 'bg-market-green text-black' : 'bg-market-bg text-market-text-muted hover:text-white'
              }`}
            >
              Ordens CLOB ({data?.totalOrders || 0})
            </button>
            <button
              onClick={() => {
                setTableTab('executions');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                tableTab === 'executions' ? 'bg-market-green text-black' : 'bg-market-bg text-market-text-muted hover:text-white'
              }`}
            >
              Execuções Liquidadas ({data?.totalExecutions || 0})
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-market-border disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-market-text-muted">Pág. {page}</span>
            <button
              disabled={
                tableTab === 'orders'
                  ? (data?.orders?.length || 0) < 20
                  : (data?.executions?.length || 0) < 20
              }
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded border border-market-border disabled:opacity-40"
            >
              Seguinte
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-market-text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-market-green" />
              A carregar registos CLOB...
            </div>
          ) : tableTab === 'orders' ? (
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">ID / Seq</th>
                  <th className="px-4 py-3">Mercado</th>
                  <th className="px-4 py-3">Utilizador</th>
                  <th className="px-4 py-3">Lado / Contrato</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-right">Exec / Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Data</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {(data?.orders || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-market-text-muted">
                      Sem ordens encontradas para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  data.orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-market-card-lighter/40">
                      <td className="px-4 py-3 font-mono text-[11px] text-white">
                        #{o.seq} · {o.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 max-w-[220px] truncate text-white" title={o.market_question || o.market_id}>
                        {o.market_question || o.market_id}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-market-text-muted">
                        {o.is_amm ? 'AMM_EMPRESA' : o.user_id.slice(0, 14)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={o.side === 'Buy' ? 'text-market-green font-bold' : 'text-market-red font-bold'}>
                          {o.side}
                        </span>{' '}
                        <span className="text-white">{o.outcome}</span>{' '}
                        <span className="text-[10px] text-market-text-muted">({o.order_type})</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">{o.price_cents}¢</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                        {o.filled_quantity} / {o.quantity}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            o.status === 'FILLED'
                              ? 'bg-market-green/15 text-market-green'
                              : o.status === 'OPEN' || o.status === 'PARTIAL'
                                ? 'bg-blue-500/15 text-blue-400'
                                : o.status === 'CANCELLED'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-market-red/15 text-market-red'
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-market-text-muted">
                        {new Date(o.created_at).toLocaleString('pt-PT')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(o.status === 'OPEN' || o.status === 'PARTIAL') && (
                          <button
                            disabled={cancellingId === o.id}
                            onClick={() => handleCancelOrder(o.id)}
                            className="p-1.5 rounded bg-market-red/10 text-market-red hover:bg-market-red hover:text-white transition-colors"
                            title="Cancelar ordem aberta"
                          >
                            {cancellingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Mercado</th>
                  <th className="px-4 py-3">Maker</th>
                  <th className="px-4 py-3">Taker</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">Taxa</th>
                  <th className="px-4 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {(data?.executions || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-market-text-muted">
                      Sem execuções liquidadas para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  data.executions.map((ex: any) => (
                    <tr key={ex.id} className="hover:bg-market-card-lighter/40">
                      <td className="px-4 py-3 font-mono text-[11px] text-white">{ex.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-white">{ex.market_question || ex.market_id}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-market-text-muted">
                        {ex.maker_user_id === 'AMM_MERCADOAO_COMPANY' ? 'AMM_EMPRESA' : ex.maker_user_id.slice(0, 14)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-market-text-muted">
                        {ex.taker_user_id === 'AMM_MERCADOAO_COMPANY' ? 'AMM_EMPRESA' : ex.taker_user_id.slice(0, 14)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                        {ex.price_cents}¢ ({ex.outcome})
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">{ex.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-market-green font-semibold">
                        {(ex.notional_cents / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-400">
                        {(ex.fee_cents / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-market-text-muted">
                        {new Date(ex.created_at).toLocaleString('pt-PT')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
