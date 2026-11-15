import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  CheckCircle,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { User } from '../../types';
import { firebaseService } from '../../lib/firebase-service';
import { ammApi } from '../../lib/amm-api';

function maskDetails(raw: string | undefined): string {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

export const UsersAndFinancePanel = ({
  mode,
  users,
  requests,
  trades,
  sqlAccounts,
  sqlPositions,
  actorRole,
  platformFeePct,
  addToast,
  onRefreshData,
}: {
  mode: 'users' | 'wallets' | 'deposits' | 'withdrawals' | 'kyc';
  users: User[];
  requests: any[];
  trades: any[];
  sqlAccounts: any[];
  sqlPositions: any[];
  actorRole: 'MASTER_ADMIN' | 'OPERATIONAL_ADMIN' | 'USER';
  platformFeePct: number;
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
}) => {
  const isMaster = actorRole === 'MASTER_ADMIN';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Detail & action modals
  const [inspectUser, setInspectUser] = useState<User | null>(null);
  const [userLedger, setUserLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [editingBalanceUser, setEditingBalanceUser] = useState<User | null>(null);
  const [newBalanceKz, setNewBalanceKz] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  const sqlAccountMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of sqlAccounts || []) m.set(a.user_id, a);
    return m;
  }, [sqlAccounts]);

  const userTradeStats = useMemo(() => {
    const stats = new Map<string, { volume: number; count: number; fees: number }>();
    for (const t of trades || []) {
      const uid = t.user_id;
      if (!uid) continue;
      const cur = stats.get(uid) || { volume: 0, count: 0, fees: 0 };
      cur.volume += Number(t.amount || 0);
      cur.count += 1;
      cur.fees += Number(t.fee || 0);
      stats.set(uid, cur);
    }
    return stats;
  }, [trades]);

  const userPositionsMap = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of sqlPositions || []) {
      const list = m.get(p.user_id) || [];
      list.push(p);
      m.set(p.user_id, list);
    }
    return m;
  }, [sqlPositions]);

  const openUserDrawer = async (u: User) => {
    setInspectUser(u);
    setLoadingLedger(true);
    try {
      const entries = await firebaseService.getUserLedger(u.id);
      setUserLedger(entries || []);
    } catch {
      setUserLedger([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleToggleBlockUser = async (userId: string, currentStatus?: string) => {
    const nextStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    setBusyId(userId);
    try {
      await firebaseService.updateUserProfile(userId, { status: nextStatus });
      await firebaseService.logAdminAction(
        'admin',
        nextStatus === 'blocked' ? 'BLOCK_USER' : 'UNBLOCK_USER',
        `Utilizador ${userId} alterado para estado ${nextStatus}.`
      );
      addToast(`Utilizador ${nextStatus === 'blocked' ? 'suspenso' : 'reativado'} com sucesso.`, 'info');
      onRefreshData();
    } catch (e: any) {
      addToast('Erro ao atualizar estado do utilizador: ' + e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleManualBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBalanceUser) return;
    if (!isMaster) {
      addToast('Apenas o Master Admin pode alterar saldos manualmente.', 'error');
      return;
    }
    const parsed = parseFloat(newBalanceKz);
    if (isNaN(parsed) || parsed < 0) {
      addToast('Introduza um montante numérico não negativo.', 'error');
      return;
    }
    if (balanceReason.trim().length < 5) {
      addToast('Justificação obrigatória (mínimo 5 caracteres).', 'error');
      return;
    }
    setBusyId(editingBalanceUser.id);
    try {
      await ammApi.adminUpdateUserBalance(editingBalanceUser.id, parsed, balanceReason.trim());
      addToast(`Saldo de ${editingBalanceUser.name} atualizado para ${parsed.toLocaleString('pt-PT')} Kz.`, 'success');
      setEditingBalanceUser(null);
      setNewBalanceKz('');
      setBalanceReason('');
      onRefreshData();
    } catch (e: any) {
      addToast('Erro ao ajustar saldo: ' + e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleProcessFinance = async (reqId: string, status: 'approved' | 'rejected') => {
    setBusyId(reqId);
    try {
      await ammApi.processFinanceRequest(reqId, status);
      addToast(
        status === 'approved'
          ? 'Operação financeira aprovada e reconciliada no SQLite + Firestore.'
          : 'Pedido financeiro rejeitado e registado na auditoria.',
        status === 'approved' ? 'success' : 'info'
      );
      onRefreshData();
    } catch (e: any) {
      addToast('Erro ao processar solicitação: ' + e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleKycDecision = async (userId: string, approve: boolean) => {
    setBusyId(userId);
    try {
      await firebaseService.updateUserProfile(userId, {
        verification_status: approve ? 'verified' : 'rejected',
        is_verified: approve,
        status: 'active',
      });
      await firebaseService.logAdminAction(
        'admin',
        approve ? 'KYC_APPROVED' : 'KYC_REJECTED',
        `KYC de ${userId} marcado como ${approve ? 'verificado' : 'rejeitado'}.`
      );
      addToast(approve ? 'Identidade KYC verificada.' : 'Verificação KYC rejeitada.', approve ? 'success' : 'info');
      onRefreshData();
    } catch (e: any) {
      addToast('Erro ao atualizar KYC: ' + e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (mode === 'kyc') {
        const kycState = u.verification_status || (u.is_verified ? 'verified' : 'none');
        if (statusFilter === 'pending' && kycState !== 'pending' && u.status !== 'pending_verification') return false;
        if (statusFilter === 'verified' && !u.is_verified && kycState !== 'verified') return false;
        if (statusFilter === 'rejected' && kycState !== 'rejected') return false;
        if (statusFilter === 'all' && q === '') {
          // Default to showing all KYC relevant accounts
        }
      } else {
        if (statusFilter === 'active' && u.status === 'blocked') return false;
        if (statusFilter === 'blocked' && u.status !== 'blocked') return false;
        if (statusFilter === 'verified' && !u.is_verified) return false;
      }
      if (!q) return true;
      return (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.id || '').toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter, mode]);

  const filteredFinanceRequests = useMemo(() => {
    const targetType = mode === 'deposits' ? 'deposit' : 'withdrawal';
    const q = search.trim().toLowerCase();
    return (requests || []).filter((r) => {
      if (r.type !== targetType) return false;
      if (statusFilter !== 'all' && (r.status || 'pending') !== statusFilter) return false;
      if (!q) return true;
      return (
        String(r.id || '').toLowerCase().includes(q) ||
        String(r.user_id || '').toLowerCase().includes(q) ||
        String(r.user_name || r.userName || '').toLowerCase().includes(q) ||
        String(r.details || '').toLowerCase().includes(q)
      );
    });
  }, [requests, mode, statusFilter, search]);

  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);
  const paginatedRequests = filteredFinanceRequests.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="market-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {mode === 'users' && <Users className="w-4 h-4 text-market-green" />}
          {mode === 'wallets' && <Wallet className="w-4 h-4 text-blue-400" />}
          {mode === 'deposits' && <ArrowDownToLine className="w-4 h-4 text-market-green" />}
          {mode === 'withdrawals' && <ArrowUpFromLine className="w-4 h-4 text-market-red" />}
          {mode === 'kyc' && <ShieldCheck className="w-4 h-4 text-cyan-400" />}
          <div>
            <h2 className="text-sm font-bold text-white">
              {mode === 'users'
                ? 'Gestão Completa de Utilizadores'
                : mode === 'wallets'
                  ? 'Carteiras e Colateral (Firestore + CLOB)'
                  : mode === 'deposits'
                    ? 'Depósitos de Utilizadores'
                    : mode === 'withdrawals'
                      ? 'Levantamentos de Utilizadores'
                      : 'Verificação de Identidade (KYC)'}
            </h2>
            <p className="text-[11px] text-market-text-muted">
              {mode === 'deposits' || mode === 'withdrawals'
                ? 'Aprovações atualizam atomicamente o saldo SQLite, Firestore e Livro Razão.'
                : mode === 'users'
                  ? 'Clique num utilizador para inspecionar histórico, posições, carteira e auditoria.'
                  : 'Controlo operacional com separação estrita de permissões.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-market-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Pesquisar nome, email, ID..."
              className="bg-market-bg border border-market-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white w-56"
            />
          </div>

          {mode === 'deposits' || mode === 'withdrawals' ? (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-market-bg border border-market-border rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="all">Todos Estados</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovados</option>
              <option value="rejected">Rejeitados</option>
            </select>
          ) : mode === 'kyc' ? (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-market-bg border border-market-border rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendentes</option>
              <option value="verified">Verificados</option>
              <option value="rejected">Rejeitados</option>
            </select>
          ) : (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-market-bg border border-market-border rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="blocked">Bloqueados</option>
              <option value="verified">KYC Verificado</option>
            </select>
          )}
        </div>
      </div>

      {/* USERS TABLE */}
      {mode === 'users' && (
        <div className="market-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Utilizador / ID</th>
                  <th className="px-4 py-3">Registo</th>
                  <th className="px-4 py-3">Estado / KYC</th>
                  <th className="px-4 py-3 text-right">Saldo Disponível</th>
                  <th className="px-4 py-3 text-right">Reservado</th>
                  <th className="px-4 py-3 text-right">Volume Negociado</th>
                  <th className="px-4 py-3 text-right">Nº Operações</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-market-text-muted">
                      Nenhum utilizador encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const sql = sqlAccountMap.get(u.id);
                    const availKz = sql ? sql.available_cents / 100 : Number(u.balance || 0);
                    const reservedKz = sql ? sql.reserved_cents / 100 : 0;
                    const tStats = userTradeStats.get(u.id) || { volume: 0, count: 0, fees: 0 };
                    const isBlocked = u.status === 'blocked';
                    return (
                      <tr key={u.id} className="hover:bg-market-card-lighter/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{u.name || 'Sem nome'}</span>
                            {u.is_admin && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[9px] font-bold uppercase">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-market-text-muted font-mono">{u.email}</div>
                          <div className="text-[10px] text-market-text-muted/70 font-mono">ID: {u.id.slice(0, 12)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-market-text-muted">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-PT') : '—'}
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isBlocked ? 'bg-market-red/15 text-market-red' : 'bg-market-green/15 text-market-green'
                              }`}
                            >
                              {isBlocked ? 'Bloqueado' : 'Ativo'}
                            </span>
                          </div>
                          <div className="text-[10px] text-market-text-muted">
                            KYC:{' '}
                            <span className={u.is_verified || u.verification_status === 'verified' ? 'text-market-green' : 'text-amber-400'}>
                              {u.is_verified || u.verification_status === 'verified'
                                ? 'Verificado'
                                : u.verification_status === 'pending'
                                  ? 'Pendente'
                                  : 'Não verificado'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-white">
                          {availKz.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">
                          {reservedKz.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-market-green">
                          {tStats.volume.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-white">{tStats.count}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openUserDrawer(u)}
                              className="p-1.5 rounded bg-market-bg border border-market-border text-market-text-muted hover:text-white"
                              title="Inspecionar detalhes"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={busyId === u.id}
                              onClick={() => handleToggleBlockUser(u.id, u.status)}
                              className={`p-1.5 rounded border ${
                                isBlocked
                                  ? 'border-market-green/30 text-market-green hover:bg-market-green/10'
                                  : 'border-market-red/30 text-market-red hover:bg-market-red/10'
                              }`}
                              title={isBlocked ? 'Reativar conta' : 'Suspender conta'}
                            >
                              {isBlocked ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WALLETS VIEW */}
      {mode === 'wallets' && (
        <div className="market-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Titular</th>
                  <th className="px-4 py-3 text-right">Firestore (Kz)</th>
                  <th className="px-4 py-3 text-right">CLOB Disponível (Kz)</th>
                  <th className="px-4 py-3 text-right">CLOB Reservado (Kz)</th>
                  <th className="px-4 py-3 text-right">Posições Ativas</th>
                  <th className="px-4 py-3 text-right">Ajuste Master</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {paginatedUsers.map((u) => {
                  const sql = sqlAccountMap.get(u.id);
                  const posList = userPositionsMap.get(u.id) || [];
                  return (
                    <tr key={u.id} className="hover:bg-market-card-lighter/40">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block">{u.name || 'Sem nome'}</span>
                        <span className="text-[11px] font-mono text-market-text-muted">{u.email}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                        {Number(u.balance || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-market-green">
                        {((sql ? sql.available_cents : Number(u.balance || 0) * 100) / 100).toLocaleString('pt-PT', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">
                        {((sql?.reserved_cents || 0) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">{posList.length}</td>
                      <td className="px-4 py-3 text-right">
                        {isMaster ? (
                          <button
                            onClick={() => {
                              setEditingBalanceUser(u);
                              setNewBalanceKz(String(u.balance || 0));
                            }}
                            className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold hover:bg-amber-500/25"
                          >
                            Ajustar Saldo
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-market-text-muted">
                            <Lock className="w-3 h-3" /> Master
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPOSITS & WITHDRAWALS SEPARATED TABLES */}
      {(mode === 'deposits' || mode === 'withdrawals') && (
        <div className="market-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">ID Pedido</th>
                  <th className="px-4 py-3">Utilizador</th>
                  <th className="px-4 py-3 text-right">Valor Bruto</th>
                  <th className="px-4 py-3 text-right">Taxa</th>
                  <th className="px-4 py-3 text-right">Líquido</th>
                  <th className="px-4 py-3">Método / Referência</th>
                  <th className="px-4 py-3 text-center">Comprovativo</th>
                  <th className="px-4 py-3 text-center">Estado / Admin</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-market-text-muted">
                      Sem solicitações de {mode === 'deposits' ? 'depósito' : 'levantamento'} encontradas.
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((req) => {
                    const amt = Number(req.amount || 0);
                    const fee = mode === 'withdrawals' ? Number((amt * (platformFeePct / 100) * 0).toFixed(2)) : 0;
                    const net = Number((amt - fee).toFixed(2));
                    const st = req.status || 'pending';
                    return (
                      <tr key={req.id} className="hover:bg-market-card-lighter/40">
                        <td className="px-4 py-3 font-mono text-[11px] text-market-text-muted">
                          <div>{String(req.id).slice(0, 10)}</div>
                          <div className="text-[10px]">{req.created_at ? new Date(req.created_at).toLocaleString('pt-PT') : '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{req.user_name || req.userName || 'Utilizador'}</div>
                          <div className="text-[10px] font-mono text-market-text-muted">{req.user_id?.slice(0, 14)}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-white">
                          {amt.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-market-text-muted">
                          {fee.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-market-green font-semibold">
                          {net.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          <span className="text-white uppercase block">{req.method || 'iban'}</span>
                          <span className="text-market-text-muted">{maskDetails(req.details)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {req.proof_url && !String(req.proof_url).includes('unsplash.com') ? (
                            <button
                              onClick={() => setProofPreviewUrl(req.proof_url)}
                              className="px-2 py-1 rounded bg-blue-500/15 text-blue-300 text-[10px] font-semibold hover:bg-blue-500/25"
                            >
                              Ver Recibo
                            </button>
                          ) : (
                            <span className="text-[11px] text-market-text-muted">Sem anexo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              st === 'approved'
                                ? 'bg-market-green/15 text-market-green'
                                : st === 'rejected'
                                  ? 'bg-market-red/15 text-market-red'
                                  : 'bg-amber-500/15 text-amber-400'
                            }`}
                          >
                            {st === 'approved' ? 'Aprovado' : st === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </span>
                          {req.processed_by && (
                            <div className="text-[10px] font-mono text-market-text-muted mt-0.5">
                              Admin: {String(req.processed_by).slice(0, 10)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {st === 'pending' ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                disabled={busyId === req.id}
                                onClick={() => handleProcessFinance(req.id, 'approved')}
                                className="px-2.5 py-1 rounded bg-market-green/15 text-market-green hover:bg-market-green hover:text-black text-[11px] font-bold transition-colors"
                              >
                                {busyId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aprovar'}
                              </button>
                              <button
                                disabled={busyId === req.id}
                                onClick={() => handleProcessFinance(req.id, 'rejected')}
                                className="px-2.5 py-1 rounded bg-market-red/15 text-market-red hover:bg-market-red hover:text-white text-[11px] font-bold transition-colors"
                              >
                                Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-market-text-muted">Liquidado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KYC TABLE */}
      {mode === 'kyc' && (
        <div className="market-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-market-bg text-market-text-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Utilizador</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Estado KYC</th>
                  <th className="px-4 py-3 text-right">Registo</th>
                  <th className="px-4 py-3 text-right">Decisão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-market-text-muted">
                      Sem registos para o filtro KYC selecionado.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const kyc = u.verification_status || (u.is_verified ? 'verified' : 'none');
                    return (
                      <tr key={u.id} className="hover:bg-market-card-lighter/40">
                        <td className="px-4 py-3 font-semibold text-white">{u.name || 'Sem nome'}</td>
                        <td className="px-4 py-3 font-mono text-market-text-muted">{u.email}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              kyc === 'verified'
                                ? 'bg-market-green/15 text-market-green'
                                : kyc === 'pending'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : kyc === 'rejected'
                                    ? 'bg-market-red/15 text-market-red'
                                    : 'bg-market-bg text-market-text-muted'
                            }`}
                          >
                            {kyc === 'verified'
                              ? 'Verificado'
                              : kyc === 'pending'
                                ? 'Pendente'
                                : kyc === 'rejected'
                                  ? 'Rejeitado'
                                  : 'Não submetido'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-market-text-muted">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-PT') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              disabled={busyId === u.id}
                              onClick={() => handleKycDecision(u.id, true)}
                              className="px-2.5 py-1 rounded bg-market-green/15 text-market-green hover:bg-market-green hover:text-black text-[11px] font-bold"
                            >
                              Aprovar KYC
                            </button>
                            <button
                              disabled={busyId === u.id}
                              onClick={() => handleKycDecision(u.id, false)}
                              className="px-2.5 py-1 rounded bg-market-red/15 text-market-red hover:bg-market-red hover:text-white text-[11px] font-bold"
                            >
                              Rejeitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs font-mono text-market-text-muted">
        <span>
          Página {page} ·{' '}
          {mode === 'deposits' || mode === 'withdrawals'
            ? `${filteredFinanceRequests.length} pedidos`
            : `${filteredUsers.length} utilizadores`}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 rounded border border-market-border disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            disabled={
              mode === 'deposits' || mode === 'withdrawals'
                ? page * pageSize >= filteredFinanceRequests.length
                : page * pageSize >= filteredUsers.length
            }
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-market-border disabled:opacity-40"
          >
            Seguinte
          </button>
        </div>
      </div>

      {/* USER INSPECTION MODAL / DRAWER */}
      {inspectUser && (
        <div className="fixed inset-0 z-[120] bg-black/75 flex items-center justify-end">
          <div className="w-full max-w-xl h-full bg-[#0d1117] border-l border-market-border p-6 overflow-y-auto space-y-6">
            <div className="flex items-start justify-between border-b border-market-border pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-market-green" />
                  {inspectUser.name || 'Utilizador'}
                </h3>
                <p className="text-xs font-mono text-market-text-muted mt-0.5">{inspectUser.email}</p>
                <p className="text-[11px] font-mono text-market-text-muted">UID: {inspectUser.id}</p>
              </div>
              <button onClick={() => setInspectUser(null)} className="p-1.5 rounded-lg hover:bg-market-card text-market-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Wallet Summary */}
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const sql = sqlAccountMap.get(inspectUser.id);
                const avail = sql ? sql.available_cents / 100 : Number(inspectUser.balance || 0);
                const resv = sql ? sql.reserved_cents / 100 : 0;
                return (
                  <>
                    <div className="market-card p-3">
                      <span className="text-[10px] uppercase text-market-text-muted block">Disponível</span>
                      <span className="text-sm font-mono font-bold text-market-green">{avail.toLocaleString('pt-PT')} Kz</span>
                    </div>
                    <div className="market-card p-3">
                      <span className="text-[10px] uppercase text-market-text-muted block">Reservado CLOB</span>
                      <span className="text-sm font-mono font-bold text-amber-400">{resv.toLocaleString('pt-PT')} Kz</span>
                    </div>
                    <div className="market-card p-3">
                      <span className="text-[10px] uppercase text-market-text-muted block">Firestore</span>
                      <span className="text-sm font-mono font-bold text-white">
                        {Number(inspectUser.balance || 0).toLocaleString('pt-PT')} Kz
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Active CLOB Positions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-market-text-muted">Posições Ativas CLOB</h4>
              <div className="market-card divide-y divide-market-border">
                {(userPositionsMap.get(inspectUser.id) || []).length === 0 ? (
                  <p className="p-4 text-xs text-market-text-muted">Sem posições CLOB abertas.</p>
                ) : (
                  (userPositionsMap.get(inspectUser.id) || []).map((p: any, i: number) => (
                    <div key={i} className="p-3 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-white font-semibold block">{p.market_id}</span>
                        <span className={p.outcome === 'Yes' ? 'text-market-green' : 'text-market-red'}>{p.outcome}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white block">{p.available_shares + p.reserved_shares} quotas</span>
                        <span className="text-market-text-muted text-[10px]">Média: {p.avg_price_cents}¢</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ledger History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-market-text-muted">Livro Razão do Utilizador</h4>
              <div className="market-card max-h-64 overflow-y-auto divide-y divide-market-border">
                {loadingLedger ? (
                  <div className="p-6 text-center text-xs text-market-text-muted">A carregar movimentos...</div>
                ) : userLedger.length === 0 ? (
                  <p className="p-4 text-xs text-market-text-muted">Sem lançamentos no ledger do utilizador.</p>
                ) : (
                  userLedger.map((l: any) => (
                    <div key={l.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">{l.type}</span>
                        <span className="text-[10px] font-mono text-market-text-muted">
                          {l.createdAt ? new Date(l.createdAt).toLocaleString('pt-PT') : '—'} · Ref: {String(l.reference || '').slice(0, 12)}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className={Number(l.amount || 0) >= 0 ? 'text-market-green font-bold' : 'text-market-red font-bold'}>
                          {Number(l.amount || 0) >= 0 ? '+' : ''}
                          {Number(l.amount || 0).toLocaleString('pt-PT')} Kz
                        </span>
                        <span className="block text-[10px] text-market-text-muted">
                          Após: {Number(l.balanceAfter || 0).toLocaleString('pt-PT')} Kz
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-market-border flex flex-wrap gap-2">
              <button
                onClick={() => handleToggleBlockUser(inspectUser.id, inspectUser.status)}
                className="market-button-outline text-xs px-4 py-2"
              >
                {inspectUser.status === 'blocked' ? 'Reativar Conta' : 'Suspender Conta'}
              </button>
              <button
                onClick={() => handleKycDecision(inspectUser.id, true)}
                className="market-button-outline text-xs px-4 py-2 text-market-green border-market-green/30"
              >
                Verificar KYC
              </button>
              {isMaster && (
                <button
                  onClick={() => {
                    setEditingBalanceUser(inspectUser);
                    setNewBalanceKz(String(inspectUser.balance || 0));
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold"
                >
                  Ajustar Saldo (Master)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MASTER ADMIN MANUAL BALANCE MODAL */}
      {editingBalanceUser && isMaster && (
        <div className="fixed inset-0 z-[130] bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleManualBalanceSubmit} className="w-full max-w-md market-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-market-border pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                Ajuste Manual Auditado (Master Admin)
              </h3>
              <button type="button" onClick={() => setEditingBalanceUser(null)} className="text-market-text-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-market-text-muted">
              Conta: <strong className="text-white">{editingBalanceUser.name}</strong> ({editingBalanceUser.email})
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-market-text-muted mb-1">Novo Saldo (Kz)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={newBalanceKz}
                onChange={(e) => setNewBalanceKz(e.target.value)}
                className="market-input font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-market-text-muted mb-1">
                Justificação Obrigatória (Auditoria)
              </label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                placeholder="Descreva o motivo contabilístico deste ajuste..."
                className="market-input text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingBalanceUser(null)} className="market-button-outline flex-1 text-xs">
                Cancelar
              </button>
              <button type="submit" disabled={busyId === editingBalanceUser.id} className="market-button-primary flex-1 text-xs">
                {busyId === editingBalanceUser.id ? 'A aplicar...' : 'Confirmar Ajuste'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECEIPT PROOF PREVIEW MODAL */}
      {proofPreviewUrl && (
        <div className="fixed inset-0 z-[130] bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-lg w-full market-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Comprovativo Submetido pelo Utilizador</span>
              <button onClick={() => setProofPreviewUrl(null)} className="text-market-text-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={proofPreviewUrl} alt="Comprovativo financeiro" className="w-full max-h-[65vh] object-contain rounded-lg bg-black" />
          </div>
        </div>
      )}
    </div>
  );
};
