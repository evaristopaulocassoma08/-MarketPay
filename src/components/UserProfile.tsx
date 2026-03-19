import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Settings, LogOut, Wallet, History, Shield, CheckCircle, XCircle, Clock, ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const UserProfile = ({ user, onLogout }: { user: User | null, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [iban, setIban] = useState('');
  const [method, setMethod] = useState('iban');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [investmentHistory, setInvestmentHistory] = useState<any[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);

  const fetchInvestmentHistory = async () => {
    if (!user) return;
    setFetchingHistory(true);
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*, markets(question, resolved, resolution_outcome)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setInvestmentHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const handleVerificationRequest = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'pending_verification' })
        .eq('id', user.id);
      
      if (error) throw error;
      alert("Solicitação de verificação enviada com sucesso!");
      window.location.reload();
    } catch (error) {
      console.error('Verification error:', error);
      alert("Erro ao solicitar verificação.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinanceRequest = async (type: 'deposit' | 'withdrawal') => {
    if (!user) return;
    const amount = type === 'deposit' ? parseFloat(depositAmount) : parseFloat(withdrawAmount);
    
    if (isNaN(amount) || amount <= 0) {
      alert("Montante inválido");
      return;
    }

    if (type === 'withdrawal' && amount > user.balance) {
      alert("Saldo insuficiente");
      return;
    }

    setLoading(true);
    try {
      let proofUrl = null;
      if (type === 'deposit' && proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('proofs')
          .upload(fileName, proofFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('proofs')
          .getPublicUrl(fileName);
        
        proofUrl = publicUrl;
      }

      const { error } = await supabase
        .from('finance_requests')
        .insert([{
          user_id: user.id,
          type,
          amount,
          method,
          details: method === 'iban' ? iban : 'KWIK Request',
          status: 'pending',
          proof_url: proofUrl,
          timestamp: new Date().toISOString()
        }]);

      if (error) throw error;
      alert(`Solicitação de ${type === 'deposit' ? 'depósito' : 'levantamento'} enviada!`);
      setDepositAmount('');
      setWithdrawAmount('');
      setIban('');
      setProofFile(null);
    } catch (error) {
      console.error('Finance request error:', error);
      alert("Erro ao processar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">Por favor, inicie sessão</h2>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-6">
          <div className="market-card p-6 text-center">
            <div className="w-24 h-24 mx-auto bg-market-card-lighter border-2 border-market-green rounded-full flex items-center justify-center mb-4 relative">
              <UserIcon className="w-12 h-12 text-market-text-muted" />
              {user.is_admin && (
                <div className="absolute -bottom-2 -right-2 bg-market-green text-market-bg p-1.5 rounded-full" title="Administrador">
                  <Shield className="w-4 h-4" />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              {user.name}
              {user.status === 'active' ? (
                <CheckCircle className="w-4 h-4 text-market-green" title="Perfil Verificado" />
              ) : user.status === 'pending_verification' ? (
                <Clock className="w-4 h-4 text-orange-500" title="Verificação Pendente" />
              ) : (
                <XCircle className="w-4 h-4 text-market-red" title="Perfil Não Verificado" />
              )}
            </h2>
            <p className="text-xs text-market-text-muted font-mono mt-1 break-all">{user.wallet_address}</p>
            {user.status !== 'active' && user.status !== 'pending_verification' && (
              <div className="mt-4">
                <button 
                  onClick={handleVerificationRequest}
                  disabled={loading}
                  className="text-[10px] font-bold uppercase tracking-widest text-market-green hover:text-white transition-colors border border-market-green hover:border-white rounded px-3 py-1 disabled:opacity-50"
                >
                  {loading ? 'A processar...' : 'Solicitar Verificação'}
                </button>
              </div>
            )}
          </div>

          <div className="market-card overflow-hidden">
            <div className="flex flex-col">
              {[
                { id: 'overview', label: 'Visão Geral', icon: Wallet },
                { id: 'deposit', label: 'Depositar', icon: ArrowDownToLine },
                { id: 'withdraw', label: 'Levantar', icon: ArrowUpFromLine },
                { id: 'history', label: 'Histórico', icon: History, onClick: fetchInvestmentHistory },
                { id: 'settings', label: 'Definições', icon: Settings },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.onClick) tab.onClick();
                  }}
                  className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-market-green/10 text-market-green border-l-2 border-market-green' 
                      : 'text-market-text-muted hover:bg-market-card-lighter hover:text-white border-l-2 border-transparent'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-widest text-market-red hover:bg-market-red/10 border-l-2 border-transparent transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="market-card p-6">
                  <h3 className="text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Saldo Disponível</h3>
                  <div className="text-3xl font-bold text-white">{user.balance.toLocaleString()} KZ</div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-market-text-muted">Pendente:</span>
                    <span className="font-bold text-orange-500">{(user.pending_balance || 0).toLocaleString()} KZ</span>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => setActiveTab('deposit')} className="market-button-primary py-2 px-4 text-xs flex-1">Depositar</button>
                    <button onClick={() => setActiveTab('withdraw')} className="market-button-outline py-2 px-4 text-xs flex-1">Levantar</button>
                  </div>
                </div>
                <div className="market-card p-6">
                  <h3 className="text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Valor em Posições</h3>
                  <div className="text-3xl font-bold text-white">
                    {user.positions.reduce((acc, pos) => acc + (pos.shares * pos.avg_price), 0).toLocaleString()} KZ
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-market-text-muted">Total Investido:</span>
                    <span className="font-bold text-white">{(user.invested_balance || 0).toLocaleString()} KZ</span>
                  </div>
                  <div className="mt-4 text-xs text-market-green font-bold flex items-center gap-1">
                    <span>↗ +12.5%</span> <span className="text-market-text-muted font-normal">este mês</span>
                  </div>
                </div>
              </div>

              <div className="market-card p-6">
                <h3 className="text-lg font-bold text-white mb-6">Posições Ativas</h3>
                {user.positions.length > 0 ? (
                  <div className="space-y-4">
                    {user.positions.map((pos, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-market-card-lighter rounded-xl border border-market-border">
                        <div>
                          <p className="font-bold text-white text-sm">Mercado #{pos.market_id}</p>
                          <p className="text-xs text-market-text-muted mt-1">
                            Aposta: <span className={cn("font-bold", pos.outcome === 'Yes' ? 'text-market-green' : pos.outcome === 'No' ? 'text-market-red' : 'text-blue-400')}>{pos.outcome}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{pos.shares.toLocaleString()} Ações</p>
                          <p className="text-xs text-market-text-muted mt-1">Preço Médio: {pos.avg_price} KZ</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-market-text-muted text-sm">
                    Não tem posições ativas no momento.
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'deposit' && (
            <div className="market-card p-6 space-y-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-market-green" />
                Depositar Fundos
              </h3>
              
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Método de Depósito</label>
                  <select 
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="market-input w-full bg-market-card appearance-none"
                  >
                    <option value="iban">Transferência IBAN</option>
                    <option value="kwik">Multicaixa Express / KWIK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Montante (KZ)</label>
                  <input 
                    type="number" 
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00" 
                    className="market-input w-full" 
                  />
                </div>
                {method === 'iban' && (
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">IBAN de Origem</label>
                    <input 
                      type="text" 
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder="AO06..." 
                      className="market-input w-full" 
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Comprovativo de Pagamento</label>
                  <input 
                    type="file" 
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="market-input w-full text-xs" 
                    accept="image/*,.pdf"
                  />
                  <p className="text-[10px] text-market-text-muted mt-1">Anexe uma foto ou PDF do comprovativo.</p>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={() => handleFinanceRequest('deposit')}
                    disabled={loading}
                    className="market-button-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Solicitar Depósito
                  </button>
                </div>
                <p className="text-[10px] text-market-text-muted text-center mt-4">
                  Os depósitos estão sujeitos a verificação pelo administrador.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div className="market-card p-6 space-y-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <ArrowUpFromLine className="w-5 h-5 text-market-red" />
                Levantar Fundos
              </h3>
              
              <div className="space-y-4 max-w-md">
                <div className="bg-market-card-lighter p-4 rounded-lg mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-market-text-muted">Saldo Disponível:</span>
                    <span className="font-bold text-white">{user.balance.toLocaleString()} KZ</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Método de Levantamento</label>
                  <select 
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="market-input w-full bg-market-card appearance-none"
                  >
                    <option value="iban">Transferência IBAN</option>
                    <option value="kwik">Multicaixa Express / KWIK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Montante (KZ)</label>
                  <input 
                    type="number" 
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00" 
                    className="market-input w-full" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">
                    {method === 'iban' ? 'IBAN de Destino' : 'Número de Telefone (KWIK)'}
                  </label>
                  <input 
                    type="text" 
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder={method === 'iban' ? "AO06..." : "9XX..."} 
                    className="market-input w-full" 
                  />
                </div>
                <div className="pt-4">
                  <button 
                    onClick={() => handleFinanceRequest('withdrawal')}
                    disabled={loading}
                    className="market-button-outline w-full py-3 text-sm text-market-red hover:bg-market-red/10 border-market-red/50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Solicitar Levantamento
                  </button>
                </div>
                <p className="text-[10px] text-market-text-muted text-center mt-4">
                  Os levantamentos podem demorar até 24h úteis para serem processados.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="market-card p-6 space-y-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-market-green" />
                Histórico de Investimentos
              </h3>
              
              {fetchingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-market-green" />
                </div>
              ) : investmentHistory.length > 0 ? (
                <div className="space-y-4">
                  {investmentHistory.map((trade) => {
                    const isResolved = trade.markets?.resolved;
                    const isWinner = isResolved && trade.markets?.resolution_outcome === trade.outcome;
                    const profit = isResolved ? (isWinner ? trade.shares - trade.amount : -trade.amount) : 0;

                    return (
                      <div key={trade.id} className="p-4 bg-market-card-lighter rounded-xl border border-market-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              trade.side === 'Buy' ? 'bg-market-green/10 text-market-green' : 'bg-market-red/10 text-market-red'
                            }`}>
                              {trade.side === 'Buy' ? 'Compra' : 'Venda'}
                            </span>
                            <span className="text-xs text-market-text-muted">{format(new Date(trade.created_at || trade.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                          </div>
                          <p className="font-bold text-white text-sm">{trade.markets?.question || `Mercado #${trade.market_id}`}</p>
                          <p className="text-xs text-market-text-muted mt-1">
                            Aposta: <span className={cn("font-bold", trade.outcome === 'Yes' ? 'text-market-green' : trade.outcome === 'No' ? 'text-market-red' : 'text-blue-400')}>{trade.outcome}</span>
                          </p>
                        </div>
                        <div className="flex flex-row md:flex-col justify-between md:text-right gap-2">
                          <div>
                            <p className="font-bold text-white">{trade.amount.toLocaleString()} KZ</p>
                            <p className="text-[10px] text-market-text-muted uppercase tracking-widest">{trade.shares.toLocaleString()} Ações @ {trade.price} KZ</p>
                          </div>
                          {isResolved && (
                            <div className={cn(
                              "text-xs font-bold px-2 py-1 rounded h-fit",
                              profit > 0 ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red"
                            )}>
                              {profit > 0 ? `+${profit.toLocaleString()} KZ` : `${profit.toLocaleString()} KZ`}
                            </div>
                          )}
                          {!isResolved && (
                            <div className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded h-fit uppercase tracking-widest">
                              Ativo
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-market-text-muted italic">
                  Ainda não realizou nenhum investimento.
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="market-card p-6 space-y-6">
              <h3 className="text-lg font-bold text-white mb-6">Definições de Conta</h3>
              
              <div className="space-y-6 max-w-md">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-market-text-muted uppercase tracking-widest border-b border-market-border pb-2">Perfil</h4>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Nome de Exibição</label>
                    <input type="text" defaultValue={user.name} className="market-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Email</label>
                    <input type="email" defaultValue={user.email} className="market-input w-full" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-market-text-muted uppercase tracking-widest border-b border-market-border pb-2">Segurança</h4>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Nova Palavra-passe</label>
                    <input type="password" placeholder="••••••••" className="market-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Confirmar Palavra-passe</label>
                    <input type="password" placeholder="••••••••" className="market-input w-full" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-market-text-muted uppercase tracking-widest border-b border-market-border pb-2">Notificações</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">Notificações por Email</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-market-border bg-market-card text-market-green focus:ring-market-green" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">Alertas de Mercado</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-market-border bg-market-card text-market-green focus:ring-market-green" />
                  </div>
                </div>

                <div className="pt-4">
                  <button className="market-button-primary w-full py-3 text-xs">Guardar Alterações</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
