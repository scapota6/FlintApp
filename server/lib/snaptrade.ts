import { Snaptrade } from 'snaptrade-typescript-sdk';

// Initialize SDK exactly like the official CLI
const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID!,
  consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
});

console.log('[SnapTrade SDK] Initialized with pattern from official CLI:', {
  clientId: process.env.SNAPTRADE_CLIENT_ID,
  consumerKeyLength: process.env.SNAPTRADE_CONSUMER_KEY?.length || 0
});

// Export the API instances
export const authApi = snaptrade.authentication;
export const accountsApi = snaptrade.accountInformation;
export const portfolioApi = snaptrade.transactionsAndReporting;
export const tradingApi = snaptrade.trading;

// Back-compat alias in case old code referenced a client object
export const snaptradeClient = { authApi, accountsApi, portfolioApi, tradingApi };

console.log('[SnapTrade] SDK init', {
  env: process.env.SNAPTRADE_ENV,
  clientIdTail: process.env.SNAPTRADE_CLIENT_ID?.slice(-6),
  consumerKeyLen: process.env.SNAPTRADE_CONSUMER_KEY?.length,
  redirectUri: process.env.SNAPTRADE_REDIRECT_URI,
});

// Version-safe wrapper functions
export async function registerUser(userId: string) {
  return await authApi.registerSnapTradeUser({ userId });
}

export async function createLoginUrl(params: { userId: string; userSecret: string; redirect: string }) {
  const login = await authApi.loginSnapTradeUser({
    userId: params.userId,
    userSecret: params.userSecret,
    immediateRedirect: true,
    customRedirect: params.redirect,
    connectionType: "trade", // Enable trading connections
  });
  // Return the redirectURI from the response (matches official CLI)
  return (login.data as any)?.redirectURI || (login.data as any)?.url;
}

export async function listAccounts(userId: string, userSecret: string) {
  const response = await accountsApi.listUserAccounts({ userId, userSecret });
  return response.data;
}

export async function getPositions(userId: string, userSecret: string, accountId: string) {
  try {
    // First get all holdings for the user, then filter by account
    const response = await accountsApi.getAllUserHoldings({ userId, userSecret });
    console.log('DEBUG: getAllUserHoldings response length:', response.data?.length);
    
    // Find the specific account's data
    const accountData = response.data?.find((acc: any) => acc.account?.id === accountId);
    if (accountData && accountData.positions) {
      console.log('DEBUG: Found positions for account:', accountId, 'count:', accountData.positions.length);
      // Return the account wrapped in an array to match expected structure
      return [accountData];
    }
    
    console.log('DEBUG: No positions found for account:', accountId);
    return [];
  } catch (e: any) {
    // If that doesn't work, try alternate method
    try {
      const response = await accountsApi.getUserAccountHoldings({ userId, userSecret, accountId });
      return response.data ? [response.data] : [];
    } catch (fallbackError: any) {
      console.error('SnapTrade getPositions error:', e?.responseBody || e?.message || e);
      return [];
    }
  }
}

// ===== ADDITIONAL VERSION-SAFE WRAPPER FUNCTIONS =====
function hasFn(obj: any, name: string) { return obj && typeof obj[name] === 'function'; }

export async function getAccountBalances(userId: string, userSecret: string, accountId: string) {
  // Try common names across SDK versions
  // AccountsApi: getAccountBalances or getBalances
  if (hasFn(accountsApi, 'getAccountBalances')) {
    return (accountsApi as any).getAccountBalances({ userId, userSecret, accountId });
  }
  if (hasFn(accountsApi, 'getBalances')) {
    return (accountsApi as any).getBalances({ userId, userSecret, accountId });
  }
  // Some versions expose balances on PortfolioApi
  if (hasFn((portfolioApi as any), 'getAccountBalances')) {
    return (portfolioApi as any).getAccountBalances({ userId, userSecret, accountId });
  }
  throw new Error('No balances method found');
}

// Orders API name varies; attempt both AccountsApi and PortfolioApi variants
export async function listOpenOrders(userId: string, userSecret: string, accountId: string) {
  if (hasFn(accountsApi, 'listOrders')) {
    return (accountsApi as any).listOrders({ userId, userSecret, accountId, status: 'OPEN' });
  }
  if (hasFn(accountsApi, 'getOpenOrders')) {
    return (accountsApi as any).getOpenOrders({ userId, userSecret, accountId });
  }
  if (hasFn(portfolioApi, 'getOpenOrders')) {
    return (portfolioApi as any).getOpenOrders({ userId, userSecret, accountId });
  }
  return [];
}

export async function listOrderHistory(userId: string, userSecret: string, accountId: string) {
  try {
    // Try portfolioApi first as it's more likely to have order history
    if (hasFn(portfolioApi, 'getOrderHistory')) {
      const response = await (portfolioApi as any).getOrderHistory({ userId, userSecret, accountId });
      console.log('DEBUG: Order history from portfolioApi:', response?.data?.length || 0, 'orders');
      return response?.data || [];
    }
    if (hasFn(accountsApi, 'getOrderHistory')) {
      const response = await (accountsApi as any).getOrderHistory({ userId, userSecret, accountId });
      console.log('DEBUG: Order history from accountsApi:', response?.data?.length || 0, 'orders');
      return response?.data || [];
    }
    if (hasFn(accountsApi, 'listOrders')) {
      const response = await (accountsApi as any).listOrders({ userId, userSecret, accountId, status: 'ALL' });
      console.log('DEBUG: Order history from listOrders:', response?.data?.length || 0, 'orders');
      return response?.data || [];
    }
    console.log('DEBUG: No order history methods found');
    return [];
  } catch (e: any) {
    console.error('DEBUG: Order history error:', e?.message || e);
    return [];
  }
}

