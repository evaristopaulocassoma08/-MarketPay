import React, { useState, useEffect } from 'react';
import { Play, Square, Settings, Cpu, DollarSign, Activity, Terminal, Sparkles, UserCheck } from 'lucide-react';
import { firebaseService } from '../../lib/firebase-service';
import { ammApi } from '../../lib/amm-api';
import { Market, User } from '../../types';

interface BotProfile {
  id: string;
  name: string;
  email: string;
  balance: number;
  strategy: string;
  successRate: string;
}

const BOT_PROFILES: BotProfile[] = [
  { id: 'bot_ango_01', name: 'AngoBot_01 (Kwanza Whale)', email: 'angobot01@marketpay.ao', balance: 500000, strategy: 'Whale / Trend Maker', successRate: '78%' },
  { id: 'bot_soba_risk', name: 'SobaTrader (High Risk)', email: 'sobarisk@marketpay.ao', balance: 250000, strategy: 'Scalper / High Risk', successRate: '62%' },
  { id: 'bot_candengue', name: 'CandengueTrader (Scalper)', email: 'candengue@marketpay.ao', balance: 150000, strategy: 'Arbitrage / Momentum', successRate: '54%' },
  { id: 'bot_kwanza_king', name: 'KwanzaKing (Whale)', email: 'kwanzaking@marketpay.ao', balance: 1000000, strategy: 'Value Investor', successRate: '89%' },
  { id: 'bot_preditor', name: 'PreditorElite (Balanced)', email: 'preditor@marketpay.ao', balance: 400000, strategy: 'Statistical Arbitrage', successRate: '71%' }
];

