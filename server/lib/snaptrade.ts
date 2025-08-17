import * as Snaptrade from 'snaptrade-typescript-sdk';

const cfg = new Snaptrade.Configuration({
  clientId: process.env.SNAPTRADE_CLIENT_ID!,
  consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
});

export const authApi = new Snaptrade.AuthenticationApi(cfg);
export const accountsApi = new Snaptrade.AccountInformationApi(cfg);
export const portfolioApi = new Snaptrade.TransactionsAndReportingApi(cfg);

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
    broker: 'ALPACA',
    immediateRedirect: true,
    customRedirect: params.redirect,
  });
  return login.data as any;
}

export async function listAccounts(userId: string, userSecret: string) {
  const response = await accountsApi.listUserAccounts({ userId, userSecret });
  return response.data;
}

export async function getPositions(userId: string, userSecret: string, accountId: string) {
  // Using any type to bypass TypeScript method name issues temporarily
  const response = await (accountsApi as any).getAccountHoldings({ userId, userSecret, accountId });
  return response.data;
}