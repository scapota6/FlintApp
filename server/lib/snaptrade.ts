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
    // Try the correct method name for getting positions
    const response = await accountsApi.getAllUserHoldings({ userId, userSecret, accountId });
    return response.data;
  } catch (e: any) {
    // If that doesn't work, try alternate method
    try {
      const response = await (accountsApi as any).getPositions({ userId, userSecret, accountId });
      return response.data;
    } catch {
      // Log the error and return empty array
      console.error('Failed to get positions for account:', accountId, e?.message);
      return [];
    }
  }
}