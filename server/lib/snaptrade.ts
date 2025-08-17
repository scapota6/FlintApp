/**
 * SnapTrade SDK initialization and configuration
 * Single source of truth for all SnapTrade API interactions
 */
import { Snaptrade } from 'snaptrade-typescript-sdk';

// Validate environment variables
if (!process.env.SNAPTRADE_CLIENT_ID) {
  throw new Error('SNAPTRADE_CLIENT_ID is required');
}
if (!process.env.SNAPTRADE_CLIENT_SECRET) {
  throw new Error('SNAPTRADE_CLIENT_SECRET is required');
}

// Initialize the SnapTrade SDK with proper configuration
export const snaptradeClient = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID,
  consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
});

// Log configuration (without exposing secrets)
console.log('SnapTrade SDK initialized:', {
  clientId: process.env.SNAPTRADE_CLIENT_ID,
  environment: process.env.SNAPTRADE_ENV || 'sandbox',
  hasConsumerKey: !!process.env.SNAPTRADE_CLIENT_SECRET,
  consumerKeyLength: process.env.SNAPTRADE_CLIENT_SECRET.length,
});

// Export specific API modules for cleaner imports
export const authApi = snaptradeClient.authentication;
export const accountsApi = snaptradeClient.accountInformation;
export const portfoliosApi = snaptradeClient.portfolioManagement;
export const ordersApi = snaptradeClient.trading;
export const transactionsApi = snaptradeClient.transactionsAndReporting;