// Activity / Transactions (dividends, deposits, withdrawals, trade fills, etc.)
export async function listActivities(userId: string, userSecret: string, accountId: string) {
  try {
    // Try portfolioApi first (most likely to have transactions)
    if (hasFn(portfolioApi, 'getActivities')) {
      const response = await (portfolioApi as any).getActivities({ userId, userSecret, accountId });
      console.log('DEBUG: Activities from portfolioApi.getActivities:', response?.data?.length || 0, 'items');
      return response?.data || [];
    }
    if (hasFn(portfolioApi, 'getTransactions')) {
      const response = await (portfolioApi as any).getTransactions({ userId, userSecret, accountId });
      console.log('DEBUG: Activities from portfolioApi.getTransactions:', response?.data?.length || 0, 'items');
      return response?.data || [];
    }
    if (hasFn(accountsApi, 'getActivities')) {
      const response = await (accountsApi as any).getActivities({ userId, userSecret, accountId });
      console.log('DEBUG: Activities from accountsApi.getActivities:', response?.data?.length || 0, 'items');
      return response?.data || [];
    }
    if (hasFn(accountsApi, 'getTransactions')) {
      const response = await (accountsApi as any).getTransactions({ userId, userSecret, accountId });
      console.log('DEBUG: Activities from accountsApi.getTransactions:', response?.data?.length || 0, 'items');
      return response?.data || [];
    }
    console.log('DEBUG: No activity/transaction methods found in SDK');
    return [];
  } catch (e: any) {
    console.error('DEBUG: Activities error:', e?.message || e);
    return [];
  }
}

// Order Preview and Trading Functions
export async function getOrderImpact(
  userId: string, 
  userSecret: string, 
  accountId: string, 
  params: {
    action: 'BUY' | 'SELL';
    universalSymbolId: string;
    orderType: 'Market' | 'Limit';
    timeInForce?: 'Day' | 'GTC' | 'IOC' | 'FOK';
    units: number;
    price?: number;
  }
) {
  try {
    const orderImpact = await tradingApi.getOrderImpact({
      userId,
      userSecret,
      accountId,
      action: params.action,
      universalSymbolId: params.universalSymbolId,
      orderType: params.orderType,
      timeInForce: params.timeInForce || 'Day',
      units: params.units,
      price: params.price,
    });
    
    return orderImpact.data;
  } catch (e: any) {
    console.error('SnapTrade getOrderImpact error:', e?.responseBody || e?.message || e);
    throw e;
  }
}

export async function searchSymbols(userId: string, userSecret: string, accountId: string, query: string) {
  try {
    // Try multiple search methods for compatibility
    if (hasFn(snaptrade.referenceData, 'symbolsSearchUserAccount')) {
      const response = await (snaptrade.referenceData as any).symbolsSearchUserAccount({
        userId,
        userSecret,
        accountId,
        query,
      });
      return response.data || [];
    }
    
    if (hasFn(snaptrade.referenceData, 'getSymbolsByTicker')) {
      const response = await (snaptrade.referenceData as any).getSymbolsByTicker({
        query,
      });
      return response.data || [];
    }
    
    console.log('DEBUG: No symbol search methods found');
    return [];
  } catch (e: any) {
    console.error('SnapTrade searchSymbols error:', e?.responseBody || e?.message || e);
    return [];
  }
}

export async function placeOrder(
  userId: string,
  userSecret: string,
  accountId: string,
  params: {
    action: 'BUY' | 'SELL';
    universalSymbolId: string;
    orderType: 'Market' | 'Limit';
    timeInForce?: 'Day' | 'GTC' | 'IOC' | 'FOK';
    units: number;
    price?: number;
  }
) {
  try {
    const order = await tradingApi.placeOrder({
      userId,
      userSecret,
      accountId,
      action: params.action,
      universalSymbolId: params.universalSymbolId,
      orderType: params.orderType,
      timeInForce: params.timeInForce || 'Day',
      units: params.units,
      price: params.price,
    });
    
    return order.data;
  } catch (e: any) {
    console.error('SnapTrade placeOrder error:', e?.responseBody || e?.message || e);
    throw e;
  }
}

export async function cancelOrder(userId: string, userSecret: string, accountId: string, orderId: string) {
  try {
    // Try multiple cancel methods for compatibility
    if (hasFn(tradingApi, 'cancelUserAccountOrder')) {
      const response = await (tradingApi as any).cancelUserAccountOrder({
        userId,
        userSecret,
        accountId,
        brokerageOrderId: orderId,
      });
      return response.data;
    }
    
    if (hasFn(tradingApi, 'cancelOrder')) {
      const response = await (tradingApi as any).cancelOrder({
        userId,
        userSecret,
        accountId,
        orderId,
      });
      return response.data;
    }
    
    throw new Error('No cancel order methods available in SDK');
  } catch (e: any) {
    console.error('SnapTrade cancelOrder error:', e?.responseBody || e?.message || e);
    throw e;
  }
}