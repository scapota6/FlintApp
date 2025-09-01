import { Router } from 'express';
import { authApi, accountsApi, getUserAccountDetails, getUserAccountBalance, getUserAccountPositions, getUserAccountOrders, getAccountActivities } from '../lib/snaptrade';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { users, snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { mapSnapTradeError, logSnapTradeError, checkConnectionStatus, RateLimitHandler } from '../lib/snaptrade-errors';
import type { AccountSummary, ListAccountsResponse, AccountDetails, AccountBalance, AccountPositions, AccountOrders, AccountActivities, Position, Order, Activity, ErrorResponse, ListResponse, DetailsResponse, ISODate, UUID, Money } from '@shared/types';

const router = Router();

// Helper function to get Flint user by auth claims
async function getFlintUserByAuth(authUser: any) {
  const email = authUser?.claims?.email?.toLowerCase();
  if (!email) throw new Error('User email required');
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  if (!user) throw new Error('User not found');
  return user;
}

// Helper function to get SnapTrade credentials
async function getSnaptradeCredentials(flintUserId: string) {
  const [credentials] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.flintUserId, flintUserId))
    .limit(1);
  
  if (!credentials) throw new Error('User not registered with SnapTrade');
  return credentials;
}

/**
 * GET /api/snaptrade/accounts
 * List all accounts with brokerage, number, sync status, total balance, type
 * Used for Accounts page & dashboard counts
 */
