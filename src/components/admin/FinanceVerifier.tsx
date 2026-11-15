import React, { useState } from 'react';
import { 
  Users, CheckCircle, Ban, Edit, ArrowDownToLine, ArrowUpFromLine, 
  Shield, DollarSign, Wallet, ShieldCheck, XCircle, Search, Sparkles, Loader2 
} from 'lucide-react';
import { firebaseService } from '../../lib/firebase-service';
import { ammApi } from '../../lib/amm-api';
import { User, Market } from '../../types';

export const FinanceVerifier = ({ 
  users, 
  requests, 
  addToast, 
  onRefreshData,
  currentTab = 'users'
}: { 
  users: User[]; 
  requests: any[]; 
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
  currentTab?: 'users' | 'finance' | 'verification';
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [injectAmount, setInjectAmount] = useState<string>('');

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingVerificationUsers = users.filter(u => u.status === 'pending_verification' || u.verification_status === 'pending');

  const handleUpdateUserBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsLoading(true);
    try {
      const parsed = parseFloat(injectAmount);
      if (isNaN(parsed)) {
        addToast('Introduza um montante numérico válido.', 'error');
        return;
      }

      await ammApi.adminUpdateUserBalance(
        editingUser.id,
        parsed,
        'Ajuste manual via Painel Administrativo'
      );

      addToast(`Saldo de ${editingUser.name} sincronizado no CLOB e BD para ${parsed.toLocaleString()} KZ!`, 'success');
      setEditingUser(null);
      setInjectAmount('');
      onRefreshData();
    } catch (e: any) {
      addToast('Erro ao atualizar: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBlockUser = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    try {
      await firebaseService.updateUserProfile(userId, { status: nextStatus });
      onRefreshData();
      addToast(`Utilizador ${nextStatus === 'blocked' ? 'bloqueado' : 'desbloqueado'}!`, 'info');
    } catch (e: any) {
      addToast('Erro ao bloquear utilizador: ' + e.message, 'error');
    }
  };

  const handleApproveFinance = async (request: any) => {
    try {
      await ammApi.processFinanceRequest(request.id, 'approved');
      onRefreshData();
      addToast('Pedido financeiro APROVADO e sincronizado no motor CLOB + Livro Razão!', 'success');
    } catch (error: any) {
      addToast('Erro ao aprovar transição: ' + error.message, 'error');
    }
  };

  const handleRejectFinance = async (requestId: string) => {
    try {
      await ammApi.processFinanceRequest(requestId, 'rejected');
      onRefreshData();
      addToast('Pedido de transação REJEITADO e registado na Auditoria.', 'info');
    } catch (error: any) {
      addToast('Erro ao rejeitar: ' + error.message, 'error');
    }
  };

  const handleApproveVerification = async (userId: string) => {
    try {
      await firebaseService.updateUserProfile(userId, { 
        verification_status: 'verified',
        is_verified: true,
        status: 'active'
      });
      onRefreshData();
      addToast('Identidade verificada com sucesso! Emissora de selo verde ativa.', 'success');
    } catch (error: any) {
      addToast('Erro ao verificar: ' + error.message, 'error');
    }
  };

  const handleRejectVerification = async (userId: string) => {
    try {
      await firebaseService.updateUserProfile(userId, { 
        verification_status: 'rejected',
        is_verified: false
      });
      onRefreshData();
      addToast('Verificação KYC rejeitada.', 'info');
    } catch (error: any) {
      addToast('Erro ao rejeitar verificação: ' + error.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {currentTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Users className="w-4 h-4 text-market-green" />
                Gestão de Utilizadores e Carteiras
              </h3>
              <p className="text-xs text-market-text-muted mt-1">Inspeção de contas registradas, permissões administrativas e edição direta de saldos</p>
            </div>

            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-market-text-muted group-focus-within:text-market-green transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar por carteira ou nome..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="market-input pl-12 py-2.5 w-full text-xs"
              />
            </div>
          </div>

          <div className="market-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="market-table">
                <thead>
                  <tr className="bg-market-card-lighter/20">
                    <th className="market-table-header py-4 text-right lg:text-left">Utilizador</th>
                    <th className="market-table-header py-4">Status Conta</th>
                    <th className="market-table-header text-right py-4">Saldo</th>
                    <th className="market-table-header text-center py-4">Selo KYC</th>
                    <th className="market-table-header text-right py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-market-text-muted italic text-xs">
                        Nenhum utilizador encontrado nos registros locais.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-market-card-lighter/50 transition-colors group">
                        <td className="market-table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-market-card flex items-center justify-center font-bold text-sm border border-market-border text-white">
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </div>
                            <div className="flex flex-col text-right lg:text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white group-hover:text-market-green transition-all">{u.name || 'Sem nome'}</span>
                                {u.is_admin && (
                                  <span className="px-1.5 py-0.5 bg-market-green/20 text-[#00ff88] text-[8px] font-black uppercase rounded tracking-tight">Admin</span>
                                )}
                              </div>
                              <span className="text-[10px] text-market-text-muted font-mono">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="market-table-cell">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            u.status === 'active' || !u.status 
                              ? 'bg-market-green/10 text-market-green border-market-green/20' 
                              : 'bg-market-red/10 text-market-red border-market-red/20'
                          }`}>
                            {u.status === 'blocked' ? 'Bloqueado' : 'Ativo'}
                          </span>
                        </td>
                        <td className="market-table-cell text-right font-mono font-bold text-white text-sm">
                          {u.balance.toLocaleString()} KZ
                        </td>
                        <td className="market-table-cell text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            u.verification_status === 'verified' || u.is_verified
                              ? 'bg-market-green/10 text-market-green' 
                              : u.verification_status === 'pending'
                              ? 'bg-amber-500/10 text-amber-500 animate-pulse'
                              : 'bg-market-card text-market-text-muted'
                          }`}>
                            <Shield className="w-3 h-3" />
                            {u.verification_status === 'verified' || u.is_verified ? 'Verificado' : u.verification_status === 'pending' ? 'Pendente' : 'Não Verificado'}
                          </span>
                        </td>
                        <td className="market-table-cell text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setInjectAmount(u.balance.toString());
                              }}
                              className="p-2 hover:bg-market-card rounded-xl text-market-text-muted hover:text-white transition-all hover:scale-110"
                              title="Injetar/Retirar Saldo"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleBlockUser(u.id, u.status || 'active')}
                              className={`p-2 rounded-xl transition-all border ${
                                u.status === 'blocked' 
                                  ? 'border-market-green/10 text-market-green hover:bg-market-green/10' 
                                  : 'border-market-red/10 text-market-red hover:bg-market-red/10'
                              }`}
                              title={u.status === 'blocked' ? "Desbloquear" : "Bloquear"}
                            >
                              {u.status === 'blocked' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </button>
                          </div>
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

      {currentTab === 'finance' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-market-green" />
              Solicitações de Depósito e Levantamento de Fundos
            </h3>
            <p className="text-xs text-market-text-muted mt-1">Análise e liberação de comprovativos e transações financeiras pendentes</p>
          </div>

          <div className="market-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="market-table">
                <thead>
                  <tr className="bg-market-card-lighter/20">
                    <th className="market-table-header py-4 text-right lg:text-left">Tipo</th>
                    <th className="market-table-header py-4">Utilizador</th>
                    <th className="market-table-header text-right py-4">Montante</th>
                    <th className="market-table-header text-center py-4">Data Registro</th>
                    <th className="market-table-header text-center py-4">Status</th>
                    <th className="market-table-header text-right py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-market-text-muted italic text-xs">
                        Nenhum pedido de transação registrado.
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="hover:bg-market-card-lighter/50 transition-colors group">
                        <td className="market-table-cell">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-[9px] uppercase tracking-wider ${
                            req.type === 'deposit' 
                              ? 'bg-market-green/5 text-market-green border-market-green/15' 
                              : 'bg-market-red/5 text-market-red border-market-red/15'
                          }`}>
                            {req.type === 'deposit' ? <ArrowDownToLine className="w-3.5 h-3.5" /> : <ArrowUpFromLine className="w-3.5 h-3.5" />}
                            {req.type === 'deposit' ? 'Depósito' : 'Saque'}
                          </span>
                        </td>
                        <td className="market-table-cell">
                          <div className="flex flex-col text-right lg:text-left">
                            <span className="text-white font-bold">{req.userName || 'Nome pendente'}</span>
                            <span className="text-[10px] text-market-text-muted font-mono">{req.userEmail || 'ID: ' + req.user_id?.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="market-table-cell text-right font-mono font-bold text-white text-sm">
                          {req.amount.toLocaleString()} KZ
                        </td>
                        <td className="market-table-cell text-center">
                          <span className="text-xs text-market-text-muted font-semibold">
                            {req.created_at ? new Date(req.created_at).toLocaleString() : 'Recent'}
                          </span>
                        </td>
                        <td className="market-table-cell text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            req.status === 'approved' 
                              ? 'bg-market-green/10 text-market-green border-market-green/20' 
                              : req.status === 'rejected'
                              ? 'bg-market-red/10 text-market-red border-market-red/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                          }`}>
                            {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="market-table-cell text-right">
                          {req.status === 'pending' || !req.status ? (
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleApproveFinance(req)}
                                className="p-2 bg-market-green/10 text-market-green hover:bg-market-green hover:text-market-bg rounded-xl transition-all"
                                title="Aprovar Pedido"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleRejectFinance(req.id)}
                                className="p-2 bg-market-red/10 text-market-red hover:bg-market-red hover:text-white rounded-xl transition-all"
                                title="Rejeitar Pedido"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-market-text-muted font-bold italic pr-2">Concluído</span>
                          )}
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

      {currentTab === 'verification' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Verificação de Identidades (KYC Hub)
            </h3>
            <p className="text-xs text-market-text-muted mt-1">Liberação do selo verificado de autenticidade para garantir traders válidos</p>
          </div>

          <div className="market-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="market-table">
                <thead>
                  <tr className="bg-market-card-lighter/20">
                    <th className="market-table-header py-4 text-right lg:text-left">Utilizador</th>
                    <th className="market-table-header py-4">Email</th>
                    <th className="market-table-header text-center py-4">Data Ingresso</th>
                    <th className="market-table-header text-right py-4">Ações de Auditoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border">
                  {pendingVerificationUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-market-text-muted italic text-xs">
                        Nenhum utilizador aguarda verificação kyc pendente de momento.
                      </td>
                    </tr>
                  ) : (
                    pendingVerificationUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-market-card-lighter/50 transition-colors group">
                        <td className="market-table-cell font-bold text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 font-black border border-blue-500/20 flex items-center justify-center">
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </div>
                            <span>{u.name || 'Nome pendente'}</span>
                          </div>
                        </td>
                        <td className="market-table-cell font-mono text-xs text-market-text-muted">
                          {u.email}
                        </td>
                        <td className="market-table-cell text-center text-xs text-market-text-muted font-bold">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Não informada'}
                        </td>
                        <td className="market-table-cell text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveVerification(u.id)}
                              className="px-4 py-2 bg-market-green/20 text-market-green border border-market-green/30 text-[10px] uppercase font-black tracking-widest rounded-xl hover:bg-market-green hover:text-market-bg transition-colors"
                            >
                              Verificar Carteira
                            </button>

                            <button
                              onClick={() => handleRejectVerification(u.id)}
                              className="px-4 py-2 bg-market-red/10 text-market-red border border-market-red/20 text-[10px] uppercase font-black tracking-widest rounded-xl hover:bg-market-red hover:text-white transition-colors"
                            >
                              Rejeitar
                            </button>
                          </div>
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

      {/* Inject / Edit wallet Balance overlay modal card */}
      {editingUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-market-card p-6 rounded-2xl border border-market-border space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-market-border pb-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Wallet className="w-4 h-4 text-market-green" />
                Injetar / Remover Saldo
              </h4>
              <button onClick={() => setEditingUser(null)} className="text-market-text-muted hover:text-white font-bold">&times;</button>
            </div>

            <div className="bg-market-bg p-4 rounded-xl border border-market-border space-y-1">
              <span className="text-[10px] text-market-text-muted uppercase font-bold">Titular da Conta:</span>
              <span className="text-white font-bold block">{editingUser.name}</span>
              <span className="text-[10px] text-market-text-muted block">Saldo atual no BD: <strong>{editingUser.balance.toLocaleString()} KZ</strong></span>
            </div>

            <form onSubmit={handleUpdateUserBalance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Novo Saldo (Montante KZ)</label>
                <input 
                  type="number" 
                  step="any"
                  required
                  value={injectAmount}
                  onChange={(e) => setInjectAmount(e.target.value)}
                  className="market-input w-full font-mono text-sm"
                  placeholder="Ex: 50000"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="market-button-outline flex-1 py-3">Cancelar</button>
                <button type="submit" disabled={isLoading} className="market-button-primary flex-1 py-3 flex items-center justify-center">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-market-bg" /> : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
