export type Outcome = string; // Mudado de 'Yes' | 'No' para string para suportar multi-opção

export interface MarketOutcome {
  id: string;
  name: string;
  price: number; // 0 to 1
  pool: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  order?: number;
  status?: 'active' | 'blocked' | 'hidden';
}

export interface Market {
  id: string;
  question: string;
  description?: string;
  category: string;
  image_url: string;
  volume: number;
  end_date: string;
  yes_price: number; // Mantido para compatibilidade
  no_price: number; // Mantido para compatibilidade
  pool_yes: number; // Mantido para compatibilidade
  pool_no: number; // Mantido para compatibilidade
  outcomes?: MarketOutcome[]; // Novo: para multi-opção
  is_multi?: boolean; // Novo: flag para identificar tipo de mercado
  resolved?: boolean;
  resolution_outcome?: Outcome;
  tags: string[];
  status?: 'active' | 'closed' | 'resolved' | 'blocked' | 'hidden';
  probability?: number; // Added for UI calculations
  b?: number; // LMSR liquidity parameter
  q_yes?: number; // LMSR quantity yes
  q_no?: number; // LMSR quantity no
  showGraph?: boolean;
  showCandlestick?: boolean;
  showOrderBook?: boolean;
  showCountdown?: boolean;
  showComments?: boolean;
  showStatistics?: boolean;
  graphType?: string;
  type?: string;
}

export interface Trade {
  id: string;
  market_id: string;
  user_id: string;
  side: 'Buy' | 'Sell';
  outcome: Outcome;
  amount: number; // in USD
  shares: number;
  price: number;
  timestamp: string;
  fee?: number; // Added for stats
}

export interface User {
  id: string;
  name: string;
  full_name?: string; // Added for compatibility
  email?: string;
  avatar_url?: string; // Added for compatibility
  wallet_address?: string;
  balance: number;
  pending_balance?: number;
  invested_balance?: number;
  positions: Position[];
  is_admin?: boolean;
  is_verified?: boolean;
  verification_status?: 'none' | 'pending' | 'verified' | 'rejected'; // Added
  status?: 'active' | 'blocked' | 'pending_verification';
  blocked_markets?: string[]; // Added
  created_at?: string;
}

export interface Position {
  market_id: string;
  outcome: Outcome;
  shares: number;
  avg_price: number;
}

export interface Comment {
  id: string;
  market_id: string;
  user_id: string;
  user_name: string;
  text: string;
  timestamp: string;
  likes: number;
}

export interface PriceHistory {
  timestamp: string;
  yes_price: number;
  no_price: number;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string;
  created_at: string;
  status: 'published' | 'blocked';
}
