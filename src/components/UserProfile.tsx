import React, { useState, useEffect } from 'react';
import { User, Market } from '../types';
import { User as UserIcon, Settings, LogOut, Wallet, History, Shield, CheckCircle, XCircle, Clock, ArrowDownToLine, ArrowUpFromLine, Loader2, Coins } from 'lucide-react';
import { logout } from '../firebase';
import { firebaseService } from '../lib/firebase-service';
import { ammApi } from '../lib/amm-api';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const UserProfile = ({ 
  user, 
  onLogout, 
  markets = [] 
}: { 
  user: User | null; 
  onLogout: () => void; 
  markets?: Market[];
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [iban, setIban] = useState('');
  const [method, setMethod] = useState('iban');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [investmentHistory, setInvestmentHistory] = useState<any[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [userFinanceRequests, setUserFinanceRequests] = useState<any[]>([]);
  const [fetchingFinance, setFetchingFinance] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [fetchingLedger, setFetchingLedger] = useState(false);
  const [clobReservedKz, setClobReservedKz] = useState<number>(0);
  const [clobPositions, setClobPositions] = useState<any[] | null>(null);

  const effectivePositions = (clobPositions && clobPositions.length > 0)
    ? clobPositions.map((p: any) => ({
        market_id: p.market_id,
        outcome: p.outcome,
        shares: (p.available_shares || 0) + (p.reserved_shares || 0),
        avg_price: (p.avg_price_cents || 0) / 100,
      }))
    : (user?.positions || []);

  // Calculate open positions stats
  const openPositionsStats = effectivePositions.reduce((acc, pos) => {
    const cost = pos.shares * pos.avg_price;
    const m = markets.find(market => market.id === pos.market_id);
    let currentPrice = pos.avg_price;
    if (m) {
      if (m.is_multi && m.outcomes) {
        const out = m.outcomes.find(o => o.name === pos.outcome);
        currentPrice = out ? out.price : 0.5;
      } else {
        currentPrice = pos.outcome === 'Yes' ? (m.yes_price || 0.5) : (m.no_price || 0.5);
      }
    }
    const currentValue = pos.shares * currentPrice;
    const pnl = currentValue - cost;

    acc.totalInvested += cost;
    acc.currentValue += currentValue;
    acc.unrealizedPnL += pnl;
    return acc;
  }, { totalInvested: 0, currentValue: 0, unrealizedPnL: 0 });

  // Calculate realized profit from won payouts (premiations)
  const totalRealizedWinnings = ledgerEntries
    .filter(entry => entry.type === 'PREMIACAO_MERCADO')
    .reduce((acc, entry) => acc + (entry.amount || 0), 0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, []);

  const fetchLedgerEntries = async () => {
    if (!user) return;
    setFetchingLedger(true);
    try {
      const entries = await firebaseService.getUserLedger(user.id);
      setLedgerEntries(entries || []);
    } catch (e) {
      console.error('Error fetching ledger entries:', e);
    } finally {
      setFetchingLedger(false);
    }
  };

  // Load finance requests
  const loadFinanceRequests = async () => {
    if (!user) return;
    setFetchingFinance(true);
    try {
      const resp = await firebaseService.getUserFinanceRequests(user.id);
      setUserFinanceRequests(resp || []);
    } catch (e) {
      console.error('Error fetching finance requests:', e);
    } finally {
      setFetchingFinance(false);
    }
  };

  useEffect(() => {
    if (user && (activeTab === 'overview' || activeTab === 'deposit' || activeTab === 'withdraw')) {
      loadFinanceRequests();
      ammApi.getMyClobOrders()
        .then((res) => {
          setClobReservedKz((res.account?.reserved_cents || 0) / 100);
          setClobPositions(res.positions || []);
        })
        .catch(() => null);
    }
    if (user && (activeTab === 'overview' || activeTab === 'ledger')) {
      fetchLedgerEntries();
    }
  }, [user, activeTab]);

  const fetchInvestmentHistory = async () => {
    if (!user) return;
    setFetchingHistory(true);
    try {
      firebaseService.getTradeHistory(user.id, (tradesData) => {
        const enrichedTrades = (tradesData || []).map(trade => {
          const associatedMarket = markets.find(m => m.id === trade.market_id);
          return {
            ...trade,
            markets: associatedMarket ? {
              question: associatedMarket.question,
              resolved: associatedMarket.resolved,
              resolution_outcome: associatedMarket.resolution_outcome
            } : null
          };
        });
        setInvestmentHistory(enrichedTrades);
      });
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (e) {
      console.error('Logout error:', e);
      onLogout();
    }
  };

  const handleVerificationRequest = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await firebaseService.updateUserProfile(user.id, { 
        status: 'pending_verification',
        verification_status: 'pending'
      });
      alert("Solicitação de verificação KYC enviada com sucesso!");
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
      alert("Montante inválido. Insira um número positivo maior que zero.");
      return;
    }

    if (type === 'withdrawal' && amount > user.balance) {
      alert("Saldo insuficiente para efetuar este levantamento.");
      return;
    }

    setLoading(true);
    try {
      let proofUrl = null;
      if (type === 'deposit' && proofFile) {
        proofUrl = `comprovativo://${encodeURIComponent(proofFile.name)} (${Math.round(proofFile.size / 1024)} KB)`;
      }

      await firebaseService.addFinanceRequest({
        user_id: user.id,
        user_name: user.name,
        type,
        amount,
        method,
        details: method === 'iban' ? iban : 'KWIK Request',
        status: 'pending',
        proof_url: proofUrl,
        timestamp: new Date().toISOString()
      });

      alert(`Solicitação de ${type === 'deposit' ? 'depósito' : 'levantamento'} de ${amount.toLocaleString()} KZ enviada ao administrador!`);
      setDepositAmount('');
      setWithdrawAmount('');
      setIban('');
      setProofFile(null);
      loadFinanceRequests();
    } catch (error) {
      console.error('Finance request error:', error);
      alert("Erro ao processar solicitação financeira.");
    } finally {
      setLoading(false);
    }
  };

  const renderFinanceHistory = () => (
    <div className="market-card p-6 mt-6">
      <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
        <Coins className="w-4 h-4 text-market-green" />
        Suas Solicitações Financeiras (Depósitos & Saques)
      </h4>
      {fetchingFinance ? (
        <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-market-green" /></div>
      ) : userFinanceRequests.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-market-border/30 text-market-text-muted font-bold uppercase tracking-widest text-[9px]">
                <th className="pb-3 text-left">Tipo</th>
                <th className="pb-3 text-right">Montante</th>
                <th className="pb-3 text-center">Método</th>
                <th className="pb-3 text-center">Estado</th>
                <th className="pb-3 text-right text-market-text-muted">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-market-border/15">
              {userFinanceRequests.map((req, index) => (
                <tr key={index} className="hover:bg-white/[0.01] transition-colors">
                  <td className="py-3 items-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                      req.type === 'deposit' ? "bg-market-green/15 text-market-green border border-market-green/20" : "bg-market-red/15 text-market-red border border-market-red/20"
                    )}>
                      {req.type === 'deposit' ? 'Depósito' : 'Saque'}
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold text-white">{(req.amount || 0).toLocaleString()} KZ</td>
                  <td className="py-3 text-center text-market-text-muted uppercase font-mono">{req.method}</td>
                  <td className="py-3 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                      req.status === 'approved' && "bg-market-green/15 text-market-green",
                      req.status === 'pending' && "bg-orange-500/15 text-orange-500",
                      req.status === 'rejected' && "bg-market-red/15 text-market-red"
                    )}>
                      {req.status === 'approved' ? 'Aprovado' : req.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                    </span>
                  </td>
                  <td className="py-3 text-right text-market-text-muted">
                    {req.timestamp || req.created_at ? format(new Date(req.timestamp || req.created_at), 'dd/MM HH:mm') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-4 text-market-text-muted italic">
          Nenhuma solicitação financeira efetuada até o momento.
        </div>
      )}
    </div>
  );

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
                { id: 'ledger', label: 'Livro Razão', icon: Coins, onClick: fetchLedgerEntries },
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Saldo Disponível */}
                <div className="market-card p-6 flex flex-col justify-between min-h-[180px]">
                  <div>
                    <h3 className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest mb-1">Saldo Disponível</h3>
                    <div className="text-2xl font-black text-white">{user.balance.toLocaleString()} KZ</div>
                    <p className="text-[10px] text-market-text-muted mt-1">Líquido livre para trading ou levantamento.</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setActiveTab('deposit')} className="market-button-primary py-1.5 px-3 text-[10px] font-bold flex-1">Depositar</button>
                    <button onClick={() => setActiveTab('withdraw')} className="market-button-outline py-1.5 px-3 text-[10px] font-bold flex-1">Levantar</button>
                  </div>
                </div>

                {/* Card 2: Saldo Bloqueado */}
                <div className="market-card p-6 flex flex-col justify-between min-h-[180px]">
                  <div>
                    <h3 className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest mb-1">Saldo Bloqueado</h3>
                    <div className="text-2xl font-black text-orange-400">{(openPositionsStats.totalInvested + clobReservedKz).toLocaleString()} KZ</div>
                    <p className="text-[10px] text-market-text-muted mt-1">Posições abertas ({openPositionsStats.totalInvested.toLocaleString()} KZ) + Ordens CLOB ({clobReservedKz.toLocaleString()} KZ).</p>
                  </div>
                  <div className="border-t border-market-border/20 pt-2 mt-2 flex justify-between text-[10px]">
                    <span className="text-market-text-muted">Valor de Mercado:</span>
                    <span className="font-bold text-white">{openPositionsStats.currentValue.toLocaleString()} KZ</span>
                  </div>
                </div>

                {/* Card 3: Lucro/Perda Não Realizado */}
                <div className="market-card p-6 flex flex-col justify-between min-h-[180px]">
                  <div>
                    <h3 className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest mb-1">PnL Não Realizado</h3>
                    <div className={cn(
                      "text-2xl font-black",
                      openPositionsStats.unrealizedPnL > 0 ? "text-market-green" : openPositionsStats.unrealizedPnL < 0 ? "text-market-red" : "text-white"
                    )}>
                      {openPositionsStats.unrealizedPnL > 0 ? '+' : ''}{openPositionsStats.unrealizedPnL.toLocaleString()} KZ
                    </div>
                    <p className="text-[10px] text-market-text-muted mt-1">Lucro/Prejuízo flutuante baseado nos preços de mercado atuais.</p>
                  </div>
                  <div className="border-t border-market-border/20 pt-2 mt-2 flex justify-between text-[10px]">
                    <span className="text-market-text-muted">Status:</span>
                    <span className={cn("font-bold", openPositionsStats.unrealizedPnL >= 0 ? "text-market-green" : "text-market-red")}>
                      {openPositionsStats.unrealizedPnL > 0 ? 'Lucro Ativo' : openPositionsStats.unrealizedPnL < 0 ? 'Prejuízo Ativo' : 'Sem Oscilação'}
                    </span>
                  </div>
                </div>

                {/* Card 4: Lucros Realizados */}
                <div className="market-card p-6 flex flex-col justify-between min-h-[180px]">
                  <div>
                    <h3 className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest mb-1">Retornos Realizados</h3>
                    <div className="text-2xl font-black text-market-green">{totalRealizedWinnings.toLocaleString()} KZ</div>
                    <p className="text-[10px] text-market-text-muted mt-1">Somas acumuladas pagas por resoluções corretas de mercados.</p>
                  </div>
                  <div className="border-t border-market-border/20 pt-2 mt-2 flex justify-between text-[10px]">
                    <span className="text-market-text-muted">Histórico:</span>
                    <span className="font-bold text-market-green">Saldos Liquidados</span>
                  </div>
                </div>
              </div>

              <div className="market-card p-6">
                <h3 className="text-lg font-bold text-white mb-6">Posições Ativas</h3>
                {effectivePositions.length > 0 ? (
                  <div className="space-y-4">
                    {effectivePositions.map((pos, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-market-card-lighter rounded-xl border border-market-border">
                        <div>
                          <p className="font-bold text-white text-sm">Mercado #{pos.market_id}</p>
                          <p className="text-xs text-market-text-muted mt-1">
                            Aposta: <span className={cn("font-bold", pos.outcome === 'Yes' ? 'text-market-green' : pos.outcome === 'No' ? 'text-market-red' : 'text-blue-400')}>{pos.outcome}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{pos.shares.toLocaleString()} Quotas</p>
                          <p className="text-xs text-market-text-muted mt-1">Preço Médio: {(pos.avg_price * 100).toFixed(0)}c ({pos.avg_price.toFixed(2)} KZ)</p>
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
              {renderFinanceHistory()}
            </>
          )}

          {activeTab === 'deposit' && (
            <>
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
              {renderFinanceHistory()}
            </>
          )}

          {activeTab === 'withdraw' && (
            <>
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
                    {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                      <div className="mt-2.5 p-3.5 bg-[#1C1D21] border border-market-border rounded-xl space-y-1.5 font-mono text-[11px] text-market-text-muted">
                        <div className="flex justify-between">
                          <span>Taxa de Saque (0.5%):</span>
                          <span className="text-market-red">{(parseFloat(withdrawAmount) * 0.005).toFixed(2)} KZ</span>
                        </div>
                        <div className="flex justify-between border-t border-market-border/30 pt-1.5 font-bold text-white">
                          <span>Recebe líquido:</span>
                          <span className="text-market-green">{(parseFloat(withdrawAmount) * 0.995).toFixed(2)} KZ</span>
                        </div>
                      </div>
                    )}
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
              {renderFinanceHistory()}
            </>
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

          {activeTab === 'ledger' && (
            <div className="market-card p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-market-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-market-green" />
                    Livro Razão (Financial Ledger)
                  </h3>
                  <p className="text-xs text-market-text-muted mt-1">
                    Histórico completo e imutável de todas as movimentações financeiras da sua conta.
                  </p>
                </div>
                <div className="bg-market-card-lighter border border-market-border px-4 py-2 rounded-lg">
                  <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-wider block">Saldo do Livro Razão</span>
                  <span className="text-lg font-black text-white">{user.balance.toLocaleString()} KZ</span>
                </div>
              </div>

              {fetchingLedger ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-market-green" />
                </div>
              ) : ledgerEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-market-border/30 text-market-text-muted font-bold uppercase tracking-widest text-[9px]">
                        <th className="pb-3 text-left">Ref / ID Transação</th>
                        <th className="pb-3 text-center">Tipo de Movimentação</th>
                        <th className="pb-3 text-right">Montante</th>
                        <th className="pb-3 text-right">Saldo Anterior</th>
                        <th className="pb-3 text-right">Novo Saldo</th>
                        <th className="pb-3 text-right text-market-text-muted">Data & Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-market-border/15 font-mono">
                      {ledgerEntries.map((entry, idx) => {
                        const isPositive = entry.amount > 0;
                        return (
                          <tr key={entry.id || idx} className="hover:bg-white/[0.01] transition-colors">
                            <td className="py-4 text-left text-market-text-muted text-[10px] break-all max-w-[120px]" title={entry.id}>
                              #{entry.id?.substring(0, 8)}...
                            </td>
                            <td className="py-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                                entry.type === 'DEPOSITO' && "bg-market-green/15 text-market-green border border-market-green/20",
                                entry.type === 'SAQUE' && "bg-market-red/15 text-market-red border border-market-red/20",
                                entry.type === 'COMPRA_QUOTAS' && "bg-blue-500/15 text-blue-400 border border-blue-500/20",
                                entry.type === 'VENDA_QUOTAS' && "bg-purple-500/15 text-purple-400 border border-purple-500/20",
                                entry.type === 'PREMIACAO_MERCADO' && "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                              )}>
                                {entry.type === 'DEPOSITO' ? 'DEPÓSITO' :
                                 entry.type === 'SAQUE' ? 'SAQUE' :
                                 entry.type === 'COMPRA_QUOTAS' ? 'COMPRA QUOTAS' :
                                 entry.type === 'VENDA_QUOTAS' ? 'VENDA QUOTAS' :
                                 entry.type === 'PREMIACAO_MERCADO' ? 'PREMIAÇÃO VENCEDOR' : entry.type}
                              </span>
                            </td>
                            <td className={cn("py-4 text-right font-bold text-sm", isPositive ? "text-market-green" : "text-market-red")}>
                              {isPositive ? '+' : ''}{(entry.amount || 0).toLocaleString()} KZ
                            </td>
                            <td className="py-4 text-right text-market-text-muted">
                              {(entry.balanceBefore || 0).toLocaleString()} KZ
                            </td>
                            <td className="py-4 text-right text-white font-bold">
                              {(entry.balanceAfter || 0).toLocaleString()} KZ
                            </td>
                            <td className="py-4 text-right text-market-text-muted text-[10px]">
                              {entry.createdAt ? format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm:ss') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-market-text-muted italic">
                  Nenhum registro financeiro encontrado no Livro Razão imutável para esta conta.
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
