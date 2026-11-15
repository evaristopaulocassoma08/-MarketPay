import React, { useState } from 'react';
import { 
  Settings, Loader2, History, AlertTriangle, ShieldAlert, CheckCircle, 
  Unlock, Lock, Percent, ArrowDownToLine, ArrowUpFromLine, Laptop 
} from 'lucide-react';
import { firebaseService } from '../../lib/firebase-service';

export const PlatformSettings = ({ 
  platformSettings, 
  auditLogs, 
  addToast,
  onRefreshData
}: { 
  platformSettings: {
    tradingFee: number;
    minDeposit: number;
    minWithdrawal: number;
    maintenanceMode: boolean;
    platformName: string;
  };
  auditLogs: any[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
}) => {
  const [settings, setSettings] = useState(platformSettings);
  const [loading, setLoading] = useState(false);

  const handleUpdateSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await firebaseService.updatePlatformSettings(settings);
      await firebaseService.logAdminAction(
        'admin',
        'update_settings',
        `Alterou definições globais: taxa=${settings.tradingFee}%, minDep=${settings.minDeposit}KZ, manutenção=${settings.maintenanceMode}`
      );
      addToast('Configurações da plataforma atualizadas!', 'success');
      onRefreshData();
    } catch (error: any) {
      addToast('Erro ao atualizar definições: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Form */}
        <div className="lg:col-span-6 market-card p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4 text-market-green" />
              Parâmetros Globais do Sistema
            </h3>
            <p className="text-xs text-market-text-muted mt-1">Configuração de taxas operacionais, limites e modo de segurança</p>
          </div>

          <form onSubmit={handleUpdateSettingsSubmit} className="space-y-4">
            <div className="bg-market-card-lighter/25 p-4 rounded-xl border border-market-border flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-white font-bold block">Modo de Manutenção</span>
                <span className="text-[10px] text-market-text-muted">Bloqueia o acesso a apostas e trading para usuários comuns</span>
              </div>
              <button
                type="button"
                onClick={() => setSettings({...settings, maintenanceMode: !settings.maintenanceMode})}
                className={`w-14 h-7 rounded-full leading-5 transition-all relative ${
                  settings.maintenanceMode ? 'bg-market-red' : 'bg-market-border'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                  settings.maintenanceMode ? 'left-8' : 'left-1'
                }`} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Comissão de Liquidação (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1"
                  required
                  value={settings.tradingFee} 
                  onChange={(e) => setSettings({...settings, tradingFee: parseFloat(e.target.value)})} 
                  className="market-input w-full pr-10 font-bold"
                />
                <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-market-text-muted" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Depósito Mínimo (KZ)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required
                    value={settings.minDeposit} 
                    onChange={(e) => setSettings({...settings, minDeposit: parseInt(e.target.value)})} 
                    className="market-input w-full font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Saque Mínimo (KZ)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required
                    value={settings.minWithdrawal} 
                    onChange={(e) => setSettings({...settings, minWithdrawal: parseInt(e.target.value)})} 
                    className="market-input w-full font-mono font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Nome do Website</label>
              <input 
                type="text" 
                required
                value={settings.platformName || 'MarketPay'} 
                onChange={(e) => setSettings({...settings, platformName: e.target.value})} 
                className="market-input w-full"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="market-button-primary w-full py-3 flex justify-center items-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Alterações Globais'}
            </button>
          </form>
        </div>

        {/* Audit Logs */}
        <div className="lg:col-span-6 market-card p-6 space-y-6 flex flex-col h-[500px] lg:h-auto overflow-hidden">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Logs de Auditoria e Segurança (Trilha Admin)
            </h3>
            <p className="text-xs text-market-text-muted mt-1">Registros irreversíveis de ações de monitoramento e decisões efetuadas por administradores</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar font-mono text-[11px] bg-market-bg/50 p-4 border border-market-border rounded-xl">
            {auditLogs.length === 0 ? (
              <span className="text-market-text-muted italic block text-center py-10">Nenhuma ação de auditoria registrada localmente.</span>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="border-b border-market-border/40 pb-3 last:border-b-0 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-market-green font-bold">👤 ADMIN</span>
                    <span className="text-market-text-muted">{log.created_at ? new Date(log.created_at).toLocaleString() : 'Sem data'}</span>
                  </div>
                  <div className="font-sans font-bold text-white text-xs">{log.action ? log.action.toUpperCase() : 'Ação Indefinida'}</div>
                  <div className="text-market-text-muted text-[11px] leading-relaxed break-words">{log.details}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
