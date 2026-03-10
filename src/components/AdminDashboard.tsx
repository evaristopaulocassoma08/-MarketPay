import React from 'react';
import { User } from '../types';
import { Shield, Users, AlertTriangle, Settings, Edit, Trash2, Ban } from 'lucide-react';

export const AdminDashboard = ({ user }: { user: User | null }) => {
  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-16 h-16 text-market-red mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-market-text-muted">Não tem permissões para aceder a esta página.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-market-green" />
        <h1 className="text-3xl font-bold text-white">Painel de Administração</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Utilizadores Ativos', value: '1,234', icon: Users },
          { label: 'Mercados Abertos', value: '45', icon: Settings },
          { label: 'Volume Total (KZ)', value: '15.4M', icon: Shield },
          { label: 'Denúncias', value: '3', icon: AlertTriangle, alert: true },
        ].map((stat, i) => (
          <div key={i} className="market-card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-market-text-muted uppercase tracking-widest">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.alert ? 'text-market-red' : 'text-market-green'}`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="market-card p-6">
            <h3 className="text-lg font-bold text-white mb-6">Gestão de Utilizadores</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-market-text-muted uppercase bg-market-card-lighter">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Utilizador</th>
                    <th className="px-4 py-3">Email/Carteira</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 rounded-r-lg">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border">
                  {[
                    { id: 1, name: 'João Silva', email: 'joao@example.com', status: 'Ativo' },
                    { id: 2, name: 'Maria Santos', email: 'maria@example.com', status: 'Aviso' },
                    { id: 3, name: 'Pedro Costa', email: 'pedro@example.com', status: 'Bloqueado' },
                  ].map((u) => (
                    <tr key={u.id} className="hover:bg-market-card-lighter/50 transition-colors">
                      <td className="px-4 py-4 font-bold text-white">{u.name}</td>
                      <td className="px-4 py-4 text-market-text-muted">{u.email}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          u.status === 'Ativo' ? 'bg-market-green/10 text-market-green' :
                          u.status === 'Aviso' ? 'bg-orange-500/10 text-orange-500' :
                          'bg-market-red/10 text-market-red'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 hover:bg-market-card rounded text-market-text-muted hover:text-white transition-colors" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-market-card rounded text-market-text-muted hover:text-market-red transition-colors" title="Bloquear">
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="market-card p-6">
            <h3 className="text-lg font-bold text-white mb-6">Ações Rápidas</h3>
            <div className="space-y-3">
              <button className="w-full market-button-primary py-3 text-xs">Criar Novo Mercado</button>
              <button className="w-full market-button-outline py-3 text-xs">Enviar Notificação Global</button>
              <button className="w-full market-button-outline py-3 text-xs">Gerar Relatório</button>
            </div>
          </div>

          <div className="market-card p-6">
            <h3 className="text-lg font-bold text-white mb-6">Atividade Recente</h3>
            <div className="space-y-4">
              {[
                { action: 'Novo mercado criado', time: 'há 10 min' },
                { action: 'Utilizador denunciado', time: 'há 1 hora' },
                { action: 'Mercado resolvido', time: 'há 2 horas' },
              ].map((act, i) => (
                <div key={i} className="flex justify-between items-center text-sm border-b border-market-border pb-2 last:border-0 last:pb-0">
                  <span className="text-white">{act.action}</span>
                  <span className="text-[10px] text-market-text-muted font-bold uppercase">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
