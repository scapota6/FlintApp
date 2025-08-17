import * as Snaptrade from 'snaptrade-typescript-sdk';

const env = process.env.SNAPTRADE_ENV || 'sandbox';
const clientId = process.env.SNAPTRADE_CLIENT_ID!;
const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY!;

console.log('[SnapTrade] SDK init', {
  env,
  clientIdTail: clientId?.slice(-6),
  consumerKeyLen: consumerKey?.length,
  redirectUri: process.env.SNAPTRADE_REDIRECT_URI,
});

export const snaptradeConfig = new Snaptrade.Configuration({
  consumerKey,
  clientId,
  basePath: env === 'production' ? 'https://api.snaptrade.com/api/v1' : 'https://api.snaptrade.com/api/v1',
});

export const authApi = new Snaptrade.AuthenticationApi(snaptradeConfig);
export const accountsApi = new Snaptrade.AccountInformationApi(snaptradeConfig);
export const portfoliosApi = new Snaptrade.TransactionsAndReportingApi(snaptradeConfig);
export const ordersApi = new Snaptrade.TradingApi(snaptradeConfig);