export const BotControlHub = ({ 
  markets, 
  addToast,
  onRefreshData
}: { 
  markets: Market[]; 
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
}) => {
  const [botsEnabled, setBotsEnabled] = useState(false);
  const [botSpeed, setBotSpeed] = useState<number>(8); // seconds per trade
  const [botLogs, setBotLogs] = useState<Array<{ id: string; time: string; botName: string; action: string; market: string; amount: number; price: string }>>([]);
  const [isSeedingBots, setIsSeedingBots] = useState(false);
  const [botTradesCount, setBotTradesCount] = useState(0);
  const [botsList, setBotsList] = useState<BotProfile[]>(BOT_PROFILES);

  // Load / Update bot balances from DB
  const updateBotBalances = async () => {
    try {
      const updated = await Promise.all(BOT_PROFILES.map(async (bot) => {
        const u = await firebaseService.getUserProfile(bot.id);
        return {
          ...bot,
          balance: u?.balance !== undefined ? u.balance : bot.balance
        };
      }));
      setBotsList(updated);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    updateBotBalances();
  }, []);

  // Bot activity loop
  useEffect(() => {
    if (!botsEnabled) return;

    const runBotCycle = async () => {
      // 1. Filter active markets
      const activeMarkets = markets.filter(m => !m.resolved && !m.is_multi && m.status !== 'blocked' && m.status !== 'hidden');
      if (activeMarkets.length === 0) return;

      // 5 times buy & sell at 0.5s interval
      for (let i = 0; i < 5; i++) {
        setTimeout(async () => {
          // Pick a random active market
          const market = activeMarkets[Math.floor(Math.random() * activeMarkets.length)];
          
          // Pick two different bots for Yes and No simulated buy trades (to represent simultaneous buy and sell liquidity)
          const bot1 = botsList[Math.floor(Math.random() * botsList.length)];
          let bot2 = botsList[Math.floor(Math.random() * botsList.length)];
          if (bot1.id === bot2.id && botsList.length > 1) {
            bot2 = botsList.find(b => b.id !== bot1.id) || bot2;
          }

          // Micro amounts for fluid prices
          const amount1 = Math.floor(Math.random() * 85) + 15; // 15 to 100 KZ Yes Buy
          const amount2 = Math.floor(Math.random() * 85) + 15; // 15 to 100 KZ No Buy

          try {
            const [resYes, resNo] = await Promise.all([
              ammApi.executeBotSandboxLiquidity({
                marketId: market.id,
                botId: bot1.id,
                outcome: 'Yes',
                amountKz: amount1,
              }),
              ammApi.executeBotSandboxLiquidity({
                marketId: market.id,
                botId: bot2.id,
                outcome: 'No',
                amountKz: amount2,
              }),
            ]);

            const timestamp = new Date().toLocaleTimeString();

            const logYes = {
              id: Math.random().toString(),
              time: timestamp,
              botName: bot1.name.split(' (')[0],
              action: `CLOB COMPRA [Sim]`,
              market: market.question,
              amount: resYes.notionalKz || amount1,
              price: `${resYes.priceCents || Math.round((market.yes_price || 0.5) * 100)} KZ`
            };

            const logNo = {
              id: Math.random().toString(),
              time: timestamp,
              botName: bot2.name.split(' (')[0],
              action: `CLOB COMPRA [Não]`,
              market: market.question,
              amount: resNo.notionalKz || amount2,
              price: `${resNo.priceCents || Math.round((market.no_price || 0.5) * 100)} KZ`
            };

            setBotLogs(prev => [logYes, logNo, ...prev.slice(0, 38)]);
            setBotTradesCount(prev => prev + 2);
            onRefreshData(); // Notify main dashboard to re-fetch live volumes & prices
          } catch (error) {
            console.error('Error executing high freq bot trade:', error);
          }
        }, i * 500); // 0.5 second interval
      }
    };

    // Execute once initially on start
    runBotCycle();

    // Setup interval to execute every 1 minute (60000ms)
    const intervalId = setInterval(() => {
      runBotCycle();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [botsEnabled, markets, botsList]);

  const handleToggleBots = () => {
    const nextState = !botsEnabled;
    setBotsEnabled(nextState);
    if (nextState) {
      addToast('Robôs de Liquidez iniciados com sucesso!', 'success');
    } else {
      addToast('Robôs de Liquidez parados.', 'info');
    }
  };

  const handleInjectLiquidity = async () => {
    setIsSeedingBots(true);
    addToast('Injetando volume rápido nos mercados via Bots...', 'info');
    try {
      const activeMarkets = markets.filter(m => !m.resolved && !m.is_multi && m.status !== 'blocked' && m.status !== 'hidden');
      if (activeMarkets.length === 0) {
        addToast('Nenhum mercado ativo disponível para injeção de liquidez.', 'error');
        return;
      }

      // Perform 3 instant random trades across different markets to bootstrap volume
      for (let i = 0; i < Math.min(3, activeMarkets.length); i++) {
        const m = activeMarkets[Math.floor(Math.random() * activeMarkets.length)];
        const b = botsList[Math.floor(Math.random() * botsList.length)];
        const out: 'Yes' | 'No' = Math.random() > 0.5 ? 'Yes' : 'No';
        const value = Math.floor(Math.random() * 5000) + 2000;

        const botRes = await ammApi.executeBotSandboxLiquidity({
          marketId: m.id,
          botId: b.id,
          outcome: out,
          amountKz: value,
        });
        
        setBotLogs(prev => [{
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          botName: b.name.split(' (')[0],
          action: `LIQUIDEZ CLOB [${out}]`,
          market: m.question,
          amount: botRes.notionalKz || value,
          price: `${botRes.priceCents || 50}%`
        }, ...prev]);
        setBotTradesCount(prev => prev + 1);
      }

      onRefreshData();
      addToast('Liquidez rápida injetada no motor CLOB+AMM!', 'success');
    } catch (e: any) {
      addToast('Erro ao injetar liquidez rápida: ' + e.message, 'error');
    } finally {
      setIsSeedingBots(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-market-card p-6 rounded-2xl border border-market-border">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-xl ${botsEnabled ? 'bg-market-green/10 text-market-green' : 'bg-market-red/10 text-market-red'} transition-colors`}>
            <Cpu className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              Robôs de Liquidez e Trading Automático
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                botsEnabled ? 'bg-market-green/20 text-market-green border border-market-green/30 animate-pulse' : 'bg-market-red/10 text-market-red border border-market-red/20'
              }`}>
                {botsEnabled ? 'Em Atividade' : 'Inativo'}
              </span>
            </h3>
            <p className="text-xs text-market-text-muted mt-1 leading-relaxed">
              Os Trading Bots executam ordens bilaterais reais em Kwanza (KZ) diretamente no livro CLOB + AMM Enterprise em modo SANDBOX.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleInjectLiquidity}
            disabled={isSeedingBots}
            className="market-button-outline flex items-center gap-2 px-6 py-3 border-dashed hover:border-market-green hover:text-market-green"
          >
            <Sparkles className="w-4 h-4 text-market-green" />
            Injetar Liquidez Rápida
          </button>

          <button
            onClick={handleToggleBots}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              botsEnabled 
                ? 'bg-market-red text-white shadow-lg shadow-market-red/20 hover:bg-market-red/80' 
                : 'bg-market-green text-market-bg shadow-lg shadow-market-green/20 hover:bg-market-green/80 hover:scale-105'
            }`}
          >
            {botsEnabled ? (
              <>
                <Square className="w-4 h-4 fill-white text-white" />
                Desativar Bots
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-market-bg text-market-bg" />
                Ativar Bots
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Configurations and Robot status list */}
        <div className="lg:col-span-7 space-y-6">
          <div className="market-card p-6 space-y-6">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4 text-market-text-muted" />
              Parâmetros de Operação
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-3 text-left">Motor de Frequência de Liquidez</label>
                <div className="bg-market-bg p-4 rounded-xl border border-market-border/60 text-xs text-slate-350 space-y-2">
                  <div className="flex items-center gap-2 text-market-green font-extrabold text-[10px] uppercase">
                    <Activity className="w-4 h-4" />
                    Alta Atividade Ativada
                  </div>
                  <p className="leading-relaxed">
                    <strong>Ciclo de 1 Minuto:</strong> O robô ativa o motor a cada 60 segundos.
                  </p>
                  <p className="leading-relaxed">
                    <strong>5 Rodadas a 0.5s:</strong> Em cada ciclo, executa sequencialmente 5 pares de ordens simultâneas (Compra Sim + Compra Não) com intervalo de 500ms para criar volume e movimentação bilateral contínua.
                  </p>
                </div>
              </div>

              <div className="bg-market-card-lighter/20 p-4 rounded-xl border border-market-border/50 flex flex-col justify-center space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-market-text-muted font-bold uppercase">Transações Nesta Sessão:</span>
                  <span className="font-mono text-lg font-black text-market-green">{botTradesCount}</span>
                </div>
                <div className="border-t border-market-border/40 pt-2 flex items-center justify-between">
                  <span className="text-[10px] text-market-text-muted font-bold uppercase">Estilo de Atividade:</span>
                  <span className="text-[10px] bg-market-green/10 text-market-green font-black px-2 py-0.5 rounded border border-market-green/20">DUPLEX INTRADAY</span>
                </div>
              </div>
            </div>
          </div>

          <div className="market-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">
              Lista e Saldos de Contas de Robôs do Sistema
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-market-border pb-3">
                    <th className="pb-3 text-[10px] font-black text-market-text-muted uppercase tracking-widest">Robô</th>
                    <th className="pb-3 text-[10px] font-black text-market-text-muted uppercase tracking-widest">Estratégia</th>
                    <th className="pb-3 text-[10px] font-black text-market-text-muted uppercase tracking-widest text-right">Taxa Sucesso</th>
                    <th className="pb-3 text-[10px] font-black text-market-text-muted uppercase tracking-widest text-right">Saldo do Bot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-market-border">
                  {botsList.map((bot) => (
                    <tr key={bot.id} className="hover:bg-market-card-lighter/20 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-market-green/15 text-market-green border border-market-green/20 flex items-center justify-center font-mono font-bold text-xs">
                            🤖
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{bot.name.split(' (')[0]}</span>
                            <span className="text-[10px] text-market-text-muted font-mono">{bot.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="px-2.5 py-1 bg-market-card-lighter border border-market-border rounded-lg text-[9px] font-bold text-market-text-muted uppercase tracking-wide">
                          {bot.strategy}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-xs text-blue-400 font-bold font-mono">{bot.successRate}</span>
                      </td>
                      <td className="py-4 text-right font-mono font-bold text-white">
                        {bot.balance.toLocaleString()} KZ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Hacker style terminal for Bot operation logs */}
        <div className="lg:col-span-5 h-[450px] lg:h-auto flex flex-col">
          <div className="market-card p-6 flex flex-col flex-1 border-t border-t-market-green/45 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-market-border mb-4">
              <span className="text-xs font-black text-market-green uppercase tracking-wider flex items-center gap-2 font-mono">
                <Terminal className="w-4 h-4 animate-pulse" />
                CONSOLE_BOT_OPERATION_LOG
              </span>
              <span className="text-[9px] font-mono text-market-text-muted">LIVE_STREAM</span>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-3 pr-2 no-scrollbar scroll-smooth bg-market-bg/50 p-4 border border-market-border rounded-xl">
              {botLogs.length === 0 ? (
                <div className="text-market-text-muted italic flex flex-col items-center justify-center h-full gap-2">
                  <Terminal className="w-5 h-5 animate-pulse text-market-text-muted/30" />
                  <span>Aguardando conexões de bots... Ligue o master switch acima.</span>
                </div>
              ) : (
                botLogs.map((log) => (
                  <div key={log.id} className="border-l-2 border-l-market-green pl-2 space-y-0.5 hover:bg-market-card-lighter/10 py-1 transition-colors">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#00ff88]/50 font-bold">[{log.time}] {log.botName}</span>
                      <span className="text-emerald-400 font-bold">{log.action}</span>
                    </div>
                    <div className="text-white font-medium break-words">
                      Mercado: <span className="text-[#a0aec0]">{log.market}</span>
                    </div>
                    <div className="text-[10px] text-market-text-muted flex justify-between">
                      <span>Valor: <strong className="text-white">{log.amount.toLocaleString()} KZ</strong></span>
                      <span>Probabilidade: <strong className="text-white">{log.price}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
