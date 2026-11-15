import { auth } from '../firebase';

async function getAuthHeaders(includeIdempotency = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (includeIdempotency) {
    headers['X-Idempotency-Key'] =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return headers;
}

async function handleResponse<T>(resp: Response): Promise<T> {
  const text = await resp.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `Erro HTTP ${resp.status}`);
  }
  if (!resp.ok) {
    throw new Error(data.error || `Erro HTTP ${resp.status}`);
  }
  return data as T;
}

export const ammApi = {
  // --- CLOB Public & User ---
  getOrderBook: async (marketId: string) => {
    const resp = await fetch(`/api/clob/book/${encodeURIComponent(marketId)}`);
    return handleResponse<any>(resp);
  },

  quoteClobOrder: async (params: {
    marketId: string;
    side: 'Buy' | 'Sell';
    outcome: 'Yes' | 'No';
    orderType: 'LIMIT' | 'MARKET';
    budgetKz?: number;
    quantity?: number;
    limitPriceCents?: number;
  }) => {
    const headers = await getAuthHeaders(false);
    const qs = new URLSearchParams({
      marketId: params.marketId,
      side: params.side,
      outcome: params.outcome,
      orderType: params.orderType,
    });
    if (params.budgetKz !== undefined) qs.set('budgetKz', String(params.budgetKz));
    if (params.quantity !== undefined) qs.set('quantity', String(params.quantity));
    if (params.limitPriceCents !== undefined) qs.set('limitPriceCents', String(params.limitPriceCents));

    const resp = await fetch(`/api/clob/quote?${qs.toString()}`, { headers });
    return handleResponse<{
      marketId: string;
      side: 'Buy' | 'Sell';
      outcome: 'Yes' | 'No';
      orderType: 'LIMIT' | 'MARKET';
      executableShares: number;
      avgPriceCents: number;
      worstFillPriceCents: number;
      estimatedNotionalCents: number;
      estimatedFeeCents: number;
      estimatedTotalCents: number;
      hasLiquidity: boolean;
      referencePriceCents: number;
    }>(resp);
  },

  getMarketExecutions: async (marketId: string, limitCount: number = 50) => {
    const resp = await fetch(`/api/clob/executions/${encodeURIComponent(marketId)}?limit=${limitCount}`);
    return handleResponse<{ executions: any[] }>(resp);
  },

  getMarketClobPositions: async (marketId: string) => {
    const resp = await fetch(`/api/clob/positions/${encodeURIComponent(marketId)}`);
    return handleResponse<{ positions: any[] }>(resp);
  },

  getMyClobOrders: async (marketId?: string) => {
    const headers = await getAuthHeaders(false);
    const qs = marketId ? `?marketId=${encodeURIComponent(marketId)}` : '';
    const resp = await fetch(`/api/clob/orders/my${qs}`, { headers });
    return handleResponse<{ orders: any[]; positions: any[]; account: any }>(resp);
  },

  placeClobOrder: async (payload: {
    marketId: string;
    side: 'Buy' | 'Sell';
    outcome: 'Yes' | 'No';
    orderType: 'LIMIT' | 'MARKET';
    priceCents?: number;
    quantity?: number;
    budgetKz?: number;
  }) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/clob/order', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(resp);
  },

  cancelClobOrder: async (orderId: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch(`/api/clob/order/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      headers,
    });
    return handleResponse<any>(resp);
  },

  resolveClobMarket: async (marketId: string, winningOutcome: 'Yes' | 'No', motive?: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch(`/api/clob/market/${encodeURIComponent(marketId)}/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ winningOutcome, motive }),
    });
    return handleResponse<any>(resp);
  },

  // --- Admin Finance & Balance Synchronization ---
  processFinanceRequest: async (requestId: string, status: 'approved' | 'rejected') => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/finance/process', {
      method: 'POST',
      headers,
      body: JSON.stringify({ requestId, status }),
    });
    return handleResponse<any>(resp);
  },

  adminUpdateUserBalance: async (userId: string, newBalanceKz: number, reason?: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/balance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ newBalanceKz, reason }),
    });
    return handleResponse<any>(resp);
  },

  getUsersReconciliation: async () => {
    const headers = await getAuthHeaders(false);
    const resp = await fetch('/api/amm/reconciliation/users', { headers });
    return handleResponse<{ accounts: any[]; positions: any[] }>(resp);
  },

  executeBotSandboxLiquidity: async (payload: {
    marketId: string;
    botId?: string;
    outcome: 'Yes' | 'No';
    amountKz: number;
  }) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/sandbox/bot-liquidity', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(resp);
  },

  // --- AMM Control Center ---
  getOverview: async () => {
    const headers = await getAuthHeaders(false);
    const resp = await fetch('/api/amm/overview', { headers });
    return handleResponse<any>(resp);
  },

  getMarketDetails: async (marketId: string) => {
    const headers = await getAuthHeaders(false);
    const resp = await fetch(`/api/amm/markets/${encodeURIComponent(marketId)}`, { headers });
    return handleResponse<any>(resp);
  },

  getLedger: async () => {
    const headers = await getAuthHeaders(false);
    const resp = await fetch('/api/amm/ledger', { headers });
    return handleResponse<any>(resp);
  },

  requestAllocation: async (payload: {
    marketId: string;
    marketQuestion: string;
    allocatedCapitalKz: number;
    yesPriceCents?: number;
    noPriceCents?: number;
    justification: string;
  }) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/allocations/request', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(resp);
  },

  decideAllocation: async (
    marketId: string,
    payload: {
      decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
      allocatedCapitalKz?: number;
      justification: string;
    }
  ) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch(`/api/amm/allocations/${encodeURIComponent(marketId)}/decide`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(resp);
  },

  toggleAmm: async (enable: boolean, justification: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/toggle', {
      method: 'POST',
      headers,
      body: JSON.stringify({ enable, justification }),
    });
    return handleResponse<any>(resp);
  },

  emergencyStop: async (justification: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/emergency-stop', {
      method: 'POST',
      headers,
      body: JSON.stringify({ justification }),
    });
    return handleResponse<any>(resp);
  },

  resumeAfterInvestigation: async (payload: {
    marketId?: string;
    investigationFindings: string;
    justification: string;
  }) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/resume', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(resp);
  },

  updateLimits: async (payload: {
    warningPct: number;
    protectionPct: number;
    haltPct: number;
    maxAllocationBudgetKz: number;
    justification: string;
  }) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/limits', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(resp);
  },

  triggerStrategyTick: async (marketId?: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/strategy/tick', {
      method: 'POST',
      headers,
      body: JSON.stringify({ marketId }),
    });
    return handleResponse<any>(resp);
  },

  runSandboxTests: async () => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/amm/sandbox/run-tests', {
      method: 'POST',
      headers,
    });
    return handleResponse<any>(resp);
  },

  // --- Executive Dashboard, CLOB Control, Candles, PnL, Reconciliation & System Health ---
  getAdminActor: async () => {
    const headers = await getAuthHeaders(false);
    const resp = await fetch('/api/admin/actor', { headers });
    return handleResponse<{ uid: string; email: string; role: 'MASTER_ADMIN' | 'OPERATIONAL_ADMIN' | 'USER'; isMasterAdmin: boolean }>(resp);
  },

  getClobCandles: async (marketId: string, interval: '5m' | '15m' | '1h' | '4h' | '1d' = '1h', outcome: 'Yes' | 'No' = 'Yes') => {
    const qs = new URLSearchParams({ interval, outcome });
    const resp = await fetch(`/api/clob/candles/${encodeURIComponent(marketId)}?${qs.toString()}`);
    return handleResponse<{
      marketId: string;
      outcome: 'Yes' | 'No';
      interval: string;
      candles: Array<{
        timestamp: string;
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volumeKz: number;
        trades: number;
        isUp: boolean;
      }>;
    }>(resp);
  },

  getDashboardOverview: async (params: { period: string; from?: string; to?: string }) => {
    const headers = await getAuthHeaders(false);
    const qs = new URLSearchParams({ period: params.period });
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const resp = await fetch(`/api/admin/dashboard/overview?${qs.toString()}`, { headers });
    return handleResponse<any>(resp);
  },

  getClobOverview: async (params: {
    period: string;
    from?: string;
    to?: string;
    marketId?: string;
    status?: string;
    side?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const headers = await getAuthHeaders(false);
    const qs = new URLSearchParams({ period: params.period });
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.marketId) qs.set('marketId', params.marketId);
    if (params.status) qs.set('status', params.status);
    if (params.side) qs.set('side', params.side);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const resp = await fetch(`/api/admin/clob/overview?${qs.toString()}`, { headers });
    return handleResponse<any>(resp);
  },

  getProfitAndLoss: async (params: { period: string; from?: string; to?: string; marketId?: string; source?: string }) => {
    const headers = await getAuthHeaders(false);
    const qs = new URLSearchParams({ period: params.period });
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.marketId) qs.set('marketId', params.marketId);
    if (params.source) qs.set('source', params.source);
    const resp = await fetch(`/api/admin/pnl?${qs.toString()}`, { headers });
    return handleResponse<any>(resp);
  },

  getReconciliationOverview: async () => {
    const headers = await getAuthHeaders(false);
    const resp = await fetch('/api/admin/reconciliation/overview', { headers });
    return handleResponse<any>(resp);
  },

  runAuditedReconciliation: async (justification: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/admin/reconciliation/run', {
      method: 'POST',
      headers,
      body: JSON.stringify({ justification }),
    });
    return handleResponse<any>(resp);
  },

  getSystemHealth: async () => {
    const headers = await getAuthHeaders(false);
    const resp = await fetch('/api/admin/system-health', { headers });
    return handleResponse<any>(resp);
  },

  getGlobalAudit: async (action?: string, limit = 100) => {
    const headers = await getAuthHeaders(false);
    const qs = new URLSearchParams({ limit: String(limit) });
    if (action) qs.set('action', action);
    const resp = await fetch(`/api/admin/audit-global?${qs.toString()}`, { headers });
    return handleResponse<any>(resp);
  },

  updateUserAdminRole: async (uid: string, grantOperationalAdmin: boolean, justification: string) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/role`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ grantOperationalAdmin, justification }),
    });
    return handleResponse<any>(resp);
  },

  updateMasterPlatformSettings: async (payload: {
    tradingFee: number;
    minDeposit: number;
    minWithdrawal: number;
    maintenanceMode: boolean;
    platformName: string;
    justification: string;
  }) => {
    const headers = await getAuthHeaders(true);
    const resp = await fetch('/api/admin/platform-settings', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(resp);
  },
};