router.get('/accounts', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    
    console.log('[SnapTrade Accounts] Listing accounts for user:', {
      flintUserId: flintUser.id,
      snaptradeUserId: credentials.snaptradeUserId
    });
    
    // Fetch accounts from SnapTrade
    const accountsResponse = await accountsApi.listUserAccounts({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret
    });
    
    const accounts = accountsResponse.data || [];
    
    console.log('[SnapTrade Accounts] Fetched', accounts.length, 'accounts');
    
    // Transform accounts to normalized DTO
    const transformedAccounts: AccountSummary[] = accounts.map((account: any) => {
      // Extract account number and mask it for display
      const accountNumber = account.number || account.account_number;
      const numberMasked = accountNumber ? `…${accountNumber.slice(-4)}` : null;
      
      // Determine account status
      let status: "open" | "closed" | "archived" | "unknown" = "unknown";
      if (account.status) {
        status = account.status.toLowerCase() === 'active' ? 'open' : 
                account.status.toLowerCase() === 'closed' ? 'closed' :
                account.status.toLowerCase() === 'archived' ? 'archived' : 'unknown';
      } else if (account.meta?.status) {
        status = account.meta.status.toLowerCase() === 'active' ? 'open' : 'unknown';
      }
      
      return {
        id: account.id as UUID,
        connectionId: account.brokerage_authorization as UUID,
        institution: account.institution_name,
        name: account.name === 'Default' 
          ? `${account.institution_name} ${account.meta?.type || account.raw_type || 'Account'}`.trim()
          : account.name,
        numberMasked,
        type: account.meta?.brokerage_account_type || account.meta?.type || account.raw_type || null,
        status,
        currency: account.balance?.total?.currency || 'USD',
        totalBalance: account.balance?.total ? {
          amount: parseFloat(account.balance.total.amount) || 0,
          currency: account.balance.total.currency || 'USD'
        } : null,
        lastHoldingsSyncAt: account.sync_status?.holdings?.last_successful_sync || null
      };
    });
    
    const response: ListAccountsResponse = {
      accounts: transformedAccounts
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('list_accounts', error, requestId, { flintUserId: req.user?.claims?.sub });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    // Handle authentication errors with automatic cleanup
    if (['1076', '428', '409'].includes(mappedError.code)) {
      try {
        const flintUser = await getFlintUserByAuth(req.user);
        await db.delete(snaptradeUsers).where(eq(snaptradeUsers.flintUserId, flintUser.id));
        console.log('[SnapTrade] Cleared stale credentials for user:', flintUser.id);
      } catch (cleanupError) {
        console.error('[SnapTrade] Failed to cleanup stale credentials:', cleanupError);
      }
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/details
 * Get account detail for header information
 * Returns: institution_name, name/number, status, raw_type, currency
 */
router.get('/accounts/:accountId/details', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting account details:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get detailed account information
    const accountDetails = await accountsApi.getUserAccountDetails({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId
    });
    
    const account = accountDetails.data;
    if (!account) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
          requestId: req.headers['x-request-id'] || null
        }
      };
      return res.status(404).json(errorResponse);
    }
    
    const accountDetailsDto: AccountDetails = {
      id: account.id as UUID,
      brokerageAuthId: account.brokerage_authorization as UUID,
      institutionName: account.institution_name,
      name: account.name === 'Default' 
        ? `${account.institution_name} ${account.meta?.type || account.raw_type || 'Account'}`.trim()
        : account.name,
      numberMasked: account.number || account.account_number || null,
      accountType: account.meta?.brokerage_account_type || account.meta?.type || account.raw_type || null,
      status: account.status || null,
      currency: account.balance?.total?.currency || 'USD',
      balance: account.balance?.total ? {
        amount: parseFloat(account.balance.total.amount) || 0,
        currency: account.balance.total.currency || 'USD'
      } : null,
      createdDate: account.created_date || null,
      cashRestrictions: account.cash_restrictions || null,
      meta: account.meta || null,
      syncStatus: account.sync_status ? {
        holdings: account.sync_status.holdings ? {
          lastSuccessfulSync: account.sync_status.holdings.last_successful_sync || null,
          initialSyncCompleted: account.sync_status.holdings.initial_sync_completed || null
        } : null,
        transactions: account.sync_status.transactions ? {
          lastSuccessfulSync: account.sync_status.transactions.last_successful_sync || null,
          firstTransactionDate: account.sync_status.transactions.first_transaction_date || null,
          initialSyncCompleted: account.sync_status.transactions.initial_sync_completed || null
        } : null
      } : null,
      lastSyncAt: account.sync_status?.holdings?.last_successful_sync || 
                  account.sync_status?.transactions?.last_successful_sync || null
    };
    
    const response: DetailsResponse<AccountDetails> = {
      data: accountDetailsDto,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_details', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_details_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/balances
 * List account balances for cash/equity/buying power widgets
 */
router.get('/accounts/:accountId/balances', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting account balances:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get detailed balance information
    const balanceResponse = await accountsApi.getUserAccountBalance({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId
    });
    
    const balances = balanceResponse.data;
    if (!balances) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'ACCOUNT_BALANCES_NOT_FOUND',
          message: 'Account balances not found',
          requestId: req.headers['x-request-id'] || null
        }
      };
      return res.status(404).json(errorResponse);
    }
    
    // Transform to normalized DTO
    const accountBalance: AccountBalance = {
      accountId: accountId as UUID,
      total: (balances as any).total ? {
        amount: parseFloat((balances as any).total.amount) || 0,
        currency: (balances as any).total.currency || 'USD'
      } : null,
      cash: (balances as any).cash ? {
        amount: parseFloat((balances as any).cash.amount) || 0,
        currency: (balances as any).cash.currency || 'USD'
      } : null,
      buying_power: (balances as any).buying_power ? {
        amount: parseFloat((balances as any).buying_power.amount) || 0,
        currency: (balances as any).buying_power.currency || 'USD'
      } : null,
      withdrawable: (balances as any).withdrawable ? {
        amount: parseFloat((balances as any).withdrawable.amount) || 0,
        currency: (balances as any).withdrawable.currency || 'USD'
      } : null,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    const response: DetailsResponse<AccountBalance> = {
      data: accountBalance,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_balances', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_balances_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/positions
 * List positions for holdings table: symbol, qty, avg price, market value, unrealized P/L
 */
router.get('/accounts/:accountId/positions', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting account positions:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get positions using fine-grained API (recommended by SnapTrade)
    const positionsResponse = await accountsApi.getUserAccountPositions({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId
    });
    
    const positions = positionsResponse.data || [];
    
    console.log('[SnapTrade Accounts] Fetched', positions.length, 'positions for account:', accountId);
    
    // Transform positions to normalized DTO
    const transformedPositions: Position[] = positions.map((position: any) => ({
      symbol: position.symbol?.symbol?.symbol || position.symbol?.raw_symbol || position.symbol?.symbol || 'Unknown',
      description: position.symbol?.symbol?.description || position.symbol?.description || null,
      quantity: position.units || position.fractional_units || 0,
      averagePrice: position.average_purchase_price || null,
      currentPrice: position.price || null,
      marketValue: position.price ? {
        amount: (position.units || position.fractional_units || 0) * position.price,
        currency: position.currency?.code || 'USD'
      } : null,
      costBasis: position.average_purchase_price ? {
        amount: (position.units || position.fractional_units || 0) * position.average_purchase_price,
        currency: position.currency?.code || 'USD'
      } : null,
      unrealizedPnL: position.open_pnl ? {
        amount: position.open_pnl,
        currency: position.currency?.code || 'USD'
      } : null,
      unrealizedPnLPercent: position.open_pnl && position.average_purchase_price ? 
        (position.open_pnl / ((position.units || position.fractional_units || 0) * position.average_purchase_price)) * 100 : null,
      currency: position.currency?.code || 'USD',
      lastUpdated: new Date().toISOString() as ISODate
    }));
    
    const accountPositions: AccountPositions = {
      accountId: accountId as UUID,
      positions: transformedPositions,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    const response: DetailsResponse<AccountPositions> = {
      data: accountPositions,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_positions', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_positions_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/orders
 * Get all orders for the account
 */
router.get('/accounts/:accountId/orders', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting account orders:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get orders for the account
    const ordersResponse = await accountsApi.getUserAccountOrders({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId
    });
    
    const orders = ordersResponse.data || [];
    
    console.log('[SnapTrade Accounts] Fetched', orders.length, 'orders for account:', accountId);
    
    // Transform orders to normalized DTO
    const transformedOrders: Order[] = orders.map((order: any) => ({
      id: order.id as UUID,
      accountId: accountId as UUID,
      symbol: order.symbol?.symbol?.symbol || order.symbol?.raw_symbol || 'Unknown',
      side: (order.action || '').toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
      type: (order.order_type || '').toUpperCase().includes('MARKET') ? 'MARKET' : 
            (order.order_type || '').toUpperCase().includes('LIMIT') ? 'LIMIT' : 
            (order.order_type || '').toUpperCase().includes('STOP_LIMIT') ? 'STOP_LIMIT' :
            (order.order_type || '').toUpperCase().includes('STOP') ? 'STOP' : 'MARKET',
      quantity: order.quantity || 0,
      price: order.price || null,
      stopPrice: order.stop_price || null,
      status: (order.status || '').toUpperCase().includes('PENDING') ? 'PENDING' :
              (order.status || '').toUpperCase().includes('FILLED') ? 'FILLED' :
              (order.status || '').toUpperCase().includes('CANCELLED') ? 'CANCELLED' :
              (order.status || '').toUpperCase().includes('REJECTED') ? 'REJECTED' :
              (order.status || '').toUpperCase().includes('EXPIRED') ? 'EXPIRED' : 'PENDING',
      timeInForce: (order.time_in_force || '').toUpperCase().includes('GTC') ? 'GTC' :
                   (order.time_in_force || '').toUpperCase().includes('IOC') ? 'IOC' :
                   (order.time_in_force || '').toUpperCase().includes('FOK') ? 'FOK' : 'DAY',
      filledQuantity: order.filled_quantity || null,
      avgFillPrice: order.fill_price || order.average_fill_price || null,
      fees: order.commission ? {
        amount: parseFloat(order.commission) || 0,
        currency: order.currency || 'USD'
      } : null,
      placedAt: order.created_at as ISODate,
      filledAt: order.filled_at || null,
      cancelledAt: order.cancelled_at || null
    }));
    
    const accountOrders: AccountOrders = {
      accountId: accountId as UUID,
      orders: transformedOrders,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    const response: DetailsResponse<AccountOrders> = {
      data: accountOrders,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_orders', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_orders_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/recent-orders
 * Get recent orders for the account (last 30 days)
 */
router.get('/accounts/:accountId/recent-orders', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting recent orders:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get recent orders (last 30 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const ordersResponse = await accountsApi.getUserAccountOrders({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId,
      state: 'all', // Include all order states
      days: 30 // Last 30 days
    });
    
    const orders = ordersResponse.data || [];
    
    // Filter to recent orders and sort by creation date
    const recentOrders = orders
      .filter((order: any) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate;
      })
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const transformedOrders: Order[] = recentOrders.map((order: any) => ({
      id: order.id as UUID,
      accountId: accountId as UUID,
      symbol: order.symbol?.symbol?.symbol || order.symbol?.raw_symbol || 'Unknown',
      side: (order.action || '').toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
      type: (order.order_type || '').toUpperCase().includes('MARKET') ? 'MARKET' : 
            (order.order_type || '').toUpperCase().includes('LIMIT') ? 'LIMIT' : 
            (order.order_type || '').toUpperCase().includes('STOP_LIMIT') ? 'STOP_LIMIT' :
            (order.order_type || '').toUpperCase().includes('STOP') ? 'STOP' : 'MARKET',
      quantity: order.quantity || 0,
      price: order.price || null,
      stopPrice: order.stop_price || null,
      status: (order.status || '').toUpperCase().includes('PENDING') ? 'PENDING' :
              (order.status || '').toUpperCase().includes('FILLED') ? 'FILLED' :
              (order.status || '').toUpperCase().includes('CANCELLED') ? 'CANCELLED' :
              (order.status || '').toUpperCase().includes('REJECTED') ? 'REJECTED' :
              (order.status || '').toUpperCase().includes('EXPIRED') ? 'EXPIRED' : 'PENDING',
      timeInForce: (order.time_in_force || '').toUpperCase().includes('GTC') ? 'GTC' :
                   (order.time_in_force || '').toUpperCase().includes('IOC') ? 'IOC' :
                   (order.time_in_force || '').toUpperCase().includes('FOK') ? 'FOK' : 'DAY',
      filledQuantity: order.filled_quantity || null,
      avgFillPrice: order.fill_price || order.average_fill_price || null,
      fees: order.commission ? {
        amount: parseFloat(order.commission) || 0,
        currency: order.currency || 'USD'
      } : null,
      placedAt: order.created_at as ISODate,
      filledAt: order.filled_at || null,
      cancelledAt: order.cancelled_at || null
    }));
    
    const accountOrders: AccountOrders = {
      accountId: accountId as UUID,
      orders: transformedOrders,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    const response: DetailsResponse<AccountOrders> = {
      data: accountOrders,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_recent_orders', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`recent_orders_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/activities
 * Get account activities for activity tab (dividends, fees, transfers)
 */
router.get('/accounts/:accountId/activities', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting account activities:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get account activities
    const activitiesResponse = await accountsApi.getAccountActivities({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId
    });
    
    const activities = activitiesResponse.data || [];
    
    console.log('[SnapTrade Accounts] Fetched', activities.length, 'activities for account:', accountId);
    
    // Transform activities to normalized DTO
    const transformedActivities: Activity[] = activities.map((activity: any) => ({
      id: activity.id as UUID,
      accountId: accountId as UUID,
      type: (activity.type || activity.activity_type || '').toUpperCase().includes('TRADE') ? 'TRADE' :
            (activity.type || activity.activity_type || '').toUpperCase().includes('DEPOSIT') ? 'DEPOSIT' :
            (activity.type || activity.activity_type || '').toUpperCase().includes('WITHDRAWAL') ? 'WITHDRAWAL' :
            (activity.type || activity.activity_type || '').toUpperCase().includes('DIVIDEND') ? 'DIVIDEND' :
            (activity.type || activity.activity_type || '').toUpperCase().includes('FEE') ? 'FEE' : 'OTHER',
      symbol: activity.symbol?.symbol?.symbol || activity.symbol?.raw_symbol || activity.symbol || null,
      quantity: activity.quantity || activity.units || null,
      price: activity.price || null,
      amount: activity.net_amount || activity.amount ? {
        amount: parseFloat(activity.net_amount || activity.amount) || 0,
        currency: activity.currency?.code || 'USD'
      } : null,
      fees: activity.fee ? {
        amount: parseFloat(activity.fee) || 0,
        currency: activity.currency?.code || 'USD'
      } : null,
      description: activity.description || '',
      date: activity.trade_date || activity.settlement_date || activity.created_date as ISODate,
      settleDate: activity.settlement_date || null
    }));
    
    const accountActivities: AccountActivities = {
      accountId: accountId as UUID,
      activities: transformedActivities,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    const response: DetailsResponse<AccountActivities> = {
      data: accountActivities,
      lastUpdated: new Date().toISOString() as ISODate
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_activities', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_activities_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/options/:accountId
 * Get options positions for account (optional endpoint)
 */
router.get('/options/:accountId', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting options positions:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get options positions (if supported by account)
    const optionsResponse = await accountsApi.getUserAccountPositions({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId
    });
    
    const positions = optionsResponse.data || [];
    
    // Filter only options positions
    const optionsPositions = positions.filter((position: any) => {
      const type = position.symbol?.symbol?.type?.description || position.symbol?.type?.description || '';
      return type.toLowerCase().includes('option');
    });
    
    console.log('[SnapTrade Accounts] Fetched', optionsPositions.length, 'options positions for account:', accountId);
    
    // Transform options positions
    const transformedOptions = optionsPositions.map((option: any) => ({
      symbol: option.symbol?.symbol?.symbol || option.symbol?.raw_symbol || 'Unknown',
      name: option.symbol?.symbol?.description || option.symbol?.description || '',
      quantity: option.units || option.fractional_units || 0,
      averagePrice: option.average_purchase_price || 0,
      currentPrice: option.price || 0,
      marketValue: (option.units || option.fractional_units || 0) * (option.price || 0),
      unrealizedPnL: option.open_pnl || 0,
      strikePrice: option.symbol?.symbol?.strike_price,
      expirationDate: option.symbol?.symbol?.expiration_date,
      optionType: option.symbol?.symbol?.option_type, // call/put
      currency: option.currency?.code || 'USD'
    }));
    
    res.json({
      success: true,
      optionsPositions: transformedOptions,
      totalOptions: transformedOptions.length
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_options_positions', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`options_positions_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:id/details
 * Get detailed account information
 */
router.get('/accounts/:id/details', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.id;
    
    console.log('[SnapTrade Accounts] Getting account details:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get detailed account information
    const detailsResponse = await getUserAccountDetails(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      accountId
    );
    
    res.json({
      success: true,
      account: detailsResponse
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_details', error, requestId, { accountId: req.params.id });
    
    const mappedError = mapSnapTradeError(error, requestId);
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:id/balances
 * Get account balance information
 */
router.get('/accounts/:id/balances', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.id;
    
    console.log('[SnapTrade Accounts] Getting account balances:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get balance information
    const balanceResponse = await getUserAccountBalance(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      accountId
    );
    
    res.json({
      success: true,
      balances: balanceResponse
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_balances', error, requestId, { accountId: req.params.id });
    
    const mappedError = mapSnapTradeError(error, requestId);
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:id/positions
 * Get account positions
 */
router.get('/accounts/:id/positions', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.id;
    
    console.log('[SnapTrade Accounts] Getting account positions:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get positions
    const positions = await getUserAccountPositions(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      accountId
    );
    
    res.json({
      success: true,
      positions
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_positions', error, requestId, { accountId: req.params.id });
    
    const mappedError = mapSnapTradeError(error, requestId);
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:id/orders
 * Get account orders with optional status filter
 */
router.get('/accounts/:id/orders', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.id;
    const status = req.query.status as string | undefined;
    
    console.log('[SnapTrade Accounts] Getting account orders:', {
      flintUserId: flintUser.id,
      accountId,
      status
    });
    
    // Get orders with optional status filter
    const orders = await getUserAccountOrders(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      accountId,
      status?.toUpperCase() as any
    );
    
    res.json({
      success: true,
      orders
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_orders', error, requestId, { accountId: req.params.id, status: req.query.status });
    
    const mappedError = mapSnapTradeError(error, requestId);
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:id/activities
 * Get account activities with optional date filters
 */
router.get('/accounts/:id/activities', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.id;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    
    console.log('[SnapTrade Accounts] Getting account activities:', {
      flintUserId: flintUser.id,
      accountId,
      from,
      to
    });
    
    // Get activities with optional date filters
    const activities = await getAccountActivities(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      accountId,
      from,
      to
    );
    
    res.json({
      success: true,
      activities
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_activities', error, requestId, { 
      accountId: req.params.id, 
      from: req.query.from, 
      to: req.query.to 
    });
    
    const mappedError = mapSnapTradeError(error, requestId);
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId: requestId
      }
    };
    
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

export { router as snaptradeAccountsRouter };