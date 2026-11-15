import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Wallet, 
  TrendingUp, 
  ChevronRight, 
  ChevronLeft,
  Link2,
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
  RefreshCw,
  Gift,
  ArrowUp,
  ArrowDown,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  ChevronDown,
  ChevronUp,
  Code,
  Activity,
  Bitcoin,
  CandlestickChart,
  ScrollText,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  ReferenceLine
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Market, Trade, User, Position, Outcome, Comment, PriceHistory, Category } from './types';
import { CATEGORIES, MOCK_MARKETS } from './constants';

import { 
  firebaseService, 
  calculatePrices, 
  calculateShares 
} from './lib/firebase-service';
import { ammApi } from './lib/amm-api';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

import { LoginPage } from './components/LoginPage';
import { UserProfile } from './components/UserProfile';
import { AdminDashboard } from './components/AdminDashboard';
import { CreateMarketPage } from './components/CreateMarketPage';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Dashboard = ({ user }: { user: User }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  
  useEffect(() => {
    if (user) {
      const unsubscribe = firebaseService.getTradeHistory(user.id, setTrades);
      return () => unsubscribe();
    }
  }, [user]);

  const totalInvested = user.positions.reduce((sum, p) => sum + (p.shares * p.avg_price), 0);
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="market-card p-6 space-y-2">
          <h3 className="text-xs font-bold text-market-text-muted uppercase tracking-widest">Saldo Disponível</h3>
          <p className="text-3xl font-black text-white">{user.balance.toLocaleString()} KZ</p>
        </div>
        <div className="market-card p-6 space-y-2">
          <h3 className="text-xs font-bold text-market-text-muted uppercase tracking-widest">Total Investido</h3>
          <p className="text-3xl font-black text-market-green">{totalInvested.toLocaleString()} KZ</p>
        </div>
        <div className="market-card p-6 space-y-2">
          <h3 className="text-xs font-bold text-market-text-muted uppercase tracking-widest">Posições Ativas</h3>
          <p className="text-3xl font-black text-[#0095FF]">{user.positions.length}</p>
        </div>
      </div>

      <div className="market-card p-8">
        <h2 className="text-xl font-bold text-white mb-6">Histórico de Negociações</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-market-text-muted uppercase tracking-widest border-b border-market-border">
                <th className="pb-4">Data</th>
                <th className="pb-4">Mercado</th>
                <th className="pb-4">Lado</th>
                <th className="pb-4">Resultado</th>
                <th className="pb-4 text-right">Montante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-market-border/30">
              {trades.map(trade => (
                <tr key={trade.id} className="text-sm">
                  <td className="py-4 text-market-text-muted">{new Date(trade.timestamp).toLocaleDateString()}</td>
                  <td className="py-4 font-bold text-white">Mercado #{trade.market_id.slice(0, 4)}</td>
                  <td className="py-4">
                    <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase", trade.side === 'Buy' ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red")}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-4 font-bold text-white">{trade.outcome}</td>
                  <td className="py-4 text-right font-mono text-white">{trade.amount.toLocaleString()} KZ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const EbookView = ({ markets }: { markets: Market[] }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black text-white tracking-tighter">Guia de Mercados</h1>
        <p className="text-xl text-market-text-muted font-serif italic">Uma visão aprofundada sobre as previsões atuais</p>
      </div>
      
      <div className="space-y-16">
        {markets.map((market, i) => (
          <div key={market.id} className="space-y-6 border-b border-market-border pb-16">
            <div className="flex items-center gap-4 text-[10px] font-black text-market-green uppercase tracking-[0.2em]">
              <span>Capítulo {i + 1}</span>
              <div className="h-px flex-1 bg-market-green/30" />
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight">{market.question}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <img 
                src={market.image_url} 
                alt={market.question} 
                className="rounded-2xl w-full aspect-video object-cover grayscale hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-4 font-serif text-lg text-market-text-muted leading-relaxed">
                <p>{market.description || "Este mercado analisa as probabilidades de um evento específico ocorrer no futuro próximo. Com base em dados atuais e tendências de mercado, os participantes podem negociar posições de Sim ou Não."}</p>
                <div className="pt-4 flex items-center gap-6">
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Sim</div>
                    <div className="text-2xl font-black text-market-green">{Math.round(market.yes_price * 100)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Não</div>
                    <div className="text-2xl font-black text-market-red">{Math.round(market.no_price * 100)}%</div>
                  </div>
                </div>
                <Link 
                  to={`/market/${market.id}`}
                  className="inline-flex items-center gap-2 text-sm font-black text-white uppercase tracking-widest hover:text-market-green transition-colors pt-4"
                >
                  Negociar Agora <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = true, className, headerClassName, contentClassName }: { title: string, icon: any, children: React.ReactNode, defaultOpen?: boolean, className?: string, headerClassName?: string, contentClassName?: string }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("market-card overflow-hidden", className)}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn("w-full p-6 flex items-center justify-between group transition-colors hover:bg-market-card-lighter", headerClassName)}
      >
        <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Icon className={cn("w-4 h-4", isOpen ? "text-market-green" : "text-market-text-muted")} /> 
          {title}
        </h4>
        <ChevronDown className={cn("w-4 h-4 text-market-text-muted transition-transform duration-300", !isOpen && "-rotate-90")} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className={cn("px-6 pb-6 space-y-4 border-t border-market-border/30 pt-4", contentClassName)}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
      
      <div className="flex-1 max-w-xl relative group mx-auto hidden md:block">
        <div 
          onClick={onOpenSearch}
          className="w-full bg-market-card border border-market-border rounded-lg py-2 pl-10 pr-4 cursor-pointer hover:border-market-green transition-all flex items-center text-market-text-muted text-sm"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
          {search || 'Pesquisar mercados...'}
        </div>
      </div>

      <button 
        onClick={onOpenSearch}
        className="md:hidden p-2 bg-market-card border border-market-border rounded-lg text-market-text-muted"
      >
        <Search className="w-5 h-5" />
      </button>
      
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-4 text-sm font-medium">
          <Link to="/dashboard" className="text-market-text-muted hover:text-white transition-colors font-bold uppercase tracking-widest text-[10px]">Dashboard</Link>
          <Link to="/ebook" className="text-market-text-muted hover:text-white transition-colors font-bold uppercase tracking-widest text-[10px]">Ebook</Link>
          {user && (
            <Link to="/criar-mercado" className="text-market-green hover:text-white transition-colors font-black uppercase tracking-widest text-[10px] bg-market-green/10 border border-market-green/30 px-3 py-1 rounded-lg">Criar Mercado</Link>
          )}
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

const MarketCard: React.FC<{ market: Market, addToast: any }> = ({ market, addToast }) => {
  const navigate = useNavigate();
  const topOutcome = market.outcomes ? [...market.outcomes].sort((a, b) => b.price - a.price)[0] : null;
  const displayPrice = topOutcome ? Math.round(outcomeToPrice(topOutcome)) : Math.round(market.yes_price * 100);

  function outcomeToPrice(outcome: any) {
    return outcome.price * 100;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group bg-market-card border border-market-border rounded-xl overflow-hidden hover:border-market-border-hover transition-all duration-300 shadow-lg"
    >
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 cursor-pointer" onClick={() => navigate(`/market/${market.id}`)}>
          <div className="shrink-0 mt-0.5">
            <img 
              src={market.image_url} 
              alt="" 
              className="w-7 h-7 rounded-md object-cover border border-market-border"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-bold text-white line-clamp-2 leading-tight group-hover:text-market-green transition-colors">
              {market.question}
            </h3>
          </div>
        </div>

        {/* Outcomes List - Image Style */}
        <div className="space-y-1.5">
          {market.is_multi ? (
            market.outcomes?.slice(0, 2).map((outcome) => (
              <div key={outcome.id} className="flex items-center justify-between gap-2 py-0.5 group/outcome">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {outcome.name.includes('Abaixo') || outcome.name.includes('<') || outcome.name.includes('Derrota') ? (
                    <ArrowDown className="w-3 h-3 text-market-text-muted" />
                  ) : outcome.name.includes('Acima') || outcome.name.includes('>') || outcome.name.includes('Vitória') ? (
                    <ArrowUp className="w-3 h-3 text-market-text-muted" />
                  ) : null}
                  <span className="text-[12px] font-medium text-market-text-muted truncate">{outcome.name}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-white min-w-[35px] text-right">{Math.round(outcome.price * 100)}%</span>
                  <div className="flex gap-1">
                    <Link
                      to={`/market/${market.id}?outcome=${outcome.name}&type=buy`}
                      className="px-2 py-0.5 bg-market-green/5 text-market-green hover:bg-market-green hover:text-market-bg text-[10px] font-bold rounded transition-colors"
                    >
                      Sim.
                    </Link>
                    <Link
                      to={`/market/${market.id}?outcome=${outcome.name}&type=sell`}
                      className="px-2 py-0.5 bg-market-red/5 text-market-red hover:bg-market-red hover:text-white text-[10px] font-bold rounded transition-colors"
                    >
                      Não.
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[12px] font-medium text-market-text-muted flex-1 truncate">Sim</span>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-white min-w-[35px] text-right">{displayPrice}%</span>
                  <div className="flex gap-1">
                    <Link
                      to={`/market/${market.id}?outcome=Yes&type=buy`}
                      className="px-2 py-0.5 bg-market-green/5 text-market-green hover:bg-market-green hover:text-market-bg text-[10px] font-bold rounded transition-colors"
                    >
                      Sim.
                    </Link>
                    <Link
                      to={`/market/${market.id}?outcome=Yes&type=sell`}
                      className="px-2 py-0.5 bg-market-red/5 text-market-red hover:bg-market-red hover:text-white text-[10px] font-bold rounded transition-colors"
                    >
                      Não.
                    </Link>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-[12px] font-medium text-market-text-muted flex-1 truncate">Não</span>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-white min-w-[35px] text-right">{100 - displayPrice}%</span>
                  <div className="flex gap-1">
                    <Link
                      to={`/market/${market.id}?outcome=No&type=buy`}
                      className="px-2 py-0.5 bg-market-green/5 text-market-green hover:bg-market-green hover:text-market-bg text-[10px] font-bold rounded transition-colors"
                    >
                      Sim.
                    </Link>
                    <Link
                      to={`/market/${market.id}?outcome=No&type=sell`}
                      className="px-2 py-0.5 bg-market-red/5 text-market-red hover:bg-market-red hover:text-white text-[10px] font-bold rounded transition-colors"
                    >
                      Não.
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-market-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-bold text-market-text-muted uppercase tracking-tight">
            {market.tags?.includes('Trending') && (
              <span className="text-market-green flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-market-green animate-pulse" />
                NOVO
              </span>
            )}
            <div className="flex items-center gap-1">
              <span>${((market.volume || 0) / 1000).toFixed(0)}K Vol.</span>
              <RefreshCw className="w-2.5 h-2.5 opacity-50" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                addToast("Funcionalidade de presentes em desenvolvimento", "info");
              }}
              className="p-1.5 hover:bg-market-card-lighter rounded-lg transition-all active:scale-95 group/btn"
              title="Dar Presente"
            >
              <Gift className="w-4 h-4 text-market-text-muted group-hover/btn:text-market-green transition-colors" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                addToast("Funcionalidade de favoritos em desenvolvimento", "info");
              }}
              className="p-1.5 hover:bg-market-card-lighter rounded-lg transition-all active:scale-95 group/btn"
              title="Favoritar"
            >
              <Bookmark className="w-4 h-4 text-market-text-muted group-hover/btn:text-market-green transition-colors" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`${window.location.origin}/market/${market.id}`);
                addToast("Link do mercado copiado!", "success");
              }}
              className="p-1.5 hover:bg-market-card-lighter rounded-lg transition-all active:scale-95 group/btn"
              title="Compartilhar"
            >
              <Share2 className="w-4 h-4 text-market-text-muted group-hover/btn:text-market-green transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisible = () => {
      const scrolled = document.documentElement.scrollTop;
      if (scrolled > 300) {
        setVisible(true);
      } else if (scrolled <= 300) {
        setVisible(false);
      }
    };
    window.addEventListener('scroll', toggleVisible);
    return () => window.removeEventListener('scroll', toggleVisible);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-[60] p-4 bg-market-green text-market-bg rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Para cima
        </motion.button>
      )}
    </AnimatePresence>
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
    <aside className="w-64 hidden xl:block shrink-0 sticky top-24 h-fit space-y-6">
      <CollapsibleSection title="Categorias" icon={LayoutGrid} className="bg-transparent border-none shadow-none" headerClassName="px-3 py-4 hover:bg-market-card-lighter rounded-lg" contentClassName="px-0 pb-0 pt-2 border-none">
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
      </CollapsibleSection>
      
      <CollapsibleSection title="Tendências Agora" icon={TrendingUp}>
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
      </CollapsibleSection>
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
  const [simPoolYes, setSimPoolYes] = useState<number>(1000);
  const [simPoolNo, setSimPoolNo] = useState<number>(1000);
  const [simAmount, setSimAmount] = useState<number>(250);
  const [simOutcome, setSimOutcome] = useState<'Yes' | 'No'>('Yes');
  const [simB, setSimB] = useState<number>(1000);

  const simPricesBefore = useMemo(() => calculatePrices(simPoolYes, simPoolNo, simB), [simPoolYes, simPoolNo, simB]);
  
  const simShares = useMemo(() => {
    try {
      const sh = calculateShares(simAmount, simPoolYes, simPoolNo, simB, simOutcome);
      return isNaN(sh) || sh <= 0 ? 0 : sh;
    } catch {
      return 0;
    }
  }, [simAmount, simPoolYes, simPoolNo, simB, simOutcome]);

  const simPoolYesAfter = simOutcome === 'Yes' ? simPoolYes + simShares : simPoolYes;
  const simPoolNoAfter = simOutcome === 'No' ? simPoolNo + simShares : simPoolNo;
  const simPricesAfter = useMemo(() => calculatePrices(simPoolYesAfter, simPoolNoAfter, simB), [simPoolYesAfter, simPoolNoAfter, simB]);

  const priceBeforeSelected = simOutcome === 'Yes' ? simPricesBefore.yes : simPricesBefore.no;
  const priceAfterSelected = simOutcome === 'Yes' ? simPricesAfter.yes : simPricesAfter.no;
  const priceImpact = priceAfterSelected - priceBeforeSelected;

  const articles = [
    { id: 1, title: 'O que são Mercados de Previsão?', description: 'Aprenda o básico de como os mercados de previsão funcionam e por que são precisos.', icon: '🎓' },
    { id: 2, title: 'Como Negociar no MarketPay', description: 'Um guia passo a passo para conectar sua carteira e fazer sua primeira negociação.', icon: '🚀' },
    { id: 3, title: 'Entendendo a Resolução do Mercado', description: 'Como determinamos o resultado dos mercados e garantimos a justiça.', icon: '⚖️' },
    { id: 4, title: 'Estratégias Avançadas de Negociação', description: 'Leve suas negociações para o próximo nível com hedge e arbitragem.', icon: '📈' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-16 py-16 px-4 md:px-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white uppercase">Aprenda MarketPay</h1>
        <p className="text-lg text-market-text-muted max-w-2xl mx-auto font-medium">
          Tudo o que você precisa saber sobre a nossa economia baseada em demanda, gráficos e o algoritmo AMM LMSR.
        </p>
      </div>

      {/* INTERACTIVE AMM SIMULATOR */}
      <section className="bg-market-card border border-market-border rounded-3xl p-6 md:p-10 shadow-2xl space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
          <Cpu className="w-96 h-96 text-white" />
        </div>
        
        <div className="space-y-3 relative z-10">
          <div className="inline-block px-3 py-1 bg-market-green/20 border border-market-green/30 rounded-full text-[10px] font-black text-market-green uppercase tracking-widest">
            Módulo Interativo de Liquidez
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Simulador de Impacto de Preço e Demanda (LMSR AMM)</h2>
          <p className="text-xs md:text-sm text-market-text-muted max-w-3xl leading-relaxed">
            Descubra como o nosso Criador de Mercado Automatizado (AMM) calcula os preços dinamicamente. Insira os valores abaixo para ver em tempo real como uma aposta (demanda) altera a liquidez da pool e ajusta os preços automaticamente.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          {/* Left Column: Form & Adjustments */}
          <div className="lg:col-span-5 space-y-6 bg-white/[0.01] border border-market-border/40 p-6 rounded-2xl">
            <h3 className="text-xs font-black uppercase text-white tracking-widest border-b border-market-border/45 pb-3 flex items-center gap-2">
              <Code className="w-4 h-4 text-market-green" /> Configurações de Pool
            </h3>

            {/* Parameter: b (Liquidity Parameter) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-market-text-muted uppercase">
                <span>Sensibilidade / Liquidez (b)</span>
                <span className="text-white font-mono">{simB}</span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="5000" 
                step="100"
                value={simB}
                onChange={(e) => setSimB(Number(e.target.value))}
                className="w-full accent-market-green bg-[#1C2128] rounded-lg h-1.5 cursor-pointer"
              />
              <p className="text-[9px] text-market-text-muted leading-relaxed">
                Um 'b' menor torna os preços mais sensíveis às compras (maior impacto no preço). Um 'b' maior exige mais volume para mover o preço.
              </p>
            </div>

            {/* Inputs for Pool Quantities */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-market-text-muted uppercase tracking-wider block">Pool SIM (q_sim)</label>
                <input 
                  type="number" 
                  min="0"
                  value={simPoolYes}
                  onChange={(e) => setSimPoolYes(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#1C2128] border border-market-border rounded-xl py-2.5 px-4 text-sm font-black text-white font-mono focus:ring-1 focus:ring-market-green outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-market-text-muted uppercase tracking-wider block">Pool NÃO (q_não)</label>
                <input 
                  type="number" 
                  min="0"
                  value={simPoolNo}
                  onChange={(e) => setSimPoolNo(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#1C2128] border border-market-border rounded-xl py-2.5 px-4 text-sm font-black text-white font-mono focus:ring-1 focus:ring-market-green outline-none"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-market-border/45 my-4" />

            <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
              <Coins className="w-4 h-4 text-market-green" /> Parâmetros de Compra
            </h3>

            {/* Toggle Yes/No Outcome */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-market-text-muted uppercase block">Escolha da Previsão</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button"
                  onClick={() => setSimOutcome('Yes')}
                  className={cn(
                    "py-3 rounded-xl font-black text-xs transition-all border",
                    simOutcome === 'Yes' 
                      ? "bg-market-green/20 border-market-green text-market-green" 
                      : "bg-[#1C2128]/50 border-market-border/60 text-market-text-muted hover:text-white"
                  )}
                >
                  SIM (Alta)
                </button>
                <button 
                  type="button"
                  onClick={() => setSimOutcome('No')}
                  className={cn(
                    "py-3 rounded-xl font-black text-xs transition-all border",
                    simOutcome === 'No' 
                      ? "bg-market-red/20 border-market-red text-market-red" 
                      : "bg-[#1C2128]/50 border-market-border/60 text-market-text-muted hover:text-white"
                  )}
                >
                  NÃO (Baixa)
                </button>
              </div>
            </div>

            {/* Amount to Trade */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-market-text-muted uppercase tracking-wider block">Montante da Compra (KZ)</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="1"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[#1C2128] border border-market-border rounded-xl py-3 px-4 text-sm font-black text-white font-mono focus:ring-1 focus:ring-market-green outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-xs text-market-text-muted">KZ</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visualizer Outputs */}
          <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-market-text-muted tracking-widest flex items-center justify-between border-b border-market-border/45 pb-3">
                <span>Resultados de Ajuste e Slippage</span>
                <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-bold text-white uppercase">Cálculo Ativo</span>
              </h3>

              {/* Stats Highlight Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#1C2128]/30 border border-market-border/40 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold text-market-text-muted uppercase tracking-wider block">Preço Anterior</span>
                  <div className="text-xl font-black text-white font-mono">
                    {Math.round(priceBeforeSelected * 100)} KZ
                  </div>
                  <span className="text-[8px] text-market-text-muted block">Por quota de {simOutcome === 'Yes' ? 'Sim' : 'Não'}</span>
                </div>

                <div className="bg-[#1C2128]/30 border border-market-border/40 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold text-market-text-muted uppercase tracking-wider block">Novo Preço</span>
                  <div className="text-xl font-black text-market-green font-mono">
                    {Math.round(priceAfterSelected * 100)} KZ
                  </div>
                  <span className="text-[8px] text-market-green font-bold block flex items-center gap-1">
                    ↗ +{Math.round(priceImpact * 100)} KZ (+{(priceImpact * 100).toFixed(1)}%)
                  </span>
                </div>

                <div className="bg-[#1C2128]/30 border border-market-border/40 p-4 rounded-xl space-y-1 col-span-2 md:col-span-1">
                  <span className="text-[9px] font-bold text-market-text-muted uppercase tracking-wider block">Quotas Emitidas</span>
                  <div className="text-xl font-black text-[#0095FF] font-mono">
                    {simShares.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[8px] text-market-text-muted block">Preço Médio: <strong className="text-slate-300">{(simAmount / (simShares || 1)).toFixed(2)} KZ</strong></span>
                </div>
              </div>

              {/* Dynamic explanation box */}
              <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">Como a Demanda molda o preço</span>
                </div>
                <p className="text-[10px] text-market-text-muted leading-relaxed">
                  Ao apostar <strong className="text-white">{simAmount} KZ</strong> no resultado <strong className="text-white">{simOutcome === 'Yes' ? 'SIM' : 'NÃO'}</strong>, você está comprando quotas de liquidez. O algoritmo de precificação LMSR de forma autónoma:
                  <br />
                  1. Aumentou o pool de quotas correspondente em <strong className="text-white">{simShares.toFixed(1)} quotas</strong>.
                  <br />
                  2. Elevou instantaneamente o preço do resultado escolhido de <strong className="text-white">{Math.round(priceBeforeSelected * 100)} KZ</strong> para <strong className="text-white">{Math.round(priceAfterSelected * 100)} KZ</strong> para refletir a nova procura do mercado.
                  <br />
                  3. Reduziu o preço do resultado oposto na mesma proporção matemática para manter a soma de probabilidades próxima de 100%.
                </p>
              </div>
            </div>

            {/* Pool comparison visualization bars */}
            <div className="space-y-3 bg-[#0D1117]/50 border border-market-border/30 p-5 rounded-xl">
              <span className="text-[9px] font-black text-market-text-muted uppercase tracking-widest block">Comparação Visual dos Pools (q_i)</span>
              
              {/* YES pool comparison */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-market-green">Pool SIM (q_yes)</span>
                  <span className="text-white font-mono">{Math.round(simPoolYes)} → {Math.round(simPoolYesAfter)} (+{simOutcome === 'Yes' ? Math.round(simShares) : 0})</span>
                </div>
                <div className="w-full bg-white/[0.02] h-3 rounded-full overflow-hidden border border-market-border/25 relative flex">
                  {/* Before */}
                  <div 
                    className="bg-market-green/30 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (simPoolYes / (simPoolYes + simPoolNo || 1)) * 100)}%` }}
                  />
                  {/* Additional Shares */}
                  {simOutcome === 'Yes' && (
                    <div 
                      className="bg-market-green h-full transition-all duration-500 animate-pulse" 
                      style={{ width: `${Math.min(100, (simShares / (simPoolYes + simPoolNo || 1)) * 100)}%` }}
                    />
                  )}
                </div>
              </div>

              {/* NO pool comparison */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-market-red">Pool NÃO (q_no)</span>
                  <span className="text-white font-mono">{Math.round(simPoolNo)} → {Math.round(simPoolNoAfter)} (+{simOutcome === 'No' ? Math.round(simShares) : 0})</span>
                </div>
                <div className="w-full bg-white/[0.02] h-3 rounded-full overflow-hidden border border-market-border/25 relative flex">
                  {/* Before */}
                  <div 
                    className="bg-market-red/30 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (simPoolNo / (simPoolYes + simPoolNo || 1)) * 100)}%` }}
                  />
                  {/* Additional Shares */}
                  {simOutcome === 'No' && (
                    <div 
                      className="bg-market-red h-full transition-all duration-500 animate-pulse" 
                      style={{ width: `${Math.min(100, (simShares / (simPoolYes + simPoolNo || 1)) * 100)}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE MATHEMATICS EXPLAINED */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="market-card p-8 space-y-4">
          <div className="w-10 h-10 bg-market-green/10 rounded-xl flex items-center justify-center text-market-green text-xl font-bold">1</div>
          <h4 className="text-lg font-black text-white uppercase tracking-tight">Fórmula de Preço</h4>
          <p className="text-xs text-market-text-muted leading-relaxed">
            O preço de cada quota é dado pela probabilidade implícita do algoritmo LMSR:
          </p>
          <div className="bg-[#1C2128] p-4 rounded-xl text-center font-mono text-xs text-market-green border border-market-border/40">
            P_yes = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
          </div>
          <p className="text-[10px] text-market-text-muted">
            Isso garante que os preços estejam sempre contidos entre 0.01 KZ e 0.99 KZ, somando 1.00 KZ (100%).
          </p>
        </div>

        <div className="market-card p-8 space-y-4">
          <div className="w-10 h-10 bg-[#0095FF]/10 rounded-xl flex items-center justify-center text-[#0095FF] text-xl font-bold">2</div>
          <h4 className="text-lg font-black text-white uppercase tracking-tight">Garantia de Liquidez</h4>
          <p className="text-xs text-market-text-muted leading-relaxed">
            Ao contrário de corretoras tradicionais com livro de ordens de contraparte, o AMM é a contraparte permanente:
          </p>
          <p className="text-[11px] text-market-text-muted">
            Você pode comprar e vender quotas a qualquer segundo do dia. O preço desliza continuamente conforme a procura, eliminando a dependência de "encontrar outro comprador" para sair da posição.
          </p>
        </div>

        <div className="market-card p-8 space-y-4">
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 text-xl font-bold">3</div>
          <h4 className="text-lg font-black text-white uppercase tracking-tight">Ajuste pelo Impacto (Slippage)</h4>
          <p className="text-xs text-market-text-muted leading-relaxed">
            A sua compra de valor elevado puxa o preço na direção da aposta:
          </p>
          <p className="text-[11px] text-market-text-muted">
            Isso significa que transações volumosas recebem menos quotas por KZ do que transações menores. Esse mecanismo impede manipulação artificial de preço e protege a solvabilidade do sistema.
          </p>
        </div>
      </section>

      {/* DETAILED FAQ ABOUT CHARTS AND TRADE OPERATIONS */}
      <section className="space-y-6">
        <h3 className="text-2xl font-black text-white uppercase tracking-tight text-center">Gráficos e Estratégia de Demanda</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="market-card p-6 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Como os gráficos de velas (Candlestick) são gerados?</h4>
            <p className="text-xs text-market-text-muted leading-relaxed">
              O gráfico de velas simula as flutuações de preços em intervalos de tempo específicos. A cor verde indica que houve maior pressão de compra (demanda) para o resultado selecionado naquele intervalo, elevando o preço de fecho (close) em relação ao de abertura (open). A cor vermelha indica o oposto.
            </p>
          </div>
          <div className="market-card p-6 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Como funciona o payout de 1 KZ por quota?</h4>
            <p className="text-xs text-market-text-muted leading-relaxed">
              Quando um mercado expira e é resolvido oficialmente pelo conselho de administração, todas as quotas do resultado correto passam a valer exatamente 1.00 KZ (100% de probabilidade). As quotas do resultado incorreto passam a valer 0.00 KZ. Seus ganhos são iguais à quantidade de quotas vencedoras que possui.
            </p>
          </div>
        </div>
      </section>

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
    const fetchRates = async (retries = 3) => {
      try {
        // Tenta usar o caminho relativo, que é o preferido
        const res = await fetch('/api/market-rates', {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!res.ok) {
          throw new Error(`API status: ${res.status}`);
        }
        
        const data = await res.json();
        
        setRates({
          'USD/KZ': { price: data['USD-AOA'], change: '+0.1%' },
          'EUR/KZ': { price: data['EUR-AOA'], change: '-0.2%' },
          'BTC/KZ': { price: data['BTC-AOA'], change: '+1.5%' },
          'ETH/KZ': { price: data['ETH-AOA'], change: '+0.9%' }
        });
      } catch (error) {
        console.warn('Attempt failed, retrying...', error);
        if (retries > 0) {
          setTimeout(() => fetchRates(retries - 1), 3000);
        } else {
          console.error('Final error fetching rates:', error);
        }
      }
    };

    // Pequeno delay inicial para garantir que o servidor backend subiu
    const timeout = setTimeout(() => fetchRates(), 1000);
    const interval = setInterval(() => fetchRates(), 30000); // Atualiza a cada 30 segundos
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const formatPrice = (price: number, digits: number) => {
    return price.toLocaleString('pt-AO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  const tickers = [
    { name: 'USD/KZ', price: formatPrice(rates['USD/KZ'].price, 4), change: rates['USD/KZ'].change, color: 'text-market-green', link: 'https://www.google.com/finance/quote/USD-AOA' },
    { name: 'EUR/KZ', price: formatPrice(rates['EUR/KZ'].price, 4), change: rates['EUR/KZ'].change, color: 'text-market-red', link: 'https://www.google.com/finance/quote/EUR-AOA' },
    { name: 'BTC/KZ', price: formatPrice(rates['BTC/KZ'].price, 2), change: rates['BTC/KZ'].change, color: 'text-market-green', link: 'https://www.google.com/finance/quote/BTC-AOA' },
    { name: 'ETH/KZ', price: formatPrice(rates['ETH/KZ'].price, 2), change: rates['ETH/KZ'].change, color: 'text-market-green', link: 'https://www.google.com/finance/quote/ETH-AOA' },
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
            <span className="text-lg font-bold text-white tabular-nums">{ticker.price}</span>
            <span className="text-[10px] text-market-text-muted mb-1">KZ</span>
          </div>
          <div className="h-12 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { val: ticker.color.includes('green') ? 0.96 : 1.04 },
                  { val: ticker.color.includes('green') ? 0.97 : 1.03 },
                  { val: ticker.color.includes('green') ? 0.985 : 1.015 },
                  { val: ticker.color.includes('green') ? 0.99 : 1.01 },
                  { val: 1.0 },
                ]}
              >
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

const FeaturedMarket: React.FC<{ market: Market }> = ({ market }) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToPriceHistory(market.id, setPriceHistory);
    return () => unsubscribe();
  }, [market.id]);

  const featuredOutcomes = useMemo(() => {
    if (market.is_multi && market.outcomes) {
      return market.outcomes.map(o => ({
        name: o.name,
        price: Math.round(o.price * 100)
      }));
    }
    return [
      { name: 'Sim', price: Math.round(market.yes_price * 100) },
      { name: 'Não', price: Math.round(market.no_price * 100) },
    ];
  }, [market]);

  const chartData = useMemo(() => {
    const dates = ['7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM'];
    
    if (priceHistory.length > 0) {
      return priceHistory.map((h, i) => {
        const item: any = { name: `Ponto ${i}` };
        if (market.is_multi && market.outcomes) {
          market.outcomes.forEach((o, idx) => {
            item[o.name] = Math.round(o.price * 100);
          });
        } else {
          item['Sim'] = Math.round(h.yes_price * 100);
          item['Não'] = Math.round((1 - h.yes_price) * 100);
        }
        return item;
      });
    }

    // Fallback: horizontal flat lines at current outcome prices
    return dates.map((date) => {
      const item: any = { name: date };
      featuredOutcomes.forEach(out => {
        item[out.name] = out.price;
      });
      return item;
    });
  }, [priceHistory, featuredOutcomes, market]);

  return (
    <div className="bg-market-card border border-market-border rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Market Info */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <img 
                src={market.image_url} 
                alt="" 
                className="w-12 h-12 rounded-lg object-cover border border-market-border shadow-lg"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold text-market-text-muted uppercase tracking-widest">
                  <span>{market.category}</span>
                  <span className="opacity-30">•</span>
                  <span>Destaque</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight">
                  {market.question}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-market-card-lighter rounded-lg text-market-text-muted hover:text-white transition-colors">
                <Link2 className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-market-card-lighter rounded-lg text-market-text-muted hover:text-white transition-colors">
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Outcomes List */}
          <div className="space-y-4">
            {featuredOutcomes.map((outcome, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <span className="text-sm font-bold text-white group-hover:text-market-green transition-colors">{outcome.name}</span>
                <span className="text-xl font-black text-white">{outcome.price}%</span>
              </div>
            ))}
          </div>

          {/* Context Label */}
          <div className="text-[10px] font-bold text-market-text-muted uppercase tracking-[0.2em] opacity-50">
            {market.category}
          </div>

          {/* News Section */}
          <div className="space-y-4 pt-4 border-t border-market-border/50">
            <div className="flex items-start gap-3 group cursor-pointer">
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-white">B</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold text-market-text-muted uppercase">
                  <span>Notícias</span>
                  <span className="opacity-30">•</span>
                  <span>Tempo Real</span>
                </div>
                <p className="text-xs font-bold text-white group-hover:text-market-green transition-colors leading-snug">
                  Operações e ordens sob regulação do Criador de Mercado Automatizado (AMM).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div className="lg:w-[450px] flex flex-col">
          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
            {featuredOutcomes.map((item, i) => {
              const colors = ['#0095FF', '#FF3D00', '#A855F7', '#FFD800', '#10B981'];
              const color = colors[i % colors.length];
              return (
                <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-market-text-muted">{item.name}</span>
                  <span className="text-white">{item.price}%</span>
                </div>
              );
            })}
          </div>

          {/* Chart Area */}
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#8E9299', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#8E9299', fontSize: 10, fontWeight: 700 }}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151619', border: '1px solid #2A2B2F', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 700 }}
                />
                {featuredOutcomes.map((item, i) => {
                  const colors = ['#0095FF', '#FF3D00', '#A855F7', '#FFD800', '#10B981'];
                  const color = colors[i % colors.length];
                  return (
                    <Line 
                      key={i}
                      type="monotone" 
                      dataKey={item.name} 
                      stroke={color} 
                      strokeWidth={2} 
                      dot={false} 
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Footer */}
          <div className="mt-auto pt-6 flex items-center justify-between">
            <div className="text-xs font-black text-market-text-muted tracking-widest">
              {(market.volume || 0).toLocaleString()} KZ Vol
            </div>
            <div className="flex items-center gap-2 text-market-text-muted opacity-50">
              <BarChart3 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{market.category}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination & Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-white rounded-full" />
          <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
          <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
          <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
          <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-market-card-lighter border border-market-border rounded-full text-[10px] font-black text-market-text-muted hover:text-white transition-colors uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" />
            NCAA Tournament Winner
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-market-card-lighter border border-market-border rounded-full text-[10px] font-black text-market-text-muted hover:text-white transition-colors uppercase tracking-widest">
            Sports
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const HomePage = ({ markets, search, activeCategory, onCategoryChange, categories, posts, trades, onSearchChange, addToast }: { markets: Market[], search: string, activeCategory: string, onCategoryChange: (cat: string) => void, categories: Category[], posts: any[], trades: any[], onSearchChange: (val: string) => void, addToast: any }) => {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(window.innerWidth >= 1280);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) setIsLeftSidebarOpen(false);
      if (window.innerWidth < 1024) setIsRightSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const subTabs = [
    'Trending', 'Breaking', 'Novo', 'Angola', 'Política', 'Economia', 'Petróleo', 'Crypto', 'Desporto', 'Finanças', 'Geopolítica', 'Tech', 'Cultura', 'Clima', 'Eleições'
  ];
  
  const [visibleMarketsCount, setVisibleMarketsCount] = useState(8);
  
  const filteredMarkets = useMemo(() => {
    let result = [...(markets || [])];
    
    // Ocultar mercados com estado 'hidden' e mercados de categorias ocultas ('hidden')
    const hiddenCategoryNames = (categories || []).filter(c => c.status === 'hidden').map(c => c.name);
    result = result.filter(m => m.status !== 'hidden' && !hiddenCategoryNames.includes(m.category));
    
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
  }, [markets, activeCategory, search, categories]);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.slice(0, 3).map((post, idx) => (
              <motion.div 
                key={post.id} 
                whileHover={{ y: -8 }}
                className={cn(
                  "group relative flex flex-col bg-market-card border border-market-border rounded-[2rem] overflow-hidden transition-all duration-500 shadow-2xl hover:shadow-market-green/10",
                  idx === 0 ? "md:col-span-2 lg:col-span-2" : ""
                )}
              >
                <div className="p-8 flex flex-col justify-between flex-1">
                  <div className="mb-6">
                    <span className="px-4 py-1.5 bg-market-green text-market-bg text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg">
                      {post.category}
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-[10px] font-bold text-market-text-muted uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(post.created_at).toLocaleDateString('pt-AO')}</span>
                      <span className="opacity-30">•</span>
                      <span>5 min de leitura</span>
                    </div>
                    <h3 className={cn(
                      "font-black text-white group-hover:text-market-green transition-colors leading-[1.1] tracking-tight",
                      idx === 0 ? "text-3xl lg:text-4xl" : "text-xl"
                    )}>
                      {post.title}
                    </h3>
                    <p className="text-sm text-market-text-muted line-clamp-3 leading-relaxed font-medium">
                      {post.content}
                    </p>
                  </div>
                  
                  <div className="pt-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-market-green/20 border border-market-green/30 flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-market-green" />
                      </div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Equipa MarketPay</span>
                    </div>
                    <button 
                      onClick={() => addToast("Funcionalidade de leitura completa em desenvolvimento", "info")}
                      className="flex items-center gap-2 text-[10px] font-black text-market-green uppercase tracking-[0.2em] group/btn"
                    >
                      Ler Mais 
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col lg:flex-row gap-8 relative">
        {/* Left Sidebar Toggle */}
        <button 
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          className={cn(
            "hidden xl:flex absolute left-0 top-0 z-20 p-2 bg-market-card border border-market-border rounded-full hover:bg-market-card-lighter transition-all",
            isLeftSidebarOpen ? "translate-x-60" : "translate-x-0"
          )}
          title={isLeftSidebarOpen ? "Ocultar Menu" : "Mostrar Menu"}
        >
          {isLeftSidebarOpen ? <ChevronDown className="w-4 h-4 rotate-90" /> : <ChevronDown className="w-4 h-4 -rotate-90" />}
        </button>

        <AnimatePresence mode="wait">
          {isLeftSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: -20 }}
              animate={{ width: 256, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="hidden xl:block overflow-hidden shrink-0"
            >
              <Sidebar activeCategory={activeCategory} onCategoryChange={onCategoryChange} categories={categories} markets={markets} />
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex-1 space-y-8 min-w-0">
          {/* Hero Section */}
          {markets.length > 0 && (
            <FeaturedMarket market={markets[0]} />
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
              {filteredMarkets.slice(0, visibleMarketsCount).map(market => (
                <MarketCard key={market.id} market={market} addToast={addToast} />
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

            {visibleMarketsCount < filteredMarkets.length && (
              <div className="mt-12 flex justify-center">
                <button 
                  onClick={() => setVisibleMarketsCount(prev => prev + 6)}
                  className="market-button-outline flex items-center gap-2"
                >
                  Mostrar mais mercados <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar Toggle */}
        <button 
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className={cn(
            "hidden lg:flex absolute right-0 top-0 z-20 p-2 bg-market-card border border-market-border rounded-full hover:bg-market-card-lighter transition-all",
            isRightSidebarOpen ? "-translate-x-[300px]" : "translate-x-0"
          )}
          title={isRightSidebarOpen ? "Ocultar Painel" : "Mostrar Painel"}
        >
          {isRightSidebarOpen ? <ChevronDown className="w-4 h-4 -rotate-90" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
        </button>

        <AnimatePresence mode="wait">
          {isRightSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: 20 }}
              animate={{ width: "100%", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full lg:max-w-[320px] shrink-0 overflow-hidden"
            >
              {/* Sidebar Widgets */}
              <aside className="space-y-6">
          <CollapsibleSection title="Últimas Notícias" icon={Zap}>
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
          </CollapsibleSection>

          <CollapsibleSection title="Tópicos Quentes" icon={Flame}>
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
          </CollapsibleSection>

          <CollapsibleSection title="Atividade ao Vivo" icon={History}>
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
          </CollapsibleSection>

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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const OrderBook = ({ 
  market, 
  outcome, 
  onOutcomeChange,
  trades = [],
  user = null,
  onOrderChange
}: { 
  market: Market; 
  outcome: string; 
  onOutcomeChange: (o: 'Yes' | 'No') => void; 
  trades?: any[];
  user?: User | null;
  onOrderChange?: () => void;
}) => {
  const isYesSelected = outcome === 'Yes';
  const [clobBook, setClobBook] = useState<any | null>(null);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBook = async () => {
    if (!market?.id) return;
    try {
      const book = await ammApi.getOrderBook(market.id);
      setClobBook(book);
    } catch {
      // Keep previous book on transient network error
    }
    if (user?.id) {
      try {
        const res = await ammApi.getMyClobOrders(market.id);
        setMyOrders((res.orders || []).filter((o: any) => o.status === 'OPEN' || o.status === 'PARTIAL'));
      } catch {
        setMyOrders([]);
      }
    } else {
      setMyOrders([]);
    }
  };

  useEffect(() => {
    loadBook();
    const timer = setInterval(loadBook, 5000);
    return () => clearInterval(timer);
  }, [market?.id, trades.length, user?.id]);

  const sideBook = useMemo(() => {
    if (!clobBook) return { bids: [], asks: [] };
    return isYesSelected ? (clobBook.yes || { bids: [], asks: [] }) : (clobBook.no || { bids: [], asks: [] });
  }, [clobBook, isYesSelected]);

  const bids = useMemo(() => {
    return (sideBook.bids || []).map((b: any) => ({
      price: Number(b.price_cents),
      size: Number(b.total_shares),
      ammShares: Number(b.amm_shares || 0),
      orderCount: Number(b.order_count || 1),
      total: Number(((b.total_shares * b.price_cents) / 100).toFixed(2)),
    }));
  }, [sideBook.bids]);

  const asks = useMemo(() => {
    // Display lowest ask closest to the spread (bottom of asks list)
    return [...(sideBook.asks || [])]
      .sort((a: any, b: any) => b.price_cents - a.price_cents)
      .map((a: any) => ({
        price: Number(a.price_cents),
        size: Number(a.total_shares),
        ammShares: Number(a.amm_shares || 0),
        orderCount: Number(a.order_count || 1),
        total: Number(((a.total_shares * a.price_cents) / 100).toFixed(2)),
      }));
  }, [sideBook.asks]);

  const fallbackPriceCents = Math.max(1, Math.min(99, Math.round((isYesSelected ? market.yes_price : market.no_price) * 100)));
  const displayPriceCents = clobBook
    ? (isYesSelected ? clobBook.yesPriceCents : clobBook.noPriceCents) ?? fallbackPriceCents
    : fallbackPriceCents;

  const bestAsk = asks.length > 0 ? asks[asks.length - 1].price : null;
  const bestBid = bids.length > 0 ? bids[0].price : null;
  const spreadCents = bestAsk !== null && bestBid !== null ? Math.max(0, bestAsk - bestBid) : null;

  const maxAskSize = useMemo(() => Math.max(...asks.map((a: any) => a.size), 1), [asks]);
  const maxBidSize = useMemo(() => Math.max(...bids.map((b: any) => b.size), 1), [bids]);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await ammApi.cancelClobOrder(orderId);
      await loadBook();
      if (onOrderChange) onOrderChange();
    } catch (err) {
      console.error('Erro ao cancelar ordem CLOB:', err);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="market-card overflow-hidden bg-[#0D1117] border-market-border">
      {/* Tabs & Status */}
      <div className="p-6 pb-2 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => onOutcomeChange('Yes')}
            className={cn(
              "text-xs md:text-sm font-black pb-1 border-b-2 transition-colors",
              isYesSelected ? "border-market-green text-market-green" : "border-transparent text-market-text-muted hover:text-white"
            )}
          >
            Negocie Para cima (Sim)
          </button>
          <button 
            onClick={() => onOutcomeChange('No')}
            className={cn(
              "text-xs md:text-sm font-black pb-1 border-b-2 transition-colors",
              !isYesSelected ? "border-market-red text-market-red" : "border-transparent text-market-text-muted hover:text-white"
            )}
          >
            Negocie Para baixo (Não)
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
          <div className="flex items-center gap-1 text-[#F7931A] text-[9px] font-black uppercase tracking-widest">
            <Coins className="w-3.5 h-3.5" />
            CLOB + AMM
          </div>
          {clobBook?.ammStatus === 'APPROVED' && (
            <div className="text-[#00ff88] text-[9px] font-black uppercase tracking-widest">
              Liquidez Ativa
            </div>
          )}
        </div>
      </div>

      {/* Hybrid CLOB + AMM Notice */}
      <div className="mx-6 mb-4 p-3.5 bg-sky-500/5 border border-sky-500/20 rounded-xl flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-[10px] leading-relaxed text-market-text-muted">
          <span className="text-white font-black block mb-1 uppercase tracking-wider text-[9px]">Livro de Ordens Híbrido (CLOB + AMM)</span>
          Exibe apenas ordens reais registadas na base de dados com prioridade rigorosa preço/tempo. Ordens marcadas com <span className="text-sky-400 font-bold">AMM</span> representam cotações automáticas da empresa com reserva protegida.
        </div>
      </div>

      {/* Table Header */}
      <div className="px-6 py-3 grid grid-cols-4 text-[9px] md:text-[10px] font-black text-market-text-muted uppercase tracking-widest border-y border-market-border/50 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          {isYesSelected ? 'ALTA (SIM)' : 'BAIXA (NÃO)'}
          <LayoutGrid className="w-3.5 h-3.5" />
        </div>
        <div className="text-right flex items-center justify-end gap-1">
          PREÇO
          <ChevronDown className="w-3 h-3" />
        </div>
        <div className="text-right">QUOTAS</div>
        <div className="text-right">TOTAL (KZ)</div>
      </div>

      {/* Order Book Content */}
      <div className="p-0">
        {/* Asks (Sellers) */}
        <div className="space-y-[1px]">
          {asks.length > 0 ? asks.map((ask: any, i: number) => (
            <div key={`ask-${ask.price}-${i}`} className="relative group cursor-pointer hover:bg-white/5 transition-colors">
              <div 
                className="absolute right-0 top-0 bottom-0 bg-market-red/10 transition-all duration-500" 
                style={{ width: `${(ask.size / maxAskSize) * 100}%` }} 
              />
              <div className="relative px-6 py-2.5 grid grid-cols-4 items-center text-[10px] md:text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  {i === asks.length - 1 && (
                    <span className="bg-market-red/20 border border-market-red/40 text-market-red text-[7px] md:text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Venda</span>
                  )}
                  {ask.ammShares > 0 && (
                    <span className="bg-sky-500/20 border border-sky-500/30 text-sky-400 text-[7px] px-1.5 py-0.5 rounded font-black uppercase">AMM</span>
                  )}
                </div>
                <div className="text-right text-market-red text-xs md:text-sm font-black">{ask.price} KZ</div>
                <div className="text-right text-white font-mono">{ask.size.toLocaleString('pt-BR')}</div>
                <div className="text-right text-white font-mono">{ask.total.toLocaleString('pt-BR')} KZ</div>
              </div>
            </div>
          )) : (
            <div className="px-6 py-4 text-center text-[10px] text-market-text-muted font-bold uppercase tracking-wider">
              Sem Ordens de Venda no CLOB
            </div>
          )}
        </div>

        {/* Spread Info */}
        <div className="px-6 py-2 flex items-center gap-8 border-y border-market-border/30 bg-white/[0.02]">
          <div className="text-[9px] md:text-[10px] font-bold text-market-text-muted uppercase tracking-widest font-mono">
            Último: <span className="text-white">{displayPriceCents} KZ</span>
          </div>
          <div className="text-[9px] md:text-[10px] font-bold text-market-text-muted uppercase tracking-widest font-mono">
            Spread: <span className="text-white">{spreadCents !== null ? `${spreadCents} KZ` : '—'}</span>
          </div>
        </div>

        {/* Bids (Buyers) */}
        <div className="space-y-[1px]">
          {bids.length > 0 ? bids.map((bid: any, i: number) => (
            <div key={`bid-${bid.price}-${i}`} className="relative group cursor-pointer hover:bg-white/5 transition-colors">
              <div 
                className="absolute left-0 top-0 bottom-0 bg-market-green/10 transition-all duration-500" 
                style={{ width: `${(bid.size / maxBidSize) * 100}%` }} 
              />
              <div className="relative px-6 py-2.5 grid grid-cols-4 items-center text-[10px] md:text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  {i === 0 && (
                    <span className="bg-market-green/20 border border-market-green/40 text-market-green text-[7px] md:text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Compra</span>
                  )}
                  {bid.ammShares > 0 && (
                    <span className="bg-sky-500/20 border border-sky-500/30 text-sky-400 text-[7px] px-1.5 py-0.5 rounded font-black uppercase">AMM</span>
                  )}
                </div>
                <div className="text-right text-market-green text-xs md:text-sm font-black">{bid.price} KZ</div>
                <div className="text-right text-white font-mono">{bid.size.toLocaleString('pt-BR')}</div>
                <div className="text-right text-white font-mono">{bid.total.toLocaleString('pt-BR')} KZ</div>
              </div>
            </div>
          )) : (
            <div className="px-6 py-4 text-center text-[10px] text-market-text-muted font-bold uppercase tracking-wider">
              Sem Ordens de Compra no CLOB
            </div>
          )}
        </div>

        {/* User Active CLOB Orders */}
        {myOrders.length > 0 && (
          <div className="border-t border-market-border/50 px-6 py-3 bg-white/[0.015] space-y-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-market-text-muted">
              As Suas Ordens Abertas no CLOB ({myOrders.length})
            </div>
            <div className="space-y-1.5">
              {myOrders.map((ord: any) => (
                <div key={ord.id} className="flex items-center justify-between text-[10px] bg-black/30 border border-market-border/40 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 font-mono">
                    <span className={cn("font-black uppercase", ord.side === 'Buy' ? "text-market-green" : "text-market-red")}>
                      {ord.side === 'Buy' ? 'COMPRA' : 'VENDA'} {ord.outcome === 'Yes' ? 'SIM' : 'NÃO'}
                    </span>
                    <span className="text-white">{ord.remaining_quantity}/{ord.quantity} @ {ord.price_cents}c</span>
                    <span className="text-market-text-muted">({ord.status})</span>
                  </div>
                  <button
                    onClick={() => handleCancelOrder(ord.id)}
                    disabled={cancellingId === ord.id}
                    className="px-2.5 py-1 bg-market-red/20 hover:bg-market-red/30 text-market-red rounded font-black uppercase text-[9px] transition-colors disabled:opacity-50"
                  >
                    {cancellingId === ord.id ? '...' : 'Cancelar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RecentTrades = ({ trades }: { trades: any[] }) => {
  return (
    <div className="market-card overflow-hidden bg-[#0D1117] border-market-border">
      <div className="px-6 py-4 border-b border-market-border flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-market-green animate-pulse" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Negócios em Tempo Real</h4>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[9px] font-black text-market-text-muted uppercase tracking-widest">
            Total: <span className="text-white">{trades.length}</span>
          </div>
          <History className="w-3.5 h-3.5 text-market-text-muted" />
        </div>
      </div>
      <div className="divide-y divide-market-border/20">
        <div className="px-6 py-2 grid grid-cols-4 text-[9px] font-black text-market-text-muted uppercase tracking-widest bg-white/[0.01]">
          <div>Lado</div>
          <div className="text-right">Valor</div>
          <div className="text-right">Preço</div>
          <div className="text-right">Tempo</div>
        </div>
        {trades.length > 0 ? trades.map((trade) => {
          const isBuySide = trade.side === 'Compra' || trade.side === 'Buy';
          return (
          <div key={trade.id} className="px-6 py-3 grid grid-cols-4 items-center text-[11px] hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-market-green/30">
            <div className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full", isBuySide ? "bg-market-green" : "bg-market-red")} />
              <span className={cn("font-black uppercase tracking-widest text-[9px]", isBuySide ? "text-market-green" : "text-market-red")}>
                {trade.side === 'Buy' ? 'Compra' : trade.side === 'Sell' ? 'Venda' : trade.side}
              </span>
            </div>
            <div className="text-right text-white font-black tabular-nums">{Number(trade.amount || 0).toLocaleString()} KZ</div>
            <div className="text-right text-white font-black tabular-nums">{Math.round((trade.price || 0) * 100).toLocaleString()} KZ</div>
            <div className="text-right text-market-text-muted font-bold tabular-nums text-[10px]">{trade.time}</div>
          </div>
          );
        }) : (
          <div className="p-12 text-center text-[10px] text-market-text-muted italic font-bold uppercase tracking-widest">
            Aguardando novos negócios...
          </div>
        )}
      </div>
    </div>
  );
};

const Candlestick = (props: any) => {
  const { x, width, fill, payload, yAxis } = props;
  if (!payload || !yAxis) return null;
  
  const open = payload.open || 0;
  const close = payload.close || 0;
  const high = payload.high || 0;
  const low = payload.low || 0;
  
  const yOpen = yAxis.scale(open);
  const yClose = yAxis.scale(close);
  const yHigh = yAxis.scale(high);
  const yLow = yAxis.scale(low);

  const candleWidth = width * 0.7;
  const candleX = x + (width - candleWidth) / 2;
  const bodyY = Math.min(yOpen, yClose);
  const bodyHeight = Math.max(Math.abs(yOpen - yClose), 1);

  const wickX = x + width / 2;

  return (
    <g>
      <line
        x1={wickX}
        y1={yHigh}
        x2={wickX}
        y2={yLow}
        stroke={fill}
        strokeWidth={1}
      />
      <rect
        x={candleX}
        y={bodyY}
        width={candleWidth}
        height={bodyHeight}
        fill={fill}
      />
    </g>
  );
};

const PopularTicker = ({ markets }: { markets: Market[] }) => {
  const popularMarkets = useMemo(() => 
    [...markets].sort((a, b) => b.volume - a.volume).slice(0, 10), 
  [markets]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        if (popularMarkets.length <= 1) return 0;
        // Get a random index that is different from current
        let next;
        do {
          next = Math.floor(Math.random() * popularMarkets.length);
        } while (next === prev);
        return next;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [popularMarkets]);

  const currentMarket = popularMarkets[currentIndex];
  if (!currentMarket) return null;

  return (
    <div 
      className="mb-6 bg-white/[0.02] border border-market-border rounded-xl px-4 py-2.5 flex items-center justify-between overflow-hidden group cursor-pointer hover:bg-white/[0.04] transition-all"
      onClick={() => navigate(`/market/${currentMarket.id}`)}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-market-green/10 px-2 py-0.5 rounded text-[9px] font-black text-market-green uppercase tracking-widest">
          <TrendingUp className="w-3 h-3" />
          Em Alta
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMarket.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="text-[11px] font-bold text-white truncate max-w-[300px] md:max-w-md"
          >
            {currentMarket.question}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-[10px] font-black text-market-text-muted uppercase tracking-widest">
          Preço: <span className="text-white">{Math.round(currentMarket.yes_price * 100)} KZ</span>
        </div>
        <div className="text-[10px] font-black text-market-text-muted uppercase tracking-widest hidden sm:block">
          Volume: <span className="text-white">{currentMarket.volume.toLocaleString()} KZ</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-market-text-muted group-hover:text-white transition-colors" />
      </div>
    </div>
  );
};

const MarketDetailPage = ({ markets, user, onTrade, trades, addToast, categories }: { markets: Market[], user: User | null, onTrade: (trade: any) => void, trades: any[], addToast: (msg: string, type?: 'success' | 'error' | 'info') => void, categories: Category[] }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const market = markets.find(m => m.id === id);
  const [outcome, setOutcome] = useState<Outcome>('Yes');
  const [amount, setAmount] = useState<string>('10');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [isBuying, setIsBuying] = useState(true);
  const [clobPositions, setClobPositions] = useState<any[]>([]);
  const [clobQuote, setClobQuote] = useState<any | null>(null);

  const isMarketBlocked = market?.status === 'blocked';
  const categoryName = market?.category || '';
  const categoryObj = categories?.find(c => c.name === categoryName);
  const isCategoryBlocked = categoryObj?.status === 'blocked';
  const isTradingBlocked = isMarketBlocked || isCategoryBlocked;

  const userPosition = useMemo(() => {
    const match = clobPositions.find((p: any) => p.outcome === outcome);
    if (!match || (match.available_shares || 0) <= 0) return null;
    return {
      outcome: match.outcome,
      shares: match.available_shares,
      reservedShares: match.reserved_shares || 0,
      avg_price: (match.avg_price_cents || 0) / 100,
    };
  }, [clobPositions, outcome]);

  useEffect(() => {
    const outcomeParam = searchParams.get('outcome');
    const typeParam = searchParams.get('type');
    
    if (outcomeParam) setOutcome(outcomeParam as Outcome);
    if (typeParam) setIsBuying(typeParam === 'buy');
  }, [searchParams]);
  const [orderType, setOrderType] = useState<'Market' | 'Limit'>('Market');
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [chartType, setChartType] = useState<'probability' | 'price' | 'candlestick'>('probability');

  useEffect(() => {
    if (market?.graphType && market.graphType !== 'none') {
      setChartType(market.graphType as any);
    }
  }, [market?.id, market?.graphType]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('5:20 PM');
  const [timeRange, setTimeRange] = useState<'1H' | '1D' | '1W' | '1M' | 'TUDO'>('1D');
  const [activeTab, setActiveTab] = useState<'rules' | 'context' | 'comments' | 'holders' | 'positions' | 'activity'>('rules');
  const [timeLeft, setTimeLeft] = useState({ days: '00', hours: '00', min: '00', sec: '00' });
  const [marketPositions, setMarketPositions] = useState<any[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [lastTradeSuccess, setLastTradeSuccess] = useState<any | null>(null);

  const refreshClobData = React.useCallback(async () => {
    if (!market) return;
    setLoadingPositions(true);
    try {
      const holdersRes = await ammApi.getMarketClobPositions(market.id);
      setMarketPositions(holdersRes.positions || []);
    } catch (e) {
      console.error("Error loading CLOB market positions:", e);
    } finally {
      setLoadingPositions(false);
    }
    if (user) {
      try {
        const myRes = await ammApi.getMyClobOrders(market.id);
        setClobPositions(myRes.positions || []);
      } catch (e) {
        console.error("Error loading user CLOB positions:", e);
      }
    } else {
      setClobPositions([]);
    }
  }, [market?.id, user?.id]);

  useEffect(() => {
    refreshClobData();
  }, [refreshClobData, trades]);

  useEffect(() => {
    if (!market || !market.end_date) return;
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(market.end_date).getTime();
      const distance = end - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft({ days: '00', hours: '00', min: '00', sec: '00' });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({
        days: days.toString().padStart(2, '0'),
        hours: hours.toString().padStart(2, '0'),
        min: minutes.toString().padStart(2, '0'),
        sec: seconds.toString().padStart(2, '0')
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [market?.end_date]);
  
  useEffect(() => {
    if (!market) return;

    if (market.is_multi && market.outcomes?.length) {
      setOutcome(market.outcomes[0].name);
    } else if (!market.is_multi) {
      setOutcome('Yes');
    }

    const unsubscribeComments = firebaseService.subscribeToComments(market.id, setComments);
    const unsubscribeHistory = firebaseService.subscribeToPriceHistory(market.id, setPriceHistory);

    return () => {
      unsubscribeComments();
      unsubscribeHistory();
    };
  }, [market?.id]);

  useEffect(() => {
    if (!market || market.is_multi || market.category === 'Desportos' || (outcome !== 'Yes' && outcome !== 'No')) {
      setClobQuote(null);
      return;
    }
    const parsedAmt = parseFloat(amount) || 0;
    const parsedLim = Math.round(parseFloat(limitPrice) || 0);
    if (parsedAmt <= 0) {
      setClobQuote(null);
      return;
    }
    if (orderType === 'Limit' && (parsedLim < 1 || parsedLim > 99)) {
      setClobQuote(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const qtyForOrder =
        orderType === 'Limit'
          ? isBuying
            ? Math.floor((parsedAmt * 100) / (parsedLim * 1.01))
            : Math.floor(parsedAmt)
          : !isBuying
            ? Math.floor(parsedAmt)
            : undefined;

      if (orderType === 'Limit' && (!qtyForOrder || qtyForOrder <= 0)) {
        setClobQuote(null);
        return;
      }

      ammApi
        .quoteClobOrder({
          marketId: market.id,
          side: isBuying ? 'Buy' : 'Sell',
          outcome: outcome as 'Yes' | 'No',
          orderType: orderType === 'Limit' ? 'LIMIT' : 'MARKET',
          budgetKz: orderType === 'Market' && isBuying ? parsedAmt : undefined,
          quantity: qtyForOrder,
          limitPriceCents: orderType === 'Limit' ? parsedLim : undefined,
        })
        .then((q) => {
          if (!cancelled) setClobQuote(q);
        })
        .catch(() => {
          if (!cancelled) setClobQuote(null);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [market?.id, market?.is_multi, market?.category, outcome, amount, limitPrice, isBuying, orderType, market?.yes_price, market?.no_price]);

  // Use real price history or fallback to simulated if empty
  const chartData = useMemo(() => {
    if (!market) return [];
    
    let filteredHistory = [...priceHistory];
    const now = new Date();
    
    if (timeRange !== 'TUDO') {
      const rangeMs = {
        '1H': 60 * 60 * 1000,
        '1D': 24 * 60 * 60 * 1000,
        '1W': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000,
      }[timeRange];
      
      const cutoff = now.getTime() - rangeMs;
      filteredHistory = filteredHistory.filter(h => new Date(h.timestamp).getTime() >= cutoff);
    }

    if (filteredHistory.length > 0) {
      return filteredHistory.map((h, i) => {
        const p = outcome === 'Yes' ? h.yes_price : (1 - h.yes_price);
        return { 
          time: i, 
          price: p,
          priceKZ: Math.round(p * 100) // Percentage and cents for probability/price charts
        };
      });
    }
    
    // Fallback real-price chart data (flat line representing actual current price since there are no operations yet)
    const pointsCount = {
      '1H': 12,
      '1D': 24,
      '1W': 7,
      '1M': 30,
      'TUDO': 50
    }[timeRange];

    const currentOutcomePrice = market.is_multi 
      ? (market.outcomes?.find(o => o.name === outcome)?.price || 0.5)
      : (outcome === 'Yes' ? market.yes_price : market.no_price);

    if (market.resolved) {
      const isWinner = market.resolution_outcome === outcome;
      const val = isWinner ? 1 : 0;
      return Array(pointsCount).fill(0).map((_, i) => ({ 
        time: i, 
        price: val,
        priceKZ: val * 100
      }));
    }

    return Array(pointsCount).fill(0).map((_, i) => ({ 
      time: i, 
      price: currentOutcomePrice,
      priceKZ: Math.round(currentOutcomePrice * 100)
    }));
  }, [market, priceHistory, timeRange, outcome]);

  const [realClobCandles, setRealClobCandles] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    ammApi
      .getClobCandles(id, timeRange === '1H' ? '5m' : timeRange === '1D' ? '1h' : '1d', outcome === 'No' ? 'No' : 'Yes')
      .then((res) => setRealClobCandles(res.candles || []))
      .catch(() => setRealClobCandles([]));
  }, [id, timeRange, outcome]);

  const candlestickData = useMemo(() => {
    if (!market) return [];
    if (realClobCandles.length > 0) {
      return realClobCandles.map((c, idx) => ({
        time: idx,
        label: c.time,
        open: c.open,
        close: c.close,
        high: c.high,
        low: c.low,
        isUp: c.close >= c.open,
      }));
    }
    return chartData.map((d, i) => {
      const open = d.priceKZ;
      const close = i < chartData.length - 1 ? chartData[i + 1].priceKZ : open;
      const high = Math.max(open, close);
      const low = Math.min(open, close);
      return {
        time: d.time,
        open,
        close: Math.max(1, Math.min(99, close)),
        high: Math.max(1, Math.min(99, high)),
        low: Math.max(1, Math.min(99, low)),
        isUp: close >= open,
      };
    });
  }, [market, realClobCandles, chartData]);

  if (!market) return <div className="p-20 text-center">Market not found</div>;

  const currentPrice = market.is_multi 
    ? (market.outcomes?.find(o => o.name === outcome)?.price || 0)
    : (outcome === 'Yes' ? market.yes_price : market.no_price);
  const amountValue = parseFloat(amount) || 0;
  const parsedLimitVal = parseFloat(limitPrice) || 0;
  const refPrice = clobQuote?.avgPriceCents
    ? clobQuote.avgPriceCents / 100
    : orderType === 'Limit' && parsedLimitVal > 0
      ? parsedLimitVal / 100
      : currentPrice || 0.5;

  const shares = clobQuote
    ? clobQuote.executableShares
    : isBuying
      ? refPrice > 0
        ? Math.floor(amountValue / (refPrice * 1.01))
        : 0
      : Math.floor(amountValue);

  const estimatedFeeKz = clobQuote
    ? (clobQuote.estimatedFeeCents || 0) / 100
    : isBuying
      ? amountValue * 0.01
      : shares * refPrice * 0.01;
  const estimatedCostKz = clobQuote
    ? (clobQuote.estimatedTotalCents || 0) / 100
    : amountValue;
  const potentialReturn = isBuying
    ? shares * 1
    : clobQuote
      ? (clobQuote.estimatedTotalCents || 0) / 100
      : shares * refPrice * 0.99;
  const profit = isBuying
    ? potentialReturn - estimatedCostKz
    : potentialReturn - (userPosition?.avg_price || refPrice) * shares;
  const roi = isBuying && estimatedCostKz > 0 ? (profit / estimatedCostKz) * 100 : 0;

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    
    try {
      await firebaseService.addComment(market.id, user.id, user.name, newComment);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const isCrypto = market.category === 'Cripto' || market.category === 'Finanças';
  const isSports = market.category === 'Desportos';
  const isMulti = market.is_multi;

  const renderTradingPanel = () => {
    if (!user) {
      return (
        <div className="market-card p-6 bg-[#151619] border-[#2A2B2F] rounded-2xl text-center space-y-4">
          <Lock className="w-8 h-8 text-market-text-muted mx-auto" />
          <div>
            <h3 className="text-sm font-black uppercase text-white tracking-widest">Inicie sessão para negociar</h3>
            <p className="text-[11px] text-market-text-muted mt-1">
              Você precisa estar autenticado com a sua conta do MarketPay para poder comprar e vender quotas de previsão.
            </p>
          </div>
          <button 
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-market-green text-market-bg font-black rounded-xl text-xs uppercase tracking-widest hover:scale-105 transition-all"
          >
            Iniciar Sessão
          </button>
        </div>
      );
    }

    return (
      <div className="market-card overflow-hidden bg-[#151619] border-[#2A2B2F] rounded-2xl">
        {/* Header */}
        <div className="p-4 flex items-center gap-4 border-b border-[#2A2B2F]">
          <img 
            src={market.image_url} 
            alt="" 
            className="w-10 h-10 rounded-lg object-cover border border-[#2A2B2F]"
            referrerPolicy="no-referrer"
          />
          <div>
            <h2 className="text-sm font-black text-white hover:text-market-green transition-all line-clamp-1">{market.question}</h2>
            <div className="text-[8px] font-bold text-market-text-muted uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <span>Balanço: </span>
              <span className="text-market-green font-mono">{user?.balance?.toLocaleString()} KZ</span>
            </div>
          </div>
        </div>

        {lastTradeSuccess ? (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-6 bg-[#0095FF]/10 border border-[#0095FF]/20 rounded-2xl flex flex-col items-center justify-center text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-market-green/25 border border-market-green/45 flex items-center justify-center text-market-green animate-bounce">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase text-white tracking-widest">Negócio Confirmado!</h4>
              <p className="text-[10px] text-market-text-muted mt-1 leading-relaxed text-slate-350">
                A sua ordem foi executada e reconciliada no motor CLOB + AMM Enterprise do MarketPay.
              </p>
            </div>
            
            <div className="w-full bg-[#1A1D21] p-4 rounded-xl space-y-2.5 text-left font-mono text-xs border border-white/5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-market-text-muted uppercase font-bold text-[9px]">Operação</span>
                <span className={cn("font-black px-2 py-0.5 rounded text-[9px] uppercase", lastTradeSuccess.side === 'Compra' ? "text-market-green bg-market-green/10" : "text-market-red bg-market-red/10")}>
                  {lastTradeSuccess.side}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-2">
                <span className="text-market-text-muted text-[10px] uppercase font-bold text-[9px]">Alternativa escolhida</span>
                <span className="text-white font-black">{lastTradeSuccess.outcome === 'Yes' ? 'Sim' : 'Não'}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-2">
                <span className="text-market-text-muted text-[10px] uppercase font-bold font-mono text-[9px]">Total Investido</span>
                <span className="text-white font-black">{lastTradeSuccess.amount.toLocaleString()} KZ</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-2">
                <span className="text-market-text-muted text-[10px] uppercase font-bold font-mono text-[9px]">Quotas Recebidas</span>
                <span className="text-market-green font-black">{lastTradeSuccess.shares.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button 
              onClick={() => setLastTradeSuccess(null)}
              className="w-full py-3 bg-market-green text-market-bg rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all text-center"
            >
              Fazer outra operação
            </button>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 border-b border-[#2A2B2F]">
              <div className="flex gap-6">
                <button 
                  onClick={() => setIsBuying(true)}
                  className={cn(
                    "py-3 text-xs font-black transition-all border-b-2 uppercase tracking-widest", 
                    isBuying ? "border-white text-white" : "border-transparent text-market-text-muted hover:text-white"
                  )}
                >
                  Comprar
                </button>
                <button 
                  onClick={() => setIsBuying(false)}
                  className={cn(
                    "py-3 text-xs font-black transition-all border-b-2 uppercase tracking-widest", 
                    !isBuying ? "border-white text-white" : "border-transparent text-market-text-muted hover:text-white"
                  )}
                >
                  Vender
                </button>
              </div>
              <div>
                <button 
                  className="flex items-center gap-1 text-[10px] font-black text-white hover:text-market-green transition-colors uppercase tracking-widest"
                  onClick={() => setOrderType(prev => prev === 'Market' ? 'Limit' : 'Market')}
                >
                  {orderType === 'Market' ? 'Mercado' : 'Limite'} <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {isTradingBlocked && (
                <div className="bg-market-red/10 border border-market-red/30 rounded-xl p-4 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-market-red shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black uppercase text-market-red tracking-wider">Negociações Bloqueadas</h4>
                    <p className="text-[10px] text-market-text-muted mt-1 leading-relaxed">
                      {isMarketBlocked 
                        ? "Este mercado foi temporariamente bloqueado pelo administrador. Novas previsões estão suspensas." 
                        : "Esta categoria de mercado encontra-se temporariamente desativada pelo administrador."}
                    </p>
                  </div>
                </div>
              )}

              {isSports ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black text-market-text-muted uppercase tracking-widest border-b border-[#2A2B2F] pb-2">
                     <span>Escolha</span>
                     <span>Multiplicador (Odd)</span>
                  </div>
                  <div className="space-y-2">
                     {market.outcomes?.map((o, i) => (
                       <button
                         key={i}
                         onClick={() => setOutcome(o.name)}
                         className={cn(
                           "w-full py-3.5 px-5 rounded-xl flex items-center justify-between border-2 transition-all",
                           outcome === o.name 
                             ? "bg-market-green/10 border-market-green text-market-green font-black" 
                             : "bg-[#2A2B2F] border-transparent text-white hover:bg-[#3A3B3F]"
                         )}
                       >
                         <span className="font-extrabold truncate max-w-[150px] uppercase text-xs">{o.name === 'Yes' ? 'Casa (Sim)' : o.name === 'No' ? 'Fora (Não)' : o.name}</span>
                         <span className="font-mono font-black text-base">{(1 / (o.price || 0.5)).toFixed(2)}</span>
                       </button>
                     ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5">
                  <button 
                    onClick={() => setOutcome('Yes')}
                    className={cn(
                      "py-4.5 rounded-xl font-black transition-all flex flex-col items-center justify-center gap-1.5 border-2",
                      outcome === 'Yes' 
                        ? "bg-market-green/15 border-market-green text-market-green shadow-xl shadow-market-green/5" 
                        : "bg-[#2A2B2F] border-transparent text-market-text-muted hover:bg-[#3A3B3F]"
                    )}
                  >
                    <span className="text-base font-black tracking-tight font-sans">Sim {Math.round(market.yes_price * 100)} KZ</span>
                    <span className="text-[9px] uppercase font-bold opacity-70">Previsão Alta</span>
                  </button>
                  <button 
                    onClick={() => setOutcome('No')}
                    className={cn(
                      "py-4.5 rounded-xl font-black transition-all flex flex-col items-center justify-center gap-1.5 border-2",
                      outcome === 'No' 
                        ? "bg-market-red/15 border-market-red text-market-red shadow-xl shadow-market-red/5" 
                        : "bg-[#2A2B2F] border-transparent text-market-text-muted hover:bg-[#3A3B3F]"
                    )}
                  >
                    <span className="text-base font-black tracking-tight font-sans">Não {Math.round(market.no_price * 100)} KZ</span>
                    <span className="text-[9px] uppercase font-bold opacity-70">Previsão Baixa</span>
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {orderType === 'Limit' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-market-text-muted uppercase tracking-widest">Preço Limite (KZ)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className="w-full bg-[#2A2B2F] border-none rounded-xl py-3 px-5 text-lg font-black text-white focus:ring-2 focus:ring-market-green font-mono transition-all"
                        placeholder="0"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-market-text-muted font-black font-mono">KZ</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-market-text-muted uppercase tracking-widest">
                      {isBuying ? 'Valor do Investimento' : 'Vender Quotas'}
                    </label>
                    {isBuying && <span className="text-[9px] font-bold text-market-text-muted font-mono">Saldo: {user?.balance?.toLocaleString()} KZ</span>}
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-[#2A2B2F] border-none rounded-xl py-3 px-5 text-lg font-black text-white focus:ring-2 focus:ring-market-green font-mono transition-all"
                      placeholder="0"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-market-text-muted font-extrabold text-xs">
                      {isBuying ? 'KZ' : 'Quotas'}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    {isBuying ? (
                      [100, 500, 1000, 5000, 'Máx'].map((rawVal) => {
                        const label = typeof rawVal === 'number' ? `+${rawVal} KZ` : rawVal;
                        return (
                          <button 
                            key={label}
                            onClick={() => {
                              if (rawVal === 'Máx') setAmount(Math.floor(user?.balance || 0).toString());
                              else setAmount((prev) => (parseFloat(prev || '0') + (rawVal as number)).toString());
                            }}
                            className="px-2.5 py-1.5 bg-[#2A2B2F] rounded-lg text-[9px] font-black text-white hover:bg-[#3A3B3F] transition-colors border border-white/5 font-mono"
                          >
                            {label}
                          </button>
                        );
                      })
                    ) : (
                      ['25%', '50%', '75%', 'Máx'].map((val) => (
                        <button 
                          key={val}
                          onClick={() => {
                            if (!userPosition || userPosition.outcome !== outcome || (userPosition.shares || 0) <= 0) {
                              addToast(`Não possui quotas disponíveis de "${outcome}" para vender`, "error");
                              return;
                            }
                            const totalShares = Math.floor(userPosition.shares || 0);
                            if (val === 'Máx') setAmount(totalShares.toString());
                            else {
                              const percentage = parseInt(val) / 100;
                              setAmount(Math.max(1, Math.floor(totalShares * percentage)).toString());
                            }
                          }}
                          className="px-2.5 py-1.5 bg-[#2A2B2F] rounded-lg text-[9px] font-black text-white hover:bg-[#3A3B3F] transition-colors border border-white/5 font-mono"
                        >
                          {val}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Instant dynamic review breakdown */}
                {amountValue > 0 && (
                  <div className="p-4 bg-[#1E2124] border border-[#2A2B2F]/40 rounded-xl space-y-2.5 font-mono text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-market-text-muted font-semibold text-[9px] uppercase tracking-wider">Preço Médio CLOB</span>
                      <span className="text-white font-black">{refPrice.toFixed(2)} KZ</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#2A2B2F]/40 pt-2 text-[10px]">
                      <span className="text-market-text-muted font-semibold text-[9px] uppercase tracking-wider">{isBuying ? 'Quotas a Receber' : 'Quotas a Entregar'}</span>
                      <span className="text-white font-black">{shares.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#2A2B2F]/40 pt-2 text-[10px]">
                      <span className="text-market-text-muted font-semibold text-[9px] uppercase tracking-wider">Retorno Potencial</span>
                      <span className="text-market-green font-black">{potentialReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KZ</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#2A2B2F]/40 pt-2 text-[10px]">
                      <span className="text-market-text-muted font-semibold text-[9px] uppercase tracking-wider">Lucro Estimado</span>
                      <span className={profit >= 0 ? "text-market-green font-black" : "text-market-red font-black"}>
                        {(isBuying || userPosition) ? `${profit >= 0 ? '+' : ''}${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KZ` : 'A calcular'}
                      </span>
                    </div>
                    {isBuying && (
                      <div className="flex justify-between items-center border-t border-[#2A2B2F]/40 pt-2 text-[10px]">
                        <span className="text-market-text-muted font-semibold text-[9px] uppercase tracking-wider">Rendimento (ROI)</span>
                        <span className="text-market-green font-black bg-market-green/10 px-1.5 py-0.5 rounded text-[9px]">+ {roi.toFixed(2)}%</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-[#2A2B2F]/40 pt-2 text-[8px] text-market-text-muted uppercase font-bold">
                      <span>Taxas Administrativas (1%)</span>
                      <span>{estimatedFeeKz.toFixed(2)} KZ</span>
                    </div>
                    {orderType === 'Market' && clobQuote && !clobQuote.hasLiquidity && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-300 font-sans">
                        Livro CLOB sem liquidez imediata a mercado. Utilize <strong>Ordem Limite</strong> para registar a sua oferta no livro.
                      </div>
                    )}
                    <div className="bg-[#2A2B2F]/20 border border-[#2A2B2F]/60 p-3 rounded-xl mt-3 text-[10px] text-market-text-muted leading-relaxed">
                      <span className="font-extrabold text-white block uppercase tracking-wide mb-1 text-[9px] flex items-center gap-1">
                        <Info className="w-3 h-3 text-[#0095FF]" /> Como é calculado o preço?
                      </span>
                      As ordens são executadas no motor <strong className="text-white">CLOB + AMM Enterprise</strong> com prioridade preço-tempo e custódia de 100% de colateral. No encerramento, o resultado vencedor vale exatamente <strong className="text-market-green">1.00 KZ</strong> por quota e o perdedor vale <strong className="text-market-red">0.00 KZ</strong>.
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={async () => {
                  if (isSports || isMulti || (outcome !== 'Yes' && outcome !== 'No')) {
                    addToast("Mercados multi-opção ou desportivos aguardam suporte multi-resultado no motor CLOB. Utilize mercados binários (Sim/Não).", "error");
                    return;
                  }

                  if (orderType === 'Limit') {
                    const parsedLimit = Math.round(parseFloat(limitPrice));
                    if (!parsedLimit || parsedLimit < 1 || parsedLimit > 99) {
                      addToast("Por favor, insira um preço limite válido entre 1 e 99.", "error");
                      return;
                    }
                    if (isBuying && user && user.balance < amountValue) {
                      addToast("Saldo insuficiente. Redirecionando para Depósitos...", "info");
                      navigate("/profile?tab=deposit");
                      return;
                    }

                    setIsPending(true);
                    try {
                      const qty = isBuying
                        ? Math.floor((amountValue * 100) / (parsedLimit * 1.01))
                        : Math.floor(amountValue);
                      if (qty <= 0) {
                        throw new Error("O valor inserido é insuficiente para 1 quota inteira neste preço limite (incluindo taxa de 1%).");
                      }
                      const clobRes = await ammApi.placeClobOrder({
                        marketId: market.id,
                        side: isBuying ? 'Buy' : 'Sell',
                        outcome,
                        orderType: 'LIMIT',
                        priceCents: parsedLimit,
                        quantity: qty,
                      });
                      if (clobRes.filledQuantity > 0) {
                        addToast(
                          `Ordem CLOB processada: ${clobRes.filledQuantity} quotas executadas (${clobRes.remainingQuantity} pendentes).`,
                          "success"
                        );
                      } else {
                        addToast(
                          `Ordem Limite CLOB registada (${qty} quotas @ ${parsedLimit}c) e fundos reservados.`,
                          "success"
                        );
                      }
                      await refreshClobData();
                      onTrade(null);
                      setLimitPrice('');
                      setAmount('');
                    } catch (e: any) {
                      addToast(e.message || "Erro ao registrar ordem limite", "error");
                    } finally {
                      setIsPending(false);
                    }
                    return;
                  }

                  if (isBuying && user && user.balance < amountValue) {
                    addToast("Saldo insuficiente. Redirecionando para Depósitos...", "info");
                    navigate("/profile?tab=deposit");
                    return;
                  }

                  if (!isBuying) {
                    const sellQty = Math.floor(amountValue);
                    if (sellQty <= 0) {
                      addToast("Insira pelo menos 1 quota inteira para vender.", "error");
                      return;
                    }
                    if (!userPosition || (userPosition.shares || 0) < sellQty) {
                      addToast(`Quotas disponíveis insuficientes para venda (${userPosition?.shares || 0} disponíveis).`, "error");
                      return;
                    }
                  }
                  
                  setIsPending(true);
                  try {
                    const clobRes = await ammApi.placeClobOrder({
                      marketId: market.id,
                      side: isBuying ? 'Buy' : 'Sell',
                      outcome,
                      orderType: 'MARKET',
                      budgetKz: isBuying ? amountValue : undefined,
                      quantity: !isBuying ? Math.floor(amountValue) : undefined,
                      priceCents: !isBuying ? 1 : undefined,
                    });

                    if (!clobRes.filledQuantity || clobRes.filledQuantity <= 0) {
                      addToast("Sem liquidez imediata no livro CLOB ao preço de mercado. Utilize Ordem Limite para registar uma oferta.", "info");
                      return;
                    }

                    const execPriceKz = (clobRes.avgExecutionPriceCents || Math.round(refPrice * 100)) / 100;
                    const executedAmountKz = Number((clobRes.filledQuantity * execPriceKz).toFixed(2));

                    setLastTradeSuccess({
                      outcome,
                      amount: isBuying ? Number((executedAmountKz * 1.01).toFixed(2)) : executedAmountKz,
                      shares: clobRes.filledQuantity,
                      side: isBuying ? 'Compra' : 'Venda',
                      price: execPriceKz,
                      timestamp: new Date().toLocaleTimeString()
                    });
                    addToast("Negócio executado no motor CLOB + AMM com sucesso!", "success");
                    await refreshClobData();
                    onTrade(null);
                  } catch (e: any) {
                    addToast(e.message || "Erro ao realizar negócio no CLOB", "error");
                  } finally {
                    setIsPending(false);
                  }
                }}
                disabled={market.resolved || (orderType !== 'Limit' && isTradingBlocked) || isPending || amountValue <= 0}
                className="w-full py-3.5 bg-[#0095FF] text-white rounded-xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:bg-slate-700 disabled:shadow-none uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {market.resolved 
                  ? 'Mercado Resolvido' 
                  : (orderType !== 'Limit' && isTradingBlocked)
                    ? 'Mercado Bloqueado' 
                    : isPending 
                      ? 'Processando...' 
                      : orderType === 'Limit'
                        ? `Registrar Ordem Limite`
                        : (isBuying 
                          ? (user?.balance < amountValue ? 'Falta de Saldo' : `Comprar ${outcome === 'Yes' ? 'Sim' : 'Não'}`) 
                          : `Vender ${outcome === 'Yes' ? 'Sim' : 'Não'}`)}
              </button>

              <div className="text-center">
                <p className="text-[9px] font-bold text-market-text-muted uppercase tracking-wider">
                  Os investimentos acarretam risco integral de capital.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <PopularTicker markets={markets} />
      
      <div className="flex flex-col lg:flex-row gap-8 relative">
        {/* Left Column: Info & Chart */}
        <div className="flex-1 space-y-6 min-w-0">
          
          {/* UNIFIED PREMIUM HEADER & STATS (For all non-sports markets) */}
          {!isSports && (
            <>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6 bg-market-card/30 p-5 rounded-2xl border border-market-border/40">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-market-card flex items-center justify-center border border-market-border rounded-xl shadow-inner overflow-hidden shrink-0">
                    {isCrypto ? (
                      <Bitcoin className="w-8 h-8 text-[#F7931A]" />
                    ) : (
                      <img src={market.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-market-green/20 border border-market-green/30 rounded-full text-[9px] font-black text-market-green uppercase tracking-wider">
                        {market.category || 'Geral'}
                      </span>
                      <span className="text-[9px] text-market-text-muted font-bold font-mono uppercase tracking-wider border border-market-border rounded bg-white/[0.02] px-1.5 py-0.5">
                        ID: {market.id?.slice(0, 8)}
                      </span>
                    </div>
                    <h1 className="text-lg md:text-xl font-black text-white leading-snug tracking-tight">{market.question}</h1>
                    <p className="text-[10px] font-semibold text-market-text-muted mt-1.5 flex items-center gap-1.5">
                      <span>Expira:</span>
                      <strong className="text-slate-300 font-medium">
                        {new Date(market.end_date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 md:self-center shrink-0">
                  <button onClick={() => addToast("Link copiado para partilha!", "info")} className="p-2.5 bg-market-card hover:bg-[#2A2B2F] border border-[#2A2B2F] rounded-xl transition-all text-market-text-muted hover:text-white" title="Partilhar">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => addToast("Mercado adicionado aos favoritos!", "success")} className="p-2.5 bg-market-card hover:bg-[#2A2B2F] border border-[#2A2B2F] rounded-xl transition-all text-market-text-muted hover:text-white" title="Favorito">
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Advanced Real-time Stats Grid */}
              {market.showStatistics !== false && (
                <div className={cn("grid gap-4 mb-6", market.showCountdown !== false ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
                  <div className="bg-market-card/25 p-4 rounded-xl border border-market-border/40 flex flex-col justify-between min-h-[84px]">
                    <span className="text-[9px] font-black text-market-text-muted uppercase tracking-widest block">Proporção Sim / Não</span>
                    <div className="text-base font-black text-white flex items-end gap-1.5 mt-2">
                      <span className="text-market-green">{Math.round(market.yes_price * 100)} KZ</span>
                      <span className="text-slate-500 font-normal text-xs">Sim</span>
                      <span className="text-slate-600 font-normal text-xs">/</span>
                      <span className="text-market-red">{Math.round(market.no_price * 100)} KZ</span>
                      <span className="text-slate-500 font-normal text-xs">Não</span>
                    </div>
                  </div>

                  <div className="bg-market-card/25 p-4 rounded-xl border border-market-border/40 flex flex-col justify-between min-h-[84px]">
                    <span className="text-[9px] font-black text-market-text-muted uppercase tracking-widest block">Volume Total</span>
                    <div className="text-sm font-bold text-white font-mono mt-2 flex items-baseline gap-1">
                      <span className="text-lg font-black text-white">{market.volume.toLocaleString('pt-BR')}</span>
                      <span className="text-[10px] text-market-text-muted">KZ</span>
                    </div>
                  </div>

                  <div className="bg-market-card/25 p-4 rounded-xl border border-market-border/40 flex flex-col justify-between min-h-[84px]">
                    <span className="text-[9px] font-black text-market-text-muted uppercase tracking-widest block">Liquidez Reservada</span>
                    <div className="text-sm font-bold text-white font-mono mt-2 flex items-baseline gap-1">
                      <span className="text-lg font-black text-[#0095FF]">{((market.pool_yes || 0) + (market.pool_no || 0)).toLocaleString('pt-BR')}</span>
                      <span className="text-[10px] text-market-text-muted">KZ</span>
                    </div>
                  </div>

                  {market.showCountdown !== false && (
                    <div className="bg-market-card/25 border border-market-border/40 p-3.5 rounded-xl flex items-center justify-between col-span-2 md:col-span-1 min-h-[84px]">
                      <div className="flex flex-col justify-between h-full">
                        <span className="text-[9px] font-black text-market-text-muted uppercase tracking-widest block mb-1">Duração Restante</span>
                        <span className="text-[8px] font-bold text-market-red uppercase bg-market-red/10 border border-market-red/25 px-1.5 py-0.5 rounded tracking-wider font-mono inline-block">TERMINA EM BREVE</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-center">
                        <div>
                          <span className="text-sm font-black text-market-red block leading-none">{timeLeft.days}</span>
                          <span className="text-[7px] text-market-text-muted uppercase font-black block mt-1">Dia</span>
                        </div>
                        <span className="text-market-red/30 text-xs font-black">:</span>
                        <div>
                          <span className="text-sm font-black text-market-red block leading-none">{timeLeft.hours}</span>
                          <span className="text-[7px] text-market-text-muted uppercase font-black block mt-1">Hor</span>
                        </div>
                        <span className="text-market-red/30 text-xs font-black">:</span>
                        <div>
                          <span className="text-sm font-black text-market-red block leading-none">{timeLeft.min}</span>
                          <span className="text-[7px] text-market-text-muted uppercase font-black block mt-1">Min</span>
                        </div>
                        <span className="text-market-red/30 text-xs font-black">:</span>
                        <div>
                          <span className="text-sm font-black text-[#FF4444] block leading-none">{timeLeft.sec}</span>
                          <span className="text-[7px] text-market-text-muted uppercase font-black block mt-1">Seg</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DYNAMIC RESOLUTION & EXPIRED NOTICE PANEL */}
              {(() => {
                const isExpired = market?.end_date ? new Date(market.end_date).getTime() <= new Date().getTime() : false;
                if (!isExpired || market.resolved) return null;
                
                if (user?.is_admin) {
                  return (
                    <div className="bg-amber-500/10 border border-amber-500/35 rounded-2xl p-6 mb-6 animate-in fade-in duration-300">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1 md:max-w-xl">
                          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-[10px] uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            Ação de Administrador Requerida
                          </div>
                          <h4 className="text-sm font-black uppercase tracking-wider text-white">Definir Resultado do Mercado</h4>
                          <p className="text-[11px] text-slate-350 leading-relaxed">
                            Este contrato expirou e aguarda resolução oficial. Selecione o resultado correto abaixo para liquidar as quotas de todos os participantes automaticamente e creditar os ganhos corretos nos saldos das carteiras.
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2.5 items-center justify-end">
                          {market.is_multi && market.outcomes ? (
                            market.outcomes.map((o) => (
                              <button
                                key={o.name}
                                onClick={async () => {
                                  if (window.confirm(`Tem certeza que deseja resolver este mercado como "${o.name}"? Esta ação creditará automaticamente de forma permanente todos os vencedores.`)) {
                                    try {
                                      await firebaseService.resolveMarket(market.id, o.name);
                                      await firebaseService.logAdminAction(user!.id, 'resolve_market', `Efetivou resolução rápida na página do mercado ${market.id} como: ${o.name}`);
                                      addToast(`Mercado resolvido com sucesso como ${o.name}! Vencedores pagos.`, 'success');
                                    } catch (err: any) {
                                      addToast(`Erro ao resolver mercado: ${err.message}`, 'error');
                                    }
                                  }
                                }}
                                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 font-black text-[10px] text-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                              >
                                {o.name}
                              </button>
                            ))
                          ) : (
                            <>
                              <button
                                onClick={async () => {
                                  const motive = window.prompt(`Indique o motivo e a fonte oficial para resolver este mercado como "SIM":`);
                                  if (!motive || motive.trim().length < 5) {
                                    addToast('Motivo formal obrigatório (mín. 5 caracteres).', 'error');
                                    return;
                                  }
                                  try {
                                    await ammApi.resolveClobMarket(market.id, 'Yes', motive.trim());
                                    addToast('Mercado resolvido no motor CLOB+AMM como SIM! Vencedores pagos.', 'success');
                                    await refreshClobData();
                                  } catch (err: any) {
                                    addToast(`Erro ao resolver mercado: ${err.message}`, 'error');
                                  }
                                }}
                                className="px-6 py-2.5 bg-market-green hover:bg-market-green/85 font-black text-[10px] text-market-bg uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 border-b-2 border-green-700"
                              >
                                Sim
                              </button>
                              <button
                                onClick={async () => {
                                  const motive = window.prompt(`Indique o motivo e a fonte oficial para resolver este mercado como "NÃO":`);
                                  if (!motive || motive.trim().length < 5) {
                                    addToast('Motivo formal obrigatório (mín. 5 caracteres).', 'error');
                                    return;
                                  }
                                  try {
                                    await ammApi.resolveClobMarket(market.id, 'No', motive.trim());
                                    addToast('Mercado resolvido no motor CLOB+AMM como NÃO! Vencedores pagos.', 'success');
                                    await refreshClobData();
                                  } catch (err: any) {
                                    addToast(`Erro ao resolver mercado: ${err.message}`, 'error');
                                  }
                                }}
                                className="px-6 py-2.5 bg-market-red hover:bg-market-red/85 font-black text-[10px] text-white uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 border-b-2 border-red-700"
                              >
                                Não
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 mb-6 animate-in fade-in duration-350">
                      <div className="flex gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 self-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-black uppercase text-white tracking-widest">Aguardando Resolução do Administrador</h4>
                          <p className="text-[11px] text-slate-330 leading-relaxed">
                            Este mercado já ultrapassou a duração limite. O Administrador está atualmente a analisar as fontes oficiais do resultado para decidir a resolução exata. Assim que concluído, o payout correspondente a 1 KZ por quota ganha será distribuído de forma 100% garantida diretamente nos saldos das contas dos utilizadores vencedores.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}
            </>
          )}

          {/* 2. SPORTS HEADER */}
          {isSports && (
            <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in fade-in duration-700">
              <div className="flex items-center justify-center gap-12 md:gap-24">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-white rounded-full p-2 border-4 border-market-border shadow-2xl">
                    <img src="https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/1200px-Real_Madrid_CF.svg.png" className="w-full h-full object-contain" alt="Home" />
                  </div>
                  <span className="text-xl font-black text-white tracking-widest">REA</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-white tracking-tighter mb-1">20:00</span>
                  <span className="text-[10px] font-bold text-market-text-muted uppercase tracking-[0.3em]">abril 10</span>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 bg-white rounded-full p-2 border-4 border-market-border shadow-2xl">
                    <img src="https://upload.wikimedia.org/wikipedia/en/thumb/9/90/Girona_FC_logo.svg/1200px-Girona_FC_logo.svg.png" className="w-full h-full object-contain" alt="Away" />
                  </div>
                  <span className="text-xl font-black text-white tracking-widest">GIR</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-market-text-muted">
                <span>$458.18K Vol.</span>
                <span className="opacity-20">|</span>
                <div className="flex items-center gap-1 opacity-60">
                   <div className="w-4 h-4 border border-market-text-muted rotate-45 flex items-center justify-center text-[6px]">P</div>
                   Polymarket
                </div>
              </div>
            </div>
          )}

          {/* 3. MULTI-OUTCOME DETAILS BADGES IF APPLICABLE */}
          {isMulti && !isSports && (
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide py-2 border-b border-market-border/30 mb-4">
              <button className="px-4 py-1.5 bg-[#1C2128] rounded-lg text-[10px] font-bold text-white flex items-center gap-2">
                Passado <ChevronDown className="w-3 h-3" />
              </button>
              <button className="px-4 py-1.5 bg-white text-black rounded-lg text-[10px] font-black uppercase tracking-widest">24 de abril</button>
              <button className="px-4 py-1.5 bg-[#1C2128] rounded-lg text-[10px] font-bold text-white uppercase tracking-widest">25 de abril</button>
            </div>
          )}
          
          {market.showGraph !== false && market.graphType !== 'none' && (
            <div className="market-card p-0 overflow-hidden bg-[#0D1117] border-market-border relative min-h-[550px] flex flex-col">
              {/* Multi-outcome logo overlay from image */}
              {isMulti && (
                 <div className="absolute top-12 left-12 flex items-center gap-2 opacity-40 z-10">
                   <div className="w-5 h-5 border-2 border-white rotate-45 flex items-center justify-center text-[8px] font-black">P</div>
                   <span className="text-sm font-bold text-white tracking-widest uppercase">Polymarket</span>
                 </div>
              )}

              <div className="h-[450px] min-h-[450px] w-full relative group flex-1">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={450}>
                  {chartType === 'candlestick' ? (
                    <BarChart data={candlestickData} margin={{ top: 20, right: 60, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2128" opacity={0.1} />
                      <XAxis dataKey="time" hide />
                       <YAxis 
                         orientation="right" 
                         domain={[0, 100]} 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fill: '#4B5563', fontSize: 10 }}
                         tickFormatter={(val) => `${val} KZ`}
                         width={60}
                       />
                      <Tooltip content={() => null} />
                      <Bar dataKey="close" shape={(props: any) => <Candlestick {...props} />}>
                        {candlestickData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isUp ? '#00c853' : '#ff4444'} />
                        ))}
                      </Bar>
                      {candlestickData.length > 0 && (
                        <ReferenceLine 
                          y={candlestickData[candlestickData.length - 1].close} 
                          stroke="#00c853" 
                          strokeDasharray="2 2" 
                          label={(props: any) => {
                            const { viewBox, value } = props;
                            if (!viewBox) return null;
                            return (
                              <g>
                                 <rect x={viewBox.width + viewBox.x} y={viewBox.y - 12} width={50} height={24} fill="#00c853" rx={4} />
                                 <text x={viewBox.width + viewBox.x + 25} y={viewBox.y + 5} fill="white" fontSize={11} fontWeight="900" textAnchor="middle">
                                   {Math.round(value)} KZ
                                 </text>
                              </g>
                            );
                          }}
                        />
                      )}
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 40, right: 60, left: 60, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1c2128" opacity={0.3} />
                      <XAxis dataKey="time" hide />
                       <YAxis 
                         orientation="right"
                         domain={chartType === 'price' ? [0, 100] : [0, 1]} 
                         axisLine={false}
                         tickLine={false}
                         tick={{ fill: '#4B5563', fontSize: 10 }}
                         tickFormatter={(val) => isMulti ? `${Math.round(val * 100)}%` : chartType === 'price' ? `${Math.round(val)} KZ` : `${Math.round(val * 100)}%`}
                       />
                       <Tooltip 
                         content={(props: any) => {
                           const { active, payload } = props;
                           if (active && payload && payload.length) {
                             return (
                               <div className="bg-[#0D1117] border border-market-border p-3 rounded-xl shadow-2xl">
                                 {payload.map((p: any, i: number) => (
                                   <div key={i} className="text-[10px] font-bold" style={{ color: p.color }}>
                                     {p.name}: {p.value !== undefined ? (isMulti ? `${Math.round(p.value * 100)}%` : chartType === 'price' ? `${Math.round(p.value)} KZ` : `${Math.round(p.value * 100)}%`) : ''}
                                   </div>
                                 ))}
                               </div>
                             );
                           }
                           return null;
                         }}
                       />
                      {isMulti ? (
                        market.outcomes?.map((o, idx) => (
                          <Line 
                            key={idx}
                            type="monotone" 
                            dataKey={`price_${idx}`} 
                            name={o.name}
                            stroke={['#0095FF', '#A855F7', '#F7931A', '#FF4444', '#10B981'][idx % 5]} 
                            strokeWidth={2}
                            dot={false}
                            animationDuration={1000}
                          />
                        ))
                      ) : (
                        <Line 
                          type="monotone" 
                          dataKey={chartType === 'price' ? 'priceKZ' : 'price'} 
                          stroke="#0095FF" 
                          strokeWidth={3}
                          dot={false}
                          animationDuration={1000}
                        />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
                
                 {/* Price Labels Overlay (Crypto specific) */}
                  {isCrypto && (
                    <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 pointer-events-none">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-market-green shadow-[0_0_8px_rgba(0,200,83,0.8)]" />
                        <div className="text-market-green text-[10px] font-black tracking-tighter cursor-default">+ 5 KZ</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-market-green shadow-[0_0_8px_rgba(0,200,83,0.8)]" />
                        <div className="text-market-green text-[10px] font-black tracking-tighter cursor-default">+ 2 KZ</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-market-red shadow-[0_0_4px_rgba(255,68,68,0.8)]" />
                        <div className="text-market-red text-[10px] font-black tracking-tighter cursor-default">- 3 KZ</div>
                      </div>
                    </div>
                  )}
              </div>

              {/* Time Labels Overlay (X-Axis simulation from image) */}
              <div className="px-12 py-4 flex items-center justify-between border-t border-market-border/20 text-[10px] font-bold text-market-text-muted uppercase tracking-widest overflow-hidden">
                {['7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM'].map((time) => (
                  <button 
                    key={time}
                    onClick={() => {
                      setSelectedTimeSlot(time);
                      addToast(`Gráfico ajustado para o intervalo de ${time}`, "info");
                    }}
                    className={cn(
                      "hover:text-white transition-colors py-1 px-2 rounded",
                      selectedTimeSlot === time ? "text-white bg-white/5" : "text-market-text-muted"
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>

              {/* Chart Footer Controls */}
              <div className="p-4 bg-[#0D1117] border-t border-market-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => addToast("Histórico de preços carregado", "info")}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#1C2128] rounded-lg text-[10px] font-bold text-white uppercase tracking-widest hover:bg-[#2D333B] transition-colors"
                  >
                    Passado <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div onClick={() => addToast("Tendência de Baixa", "info")} className="w-4 h-4 rounded-full bg-[#FF4444] flex items-center justify-center cursor-pointer hover:bg-opacity-80"><ChevronDown className="w-2 h-2 text-white" /></div>
                    <div onClick={() => addToast("Tendência de Baixa", "info")} className="w-4 h-4 rounded-full bg-[#FF4444] flex items-center justify-center cursor-pointer hover:bg-opacity-80"><ChevronDown className="w-2 h-2 text-white" /></div>
                    <div onClick={() => addToast("Tendência de Alta", "info")} className="w-4 h-4 rounded-full bg-market-green flex items-center justify-center cursor-pointer hover:bg-opacity-80"><ChevronUp className="w-2 h-2 text-white" /></div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {['5:15 PM', '5:20 PM', '5:25 PM', '5:30 PM'].map((time) => (
                    <button 
                      key={time} 
                      onClick={() => {
                        setSelectedTimeSlot(time);
                        addToast(`Visualizando período das ${time}`, "info");
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-2", 
                        selectedTimeSlot === time ? "bg-white text-black font-black" : "bg-[#1C2128] text-white hover:bg-[#2D333B]"
                      )}
                    >
                      {selectedTimeSlot === time && <div className="w-1.5 h-1.5 rounded-full bg-market-red" />}
                      {time}
                    </button>
                  ))}
                  <button 
                    onClick={() => addToast("Mais opções de horário disponíveis brevemente", "info")}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#1C2128] rounded-lg text-[11px] font-bold text-white ml-2 hover:bg-[#2D333B]"
                  >
                    More <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setChartType('probability')}
                    className={cn("p-2 transition-all rounded-md", chartType === 'probability' ? "bg-[#0095FF] text-white" : "text-market-text-muted hover:text-white")} 
                    title="Probability"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setChartType('price')}
                    className={cn("p-2 transition-all rounded-md", chartType === 'price' ? "bg-[#F7931A] text-white" : "text-market-text-muted hover:text-white")} 
                    title="Price"
                  >
                    <Bitcoin className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setChartType('candlestick')}
                    className={cn("p-2 transition-all rounded-md", chartType === 'candlestick' ? "bg-market-green text-white" : "text-market-text-muted hover:text-white")} 
                    title="Candlestick"
                  >
                    <CandlestickChart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {market.is_multi && (
            <CollapsibleSection 
              title="Escolha uma opção" 
              icon={LayoutGrid}
              headerClassName="p-8"
              contentClassName="px-8 pb-8 pt-0"
            >
              <div className="space-y-3">
                {market.outcomes?.map((o) => (
                  <div 
                    key={o.id} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                      outcome === o.name 
                        ? "bg-market-card-lighter border-market-green/30 shadow-lg shadow-market-green/5" 
                        : "bg-market-card/50 border-market-border/50 hover:border-market-border"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight className="w-3 h-3 text-market-green" />
                        <span className="text-sm font-bold text-white truncate">{o.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-market-text-muted uppercase tracking-wider">
                        <span>{o.pool.toLocaleString()} KZ Vol.</span>
                        <div className="w-1 h-1 rounded-full bg-market-border" />
                        <History className="w-3 h-3" />
                      </div>
                    </div>
                    
                    <div className="px-8 text-center">
                      <div className="text-xl font-mono font-black text-white">{Math.round(o.price * 100)}%</div>
                      <div className="text-[8px] font-bold text-market-green uppercase tracking-tighter">Probabilidade</div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setOutcome(o.name);
                          setIsBuying(true);
                          window.scrollTo({ top: document.querySelector('.trading-panel')?.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                        }}
                        className={cn(
                          "px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border",
                          outcome === o.name && isBuying
                            ? "bg-market-green text-market-bg border-market-green shadow-lg shadow-market-green/20"
                            : "bg-market-green/10 text-market-green border-market-green/20 hover:bg-market-green hover:text-market-bg"
                        )}
                      >
                        Sim {Math.round(o.price * 100)} KZ
                      </button>
                      <button 
                        onClick={() => {
                          setOutcome(o.name);
                          setIsBuying(false);
                          window.scrollTo({ top: document.querySelector('.trading-panel')?.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                        }}
                        className={cn(
                          "px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border",
                          outcome === o.name && !isBuying
                            ? "bg-market-red text-white border-market-red shadow-lg shadow-market-red/20"
                            : "bg-market-red/10 text-market-red border-market-red/20 hover:bg-market-red hover:text-white"
                        )}
                      >
                        Não {Math.round((1 - o.price) * 100)} KZ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
          
          <div className="flex flex-col gap-6">
            <OrderBook 
              market={market} 
              outcome={outcome} 
              onOutcomeChange={(o) => setOutcome(o as any)} 
              trades={trades}
              user={user}
              onOrderChange={() => onTrade(null)}
            />
            
            <div className="market-card overflow-hidden bg-[#0D1117] border-market-border">
              <div className="flex border-b border-market-border overflow-x-auto scrollbar-hide">
                {([
                  { id: 'rules', label: 'Regras', icon: ScrollText },
                  { id: 'context', label: 'Contexto', icon: LayoutGrid },
                  market.showComments !== false ? { id: 'comments', label: `Comentários (${comments.length})`, icon: MessageSquare } : null,
                  { id: 'holders', label: 'Suportes', icon: Users },
                  { id: 'positions', label: 'Cargos', icon: Shield },
                  { id: 'activity', label: 'Atividade', icon: History }
                ].filter(Boolean) as { id: string, label: string, icon: any }[]).map((tab) => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "px-6 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap transition-all border-b-2",
                      activeTab === tab.id 
                        ? "text-market-green border-market-green bg-market-green/5" 
                        : "text-market-text-muted border-transparent hover:text-white"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-8">
                {activeTab === 'rules' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <ScrollText className="w-4 h-4 text-market-green" />
                      Regras de Resolução e Preço
                    </h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-white/[0.02] border border-market-border/50 rounded-xl space-y-2">
                        <div className="text-[10px] font-black text-market-green uppercase tracking-widest">Condição de Vitória</div>
                        <p className="text-xs text-market-text-muted leading-relaxed">
                          Este mercado será resolvido como "Sim" se {market.question.split('?')[0]} for confirmado oficialmente até {new Date(market.end_date).toLocaleDateString()}.
                        </p>
                      </div>
                      <div className="p-4 bg-white/[0.02] border border-market-border/50 rounded-xl space-y-2">
                        <div className="text-[10px] font-black text-market-green uppercase tracking-widest">Fonte de Dados</div>
                        <p className="text-xs text-market-text-muted leading-relaxed">
                          A resolução será baseada em relatórios oficiais da plataforma e dados públicos verificáveis (Ex: Google Finance, Yahoo Finance, Diário da República).
                        </p>
                      </div>
                      <div className="p-4 bg-[#1E2124]/40 border border-market-border/50 rounded-xl space-y-2">
                        <div className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Como Funciona o Preço (Motor CLOB + AMM Enterprise)</div>
                        <p className="text-xs text-market-text-muted leading-relaxed">
                          Este mercado opera no livro central de ordens (<strong className="text-white">CLOB</strong>) emparelhado com o fornecedor automático de liquidez (<strong className="text-white">AMM Enterprise</strong>). O preço de cada quota (de 1 KZ a 99 KZ) reflete as melhores ofertas disponíveis com prioridade preço-tempo e reserva integral de colateral para liquidação garantida de 1.00 KZ por quota vencedora.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'context' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-market-green" />
                      Contexto de Mercado
                    </h3>
                    <p className="text-xs text-market-text-muted leading-relaxed">
                      O sentimento atual para este mercado é altamente especulativo. O volume recente indica uma forte acumulação em posições longas. 
                      A volatilidade é esperada para as próximas 24 horas devido a eventos macroeconômicos em Angola.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/[0.02] border border-market-border/50 rounded-xl">
                        <div className="text-[10px] font-black text-market-text-muted uppercase tracking-widest mb-1">Liquidez</div>
                        <div className="text-lg font-black text-white">{market.volume.toLocaleString()} KZ</div>
                      </div>
                      <div className="p-4 bg-white/[0.02] border border-market-border/50 rounded-xl">
                        <div className="text-[10px] font-black text-market-text-muted uppercase tracking-widest mb-1">Status</div>
                        <div className="text-lg font-black text-market-green uppercase">Ativo</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-market-green" />
                      Discussão Social
                    </h3>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-market-card flex items-center justify-center shrink-0 border border-market-border">
                          <UserIcon className="w-4 h-4 text-market-text-muted" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <textarea 
                            placeholder="Partilhe a sua análise..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full bg-white/[0.03] border border-market-border/50 rounded-xl p-3 text-xs text-white focus:ring-1 focus:ring-market-green outline-none min-h-[80px] transition-all"
                          />
                          <div className="flex justify-end">
                            <button 
                              onClick={handleAddComment}
                              disabled={!newComment.trim()}
                              className="px-6 py-2 bg-market-green text-market-bg rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                              Publicar
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 divide-y divide-market-border/20">
                        {comments.map(comment => (
                          <div key={comment.id} className="flex gap-3 pt-4">
                            <div className="w-8 h-8 rounded-lg bg-market-card flex items-center justify-center shrink-0 border border-market-border">
                              <UserIcon className="w-4 h-4 text-market-text-muted" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white text-[11px]">{comment.userName || comment.user}</span>
                                <span className="text-[8px] text-market-text-muted font-black uppercase">
                                  {comment.timestamp ? formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true, locale: ptBR }) : comment.time}
                                </span>
                              </div>
                              <p className="text-[11px] text-market-text-muted leading-relaxed">{comment.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'holders' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0095FF]" />
                      Investidores & Detentores Reais
                    </h3>
                    
                    {loadingPositions ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-market-green" />
                      </div>
                    ) : marketPositions.length > 0 ? (
                      <div className="space-y-3">
                        {marketPositions.map((pos, idx) => {
                          const userProfile = pos.profiles || {};
                          const username = pos.userLabel || userProfile.name || userProfile.email?.split('@')[0] || `Trader #${pos.userId?.slice(0, 5)}`;
                          const isBot = pos.isBot || pos.userId?.startsWith('bot_') || userProfile.is_bot || false;
                          const outcomeText = pos.outcome === 'Yes' ? 'SIM' : 'NÃO';
                          const isYes = pos.outcome === 'Yes';
                          
                          // Estimate potential payout when resolved
                          let payoutMultiplier = 1;
                          if (market?.resolved) {
                            const won = (pos.outcome === 'Yes' && market.resolution_outcome === 'Yes') || (pos.outcome === 'No' && market.resolution_outcome === 'No');
                            payoutMultiplier = won ? 1 : 0;
                          }

                          return (
                            <div key={pos.id || idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-market-border/30 rounded-xl hover:border-white/10 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black",
                                  isBot ? "bg-purple-900/45 text-purple-300 border border-purple-500/20" : "bg-[#0095FF]/15 text-[#0095FF]"
                                )}>
                                  {isBot ? "BOT" : `#${idx + 1}`}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white">{username}</span>
                                    {isBot && (
                                      <span className="px-1.5 py-0.5 rounded text-[7px] bg-purple-500/10 text-purple-300 font-extrabold uppercase">AUTO_BOT</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-market-text-muted mt-0.5 flex items-center gap-2">
                                    <span>Aposta: </span>
                                    <span className={cn(
                                      "font-black px-1.5 py-0.5 rounded text-[8px]",
                                      isYes ? "bg-market-green/10 text-market-green border border-market-green/20" : "bg-market-red/10 text-market-red border border-market-red/20"
                                    )}>
                                      {outcomeText}
                                    </span>
                                    <span className="text-slate-500">•</span>
                                    <span>Preço Médio: <strong className="text-slate-300">{pos.avg_price ? Number(pos.avg_price).toFixed(2) : '-'} KZ</strong></span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-black text-slate-200">{(pos.shares || 0).toLocaleString()} Quotas</div>
                                <div className="text-[9px] font-bold uppercase mt-1">
                                  {market?.resolved ? (
                                    payoutMultiplier > 0 ? (
                                      <span className="text-market-green font-black flex items-center gap-1 justify-end">GANHOU SIM ✓</span>
                                    ) : (
                                      <span className="text-market-red font-bold flex items-center gap-1 justify-end">ERROU ✕</span>
                                    )
                                  ) : (
                                    <span className="text-market-text-muted">Pendente do Resultado</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-market-text-muted text-xs bg-white/[0.01] rounded-2xl border border-market-border/35">
                        <p className="font-bold">Nenhum investimento detectado ainda neste mercado.</p>
                        <p className="text-[9px] mt-1 text-slate-500 uppercase">Seja o primeiro a apostar!</p>
                      </div>
                    )}
                    <p className="text-[9px] text-center text-market-text-muted uppercase font-bold">Os detentores influenciam diretamente a probabilidade final.</p>
                  </div>
                )}

                {activeTab === 'positions' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <Shield className="w-4 h-4 text-market-green" />
                      Cargos e Governança
                    </h3>
                    <div className="p-6 bg-market-green/5 border border-market-green/20 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-500">
                        <Shield className="w-20 h-20 text-market-green" />
                      </div>
                      <div className="relative space-y-4">
                        <div className="inline-block px-3 py-1 bg-market-green/20 rounded-full text-[9px] font-black text-market-green uppercase tracking-widest">Moderador do Mercado</div>
                        <p className="text-xs text-market-text-muted leading-relaxed">
                          Este mercado está sob supervisão do conselho técnico do MarketPay Angola. Nenhuma alteração manual de preço é permitida fora dos algoritmos de liquidez.
                        </p>
                        <div className="flex items-center gap-4 pt-2">
                          <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="w-6 h-6 rounded-full bg-market-card border border-market-border flex items-center justify-center overflow-hidden">
                                <UserIcon className="w-3 h-3 text-market-text-muted" />
                              </div>
                            ))}
                          </div>
                          <span className="text-[9px] font-bold text-market-text-muted uppercase">3 Administradores Verificados</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <RecentTrades trades={trades.filter(t => t.market_id === market.id).slice(0, 10)} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile-Responsive Trading Panel - Renders right beneath details on smaller displays */}
          <div className="block lg:hidden w-full mt-6">
            {renderTradingPanel()}
          </div>
        </div>
        
        {/* Right Column Toggle Button */}
        <button 
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className={cn(
            "hidden lg:flex absolute right-0 top-0 z-20 p-2 bg-market-card border border-market-border rounded-full hover:bg-market-card-lighter transition-all",
            isRightSidebarOpen ? "-translate-x-[360px]" : "translate-x-0"
          )}
          title={isRightSidebarOpen ? "Ocultar Painel" : "Mostrar Painel"}
        >
          {isRightSidebarOpen ? <ChevronDown className="w-4 h-4 -rotate-90" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
        </button>

        <AnimatePresence mode="wait">
          {isRightSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: 20 }}
              animate={{ width: "100%", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full lg:max-w-[384px] shrink-0 overflow-hidden"
            >
              {/* Right Column: Trading Panel */}
              <div className="space-y-6">
                {renderTradingPanel()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const LeaderboardPage = () => {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      const data = await firebaseService.getLeaderboard(10);
      if (data) {
        setLeaders(data.map((u, i) => ({
          rank: i + 1,
          user: u.name || u.email?.split('@')[0] || 'Trader',
          profit: u.balance,
          winRate: u.is_verified ? 100 : 0,
          trades: Array.isArray(u.positions) ? u.positions.length : 0
        })));
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

const PortfolioPage = ({ user, trades, markets, addToast }: { user: User | null, trades: any[], markets: Market[], addToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'history' | 'limits'>('positions');
  const [limitOrders, setLimitOrders] = useState<any[]>([]);
  const [clobAccount, setClobAccount] = useState<any>(null);

  const loadClobPortfolio = React.useCallback(async () => {
    if (!user) return;
    try {
      const res = await ammApi.getMyClobOrders();
      setLimitOrders(res.orders || []);
      setClobAccount(res.account || null);
    } catch (err) {
      console.error('Error loading CLOB portfolio orders:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadClobPortfolio();
  }, [loadClobPortfolio, trades.length]);

  if (!user) return <div className="p-20 text-center text-market-text-muted font-bold">Por favor, inicie sessão para ver seu portfólio</div>;

  const userTrades = trades.filter(t => t.user_id === user.id);
  const reservedOrderKz = (clobAccount?.reserved_cents || 0) / 100;

  // Calculate total portfolio value
  const portfolioValue = user.positions.reduce((total, pos) => {
    const market = markets.find(m => m.id === pos.market_id);
    const currentPrice = pos.outcome === 'Yes' ? market?.yes_price : market?.no_price;
    return total + (pos.shares * (currentPrice || 0));
  }, 0);

  const pendingOrdersCount = limitOrders.filter(o => o.status === 'OPEN' || o.status === 'PARTIAL').length;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-12 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">Portfólio</h1>
          <p className="text-market-text-muted font-medium">Gerencie suas posições e acompanhe seu desempenho</p>
        </div>
        <div className="text-left md:text-right">
          <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-1">Valor Total</div>
          <div className="text-4xl font-bold text-market-green">{(user.balance + reservedOrderKz + portfolioValue).toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="market-card p-6">
          <div className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest mb-1">Saldo em Dinheiro</div>
          <div className="text-2xl font-bold text-white">{user.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ</div>
          {reservedOrderKz > 0 && (
            <div className="text-[10px] text-amber-400 font-bold mt-1">
              Reservado em Ordens Limite: {reservedOrderKz.toLocaleString(undefined, { maximumFractionDigits: 2 })} KZ
            </div>
          )}
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
            <button 
              onClick={() => setActiveTab('limits')}
              className={cn("font-bold text-sm transition-colors relative py-2 uppercase tracking-widest", activeTab === 'limits' ? "text-market-green after:absolute after:bottom-[-25px] after:left-0 after:right-0 after:h-1 after:bg-market-green after:rounded-t-full" : "text-market-text-muted hover:text-white")}
            >
              Ordens Limite <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-1.5 py-0.5 rounded ml-1.5 border border-amber-500/20">{pendingOrdersCount}</span>
            </button>
          </div>
        </div>
        
        <div className="market-table-container">
          {activeTab === 'positions' ? (
            <table className="market-table text-xs">
              <thead>
                <tr>
                  <th className="market-table-header text-left">Mercado</th>
                  <th className="market-table-header text-center">Previsão</th>
                  <th className="market-table-header text-center font-mono">Quantidade</th>
                  <th className="market-table-header text-center">Preço Médio</th>
                  <th className="market-table-header text-center">Preço Atual</th>
                  <th className="market-table-header text-right">Valor Investido</th>
                  <th className="market-table-header text-right">Valor Atual</th>
                  <th className="market-table-header text-right">Lucro (KZ)</th>
                  <th className="market-table-header text-center">ROI (%)</th>
                  <th className="market-table-header text-right">Max Possível</th>
                  <th className="market-table-header text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {user.positions.length > 0 ? user.positions.map((pos, i) => {
                  const market = markets.find(m => m.id === pos.market_id);
                  const currentPrice = pos.outcome === 'Yes' ? market?.yes_price : market?.no_price;
                  
                  const quantidade = pos.shares || 0;
                  const precoMedio = (pos.avg_price || 0) * 100;
                  const precoAtual = (currentPrice || 0) * 100;
                  
                  const valorInvestido = quantidade * (pos.avg_price || 0);
                  const valorAtual = quantidade * (currentPrice || 0);
                  const lucroKZ = valorAtual - valorInvestido;
                  const roi = valorInvestido > 0 ? (lucroKZ / valorInvestido) * 100 : 0;
                  const maxPossible = quantidade * 1.0; // pays 1.00 KZ per share
                  
                  const isResolved = market?.resolved || false;
                  const hasWon = isResolved && market?.resolution_outcome === pos.outcome;
                  
                  const estadoLabel = isResolved 
                    ? (hasWon ? 'Ganhou (Liquidado)' : 'Perdeu (Liquidado)') 
                    : 'Ativo';

                  return (
                    <tr key={i} className="hover:bg-market-card-lighter transition-colors">
                      <td className="market-table-cell">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-white line-clamp-1 max-w-[200px]">
                            {market?.question || 'Mercado Desconhecido'}
                          </span>
                          <span className="text-[9px] text-market-text-muted font-mono">ID: {pos.market_id?.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="market-table-cell text-center">
                        <span className={cn("market-badge font-black uppercase text-[9px]", pos.outcome === 'Yes' ? "bg-market-green/10 text-market-green border border-market-green/20" : "bg-market-red/10 text-market-red border border-market-red/20")}>
                          {pos.outcome === 'Yes' ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="market-table-cell text-center font-mono font-bold text-white">{quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                      <td className="market-table-cell text-center font-mono text-market-text-muted">{precoMedio.toFixed(1)} KZ</td>
                      <td className="market-table-cell text-center font-mono font-bold text-white">{precoAtual.toFixed(1)} KZ</td>
                      <td className="market-table-cell text-right font-mono text-market-text-muted">{valorInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KZ</td>
                      <td className="market-table-cell text-right font-mono font-bold text-white">{valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KZ</td>
                      <td className="market-table-cell text-right font-mono font-bold">
                        <span className={lucroKZ >= 0 ? "text-market-green" : "text-market-red"}>
                          {lucroKZ >= 0 ? '+' : ''}{lucroKZ.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KZ
                        </span>
                      </td>
                      <td className="market-table-cell text-center font-mono">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", roi >= 0 ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red")}>
                          {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </span>
                      </td>
                      <td className="market-table-cell text-right font-mono font-bold text-[#0095FF]">{maxPossible.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KZ</td>
                      <td className="market-table-cell text-center font-bold">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] uppercase font-black",
                          estadoLabel === 'Ativo' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                          estadoLabel.startsWith('Ganhou') && "bg-market-green/25 text-market-green border border-market-green/40",
                          estadoLabel.startsWith('Perdeu') && "bg-market-red/25 text-market-red border border-market-red/40"
                        )}>
                          {estadoLabel}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-xs text-market-text-muted italic">
                      Nenhuma posição ativa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : activeTab === 'history' ? (
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
                  const isBuy = trade.side === 'Compra' || trade.side === 'Buy';
                  const isYes = trade.outcome === 'Sim' || trade.outcome === 'Yes';
                  return (
                    <tr key={trade.id} className="hover:bg-market-card-lighter transition-colors">
                      <td className="market-table-cell">
                        <span className="font-bold text-white line-clamp-1 max-w-[300px]">{market?.question || 'Mercado Desconhecido'}</span>
                      </td>
                      <td className="market-table-cell text-center">
                        <span className={cn("font-bold", isBuy ? "text-market-green" : "text-market-red")}>
                          {isBuy ? 'Compra' : 'Venda'}
                        </span>
                      </td>
                      <td className="market-table-cell text-center">
                        <span className={cn("market-badge", isYes ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red")}>
                          {isYes ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="market-table-cell text-center font-mono font-bold text-white">{Number(trade.amount || 0).toLocaleString()} KZ</td>
                      <td className="market-table-cell text-center font-mono text-market-text-muted">{Math.round((trade.price || 0) * 100)} KZ</td>
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
          ) : (
            <table className="market-table">
              <thead>
                <tr>
                  <th className="market-table-header">Mercado</th>
                  <th className="market-table-header text-center">Lado</th>
                  <th className="market-table-header text-center">Resultado</th>
                  <th className="market-table-header text-right">Preço Limite</th>
                  <th className="market-table-header text-right">Valor Pendente</th>
                  <th className="market-table-header text-center">Estado</th>
                  <th className="market-table-header text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-market-border">
                {limitOrders.length > 0 ? limitOrders.map((order, idx) => {
                  const market = markets.find(m => m.id === order.market_id);
                  const isOpen = order.status === 'OPEN' || order.status === 'PARTIAL';
                  const pendingAmountKz = ((order.remaining_quantity || 0) * (order.price_cents || 0)) / 100;
                  return (
                    <tr key={order.id || idx} className="hover:bg-market-card-lighter transition-colors">
                      <td className="market-table-cell">
                        <span className="font-bold text-white line-clamp-1 max-w-[300px]">{market?.question || order.market_id || 'Mercado Desconhecido'}</span>
                      </td>
                      <td className="market-table-cell text-center">
                        <span className={cn("font-bold", order.side === 'Buy' ? "text-market-green" : "text-market-red")}>
                          {order.side === 'Buy' ? 'Compra' : 'Venda'}
                        </span>
                      </td>
                      <td className="market-table-cell text-center animate-fade-in">
                        <span className={cn("market-badge", order.outcome === 'Yes' ? "bg-market-green/10 text-market-green" : "bg-market-red/10 text-market-red")}>
                          {order.outcome === 'Yes' ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="market-table-cell text-right font-mono font-bold text-white">{order.price_cents} KZ</td>
                      <td className="market-table-cell text-right font-mono font-bold text-market-green">
                        {pendingAmountKz.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} KZ ({order.remaining_quantity}/{order.quantity})
                      </td>
                      <td className="market-table-cell text-center font-black uppercase text-[10px]">
                        <span className={cn(
                          "px-2 py-0.5 rounded",
                          isOpen && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                          order.status === 'FILLED' && "bg-market-green/10 text-market-green border border-market-green/20",
                          order.status === 'CANCELLED' && "bg-[#2A2B30] text-market-text-muted"
                        )}>
                          {order.status === 'OPEN' ? 'Pendente' : order.status === 'PARTIAL' ? 'Parcial' : order.status === 'FILLED' ? 'Executada' : 'Cancelada'}
                        </span>
                      </td>
                      <td className="market-table-cell text-right">
                        {isOpen && (
                          <button
                            onClick={async () => {
                              if (window.confirm("Deseja cancelar esta ordem limite CLOB e libertar os fundos/quotas reservados?")) {
                                try {
                                  await ammApi.cancelClobOrder(order.id);
                                  addToast("Ordem limite cancelada e fundos libertados!", "success");
                                  await loadClobPortfolio();
                                } catch (err: any) {
                                  addToast(err.message, "error");
                                }
                              }
                            }}
                            className="px-2.5 py-1 bg-market-red/10 hover:bg-market-red/20 text-market-red text-[9px] font-black uppercase tracking-widest rounded transition-all border border-market-red/20 cursor-pointer active:scale-95"
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-market-text-muted italic">
                      Nenhuma ordem limite registrada.
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

const ResetPasswordPage = ({ addToast }: { addToast: (msg: string, type?: 'success' | 'error') => void }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // In Firebase, password reset is usually done via a link sent to email
      // But if the user is already logged in and we have a reset token (from URL), 
      // we could use confirmPasswordReset. For simplicity here:
      addToast("Funcionalidade em manutenção. Por favor, use 'Esqueci a Password' no Login.");
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

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      let [catData, postsData] = await Promise.all([
        firebaseService.getCategories(),
        firebaseService.getPosts()
      ]);
      
      if (!catData || catData.length === 0) {
        // Fallback or seed default categories
        const defaultNames = ['Finanças', 'Angola', 'Crypto', 'Desporto', 'Política', 'Economia', 'Tech'];
        const defaultIcons = ['TrendingUp', 'Map', 'Coins', 'Activity', 'Award', 'Globe', 'Cpu'];
        const mockCategories = defaultNames.map((name, index) => ({
          id: `default_${index}`,
          name,
          icon: defaultIcons[index] || 'Globe',
          status: 'active' as const,
          order: index
        }));

        try {
          // Attempt to physically seed categories in Firestore
          for (let i = 0; i < defaultNames.length; i++) {
            await firebaseService.createCategory({
              name: defaultNames[i],
              icon: defaultIcons[i],
              status: 'active',
              order: i
            });
          }
          catData = await firebaseService.getCategories();
        } catch (err) {
          console.warn('Silent fallback to local mock categories list, write block expected for non-admins:', err);
          catData = mockCategories;
        }
      }
      
      setCategories(catData);
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    let unsubscribeUserProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (unsubscribeUserProfile) {
          unsubscribeUserProfile();
          unsubscribeUserProfile = null;
        }

        if (firebaseUser) {
          // Subscribe to real-time user profile updates for balance, admin rights, and positions
          unsubscribeUserProfile = firebaseService.subscribeToUser(firebaseUser.uid, (updatedProfile) => {
            if (updatedProfile) {
              setUser(updatedProfile);
            }
          });

          // Pre-fetch profile or create profile if it doesn't exist
          const profile = await firebaseService.getUserProfile(firebaseUser.uid);
          if (!profile) {
            const newProfile = await firebaseService.createUserProfile(firebaseUser.uid, {
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Utilizador',
              email: firebaseUser.email || '',
              balance: 1000,
              is_admin: firebaseUser.email?.toLowerCase() === 'evaristopaulocassoma00@gmail.com',
              status: 'active',
              positions: []
            });
            setUser(newProfile);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      }
    });

    const unsubscribeMarkets = firebaseService.subscribeToMarkets((updatedMarkets) => {
      setMarkets(updatedMarkets.length > 0 ? updatedMarkets : MOCK_MARKETS);
    });

    const unsubscribeTrades = firebaseService.subscribeToAllTrades((tradesData) => {
      setTrades(tradesData.map(t => ({
        ...t,
        time: formatDistanceToNow(new Date(t.timestamp), { addSuffix: true })
      })));
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMarkets();
      unsubscribeTrades();
      if (unsubscribeUserProfile) {
        unsubscribeUserProfile();
      }
    };
  }, []);

  const navigate = useNavigate();

  const handleTrade = async (tradeData: any) => {
    if (!tradeData) return;

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

    const targetMarket = markets.find(m => m.id === tradeData.market_id);
    if (targetMarket) {
      if (targetMarket.status === 'blocked') {
        addToast("Este mercado está temporariamente bloqueado para apostas.", "error");
        return;
      }
      if (targetMarket.is_multi || targetMarket.category === 'Desportos') {
        addToast("Negociação rápida disponível apenas para mercados binários (Sim/Não) no motor CLOB+AMM.", "error");
        return;
      }
      const categoryObj = categories.find(c => c.name === targetMarket.category);
      if (categoryObj && categoryObj.status === 'blocked') {
        addToast("As apostas nesta categoria estão temporariamente bloqueadas.", "error");
        return;
      }
    }

    try {
      const res = await ammApi.placeClobOrder({
        marketId: tradeData.market_id,
        side: tradeData.side === 'Sell' ? 'Sell' : 'Buy',
        outcome: tradeData.outcome === 'No' ? 'No' : 'Yes',
        orderType: 'MARKET',
        budgetKz: tradeData.side === 'Sell' ? undefined : amount,
        quantity: tradeData.side === 'Sell' ? Math.floor(amount) : undefined,
        priceCents: tradeData.side === 'Sell' ? 1 : undefined,
      });
      if (!res.filledQuantity || res.filledQuantity <= 0) {
        addToast("Sem liquidez imediata no livro CLOB. Abra o mercado para colocar uma Ordem Limite.", "error");
        return;
      }
      addToast("Negócio efetuado no motor CLOB + AMM com sucesso!");
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
                    addToast={addToast}
                  />
                </motion.div>
              } />
              <Route path="/dashboard" element={
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {user ? <Dashboard user={user} /> : <LoginPage onLogin={setUser} />}
                </motion.div>
              } />
              <Route path="/ebook" element={
                <motion.div
                  key="ebook"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <EbookView markets={markets} />
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
                  <MarketDetailPage markets={markets} user={user} onTrade={handleTrade} trades={trades} addToast={addToast} categories={categories} />
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
                  <PortfolioPage user={user} trades={trades} markets={markets} addToast={addToast} />
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
                  <ResetPasswordPage addToast={addToast} />
                </motion.div>
              } />
              <Route path="/profile" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <UserProfile user={user} onLogout={() => { setUser(null); addToast("Sessão terminada."); }} markets={markets} />
                </motion.div>
              } />
              <Route path="/criar-mercado" element={
                <motion.div
                  key="criar-mercado"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {user ? (
                    <CreateMarketPage 
                      user={user} 
                      categories={categories} 
                      markets={markets} 
                      addToast={addToast} 
                      onRefreshData={fetchInitialData} 
                      setActiveTab={(tab) => {}} 
                    />
                  ) : (
                    <LoginPage onLogin={(u) => { setUser(u); addToast("Login efetuado com sucesso!"); }} />
                  )}
                </motion.div>
              } />
              <Route path="/admin/*" element={
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <AdminDashboard user={user} markets={markets} trades={trades} addToast={addToast} />
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

        <BackToTop />
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
