import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileBarChart2,
  GitCompare,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { Market, User } from '../../types';
import { ammApi } from '../../lib/amm-api';
import { PeriodFilter } from './AdminShell';

function downloadCsv(filename: string, headers: string[], rows: any[][]) {
  const esc = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const FinancialPnlAndRecon = ({
  mode,
  period,
  markets,
  users,
  requests,
  actorRole,
  addToast,
  onRefreshData,
}: {
  mode: 'pnl' | 'reconciliation' | 'reports';
  period: PeriodFilter;
  markets: Market[];
  users: User[];
  requests: any[];
  actorRole: 'MASTER_ADMIN' | 'OPERATIONAL_ADMIN' | 'USER';
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
}) => {
  const isMaster = actorRole === 'MASTER_ADMIN';
  const [loading, setLoading] = useState(false);
  const [pnlData, setPnlData] = useState<any>(null);
  const [reconData, setReconData] = useState<any>(null);

  const [marketFilter, setMarketFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [reconJustification, setReconJustification] = useState('');
  const [runningRecon, setRunningRecon] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'pnl') {
        const res = await ammApi.getProfitAndLoss({
          period: period.preset,
          from: period.from,
          to: period.to,
          marketId: marketFilter || undefined,
          source: sourceFilter,
        });
        setPnlData(res);
      } else if (mode === 'reconciliation') {
        const res = await ammApi.getReconciliationOverview();
        setReconData(res);
      }
    } catch (err: any) {
      addToast(err?.message || 'Erro ao carregar dados financeiros.', 'error');
    } finally {
      setLoading(false);
    }
  }, [mode, period.preset, period.from, period.to, marketFilter, sourceFilter, addToast]);

  useEffect(() => {
    if (mode !== 'reports') {
      loadData();
    }
  }, [mode, loadData]);

  const handleRunReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) {
      addToast('Apenas o Master Admin pode executar reconciliação manual.', 'error');
      return;
    }
    if (reconJustification.trim().length < 8) {
      addToast('Insira uma justificação com pelo menos 8 caracteres.', 'error');
      return;
    }
    setRunningRecon(true);
    try {
      const res = await ammApi.runAuditedReconciliation(reconJustification.trim());
      addToast(
        `Reconciliação concluída: ${res.syncedCount} sincronizadas, ${res.divergentFlagged} divergências sinalizadas.`,
        res.divergentFlagged > 0 ? 'info' : 'success'
      );
      setReconJustification('');
      loadData();
      onRefreshData();
    } catch (err: any) {
      addToast(err?.message || 'Erro na reconciliação.', 'error');
    } finally {
      setRunningRecon(false);
    }
  };

  if (mode === 'pnl') {
    const s = pnlData?.summary || {
      clobFeesKz: 0,
      ammRealizedPnlKz: 0,
      ammUnrealizedPnlKz: 0,
      operationalCostsKz: 0,
      netPlatformProfitKz: 0,
      executedVolumeKz: 0,
      excludedUserDepositsKz: 0,
      excludedUserWithdrawalsKz: 0,
      excludedCompanyEquityKz: 250000,
    };

    return (
      <div className="space-y-6">
        {/* Accounting Integrity Banner */}
        <div className="market-card p-4 border-blue-500/30 bg-blue-500/5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <span className="font-bold text-white block">
              Separação Contabilística Estrita — Profit & Loss Real da Empresa
            </span>
            <p className="text-market-text-muted">
              Depósitos de utilizadores ({Number(s.excludedUserDepositsKz).toLocaleString('pt-PT')} Kz) e Capital Próprio
              Empresarial ({Number(s.excludedCompanyEquityKz).toLocaleString('pt-PT')} Kz) estão{' '}
              <strong className="text-white">excluídos das receitas e lucros</strong>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="bg-market-bg border border-market-border rounded-lg px-3 py-1.5 text-xs text-white max-w-xs"
            >
              <option value="">Todos os Mercados</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.question}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-market-bg border border-market-border rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="all">Todas as Origens</option>
              <option value="fees">Apenas Comissões CLOB</option>
              <option value="amm">Apenas Trading AMM</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="market-card p-4">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Comissões CLOB</span>
            <span className="text-xl font-mono font-bold text-blue-400 tabular-nums mt-1 block">
              {Number(s.clobFeesKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
            </span>
          </div>
          <div className="market-card p-4">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">P&L Realizado AMM</span>
            <span
              className={`text-xl font-mono font-bold tabular-nums mt-1 block ${
                s.ammRealizedPnlKz >= 0 ? 'text-market-green' : 'text-market-red'
              }`}
            >
              {Number(s.ammRealizedPnlKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
            </span>
          </div>
          <div className="market-card p-4">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">P&L Não Realizado AMM</span>
            <span
              className={`text-xl font-mono font-bold tabular-nums mt-1 block ${
                s.ammUnrealizedPnlKz >= 0 ? 'text-cyan-400' : 'text-amber-400'
              }`}
            >
              {Number(s.ammUnrealizedPnlKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
            </span>
          </div>
          <div className="market-card p-4">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Custos Operacionais</span>
            <span className="text-xl font-mono font-bold text-market-red tabular-nums mt-1 block">
              {Number(s.operationalCostsKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
            </span>
          </div>
          <div className="market-card p-4">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Lucro Líquido Realizado</span>
            <span
              className={`text-xl font-mono font-bold tabular-nums mt-1 block ${
                s.netPlatformProfitKz >= 0 ? 'text-market-green' : 'text-market-red'
              }`}
            >
              {Number(s.netPlatformProfitKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
            </span>
          </div>
        </div>

        {/* Daily & Cumulative Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="market-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-market-green" />
              Lucro Líquido Acumulado (Kz)
            </h3>
            <div className="h-[240px]">
              {loading ? (
                <div className="h-full flex items-center justify-center text-xs text-market-text-muted">A carregar...</div>
              ) : (pnlData?.dailySeries || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-market-text-muted border border-dashed border-market-border rounded-lg">
                  Sem movimentos de receita ou P&L no período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pnlData.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                    <XAxis dataKey="label" stroke="#8b949e" fontSize={11} />
                    <YAxis stroke="#8b949e" fontSize={11} tickFormatter={(v) => `${v} Kz`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="cumulativeProfitKz" name="Lucro Acumulado (Kz)" stroke="#00c853" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="market-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Receitas por Origem (Comissões vs AMM)</h3>
            <div className="h-[240px]">
              {(pnlData?.dailySeries || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-market-text-muted border border-dashed border-market-border rounded-lg">
                  Sem operações no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlData.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                    <XAxis dataKey="label" stroke="#8b949e" fontSize={11} />
                    <YAxis stroke="#8b949e" fontSize={11} tickFormatter={(v) => `${v} Kz`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="feeRevenueKz" name="Comissões (Kz)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ammRealizedKz" name="P&L AMM (Kz)" fill="#00c853" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Breakdown by Market */}
        <div className="market-card overflow-hidden">
          <div className="p-4 border-b border-market-border">
            <h3 className="text-sm font-bold text-white">Rentabilidade Detalhada por Mercado</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Mercado</th>
                  <th className="px-4 py-3 text-right">Volume Executado</th>
                  <th className="px-4 py-3 text-right">Comissões</th>
                  <th className="px-4 py-3 text-right">AMM Realizado</th>
                  <th className="px-4 py-3 text-right">AMM Não Realizado</th>
                  <th className="px-4 py-3 text-right">Resultado Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {(pnlData?.byMarket || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-market-text-muted">
                      Sem dados de mercado no período.
                    </td>
                  </tr>
                ) : (
                  pnlData.byMarket.map((m: any) => (
                    <tr key={m.marketId} className="hover:bg-market-card-lighter/40">
                      <td className="px-4 py-3 font-medium text-white max-w-xs truncate">{m.marketQuestion}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                        {Number(m.volumeKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-400">
                        {Number(m.feesKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums ${
                          m.ammRealizedKz >= 0 ? 'text-market-green' : 'text-market-red'
                        }`}
                      >
                        {Number(m.ammRealizedKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-cyan-400">
                        {Number(m.ammUnrealizedKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${
                          m.netResultKz >= 0 ? 'text-market-green' : 'text-market-red'
                        }`}
                      >
                        {Number(m.netResultKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'reconciliation') {
    const ent = reconData?.enterprise;
    const counts = reconData?.counts || { synchronized: 0, pending: 0, divergent: 0, errors: 0 };

    return (
      <div className="space-y-6">
        {/* Enterprise Double-Entry Checks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="market-card p-4 space-y-1">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Partidas Dobradas (SQLite)</span>
            <span className={`text-sm font-bold flex items-center gap-1.5 ${ent?.reconciled ? 'text-market-green' : 'text-market-red'}`}>
              {ent?.reconciled ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {ent?.reconciled ? 'RECONCILIADO' : 'DIVERGENTE'}
            </span>
            <span className="text-[11px] font-mono text-market-text-muted block">
              Dif: {((ent?.discrepancyCents || 0) / 100).toFixed(2)} Kz
            </span>
          </div>
          <div className="market-card p-4 space-y-1">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Contas Sincronizadas</span>
            <span className="text-xl font-mono font-bold text-market-green tabular-nums">{counts.synchronized}</span>
            <span className="text-[11px] text-market-text-muted">Pendentes CLOB: {counts.pending}</span>
          </div>
          <div className="market-card p-4 space-y-1">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Divergências Detetadas</span>
            <span className={`text-xl font-mono font-bold tabular-nums ${counts.divergent > 0 ? 'text-amber-400' : 'text-white'}`}>
              {counts.divergent}
            </span>
            <span className="text-[11px] text-market-text-muted">Erros de integridade: {counts.errors}</span>
          </div>
          <div className="market-card p-4 space-y-1">
            <span className="text-[10px] uppercase text-market-text-muted font-semibold block">Reserva Protegida 50k</span>
            <span className={`text-sm font-bold ${ent?.protectedReserveIntact ? 'text-market-green' : 'text-market-red'}`}>
              {ent?.protectedReserveIntact ? 'INTACTA (INVIOLÁVEL)' : 'VIOLAÇÃO DETETADA'}
            </span>
            <span className="text-[11px] font-mono text-market-text-muted block">
              Alocado: {((ent?.totalAllocatedCents || 0) / 100).toLocaleString('pt-PT')} Kz
            </span>
          </div>
        </div>

        {/* Master Admin Audited Reconciliation Execution */}
        {isMaster && (
          <form onSubmit={handleRunReconciliation} className="market-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-amber-400" />
                Executar Reconciliação Auditada Firestore ↔ SQLite
              </h3>
              <button type="button" onClick={loadData} className="text-xs text-market-text-muted hover:text-white inline-flex items-center gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
            </div>
            <p className="text-xs text-market-text-muted">
              Verifica todas as contas Firestore contra a custódia SQLite CLOB, sincroniza contas livres e regista trilha de auditoria imutável.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                minLength={8}
                value={reconJustification}
                onChange={(e) => setReconJustification(e.target.value)}
                placeholder="Justificação formal para o registo de auditoria (mín. 8 caracteres)..."
                className="market-input text-xs py-2.5 flex-1"
              />
              <button
                type="submit"
                disabled={runningRecon}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0"
              >
                {runningRecon ? 'A reconciliar...' : 'Executar Reconciliação'}
              </button>
            </div>
          </form>
        )}

        {/* Comparison Table */}
        <div className="market-card overflow-hidden">
          <div className="p-4 border-b border-market-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Comparação de Saldos Firestore vs SQLite</h3>
            {reconData?.firestoreFetchError && (
              <span className="text-xs text-market-red">{reconData.firestoreFetchError}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Utilizador</th>
                  <th className="px-4 py-3 text-right">Firestore</th>
                  <th className="px-4 py-3 text-right">SQLite Disponível</th>
                  <th className="px-4 py-3 text-right">SQLite Reservado</th>
                  <th className="px-4 py-3 text-right">Diferença</th>
                  <th className="px-4 py-3 text-right">Posições</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-market-text-muted">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />A comparar Firestore e SQLite...
                    </td>
                  </tr>
                ) : (reconData?.accounts || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-market-text-muted">
                      Nenhuma conta encontrada para reconciliação.
                    </td>
                  </tr>
                ) : (
                  reconData.accounts.map((r: any) => (
                    <tr key={r.userId} className="hover:bg-market-card-lighter/40">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block">{r.name}</span>
                        <span className="text-[10px] font-mono text-market-text-muted">{r.email || r.userId}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                        {Number(r.firestoreBalanceKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-market-green">
                        {Number(r.sqliteAvailableKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">
                        {Number(r.sqliteReservedKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${
                          r.differenceKz === 0 ? 'text-market-text-muted' : 'text-market-red'
                        }`}
                      >
                        {Number(r.differenceKz).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                        {r.activePositions} ({r.totalShares})
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'SINCRONIZADO'
                              ? 'bg-market-green/15 text-market-green'
                              : r.status === 'PENDENTE'
                                ? 'bg-blue-500/15 text-blue-400'
                                : r.status === 'DIVERGENCIA'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-market-red/15 text-market-red'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // REPORTS MODE
  const handleExport = async (type: 'users' | 'deposits' | 'withdrawals' | 'clob_execs' | 'ledger') => {
    setExportingKey(type);
    try {
      if (type === 'users') {
        downloadCsv(
          'mercadoao_utilizadores.csv',
          ['ID', 'Nome', 'Email', 'Saldo_Kz', 'Estado', 'KYC', 'Admin', 'Criado_Em'],
          users.map((u) => [u.id, u.name, u.email || '', u.balance, u.status || 'active', u.is_verified ? 'Sim' : 'Não', u.is_admin ? 'Sim' : 'Não', u.created_at || ''])
        );
      } else if (type === 'deposits' || type === 'withdrawals') {
        const target = type === 'deposits' ? 'deposit' : 'withdrawal';
        const filtered = requests.filter((r) => r.type === target);
        downloadCsv(
          `mercadoao_${type}.csv`,
          ['ID', 'User_ID', 'Nome', 'Tipo', 'Montante_Kz', 'Metodo', 'Estado', 'Criado_Em'],
          filtered.map((r) => [r.id, r.user_id, r.user_name || r.userName || '', r.type, r.amount, r.method || '', r.status || 'pending', r.created_at || ''])
        );
      } else if (type === 'clob_execs') {
        const res = await ammApi.getClobOverview({ period: period.preset, from: period.from, to: period.to, limit: 100 });
        downloadCsv(
          'mercadoao_clob_execucoes.csv',
          ['ID', 'Mercado', 'Maker', 'Taker', 'Resultado', 'Preco_Cent', 'Qtd', 'Notional_Kz', 'Taxa_Kz', 'Data'],
          (res.executions || []).map((e: any) => [
            e.id,
            e.market_question || e.market_id,
            e.maker_user_id,
            e.taker_user_id,
            e.outcome,
            e.price_cents,
            e.quantity,
            (e.notional_cents / 100).toFixed(2),
            (e.fee_cents / 100).toFixed(2),
            e.created_at,
          ])
        );
      } else if (type === 'ledger') {
        const res = await ammApi.getLedger();
        const rows: any[][] = [];
        for (const entry of res.entries || []) {
          for (const line of entry.lines || []) {
            rows.push([
              entry.id,
              entry.created_at,
              entry.reference_type,
              entry.market_id || '',
              entry.description,
              line.account_code,
              (line.debit_cents / 100).toFixed(2),
              (line.credit_cents / 100).toFixed(2),
              entry.actor_id,
            ]);
          }
        }
        downloadCsv(
          'mercadoao_livro_razao_partidas_dobradas.csv',
          ['Entry_ID', 'Data', 'Tipo', 'Mercado', 'Descricao', 'Conta', 'Debito_Kz', 'Credito_Kz', 'Ator'],
          rows
        );
      }
      addToast('Relatório CSV exportado com sucesso.', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Erro ao exportar relatório.', 'error');
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="market-card p-5 space-y-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <FileBarChart2 className="w-4 h-4 text-market-green" />
          Centro de Relatórios e Exportação CSV
        </h2>
        <p className="text-xs text-market-text-muted">
          Exporte registos auditados diretamente das fontes autoritativas (Firestore + SQLite CLOB + Contabilidade de Partidas Dobradas).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            key: 'clob_execs' as const,
            title: 'Execuções CLOB (Período Atual)',
            desc: 'Negócios liquidados, contrapartes, preços, volumes e comissões.',
          },
          {
            key: 'ledger' as const,
            title: 'Livro Razão AMM (Partidas Dobradas)',
            desc: 'Todos os lançamentos de débito e crédito das 10 contas empresariais.',
          },
          {
            key: 'users' as const,
            title: 'Utilizadores e Saldos',
            desc: 'Lista completa de contas registadas, estado KYC e saldos atuais.',
          },
          {
            key: 'deposits' as const,
            title: 'Histórico de Depósitos',
            desc: 'Solicitações de depósito com método, valor e estado de aprovação.',
          },
          {
            key: 'withdrawals' as const,
            title: 'Histórico de Levantamentos',
            desc: 'Solicitações de levantamento com valor, estado e auditoria.',
          },
        ].map((item) => (
          <div key={item.key} className="market-card p-5 flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="text-xs text-market-text-muted mt-1">{item.desc}</p>
            </div>
            <button
              disabled={exportingKey === item.key}
              onClick={() => handleExport(item.key)}
              className="market-button-outline text-xs py-2 inline-flex items-center justify-center gap-2"
            >
              {exportingKey === item.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Exportar CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
