// server/lib/snaptrade.ts
import { Snaptrade } from 'snaptrade-typescript-sdk';

const env = process.env.SNAPTRADE_ENV || 'sandbox';
const clientId = process.env.SNAPTRADE_CLIENT_ID;
const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;

if (!clientId || !consumerKey) {
  console.error('[SnapTrade] Missing CLIENT_ID or CONSUMER_KEY');
}

console.log('[SnapTrade] SDK init', {
  env,
  clientIdTail: clientId?.slice(-6),
  consumerKeyLen: consumerKey?.length,
});

export const snaptradeClient = new Snaptrade({
  clientId: clientId!,
  consumerKey: consumerKey!,
});

export const authApi = snaptradeClient.authentication;
export const accountsApi = snaptradeClient.accountInformation;
export const portfoliosApi = snaptradeClient.portfolioManagement;
export const ordersApi = snaptradeClient.trading;