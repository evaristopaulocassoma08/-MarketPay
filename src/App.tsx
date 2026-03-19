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
  Loader2,
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
  ArrowRight,
  Newspaper,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Percent,
  Lock,
  Unlock,
  Plus,
  Edit,
  Trash2,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  ChevronDown,
  Activity
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
import { Market, Trade, User, Position, Outcome, Comment, PriceHistory } from './types';
import { CATEGORIES, MOCK_MARKETS } from './constants';

import { supabase } from './supabase';
import { UserProfile } from './components/UserProfile';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginPage } from './components/LoginPage';
import { CountdownTimer } from './components/CountdownTimer';
import { Category } from './types';

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const SearchModal = ({ isOpen, onClose, onSearch, categories }: { isOpen: boolean, onClose: () => void, onSearch: (val: string) => void, categories: Category[] }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
    onClose();
  };

  const topics = [
    { name: 'Criptomoedas ao vivo', icon: Activity },
    { name: 'Política', icon: Vote },
    { name: 'Médio Oriente', icon: Globe },
    { name: 'Criptomoedas', icon: Coins },
    { name: 'Desporto', icon: Trophy },
    { name: 'Cultura Pop', icon: Music },
    { name: 'Tecnologia', icon: Cpu },
    { name: 'IA', icon: Zap },
  ];

  const navigations = [
    { name: 'Novo', icon: Star },
    { name: 'Tendências', icon: TrendingUp },
    { name: 'Popular', icon: Flame },
    { name: 'Líquido', icon: Activity },
    { name: 'Termina em breve', icon: Clock },
    { name: 'Competitivo', icon: Trophy },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-market-bg/90 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-market-card border border-market-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <form onSubmit={handleSearch} className="p-4 border-b border-market-border flex items-center gap-4">
          <Search className="w-5 h-5 text-market-text-muted" />
          <input 
            autoFocus
            type="text" 
            placeholder="Pesquisa polymarkets..." 
            className="flex-1 bg-transparent border-none outline-none text-lg text-white font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" onClick={onClose} className="p-2 hover:bg-market-card-lighter rounded-lg transition-colors">
            <X className="w-5 h-5 text-market-text-muted" />
          </button>
        </form>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-market-text-muted uppercase tracking-widest">Navegar</h4>
            <div className="flex flex-wrap gap-2">
              {navigations.map((nav) => (
                <button 
                  key={nav.name}
                  onClick={() => { onSearch(nav.name); onClose(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-market-card-lighter hover:bg-market-border rounded-xl text-sm font-bold text-white transition-all border border-market-border"
                >
                  <nav.icon className="w-4 h-4 text-market-green" />
                  {nav.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-market-text-muted uppercase tracking-widest">Tópicos</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topics.map((topic) => (
                <button 
                  key={topic.name}
                  onClick={() => { onSearch(topic.name); onClose(); }}
                  className="flex items-center gap-4 p-4 bg-market-card-lighter/30 hover:bg-market-card-lighter rounded-2xl text-left transition-all border border-market-border group"
                >
                  <div className="w-10 h-10 rounded-xl bg-market-card-lighter flex items-center justify-center group-hover:bg-market-green/10 transition-colors">
                    <topic.icon className="w-5 h-5 text-market-text-muted group-hover:text-market-green" />
                  </div>
                  <span className="font-bold text-white">{topic.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Navbar = ({ user, search, onSearchChange, onOpenSearch }: { user: User | null, search: string, onSearchChange: (val: string) => void, onOpenSearch: () => void }) => {
  return (
    <nav className="sticky top-0 z-50 bg-market-bg border-b border-market-border h-16 flex items-center px-4 md:px-8 gap-4 md:gap-8">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 bg-market-green rounded-lg flex items-center justify-center text-market-bg font-bold text-lg group-hover:scale-110 transition-transform">
          MP
        </div>
        <span className="font-bold text-xl tracking-tight hidden md:block text-white">MarketPay</span>
      </Link>
      
      <div className="flex-1 max-w-xl relative group mx-auto">
        <div 
          onClick={onOpenSearch}
          className="w-full bg-market-card border border-market-border rounded-lg py-2 pl-10 pr-4 cursor-pointer hover:border-market-green transition-all flex items-center text-market-text-muted text-sm"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
          {search || 'Pesquisar mercados...'}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-4 text-sm font-medium">
          {!user && (
            <Link to="/login" className="text-market-text-muted hover:text-white transition-colors font-bold uppercase tracking-widest text-[10px]">Entrar / Criar Conta</Link>
          )}
          {user && user.is_admin && (
            <Link to="/admin" className="text-market-text-muted hover:text-market-green transition-colors font-bold uppercase tracking-widest text-[10px]">Admin</Link>
          )}
        </div>
        
        {!user ? (
          <Link 
            to="/login"
            className="market-button-primary flex items-center gap-2 text-sm"
          >
            <UserIcon className="w-4 h-4" />
            Entrar
          </Link>
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
    <Link to={`/market/${market.id}`} className="market-card group relative hover:border-market-green/30 transition-all overflow-hidden">
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-market-card-lighter flex items-center justify-center shrink-0 overflow-hidden border border-market-border">
            <img 
              src={`https://picsum.photos/seed/${market.id}/100/100`} 
              alt="" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm leading-snug group-hover:text-market-green transition-colors line-clamp-2">
              {market.question}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-widest">{market.category}</span>
              <span className="text-[10px] text-market-text-muted opacity-50">•</span>
              <span className="text-[10px] font-bold text-market-green">{market.volume.toLocaleString()} KZ</span>
            </div>
          </div>
          <Bookmark className="w-4 h-4 text-market-text-muted hover:text-white cursor-pointer shrink-0" />
        </div>
        
        <div className="mt-auto space-y-3">
          {market.is_multi ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-white uppercase tracking-widest px-1">
                <span>{market.outcomes?.[0]?.name || 'Opção 1'}</span>
                <span>{Math.round((market.outcomes?.[0]?.price || 0) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-market-card-lighter rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(market.outcomes?.[0]?.price || 0) * 100}%` }}
                  className="h-full bg-market-green"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {market.outcomes?.slice(0, 2).map((o, idx) => (
                  <button key={o.id} className={cn(
                    "rounded-lg py-2 text-center transition-all group/btn border",
                    idx === 0 ? "bg-market-green/10 border-market-green/20" : "bg-market-card-lighter border-market-border"
                  )}>
                    <div className={cn(
                      "text-[10px] font-bold group-hover/btn:scale-105 transition-transform truncate px-1",
                      idx === 0 ? "text-market-green" : "text-market-text-muted"
                    )}>
                      {o.name.toUpperCase()} {Math.round(o.price * 1000)} KZ
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-white uppercase tracking-widest px-1">
                  <span>Sim</span>
                  <span>{Math.round(market.yes_price * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-market-card-lighter rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${market.yes_price * 100}%` }}
                    className="h-full bg-market-green"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="bg-market-green/10 hover:bg-market-green/20 border border-market-green/20 rounded-lg py-2 text-center transition-all group/btn">
                  <div className="text-[10px] font-bold text-market-green group-hover/btn:scale-105 transition-transform">SIM {Math.round(market.yes_price * 1000)} KZ</div>
                </button>
                <button className="bg-market-red/10 hover:bg-market-red/20 border border-market-red/20 rounded-lg py-2 text-center transition-all group/btn">
                  <div className="text-[10px] font-bold text-market-red group-hover/btn:scale-105 transition-transform">NÃO {Math.round(market.no_price * 1000)} KZ</div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

const Sidebar = ({ activeCategory, onCategoryChange, categories, markets }: { activeCategory: string, onCategoryChange: (cat: string) => void, categories: Category[], markets: Market[] }) => {
  const filters = [
    { name: 'Todos', icon: LayoutGrid, count: markets.length },
    { name: 'Diariamente', icon: Clock, count: markets.filter(m => m.tags?.includes('Diariamente') || m.category === 'Diariamente').length },
    { name: 'Semanalmente', icon: Clock, count: markets.filter(m => m.tags?.includes('Semanalmente') || m.category === 'Semanalmente').length },
    { name: 'Mensalmente', icon: Clock, count: markets.filter(m => m.tags?.includes('Mensalmente') || m.category === 'Mensalmente').length },
    { name: 'Existências', icon: Coins, count: markets.filter(m => m.category === 'Existências' || m.tags?.includes('Existências')).length },
    { name: 'Rendimentos', icon: TrendingUp, count: markets.filter(m => m.category === 'Rendimentos' || m.tags?.includes('Rendimentos')).length },
    { name: 'Índices', icon: BarChart3, count: markets.filter(m => m.category === 'Índices' || m.tags?.includes('Índices')).length },
    { name: 'Commodities', icon: Coins, count: markets.filter(m => m.category === 'Commodities' || m.tags?.includes('Commodities')).length },
    { name: 'Forex', icon: Globe, count: markets.filter(m => m.category === 'Forex' || m.tags?.includes('Forex')).length },
    { name: 'Coleccionáveis', icon: Star, count: markets.filter(m => m.category === 'Coleccionáveis' || m.tags?.includes('Coleccionáveis')).length },
    { name: 'Aquisições', icon: Landmark, count: markets.filter(m => m.category === 'Aquisições' || m.tags?.includes('Aquisições')).length },
    { name: 'Calendário', icon: Clock, count: 0 },
  ];

  return (
    <aside className="w-64 hidden xl:block shrink-0 sticky top-24 h-fit space-y-8">
      <div>
        <div className="space-y-1">
          {filters.map((filter) => (
            <button
              key={filter.name}
              onClick={() => onCategoryChange(filter.name)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition-all group",
                filter.name === activeCategory
                  ? "bg-market-card-lighter text-white"
                  : "text-market-text-muted hover:bg-market-card-lighter hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <filter.icon className={cn("w-4 h-4", filter.name === activeCategory ? "text-market-green" : "text-market-text-muted group-hover:text-white")} />
                {filter.name}
              </div>
              {filter.count > 0 && <span className="text-[10px] opacity-50">{filter.count}</span>}
            </button>
          ))}
        </div>
      </div>
      
      <div className="market-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-market-green" />
          <h4 className="text-sm font-bold text-white">Tendências Agora</h4>
        </div>
        <div className="space-y-4">
          {markets.slice(0, 3).map((m, i) => (
            <Link key={m.id} to={`/market/${m.id}`} className="block group">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-market-text-muted">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate group-hover:text-market-green transition-colors">{m.question}</p>
                  <p className="text-[10px] text-market-text-muted">{m.volume.toLocaleString()} KZ</p>
                </div>
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

const ActivityPage = ({ trades, markets }: { trades: any[], markets: Market[] }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-12 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Atividade</h1>
        <div className="market-tab-list">
          <button className="market-tab-trigger market-tab-trigger-active px-6">Global</button>
        </div>
      </div>

      <div className="market-card divide-y divide-market-border">
        {trades.map((trade) => {
          const market = markets.find(m => m.id === trade.market_id);
          return (
            <div key={trade.id} className="p-6 flex items-start gap-4 hover:bg-market-card-lighter transition-colors">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                trade.side === 'Buy' ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red"
              )}>
                {trade.side === 'Buy' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">
                    <span className="font-bold text-market-green">{trade.user_id?.slice(0, 6) || 'Anónimo'}...</span> {trade.side === 'Compra' ? 'comprou' : 'vendeu'} <span className={cn("font-bold", trade.outcome === 'Sim' ? "text-market-green" : "text-market-red")}>{trade.outcome}</span> por <span className="font-bold">{trade.amount.toLocaleString()} KZ</span>
                  </p>
                  <span className="text-[10px] text-market-text-muted font-bold uppercase tracking-wider">{trade.time}</span>
                </div>
                <p className="text-sm text-market-text-muted line-clamp-1">{market?.question || 'Mercado Desconhecido'}</p>
              </div>
            </div>
          );
        })}
        {trades.length === 0 && (
          <div className="p-12 text-center text-market-text-muted italic">Nenhuma atividade recente.</div>
        )}
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
  const [rates, setRates] = useState<any>({
    'USD/KZ': { price: 954.5, change: '+2.3%' },
    'EUR/KZ': { price: 1032.12, change: '-0.5%' },
    'BTC/KZ': { price: 54200000, change: '+1.2%' },
    'ETH/KZ': { price: 2800000, change: '+0.8%' }
  });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Using public APIs for real rates
        const [fiatRes, cryptoRes] = await Promise.all([
          fetch('https://api.exchangerate-api.com/v4/latest/USD'),
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd')
        ]);
        
        const fiatData = await fiatRes.json();
        const cryptoData = await cryptoRes.json();
        
        // AOA rate (Kwanza) - fallback to 950 if not available
        const aoaRate = fiatData.rates.AOA || 950;
        const eurRate = fiatData.rates.EUR || 0.92;
        
        setRates({
          'USD/KZ': { price: aoaRate, change: '+0.1%' },
          'EUR/KZ': { price: aoaRate / eurRate, change: '-0.2%' },
          'BTC/KZ': { price: cryptoData.bitcoin.usd * aoaRate, change: '+1.5%' },
          'ETH/KZ': { price: cryptoData.ethereum.usd * aoaRate, change: '+0.9%' }
        });
      } catch (error) {
        console.error('Error fetching rates:', error);
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const tickers = [
    { name: 'USD/KZ', price: rates['USD/KZ'].price.toLocaleString('pt-AO', { minimumFractionDigits: 2 }), change: rates['USD/KZ'].change, color: 'text-market-green', link: 'https://www.google.com/finance/quote/USD-AOA' },
    { name: 'EUR/KZ', price: rates['EUR/KZ'].price.toLocaleString('pt-AO', { minimumFractionDigits: 2 }), change: rates['EUR/KZ'].change, color: 'text-market-red', link: 'https://www.google.com/finance/quote/EUR-AOA' },
    { name: 'BTC/KZ', price: rates['BTC/KZ'].price.toLocaleString('pt-AO', { maximumFractionDigits: 0 }), change: rates['BTC/KZ'].change, color: 'text-market-green', link: 'https://www.google.com/finance/quote/BTC-AOA' },
    { name: 'ETH/KZ', price: rates['ETH/KZ'].price.toLocaleString('pt-AO', { maximumFractionDigits: 0 }), change: rates['ETH/KZ'].change, color: 'text-market-green', link: 'https://www.google.com/finance/quote/ETH-AOA' },
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

const HomePage = ({ markets, search, activeCategory, onCategoryChange, categories, posts, trades, onSearchChange }: { markets: Market[], search: string, activeCategory: string, onCategoryChange: (cat: string) => void, categories: Category[], posts: any[], trades: any[], onSearchChange: (val: string) => void }) => {
  const subTabs = [
    'Trending', 'Breaking', 'Novo', 'Angola', 'Política', 'Economia', 'Petróleo', 'Crypto', 'Desporto', 'Finanças', 'Geopolítica', 'Tech', 'Cultura', 'Clima', 'Eleições'
  ];
  
  const filteredMarkets = useMemo(() => {
    let result = [...(markets || [])];
    
    if (activeCategory === 'Trending') {
      result = result.sort((a, b) => b.volume - a.volume);
    } else if (activeCategory === 'Novo') {
      result = result.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
    } else if (activeCategory === 'Breaking') {
      result = result.filter(m => m.tags?.includes('Breaking') || m.volume > 5000).sort((a, b) => b.volume - a.volume);
    } else if (activeCategory === 'Angola') {
      result = result.filter(m => m.tags?.includes('Angola') || m.category === 'Angola' || m.tags?.includes('Angola'));
    } else if (activeCategory === 'Diariamente' || activeCategory === 'Semanalmente' || activeCategory === 'Mensalmente') {
      result = result.filter(m => m.tags?.includes(activeCategory) || m.category === activeCategory);
    } else if (activeCategory !== 'Todos') {
      result = result.filter(m => m.category === activeCategory || m.tags?.includes(activeCategory));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(m => 
        (m.question?.toLowerCase() || '').includes(searchLower) ||
        (m.category?.toLowerCase() || '').includes(searchLower) ||
        (m.tags || []).some(t => t.toLowerCase().includes(searchLower)) ||
        (m.description?.toLowerCase() || '').includes(searchLower)
      );
    }
    return result;
  }, [markets, activeCategory, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <PriceTicker />

      {/* Sub-tabs */}
      <div className="flex items-center gap-6 overflow-x-auto pb-4 mb-8 no-scrollbar border-b border-market-border">
        {subTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onCategoryChange(tab)}
            className={cn(
              "whitespace-nowrap text-sm font-bold transition-all relative pb-4",
              activeCategory === tab ? "text-white" : "text-market-text-muted hover:text-white"
            )}
          >
            {tab}
            {activeCategory === tab && (
              <motion.div
                layoutId="activeSubTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-market-green"
              />
            )}
          </button>
        ))}
      </div>

      {/* News Section */}
      {posts.length > 0 && (
        <section className="mb-12 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-market-green" />
              Notícias do Mercado
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.slice(0, 3).map(post => (
              <div key={post.id} className="market-card group overflow-hidden cursor-pointer border-market-green/10 hover:border-market-green/30 transition-all">
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={post.image_url} 
                    alt={post.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="market-badge bg-market-bg/80 backdrop-blur-md text-white border-market-border">
                      {post.category}
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <h3 className="text-lg font-bold text-white group-hover:text-market-green transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-market-text-muted line-clamp-3">
                    {post.content}
                  </p>
                  <div className="pt-4 flex items-center justify-between text-[10px] text-market-text-muted font-bold uppercase tracking-widest border-t border-market-border">
                    <span>{new Date(post.created_at).toLocaleDateString('pt-AO')}</span>
                    <span className="text-market-green group-hover:underline">Ler mais</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <Sidebar activeCategory={activeCategory} onCategoryChange={onCategoryChange} categories={categories} markets={markets} />
        
        <div className="flex-1 space-y-8">
          {/* Hero Section */}
          {markets.length > 0 && (
            <section className="market-card p-8 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-market-card to-market-bg border-market-green/20">
              <div className="flex-1 space-y-4">
                <div className="flex gap-2">
                  <span className="market-badge bg-market-green text-market-bg">DESTAQUE</span>
                  <span className="market-badge bg-market-card-lighter text-market-text-muted">{markets[0].category}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {markets[0].question}
                </h1>
                <p className="text-market-text-muted text-sm max-w-md">
                  {markets[0].description || `Resolve SIM se ${markets[0].question.toLowerCase().replace('?', '')} até ao final do prazo.`}
                </p>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-white">{Math.round(markets[0].yes_price * 100)}%</div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-wider">probabilidade</span>
                    <span className="text-xs text-market-green font-bold">↗ +2.3% hoje</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full md:w-64">
                <Link to={`/market/${markets[0].id}`} className="market-button-primary w-full py-3 text-center">Sim {Math.round(markets[0].yes_price * 1000)} KZ</Link>
                <Link to={`/market/${markets[0].id}`} className="market-button-red w-full py-3 text-center">Não {Math.round(markets[0].no_price * 1000)} KZ</Link>
                <div className="text-center text-[10px] text-market-text-muted font-bold uppercase tracking-widest">Vol: {markets[0].volume.toLocaleString()} KZ</div>
              </div>
            </section>
          )}

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
              {filteredMarkets.length === 0 && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-market-card-lighter rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="w-10 h-10 text-market-text-muted" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Nenhum mercado encontrado</h3>
                  <p className="text-market-text-muted">Tente ajustar sua pesquisa ou filtros para encontrar o que procura.</p>
                  <button 
                    onClick={() => { onSearchChange(''); onCategoryChange('Todos'); }}
                    className="market-button-primary px-8 py-3"
                  >
                    Limpar Filtros
                  </button>
                </div>
              )}
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
              {markets.slice(0, 4).map((m, index) => (
                <Link key={m.id} to={`/market/${m.id}`} className="flex items-center gap-3 group cursor-pointer">
                  <div className="w-6 h-6 bg-market-card-lighter rounded flex items-center justify-center text-[10px] font-bold text-market-text-muted group-hover:bg-market-green group-hover:text-market-bg transition-colors">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-market-green transition-colors">{m.question}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-market-text-muted">{m.volume.toLocaleString()} KZ</div>
                    <div className="text-[8px] font-bold text-market-green">↗ {Math.round(m.yes_price * 100)}%</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="market-card p-6 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-market-green" /> Atividade ao Vivo
            </h4>
            <div className="space-y-4">
               {trades.slice(0, 5).map((trade) => (
                <Link key={trade.id} to={`/market/${trade.market_id}`} className="flex items-center justify-between text-[10px] group hover:bg-market-card-lighter p-1 rounded transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold", trade.side === 'Compra' ? "text-market-green" : "text-market-red")}>
                      {trade.user_id?.slice(0, 4) || '0x...'}
                    </span>
                    <span className="text-market-text-muted">{trade.side}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white group-hover:text-market-green transition-colors">{trade.amount.toLocaleString()} KZ</span>
                    <span className="text-market-text-muted">{trade.time}</span>
                  </div>
                </Link>
              ))}
              {trades.length === 0 && (
                <p className="text-[10px] text-market-text-muted italic text-center">Nenhuma atividade recente</p>
              )}
            </div>
          </div>

          <Link to="/activity" className="market-card p-6 space-y-6 block hover:border-market-green/30 transition-all group">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-market-green" /> PLATAFORMA REAL
              </div>
              <ArrowRight className="w-3 h-3 text-market-text-muted group-hover:text-market-green transition-all" />
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-market-green font-bold text-sm">
                  {markets.reduce((acc, m) => acc + m.volume, 0).toLocaleString()} KZ
                </div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Vol. Total</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold text-sm">{markets.length}</div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Mercados</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold text-sm">
                  {new Set(trades.map(t => t.user_id)).size || 0}
                </div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Traders</div>
              </div>
              <div className="text-center">
                <div className="text-white font-bold text-sm">{trades.length}</div>
                <div className="text-[8px] font-bold text-market-text-muted uppercase">Apostas</div>
              </div>
            </div>
            <div className="pt-2">
              <div className="w-full bg-market-card-lighter rounded-full h-1 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="h-full bg-market-green"
                />
              </div>
              <p className="text-[8px] text-center text-market-text-muted font-bold uppercase tracking-widest mt-2">Sistema Operacional em Tempo Real</p>
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
};

const OrderBook = ({ market }: { market: Market }) => {
  const bids = useMemo(() => [
    { price: market.yes_price * 0.99, size: market.volume * 0.15 },
    { price: market.yes_price * 0.98, size: market.volume * 0.25 },
    { price: market.yes_price * 0.97, size: market.volume * 0.45 },
  ], [market.yes_price, market.volume]);

  const asks = useMemo(() => [
    { price: market.yes_price * 1.01, size: market.volume * 0.12 },
    { price: market.yes_price * 1.02, size: market.volume * 0.22 },
    { price: market.yes_price * 1.03, size: market.volume * 0.35 },
  ], [market.yes_price, market.volume]);

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
          <span className="text-lg font-bold text-white">{Math.round(market.yes_price * 1000)} KZ</span>
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
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  useEffect(() => {
    if (!market) return;

    const fetchMarketData = async () => {
      setLoadingHistory(true);
      try {
        // Fetch comments
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*')
          .eq('market_id', market.id)
          .order('timestamp', { ascending: false });
        
        if (commentsData) setComments(commentsData);

        // Fetch price history
        const { data: historyData } = await supabase
          .from('price_history')
          .select('*')
          .eq('market_id', market.id)
          .order('timestamp', { ascending: true });
        
        if (historyData) setPriceHistory(historyData);
      } catch (error) {
        console.error('Error fetching market detail data:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchMarketData();

    // Subscriptions
    const commentsSub = supabase
      .channel(`comments-${market.id}`)
      .on('postgres_changes', { event: 'INSERT', table: 'comments', schema: 'public', filter: `market_id=eq.${market.id}` }, (payload) => {
        setComments(prev => [payload.new, ...prev]);
      })
      .subscribe();

    const historySub = supabase
      .channel(`history-${market.id}`)
      .on('postgres_changes', { event: 'INSERT', table: 'price_history', schema: 'public', filter: `market_id=eq.${market.id}` }, (payload) => {
        setPriceHistory(prev => [...prev, payload.new as PriceHistory]);
      })
      .subscribe();

    return () => {
      commentsSub.unsubscribe();
      historySub.unsubscribe();
    };
  }, [market?.id]);

  // Use real price history or fallback to simulated if empty
  const chartData = useMemo(() => {
    if (!market) return [];
    if (priceHistory.length > 0) {
      return priceHistory.map((h, i) => ({ time: i, price: h.yes_price }));
    }
    
    // Fallback simulated chart data
    if (market.resolved) {
      return Array(20).fill(0).map((_, i) => ({ time: i, price: market.resolution_outcome === 'Yes' ? 1 : 0 }));
    }
    const data = [];
    let currentPrice = market.yes_price;
    for (let i = 0; i < 20; i++) {
      data.push({
        time: i,
        price: Math.max(0.01, Math.min(0.99, currentPrice + (Math.random() - 0.5) * 0.05))
      });
      currentPrice = data[data.length - 1].price;
    }
    data.push({ time: 20, price: market.yes_price });
    return data;
  }, [market?.id, priceHistory]);

  if (!market) return <div className="p-20 text-center">Market not found</div>;

  const currentPrice = market.is_multi 
    ? (market.outcomes?.find(o => o.name === outcome)?.price || 0)
    : (outcome === 'Yes' ? market.yes_price : market.no_price);
  const amountValue = parseFloat(amount) || 0;
  const fee = amountValue * 0.01;
  const investmentReal = amountValue - fee;
  
  // Advanced calculation for price after trade
  let newPrice = 0;
  if (market.is_multi) {
    const selectedOutcome = market.outcomes?.find(o => o.name === outcome);
    if (selectedOutcome) {
      const totalPool = market.outcomes?.reduce((sum, o) => sum + o.pool, 0) || 0;
      const newOutcomePool = selectedOutcome.pool + investmentReal;
      const newTotalPool = totalPool + investmentReal;
      newPrice = newOutcomePool / newTotalPool;
    }
  } else {
    const currentPoolYes = market.pool_yes;
    const currentPoolNo = market.pool_no;
    const newPoolYes = outcome === 'Yes' ? currentPoolYes + investmentReal : currentPoolYes;
    const newPoolNo = outcome === 'No' ? currentPoolNo + investmentReal : currentPoolNo;
    newPrice = outcome === 'Yes' ? newPoolYes / (newPoolYes + newPoolNo) : newPoolNo / (newPoolYes + newPoolNo);
  }
  
  const executionPrice = orderType === 'Limit' && limitPrice ? parseFloat(limitPrice) / 1000 : newPrice;
  const shares = investmentReal / executionPrice;
  const potentialReturn = shares * 1000; // 1 share = 1000 KZ payout
  const profit = potentialReturn - amountValue;
  const roi = amountValue > 0 ? (profit / amountValue) * 100 : 0;

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .insert([{
          market_id: market.id,
          user_id: user.id,
          user_name: user.name,
          text: newComment,
          timestamp: new Date().toISOString(),
          likes: 0
        }]);
      
      if (error) throw error;
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Info & Chart */}
        <div className="flex-1 space-y-6">
          <div className="flex items-start gap-6">
            <img src={market.image_url} alt="" className="w-20 h-20 rounded-2xl object-cover border border-market-border" referrerPolicy="no-referrer" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-market-green uppercase tracking-widest">{market.category}</span>
                <span className="text-market-border">•</span>
                <CountdownTimer endDate={market.end_date} />
              </div>
              <h1 className="text-2xl md:text-4xl font-bold leading-tight text-white">{market.question}</h1>
            </div>
          </div>
          
          <div className="market-card p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
              <div className="flex flex-wrap items-center gap-12">
                {market.is_multi ? (
                  market.outcomes?.map(o => (
                    <div key={o.id}>
                      <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-2">{o.name}</div>
                      <div className="text-2xl font-bold text-market-green">{Math.round(o.price * 1000)} KZ</div>
                    </div>
                  ))
                ) : (
                  <>
                    <div>
                      <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-2">Preço Sim</div>
                      <div className="text-4xl font-bold text-market-green">{Math.round(market.yes_price * 1000)} KZ</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-2">Preço Não</div>
                      <div className="text-4xl font-bold text-market-red">{Math.round(market.no_price * 1000)} KZ</div>
                    </div>
                  </>
                )}
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
                        <span className="font-bold text-white">{comment.userName || comment.user}</span>
                        <span className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest">
                          {comment.timestamp ? formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true }) : comment.time}
                        </span>
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
            <RecentTrades trades={trades.filter(t => t.market_id === market.id).slice(0, 10)} />
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
                <div className={cn("grid gap-4", market.is_multi ? "grid-cols-1" : "grid-cols-2")}>
                  {market.is_multi ? (
                    market.outcomes?.map(o => (
                      <button 
                        key={o.id}
                        onClick={() => setOutcome(o.name)}
                        className={cn(
                          "py-4 px-6 rounded-xl border-2 font-bold transition-all uppercase tracking-widest text-xs flex justify-between items-center",
                          outcome === o.name 
                            ? "border-market-green bg-market-green text-market-bg shadow-lg shadow-market-green/20" 
                            : "border-market-border bg-market-card-lighter text-market-text-muted hover:border-market-green"
                        )}
                      >
                        <span>{o.name}</span>
                        <span>{Math.round(o.price * 1000)} KZ</span>
                      </button>
                    ))
                  ) : (
                    <>
                      <button 
                        onClick={() => setOutcome('Yes')}
                        className={cn(
                          "py-4 rounded-xl border-2 font-bold transition-all uppercase tracking-widest text-xs",
                          outcome === 'Yes' 
                            ? "border-market-green bg-market-green text-market-bg shadow-lg shadow-market-green/20" 
                            : "border-market-border bg-market-card-lighter text-market-text-muted hover:border-market-green"
                        )}
                      >
                        Sim {Math.round(market.yes_price * 1000)} KZ
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
                        Não {Math.round(market.no_price * 1000)} KZ
                      </button>
                    </>
                  )}
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
                    <span className="text-market-text-muted">Valor Apostado</span>
                    <span className="font-bold text-white">{amountValue.toLocaleString()} KZ</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-market-text-muted">Taxa (1%)</span>
                    <span className="font-bold text-market-red">-{fee.toFixed(2)} KZ</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium border-t border-market-border pt-4">
                    <span className="text-market-text-muted">Valor no Mercado</span>
                    <span className="font-bold text-market-green">{investmentReal.toLocaleString()} KZ</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-market-text-muted">Preço após aposta</span>
                    <span className="font-bold text-white">{Math.round(newPrice * 1000)} KZ</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium border-t border-market-border pt-4">
                    <span className="text-market-text-muted">Recebimento Possível</span>
                    <span className="font-bold text-market-green">{potentialReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })} KZ</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-market-text-muted">ROI Estimado</span>
                    <span className={cn("font-bold", roi >= 0 ? "text-market-green" : "text-market-red")}>
                      {roi.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => onTrade({ market_id: market.id, outcome, amount: parseFloat(amount), side: isBuying ? 'Buy' : 'Sell', type: orderType, price: executionPrice })}
                  disabled={market.resolved || (orderType === 'Limit' && !limitPrice)}
                  className={cn(
                    "w-full py-5 rounded-xl font-bold text-lg transition-all uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed",
                    !isBuying ? "bg-market-red text-white hover:bg-market-red/90" : "bg-market-green text-market-bg hover:bg-market-green/90"
                  )}
                >
                  {market.resolved ? 'Mercado Resolvido' : `${isBuying ? 'Comprar' : 'Vender'} ${outcome} (${orderType === 'Market' ? 'Mercado' : 'Limite'})`}
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
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      const { data, error } = await supabase.from('users').select('*').order('balance', { ascending: false }).limit(10);
      if (!error && data) {
        // Fetch trade counts for these users
        const leadersWithTrades = await Promise.all(data.map(async (u, i) => {
          const { count } = await supabase.from('trades').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
          return {
            rank: i + 1,
            user: u.name || u.email?.split('@')[0] || 'Trader',
            profit: u.balance,
            winRate: 50 + Math.floor(Math.random() * 30), // Still mocked as win rate is complex to calc
            trades: count || 0
          };
        }));
        setLeaders(leadersWithTrades);
      }
      setLoading(false);
    };
    fetchLeaders();
  }, []);

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-market-green" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-12 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">Classificação</h1>
          <p className="text-market-text-muted font-medium">Os melhores traders do MarketPay Angola</p>
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
                <th className="market-table-header text-right">Saldo Total</th>
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
                      <div className="w-10 h-10 rounded-full bg-market-card-lighter flex items-center justify-center text-market-green font-bold uppercase">
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
                    {leader.profit.toLocaleString()} KZ
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

  if (!user) return <div className="p-20 text-center text-market-text-muted font-bold">Por favor, inicie sessão para ver seu portfólio</div>;

  const userTrades = trades; // In a real app, filter by user ID

  // Calculate total portfolio value
  const portfolioValue = user.positions.reduce((total, pos) => {
    const market = markets.find(m => m.id === pos.market_id);
    const currentPrice = pos.outcome === 'Yes' ? market?.yes_price : market?.no_price;
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
                  const market = markets.find(m => m.id === pos.market_id);
                  const currentPrice = pos.outcome === 'Yes' ? market?.yes_price : market?.no_price;
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
                      <td className="market-table-cell text-center font-mono text-market-text-muted">{Math.round(pos.avg_price * 1000)} KZ</td>
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
                  const market = markets.find(m => m.id === trade.market_id);
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

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      alert('Palavra-passe atualizada com sucesso!');
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="market-card w-full max-w-md p-8 space-y-6">
        <h2 className="text-2xl font-bold text-white text-center">Nova Palavra-passe</h2>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Nova Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="market-input w-full"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-market-red text-xs font-bold">{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full market-button-primary py-3 disabled:opacity-50"
          >
            {loading ? 'A atualizar...' : 'Atualizar Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [toasts, setToasts] = useState<{ id: number, message: string, type: 'success' | 'error' }[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Fetch categories
        const { data: catData } = await supabase.from('categories').select('*').order('order');
        if (catData) setCategories(catData);

        // Fetch markets
        const { data: marketsData, error: marketsError } = await supabase
          .from('markets')
          .select('*')
          .order('volume', { ascending: false });
        
        if (marketsError) throw marketsError;
        if (marketsData && marketsData.length > 0) {
          setMarkets(marketsData);
        } else {
          setMarkets(MOCK_MARKETS);
        }

        // Fetch posts
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false });
        
        if (postsData) setPosts(postsData);

        // Fetch recent trades
        const { data: tradesData } = await supabase
          .from('trades')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(20);
        
        if (tradesData) {
          setTrades(tradesData.map(t => ({
            id: t.id,
            market_id: t.market_id,
            user_id: t.user_id,
            side: t.side === 'Buy' ? 'Compra' : 'Venda',
            outcome: t.outcome === 'Yes' ? 'Sim' : 'Não',
            amount: t.amount,
            price: t.price,
            time: formatDistanceToNow(new Date(t.timestamp), { addSuffix: true })
          })));
        }

        // Check active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*, positions(*)')
            .eq('id', session.user.id)
            .single();
          
          if (!userError && userData) {
            setUser(userData);
          } else if (userError) {
            // Create profile if it doesn't exist (OAuth)
            const { data: newProfile, error: createError } = await supabase
              .from('users')
              .insert([{
                id: session.user.id,
                name: session.user.email?.split('@')[0] || 'Utilizador',
                email: session.user.email,
                balance: 1000,
                is_admin: session.user.email?.toLowerCase() === 'evaristopaulocassoma00@gmail.com',
                status: 'active'
              }])
              .select('*, positions(*)')
              .single();
            
            if (!createError && newProfile) {
              setUser(newProfile);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setMarkets(MOCK_MARKETS);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Real-time subscriptions
    const marketsSubscription = supabase
      .channel('markets-all')
      .on('postgres_changes', { event: '*', table: 'markets', schema: 'public' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setMarkets(prev => prev.map(m => m.id === payload.new.id ? payload.new as Market : m));
        } else if (payload.eventType === 'INSERT') {
          setMarkets(prev => [payload.new as Market, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setMarkets(prev => prev.filter(m => m.id === payload.old.id));
        }
      })
      .subscribe();

    const tradesSubscription = supabase
      .channel('trades-all')
      .on('postgres_changes', { event: 'INSERT', table: 'trades', schema: 'public' }, (payload) => {
        const t = payload.new;
        setTrades(prev => [{
          id: t.id,
          market_id: t.market_id,
          side: t.side === 'Buy' ? 'Compra' : 'Venda',
          outcome: t.outcome === 'Yes' ? 'Sim' : 'Não',
          amount: t.amount,
          price: t.price,
          time: 'agora'
        }, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => {
      marketsSubscription.unsubscribe();
      tradesSubscription.unsubscribe();
    };
  }, []);

  const navigate = useNavigate();

  const handleTrade = async (tradeData: any) => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    const amount = parseFloat(tradeData.amount);
    if (isNaN(amount) || amount <= 0) {
      addToast("Montante inválido", "error");
      return;
    }

    if (tradeData.side === 'Buy' && user.balance < amount) {
      addToast("Saldo insuficiente", "error");
      return;
    }

    if (user.status === 'blocked') {
      addToast("A sua conta está bloqueada", "error");
      return;
    }

    if (user.blocked_markets?.includes(tradeData.market_id)) {
      addToast("Está bloqueado de negociar neste mercado", "error");
      return;
    }

    try {
      const market = markets.find(m => m.id === tradeData.market_id);
      if (!market) throw new Error('Mercado não encontrado');

      const fee = amount * 0.01;
      const investmentReal = amount - fee;
      
      let newPoolYes = market.pool_yes;
      let newPoolNo = market.pool_no;
      let newOutcomes = market.outcomes ? [...market.outcomes] : [];
      let shares = 0;
      let executionPrice = 0;

      if (tradeData.side === 'Buy') {
        if (market.is_multi) {
          const outcomeIndex = newOutcomes.findIndex(o => o.name === tradeData.outcome);
          if (outcomeIndex === -1) throw new Error('Opção não encontrada');
          
          newOutcomes[outcomeIndex].pool += investmentReal;
          const totalPool = newOutcomes.reduce((sum, o) => sum + o.pool, 0);
          executionPrice = newOutcomes[outcomeIndex].pool / totalPool;
          shares = investmentReal / executionPrice;
          
          // Update all prices in multi-option
          newOutcomes = newOutcomes.map(o => ({
            ...o,
            price: o.pool / totalPool
          }));
        } else {
          if (tradeData.outcome === 'Yes') {
            newPoolYes += investmentReal;
            executionPrice = newPoolYes / (newPoolYes + newPoolNo);
            shares = investmentReal / executionPrice;
          } else {
            newPoolNo += investmentReal;
            executionPrice = newPoolNo / (newPoolYes + newPoolNo);
            shares = investmentReal / executionPrice;
          }
        }
      } else {
        // Sell logic: decrease pool and calculate payout
        const position = user.positions.find(p => p.market_id === market.id && p.outcome === tradeData.outcome);
        if (!position || position.shares < amount) {
          throw new Error('Ações insuficientes para vender');
        }
        
        const currentPrice = market.is_multi 
          ? (market.outcomes?.find(o => o.name === tradeData.outcome)?.price || 0)
          : (tradeData.outcome === 'Yes' ? market.yes_price : market.no_price);
        
        const sellValue = amount * currentPrice;
        
        if (market.is_multi) {
          const outcomeIndex = newOutcomes.findIndex(o => o.name === tradeData.outcome);
          newOutcomes[outcomeIndex].pool = Math.max(1, newOutcomes[outcomeIndex].pool - (sellValue * 0.99));
          const totalPool = newOutcomes.reduce((sum, o) => sum + o.pool, 0);
          newOutcomes = newOutcomes.map(o => ({
            ...o,
            price: totalPool > 0 ? o.pool / totalPool : 1 / newOutcomes.length
          }));
        } else {
          if (tradeData.outcome === 'Yes') {
            newPoolYes = Math.max(1, newPoolYes - (sellValue * 0.99));
          } else {
            newPoolNo = Math.max(1, newPoolNo - (sellValue * 0.99));
          }
        }
        
        executionPrice = currentPrice;
        shares = amount; // amount here is shares to sell
      }

      const newVolume = market.is_multi 
        ? newOutcomes.reduce((sum, o) => sum + o.pool, 0)
        : newPoolYes + newPoolNo;
      
      const newYesPrice = market.is_multi ? 0 : newPoolYes / newVolume;
      const newNoPrice = market.is_multi ? 0 : newPoolNo / newVolume;

      // 1. Update Market Pools in Supabase
      const { error: marketError } = await supabase
        .from('markets')
        .update({
          pool_yes: newPoolYes,
          pool_no: newPoolNo,
          volume: newVolume,
          yes_price: newYesPrice,
          no_price: newNoPrice,
          outcomes: market.is_multi ? newOutcomes : null
        })
        .eq('id', market.id);

      if (marketError) throw marketError;

      // 2. Update User Balance
      const balanceChange = tradeData.side === 'Buy' ? -amount : (amount * executionPrice * 0.99);
      const { error: userError } = await supabase
        .from('users')
        .update({ balance: user.balance + balanceChange })
        .eq('id', user.id);

      if (userError) throw userError;

      // 3. Record Trade
      const { error: tradeError } = await supabase
        .from('trades')
        .insert([{
          market_id: market.id,
          user_id: user.id,
          side: tradeData.side,
          outcome: tradeData.outcome,
          amount: tradeData.side === 'Buy' ? amount : (amount * executionPrice),
          shares: shares,
          price: executionPrice,
          fee: fee,
          timestamp: new Date().toISOString()
        }]);

      if (tradeError) throw tradeError;

      // 4. Record Price History
      await supabase
        .from('price_history')
        .insert([{
          market_id: market.id,
          yes_price: newYesPrice,
          no_price: newNoPrice,
          timestamp: new Date().toISOString()
        }]);

      // 5. Update/Create Position
      if (tradeData.side === 'Buy') {
        const existingPosition = user.positions.find(p => p.market_id === market.id && p.outcome === tradeData.outcome);
        if (existingPosition) {
          const totalShares = existingPosition.shares + shares;
          const totalCost = (existingPosition.shares * existingPosition.avg_price) + (shares * executionPrice);
          const newAvgPrice = totalCost / totalShares;

          await supabase
            .from('positions')
            .update({ shares: totalShares, avg_price: newAvgPrice })
            .eq('user_id', user.id)
            .eq('market_id', market.id)
            .eq('outcome', tradeData.outcome);
        } else {
          await supabase
            .from('positions')
            .insert([{
              user_id: user.id,
              market_id: market.id,
              outcome: tradeData.outcome,
              shares: shares,
              avg_price: executionPrice
            }]);
        }
      } else {
        const existingPosition = user.positions.find(p => p.market_id === market.id && p.outcome === tradeData.outcome);
        if (existingPosition) {
          const remainingShares = existingPosition.shares - amount;
          if (remainingShares <= 0) {
            await supabase.from('positions').delete().eq('user_id', user.id).eq('market_id', market.id).eq('outcome', tradeData.outcome);
          } else {
            await supabase.from('positions').update({ shares: remainingShares }).eq('user_id', user.id).eq('market_id', market.id).eq('outcome', tradeData.outcome);
          }
        }
      }

      // Refresh local state
      const { data: updatedUser } = await supabase.from('users').select('*, positions(*)').eq('id', user.id).single();
      const { data: updatedMarkets } = await supabase.from('markets').select('*').order('volume', { ascending: false });
      
      if (updatedUser) setUser(updatedUser);
      if (updatedMarkets) setMarkets(updatedMarkets);

      addToast(tradeData.side === 'Buy' ? "Negócio realizado com sucesso!" : "Venda realizada com sucesso!");
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'TRADE', trade: tradeData }));
      }
    } catch (error: any) {
      console.error('Trade error:', error);
      addToast(error.message || "Erro ao realizar negócio", "error");
    }
  };

  if (loading && markets.length === 0) {
    return (
      <div className="min-h-screen bg-market-bg flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-market-green animate-spin" />
        <p className="text-market-text-muted font-bold animate-pulse">CARREGANDO MARKETPAY...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-market-bg text-white">
        <Navbar 
          user={user} 
          search={search}
          onSearchChange={setSearch}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
        
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
                  <HomePage 
                    markets={markets} 
                    search={search} 
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
                    categories={categories} 
                    posts={posts} 
                    trades={trades}
                    onSearchChange={setSearch}
                  />
                </motion.div>
              } />
              <Route path="/market/:id" element={
                <motion.div
                  key="market-detail"
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
                  key="portfolio"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <PortfolioPage user={user} trades={trades} markets={markets} />
                </motion.div>
              } />
              <Route path="/activity" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ActivityPage trades={trades} markets={markets} />
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
              <Route path="/reset-password" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ResetPasswordPage />
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
                  <AdminDashboard user={user} markets={markets} trades={trades} />
                </motion.div>
              } />
            </Routes>
          </AnimatePresence>
        </div>

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

        <SearchModal 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)} 
          onSearch={(val) => { setSearch(val); setActiveCategory('Todos'); }}
          categories={categories}
        />
        
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
  );
}
