import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Settings, LogOut, Wallet, History, Shield } from 'lucide-react';

export const UserProfile = ({ user, onLogout }: { user: User | null, onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState('overview');

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
              {user.isAdmin && (
                <div className="absolute -bottom-2 -right-2 bg-market-green text-market-bg p-1.5 rounded-full" title="Administrador">
                  <Shield className="w-4 h-4" />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-xs text-market-text-muted font-mono mt-1 break-all">{user.walletAddress}</p>
          </div>

          <div className="market-card overflow-hidden">
            <div className="flex flex-col">
              {[
                { id: 'overview', label: 'Visão Geral', icon: Wallet },
                { id: 'history', label: 'Histórico', icon: History },
                { id: 'settings', label: 'Definições', icon: Settings },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
                onClick={onLogout}
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
                  <div className="mt-4 flex gap-3">
                    <button className="market-button-primary py-2 px-4 text-xs">Depositar</button>
                    <button className="market-button-outline py-2 px-4 text-xs">Levantar</button>
                  </div>
                </div>
                <div className="market-card p-6">
                  <h3 className="text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Valor em Posições</h3>
                  <div className="text-3xl font-bold text-white">
                    {user.positions.reduce((acc, pos) => acc + (pos.shares * pos.avgPrice), 0).toLocaleString()} KZ
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
                          <p className="font-bold text-white text-sm">Mercado #{pos.marketId}</p>
                          <p className="text-xs text-market-text-muted mt-1">
                            Aposta: <span className={pos.outcome === 'Yes' ? 'text-market-green font-bold' : 'text-market-red font-bold'}>{pos.outcome === 'Yes' ? 'Sim' : 'Não'}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{pos.shares.toLocaleString()} Ações</p>
                          <p className="text-xs text-market-text-muted mt-1">Preço Médio: {pos.avgPrice} KZ</p>
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

          {activeTab === 'settings' && (
            <div className="market-card p-6 space-y-6">
              <h3 className="text-lg font-bold text-white mb-6">Definições de Conta</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Nome de Exibição</label>
                  <input type="text" defaultValue={user.name} className="market-input w-full max-w-md" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Email</label>
                  <input type="email" placeholder="O seu email" className="market-input w-full max-w-md" />
                </div>
                <div className="pt-4">
                  <button className="market-button-primary py-3 px-8 text-xs">Guardar Alterações</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
