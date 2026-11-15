import { 
  db, 
  auth 
} from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  increment, 
  runTransaction, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { Market, Trade, User, Position, Category, Comment, PriceHistory } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// LMSR Constants
const DEFAULT_B = 1000; // Liquidity parameter

/**
 * LMSR Cost Function: C(q) = b * ln(sum(exp(q_i / b)))
 */
export const calculateCost = (q_yes: number, q_no: number, b: number) => {
  return b * Math.log(Math.exp(q_yes / b) + Math.exp(q_no / b));
};

export const calculateShares = (amount: number, q_yes: number, q_no: number, b: number, outcome: 'Yes' | 'No') => {
  const q = outcome === 'Yes' ? q_yes : q_no;
  const q_other = outcome === 'Yes' ? q_no : q_yes;
  
  const exp_A_b = Math.exp(amount / b);
  const exp_q_b = Math.exp(q / b);
  const exp_q_other_b = Math.exp(q_other / b);
  
  return b * Math.log((exp_A_b * (exp_q_b + exp_q_other_b) - exp_q_other_b) / exp_q_b);
};

/**
 * LMSR Price Function: p_i = exp(q_i / b) / sum(exp(q_j / b))
 */
export const calculatePrices = (q_yes: number, q_no: number, b: number) => {
  const exp_yes = Math.exp(q_yes / b);
  const exp_no = Math.exp(q_no / b);
  const sum_exp = exp_yes + exp_no;
  return {
    yes: exp_yes / sum_exp,
    no: exp_no / sum_exp
  };
};

