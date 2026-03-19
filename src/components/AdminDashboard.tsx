import React, { useState, useEffect } from 'react';
import { User, Market } from '../types';
import { 
  Shield, Users, AlertTriangle, Settings, Edit, Trash2, Ban, 
  CheckCircle, XCircle, ArrowDownToLine, ArrowUpFromLine, 
  Activity, Loader2, Plus, Filter, Search, DollarSign, 
  TrendingUp, TrendingDown, Clock, Eye, Globe, Gavel, 
  Droplets, Bitcoin, Trophy, Cpu, Music, LayoutGrid, List,
  BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  History, Lock, Unlock, Percent, Wallet, Info
} from 'lucide-react';
import { supabase } from '../supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import { Category } from '../types';
import { CountdownTimer } from './CountdownTimer';

const CategoryIcon = ({ name, className }: { name: string, className?: string }) => {
  switch (name) {
    case 'Política': return <Gavel className={className} />;
    case 'Economia': return <TrendingUp className={className} />;
    case 'Petróleo': return <Droplets className={className} />;
    case 'Crypto': return <Bitcoin className={className} />;
    case 'Desporto': return <Trophy className={className} />;
    case 'Tech': return <Cpu className={className} />;
    case 'Cultura': return <Music className={className} />;
    default: return <Globe className={className} />;
  }
};

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export const AdminDashboard = ({ user: currentUser, markets: initialMarkets, trades }: { user: User | null, markets: Market[], trades: any[] }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>(initialMarkets);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [analysisData, setAnalysisData] = useState<any>({
    volumeHistory: [],
    categoryDistribution: [],
    userGrowth: []
  });
  const [platformSettings, setPlatformSettings] = useState({
    tradingFee: 2.5,
    minDeposit: 1000,
    minWithdrawal: 5000,
    maintenanceMode: false,
    platformName: 'MarketPay'
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  
  // Modals
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedMarkets = async () => {
    setIsSeeding(true);
    try {
      const { MOCK_MARKETS } = await import('../constants');
      
      // Filter out markets that might already exist to avoid duplicates if IDs are fixed
      // Or just insert them all if we want to force it (might fail on PK)
      for (const market of MOCK_MARKETS) {
        const { error } = await supabase.from('markets').upsert({
          id: market.id,
          question: market.question,
          category: market.category,
          description: market.description || '',
          image_url: market.image_url,
          yes_price: market.is_multi ? 0 : 0.5,
          no_price: market.is_multi ? 0 : 0.5,
          pool_yes: market.is_multi ? 0 : 1000,
          pool_no: market.is_multi ? 0 : 1000,
          volume: market.volume,
          resolved: false,
          status: 'active',
          tags: market.tags,
          end_date: market.end_date,
          is_multi: market.is_multi,
          outcomes: market.outcomes
        }, { onConflict: 'id' });
        
        if (error) {
          console.error(`Error seeding market ${market.id}:`, error);
        }
      }
      
      showToast('Mercados semeados com sucesso!');
      fetchData();
    } catch (error: any) {
      showToast('Erro ao semear mercados: ' + error.message, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', icon: 'Globe' });
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'Geral',
    image_url: 'https://picsum.photos/seed/post/800/400',
    status: 'published'
  });

  // Financial Stats
  const [stats, setStats] = useState({
    totalVolume: 0,
    totalFees: 0,
    totalUsers: 0,
    pendingWithdrawals: 0,
    siteProfit: 0
  });

  useEffect(() => {
    if (currentUser?.is_admin) {
      fetchData();
      calculateStats();
      if (activeTab === 'analysis') {
        fetchAnalysisData();
      }
      if (activeTab === 'settings') {
        fetchSettings();
      }
    }
  }, [currentUser, activeTab]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('platform_settings').select('*').single();
      if (data && !error) {
        setPlatformSettings(data);
      }
      
      // Also fetch audit logs
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setAuditLogs(logs || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchAnalysisData = async () => {
    try {
      // 1. Volume History (Last 7 days)
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(new Date(), i);
        return format(date, 'yyyy-MM-dd');
      }).reverse();

      const { data: tradesData } = await supabase
        .from('trades')
        .select('created_at, amount')
        .gte('created_at', subDays(new Date(), 7).toISOString());

      const volumeHistory = last7Days.map(date => {
        const dayTrades = tradesData?.filter(t => t.created_at.startsWith(date)) || [];
        const volume = dayTrades.reduce((acc, t) => acc + t.amount, 0);
        return { date: format(new Date(date), 'dd/MM'), volume };
      });

      // 2. Category Distribution
      const categoryCounts = markets.reduce((acc: any, m) => {
        acc[m.category] = (acc[m.category] || 0) + 1;
        return acc;
      }, {});
      const categoryDistribution = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

      // 3. User Growth
      const { data: usersData } = await supabase
        .from('users')
        .select('created_at')
        .order('created_at', { ascending: true });
      
      const userGrowth = last7Days.map(date => {
        const count = usersData?.filter(u => u.created_at <= endOfDay(new Date(date)).toISOString()).length || 0;
        return { date: format(new Date(date), 'dd/MM'), count };
      });

      setAnalysisData({ volumeHistory, categoryDistribution, userGrowth });
    } catch (error) {
      console.error('Error fetching analysis data:', error);
    }
  };

  const calculateStats = async () => {
    try {
      const { data: marketsData } = await supabase.from('markets').select('volume');
      const { data: usersData } = await supabase.from('users').select('id');
      const { data: financeData } = await supabase.from('finance_requests').select('amount').eq('status', 'pending').eq('type', 'withdrawal');
      const { data: tradesData } = await supabase.from('trades').select('fee');
      
      const volume = marketsData?.reduce((acc, m) => acc + m.volume, 0) || 0;
      const fees = tradesData?.reduce((acc, t) => acc + (t.fee || 0), 0) || 0;
      
      setStats({
        totalVolume: volume,
        totalFees: fees,
        totalUsers: usersData?.length || 0,
        pendingWithdrawals: financeData?.reduce((acc, r) => acc + r.amount, 0) || 0,
        siteProfit: fees
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data, error } = await supabase.from('users').select('*').order('name');
        if (error) throw error;
        setUsers(data || []);
      } else if (activeTab === 'markets') {
        const { data, error } = await supabase.from('markets').select('*').order('volume', { ascending: false });
        if (error) throw error;
        if (data && data.length > 0) {
          setMarkets(data);
        } else {
          const { MOCK_MARKETS } = await import('../constants');
          setMarkets(MOCK_MARKETS);
        }
      } else if (activeTab === 'finance') {
        const { data, error } = await supabase.from('finance_requests').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setRequests(data || []);
      } else if (activeTab === 'verification') {
        const { data, error } = await supabase.from('users').select('*').eq('status', 'pending_verification');
        if (error) throw error;
        setUsers(data || []);
      } else if (activeTab === 'categories') {
        const { data, error } = await supabase.from('categories').select('*').order('order');
        if (error) throw error;
        setCategories(data || []);
      } else if (activeTab === 'posts') {
        const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const logAdminAction = async (action: string, details: string) => {
    try {
      await supabase.from('audit_logs').insert({
        admin_id: currentUser?.id,
        action,
        details,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('platform_settings').upsert(platformSettings);
      if (error) throw error;
      logAdminAction('update_settings', 'Updated platform settings');
      showToast('Configurações atualizadas com sucesso!');
    } catch (error: any) {
      showToast('Erro ao atualizar configurações: ' + error.message, 'error');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editingUser.name,
          balance: editingUser.balance,
          status: editingUser.status,
          is_admin: editingUser.is_admin,
          blocked_markets: editingUser.blocked_markets
        })
        .eq('id', editingUser.id);
      
      if (error) throw error;
      logAdminAction('update_user', `Updated user ${editingUser.name} (${editingUser.id})`);
      setEditingUser(null);
      fetchData();
      showToast('Utilizador atualizado com sucesso!');
    } catch (error) {
      showToast('Erro ao atualizar utilizador', 'error');
    }
  };

  const handleUpdateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMarket) return;

    try {
      const { error } = await supabase
        .from('markets')
        .update({
          question: editingMarket.question,
          category: editingMarket.category,
          end_date: editingMarket.end_date,
          status: editingMarket.status,
          description: editingMarket.description
        })
        .eq('id', editingMarket.id);
      
      if (error) throw error;
      setEditingMarket(null);
      fetchData();
      showToast('Mercado atualizado com sucesso!');
    } catch (error) {
      showToast('Erro ao atualizar mercado', 'error');
    }
  };

  const handleBlockUser = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', userId);
    if (!error) fetchData();
  };

  const handleResolveMarket = async (marketId: string, outcome: string) => {
    setConfirmModal({
      title: 'Resolver Mercado',
      message: `Tem certeza que deseja resolver este mercado como "${outcome}"? Esta ação é irreversível.`,
      onConfirm: async () => {
        try {
          // 1. Mark market as resolved
          const { error: marketError } = await supabase
            .from('markets')
            .update({ resolved: true, resolution_outcome: outcome, status: 'resolved' })
            .eq('id', marketId);
          
          if (marketError) throw marketError;

          // 2. Pay out winners
          // For multi-option, we need to calculate the payout based on shares
          // In this model, 1 share = 1000 KZ if correct (fixed payout model)
          const { data: positions, error: posError } = await supabase
            .from('positions')
            .select('*')
            .eq('market_id', marketId)
            .eq('outcome', outcome);
          
          if (posError) throw posError;

          if (positions && positions.length > 0) {
            for (const pos of positions) {
              const payout = pos.shares * 1000; // 1 share = 1000 KZ payout
              const { data: userData } = await supabase.from('users').select('balance').eq('id', pos.user_id).single();
              if (userData) {
                await supabase.from('users').update({ balance: userData.balance + payout }).eq('id', pos.user_id);
              }
            }
          }

          fetchData();
          showToast('Mercado resolvido com sucesso!');
        } catch (error) {
          console.error('Error resolving market:', error);
          showToast('Erro ao resolver mercado', 'error');
        }
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteMarket = async (marketId: string) => {
    setConfirmModal({
      title: 'Eliminar Mercado',
      message: 'Tem certeza que deseja eliminar este mercado?',
      onConfirm: async () => {
        const { error } = await supabase.from('markets').delete().eq('id', marketId);
        if (!error) {
          fetchData();
          showToast('Mercado eliminado!');
        } else {
          showToast('Erro ao eliminar mercado', 'error');
        }
        setConfirmModal(null);
      }
    });
  };

  const [newMarket, setNewMarket] = useState({
    question: '',
    category: 'Geral',
    description: '',
    image_url: 'https://picsum.photos/seed/market/800/400',
    end_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
    is_multi: false,
    outcomes: [
      { id: '1', name: 'Opção 1', price: 0.5, pool: 1000 },
      { id: '2', name: 'Opção 2', price: 0.5, pool: 1000 }
    ]
  });

  const handleCreateMarketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalPool = newMarket.is_multi 
        ? newMarket.outcomes.reduce((acc, o) => acc + o.pool, 0)
        : 2000;

      const { error } = await supabase.from('markets').insert({
        question: newMarket.question,
        category: newMarket.category,
        description: newMarket.description,
        image_url: newMarket.image_url,
        yes_price: newMarket.is_multi ? 0 : 0.5,
        no_price: newMarket.is_multi ? 0 : 0.5,
        pool_yes: newMarket.is_multi ? 0 : 1000,
        pool_no: newMarket.is_multi ? 0 : 1000,
        volume: totalPool,
        resolved: false,
        status: 'active',
        tags: [newMarket.category],
        end_date: new Date(newMarket.end_date).toISOString(),
        is_multi: newMarket.is_multi,
        outcomes: newMarket.is_multi ? newMarket.outcomes : null
      });

      if (error) throw error;
      setShowCreateMarket(false);
      setNewMarket({
        question: '',
        category: 'Geral',
        description: '',
        image_url: 'https://picsum.photos/seed/market/800/400',
        end_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
        is_multi: false,
        outcomes: [
          { id: '1', name: 'Opção 1', price: 0.5, pool: 1000 },
          { id: '2', name: 'Opção 2', price: 0.5, pool: 1000 }
        ]
      });
      fetchData();
      showToast('Mercado criado com sucesso!');
    } catch (error: any) {
      console.error('Error creating market:', error);
      showToast('Erro ao criar mercado: ' + error.message, 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('categories').insert([newCategory]);
      if (error) throw error;
      setShowCreateCategory(false);
      setNewCategory({ name: '', icon: 'Globe' });
      fetchData();
      showToast('Categoria criada com sucesso!');
    } catch (error: any) {
      showToast('Erro ao criar categoria: ' + error.message, 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setConfirmModal({
      title: 'Eliminar Categoria',
      message: 'Tem a certeza que deseja eliminar esta categoria?',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) throw error;
          fetchData();
          showToast('Categoria eliminada com sucesso!');
        } catch (error: any) {
          showToast('Erro ao eliminar categoria: ' + error.message, 'error');
        }
        setConfirmModal(null);
      }
    });
  };

  const handleApproveFinance = async (request: any) => {
    try {
      // 1. Update request status
      const { error: reqError } = await supabase.from('finance_requests').update({ status: 'approved' }).eq('id', request.id);
      if (reqError) throw reqError;

      // 2. Update user balance
      const { data: userData, error: userFetchError } = await supabase.from('users').select('balance').eq('id', request.user_id).single();
      if (userFetchError) throw userFetchError;

      const newBalance = request.type === 'deposit' 
        ? userData.balance + request.amount 
        : userData.balance - request.amount;

      const { error: balanceError } = await supabase.from('users').update({ balance: newBalance }).eq('id', request.user_id);
      if (balanceError) throw balanceError;

      fetchData();
    } catch (error) {
      console.error('Error approving finance:', error);
    }
  };

  const handleRejectFinance = async (requestId: string) => {
    const { error } = await supabase.from('finance_requests').update({ status: 'rejected' }).eq('id', requestId);
    if (!error) fetchData();
  };

  const handleApproveVerification = async (userId: string) => {
    const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', userId);
    if (!error) fetchData();
  };

  const handleRejectVerification = async (userId: string) => {
    const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', userId); // For now just set back to active or maybe 'unverified'
    if (!error) fetchData();
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('posts').insert([newPost]);
      if (error) throw error;
      setShowCreatePost(false);
      setNewPost({ title: '', content: '', category: 'Geral', image_url: 'https://picsum.photos/seed/post/800/400', status: 'published' });
      fetchData();
      showToast('Publicação criada com sucesso!');
    } catch (error: any) {
      showToast('Erro ao criar publicação: ' + error.message, 'error');
    }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    try {
      const { error } = await supabase.from('posts').update({
        title: editingPost.title,
        content: editingPost.content,
        category: editingPost.category,
        image_url: editingPost.image_url,
        status: editingPost.status
      }).eq('id', editingPost.id);
      if (error) throw error;
      setEditingPost(null);
      fetchData();
      showToast('Publicação atualizada!');
    } catch (error: any) {
      showToast('Erro ao atualizar publicação: ' + error.message, 'error');
    }
  };

  const handleDeletePost = async (id: string) => {
    setConfirmModal({
      title: 'Eliminar Publicação',
      message: 'Tem certeza que deseja eliminar esta publicação?',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('posts').delete().eq('id', id);
          if (error) throw error;
          fetchData();
          showToast('Publicação eliminada!');
        } catch (error: any) {
          showToast('Erro ao eliminar publicação: ' + error.message, 'error');
        }
        setConfirmModal(null);
      }
    });
  };

  const handleBlockPost = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'published' : 'blocked';
    try {
      const { error } = await supabase.from('posts').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      fetchData();
      showToast(`Publicação ${newStatus === 'blocked' ? 'bloqueada' : 'desbloqueada'} com sucesso!`);
    } catch (error: any) {
      showToast('Erro ao alterar status da publicação: ' + error.message, 'error');
    }
  };

  if (!currentUser?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-16 h-16 text-market-red mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-market-text-muted">Não tem permissões para aceder a esta página.</p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMarkets = markets.filter(m => 
    m.question.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-market-green/10 flex items-center justify-center border border-market-green/20 shadow-lg shadow-market-green/5">
            <Shield className="w-8 h-8 text-market-green" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Painel de Administração</h1>
            <p className="text-market-text-muted text-sm font-medium mt-1">Controlo total e análise da plataforma MarketPay</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={handleSeedMarkets}
            disabled={isSeeding}
            className="market-button-outline flex items-center gap-2 px-6 py-3 disabled:opacity-50"
          >
            {isSeeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <History className="w-5 h-5" />}
            Semear Mercados
          </button>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-market-text-muted group-focus-within:text-market-green transition-colors" />
            <input 
              type="text" 
              placeholder="Pesquisar utilizadores, mercados..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="market-input pl-12 py-3 w-full md:w-80 focus:ring-2 focus:ring-market-green/20"
            />
          </div>
          <button 
            onClick={() => setShowCreateMarket(true)}
            className="market-button-primary flex items-center gap-2 px-8 py-3 shadow-xl shadow-market-green/20 hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" /> Novo Mercado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Volume Total', value: `${stats.totalVolume.toLocaleString()} KZ`, icon: Activity, color: 'text-market-green', bg: 'bg-market-green/5' },
          { label: 'Lucro do Site', value: `${stats.totalFees.toLocaleString()} KZ`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-400/5' },
          { label: 'Utilizadores', value: stats.totalUsers.toString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/5' },
          { label: 'Levantamentos', value: `${stats.pendingWithdrawals.toLocaleString()} KZ`, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-400/5' },
        ].map((stat, i) => (
          <div key={i} className="market-card p-8 border-t-2 border-t-transparent hover:border-t-market-green transition-all group hover:-translate-y-1">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] font-black text-market-text-muted uppercase tracking-[0.2em]">{stat.label}</span>
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <div className="text-3xl font-black text-white group-hover:text-market-green transition-colors">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-4 overflow-x-auto pb-4 no-scrollbar border-b border-market-border/50">
        {[
          { id: 'users', label: 'Utilizadores', icon: Users },
          { id: 'markets', label: 'Mercados', icon: Activity },
          { id: 'categories', label: 'Categorias', icon: LayoutGrid },
          { id: 'posts', label: 'Publicações', icon: List },
          { id: 'finance', label: 'Finanças', icon: DollarSign },
          { id: 'verification', label: 'Verificações', icon: Shield },
          { id: 'analysis', label: 'Análise', icon: BarChart3 },
          { id: 'settings', label: 'Definições', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-market-green text-market-bg shadow-2xl shadow-market-green/30 scale-105' 
                : 'bg-market-card/50 text-market-text-muted hover:text-white hover:bg-market-card border border-market-border/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-400/10 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Gestão de Utilizadores</h3>
                  <p className="text-xs text-market-text-muted">Administração de contas, saldos e permissões</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="market-button-outline px-4 py-2 text-xs flex items-center gap-2">
                  <Filter className="w-3 h-3" /> Filtrar
                </button>
              </div>
            </div>

            <div className="market-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="market-table">
                  <thead>
                    <tr className="bg-market-card-lighter/20">
                      <th className="market-table-header py-4">Utilizador</th>
                      <th className="market-table-header py-4">Email</th>
                      <th className="market-table-header text-right py-4">Saldo</th>
                      <th className="market-table-header text-center py-4">Status</th>
                      <th className="market-table-header text-right py-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-market-border">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-market-card-lighter/50 transition-colors group">
                        <td className="market-table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-market-card-lighter flex items-center justify-center text-market-green font-black uppercase border border-market-border shadow-inner">
                              {u.name[0]}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white group-hover:text-market-green transition-colors">{u.name}</span>
                                {u.is_admin && (
                                  <span className="px-1.5 py-0.5 bg-market-green/10 text-market-green text-[8px] font-black uppercase tracking-tighter rounded border border-market-green/20">Admin</span>
                                )}
                              </div>
                              <span className="text-[10px] text-market-text-muted font-mono">{u.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                        <td className="market-table-cell">
                          <span className="text-market-text-muted text-sm">{u.email}</span>
                        </td>
                        <td className="market-table-cell text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-white">{u.balance.toLocaleString()} KZ</span>
                            <span className="text-[10px] text-market-text-muted">Saldo Disponível</span>
                          </div>
                        </td>
                        <td className="market-table-cell text-center">
                          <span className={`market-badge px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            u.status === 'active' ? 'bg-market-green/10 text-market-green border-market-green/20' :
                            u.status === 'pending_verification' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                            'bg-market-red/10 text-market-red border-market-red/20'
                          }`}>
                            {u.status === 'active' ? 'Ativo' : u.status === 'pending_verification' ? 'Pendente' : 'Bloqueado'}
                          </span>
                        </td>
                        <td className="market-table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => setEditingUser(u)}
                              className="p-2 hover:bg-market-card rounded-xl text-market-text-muted hover:text-white transition-all hover:scale-110"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleBlockUser(u.id, u.status || 'active')}
                              className={cn(
                                "p-2 hover:bg-market-card rounded-xl transition-all hover:scale-110 border",
                                u.status === 'blocked' 
                                  ? "text-market-green border-market-green/10 hover:bg-market-green/10" 
                                  : "text-market-red border-market-red/10 hover:bg-market-red/10"
                              )}
                              title={u.status === 'blocked' ? "Desbloquear" : "Bloquear"}
                            >
                              {u.status === 'blocked' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
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
        )}

        {activeTab === 'markets' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-market-green/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-market-green" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Gestão de Mercados</h3>
                  <p className="text-xs text-market-text-muted">Controle e resolução de todos os mercados ativos e passados</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateMarket(true)}
                className="market-button-primary flex items-center gap-2 px-6 py-2.5 text-sm"
              >
                <Plus className="w-4 h-4" /> Novo Mercado
              </button>
            </div>

            <div className="market-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="market-table">
                  <thead>
                    <tr className="bg-market-card-lighter/20">
                      <th className="market-table-header py-4">Mercado</th>
                      <th className="market-table-header py-4">Categoria</th>
                      <th className="market-table-header text-right py-4">Volume</th>
                      <th className="market-table-header text-center py-4">Status</th>
                      <th className="market-table-header text-center py-4">Resultado</th>
                      <th className="market-table-header text-center py-4">Expira</th>
                      <th className="market-table-header text-right py-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-market-border">
                    {filteredMarkets.map((m) => (
                      <tr key={m.id} className="hover:bg-market-card-lighter/50 transition-colors group">
                        <td className="market-table-cell">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <img src={m.image_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-market-border" referrerPolicy="no-referrer" />
                              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-market-card ${!m.resolved ? 'bg-market-green' : 'bg-market-text-muted'}`} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-white group-hover:text-market-green transition-colors line-clamp-1 max-w-[300px]">{m.question}</span>
                              <span className="text-[10px] text-market-text-muted font-bold uppercase tracking-widest truncate">ID: {m.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                        <td className="market-table-cell">
                          <span className="px-2 py-1 bg-market-card-lighter rounded-lg text-[10px] font-black text-market-text-muted uppercase tracking-widest border border-market-border">
                            {m.category}
                          </span>
                        </td>
                        <td className="market-table-cell text-right font-mono font-bold text-white">
                          <div className="flex flex-col items-end">
                            <span>{m.volume.toLocaleString()} KZ</span>
                            <span className="text-[10px] text-market-text-muted font-normal">Total Negociado</span>
                          </div>
                        </td>
                        <td className="market-table-cell text-center">
                          <span className={`market-badge px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            !m.resolved ? 'bg-market-green/10 text-market-green border border-market-green/20' : 'bg-market-text-muted/10 text-market-text-muted border border-market-border'
                          }`}>
                            {!m.resolved ? 'Ativo' : 'Resolvido'}
                          </span>
                        </td>
                        <td className="market-table-cell text-center">
                          {m.resolved ? (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              m.resolution_outcome === 'Yes' ? 'bg-market-green/10 text-market-green border-market-green/20' : 
                              m.resolution_outcome === 'No' ? 'bg-market-red/10 text-market-red border-market-red/20' :
                              'bg-blue-400/10 text-blue-400 border-blue-400/20'
                            }`}>
                              {m.resolution_outcome}
                            </span>
                          ) : (
                            <span className="text-[10px] text-market-text-muted font-bold italic">Pendente</span>
                          )}
                        </td>
                        <td className="market-table-cell text-center">
                          <div className="flex flex-col items-center">
                            <CountdownTimer endDate={m.end_date} />
                            <span className="text-[9px] text-market-text-muted mt-1">{format(new Date(m.end_date), 'dd/MM/yyyy')}</span>
                          </div>
                        </td>
                        <td className="market-table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => setEditingMarket(m)}
                              className="p-2 hover:bg-market-card rounded-xl text-market-text-muted hover:text-white transition-all hover:scale-110"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {!m.resolved && (
                              <div className="flex gap-1 bg-market-card-lighter/30 p-1 rounded-xl border border-market-border/50">
                                {m.is_multi ? (
                                  <div className="flex flex-wrap gap-1 max-w-[200px] justify-end">
                                    {m.outcomes?.map(outcome => (
                                      <button 
                                        key={outcome.id}
                                        onClick={() => handleResolveMarket(m.id, outcome.name)}
                                        className="px-2 py-1 bg-market-green/10 text-market-green border border-market-green/20 rounded-lg text-[8px] font-bold hover:bg-market-green hover:text-market-bg transition-all uppercase tracking-widest"
                                      >
                                        {outcome.name}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => handleResolveMarket(m.id, 'Yes')}
                                      className="p-2 hover:bg-market-green hover:text-market-bg rounded-lg text-market-green transition-all hover:scale-110" 
                                      title="Resolver Sim"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleResolveMarket(m.id, 'No')}
                                      className="p-2 hover:bg-market-red hover:text-white rounded-lg text-market-red transition-all hover:scale-110" 
                                      title="Resolver Não"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                            <button 
                              onClick={() => handleDeleteMarket(m.id)}
                              className="p-2 hover:bg-market-red/10 rounded-xl text-market-text-muted hover:text-market-red transition-all hover:scale-110"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
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
        )}

        {activeTab === 'finance' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-400/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Pedidos Financeiros</h3>
                  <p className="text-xs text-market-text-muted">Gestão de depósitos e levantamentos pendentes</p>
                </div>
              </div>
            </div>

            <div className="market-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="market-table">
                  <thead>
                    <tr className="bg-market-card-lighter/20">
                      <th className="market-table-header py-4">Tipo</th>
                      <th className="market-table-header py-4">Utilizador</th>
                      <th className="market-table-header text-right py-4">Montante</th>
                      <th className="market-table-header text-center py-4">Data</th>
                      <th className="market-table-header text-center py-4">Status</th>
                      <th className="market-table-header text-right py-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-market-border">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-market-card-lighter/50 transition-colors group">
                        <td className="market-table-cell">
                          <div className={`flex items-center gap-2 font-bold px-3 py-1.5 rounded-xl border w-fit ${
                            req.type === 'deposit' 
                              ? 'text-market-green bg-market-green/5 border-market-green/10' 
                              : 'text-market-red bg-market-red/5 border-market-red/10'
                          }`}>
                            {req.type === 'deposit' ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                            <span className="text-[10px] uppercase tracking-widest">{req.type === 'deposit' ? 'Depósito' : 'Levantamento'}</span>
                          </div>
                        </td>
                        <td className="market-table-cell">
                          <div className="flex flex-col">
                            <span className="text-white font-medium">{req.userEmail || 'Utilizador Desconhecido'}</span>
                            <span className="text-[10px] text-market-text-muted font-mono">{req.user_id.slice(0, 8)}...</span>
                          </div>
                        </td>
                        <td className="market-table-cell text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-white text-base">{req.amount.toLocaleString()} KZ</span>
                            {req.proof_url && (
                              <a 
                                href={req.proof_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="flex items-center gap-1 text-[10px] text-market-green hover:underline mt-1"
                              >
                                <Eye className="w-3 h-3" /> Ver Comprovativo
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="market-table-cell text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-white text-xs">{format(new Date(req.created_at), 'dd/MM/yyyy')}</span>
                            <span className="text-[10px] text-market-text-muted">{format(new Date(req.created_at), 'HH:mm')}</span>
                          </div>
                        </td>
                        <td className="market-table-cell text-center">
                          <span className={`market-badge px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            req.status === 'pending' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                            req.status === 'approved' ? 'bg-market-green/10 text-market-green border-market-green/20' :
                            'bg-market-red/10 text-market-red border-market-red/20'
                          }`}>
                            {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                          </span>
                        </td>
                        <td className="market-table-cell text-right">
                          {req.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleApproveFinance(req)}
                                className="p-2 hover:bg-market-green hover:text-market-bg rounded-xl text-market-green transition-all hover:scale-110 border border-market-green/10"
                                title="Aprovar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleRejectFinance(req.id)}
                                className="p-2 hover:bg-market-red hover:text-white rounded-xl text-market-red transition-all hover:scale-110 border border-market-red/10"
                                title="Rejeitar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-market-green/10 rounded-lg">
                  <LayoutGrid className="w-5 h-5 text-market-green" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Gestão de Categorias</h3>
                  <p className="text-xs text-market-text-muted">Organize os mercados por temas e interesses</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateCategory(true)}
                className="market-button-primary flex items-center gap-2 px-6 py-2.5 text-sm"
              >
                <Plus className="w-4 h-4" /> Nova Categoria
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {categories.map(cat => (
                <div key={cat.id} className="market-card p-6 flex items-center justify-between group hover:border-market-green/30 transition-all hover:-translate-y-1">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-market-card-lighter flex items-center justify-center text-market-green border border-market-border group-hover:bg-market-green/10 transition-colors">
                      <CategoryIcon name={cat.name} className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white group-hover:text-market-green transition-colors">{cat.name}</h3>
                      <p className="text-[10px] text-market-text-muted font-mono uppercase tracking-widest">ID: {cat.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-2 text-market-text-muted hover:text-market-red transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-market-green/10 rounded-lg">
                  <Globe className="w-5 h-5 text-market-green" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Gestão de Publicações</h3>
                  <p className="text-xs text-market-text-muted">Notícias e atualizações da plataforma</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreatePost(true)}
                className="market-button-primary flex items-center gap-2 px-6 py-2.5 text-sm"
              >
                <Plus className="w-4 h-4" /> Nova Publicação
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <div key={post.id} className="market-card overflow-hidden group hover:border-market-green/30 transition-all hover:-translate-y-1">
                  <div className="relative h-48 overflow-hidden">
                    <img src={post.image_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-market-bg/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <span className="px-2 py-1 bg-market-card-lighter/80 backdrop-blur-sm rounded-lg text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                        {post.category}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        post.status === 'published' 
                          ? 'bg-market-green/20 text-market-green border-market-green/20' 
                          : 'bg-market-red/20 text-market-red border-market-red/20'
                      }`}>
                        {post.status === 'published' ? 'Publicado' : 'Bloqueado'}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <h3 className="text-lg font-bold text-white group-hover:text-market-green transition-colors line-clamp-1">{post.title}</h3>
                    <p className="text-sm text-market-text-muted line-clamp-2 leading-relaxed">{post.content}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-market-border">
                      <span className="text-[10px] text-market-text-muted font-mono">{format(new Date(post.created_at), 'dd/MM/yyyy')}</span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEditingPost(post)}
                          className="p-2 hover:bg-market-card rounded-xl text-market-text-muted hover:text-white transition-all hover:scale-110"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleBlockPost(post.id, post.status)}
                          className={cn(
                            "p-2 hover:bg-market-card rounded-xl transition-all hover:scale-110 border",
                            post.status === 'blocked' 
                              ? "text-market-green border-market-green/10 hover:bg-market-green/10" 
                              : "text-market-red border-market-red/10 hover:bg-market-red/10"
                          )}
                          title={post.status === 'blocked' ? "Desbloquear" : "Bloquear"}
                        >
                          {post.status === 'blocked' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleDeletePost(post.id)}
                          className="p-2 hover:bg-market-red/10 rounded-xl text-market-text-muted hover:text-market-red transition-all hover:scale-110"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="market-card p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <LineChartIcon className="w-5 h-5 text-market-green" />
                    Volume de Negociação (7 Dias)
                  </h3>
                  <span className="text-[10px] font-bold text-market-green bg-market-green/10 px-3 py-1 rounded-full uppercase tracking-widest">Tempo Real</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analysisData.volumeHistory}>
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        itemStyle={{ color: '#00ff88' }}
                      />
                      <Area type="monotone" dataKey="volume" stroke="#00ff88" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="market-card p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-blue-400" />
                    Distribuição por Categoria
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analysisData.categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {analysisData.categoryDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={['#00ff88', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="market-card p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Crescimento de Utilizadores
                </h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysisData.userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="market-card p-8">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                  <Settings className="w-6 h-6 text-market-green" />
                  Configurações da Plataforma
                </h3>
                <form onSubmit={handleUpdateSettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-market-text-muted uppercase tracking-widest mb-3">Nome da Plataforma</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-market-text-text-muted" />
                        <input 
                          type="text" 
                          value={platformSettings.platformName}
                          onChange={(e) => setPlatformSettings({...platformSettings, platformName: e.target.value})}
                          className="market-input w-full pl-12"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-market-text-muted uppercase tracking-widest mb-3">Taxa de Negociação (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-market-text-text-muted" />
                        <input 
                          type="number" 
                          step="0.1"
                          value={platformSettings.tradingFee}
                          onChange={(e) => setPlatformSettings({...platformSettings, tradingFee: parseFloat(e.target.value)})}
                          className="market-input w-full pl-12"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-market-text-muted uppercase tracking-widest mb-3">Depósito Mínimo (KZ)</label>
                      <div className="relative">
                        <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-market-text-text-muted" />
                        <input 
                          type="number" 
                          value={platformSettings.minDeposit}
                          onChange={(e) => setPlatformSettings({...platformSettings, minDeposit: parseInt(e.target.value)})}
                          className="market-input w-full pl-12"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-market-text-muted uppercase tracking-widest mb-3">Levantamento Mínimo (KZ)</label>
                      <div className="relative">
                        <ArrowUpFromLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-market-text-text-muted" />
                        <input 
                          type="number" 
                          value={platformSettings.minWithdrawal}
                          onChange={(e) => setPlatformSettings({...platformSettings, minWithdrawal: parseInt(e.target.value)})}
                          className="market-input w-full pl-12"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-market-card-lighter rounded-2xl border border-market-border/50">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${platformSettings.maintenanceMode ? 'bg-market-red/10' : 'bg-market-green/10'}`}>
                        {platformSettings.maintenanceMode ? <Lock className="w-5 h-5 text-market-red" /> : <Unlock className="w-5 h-5 text-market-green" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Modo de Manutenção</h4>
                        <p className="text-xs text-market-text-muted">Desativa negociações e depósitos para todos os utilizadores.</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setPlatformSettings({...platformSettings, maintenanceMode: !platformSettings.maintenanceMode})}
                      className={`w-14 h-8 rounded-full transition-all relative ${platformSettings.maintenanceMode ? 'bg-market-red' : 'bg-market-border'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${platformSettings.maintenanceMode ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button type="submit" className="market-button-primary px-12 py-4 shadow-xl shadow-market-green/20">
                      Guardar Alterações
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="space-y-8">
              <div className="market-card p-8">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                  <History className="w-5 h-5 text-blue-400" />
                  Logs de Auditoria
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {auditLogs.length > 0 ? auditLogs.map((log, i) => (
                    <div key={i} className="p-4 bg-market-card-lighter rounded-xl border border-market-border/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-market-green uppercase tracking-widest">{log.action}</span>
                        <span className="text-[10px] text-market-text-muted">{format(new Date(log.created_at), 'dd/MM HH:mm')}</span>
                      </div>
                      <p className="text-xs text-white leading-relaxed">{log.details}</p>
                    </div>
                  )) : (
                    <div className="text-center py-12">
                      <Info className="w-8 h-8 text-market-text-muted mx-auto mb-3 opacity-20" />
                      <p className="text-xs text-market-text-muted italic">Nenhum log registado.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-market-bg/80 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-market-card border border-market-border rounded-2xl p-8 space-y-6 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white">Editar Utilizador</h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Nome</label>
                <input 
                  type="text" 
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="market-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Saldo (KZ)</label>
                <input 
                  type="number" 
                  value={editingUser.balance}
                  onChange={(e) => setEditingUser({...editingUser, balance: parseFloat(e.target.value)})}
                  className="market-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Status</label>
                <select 
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({...editingUser, status: e.target.value as any})}
                  className="market-input w-full"
                >
                  <option value="active">Ativo</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="pending_verification">Pendente Verificação</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox" 
                  checked={editingUser.is_admin}
                  onChange={(e) => setEditingUser({...editingUser, is_admin: e.target.checked})}
                  className="w-4 h-4 rounded border-market-border bg-market-card-lighter text-market-green"
                />
                <label className="text-sm font-bold text-white">Administrador</label>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Mercados Bloqueados</label>
                <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-market-card-lighter rounded-xl">
                  {markets.map(m => (
                    <div key={m.id} className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        checked={editingUser.blocked_markets?.includes(m.id)}
                        onChange={(e) => {
                          const blocks = editingUser.blocked_markets || [];
                          const newBlocks = e.target.checked 
                            ? [...blocks, m.id]
                            : blocks.filter(id => id !== m.id);
                          setEditingUser({...editingUser, blocked_markets: newBlocks});
                        }}
                        className="w-3 h-3 rounded border-market-border bg-market-card text-market-red"
                      />
                      <span className="text-[10px] text-white truncate">{m.question}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 market-button-outline py-3">Cancelar</button>
                <button type="submit" className="flex-1 market-button-primary py-3">Guardar</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Market Modal - Simplified for brevity, same pattern as User */}
      {editingMarket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-market-bg/80 backdrop-blur-sm" onClick={() => setEditingMarket(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-market-card border border-market-border rounded-2xl p-8 space-y-6 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-white">Editar Mercado</h3>
            <form onSubmit={handleUpdateMarket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Pergunta</label>
                <input 
                  type="text" 
                  value={editingMarket.question}
                  onChange={(e) => setEditingMarket({...editingMarket, question: e.target.value})}
                  className="market-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Data de Término</label>
                <input 
                  type="datetime-local" 
                  value={editingMarket.end_date.slice(0, 16)}
                  onChange={(e) => setEditingMarket({...editingMarket, end_date: new Date(e.target.value).toISOString()})}
                  className="market-input w-full"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditingMarket(null)} className="flex-1 market-button-outline py-3">Cancelar</button>
                <button type="submit" className="flex-1 market-button-primary py-3">Guardar</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreatePost && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreatePost(false)} className="absolute inset-0 bg-market-bg/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-market-card border border-market-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-market-border flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Nova Publicação</h3>
                <button onClick={() => setShowCreatePost(false)} className="p-2 hover:bg-market-card-lighter rounded-full transition-colors"><XCircle className="w-5 h-5 text-market-text-muted" /></button>
              </div>
              <form onSubmit={handleCreatePost} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Título</label>
                    <input type="text" required value={newPost.title} onChange={(e) => setNewPost({...newPost, title: e.target.value})} className="market-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Categoria</label>
                    <select value={newPost.category} onChange={(e) => setNewPost({...newPost, category: e.target.value})} className="market-input w-full bg-market-card">
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">URL da Imagem</label>
                  <input type="text" value={newPost.image_url} onChange={(e) => setNewPost({...newPost, image_url: e.target.value})} className="market-input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Conteúdo</label>
                  <textarea required rows={6} value={newPost.content} onChange={(e) => setNewPost({...newPost, content: e.target.value})} className="market-input w-full resize-none" />
                </div>
                <button type="submit" className="market-button-primary w-full py-3">Criar Publicação</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Post Modal */}
      <AnimatePresence>
        {editingPost && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingPost(null)} className="absolute inset-0 bg-market-bg/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-market-card border border-market-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-market-border flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Editar Publicação</h3>
                <button onClick={() => setEditingPost(null)} className="p-2 hover:bg-market-card-lighter rounded-full transition-colors"><XCircle className="w-5 h-5 text-market-text-muted" /></button>
              </div>
              <form onSubmit={handleUpdatePost} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Título</label>
                    <input type="text" required value={editingPost.title} onChange={(e) => setEditingPost({...editingPost, title: e.target.value})} className="market-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Categoria</label>
                    <select value={editingPost.category} onChange={(e) => setEditingPost({...editingPost, category: e.target.value})} className="market-input w-full bg-market-card">
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">URL da Imagem</label>
                  <input type="text" value={editingPost.image_url} onChange={(e) => setEditingPost({...editingPost, image_url: e.target.value})} className="market-input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Conteúdo</label>
                  <textarea required rows={6} value={editingPost.content} onChange={(e) => setEditingPost({...editingPost, content: e.target.value})} className="market-input w-full resize-none" />
                </div>
                <button type="submit" className="market-button-primary w-full py-3">Guardar Alterações</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Market Modal */}
      {showCreateMarket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-market-bg/80 backdrop-blur-sm" onClick={() => setShowCreateMarket(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg bg-market-card border border-market-border rounded-2xl p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <h3 className="text-xl font-bold text-white">Criar Novo Mercado</h3>
            <form onSubmit={handleCreateMarketSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Pergunta</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: O Bitcoin vai ultrapassar os $100k este mês?"
                  value={newMarket.question}
                  onChange={(e) => setNewMarket({...newMarket, question: e.target.value})}
                  className="market-input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Categoria</label>
                  <select 
                    value={newMarket.category}
                    onChange={(e) => setNewMarket({...newMarket, category: e.target.value})}
                    className="market-input w-full"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Data de Término</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={newMarket.end_date}
                    onChange={(e) => setNewMarket({...newMarket, end_date: e.target.value})}
                    className="market-input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">URL da Imagem</label>
                <input 
                  type="url" 
                  value={newMarket.image_url}
                  onChange={(e) => setNewMarket({...newMarket, image_url: e.target.value})}
                  className="market-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Descrição</label>
                <textarea 
                  value={newMarket.description}
                  onChange={(e) => setNewMarket({...newMarket, description: e.target.value})}
                  className="market-input w-full h-24 resize-none"
                  placeholder="Detalhes adicionais sobre as regras do mercado..."
                />
              </div>

              <div className="space-y-4 p-4 bg-market-card-lighter rounded-xl border border-market-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-widest">Multi-Opção</label>
                  <button 
                    type="button"
                    onClick={() => setNewMarket({...newMarket, is_multi: !newMarket.is_multi})}
                    className={`w-12 h-6 rounded-full transition-all relative ${newMarket.is_multi ? 'bg-market-green' : 'bg-market-border'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newMarket.is_multi ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {newMarket.is_multi && (
                  <div className="space-y-3">
                    {newMarket.outcomes.map((outcome, index) => (
                      <div key={outcome.id} className="flex gap-2">
                        <input 
                          type="text"
                          placeholder={`Opção ${index + 1}`}
                          value={outcome.name}
                          onChange={(e) => {
                            const newOutcomes = [...newMarket.outcomes];
                            newOutcomes[index].name = e.target.value;
                            setNewMarket({...newMarket, outcomes: newOutcomes});
                          }}
                          className="market-input flex-1 py-2 text-sm"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const newOutcomes = newMarket.outcomes.filter((_, i) => i !== index);
                            setNewMarket({...newMarket, outcomes: newOutcomes});
                          }}
                          className="p-2 text-market-red hover:bg-market-red/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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
                      className="w-full py-2 border border-dashed border-market-border rounded-lg text-[10px] font-bold text-market-text-muted hover:text-white hover:border-market-green transition-all uppercase tracking-widest"
                    >
                      + Adicionar Opção
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateMarket(false)} className="flex-1 market-button-outline py-3">Cancelar</button>
                <button type="submit" className="flex-1 market-button-primary py-3">Criar Mercado</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Create Category Modal */}
      <AnimatePresence>
        {showCreateCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateCategory(false)}
              className="absolute inset-0 bg-market-bg/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md market-card p-8"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Criar Nova Categoria</h2>
              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Nome da Categoria</label>
                  <input 
                    type="text" 
                    required
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                    className="market-input w-full"
                    placeholder="Ex: Entretenimento"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Ícone (Nome Lucide)</label>
                  <input 
                    type="text" 
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})}
                    className="market-input w-full"
                    placeholder="Ex: Music, Film, Tv"
                  />
                  <p className="text-[10px] text-market-text-muted mt-1 italic">Use nomes de ícones da biblioteca Lucide.</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowCreateCategory(false)}
                    className="market-button-outline flex-1 py-3 text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="market-button-primary flex-1 py-3 text-xs"
                  >
                    Criar Categoria
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === 'success' 
                ? "bg-market-green/10 border-market-green/20 text-market-green" 
                : "bg-market-red/10 border-market-red/20 text-market-red"
            )}
          >
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-bold text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-market-bg/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm market-card p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-market-red/10 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-market-red" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-market-text-muted mb-8 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 market-button-outline py-3 text-xs"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 market-button-primary bg-market-red hover:bg-market-red/80 py-3 text-xs"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
