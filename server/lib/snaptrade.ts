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

// Back-compat alias in case old code referenced a client object
export const snaptradeClient = { authApi, accountsApi, portfolioApi };

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
  if (hasFn(accountsApi, 'listOrders')) {
    return (accountsApi as any).listOrders({ userId, userSecret, accountId, status: 'ALL' });
  }
  if (hasFn(accountsApi, 'getOrderHistory')) {
    return (accountsApi as any).getOrderHistory({ userId, userSecret, accountId });
  }
  if (hasFn(portfolioApi, 'getOrderHistory')) {
    return (portfolioApi as any).getOrderHistory({ userId, userSecret, accountId });
  }
  return [];
}

// Activity / Transactions (dividends, deposits, withdrawals, trade fills, etc.)
export async function listActivities(userId: string, userSecret: string, accountId: string) {
  // Try common activity/transactions endpoints
  if (hasFn(accountsApi, 'getActivities')) {
    return (accountsApi as any).getActivities({ userId, userSecret, accountId });
  }
  if (hasFn(portfolioApi, 'getActivities')) {
    return (portfolioApi as any).getActivities({ userId, userSecret, accountId });
  }
  if (hasFn(accountsApi, 'getTransactions')) {
    return (accountsApi as any).getTransactions({ userId, userSecret, accountId });
  }
  return [];
}