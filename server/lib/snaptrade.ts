import { 
  AuthenticationApi, 
  AccountInformationApi, 
  TradingApi, 
  TransactionsAndReportingApi,
  Configuration 
} from 'snaptrade-typescript-sdk';

const env = process.env.SNAPTRADE_ENV || 'sandbox';
const clientId = process.env.SNAPTRADE_CLIENT_ID;
const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;

console.log('[SnapTrade] SDK init', {
  env,
  clientIdTail: clientId?.slice(-6),
  consumerKeyLen: consumerKey?.length,
});

if (!clientId || !consumerKey) {
  console.error('[SnapTrade] Missing CLIENT_ID or CONSUMER_KEY');
}

const config = new Configuration({
  clientId: clientId!,
  consumerKey: consumerKey!,
  environment: env as 'production' | 'sandbox',
});

export const authApi = new AuthenticationApi(config);
export const accountsApi = new AccountInformationApi(config);
export const portfoliosApi = new TransactionsAndReportingApi(config);
export const ordersApi = new TradingApi(config);