export const firebaseService = {
  // --- Markets ---
  subscribeToMarkets: (callback: (markets: Market[]) => void) => {
    return onSnapshot(collection(db, 'markets'), (snapshot) => {
      const markets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Market));
      callback(markets);
    }, (error) => {
      console.error('Error subscribing to markets:', error);
      handleFirestoreError(error, OperationType.GET, 'markets');
    });
  },

  getMarket: async (marketId: string) => {
    const docRef = doc(db, 'markets', marketId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Market : null;
  },

  getMarkets: async () => {
    try {
      const snapshot = await getDocs(collection(db, 'markets'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Market));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'markets');
      return [];
    }
  },

  getCategories: async () => {
    const q = query(collection(db, 'categories'), orderBy('order'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
  },

  getPosts: async () => {
    const q = query(collection(db, 'posts'), where('status', '==', 'published'), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  },

  // --- Users ---
  getUserProfile: async (userId: string) => {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const userData = docSnap.data() as User;
      try {
        const q = query(collection(db, 'positions'), where('userId', '==', userId));
        const posSnapshot = await getDocs(q);
        const activePositions = posSnapshot.docs.map(d => {
          const p = d.data();
          return {
            ...p,
            market_id: p.market_id || p.marketId || '',
            marketId: p.market_id || p.marketId || '',
            user_id: p.user_id || p.userId || '',
            userId: p.user_id || p.userId || '',
          } as any as Position;
        });
        return {
          ...userData,
          positions: activePositions
        };
      } catch (e) {
        console.error("Error loading positions for user profile:", e);
        return {
          ...userData,
          positions: userData.positions || []
        };
      }
    }
    return null;
  },

  createUserProfile: async (userId: string, data: Partial<User>) => {
    try {
      const userRef = doc(db, 'users', userId);
      const isMaster = auth.currentUser?.email?.toLowerCase() === 'evaristopaulocassoma00@gmail.com' && Boolean(auth.currentUser?.emailVerified);
      const newUser: User = {
        id: userId,
        name: data.name || 'Utilizador',
        email: data.email || '',
        balance: data.balance || 1000,
        positions: data.positions || [],
        is_admin: isMaster && Boolean(data.is_admin),
        status: data.status || 'active',
        created_at: new Date().toISOString()
      };
      await setDoc(userRef, newUser);
      return newUser;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
      throw error;
    }
  },

  subscribeToUser: (userId: string, callback: (user: User) => void) => {
    // Listen to user document
    return onSnapshot(doc(db, 'users', userId), async (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        try {
          // Fetch positions dynamically in real-time
          const q = query(collection(db, 'positions'), where('userId', '==', userId));
          const posSnapshot = await getDocs(q);
          const activePositions = posSnapshot.docs.map(d => {
            const p = d.data();
            return {
              ...p,
              market_id: p.market_id || p.marketId || '',
              marketId: p.market_id || p.marketId || '',
              user_id: p.user_id || p.userId || '',
              userId: p.user_id || p.userId || '',
            } as any as Position;
          });
          callback({
            ...userData,
            positions: activePositions
          });
        } catch (error) {
          console.error("Error in subscribeToUser positions fetch:", error);
          callback({
            ...userData,
            positions: userData.positions || []
          });
        }
      }
    });
  },

  // --- Trades (Motor LMSR Desativado: Motor Principal = Express/SQLite CLOB + AMM) ---
  placeTrade: async (
    _userId: string,
    _marketId: string,
    _outcome: 'Yes' | 'No',
    _amount: number,
    _side: 'Buy' | 'Sell'
  ): Promise<{ shares: number; price: number }> => {
    throw new Error(
      'Motor LMSR no Firestore desativado. Todas as ordens reais executam exclusivamente no motor principal Express/SQLite CLOB + AMM.'
    );
  },

  // --- History ---
  getTradeHistory: (userId: string, callback: (trades: Trade[]) => void) => {
    const q = query(collection(db, 'trades'), where('user_id', '==', userId), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
      callback(trades);
    }, (error) => {
      console.error('Error getting trade history:', error);
      handleFirestoreError(error, OperationType.GET, 'trades');
    });
  },

  subscribeToAllTrades: (callback: (trades: any[]) => void) => {
    const q = query(collection(db, 'trades'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(trades);
    }, (error) => {
      console.error('Error subscribing to all trades:', error);
      handleFirestoreError(error, OperationType.GET, 'trades');
    });
  },

  getUserLedger: async (userId: string) => {
    try {
      const q = query(collection(db, 'ledger'), where('user_id', '==', userId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
      console.error('Error fetching ledger entries:', error);
      try {
        const qNoOrder = query(collection(db, 'ledger'), where('user_id', '==', userId));
        const snap = await getDocs(qNoOrder);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      } catch (innerErr) {
        return [];
      }
    }
  },

  // --- Comments & History ---
  subscribeToComments: (marketId: string, callback: (comments: Comment[]) => void) => {
    const q = query(
      collection(db, 'comments'),
      where('market_id', '==', marketId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      callback(comments);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'comments'));
  },

  subscribeToPriceHistory: (marketId: string, callback: (history: PriceHistory[]) => void) => {
    const q = query(
      collection(db, 'price_history'),
      where('market_id', '==', marketId),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as PriceHistory));
      callback(history);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'price_history'));
  },

  addComment: async (marketId: string, userId: string, userName: string, text: string) => {
    const commentData = {
      market_id: marketId,
      user_id: userId,
      user_name: userName,
      text,
      timestamp: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'comments'), commentData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'comments');
    }
  },

  updateUserProfile: async (userId: string, data: Partial<User>) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  },

  getLeaderboard: async (limitCount: number = 10) => {
    const q = query(
      collection(db, 'users'),
      orderBy('balance', 'desc'),
      limit(limitCount)
    );
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch {
      return [];
    }
  },

  // --- Admin Operations ---
  getPlatformSettings: async () => {
    try {
      const docRef = doc(db, 'settings', 'platform');
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings/platform');
    }
  },

  updatePlatformSettings: async (settings: any) => {
    try {
      const docRef = doc(db, 'settings', 'platform');
      await setDoc(docRef, settings, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/platform');
    }
  },

  getAuditLogs: async (limitCount: number = 50) => {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'audit_logs');
      return [];
    }
  },

  getFinanceRequests: async () => {
    const q = query(collection(db, 'finance_requests'), orderBy('created_at', 'desc'));
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'finance_requests');
      return [];
    }
  },

  addFinanceRequest: async (request: any) => {
    try {
      const docRef = await addDoc(collection(db, 'finance_requests'), {
        ...request,
        created_at: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'finance_requests');
      throw error;
    }
  },

  getUserFinanceRequests: async (userId: string) => {
    try {
      const q = query(
        collection(db, 'finance_requests'),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'finance_requests');
      return [];
    }
  },

  updateFinanceRequest: async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const docRef = doc(db, 'finance_requests', requestId);
      await updateDoc(docRef, { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'finance_requests');
    }
  },

  processFinanceRequest: async (_requestId: string, _status: 'approved' | 'rejected', _adminId: string = 'admin') => {
    throw new Error('Aprovações financeiras devem ser processadas exclusivamente via motor Express/SQLite (/api/finance/process).');
  },

  createMarket: async (marketData: any) => {
    try {
      const docRef = await addDoc(collection(db, 'markets'), {
        ...marketData,
        created_at: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'markets');
    }
  },

  createUserMarket: async (userId: string, marketData: any) => {
    return runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("Utilizador não encontrado");
      }
      const userData = userDoc.data() as User;
      const fee = 1000;
      const initialLiquidity = 1000;
      const totalCost = fee + initialLiquidity;

      if (userData.balance < totalCost) {
        throw new Error(`Saldo insuficiente. Precisa de pelo menos ${totalCost} KZ (1000 KZ taxa de criação + 1000 KZ liquidez inicial).`);
      }

      // Deduct balance
      transaction.update(userRef, {
        balance: increment(-totalCost)
      });

      // Update platform settings
      const settingsRef = doc(db, 'settings', 'platform');
      transaction.set(settingsRef, {
        siteProfit: increment(fee),
        totalFees: increment(fee)
      }, { merge: true });

      // Create market
      const marketRef = doc(collection(db, 'markets'));
      const newMarket = {
        id: marketRef.id,
        ...marketData,
        pool_yes: initialLiquidity,
        pool_no: initialLiquidity,
        yes_price: 0.5,
        no_price: 0.5,
        volume: 0,
        resolved: false,
        creator_id: userId,
        creator_fee_earned: 0,
        status: 'active',
        created_at: new Date().toISOString()
      };
      transaction.set(marketRef, newMarket);

      // Log creation
      const logRef = doc(collection(db, 'audit_logs'));
      transaction.set(logRef, {
        id: logRef.id,
        action: 'MARKET_CREATION',
        details: `Criador ${userId} criou novo mercado ${marketRef.id} com 1000 KZ liquidez inicial. Taxa de 1000 KZ cobrada.`,
        timestamp: new Date().toISOString()
      });

      return marketRef.id;
    });
  },

  updateMarket: async (marketId: string, data: any) => {
    try {
      const docRef = doc(db, 'markets', marketId);
      await updateDoc(docRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'markets');
    }
  },

  deleteMarket: async (marketId: string) => {
    try {
      const docRef = doc(db, 'markets', marketId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'markets');
    }
  },

  resolveMarket: async (marketId: string, outcome: string, motive?: string, adminId: string = 'admin') => {
    try {
      const marketRef = doc(db, 'markets', marketId);
      const marketDoc = await getDoc(marketRef);
      if (!marketDoc.exists()) {
        throw new Error("Mercado não encontrado");
      }
      const mCheck = marketDoc.data() as any;
      if (!mCheck.is_multi && (outcome === 'Yes' || outcome === 'No')) {
        throw new Error('Mercados binários devem ser liquidados exclusivamente via motor Express CLOB+AMM (/api/clob/market/:id/resolve).');
      }

      // Update market status
      await updateDoc(marketRef, {
        resolved: true,
        resolution_outcome: outcome,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_motive: motive || 'Nenhum motivo fornecido',
        resolved_by: adminId
      });

      // Audit Log for the resolution itself
      await addDoc(collection(db, 'audit_logs'), {
        id: doc(collection(db, 'audit_logs')).id,
        action: 'MARKET_RESOLUTION',
        details: `O administrador ${adminId} resolveu o mercado "${marketId}" como "${outcome}". Motivo: ${motive || 'Sem motivo detalhado.'}`,
        timestamp: new Date().toISOString()
      });

      // Find all positions of this market to calculate & distribute payout
      const q = query(collection(db, 'positions'), where('marketId', '==', marketId));
      const posSnapshot = await getDocs(q);

      // Distribute payouts to holders in real-time
      for (const posDoc of posSnapshot.docs) {
        const pos = posDoc.data();
        const shares = pos.shares || 0;
        const posOutcome = pos.outcome;
        const posUserId = pos.userId;

        if (shares > 0 && posUserId) {
          if (posOutcome === outcome) {
            const winnings = shares * 1; // 1 share of winning outcome = 1 KZ payout
            const userRef = doc(db, 'users', posUserId);
            
            // Get user's balance before the payout to record in Ledger
            const userDoc = await getDoc(userRef);
            const balanceBefore = userDoc.exists() ? (userDoc.data()?.balance || 0) : 0;
            const balanceAfter = balanceBefore + winnings;

            // Real-time credit to user balance
            await updateDoc(userRef, {
              balance: increment(winnings)
            });

            // Record in Ledger (Livro Razão)
            const ledgerRef = doc(collection(db, 'ledger'));
            await setDoc(ledgerRef, {
              id: ledgerRef.id,
              user_id: posUserId,
              type: 'PREMIACAO_MERCADO',
              amount: winnings,
              balanceBefore,
              balanceAfter,
              reference: marketId,
              createdAt: new Date().toISOString()
            });

            // Log payout in audit log
            await addDoc(collection(db, 'audit_logs'), {
              action: 'WINNER_PAYOUT',
              details: `Pago ${winnings.toFixed(2)} KZ para o utilizador ${posUserId} por ${shares.toFixed(2)} quotas corretas no mercado ${marketId}`,
              timestamp: new Date().toISOString()
            });
          }
        }

        // Clean up position document since it is settled
        await deleteDoc(posDoc.ref);
      }

      // AUTO-RECREATION (ROTATION): When market ends, create/clone a brand-new identical open active one!
      try {
        const mData = marketDoc.data() as any;
        let newEndDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Default 24h
        if (mData.created_at && mData.end_date) {
          const duration = new Date(mData.end_date).getTime() - new Date(mData.created_at).getTime();
          if (duration > 1000) {
            newEndDate = new Date(Date.now() + duration).toISOString();
          }
        }

        const newMarketRef = doc(collection(db, 'markets'));
        const b = mData.b || 1000;
        
        const newMarketData: any = {
          id: newMarketRef.id,
          question: mData.question,
          description: mData.description || `Este mercado foi reiniciado automaticamente após rodízio e encerramento anterior.`,
          category: mData.category || 'Geral',
          image_url: mData.image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=400&q=80',
          tags: mData.tags || [],
          volume: 0,
          end_date: newEndDate,
          created_at: new Date().toISOString(),
          yes_price: 0.5,
          no_price: 0.5,
          pool_yes: b,
          pool_no: b,
          b: b,
          resolved: false,
          status: 'active',
          creator_id: mData.creator_id || null,
          creator_fee_earned: 0,
          admin_fee_earned: 0
        };

        if (mData.is_multi && mData.outcomes) {
          newMarketData.is_multi = true;
          const count = mData.outcomes.length;
          newMarketData.outcomes = mData.outcomes.map(o => ({
            id: o.id,
            name: o.name,
            price: 1 / count,
            pool: b
          }));
        }

        await setDoc(newMarketRef, newMarketData);

        // Audit Log rotation
        await addDoc(collection(db, 'audit_logs'), {
          action: 'MARKET_ROTATION',
          details: `Mercado ${marketId} resolvido. Cloned/Rotated novo mercado ativo com ID: ${newMarketRef.id} com expiração em ${newEndDate}`,
          timestamp: new Date().toISOString()
        });

      } catch (rotationErr) {
        console.error("Erro na auto-recreação/rotação do mercado:", rotationErr);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'markets');
      throw error;
    }
  },

  resetMarket: async (marketId: string) => {
    try {
      const marketRef = doc(db, 'markets', marketId);
      const marketDoc = await getDoc(marketRef);
      if (!marketDoc.exists()) {
        throw new Error("Mercado não encontrado");
      }
      const mData = marketDoc.data();
      const b = mData.b || 1000;

      // Update market document to active pool conditions
      await updateDoc(marketRef, {
        resolved: false,
        resolution_outcome: null,
        resolved_at: null,
        status: 'active',
        pool_yes: b,
        pool_no: b,
        yes_price: 0.5,
        no_price: 0.5,
        volume: 0,
        creator_fee_earned: 0,
        admin_fee_earned: 0
      });

      // Clear any remaining positions on this market
      const q = query(collection(db, 'positions'), where('marketId', '==', marketId));
      const posSnapshot = await getDocs(q);
      for (const posDoc of posSnapshot.docs) {
        await deleteDoc(posDoc.ref);
      }

      // Clear trades on this market to allow clean statistics tracking
      const tq = query(collection(db, 'trades'), where('market_id', '==', marketId));
      const tradeSnapshot = await getDocs(tq);
      for (const tDoc of tradeSnapshot.docs) {
        await deleteDoc(tDoc.ref);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'markets');
      throw error;
    }
  },

  getUsers: async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
      return [];
    }
  },

  createCategory: async (categoryData: any) => {
    try {
      await addDoc(collection(db, 'categories'), {
        ...categoryData,
        order: 0 // Default order
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  },

  updateCategory: async (categoryId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'categories', categoryId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  },

  deleteCategory: async (categoryId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'categories');
    }
  },

  logAdminAction: async (adminId: string, action: string, details: string) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        admin_id: adminId,
        action,
        details,
        created_at: new Date().toISOString(),
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  },

  createPost: async (postData: any) => {
    try {
      await addDoc(collection(db, 'posts'), {
        ...postData,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
    }
  },

  updatePost: async (postId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'posts', postId), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
    }
  },

  getUserPosition: async (userId: string, marketId: string) => {
    try {
      const positionId = `${userId}_${marketId}`;
      const docSnap = await getDoc(doc(db, 'positions', positionId));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'positions');
      return null;
    }
  },

  deletePost: async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'posts');
    }
  },

  getMarketPositions: async (marketId: string) => {
    try {
      const q = query(collection(db, 'positions'), where('marketId', '==', marketId));
      const snapshot = await getDocs(q);
      const positions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch user profiles for these positions
      const positionsWithProfiles = await Promise.all(positions.map(async (pos: any) => {
        const userDoc = await getDoc(doc(db, 'users', pos.userId));
        return {
          ...pos,
          profiles: userDoc.exists() ? userDoc.data() : null
        };
      }));
      
      return positionsWithProfiles;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'positions');
      return [];
    }
  },

  seedMarkets: async (markets: any[]) => {
    try {
      for (const market of markets) {
        const marketRef = doc(db, 'markets', market.id);
        await setDoc(marketRef, {
          ...market,
          yes_price: market.is_multi ? 0 : 0.5,
          no_price: market.is_multi ? 0 : 0.5,
          pool_yes: market.is_multi ? 0 : 1000,
          pool_no: market.is_multi ? 0 : 1000,
          volume: market.volume ?? 0,
          resolved: false,
          status: 'active',
          created_at: new Date().toISOString()
        }, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'markets');
    }
  },

  getTrades: async (limitCount: number = 1000) => {
    try {
      const q = query(collection(db, 'trades'), orderBy('timestamp', 'desc'), limit(limitCount));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'trades');
      return [];
    }
  },

  placeLimitOrder: async (
    _userId: string,
    _marketId: string,
    _outcome: string,
    _amount: number,
    _limitPrice: number,
    _side: 'Buy' | 'Sell'
  ) => {
    throw new Error('Ordens limite no Firestore desativadas. Utilize o livro CLOB+AMM (/api/clob/order).');
  },

  getPendingLimitOrders: async (_marketId: string) => {
    return [];
  },

  subscribeToUserLimitOrders: (_userId: string, callback: (orders: any[]) => void) => {
    callback([]);
    return () => {};
  },

  cancelLimitOrder: async (_orderId: string) => {
    throw new Error('Cancelamento de ordens deve ser feito via motor CLOB (/api/clob/order/:id/cancel).');
  },

  executeTriggeredLimitOrders: async (_marketId: string, _currentYesPrice: number, _currentNoPrice: number) => {
    return;
  }
};
