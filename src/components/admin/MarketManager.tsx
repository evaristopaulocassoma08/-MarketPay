import React, { useEffect, useState } from 'react';
import { 
  Plus, Edit, Trash2, Eye, CheckCircle, XCircle, Loader2, 
  TrendingUp, LayoutGrid, Calendar, Clock, AlertTriangle, ShieldAlert,
  EyeOff, Lock, Unlock, Coins, Cpu, Users, Layers, HelpCircle, ArrowRight,
  RotateCcw, X
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { firebaseService } from '../../lib/firebase-service';
import { ammApi } from '../../lib/amm-api';
import { Market, Category } from '../../types';

const BOT_PROFILES = [
  { id: 'bot_ango_01', name: 'AngoBot_01 (Kwanza Whale)', email: 'angobot01@marketpay.ao', balance: 500000 },
  { id: 'bot_soba_risk', name: 'SobaTrader (High Risk)', email: 'sobarisk@marketpay.ao', balance: 250000 },
  { id: 'bot_candengue', name: 'CandengueTrader (Scalper)', email: 'candengue@marketpay.ao', balance: 150000 },
  { id: 'bot_kwanza_king', name: 'KwanzaKing (Whale)', email: 'kwanzaking@marketpay.ao', balance: 1000000 },
  { id: 'bot_preditor', name: 'PreditorElite (Balanced)', email: 'preditor@marketpay.ao', balance: 400000 }
];

export const MarketManager = ({
  markets,
  categories,
  trades = [],
  addToast,
  onRefreshData,
  initialSubTab = 'markets',
}: {
  markets: Market[];
  categories: Category[];
  trades?: any[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
  initialSubTab?: 'markets' | 'categories';
}) => {
  // Tabs for Markets vs Categories separation
  const [activeSubTab, setActiveSubTab] = useState<'markets' | 'categories'>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const [inspectingMarket, setInspectingMarket] = useState<Market | null>(null);
  const [inspectData, setInspectData] = useState<{ candles: any[]; book: any; amm: any; execs: any[] } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const openMarketInspector = async (m: Market) => {
    setInspectingMarket(m);
    setInspectLoading(true);
    try {
      const [candlesRes, bookRes, ammRes, execsRes] = await Promise.all([
        ammApi.getClobCandles(m.id, '1h', 'Yes').catch(() => ({ candles: [] })),
        ammApi.getOrderBook(m.id).catch(() => null),
        ammApi.getMarketDetails(m.id).catch(() => null),
        ammApi.getMarketExecutions(m.id, 20).catch(() => ({ executions: [] })),
      ]);
      setInspectData({
        candles: candlesRes.candles || [],
        book: bookRes,
        amm: ammRes,
        execs: execsRes.executions || [],
      });
    } finally {
      setInspectLoading(false);
    }
  };

  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [managingLiquidityMarket, setManagingLiquidityMarket] = useState<Market | null>(null);
  
  // Liquidity assisted orders injection states
  const [liqBotId, setLiqBotId] = useState(BOT_PROFILES[0].id);
  const [liqOutcome, setLiqOutcome] = useState<'Yes' | 'No'>('Yes');
  const [liqAmount, setLiqAmount] = useState<number>(5000);
  const [liqNewB, setLiqNewB] = useState<number>(1000);

  const [isSeeding, setIsSeeding] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newMarket, setNewMarket] = useState({
    question: '',
    category: 'Geral',
    description: '',
    image_url: 'https://picsum.photos/seed/market/800/400',
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    is_multi: false,
    outcomes: [
      { id: '1', name: 'Opção 1', price: 0.5, pool: 1000 },
      { id: '2', name: 'Opção 2', price: 0.5, pool: 1000 }
    ],
    b: 1000, // default liquidity parameter
    showGraph: true,
    showCandlestick: false,
    showOrderBook: false,
    showCountdown: true,
    showComments: true,
    showStatistics: true,
    graphType: 'line',
    type: 'standard'
  });

  const [newCategory, setNewCategory] = useState({ 
    name: '', 
    icon: 'Globe', 
    status: 'active' as 'active' | 'blocked' | 'hidden',
    order: 0
  });

  // Calculate dynamic investments statistics for each Market
  const getMarketStats = (marketId: string) => {
    const marketTrades = (trades || []).filter((t: any) => t.market_id === marketId);
    
    // Extract unique human user ids
    const humanTraders = new Set(
      marketTrades
        .filter((t: any) => !t.user_id?.startsWith('bot_'))
        .map((t: any) => t.user_id)
    );
    
    // Extract unique bot ids
    const botTraders = new Set(
      marketTrades
        .filter((t: any) => t.user_id?.startsWith('bot_'))
        .map((t: any) => t.user_id)
    );

    // Sum of trade commission fees (assume 2.5% if not saved on the trade document)
    const platformEarnings = marketTrades.reduce((acc: number, t: any) => {
      const fee = t.fee !== undefined ? t.fee : (t.amount * 0.025);
      return acc + fee;
    }, 0);

    return {
      humanCount: humanTraders.size,
      botCount: botTraders.size,
      earnings: platformEarnings,
      totalTrades: marketTrades.length
    };
  };

  const handleSeedMarkets = async () => {
    setIsSeeding(true);
    try {
      const { MOCK_MARKETS } = await import('../../constants');
      await firebaseService.seedMarkets(MOCK_MARKETS);
      
      // Seed default categories
      const { CATEGORIES } = await import('../../constants');
      const filteredCategories = CATEGORIES.filter(c => c !== 'Todos' && c !== 'Trending' && c !== 'Breaking' && c !== 'Novo');
      for (let i = 0; i < filteredCategories.length; i++) {
        const catName = filteredCategories[i];
        const hasCat = categories.some(existingCat => existingCat.name.toLowerCase() === catName.toLowerCase());
        if (!hasCat) {
          await firebaseService.createCategory({
            name: catName,
            icon: 'Globe',
            status: 'active',
            order: i
          });
        }
      }

      addToast('Mercados e categorias semeados no Firestore com sucesso!', 'success');
      onRefreshData();
    } catch (error: any) {
      addToast('Erro ao semear dados: ' + error.message, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCreateMarketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const totalPool = newMarket.is_multi 
        ? newMarket.outcomes.reduce((acc, o) => acc + o.pool, 0)
        : 2000;

      await firebaseService.createMarket({
        question: newMarket.question,
        category: newMarket.category,
        description: newMarket.description,
        image_url: newMarket.image_url,
        yes_price: newMarket.is_multi ? 0 : 0.5,
        no_price: newMarket.is_multi ? 0 : 0.5,
        pool_yes: newMarket.is_multi ? 0 : 1000,
        pool_no: newMarket.is_multi ? 0 : 1000,
        volume: 0,
        resolved: false,
        status: 'active',
        tags: [newMarket.category],
        end_date: new Date(newMarket.end_date).toISOString(),
        is_multi: newMarket.is_multi,
        outcomes: newMarket.is_multi ? newMarket.outcomes : null,
        b: Number(newMarket.b || 1000),
        showGraph: newMarket.showGraph,
        showCandlestick: newMarket.showCandlestick,
        showOrderBook: newMarket.showOrderBook,
        showCountdown: newMarket.showCountdown,
        showComments: newMarket.showComments,
        showStatistics: newMarket.showStatistics,
        graphType: newMarket.graphType,
        type: newMarket.type
      });

      setShowCreateMarket(false);
      setNewMarket({
        question: '',
        category: 'Geral',
        description: '',
        image_url: 'https://picsum.photos/seed/market/800/400',
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        is_multi: false,
        outcomes: [
          { id: '1', name: 'Opção 1', price: 0.5, pool: 1000 },
          { id: '2', name: 'Opção 2', price: 0.5, pool: 1000 }
        ],
        b: 1000,
        showGraph: true,
        showCandlestick: false,
        showOrderBook: false,
        showCountdown: true,
        showComments: true,
        showStatistics: true,
        graphType: 'line',
        type: 'standard'
      });
      onRefreshData();
      addToast('Mercado criado com sucesso!', 'success');
    } catch (error: any) {
      addToast('Erro ao criar: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMarket) return;
    setLoading(true);
    try {
      await firebaseService.updateMarket(editingMarket.id, {
        question: editingMarket.question,
        category: editingMarket.category,
        end_date: editingMarket.end_date,
        status: editingMarket.status || 'active',
        description: editingMarket.description || '',
        b: Number(editingMarket.b || 1000),
        showGraph: editingMarket.showGraph !== undefined ? editingMarket.showGraph : true,
        showCandlestick: editingMarket.showCandlestick !== undefined ? editingMarket.showCandlestick : false,
        showOrderBook: editingMarket.showOrderBook !== undefined ? editingMarket.showOrderBook : false,
        showCountdown: editingMarket.showCountdown !== undefined ? editingMarket.showCountdown : true,
        showComments: editingMarket.showComments !== undefined ? editingMarket.showComments : true,
        showStatistics: editingMarket.showStatistics !== undefined ? editingMarket.showStatistics : true,
        graphType: editingMarket.graphType || 'line',
        type: editingMarket.type || 'standard'
      });
      setEditingMarket(null);
      onRefreshData();
      addToast('Mercado atualizado com sucesso!', 'success');
    } catch (e: any) {
      addToast('Erro ao editar mercado: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLiquidityB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingLiquidityMarket) return;
    setLoading(true);
    try {
      await firebaseService.updateMarket(managingLiquidityMarket.id, {
        b: Number(liqNewB)
      });
      // Sync local state in modal
      setManagingLiquidityMarket(prev => prev ? { ...prev, b: Number(liqNewB) } : null);
      onRefreshData();
      addToast(`Parâmetro b de liquidez ajustado para ${liqNewB} KZ!`, 'success');
    } catch (e: any) {
      addToast('Erro ao atualizar liquidez: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInjectTradeLiquidity = async () => {
    if (!managingLiquidityMarket) return;
    setLoading(true);
    try {
      const selectedBot = BOT_PROFILES.find(b => b.id === liqBotId);
      if (!selectedBot) return;

      // Execute real bilateral CLOB liquidity injection via Express
      await ammApi.executeBotSandboxLiquidity({
        marketId: managingLiquidityMarket.id,
        botId: selectedBot.id,
        outcome: liqOutcome,
        amountKz: liqAmount,
      });

      // Fetch refined market data to display updated volume & prices
      const updated = await firebaseService.getMarket(managingLiquidityMarket.id);
      if (updated) {
        setManagingLiquidityMarket(updated);
      }

      onRefreshData();
      addToast(`Liquidez CLOB de ${liqAmount.toLocaleString()} KZ injetada via ${selectedBot.name.split(' (')[0]}!`, 'success');
    } catch (e: any) {
      addToast('Erro ao simular injeção de liquidez no CLOB: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveMarket = async (marketId: string, outcome: string) => {
    const motive = window.prompt(`Resolver mercado como "${outcome}"? Insira o motivo/fonte de verificação oficial da resolução (Ex: Relatório oficial do Diário da República, Google Finance, etc):`);
    if (motive === null) return; // Cancelled
    if (!motive.trim()) {
      addToast('É obrigatório informar o motivo ou fonte de verificação para resolver o mercado.', 'error');
      return;
    }

    try {
      if (outcome === 'Yes' || outcome === 'No') {
        await ammApi.resolveClobMarket(marketId, outcome, motive);
      } else {
        await firebaseService.resolveMarket(marketId, outcome, motive);
      }
      onRefreshData();
      addToast('Mercado liquidado no motor CLOB+AMM e sincronizado com sucesso!', 'success');
    } catch (error: any) {
      addToast('Erro ao resolver contrato: ' + error.message, 'error');
    }
  };

  const handleResetMarket = async (marketId: string) => {
    if (window.confirm('Tem certeza de que deseja resetar este mercado? As pools de SIM e NÃO retornarão a 1000 KZ, as probabilidades voltarão a 50/50, e todas as posições antigas e históricos de transação para este mercado serão excluídos no banco de dados.')) {
      try {
        await firebaseService.resetMarket(marketId);
        await firebaseService.logAdminAction('admin', 'reset_market', `Resetou o mercado ${marketId} para o estado ativo e limpou posições.`);
        onRefreshData();
        addToast('Mercado resetado com sucesso! Pools reequilibradas para 50%/50%.', 'success');
      } catch (error: any) {
        addToast('Erro ao resetar mercado: ' + error.message, 'error');
      }
    }
  };

  const handleDeleteMarket = async (marketId: string) => {
    if (window.confirm('Tem certeza que deseja apagar este mercado definitivamente? Históricos e posições associados sumirão.')) {
      try {
        await firebaseService.deleteMarket(marketId);
        onRefreshData();
        addToast('Mercado excluído com sucesso.', 'success');
      } catch (e: any) {
        addToast('Erro ao apagar mercado: ' + e.message, 'error');
      }
    }
  };

  // Category Actions
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await firebaseService.createCategory(newCategory);
      setShowCreateCategory(false);
      setNewCategory({ name: '', icon: 'Globe', status: 'active', order: 0 });
      onRefreshData();
      addToast('Nova categoria estabelecida!', 'success');
    } catch (error: any) {
      addToast('Erro ao criar categoria: ' + error.message, 'error');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await firebaseService.updateCategory(editingCategory.id, {
        name: editingCategory.name,
        icon: editingCategory.icon || 'Globe',
        status: editingCategory.status || 'active',
        order: Number(editingCategory.order || 0)
      });
      setEditingCategory(null);
      onRefreshData();
      addToast('Categoria modificada com sucesso!', 'success');
    } catch (error: any) {
      addToast('Erro ao editar categoria: ' + error.message, 'error');
    }
  };

  const handleFastUpdateCategoryStatus = async (cat: Category, status: 'active' | 'blocked' | 'hidden') => {
    try {
      await firebaseService.updateCategory(cat.id, { ...cat, status });
      onRefreshData();
      addToast(`Categoria mapeada como ${status === 'active' ? 'Ativa' : status === 'blocked' ? 'Bloqueada' : 'Oculta'}!`, 'info');
    } catch (e: any) {
      addToast('Erro ao atualizar estado da categoria: ' + e.message, 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (window.confirm('Deseja apagar esta categoria definitivamente? Isso não excluirá os mercados que pertençam a ela, mas ela não será exibida.')) {
      try {
        await firebaseService.deleteCategory(categoryId);
        onRefreshData();
        addToast('Categoria eliminada com sucesso.', 'success');
      } catch (e: any) {
        addToast('Erro ao apagar categoria: ' + e.message, 'error');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Top Controller Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-market-card p-6 rounded-2xl border border-market-border">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-market-green" />
            Controle de Mercados e Categorias
          </h3>
          <p className="text-xs text-market-text-muted mt-1">
            Gestão avançada de regras das apostas, re-ajuste de categorias, filtragem, monitorização de investimentos e ajuste fino de liquidez.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSeedMarkets}
            disabled={isSeeding}
            className="market-button-outline flex items-center gap-2 px-5 py-3 text-xs disabled:opacity-50"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin text-market-green" /> : 'Semeador de Mercados'}
          </button>

          <button
            onClick={() => {
              setNewCategory({ name: '', icon: 'Globe', status: 'active', order: 0 });
              setShowCreateCategory(true);
            }}
            className="market-button-outline flex items-center gap-2 px-5 py-3 text-xs border-dashed hover:border-market-green/50"
          >
            <Plus className="w-3.5 h-3.5 text-market-green" /> Categoria
          </button>

          <button
            onClick={() => setShowCreateMarket(true)}
            className="market-button-primary flex items-center gap-2 px-6 py-3 text-xs shadow-md shadow-market-green/20"
          >
            <Plus className="w-4 h-4" /> Novo Mercado
          </button>
        </div>
      </div>

      {/* Switch Sub-tabs (Mercados vs Categorias) */}
      <div className="flex gap-2 p-1.5 bg-market-card-lighter/25 border border-market-border rounded-xl max-w-md">
        <button
          onClick={() => setActiveSubTab('markets')}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'markets' 
              ? 'bg-market-green text-market-bg font-black' 
              : 'text-market-text-muted hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          Mercados ({markets.length})
        </button>
        <button
          onClick={() => setActiveSubTab('categories')}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'categories' 
              ? 'bg-market-green text-market-bg font-black' 
              : 'text-market-text-muted hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Categorias ({categories.length})
        </button>
      </div>

      {/* Main Grid View */}
      {activeSubTab === 'markets' ? (
        <div className="market-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="market-table w-full text-right lg:text-left">
              <thead>
                <tr className="bg-market-card-lighter/20 border-b border-market-border">
                  <th className="market-table-header py-4 pl-4 text-left">Mercado / Título</th>
                  <th className="market-table-header py-4 text-center">Categoria</th>
                  <th className="market-table-header py-4 text-center">Volume e Liquidez</th>
                  <th className="market-table-header py-4 text-center">Estatísticas (Humanos vs Bots)</th>
                  <th className="market-table-header py-4 text-center">Ganhos Acumulados</th>
                  <th className="market-table-header py-4 text-center">Estado</th>
                  <th className="market-table-header py-4 text-center">Resolução</th>
                  <th className="market-table-header py-4 pr-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {markets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-market-text-muted italic text-xs">
                      Nenhum mercado registrado. Utilize o semeador automático acima.
                    </td>
                  </tr>
                ) : (
                  markets.map((m) => {
                    const statsInfo = getMarketStats(m.id);
                    return (
                      <tr key={m.id} className="hover:bg-market-card-lighter/30 transition-colors group">
                        {/* Title of Market */}
                        <td className="market-table-cell py-4 pl-4 text-left">
                          <div className="flex items-center gap-3">
                            <img src={m.image_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-market-border shrink-0" referrerPolicy="no-referrer" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-white group-hover:text-market-green transition-all line-clamp-1 max-w-[240px] text-left">{m.question}</span>
                              <span className="text-[9px] text-[#00ff88] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                                ID: {m.id?.slice(0, 8)} 
                                {m.is_multi && <span className="bg-blue-500/20 text-blue-400 px-1 rounded text-[8px]">MULTI</span>}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="market-table-cell text-center">
                          <span className="px-2.5 py-0.5 bg-market-card border border-market-border rounded text-[9px] font-black text-market-text-muted uppercase tracking-wider">
                            {m.category || 'Geral'}
                          </span>
                        </td>

                        {/* Volume and Liquidez b */}
                        <td className="market-table-cell text-center font-mono">
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{(m.volume || 0).toLocaleString()} KZ</span>
                            <span className="text-[10px] text-market-text-muted">Parâmetro b: <strong className="text-[#00ff88]">{m.b || 1000}</strong></span>
                          </div>
                        </td>

                        {/* Stats humans vs bots */}
                        <td className="market-table-cell text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex gap-2 items-center text-[10px] bg-slate-950/40 px-2 py-1 rounded border border-market-border">
                              <span className="flex items-center gap-1 text-slate-300 font-bold">
                                <Users className="w-3 h-3 text-market-green" /> {statsInfo.humanCount} Hum
                              </span>
                              <span className="text-market-border">|</span>
                              <span className="flex items-center gap-1 text-slate-300 font-bold">
                                <Cpu className="w-3 h-3 text-blue-400" /> {statsInfo.botCount} Bots
                              </span>
                            </div>
                            <span className="text-[9px] text-market-text-muted font-bold font-mono uppercase tracking-widest">{statsInfo.totalTrades} Ordens Totais</span>
                          </div>
                        </td>

                        {/* Ganhos Acumulados (Fees Gained) */}
                        <td className="market-table-cell text-center font-mono font-bold text-market-green text-xs">
                          {statsInfo.earnings.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KZ
                        </td>

                        {/* Status (Block & Hide supported) */}
                        <td className="market-table-cell text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1 ${
                            m.resolved 
                              ? 'bg-market-text-muted/10 text-market-text-muted border-market-border' 
                              : m.status === 'blocked'
                              ? 'bg-market-red/10 text-market-red border-market-red/30'
                              : m.status === 'hidden'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-market-green/10 text-market-green border-market-green/20'
                          }`}>
                            {m.resolved && 'Resolvido'}
                            {!m.resolved && m.status === 'blocked' && (
                              <>
                                <ShieldAlert className="w-2.5 h-2.5" />
                                Bloqueado
                              </>
                            )}
                            {!m.resolved && m.status === 'hidden' && (
                              <>
                                <EyeOff className="w-2.5 h-2.5" />
                                Oculto
                              </>
                            )}
                            {!m.resolved && m.status !== 'blocked' && m.status !== 'hidden' && 'Ativo'}
                          </span>
                        </td>

                        {/* Settlement Resolucao */}
                        <td className="market-table-cell text-center">
                          {m.resolved ? (
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <span className="px-2.5 py-1 rounded bg-market-green/15 text-market-green text-[10px] font-black uppercase tracking-widest border border-market-green/30">
                                {m.resolution_outcome}
                              </span>
                              <button
                                onClick={() => handleResetMarket(m.id)}
                                className="px-2 py-1 bg-amber-500/15 text-amber-500 text-[8px] font-black uppercase tracking-wider rounded border border-amber-500/30 hover:bg-amber-500 hover:text-market-bg transition-all flex items-center gap-1 cursor-pointer"
                                title="Resetar resolução e devolver estado Ativo"
                              >
                                <RotateCcw className="w-2.5 h-2.5 animate-spin-reverse" />
                                Resetar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {m.is_multi && m.outcomes ? (
                                <div className="flex flex-wrap gap-1 max-w-[150px] justify-center">
                                  {m.outcomes.map(o => (
                                    <button
                                      key={o.id}
                                      onClick={() => handleResolveMarket(m.id, o.name)}
                                      className="px-2 py-0.5 bg-market-green/15 text-market-green border border-market-green/20 rounded text-[8px] font-black hover:bg-market-green hover:text-market-bg transition-all uppercase"
                                    >
                                      {o.name}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleResolveMarket(m.id, 'Yes')}
                                    className="p-1 px-3 bg-market-green/25 text-[#00ff88] border border-market-green/40 text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-market-green hover:text-market-bg transition-colors"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    onClick={() => handleResolveMarket(m.id, 'No')}
                                    className="p-1 px-3 bg-market-red/20 text-market-red border border-market-red/30 text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-market-red hover:text-white transition-colors"
                                  >
                                    Não
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Active Actions */}
                        <td className="market-table-cell text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* Inspect CLOB + AMM + OHLC Drawer */}
                            <button
                              onClick={() => openMarketInspector(m)}
                              className="p-2 bg-[#2d3748] hover:bg-cyan-600 text-slate-300 hover:text-white rounded-xl transition-all"
                              title="Inspecionar Livro CLOB, OHLCV, AMM e Execuções"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {/* Liquidity Manager Action */}
                            <button
                              onClick={() => {
                                setManagingLiquidityMarket(m);
                                setLiqNewB(m.b || 1000);
                              }}
                              className="p-2 bg-market-green/10 hover:bg-market-green text-market-green hover:text-market-bg border border-market-green/20 rounded-xl transition-all"
                              title="Gerenciar Liquidez / Fornecer b"
                            >
                              <Coins className="w-3.5 h-3.5" />
                            </button>
                            {/* Reset Action */}
                            <button
                              onClick={() => handleResetMarket(m.id)}
                              className="p-2 bg-[#2d3748] hover:bg-amber-500 text-slate-300 hover:text-market-bg border border-transparent hover:border-amber-500/20 rounded-xl transition-all"
                              title="Resetar mercado (pools para 50%/50% e limpar históricos)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            {/* Edit Action */}
                            <button
                              onClick={() => setEditingMarket(m)}
                              className="p-2 bg-[#2d3748] hover:bg-blue-600 text-slate-300 hover:text-white rounded-xl transition-all"
                              title="Editar regras/categoria do mercado"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete Action */}
                            <button
                              onClick={() => handleDeleteMarket(m.id)}
                              className="p-2 bg-[#2d3748] hover:bg-market-red text-slate-300 hover:text-white rounded-xl transition-all"
                              title="Eliminar mercado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      ) : (
        /* Categories Subtab */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => {
              const catStatus = cat.status || 'active';
              return (
                <div 
                  key={cat.id || cat.name} 
                  className={`market-card p-6 border transition-all ${
                    catStatus === 'blocked' 
                      ? 'border-market-red/30 bg-market-red/5' 
                      : catStatus === 'hidden'
                      ? 'border-amber-500/20 bg-amber-500/5'
                      : 'border-market-border bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-market-green/10 text-market-green border border-market-green/20 flex items-center justify-center font-bold text-lg">
                        {cat.icon === 'Globe' ? '🌍' : cat.icon === 'TrendingUp' ? '📈' : cat.icon === 'Sparkles' ? '✨' : '📁'}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-white uppercase tracking-wider">{cat.name}</h4>
                        <p className="text-[10px] text-market-text-muted mt-0.5">Ordem: {cat.order || 0}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border ${
                      catStatus === 'active' 
                        ? 'bg-market-green/10 text-market-green border-market-green/20' 
                        : catStatus === 'blocked'
                        ? 'bg-market-red/10 text-market-red border-market-red/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {catStatus === 'active' && 'Ativo'}
                      {catStatus === 'blocked' && 'Bloqueado'}
                      {catStatus === 'hidden' && 'Oculto'}
                    </span>
                  </div>

                  {/* Quick Toggles and Actions for Category */}
                  <div className="mt-6 pt-4 border-t border-market-border flex items-center justify-between gap-2">
                    <div className="flex gap-1.5">
                      {/* State togglers */}
                      <button
                        onClick={() => handleFastUpdateCategoryStatus(cat, 'active')}
                        className={`p-1.5 rounded-lg text-[9px] font-black border uppercase tracking-wider transition-all flex items-center gap-1 ${
                          catStatus === 'active' 
                            ? 'bg-market-green/15 text-market-green border-market-green/30' 
                            : 'bg-market-bg text-market-text-muted border-market-border'
                        }`}
                        title="Tornar Categoria Ativa"
                      >
                        Ativo
                      </button>
                      <button
                        onClick={() => handleFastUpdateCategoryStatus(cat, 'blocked')}
                        className={`p-1.5 rounded-lg text-[9px] font-black border uppercase tracking-wider transition-all flex items-center gap-1 ${
                          catStatus === 'blocked' 
                            ? 'bg-market-red/20 text-market-red border-market-red/40' 
                            : 'bg-market-bg text-market-text-muted border-market-border'
                        }`}
                        title="Bloquear Apostas na Categoria"
                      >
                        <Lock className="w-2.5 h-2.5" /> Block
                      </button>
                      <button
                        onClick={() => handleFastUpdateCategoryStatus(cat, 'hidden')}
                        className={`p-1.5 rounded-lg text-[9px] font-black border uppercase tracking-wider transition-all flex items-center gap-1 ${
                          catStatus === 'hidden' 
                            ? 'bg-amber-500/20 text-amber-500 border-amber-500/35' 
                            : 'bg-market-bg text-market-text-muted border-market-border'
                        }`}
                        title="Ocultar Categoria do Menu"
                      >
                        <EyeOff className="w-2.5 h-2.5" /> Ocultar
                      </button>
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingCategory(cat)}
                        className="p-2 hover:bg-[#2d3748] hover:text-white rounded-lg transition-colors text-market-text-muted"
                        title="Editar Nome/Ícone"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-2 hover:bg-market-red/10 hover:text-market-red rounded-lg transition-colors text-market-text-muted"
                        title="Apagar Categoria"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- MODALS ZONE --- */}

      {/* Create Market Modal */}
      {showCreateMarket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-market-card border border-market-border rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white uppercase tracking-widest border-b border-market-border pb-3">Criar Novo Mercado</h3>
            <form onSubmit={handleCreateMarketSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Pergunta de Predição</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: O PIB de Angola vai crescer mais de 4% em 2026?"
                  value={newMarket.question}
                  onChange={(e) => setNewMarket({...newMarket, question: e.target.value})}
                  className="market-input w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Categoria</label>
                  <select 
                    value={newMarket.category}
                    onChange={(e) => setNewMarket({...newMarket, category: e.target.value})}
                    className="market-input w-full bg-market-card"
                  >
                    {categories && categories.length > 0 ? (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))
                    ) : (
                      ['Finanças', 'Angola', 'Crypto', 'Desporto', 'Política', 'Economia', 'Tech'].map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Data Limite de Apostas</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={newMarket.end_date}
                    onChange={(e) => setNewMarket({...newMarket, end_date: e.target.value})}
                    className="market-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">URL da Imagem Ilustrativa</label>
                  <input 
                    type="url" 
                    value={newMarket.image_url}
                    onChange={(e) => setNewMarket({...newMarket, image_url: e.target.value})}
                    className="market-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2 flex items-center gap-1">
                    Parâmetro de Liquidez b 
                    <HelpCircle className="w-3 h-3 text-market-text-muted" title="AMM LMSR parameter: 1000 standard. Lower = more extreme prize response." />
                  </label>
                  <input 
                    type="number" 
                    required
                    value={newMarket.b}
                    onChange={(e) => setNewMarket({...newMarket, b: Number(e.target.value)})}
                    className="market-input w-full font-mono"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Instruções e Regras de Liquidação da Aposta</label>
                <textarea 
                  value={newMarket.description}
                  onChange={(e) => setNewMarket({...newMarket, description: e.target.value})}
                  className="market-input w-full h-24 resize-none text-xs"
                  placeholder="Determine os árbitros, canais de verificação e os termos objetivos necessários para declarar o resultado de encerramento..."
                />
              </div>

              {/* Advanced UI configurations */}
              <div className="p-4 bg-[#1e2024]/40 border border-market-border rounded-xl space-y-3">
                <span className="text-xs font-black text-market-green uppercase tracking-wider block">Arquitetura de Visibilidade (Market Engine)</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-market-text-muted uppercase mb-1">Tipo de Mercado</label>
                    <select
                      value={newMarket.type}
                      onChange={(e) => setNewMarket({...newMarket, type: e.target.value})}
                      className="market-input w-full py-1.5 text-xs bg-market-card font-semibold"
                    >
                      <option value="standard">Padrão (Standard)</option>
                      <option value="microcredit">Micro-Crédito (Investimento)</option>
                      <option value="politics">Política</option>
                      <option value="economy">Economia</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-market-text-muted uppercase mb-1">Tipo de Gráfico</label>
                    <select
                      value={newMarket.graphType}
                      onChange={(e) => setNewMarket({...newMarket, graphType: e.target.value})}
                      className="market-input w-full py-1.5 text-xs bg-market-card font-semibold"
                    >
                      <option value="line">Preço de Linha</option>
                      <option value="candlestick">Velas (Candlestick)</option>
                      <option value="none">Nenhum (Ocultar)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={newMarket.showGraph}
                      onChange={(e) => setNewMarket({...newMarket, showGraph: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Gráfico</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={newMarket.showCountdown}
                      onChange={(e) => setNewMarket({...newMarket, showCountdown: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Countdown</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={newMarket.showComments}
                      onChange={(e) => setNewMarket({...newMarket, showComments: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Comentários</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={newMarket.showStatistics}
                      onChange={(e) => setNewMarket({...newMarket, showStatistics: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Estatísticas</span>
                  </label>
                </div>
              </div>

              <div className="p-4 bg-market-card-lighter rounded-xl border border-market-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Aposta Alternativa (Multi-Opção)</span>
                  <button 
                    type="button"
                    onClick={() => setNewMarket({...newMarket, is_multi: !newMarket.is_multi})}
                    className={`w-12 h-6 rounded-full transition-all relative ${newMarket.is_multi ? 'bg-market-green' : 'bg-market-border'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newMarket.is_multi ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {newMarket.is_multi && (
                  <div className="space-y-2">
                    {newMarket.outcomes.map((outcome, index) => (
                      <div key={outcome.id || index} className="flex gap-2">
                        <input 
                          type="text"
                          placeholder={`Nome da Opção ${index + 1}`}
                          value={outcome.name}
                          onChange={(e) => {
                            const newOutcomes = [...newMarket.outcomes];
                            newOutcomes[index].name = e.target.value;
                            setNewMarket({...newMarket, outcomes: newOutcomes});
                          }}
                          className="market-input flex-1 py-1.5 text-xs font-bold"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const newOutcomes = newMarket.outcomes.filter((_, i) => i !== index);
                            setNewMarket({...newMarket, outcomes: newOutcomes});
                          }}
                          className="p-1 px-2 hover:bg-market-red/10 text-market-red rounded-lg text-xs"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => {
                        setNewMarket({
                          ...newMarket, 
                          outcomes: [...newMarket.outcomes, { id: Math.random().toString(), name: '', price: 0.5, pool: 1000 }]
                        });
                      }}
                      className="w-full py-2 border border-dashed border-market-border rounded-lg text-[9px] font-black text-market-text-muted hover:text-white hover:border-market-green transition-all uppercase tracking-widest"
                    >
                      + Adicionar Opção
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button type="button" onClick={() => setShowCreateMarket(false)} className="market-button-outline py-3 text-xs uppercase tracking-widest">Cancelar</button>
                <button type="submit" disabled={loading} className="market-button-primary py-3 flex justify-center items-center text-xs uppercase tracking-widest">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-market-bg" /> : 'Criar Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCreateCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-market-card p-6 rounded-2xl border border-market-border space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white uppercase tracking-widest">Criar Categoria</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Nome da Categoria</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Entretenimento, Eleições"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  className="market-input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2 font-bold">Ícone Lucide</label>
                  <input 
                    type="text" 
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})}
                    className="market-input w-full"
                    placeholder="Ex: Sparkles, Globe, Coins"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2 font-bold">Ordem</label>
                  <input 
                    type="number" 
                    value={newCategory.order}
                    onChange={(e) => setNewCategory({...newCategory, order: Number(e.target.value)})}
                    className="market-input w-full"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2 font-bold">Estado Inicial</label>
                <select 
                  value={newCategory.status}
                  onChange={(e) => setNewCategory({...newCategory, status: e.target.value as any})}
                  className="market-input w-full bg-market-card text-xs font-bold"
                >
                  <option value="active">Ativo (Aparece no menu e aceita apostas)</option>
                  <option value="blocked">Bloqueado (Aparece mas desativa negociações)</option>
                  <option value="hidden">Oculto (Fica invisível na área dos clientes)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setShowCreateCategory(false)} className="market-button-outline py-3 text-xs">Cancelar</button>
                <button type="submit" className="market-button-primary py-3 text-xs">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-market-card p-6 rounded-2xl border border-market-border space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white uppercase tracking-widest border-b border-market-border pb-3">Editar Categoria</h3>
            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Nome da Categoria</label>
                <input 
                  type="text" 
                  required
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({...editingCategory, name: e.target.value})}
                  className="market-input w-full font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Ícone</label>
                  <input 
                    type="text" 
                    value={editingCategory.icon || ''}
                    onChange={(e) => setEditingCategory({...editingCategory, icon: e.target.value})}
                    className="market-input w-full"
                    placeholder="Globe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Ordem</label>
                  <input 
                    type="number" 
                    value={editingCategory.order || 0}
                    onChange={(e) => setEditingCategory({...editingCategory, order: Number(e.target.value)})}
                    className="market-input w-full font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Estado de Visibilidade</label>
                <select 
                  value={editingCategory.status || 'active'}
                  onChange={(e) => setEditingCategory({...editingCategory, status: e.target.value as any})}
                  className="market-input w-full bg-market-card font-bold text-xs"
                >
                  <option value="active">Ativo</option>
                  <option value="blocked">Bloqueado (Bloqueia apostas associadas)</option>
                  <option value="hidden">Oculto (Esconde na área de apostador)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setEditingCategory(null)} className="market-button-outline py-3 text-xs uppercase font-black">Cancelar</button>
                <button type="submit" className="market-button-primary py-3 text-xs uppercase font-black">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Market Modal (TROCA DE CATEGORIA E EDITA AS REGRAS) */}
      {editingMarket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-market-card p-6 rounded-2xl border border-market-border space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white uppercase tracking-widest border-b border-market-border pb-3">Editar Contrato / Parâmetros</h3>
            <form onSubmit={handleUpdateMarket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Pergunta de Predição</label>
                <input 
                  type="text" 
                  required
                  value={editingMarket.question}
                  onChange={(e) => setEditingMarket({...editingMarket, question: e.target.value})}
                  className="market-input w-full text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* TROCA DE CATEGORIA */}
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Categoria Atual</label>
                  <select 
                    value={editingMarket.category}
                    onChange={(e) => setEditingMarket({...editingMarket, category: e.target.value})}
                    className="market-input w-full bg-market-card text-xs font-bold"
                  >
                    {categories && categories.length > 0 ? (
                      categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    ) : (
                      ['Finanças', 'Angola', 'Crypto', 'Desporto', 'Política', 'Economia', 'Tech'].map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* BLOQUEAR E OCULTAR (Status selector) */}
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Estado de Operação</label>
                  <select 
                    value={editingMarket.status || 'active'}
                    onChange={(e) => setEditingMarket({...editingMarket, status: e.target.value as any})}
                    className="market-input w-full bg-market-card text-xs font-bold"
                  >
                    <option value="active">Ativo (Aberto para negócios)</option>
                    <option value="closed">Fechado (Somente expiração)</option>
                    <option value="blocked">Bloqueado (Visualiza, mas bloqueia ordens)</option>
                    <option value="hidden">Oculto (Esconde das listagens públicas)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Data Limite</label>
                  <input 
                    type="datetime-local" 
                    value={editingMarket.end_date.slice(0, 16)}
                    onChange={(e) => setEditingMarket({...editingMarket, end_date: new Date(e.target.value).toISOString()})}
                    className="market-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Sensitividade b (LMSR)</label>
                  <input 
                    type="number" 
                    value={editingMarket.b || 1000}
                    onChange={(e) => setEditingMarket({...editingMarket, b: Number(e.target.value)})}
                    className="market-input w-full font-mono"
                  />
                </div>
              </div>

              {/* EDITA AS REGRAS DO MERCADO */}
              <div>
                <label className="block text-xs font-bold text-[#00ff88] uppercase mb-2 flex items-center gap-1.5 font-bold">
                  <span>Regras de Auditoria e Diretrizes da Aposta</span>
                </label>
                <textarea 
                  value={editingMarket.description || ''}
                  onChange={(e) => setEditingMarket({...editingMarket, description: e.target.value})}
                  className="market-input w-full h-32 resize-none text-xs"
                  placeholder="Defina as regras, fuso horário, árbitros para apuração de resultado deste mercado..."
                />
              </div>

              {/* Advanced UI configurations */}
              <div className="p-4 bg-[#1e2024]/40 border border-market-border rounded-xl space-y-3">
                <span className="text-xs font-black text-market-green uppercase tracking-wider block">Arquitetura de Visibilidade (Market Engine)</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-market-text-muted uppercase mb-1">Tipo de Mercado</label>
                    <select
                      value={editingMarket.type || 'standard'}
                      onChange={(e) => setEditingMarket({...editingMarket, type: e.target.value})}
                      className="market-input w-full py-1.5 text-xs bg-market-card font-semibold"
                    >
                      <option value="standard">Padrão (Standard)</option>
                      <option value="microcredit">Micro-Crédito (Investimento)</option>
                      <option value="politics">Política</option>
                      <option value="economy">Economia</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-market-text-muted uppercase mb-1">Tipo de Gráfico</label>
                    <select
                      value={editingMarket.graphType || 'line'}
                      onChange={(e) => setEditingMarket({...editingMarket, graphType: e.target.value})}
                      className="market-input w-full py-1.5 text-xs bg-market-card font-semibold"
                    >
                      <option value="line">Preço de Linha</option>
                      <option value="candlestick">Velas (Candlestick)</option>
                      <option value="none">Nenhum (Ocultar)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingMarket.showGraph !== false}
                      onChange={(e) => setEditingMarket({...editingMarket, showGraph: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Gráfico</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingMarket.showCountdown !== false}
                      onChange={(e) => setEditingMarket({...editingMarket, showCountdown: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Countdown</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingMarket.showComments !== false}
                      onChange={(e) => setEditingMarket({...editingMarket, showComments: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Comentários</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingMarket.showStatistics !== false}
                      onChange={(e) => setEditingMarket({...editingMarket, showStatistics: e.target.checked})}
                      className="rounded border-market-border text-market-green bg-[#2A2B2F] focus:ring-0 w-4 h-4"
                    />
                    <span>Mostrar Estatísticas</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button type="button" onClick={() => setEditingMarket(null)} className="market-button-outline py-3 text-xs uppercase font-black">Cancelar</button>
                <button type="submit" disabled={loading} className="market-button-primary py-3 flex justify-center items-center text-xs uppercase font-black">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-market-bg" /> : 'Salvar Regras'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LIQUIDITY OPTIONS MODAL (OPÇAO DE LIQUIDES) --- */}
      {managingLiquidityMarket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-market-card p-6 rounded-2xl border border-market-border space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="border-b border-market-border pb-3">
              <h3 className="text-base font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Coins className="w-5 h-5 text-market-green" />
                Painel de Engenharia de Liquidez (LMSR)
              </h3>
              <p className="text-[11px] text-market-text-muted mt-1 leading-relaxed">
                Gestão profunda de sensibilidade de preços AMM baseada no algoritmo Logarithmic Market Scoring Rule (LMSR). Mercado: <strong>{managingLiquidityMarket.question}</strong>
              </p>
            </div>

            {/* Part 1: Current market pools and prices */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-market-border font-mono text-xs">
              <div className="space-y-1">
                <span className="text-market-text-muted uppercase text-[9px] block">Pool SIM</span>
                <span className="text-white font-bold block">{Math.round(managingLiquidityMarket.pool_yes || 0).toLocaleString()} Quotas</span>
                <span className="text-[#00ff88] font-black font-mono block">Preço: {Math.round((managingLiquidityMarket.yes_price || 0.5) * 100)}%</span>
              </div>
              <div className="space-y-1">
                <span className="text-market-text-muted uppercase text-[9px] block">Pool NÃO</span>
                <span className="text-white font-bold block">{Math.round(managingLiquidityMarket.pool_no || 0).toLocaleString()} Quotas</span>
                <span className="text-market-red font-black font-mono block">Preço: {Math.round((managingLiquidityMarket.no_price || 0.5) * 100)}%</span>
              </div>
            </div>

            {/* Part 2: Change parameter b */}
            <form onSubmit={handleUpdateLiquidityB} className="space-y-3 bg-market-card-lighter p-4 rounded-lg border border-market-border/60">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Ajustar Sensibilidade do AMM (b-value)
              </h4>
              <p className="text-[10px] text-market-text-muted">
                O parâmetro b representa a profundidade da liquidez. Um valor <strong>maior</strong> diminui a volatilidade do preço por aposta. Um valor <strong>menor</strong> torna os preços altamentes responsivos.
              </p>
              
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input
                    type="number"
                    required
                    value={liqNewB}
                    onChange={(e) => setLiqNewB(Number(e.target.value))}
                    className="market-input w-full font-mono text-xs"
                    placeholder="1000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-market-text-muted">KZ</span>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="market-button-primary px-5 py-2.5 text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Mudar b'}
                </button>
              </div>
            </form>

            {/* Part 3: Assisted Bot Market Injection */}
            <div className="space-y-4 bg-market-card-lighter p-4 rounded-lg border border-market-border/60">
              <h4 className="text-xs font-bold text-[#00ff88] uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 animate-pulse" />
                Injeção Forçada de Ordens de Compra (Robôs)
              </h4>
              <p className="text-[10px] text-market-text-muted">
                Execute uma ordem real no AMM simulando um dos robôs cadastrados do sistema. Isso aumentará instantaneamente o Volume Total e ajustará os pools de liquidez do mercado.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-market-text-muted uppercase mb-1.5">Escolher Robô</label>
                  <select
                    value={liqBotId}
                    onChange={(e) => setLiqBotId(e.target.value)}
                    className="market-input w-full bg-market-bg text-xs font-bold"
                  >
                    {BOT_PROFILES.map(bot => (
                      <option key={bot.id} value={bot.id}>{bot.name.split(' (')[0]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-market-text-muted uppercase mb-1.5">Direção do Voto / O que apoiar</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLiqOutcome('Yes')}
                      className={`py-1.5 text-xs font-black uppercase rounded-lg border transition-all ${
                        liqOutcome === 'Yes' 
                          ? 'bg-market-green/20 text-market-green border-market-green/50 shadow-md shadow-market-green/10' 
                          : 'bg-market-bg text-market-text-muted border-market-border hover:text-white'
                      }`}
                    >
                      Muito Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setLiqOutcome('No')}
                      className={`py-1.5 text-xs font-black uppercase rounded-lg border transition-all ${
                        liqOutcome === 'No' 
                          ? 'bg-market-red/25 text-market-red border-market-red/40 shadow-md shadow-market-red/10' 
                          : 'bg-market-bg text-market-text-muted border-market-border hover:text-white'
                      }`}
                    >
                      Muito Não
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-market-text-muted uppercase mb-1.5">Volume Inicial para Injetar (KZ)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      required
                      value={liqAmount}
                      onChange={(e) => setLiqAmount(Number(e.target.value))}
                      className="market-input w-full font-mono text-xs"
                      placeholder="5000"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-market-text-muted">KZ</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleInjectTradeLiquidity}
                    disabled={loading || liqAmount <= 0}
                    className="market-button-outline px-5 py-2.5 text-xs text-market-green hover:bg-market-green hover:text-market-bg flex items-center gap-1 text-xs shrink-0 whitespace-nowrap"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Injetar Liquidez'}
                  </button>
                </div>
                <div className="flex gap-1.5 pt-2">
                  {[2000, 5000, 10000, 25000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLiqAmount(val)}
                      className="text-[9px] px-2.5 py-1 bg-market-bg border border-market-border rounded text-slate-300 hover:text-white hover:border-market-green/30"
                    >
                      +{val.toLocaleString()} KZ
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setManagingLiquidityMarket(null)} 
                className="market-button-outline py-3 w-full text-xs uppercase font-black"
              >
                Concluir & Fechar Painel de Liquidez
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MARKET INSPECTION DRAWER (CLOB + OHLCV + AMM) */}
      {inspectingMarket && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex justify-end">
          <div className="w-full max-w-2xl h-full bg-[#0d1117] border-l border-market-border p-6 overflow-y-auto space-y-6">
            <div className="flex items-start justify-between border-b border-market-border pb-4">
              <div>
                <h3 className="text-base font-bold text-white">{inspectingMarket.question}</h3>
                <p className="text-xs font-mono text-market-text-muted mt-0.5">
                  ID: {inspectingMarket.id} · Categoria: {inspectingMarket.category} · Estado: {inspectingMarket.resolved ? 'Resolvido' : inspectingMarket.status || 'active'}
                </p>
              </div>
              <button onClick={() => setInspectingMarket(null)} className="p-1.5 rounded-lg hover:bg-market-card text-market-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectLoading ? (
              <div className="py-16 flex items-center justify-center gap-2 text-xs text-market-text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-market-green" /> A carregar dados CLOB & AMM do mercado...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="market-card p-3">
                    <span className="text-[10px] text-market-text-muted uppercase block">Preço SIM</span>
                    <span className="text-sm font-bold text-market-green">{Math.round((inspectingMarket.yes_price || 0.5) * 100)}¢</span>
                  </div>
                  <div className="market-card p-3">
                    <span className="text-[10px] text-market-text-muted uppercase block">Preço NÃO</span>
                    <span className="text-sm font-bold text-market-red">{Math.round((inspectingMarket.no_price || 0.5) * 100)}¢</span>
                  </div>
                  <div className="market-card p-3">
                    <span className="text-[10px] text-market-text-muted uppercase block">Alocação AMM</span>
                    <span className="text-sm font-bold text-white">
                      {((inspectData?.amm?.allocation?.allocated_capital_cents || 0) / 100).toLocaleString('pt-PT')} Kz
                    </span>
                  </div>
                  <div className="market-card p-3">
                    <span className="text-[10px] text-market-text-muted uppercase block">Exposição AMM</span>
                    <span className="text-sm font-bold text-amber-400">
                      {((inspectData?.amm?.inventory?.net_exposure_cents || 0) / 100).toLocaleString('pt-PT')} Kz
                    </span>
                  </div>
                </div>

                {/* Real OHLC Price History */}
                <div className="market-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase text-white">Histórico de Preço Executado (SIM ¢)</h4>
                  <div className="h-44">
                    {(inspectData?.candles || []).length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-market-text-muted border border-dashed border-market-border rounded-lg">
                        Sem execuções CLOB registadas neste mercado.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={inspectData?.candles || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#21262d" />
                          <XAxis dataKey="time" stroke="#8b949e" fontSize={10} />
                          <YAxis domain={[0, 100]} stroke="#8b949e" fontSize={10} tickFormatter={(v) => `${v}¢`} />
                          <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #21262d' }} />
                          <Line type="monotone" dataKey="close" name="Fecho (¢)" stroke="#00c853" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Live Order Book Depth */}
                <div className="market-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase text-white">Livro de Ofertas CLOB (SIM)</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-market-green uppercase block mb-1">Compra (Bids)</span>
                      {(inspectData?.book?.yes?.bids || []).length === 0 ? (
                        <p className="text-market-text-muted text-[11px]">Sem bids ativos</p>
                      ) : (
                        inspectData!.book.yes.bids.slice(0, 6).map((b: any, i: number) => (
                          <div key={i} className="flex justify-between py-0.5">
                            <span className="text-market-green">{b.priceCents}¢</span>
                            <span className="text-white">{b.quantity}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-market-red uppercase block mb-1">Venda (Asks)</span>
                      {(inspectData?.book?.yes?.asks || []).length === 0 ? (
                        <p className="text-market-text-muted text-[11px]">Sem asks ativos</p>
                      ) : (
                        inspectData!.book.yes.asks.slice(0, 6).map((a: any, i: number) => (
                          <div key={i} className="flex justify-between py-0.5">
                            <span className="text-market-red">{a.priceCents}¢</span>
                            <span className="text-white">{a.quantity}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Executions */}
                <div className="market-card p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase text-white">Últimas Execuções ({inspectData?.execs?.length || 0})</h4>
                  <div className="divide-y divide-market-border max-h-48 overflow-y-auto text-xs font-mono">
                    {(inspectData?.execs || []).length === 0 ? (
                      <p className="text-market-text-muted py-4 text-center">Nenhuma execução ainda.</p>
                    ) : (
                      inspectData!.execs.map((ex: any) => (
                        <div key={ex.id} className="py-2 flex items-center justify-between">
                          <span className="text-white">
                            {ex.outcome} @ {ex.price_cents}¢ × {ex.quantity}
                          </span>
                          <span className="text-market-green">{(ex.notional_cents / 100).toFixed(2)} Kz</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
