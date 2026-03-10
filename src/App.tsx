import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Wallet, 
  TrendingUp, 
  ChevronRight, 
  BarChart3, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Menu,
  X,
  LayoutGrid,
  History,
  User as UserIcon,
  Info,
  Flame,
  Zap,
  Star,
  Globe,
  Shield,
  Coins,
  Trophy,
  Landmark,
  Cpu,
  Music,
  Cloud,
  Vote,
  Bell,
  Share2,
  Bookmark,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Market, Trade, User, Position, Outcome } from './types';
import { CATEGORIES, MOCK_MARKETS } from './constants';

import { UserProfile } from './components/UserProfile';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginPage } from './components/LoginPage';

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Navbar = ({ user, onConnect, search, onSearchChange }: { user: User | null, onConnect: () => void, search: string, onSearchChange: (val: string) => void }) => {
  return (
    <nav className="sticky top-0 z-50 bg-market-bg border-b border-market-border h-16 flex items-center px-4 md:px-8 gap-4 md:gap-8">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 bg-market-green rounded-lg flex items-center justify-center text-market-bg font-bold text-lg group-hover:scale-110 transition-transform">
          MP
        </div>
        <span className="font-bold text-xl tracking-tight hidden md:block text-white">MarketPay</span>
      </Link>
      
      <div className="flex-1 max-w-xl relative group mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-market-text-muted w-4 h-4 group-focus-within:text-market-green transition-colors" />
        <input 
          type="text" 
          placeholder="Pesquisar mercados..." 
          className="w-full bg-market-card border border-market-border rounded-lg py-2 pl-10 pr-4 focus:border-market-green transition-all outline-none text-sm text-white"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-4 text-sm font-medium">
          {!user && (
            <Link to="/login" className="text-market-text-muted hover:text-white transition-colors font-bold uppercase tracking-widest text-[10px]">Entrar / Criar Conta</Link>
          )}
          {user && user.isAdmin && (
            <Link to="/admin" className="text-market-text-muted hover:text-market-green transition-colors font-bold uppercase tracking-widest text-[10px]">Admin</Link>
          )}
        </div>
        
        {!user ? (
          <button 
            onClick={onConnect}
            className="market-button-primary flex items-center gap-2 text-sm"
          >
            <Wallet className="w-4 h-4" />
            Carteira
          </button>
        ) : (
          <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-white">{user.name}</div>
              <div className="text-[10px] text-market-green font-bold">{user.balance.toLocaleString()} KZ</div>
            </div>
            <div className="w-10 h-10 bg-market-card-lighter border border-market-border rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-market-text-muted" />
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
};

const SubNavbar = ({ activeCategory, onCategoryChange }: { activeCategory: string, onCategoryChange: (cat: string) => void }) => {
  const categories = [
    { name: 'Trending', icon: Flame },
    { name: 'Breaking', icon: Zap },
    { name: 'Novo', icon: Star },
    { name: 'Angola', icon: Globe },
    { name: 'Política', icon: Vote },
    { name: 'Economia', icon: Landmark },
    { name: 'Petróleo', icon: Coins },
    { name: 'Crypto', icon: Cpu },
    { name: 'Desporto', icon: Trophy },
    { name: 'Finanças', icon: Landmark },
    { name: 'Geopolítica', icon: Globe },
    { name: 'Tech', icon: Cpu },
    { name: 'Cultura', icon: Music },
    { name: 'Clima', icon: Cloud },
    { name: 'Eleições', icon: Vote },
  ];

  return (
    <div className="bg-market-bg border-b border-market-border overflow-x-auto no-scrollbar">
      <div className="flex items-center px-4 md:px-8 py-3 gap-6 min-w-max">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onCategoryChange(cat.name)}
            className={cn(
              "flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap",
              activeCategory === cat.name ? "text-market-green" : "text-market-text-muted hover:text-white"
            )}
          >
            <cat.icon className={cn("w-4 h-4", activeCategory === cat.name ? "text-market-green" : "text-orange-500")} />
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
};

const MarketCard: React.FC<{ market: Market }> = ({ market }) => {
  return (
    <Link to={`/market/${market.id}`} className="market-card group relative hover:border-market-green/30 transition-all">
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="flex gap-2">
            {market.resolved ? (
              <span className="market-badge bg-market-green text-market-bg">RESOLVIDO: {market.resolutionOutcome === 'Yes' ? 'SIM' : 'NÃO'}</span>
            ) : (
              <span className="market-badge bg-market-green-muted text-market-green">NOVO</span>
            )}
            <span className="market-badge bg-market-card-lighter text-market-text-muted">{market.category}</span>
          </div>
        </div>
        
        <h3 className="font-bold text-sm leading-snug mb-4 group-hover:text-market-green transition-colors line-clamp-2 min-h-[2.5rem]">
          {market.question}
        </h3>
        
        <div className="mt-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button className="bg-market-green-muted border border-market-green/20 rounded-lg py-2 text-center hover:bg-market-green/20 transition-colors">
              <div className="text-xs font-bold text-market-green">Sim 0 KZ</div>
            </button>
            <button className="bg-market-red-muted border border-market-red/20 rounded-lg py-2 text-center hover:bg-market-red/20 transition-colors">
              <div className="text-xs font-bold text-market-red">Não 0 KZ</div>
            </button>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-market-text-muted font-bold uppercase tracking-wider pt-2">
            <div className="flex items-center gap-2">
              <span>{market.volume.toLocaleString()} KZ</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(market.endDate))} left</span>
            </div>
            <Bookmark className="w-3 h-3 hover:text-white cursor-pointer" />
          </div>
        </div>
      </div>
    </Link>
  );
}

const Sidebar = ({ activeCategory, onCategoryChange }: { activeCategory: string, onCategoryChange: (cat: string) => void }) => {
  return (
    <aside className="w-64 hidden xl:block shrink-0 sticky top-24 h-fit space-y-8">
      <div>
        <h4 className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest mb-4 px-2">Categorias</h4>
        <div className="space-y-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all uppercase tracking-widest",
                activeCategory === cat 
                  ? "bg-market-green text-market-bg shadow-lg shadow-market-green/20" 
                  : "text-market-text-muted hover:bg-market-card-lighter hover:text-white"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      <div className="market-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-market-green" />
          <h4 className="text-sm font-bold text-white">Tendências Agora</h4>
        </div>
        <div className="space-y-3">
          {MOCK_MARKETS.slice(0, 3).map(m => (
            <Link key={m.id} to={`/market/${m.id}`} className="block group">
              <p className="text-xs font-bold text-market-text-muted group-hover:text-market-green transition-colors line-clamp-2">
                {m.question}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-market-green">{Math.round(m.yesPrice * 1000)} KZ</span>
                <span className="text-[10px] text-market-text-muted font-bold uppercase">Vol: {(m.volume * 10).toLocaleString()} KZ</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
};

// --- Pages ---

const ConnectWalletModal = ({ isOpen, onClose, onConnect }: { isOpen: boolean, onClose: () => void, onConnect: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-market-bg/80 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-market-card border border-market-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-market-border flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Conectar Carteira</h3>
          <button onClick={onClose} className="p-2 hover:bg-market-card-lighter rounded-full transition-colors">
            <X className="w-5 h-5 text-market-text-muted" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-market-text-muted mb-6 leading-relaxed">
            Escolha como deseja se conectar. Se não tiver uma carteira, pode selecionar um provedor para criar uma.
          </p>
          {[
            { name: 'MetaMask', icon: '🦊' },
            { name: 'Coinbase Wallet', icon: '🛡️' },
            { name: 'WalletConnect', icon: '🌐' },
            { name: 'Phantom', icon: '👻' },
          ].map((wallet) => (
            <button 
              key={wallet.name}
              onClick={() => {
                onConnect();
                onClose();
              }}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-market-border hover:border-market-green hover:bg-market-green/5 transition-all group active:scale-[0.99]"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="font-bold text-white">{wallet.name}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-market-text-muted group-hover:text-market-green transition-colors" />
            </button>
          ))}
        </div>
        <div className="p-6 bg-market-bg/50 text-center">
          <p className="text-[10px] text-market-text-muted font-bold uppercase tracking-wider">
            Ao conectar uma carteira, você concorda com os <br />
            <a href="#" className="text-market-green hover:underline">Termos de Serviço</a> e <a href="#" className="text-market-green hover:underline">Política de Privacidade</a> do MarketPay.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const ActivityPage = () => {
  const activities = [
    { id: 1, user: '0x123...456', action: 'comprou', outcome: 'Sim', amount: 500000, market: 'O Kwanza vai valorizar este mês?', time: 'há 2 mins' },
    { id: 2, user: '0x789...012', action: 'vendeu', outcome: 'Não', amount: 1200000, market: 'Euro ultrapassa 1050 KZ?', time: 'há 5 mins' },
    { id: 3, user: '0xabc...def', action: 'comprou', outcome: 'Sim', amount: 50000, market: 'Dólar ultrapassa 950 KZ?', time: 'há 12 mins' },
    { id: 4, user: '0x456...789', action: 'comprou', outcome: 'Não', amount: 2500000, market: 'Real ultrapassa 160 KZ?', time: 'há 15 mins' },
    { id: 5, user: '0xdef...123', action: 'vendeu', outcome: 'Sim', amount: 300000, market: 'O Kwanza vai valorizar este mês?', time: 'há 20 mins' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-12 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Atividade</h1>
        <div className="market-tab-list">
          <button className="market-tab-trigger market-tab-trigger-active px-6">Global</button>
          <button className="market-tab-trigger market-tab-trigger-inactive px-6">Minha Atividade</button>
        </div>
      </div>

      <div className="market-card divide-y divide-market-border">
        {activities.map((activity) => (
          <div key={activity.id} className="p-6 flex items-start gap-4 hover:bg-market-card-lighter transition-colors">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              activity.action === 'comprou' ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red"
            )}>
              {activity.action === 'comprou' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  <span className="font-bold text-market-green">{activity.user}</span> {activity.action} <span className={cn("font-bold", activity.outcome === 'Sim' ? "text-market-green" : "text-market-red")}>{activity.outcome}</span> por <span className="font-bold">{activity.amount.toLocaleString()} KZ</span>
                </p>
                <span className="text-[10px] text-market-text-muted font-bold uppercase tracking-wider">{activity.time}</span>
              </div>
              <p className="text-sm text-market-text-muted line-clamp-1">{activity.market}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LearnPage = () => {
  const articles = [
    { id: 1, title: 'O que são Mercados de Previsão?', description: 'Aprenda o básico de como os mercados de previsão funcionam e por que são precisos.', icon: '🎓' },
    { id: 2, title: 'Como Negociar no MarketPay', description: 'Um guia passo a passo para conectar sua carteira e fazer sua primeira negociação.', icon: '🚀' },
    { id: 3, title: 'Entendendo a Resolução do Mercado', description: 'Como determinamos o resultado dos mercados e garantimos a justiça.', icon: '⚖️' },
    { id: 4, title: 'Estratégias Avançadas de Negociação', description: 'Leve suas negociações para o próximo nível com hedge e arbitragem.', icon: '📈' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-16 py-20 px-4">
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">Aprenda MarketPay</h1>
        <p className="text-lg text-market-text-muted max-w-2xl mx-auto">
          Tudo o que você precisa saber sobre negociação no maior mercado de previsões de Angola.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {articles.map((article) => (
          <div key={article.id} className="market-card p-10 group cursor-pointer hover:border-market-green transition-all">
            <div className="text-5xl mb-8">{article.icon}</div>
            <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-market-green transition-colors">{article.title}</h3>
            <p className="text-market-text-muted leading-relaxed mb-8">{article.description}</p>
            <button className="text-sm font-bold text-market-green flex items-center gap-2 group-hover:gap-4 transition-all uppercase tracking-widest">
              Ler Artigo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="market-card bg-gradient-to-br from-market-green to-market-green-muted p-16 text-market-bg text-center space-y-8 border-none">
        <h2 className="text-4xl font-bold">Pronto para começar a negociar?</h2>
        <p className="text-market-bg/80 max-w-xl mx-auto font-medium">
          Junte-se a milhares de angolanos e comece a prever o futuro hoje mesmo.
        </p>
        <Link to="/" className="inline-block bg-market-bg text-market-green px-10 py-5 rounded-xl font-bold hover:bg-market-bg/90 transition-colors uppercase tracking-widest shadow-xl">
          Explorar Mercados
        </Link>
      </div>
    </div>
  );
};

const PriceTicker = () => {
  const tickers = [
    { name: 'USD/KZ', price: '954,5', change: '+2.3%', color: 'text-market-green', link: 'https://www.google.com/finance/quote/USD-AOA' },
    { name: 'EUR/KZ', price: '1 032,12', change: '-0.5%', color: 'text-market-red', link: 'https://www.google.com/finance/quote/EUR-AOA' },
    { name: 'BTC/KZ', price: '54 200 000', change: '+1.2%', color: 'text-market-green', link: 'https://www.google.com/finance/quote/BTC-AOA' },
    { name: 'ETH/KZ', price: '2 800 000', change: '+0.8%', color: 'text-market-green', link: 'https://www.google.com/finance/quote/ETH-AOA' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {tickers.map((ticker) => (
        <a 
          key={ticker.name} 
          href={ticker.link}
          target="_blank"
          rel="noopener noreferrer"
          className="market-card p-4 flex flex-col gap-2 hover:border-market-green/50 transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-wider group-hover:text-white transition-colors">{ticker.name}</span>
            <ArrowUpRight className={cn("w-3 h-3", ticker.color)} />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-lg font-bold text-white">{ticker.price}</span>
            <span className="text-[10px] text-market-text-muted mb-1">KZ</span>
          </div>
          <div className="h-12 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={Array(10).fill(0).map((_, i) => ({ val: Math.random() }))}>
                <Area type="monotone" dataKey="val" stroke={ticker.color.includes('green') ? '#00c853' : '#ff3d00'} fill={ticker.color.includes('green') ? '#00c85320' : '#ff3d0020'} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[8px] font-bold text-market-text-muted uppercase group-hover:text-market-green transition-colors">Monitorizado</span>
            <span className="text-[8px] font-bold text-market-text-muted uppercase group-hover:text-market-green transition-colors">Tempo Real</span>
          </div>
        </a>
      ))}
    </div>
  );
};

const HomePage = ({ markets, search }: { markets: Market[], search: string }) => {
  const [activeCategory, setActiveCategory] = useState('Todos');
  
  const filteredMarkets = useMemo(() => {
    let result = markets;
    if (activeCategory !== 'Todos') {
      result = result.filter(m => m.category === activeCategory);
    }
    if (search) {
      result = result.filter(m => 
        m.question.toLowerCase().includes(search.toLowerCase()) ||
        m.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      );
    }
    return result;
  }, [markets, activeCategory, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <PriceTicker />

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          {/* Hero Section */}
          <section className="market-card p-8 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-market-card to-market-bg border-market-green/20">
            <div className="flex-1 space-y-4">
              <div className="flex gap-2">
                <span className="market-badge bg-market-green text-market-bg">DESTAQUE</span>
                <span className="market-badge bg-market-card-lighter text-market-text-muted">Economia</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                O Kwanza vai valorizar este mês?
              </h1>
              <p className="text-market-text-muted text-sm max-w-md">
                Resolve SIM se o Kwanza valorizar face ao USD até ao final do mês.
              </p>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-white">100%</div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-wider">probabilidade</span>
                  <span className="text-xs text-market-green font-bold">↗ +2.3% hoje</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-64">
              <button className="market-button-primary w-full py-3">Sim 2 000 KZ</button>
              <button className="market-button-red w-full py-3">Não 0 KZ</button>
              <div className="text-center text-[10px] text-market-text-muted font-bold uppercase tracking-widest">Vol: 2K KZ</div>
            </div>
          </section>

          {/* Markets Grid */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Todos os Mercados</h2>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-market-card-lighter rounded-lg transition-colors">
                  <LayoutGrid className="w-4 h-4 text-market-text-muted" />
                </button>
                <button className="p-2 hover:bg-market-card-lighter rounded-lg transition-colors">
                  <Bookmark className="w-4 h-4 text-market-text-muted" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredMarkets.map(market => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <button className="market-button-outline flex items-center gap-2">
                Mostrar mais mercados <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>

        {/* Sidebar Widgets */}
        <aside className="w-full lg:w-80 space-y-6">
          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" /> Últimas Notícias
            </h4>
            <div className="space-y-4">
              {[
                { id: 1, title: 'Inflação em Angola atinge novo pico', time: 'há 2h', source: 'Jornal de Angola' },
                { id: 2, title: 'BNA anuncia novas medidas cambiais', time: 'há 5h', source: 'Expansão' },
                { id: 3, title: 'Preço do barril de petróleo sobe 2%', time: 'há 8h', source: 'Mercado' },
              ].map((news) => (
                <div key={news.id} className="group cursor-pointer border-b border-market-border pb-3 last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-white group-hover:text-market-green transition-colors leading-snug">{news.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-market-text-muted font-bold uppercase">{news.source}</span>
                    <span className="text-[10px] text-market-text-muted font-bold">{news.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full text-[10px] font-bold text-market-green hover:text-white transition-colors uppercase tracking-widest pt-2">Ver todas as notícias</button>
          </div>

          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" /> Tópicos Quentes
            </h4>
            <div className="space-y-4">
              {[
                { id: 1, name: 'O Kwanza vai valorizar este mês?', vol: '2.5M KZ', change: '+5.2%' },
                { id: 2, name: 'Dólar ultrapassa 950 KZ?', vol: '1.2M KZ', change: '-1.5%' },
                { id: 3, name: 'Euro ultrapassa 1050 KZ?', vol: '850K KZ', change: '+0.8%' },
                { id: 4, name: 'Preço da Gasolina sobe em 2024?', vol: '500K KZ', change: '+12.4%' },
              ].map((topic, index) => (
                <div key={topic.id} className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-6 h-6 bg-market-card-lighter rounded flex items-center justify-center text-[10px] font-bold text-market-text-muted group-hover:bg-market-green group-hover:text-market-bg transition-colors">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-market-green transition-colors">{topic.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-market-text-muted">{topic.vol}</div>
                    <div className={cn("text-[8px] font-bold", topic.change.includes('+') ? 'text-market-green' : 'text-market-red')}>{topic.change}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-market-green" /> Atividade ao Vivo
            </h4>
            <div className="space-y-4">
               {[
                { id: 1, user: '0x12...34', action: 'Comprou Sim', amount: '50K KZ', time: 'agora' },
                { id: 2, user: '0xab...cd', action: 'Vendeu Não', amount: '12K KZ', time: '1m' },
                { id: 3, user: '0x99...88', action: 'Comprou Sim', amount: '200K KZ', time: '5m' },
              ].map((act) => (
                <div key={act.id} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-market-green">{act.user}</span>
                    <span className="text-market-text-muted">{act.action}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{act.amount}</span>
                    <span className="text-market-text-muted">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="market-card p-6 space-y-6">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-market-green" /> PLATAFORMA REAL
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-market-green font-bold text-sm">2K KZ</div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Vol. Total</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold text-sm">3</div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Mercados</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold text-sm">2</div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Traders</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold text-sm">2</div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Apostas</div>
              </div>
            </div>
            <button className="market-button-outline w-full text-[10px] flex items-center justify-center gap-2">
              <Cpu className="w-3 h-3" /> GERIR MEUS ALGORITMOS
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

const OrderBook = ({ market }: { market: Market }) => {
  const bids = [
    { price: market.yesPrice - 0.01, size: 120000 },
    { price: market.yesPrice - 0.02, size: 450000 },
    { price: market.yesPrice - 0.03, size: 890000 },
  ];
  const asks = [
    { price: market.yesPrice + 0.01, size: 230000 },
    { price: market.yesPrice + 0.02, size: 150000 },
    { price: market.yesPrice + 0.03, size: 670000 },
  ];

  return (
    <div className="market-card overflow-hidden">
      <div className="p-4 border-b border-market-border bg-market-card-lighter/30">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-market-text-muted">Livro de Ordens</h4>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          {asks.reverse().map((ask, i) => (
            <div key={i} className="flex items-center justify-between text-[10px] relative">
              <span className="text-market-red font-bold">{Math.round(ask.price * 1000)} KZ</span>
              <span className="text-market-text-muted font-mono">{ask.size.toLocaleString()}</span>
              <div className="absolute right-0 h-4 bg-market-red/5" style={{ width: `${(ask.size / 1000000) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="py-2 border-y border-market-border text-center">
          <span className="text-lg font-bold text-white">{Math.round(market.yesPrice * 1000)} KZ</span>
          <span className="text-[10px] text-market-text-muted ml-2 font-bold uppercase">Último Preço</span>
        </div>
        <div className="space-y-1">
          {bids.map((bid, i) => (
            <div key={i} className="flex items-center justify-between text-[10px] relative">
              <span className="text-market-green font-bold">{Math.round(bid.price * 1000)} KZ</span>
              <span className="text-market-text-muted font-mono">{bid.size.toLocaleString()}</span>
              <div className="absolute right-0 h-4 bg-market-green/5" style={{ width: `${(bid.size / 1000000) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RecentTrades = ({ trades }: { trades: any[] }) => {
  return (
    <div className="market-card overflow-hidden">
      <div className="p-4 border-b border-market-border bg-market-card-lighter/30">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-market-text-muted">Negócios Recentes</h4>
      </div>
      <div className="divide-y divide-market-border">
        {trades.length > 0 ? trades.map((trade) => (
          <div key={trade.id} className="p-3 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              <span className={cn("font-bold", trade.side === 'Compra' ? "text-market-green" : "text-market-red")}>{trade.side}</span>
              <span className="text-market-text-muted font-bold uppercase">{trade.amount.toLocaleString()} KZ</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-white">{Math.round(trade.price * 1000)} KZ</span>
              <span className="text-market-text-muted font-bold uppercase">{trade.time}</span>
            </div>
          </div>
        )) : (
          <div className="p-8 text-center text-xs text-market-text-muted italic">
            Sem negócios recentes.
          </div>
        )}
      </div>
    </div>
  );
};

const MarketDetailPage = ({ markets, user, onTrade, trades }: { markets: Market[], user: User | null, onTrade: (trade: any) => void, trades: any[] }) => {
  const { id } = useParams();
  const market = markets.find(m => m.id === id);
  const [outcome, setOutcome] = useState<Outcome>('Yes');
  const [amount, setAmount] = useState<string>('10');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [isBuying, setIsBuying] = useState(true);
  const [orderType, setOrderType] = useState<'Market' | 'Limit'>('Market');
  const [comments, setComments] = useState([
    { id: 1, user: 'AlphaTrader', text: 'This seems like a no-brainer. The data supports it.', time: '1h ago', likes: 12 },
    { id: 2, user: 'CryptoWhale', text: 'I am not so sure. Market is overreacting.', time: '45m ago', likes: 5 },
    { id: 3, user: 'PredictorPro', text: 'Volume is picking up. Watch the resistance.', time: '10m ago', likes: 8 },
  ]);
  const [newComment, setNewComment] = useState('');
  
  // Simulated chart data
  const chartData = useMemo(() => {
    if (!market) return [];
    if (market.resolved) {
      return Array(20).fill(0).map((_, i) => ({ time: i, price: market.resolutionOutcome === 'Yes' ? 1 : 0 }));
    }
    const data = [];
    let currentPrice = market.yesPrice;
    for (let i = 0; i < 20; i++) {
      data.push({
        time: i,
        price: Math.max(0.01, Math.min(0.99, currentPrice + (Math.random() - 0.5) * 0.05))
      });
      currentPrice = data[data.length - 1].price;
    }
    data.push({ time: 20, price: market.yesPrice });
    return data;
  }, [market?.id]);

  if (!market) return <div className="p-20 text-center">Market not found</div>;

  const currentPrice = outcome === 'Yes' ? market.yesPrice : market.noPrice;
  const executionPrice = orderType === 'Limit' && limitPrice ? parseFloat(limitPrice) / 1000 : currentPrice;
  
  const amountValue = parseFloat(amount) || 0;
  const fee = amountValue * 0.01;
  const investmentReal = amountValue - fee;
  const shares = investmentReal / executionPrice;
  const potentialReturn = shares * 1000; // 1 share = 1000 KZ payout
  const profit = potentialReturn - amountValue;
  const roi = amountValue > 0 ? (profit / amountValue) * 100 : 0;

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    setComments([{
      id: Date.now(),
      user: 'You',
      text: newComment,
      time: 'Just now',
      likes: 0
    }, ...comments]);
    setNewComment('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Info & Chart */}
        <div className="flex-1 space-y-6">
          <div className="flex items-start gap-6">
            <img src={market.imageUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border border-market-border" referrerPolicy="no-referrer" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-market-green uppercase tracking-widest">{market.category}</span>
                <span className="text-market-border">•</span>
                <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">Termina em {format(new Date(market.endDate), 'dd MMM, yyyy')}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold leading-tight text-white">{market.question}</h1>
            </div>
          </div>
          
          <div className="market-card p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
              <div className="flex items-center gap-12">
                <div>
                  <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-2">Preço Sim</div>
                  <div className="text-4xl font-bold text-market-green">{Math.round(market.yesPrice * 1000)} KZ</div>
                </div>
                <div>
                  <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-2">Preço Não</div>
                  <div className="text-4xl font-bold text-market-red">{Math.round(market.noPrice * 1000)} KZ</div>
                </div>
                <div className="hidden xl:block border-l border-market-border pl-12">
                  <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-2">Liquidez</div>
                  <div className="text-2xl font-bold text-white">{market.volume.toLocaleString()} KZ</div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-market-card-lighter rounded-lg p-1">
                {['1H', '1D', '1W', '1M', 'TUDO'].map(t => (
                  <button key={t} className={cn("px-4 py-2 text-[10px] font-bold rounded-md transition-all", t === '1D' ? "bg-market-green text-market-bg shadow-lg" : "text-market-text-muted hover:text-white")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00c853" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00c853" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2128" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 1]} hide />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-market-card border border-market-border p-3 rounded-xl shadow-2xl">
                            <div className="text-xs font-bold text-market-green">
                              {Math.round(payload[0].value as number * 1000)} KZ
                            </div>
                            <div className="text-[8px] text-market-text-muted font-bold uppercase mt-1">Probabilidade: {Math.round(payload[0].value as number * 100)}%</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#00c853" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="market-card p-8 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-3 text-white">
              <Info className="w-5 h-5 text-market-green" />
              Sobre este Mercado
            </h3>
            <p className="text-sm text-market-text-muted leading-relaxed">
              Este mercado será resolvido como "Sim" se {market.question.split('?')[0]} acontecer até à data de término especificada. 
              A resolução será baseada em relatórios oficiais e dados públicos verificáveis. 
              O volume neste mercado é atualmente de {market.volume.toLocaleString()} KZ.
            </p>
            <div className="flex flex-wrap gap-3">
              {market.tags.map(tag => (
                <span key={tag} className="px-3 py-1.5 bg-market-card-lighter text-market-text-muted rounded-lg text-[10px] font-bold uppercase tracking-wider border border-market-border">#{tag}</span>
              ))}
            </div>
          </div>

          {/* Comments Section */}
          <div className="market-card p-8 space-y-8">
            <h3 className="text-lg font-bold flex items-center gap-3 text-white">
              <MessageSquare className="w-5 h-5 text-market-green" />
              Discussão
            </h3>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-market-card-lighter flex items-center justify-center shrink-0 border border-market-border">
                  <UserIcon className="w-6 h-6 text-market-text-muted" />
                </div>
                <div className="flex-1 space-y-2">
                  <textarea 
                    placeholder="Adicione um comentário..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="market-input min-h-[100px] resize-none"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddComment}
                      className="market-button-primary px-8 py-3 uppercase tracking-widest text-xs"
                    >
                      Comentar
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-8 pt-8 border-t border-market-border">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-market-card-lighter flex items-center justify-center shrink-0 border border-market-border">
                      <UserIcon className="w-6 h-6 text-market-text-muted" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{comment.user}</span>
                        <span className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest">{comment.time}</span>
                      </div>
                      <p className="text-sm text-market-text-muted leading-relaxed">{comment.text}</p>
                      <div className="flex items-center gap-6 pt-2">
                        <button className="text-[10px] font-bold text-market-text-muted hover:text-market-green transition-colors uppercase tracking-widest">
                          Gostar ({comment.likes})
                        </button>
                        <button className="text-[10px] font-bold text-market-text-muted hover:text-market-green transition-colors uppercase tracking-widest">
                          Responder
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OrderBook market={market} />
            <RecentTrades trades={trades.filter(t => t.marketId === market.id).slice(0, 10)} />
          </div>
        </div>
        
        {/* Right Column: Trading Panel */}
        <div className="w-full lg:w-96 space-y-6">
          <div className="market-card overflow-hidden sticky top-24">
            <div className="market-tab-list rounded-none border-x-0 border-t-0">
              <button 
                onClick={() => setIsBuying(true)}
                className={cn("market-tab-trigger flex-1 py-5 uppercase tracking-widest text-xs", isBuying ? "market-tab-trigger-active" : "market-tab-trigger-inactive")}
              >
                Comprar
              </button>
              <button 
                onClick={() => setIsBuying(false)}
                className={cn("market-tab-trigger flex-1 py-5 uppercase tracking-widest text-xs", !isBuying ? "market-tab-trigger-active" : "market-tab-trigger-inactive")}
              >
                Vender
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="flex items-center gap-6 border-b border-market-border pb-4">
                <button 
                  onClick={() => setOrderType('Market')}
                  className={cn("text-[10px] font-bold pb-2 transition-all border-b-2 uppercase tracking-widest", orderType === 'Market' ? "border-market-green text-market-green" : "border-transparent text-market-text-muted")}
                >
                  Mercado
                </button>
                <button 
                  onClick={() => setOrderType('Limit')}
                  className={cn("text-[10px] font-bold pb-2 transition-all border-b-2 uppercase tracking-widest", orderType === 'Limit' ? "border-market-green text-market-green" : "border-transparent text-market-text-muted")}
                >
                  Limite
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setOutcome('Yes')}
                    className={cn(
                      "py-4 rounded-xl border-2 font-bold transition-all uppercase tracking-widest text-xs",
                      outcome === 'Yes' 
                        ? "border-market-green bg-market-green text-market-bg shadow-lg shadow-market-green/20" 
                        : "border-market-border bg-market-card-lighter text-market-text-muted hover:border-market-green"
                    )}
                  >
                    Sim {Math.round(market.yesPrice * 1000)} KZ
                  </button>
                  <button 
                    onClick={() => setOutcome('No')}
                    className={cn(
                      "py-4 rounded-xl border-2 font-bold transition-all uppercase tracking-widest text-xs",
                      outcome === 'No' 
                        ? "border-market-red bg-market-red text-white shadow-lg shadow-market-red/20" 
                        : "border-market-border bg-market-card-lighter text-market-text-muted hover:border-market-red"
                    )}
                  >
                    Não {Math.round(market.noPrice * 1000)} KZ
                  </button>
                </div>
                
                {orderType === 'Limit' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-market-text-muted uppercase tracking-widest">
                      <span>Preço Limite</span>
                      <span>Atual: {Math.round(currentPrice * 1000)} KZ</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="500"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className="market-input py-5 pl-6 pr-16 text-xl font-bold"
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-market-text-muted">KZ</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-market-text-muted uppercase tracking-widest">
                    <span>Quantia</span>
                    <span>Saldo: {user?.balance.toLocaleString() || '0'} KZ</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="market-input py-5 pl-6 pr-16 text-xl font-bold"
                      placeholder="0"
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-market-text-muted">KZ</span>
                  </div>
                </div>
                
                <div className="bg-market-card-lighter rounded-xl p-6 space-y-4 border border-market-border">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-market-text-muted">Preço Médio</span>
                    <span className="font-bold text-white">{Math.round(executionPrice * 1000)} KZ</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-market-text-muted">Taxa (1%)</span>
                    <span className="font-bold text-market-red">{fee.toFixed(2)} KZ</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-market-text-muted">Ações Estimadas</span>
                    <span className="font-bold text-white">{isNaN(shares) ? '0.00' : shares.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium pt-2 border-t border-market-border">
                    <span className="text-market-text-muted">Retorno Potencial</span>
                    <div className="text-right">
                      <div className="font-bold text-market-green">
                        {potentialReturn.toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ
                      </div>
                      <div className="text-[10px] text-market-text-muted font-bold">
                        ({roi.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => onTrade({ marketId: market.id, outcome, amount: parseFloat(amount), side: isBuying ? 'Buy' : 'Sell', type: orderType, price: executionPrice })}
                  disabled={market.resolved || (orderType === 'Limit' && !limitPrice)}
                  className={cn(
                    "w-full py-5 rounded-xl font-bold text-lg transition-all uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed",
                    outcome === 'Yes' ? "bg-market-green text-market-bg hover:bg-market-green/90" : "bg-market-red text-white hover:bg-market-red/90"
                  )}
                >
                  {market.resolved ? 'Mercado Resolvido' : `${isBuying ? 'Comprar' : 'Vender'} ${outcome === 'Yes' ? 'Sim' : 'Não'} (${orderType === 'Market' ? 'Mercado' : 'Limite'})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LeaderboardPage = () => {
  const leaders = [
    { rank: 1, user: 'AlphaTrader', profit: 12540000, winRate: 68, trades: 1240 },
    { rank: 2, user: 'PredictorPro', profit: 8920000, winRate: 62, trades: 850 },
    { rank: 3, user: 'CryptoWhale', profit: 7560000, winRate: 58, trades: 2100 },
    { rank: 4, user: 'MarketMaker', profit: 6210000, winRate: 71, trades: 4500 },
    { rank: 5, user: 'FortuneTeller', profit: 4530000, winRate: 55, trades: 620 },
    { rank: 6, user: 'DataDriven', profit: 3890000, winRate: 64, trades: 940 },
    { rank: 7, user: 'RiskTaker', profit: 3210000, winRate: 49, trades: 1500 },
    { rank: 8, user: 'SteadyGainz', profit: 2840000, winRate: 75, trades: 320 },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-12 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">Classificação</h1>
          <p className="text-market-text-muted font-medium">Os melhores traders do MarketPay Angola</p>
        </div>
        <div className="flex items-center gap-2 bg-market-card border border-market-border rounded-lg p-1">
          <button className="px-4 py-1.5 text-xs font-bold bg-market-green text-market-bg rounded-md shadow-sm">Todo o Tempo</button>
          <button className="px-4 py-1.5 text-xs font-bold text-market-text-muted hover:text-white">Mensal</button>
        </div>
      </div>

      <div className="market-card overflow-hidden">
        <div className="market-table-container">
          <table className="market-table">
            <thead>
              <tr>
                <th className="market-table-header">Rank</th>
                <th className="market-table-header">Trader</th>
                <th className="market-table-header text-center">Negócios</th>
                <th className="market-table-header text-center">Taxa de Vitória</th>
                <th className="market-table-header text-right">Lucro Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-market-border">
              {leaders.map((leader) => (
                <tr key={leader.rank} className="hover:bg-market-card-lighter transition-colors group">
                  <td className="market-table-cell">
                    <span className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                      leader.rank === 1 ? "bg-yellow-500/20 text-yellow-500" : 
                      leader.rank === 2 ? "bg-slate-400/20 text-slate-400" :
                      leader.rank === 3 ? "bg-orange-500/20 text-orange-500" : "text-market-text-muted"
                    )}>
                      {leader.rank}
                    </span>
                  </td>
                  <td className="market-table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-market-card-lighter flex items-center justify-center text-market-green font-bold">
                        {leader.user[0]}
                      </div>
                      <span className="font-bold text-white group-hover:text-market-green transition-colors">{leader.user}</span>
                    </div>
                  </td>
                  <td className="market-table-cell text-center font-mono text-market-text-muted">{leader.trades.toLocaleString()}</td>
                  <td className="market-table-cell text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold text-white">{leader.winRate}%</span>
                      <div className="w-16 h-1 bg-market-card-lighter rounded-full overflow-hidden">
                        <div className="h-full bg-market-green" style={{ width: `${leader.winRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="market-table-cell text-right font-bold text-market-green">
                    +{leader.profit.toLocaleString()} KZ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PortfolioPage = ({ user, trades, markets }: { user: User | null, trades: any[], markets: Market[] }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'history'>('positions');

  if (!user) return <div className="p-20 text-center text-market-text-muted font-bold">Por favor, conecte sua carteira para ver seu portfólio</div>;

  const userTrades = trades; // In a real app, filter by user ID

  // Calculate total portfolio value
  const portfolioValue = user.positions.reduce((total, pos) => {
    const market = markets.find(m => m.id === pos.marketId);
    const currentPrice = pos.outcome === 'Yes' ? market?.yesPrice : market?.noPrice;
    return total + (pos.shares * (currentPrice || 0));
  }, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-12 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">Portfólio</h1>
          <p className="text-market-text-muted font-medium">Gerencie suas posições e acompanhe seu desempenho</p>
        </div>
        <div className="text-left md:text-right">
          <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-1">Valor Total</div>
          <div className="text-4xl font-bold text-market-green">{(user.balance + portfolioValue).toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="market-card p-6">
          <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-1">Saldo em Dinheiro</div>
          <div className="text-2xl font-bold text-white">{user.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ</div>
        </div>
        <div className="market-card p-6">
          <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-1">Valor das Posições</div>
          <div className="text-2xl font-bold text-white">{portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ</div>
        </div>
        <div className="market-card p-6">
          <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-1">Negócios Realizados</div>
          <div className="text-2xl font-bold text-market-green">{userTrades.length}</div>
        </div>
      </div>
      
      <div className="market-card">
        <div className="p-6 border-b border-market-border flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setActiveTab('positions')}
              className={cn("font-bold text-sm transition-colors relative py-2 uppercase tracking-widest", activeTab === 'positions' ? "text-market-green after:absolute after:bottom-[-25px] after:left-0 after:right-0 after:h-1 after:bg-market-green after:rounded-t-full" : "text-market-text-muted hover:text-white")}
            >
              Posições Ativas
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn("font-bold text-sm transition-colors relative py-2 uppercase tracking-widest", activeTab === 'history' ? "text-market-green after:absolute after:bottom-[-25px] after:left-0 after:right-0 after:h-1 after:bg-market-green after:rounded-t-full" : "text-market-text-muted hover:text-white")}
            >
              Histórico de Negócios
            </button>
          </div>
        </div>
        
        <div className="market-table-container">
          {activeTab === 'positions' ? (
            <table className="market-table">
              <thead>
                <tr>
                  <th className="market-table-header">Mercado</th>
                  <th className="market-table-header text-center">Resultado</th>
                  <th className="market-table-header text-center">Ações</th>
                  <th className="market-table-header text-center">Preço Médio</th>
                  <th className="market-table-header text-center">Preço Atual</th>
                  <th className="market-table-header text-right">P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {user.positions.length > 0 ? user.positions.map((pos, i) => {
                  const market = markets.find(m => m.id === pos.marketId);
                  const currentPrice = pos.outcome === 'Yes' ? market?.yesPrice : market?.noPrice;
                  const currentValue = pos.shares * (currentPrice || 0);
                  
                  return (
                    <tr key={i} className="hover:bg-market-card-lighter transition-colors">
                      <td className="market-table-cell">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white line-clamp-1 max-w-[200px]">
                            {market?.question || 'Mercado Desconhecido'}
                          </span>
                        </div>
                      </td>
                      <td className="market-table-cell text-center">
                        <span className={cn("market-badge", pos.outcome === 'Yes' ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red")}>
                          {pos.outcome === 'Yes' ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="market-table-cell text-center font-mono font-bold text-white">{pos.shares.toFixed(2)}</td>
                      <td className="market-table-cell text-center font-mono text-market-text-muted">{Math.round(pos.avgPrice * 1000)} KZ</td>
                      <td className="market-table-cell text-center font-mono font-bold text-white">{Math.round((currentPrice || 0) * 1000)} KZ</td>
                      <td className="market-table-cell text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-market-green">{currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ</span>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-market-text-muted italic">
                      Nenhuma posição ativa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="market-table">
              <thead>
                <tr>
                  <th className="market-table-header">Mercado</th>
                  <th className="market-table-header text-center">Lado</th>
                  <th className="market-table-header text-center">Resultado</th>
                  <th className="market-table-header text-center">Quantia</th>
                  <th className="market-table-header text-center">Preço</th>
                  <th className="market-table-header text-right">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {userTrades.length > 0 ? userTrades.map(trade => {
                  const market = markets.find(m => m.id === trade.marketId);
                  return (
                    <tr key={trade.id} className="hover:bg-market-card-lighter transition-colors">
                      <td className="market-table-cell">
                        <span className="font-bold text-white line-clamp-1 max-w-[300px]">{market?.question || 'Mercado Desconhecido'}</span>
                      </td>
                      <td className="market-table-cell text-center">
                        <span className={cn("font-bold", trade.side === 'Compra' ? "text-market-green" : "text-market-red")}>{trade.side}</span>
                      </td>
                      <td className="market-table-cell text-center">
                        <span className={cn("market-badge", trade.outcome === 'Sim' ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red")}>
                          {trade.outcome}
                        </span>
                      </td>
                      <td className="market-table-cell text-center font-mono font-bold text-white">{trade.amount.toLocaleString()} KZ</td>
                      <td className="market-table-cell text-center font-mono text-market-text-muted">{Math.round(trade.price * 1000)} KZ</td>
                      <td className="market-table-cell text-right text-market-text-muted text-[10px] font-bold uppercase">{trade.time}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-market-text-muted italic">
                      Nenhum negócio realizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [markets, setMarkets] = useState<Market[]>(MOCK_MARKETS);
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [search, setSearch] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number, message: string, type: 'success' | 'error' }[]>([]);
  const [trades, setTrades] = useState<any[]>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onopen = () => console.log('WebSocket Connected');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'INITIAL_MARKETS') {
        setMarkets(data.markets);
      } else if (data.type === 'MARKET_UPDATE') {
        setMarkets(prev => prev.map(m => m.id === data.market.id ? data.market : m));
      }
    };
    
    setSocket(ws);
    return () => ws.close();
  }, []);

  const handleConnect = () => {
    setUser({
      id: 'user_1',
      name: 'MarketTrader',
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      balance: 1250000,
      positions: []
    });
    addToast("Carteira conectada com sucesso!");
  };

  const handleTrade = (tradeData: any) => {
    if (!user) {
      setIsWalletModalOpen(true);
      return;
    }
    
    const amount = parseFloat(tradeData.amount);
    if (isNaN(amount) || amount <= 0) {
      addToast("Montante inválido", "error");
      return;
    }

    if (user.balance < amount) {
      addToast("Saldo insuficiente", "error");
      return;
    }

    // AMM Logic
    setMarkets(prevMarkets => prevMarkets.map(market => {
      if (market.id === tradeData.marketId) {
        const fee = amount * 0.01; // 1% fee
        const investmentReal = amount - fee;
        
        let newPoolYes = market.poolYes;
        let newPoolNo = market.poolNo;

        if (tradeData.outcome === 'Yes') {
          newPoolYes += investmentReal;
        } else {
          newPoolNo += investmentReal;
        }

        const newVolume = newPoolYes + newPoolNo;
        const newYesPrice = newPoolYes / newVolume;
        const newNoPrice = newPoolNo / newVolume;

        return {
          ...market,
          poolYes: newPoolYes,
          poolNo: newPoolNo,
          volume: newVolume,
          yesPrice: newYesPrice,
          noPrice: newNoPrice,
        };
      }
      return market;
    }));

    // Optimistic balance update
    setUser(prev => {
      if (!prev) return null;
      
      // Calculate shares based on current price (simplified for UI update)
      const market = markets.find(m => m.id === tradeData.marketId);
      const price = tradeData.outcome === 'Yes' ? market?.yesPrice || 0.5 : market?.noPrice || 0.5;
      const fee = amount * 0.01;
      const investmentReal = amount - fee;
      const shares = investmentReal / price;

      const newPosition = {
        marketId: tradeData.marketId,
        outcome: tradeData.outcome,
        shares: shares,
        avgPrice: price
      };

      return { 
        ...prev, 
        balance: prev.balance - amount,
        positions: [...prev.positions, newPosition]
      };
    });

    setTrades(prev => [{
      id: Date.now(),
      marketId: tradeData.marketId,
      side: tradeData.side === 'Buy' ? 'Compra' : 'Venda',
      outcome: tradeData.outcome === 'Yes' ? 'Sim' : 'Não',
      amount: amount,
      price: tradeData.price,
      time: 'agora'
    }, ...prev]);

    addToast(`Sucesso: Comprou ${tradeData.outcome === 'Yes' ? 'Sim' : 'Não'}!`);

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'TRADE',
        ...tradeData,
        userId: user.id
      }));
    }
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-market-bg text-white">
        <Navbar 
          user={user} 
          onConnect={() => setIsWalletModalOpen(true)} 
          search={search}
          onSearchChange={setSearch}
        />
        <SubNavbar activeCategory="Todos" onCategoryChange={() => {}} />
        
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <HomePage markets={markets} search={search} />
                </motion.div>
              } />
              <Route path="/market/:id" element={
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <MarketDetailPage markets={markets} user={user} onTrade={handleTrade} trades={trades} />
                </motion.div>
              } />
              <Route path="/portfolio" element={
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <PortfolioPage user={user} />
                </motion.div>
              } />
              <Route path="/activity" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ActivityPage />
                </motion.div>
              } />
              <Route path="/leaderboard" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <LeaderboardPage />
                </motion.div>
              } />
              <Route path="/learn" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <LearnPage />
                </motion.div>
              } />
              <Route path="/login" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <LoginPage onLogin={(u) => { setUser(u); addToast("Login efetuado com sucesso!"); }} />
                </motion.div>
              } />
              <Route path="/profile" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <UserProfile user={user} onLogout={() => { setUser(null); addToast("Sessão terminada."); }} />
                </motion.div>
              } />
              <Route path="/admin/*" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <AdminDashboard user={user} />
                </motion.div>
              } />
            </Routes>
          </AnimatePresence>
        </div>

        <ConnectWalletModal 
          isOpen={isWalletModalOpen} 
          onClose={() => setIsWalletModalOpen(false)} 
          onConnect={handleConnect} 
        />

        {/* Toast Container */}
        <div className="fixed bottom-8 right-8 z-[110] flex flex-col gap-2">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className={cn(
                  "px-6 py-4 rounded-xl shadow-2xl font-bold text-market-bg flex items-center gap-3",
                  toast.type === 'success' ? "bg-market-green" : "bg-market-red"
                )}
              >
                {toast.type === 'success' ? <TrendingUp className="w-5 h-5" /> : <X className="w-5 h-5" />}
                {toast.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        <footer className="bg-market-card border-t border-market-border py-16 px-4 md:px-8 mt-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-market-green rounded-lg flex items-center justify-center text-market-bg font-bold text-lg">
                  MP
                </div>
                <span className="font-bold text-xl tracking-tight text-white">MarketPay</span>
              </div>
              <p className="text-sm text-market-text-muted leading-relaxed">
                A maior plataforma de mercados de previsão em Angola. Negocie o futuro com confiança e liquidez.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-white mb-6">Mercados</h4>
              <ul className="space-y-3 text-sm text-market-text-muted">
                <li><Link to="/" className="hover:text-market-green transition-colors">Política</Link></li>
                <li><Link to="/" className="hover:text-market-green transition-colors">Economia</Link></li>
                <li><Link to="/" className="hover:text-market-green transition-colors">Desporto</Link></li>
                <li><Link to="/" className="hover:text-market-green transition-colors">Finanças</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-white mb-6">Suporte</h4>
              <ul className="space-y-3 text-sm text-market-text-muted">
                <li><a href="#" className="hover:text-market-green transition-colors">Centro de Ajuda</a></li>
                <li><a href="#" className="hover:text-market-green transition-colors">Documentação API</a></li>
                <li><a href="#" className="hover:text-market-green transition-colors">Termos de Serviço</a></li>
                <li><a href="#" className="hover:text-market-green transition-colors">Privacidade</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-white mb-6">Comunidade</h4>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-market-bg border border-market-border rounded-full flex items-center justify-center hover:border-market-green transition-colors cursor-pointer group">
                  <TrendingUp className="w-5 h-5 text-market-text-muted group-hover:text-market-green" />
                </div>
                <div className="w-10 h-10 bg-market-bg border border-market-border rounded-full flex items-center justify-center hover:border-market-green transition-colors cursor-pointer group">
                  <BarChart3 className="w-5 h-5 text-market-text-muted group-hover:text-market-green" />
                </div>
                <div className="w-10 h-10 bg-market-bg border border-market-border rounded-full flex items-center justify-center hover:border-market-green transition-colors cursor-pointer group">
                  <Info className="w-5 h-5 text-market-text-muted group-hover:text-market-green" />
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto border-t border-market-border mt-16 pt-8 text-center text-[10px] text-market-text-muted font-bold uppercase tracking-widest">
            © 2024 MarketPay Angola. Todos os direitos reservados.
          </div>
        </footer>
      </div>
    </Router>
  );
}
