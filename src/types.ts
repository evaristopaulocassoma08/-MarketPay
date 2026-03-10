export type Outcome = 'Yes' | 'No';

export interface Market {
  id: string;
  question: string;
  description?: string;
  category: string;
  imageUrl: string;
  volume: number;
  endDate: string;
  yesPrice: number; // 0 to 1
  noPrice: number; // 0 to 1
  poolYes: number;
  poolNo: number;
  resolved?: boolean;
  resolutionOutcome?: Outcome;
  tags: string[];
}

export interface Trade {
  id: string;
  marketId: string;
  userId: string;
  side: 'Buy' | 'Sell';
  outcome: Outcome;
  amount: number; // in USD
  shares: number;
  price: number;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  walletAddress: string;
  balance: number;
  positions: Position[];
  isAdmin?: boolean;
}

export interface Position {
  marketId: string;
  outcome: Outcome;
  shares: number;
  avgPrice: number;
}

export interface PriceHistory {
  timestamp: string;
  yesPrice: number;
  noPrice: number;
}
