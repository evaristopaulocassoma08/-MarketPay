import React, { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  History,
  KeyRound,
  Loader2,
  Lock,
  Percent,
  RefreshCw,
  ServerCrash,
  Settings,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { User } from '../../types';
import { ammApi } from '../../lib/amm-api';

export const SystemHealthAndSecurity = ({
  mode,
  actorRole,
  users,
  auditLogs,
  platformSettings,
  addToast,
  onRefreshData,
}: {
  mode: 'health' | 'security' | 'audit' | 'master_audit' | 'settings' | 'fin_config';
  actorRole: 'MASTER_ADMIN' | 'OPERATIONAL_ADMIN' | 'USER';
  users: User[];
  auditLogs: any[];
  platformSettings: {
    tradingFee: number;
    minDeposit: number;
    minWithdrawal: number;
    maintenanceMode: boolean;
    platformName: string;
  };
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
}) => {
  const isMaster = actorRole === 'MASTER_ADMIN';
  const [health, setHealth] = useState<any>(null);
  const [globalAudit, setGlobalAudit] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState(platformSettings);
  const [settingsJustification, setSettingsJustification] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Security role action state
  const [roleReason, setRoleReason] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState('');

  useEffect(() => {
    setSettingsForm(platformSettings);
  }, [platformSettings]);

  const loadViewData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'health') {
        const res = await ammApi.getSystemHealth();
        setHealth(res);
      } else if (mode === 'audit' || mode === 'master_audit') {
        const res = await ammApi.getGlobalAudit(auditFilter || undefined, 120);
        setGlobalAudit(res);
      }
    } catch (err: any) {
      addToast(err?.message || 'Erro ao carregar telemetria/auditoria.', 'error');
    } finally {
      setLoading(false);
    }
  }, [mode, auditFilter, addToast]);

  useEffect(() => {
    if (mode === 'health' || mode === 'audit' || mode === 'master_audit') {
      loadViewData();
    }
  }, [mode, loadViewData]);

  const handleRoleToggle = async (u: User, grant: boolean) => {
    if (!isMaster) {
      addToast('Apenas o Master Admin pode alterar permissões administrativas.', 'error');
      return;
    }
    if (roleReason.trim().length < 5) {
      addToast('Introduza uma justificação (mínimo 5 caracteres) antes de alterar permissões.', 'error');
      return;
    }
    setBusyUid(u.id);
    try {
      await ammApi.updateUserAdminRole(u.id, grant, roleReason.trim());
      addToast(
        `${u.name || u.email} ${grant ? 'promovido a Admin Operacional' : 'removido da equipa administrativa'}.`,
        'success'
      );
      setRoleReason('');
      onRefreshData();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao alterar permissão.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const handleSaveMasterSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) {
      addToast('Alteração de parâmetros financeiros globais é exclusiva do Master Admin.', 'error');
      return;
    }
    if (settingsJustification.trim().length < 5) {
      addToast('Insira uma justificação obrigatória para o registo de auditoria.', 'error');
      return;
    }
    setSavingSettings(true);
    try {
      await ammApi.updateMasterPlatformSettings({
        ...settingsForm,
        justification: settingsJustification.trim(),
      });
      addToast('Configurações financeiras globais atualizadas e auditadas!', 'success');
      setSettingsJustification('');
      onRefreshData();
    } catch (err: any) {
      addToast(err?.message || 'Erro ao guardar configurações.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  if (mode === 'health') {
    return (
      <div className="space-y-6">
        <div className="market-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-market-green" />
              System Health — Telemetria Real dos Serviços
            </h2>
            <p className="text-xs text-market-text-muted">
              Sondas reais a SQLite, Firebase Auth, Firestore REST, CLOB, AMM, Risk Engine e Accounting.
              {health?.uptimeSeconds !== undefined ? ` Uptime: ${Math.floor(health.uptimeSeconds / 60)}m ${health.uptimeSeconds % 60}s` : ''}
            </p>
          </div>
          <button onClick={loadViewData} disabled={loading} className="market-button-outline text-xs px-3 py-1.5 inline-flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Testar Serviços Agora
          </button>
        </div>

        {/* Service Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(health?.services || []).map((svc: any) => {
            const isOk = svc.status === 'ONLINE';
            const isDeg = svc.status === 'DEGRADED';
            return (
              <div key={svc.id} className="market-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{svc.name}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isOk
                        ? 'bg-market-green/15 text-market-green'
                        : isDeg
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-market-red/15 text-market-red'
                    }`}
                  >
                    {isOk ? <CheckCircle2 className="w-3 h-3" /> : isDeg ? <AlertTriangle className="w-3 h-3" /> : <ServerCrash className="w-3 h-3" />}
                    {svc.status}
                  </span>
                </div>
                <div className="text-xs font-mono text-white">
                  {svc.latencyMs !== null && svc.latencyMs !== undefined ? `Latência: ${svc.latencyMs} ms` : 'Estado interno'}
                </div>
                <p className="text-[11px] text-market-text-muted leading-snug">{svc.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Observed API Latency Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 market-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Latência Real da API Express (ms)
              </h3>
              <p className="text-xs text-market-text-muted">
                Medida em pedidos HTTP `/api/*` observados pelo servidor (sem dados simulados).
              </p>
            </div>
            <div className="h-[220px]">
              {(health?.latencySeries || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-market-text-muted border border-dashed border-market-border rounded-lg">
                  Ainda não existem amostras suficientes de latência neste ciclo de execução.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={health.latencySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                    <XAxis dataKey="time" stroke="#8b949e" fontSize={11} />
                    <YAxis stroke="#8b949e" fontSize={11} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="avgLatencyMs" name="Média (ms)" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="maxLatencyMs" name="Pico (ms)" stroke="#f59e0b" strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 market-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-market-red" />
              Erros Recentes HTTP 5xx ({(health?.recentErrors || []).length})
            </h3>
            <div className="max-h-[220px] overflow-y-auto divide-y divide-market-border text-xs">
              {(health?.recentErrors || []).length === 0 ? (
                <div className="py-12 text-center text-market-text-muted">Sem erros 5xx registados desde o arranque.</div>
              ) : (
                health.recentErrors.map((err: any) => (
                  <div key={err.id} className="py-2.5 space-y-0.5">
                    <div className="flex justify-between font-mono text-[10px] text-market-red">
                      <span>
                        {err.method} {err.path} ({err.status})
                      </span>
                      <span>{new Date(err.timestamp).toLocaleTimeString('pt-PT')}</span>
                    </div>
                    <p className="text-market-text-muted text-[11px]">{err.errorMessage}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'security') {
    const admins = users.filter((u) => u.is_admin);
    const nonAdmins = users
      .filter((u) => !u.is_admin && (!roleSearch || `${u.name} ${u.email}`.toLowerCase().includes(roleSearch.toLowerCase())))
      .slice(0, 15);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="market-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Admin Operacional — Permissões Permitidas
            </h3>
            <ul className="text-xs text-market-text-muted space-y-1.5 list-disc pl-4">
              <li>Gerir mercados, categorias, publicações e bots de liquidez sandbox.</li>
              <li>Aprovar ou rejeitar depósitos, levantamentos e verificações KYC (com auditoria).</li>
              <li>Inspecionar ordens CLOB, cancelar ordens abertas e acionar Paragem de Emergência.</li>
              <li>Solicitar alocações AMM (sem auto-aprovação).</li>
              <li className="text-market-red font-semibold">Bloqueado: alterar capital empresarial, reserva 50.000 Kz, saldos manuais ou limites globais.</li>
            </ul>
          </div>
          <div className="market-card p-5 space-y-3 border-amber-500/30">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Master Admin — Controlo Soberano Exclusivo
            </h3>
            <ul className="text-xs text-market-text-muted space-y-1.5 list-disc pl-4">
              <li>Aprovar, rejeitar ou suspender alocações de capital AMM por mercado.</li>
              <li>Ativar/desativar AMM globalmente e retomar operação após investigação formal.</li>
              <li>Ajustar limites financeiros globais (3% / 4% / 5%), taxas e mínimos de depósito/saque.</li>
              <li>Executar reconciliação Firestore ↔ SQLite, ajustes manuais de saldo e gestão de equipa admin.</li>
            </ul>
          </div>
        </div>

        {/* Role Management */}
        <div className="market-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Equipa Administrativa Atual ({admins.length})</h3>
          {isMaster && (
            <input
              type="text"
              value={roleReason}
              onChange={(e) => setRoleReason(e.target.value)}
              placeholder="Justificação obrigatória para conceder/revogar acesso Admin Operacional..."
              className="market-input text-xs py-2.5"
            />
          )}
          <div className="divide-y divide-market-border">
            {admins.map((u) => {
              const isMasterEmail = String(u.email || '').toLowerCase() === 'evaristopaulocassoma00@gmail.com';
              return (
                <div key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-white">{u.name || 'Admin'}</span>
                    <span className="block font-mono text-market-text-muted">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isMasterEmail ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/15 text-blue-300'
                      }`}
                    >
                      {isMasterEmail ? 'MASTER ADMIN' : 'ADMIN OPERACIONAL'}
                    </span>
                    {isMaster && !isMasterEmail && (
                      <button
                        disabled={busyUid === u.id}
                        onClick={() => handleRoleToggle(u, false)}
                        className="px-2.5 py-1 rounded bg-market-red/15 text-market-red hover:bg-market-red hover:text-white font-bold text-[11px]"
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isMaster && (
          <div className="market-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">Promover Conta a Admin Operacional</h3>
              <input
                type="text"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Pesquisar utilizador..."
                className="bg-market-bg border border-market-border rounded-lg px-3 py-1.5 text-xs text-white w-60"
              />
            </div>
            <div className="divide-y divide-market-border">
              {nonAdmins.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-white font-medium">{u.name || 'Utilizador'}</span>
                    <span className="block font-mono text-[11px] text-market-text-muted">{u.email}</span>
                  </div>
                  <button
                    disabled={busyUid === u.id}
                    onClick={() => handleRoleToggle(u, true)}
                    className="px-3 py-1 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[11px] font-bold hover:bg-blue-500/25"
                  >
                    {busyUid === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Conceder Admin Operacional'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'audit' || mode === 'master_audit') {
    const secRows = globalAudit?.securityAudit || [];
    return (
      <div className="space-y-6">
        <div className="market-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              {mode === 'master_audit' ? 'Auditoria Global Imutável (SQLite + Firestore)' : 'Registos de Auditoria Operacional'}
            </h2>
            <p className="text-xs text-market-text-muted">Trilha verificada de decisões financeiras, risco, segurança e aprovações.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              placeholder="Filtrar ação (ex: ENABLE_AMM)..."
              className="bg-market-bg border border-market-border rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <button onClick={loadViewData} className="market-button-outline text-xs px-3 py-1.5">
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="market-card overflow-hidden">
            <div className="p-4 border-b border-market-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Auditoria de Segurança Express/SQLite ({secRows.length})</h3>
            </div>
            <div className="max-h-[460px] overflow-y-auto divide-y divide-market-border">
              {loading ? (
                <div className="p-8 text-center text-xs text-market-text-muted">A carregar auditoria...</div>
              ) : secRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-market-text-muted">Sem eventos de segurança registados.</div>
              ) : (
                secRows.map((row: any) => (
                  <div key={row.id} className="p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-market-green font-bold">
                        {row.action} · {row.actor_role}
                      </span>
                      <span className="text-market-text-muted">{new Date(row.created_at).toLocaleString('pt-PT')}</span>
                    </div>
                    <p className="text-white font-medium">{row.justification}</p>
                    <p className="text-[11px] font-mono text-market-text-muted">
                      Ator: {row.actor_email || row.actor_id} · Alvo: {row.target_id || '—'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="market-card overflow-hidden">
            <div className="p-4 border-b border-market-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Auditoria Firestore ({auditLogs.length})</h3>
            </div>
            <div className="max-h-[460px] overflow-y-auto divide-y divide-market-border">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-market-text-muted">Sem logs no Firestore.</div>
              ) : (
                auditLogs.map((log: any) => (
                  <div key={log.id} className="p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-blue-400 font-bold">{String(log.action || 'EVENTO').toUpperCase()}</span>
                      <span className="text-market-text-muted">
                        {log.created_at ? new Date(log.created_at).toLocaleString('pt-PT') : '—'}
                      </span>
                    </div>
                    <p className="text-market-text-muted leading-snug">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SETTINGS & MASTER FINANCIAL CONFIG
  return (
    <div className="space-y-6">
      <div className="market-card p-6 max-w-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-market-border pb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-market-green" />
              {mode === 'fin_config' ? 'Configuração Financeira Crítica (Master Admin)' : 'Parâmetros da Plataforma'}
            </h2>
            <p className="text-xs text-market-text-muted mt-0.5">
              Comissões globais, limites mínimos de depósito/saque e modo de manutenção.
            </p>
          </div>
          {!isMaster && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 text-[10px] font-bold">
              <Lock className="w-3 h-3" /> Somente Leitura
            </span>
          )}
        </div>

        <form onSubmit={handleSaveMasterSettings} className="space-y-4">
          <div className="bg-market-bg p-4 rounded-xl border border-market-border flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Modo de Manutenção</span>
              <span className="text-[11px] text-market-text-muted">Suspende novas submissões de ordens de utilizadores</span>
            </div>
            <button
              type="button"
              disabled={!isMaster}
              onClick={() => setSettingsForm({ ...settingsForm, maintenanceMode: !settingsForm.maintenanceMode })}
              className={`w-12 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
                settingsForm.maintenanceMode ? 'bg-market-red' : 'bg-market-border'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  settingsForm.maintenanceMode ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-market-text-muted mb-1">Comissão (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  disabled={!isMaster}
                  value={settingsForm.tradingFee}
                  onChange={(e) => setSettingsForm({ ...settingsForm, tradingFee: parseFloat(e.target.value) || 0 })}
                  className="market-input font-mono text-sm pr-8 disabled:opacity-60"
                />
                <Percent className="w-3.5 h-3.5 text-market-text-muted absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-market-text-muted mb-1">Depósito Mínimo (Kz)</label>
              <input
                type="number"
                min="0"
                disabled={!isMaster}
                value={settingsForm.minDeposit}
                onChange={(e) => setSettingsForm({ ...settingsForm, minDeposit: parseInt(e.target.value, 10) || 0 })}
                className="market-input font-mono text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-market-text-muted mb-1">Levantamento Mínimo (Kz)</label>
              <input
                type="number"
                min="0"
                disabled={!isMaster}
                value={settingsForm.minWithdrawal}
                onChange={(e) => setSettingsForm({ ...settingsForm, minWithdrawal: parseInt(e.target.value, 10) || 0 })}
                className="market-input font-mono text-sm disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-market-text-muted mb-1">Nome da Plataforma</label>
            <input
              type="text"
              disabled={!isMaster}
              value={settingsForm.platformName}
              onChange={(e) => setSettingsForm({ ...settingsForm, platformName: e.target.value })}
              className="market-input text-sm disabled:opacity-60"
            />
          </div>

          {isMaster && (
            <>
              <div>
                <label className="block text-[11px] font-bold uppercase text-market-text-muted mb-1">
                  Justificação Obrigatória (Auditoria)
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  value={settingsJustification}
                  onChange={(e) => setSettingsJustification(e.target.value)}
                  placeholder="Motivo da alteração dos parâmetros financeiros..."
                  className="market-input text-xs"
                />
              </div>
              <button type="submit" disabled={savingSettings} className="market-button-primary w-full py-2.5 text-xs">
                {savingSettings ? 'A guardar no servidor...' : 'Guardar Configuração Financeira'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
