import * as Snaptrade from 'snaptrade-typescript-sdk';

const env = process.env.SNAPTRADE_ENV || 'sandbox';

console.log('[SnapTrade] SDK init', {
  env,
  clientIdTail: process.env.SNAPTRADE_CLIENT_ID?.slice(-6),
  consumerKeyLen: process.env.SNAPTRADE_CONSUMER_KEY?.length,
  redirectUri: process.env.SNAPTRADE_REDIRECT_URI,
});

export const snaptradeConfig = new Snaptrade.Configuration({
  clientId: process.env.SNAPTRADE_CLIENT_ID!,
  consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
});

export const authApi = new Snaptrade.AuthenticationApi(snaptradeConfig);
export const accountsApi = new Snaptrade.AccountInformationApi(snaptradeConfig);
export const portfolioApi = new Snaptrade.TransactionsAndReportingApi(snaptradeConfig);