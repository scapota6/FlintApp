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