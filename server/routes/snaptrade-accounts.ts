import { Router } from 'express';
import { authApi, accountsApi, getUserAccountDetails, getUserAccountBalance, getUserAccountPositions, getUserAccountOrders, getAccountActivities } from '../lib/snaptrade';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import { mapSnapTradeError, logSnapTradeError, checkConnectionStatus, RateLimitHandler } from '../lib/snaptrade-errors';
import type { AccountSummary, ListAccountsResponse, AccountDetails, AccountDetailsResponse, AccountBalances, AccountBalancesResponse, Position, PositionsResponse, Order, OrdersResponse, OrderSide, OrderType, TimeInForce, Activity, ActivitiesResponse, ActivityType, OptionHolding, OptionHoldingsResponse, AccountBalance, AccountPositions, AccountOrders, AccountActivities, ErrorResponse, ListResponse, DetailsResponse, ISODate, UUID, Money } from '@shared/types';

const router = Router();

// Helper function to get Flint user by auth claims
async function getFlintUserByAuth(authUser: any) {
  const userId = authUser?.claims?.sub;
  if (!userId) throw new Error('User ID required');
  
  const user = await storage.getUser(userId);
  if (!user) throw new Error('User not found');
  return user;
}

// Helper function to get SnapTrade credentials
async function getSnaptradeCredentials(flintUserId: string) {
  const credentials = await storage.getSnapTradeUser(flintUserId);
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
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret
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
        await storage.deleteSnapTradeUser(flintUser.id);
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
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  console.log(`[DEBUG ${requestId}] === Account Details Request START ===`);
  console.log(`[DEBUG ${requestId}] Request headers:`, {
    authorization: req.headers.authorization ? 'present' : 'missing',
    cookie: req.headers.cookie ? 'present' : 'missing',
    userAgent: req.headers['user-agent']
  });
  console.log(`[DEBUG ${requestId}] Session status:`, {
    isAuthenticated: req.isAuthenticated(),
    user: req.user ? {
      email: req.user.claims?.email,
      sub: req.user.claims?.sub,
      expiresAt: req.user.expires_at,
      hasRefreshToken: !!req.user.refresh_token
    } : 'null'
  });
  
  try {
    console.log(`[DEBUG ${requestId}] Getting Flint user by auth...`);
    const flintUser = await getFlintUserByAuth(req.user);
    console.log(`[DEBUG ${requestId}] Flint user found:`, { id: flintUser.id, email: flintUser.email });
    
    console.log(`[DEBUG ${requestId}] Getting SnapTrade credentials...`);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    console.log(`[DEBUG ${requestId}] SnapTrade credentials found:`, {
      snaptradeUserId: credentials.snaptradeUserId,
      hasUserSecret: !!credentials.snaptradeUserSecret
    });
    
    // Server-side debugging breadcrumb
    console.log(`[BREADCRUMB ${requestId}] user=${req.user?.claims?.sub} hasSession=${!!req.user} accountId=${req.params.accountId}`);
    res.setHeader('X-Debug-Reason', 'OK');
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Accounts] Getting account details:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get detailed account information
    const accountDetails = await accountsApi.getUserAccountDetails({
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
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
    
    const accountDetailsDto: AccountDetails = {
      id: account.id as UUID,
      institution: account.institution_name,
      name: account.name === 'Default' 
        ? `${account.institution_name} ${account.meta?.type || account.raw_type || 'Account'}`.trim()
        : account.name,
      numberMasked,
      type: account.meta?.brokerage_account_type || account.meta?.type || account.raw_type || null,
      status,
      currency: account.balance?.total?.currency || 'USD'
    };
    
    const response: AccountDetailsResponse = {
      account: accountDetailsDto
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
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
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
    const accountBalances: AccountBalances = {
      total: (balances as any).total ? {
        amount: parseFloat((balances as any).total.amount) || 0,
        currency: (balances as any).total.currency || 'USD'
      } : null,
      cash: (balances as any).cash ? {
        amount: parseFloat((balances as any).cash.amount) || 0,
        currency: (balances as any).cash.currency || 'USD'
      } : null,
      buyingPower: (balances as any).buying_power ? {
        amount: parseFloat((balances as any).buying_power.amount) || 0,
        currency: (balances as any).buying_power.currency || 'USD'
      } : null,
      maintenanceExcess: (balances as any).maintenance_excess ? {
        amount: parseFloat((balances as any).maintenance_excess.amount) || 0,
        currency: (balances as any).maintenance_excess.currency || 'USD'
      } : null
    };
    
    const response: AccountBalancesResponse = {
      balances: accountBalances
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
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
      accountId
    });
    
    const positions = positionsResponse.data || [];
    
    console.log('[SnapTrade Accounts] Fetched', positions.length, 'positions for account:', accountId);
    
    // Transform positions to normalized DTO
    const transformedPositions: Position[] = positions.map((position: any) => ({
      symbol: position.symbol?.symbol?.symbol || position.symbol?.raw_symbol || position.symbol?.symbol || 'Unknown',
      description: position.symbol?.symbol?.description || position.symbol?.description || null,
      quantity: position.units || position.fractional_units || 0,
      avgPrice: position.average_purchase_price ? {
        amount: position.average_purchase_price,
        currency: position.currency?.code || 'USD'
      } : null,
      marketPrice: position.price ? {
        amount: position.price,
        currency: position.currency?.code || 'USD'
      } : null,
      marketValue: position.price ? {
        amount: (position.units || position.fractional_units || 0) * position.price,
        currency: position.currency?.code || 'USD'
      } : null,
      unrealizedPnl: position.open_pnl ? {
        amount: position.open_pnl,
        currency: position.currency?.code || 'USD'
      } : null,
      currency: position.currency?.code || 'USD'
    }));
    
    const response: PositionsResponse = {
      accountId: accountId as UUID,
      positions: transformedPositions,
      asOf: new Date().toISOString() as ISODate
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
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
      accountId
    });
    
    const orders = ordersResponse.data || [];
    
    console.log('[SnapTrade Accounts] Fetched', orders.length, 'orders for account:', accountId);
    
    // Transform orders to normalized DTO  
    const transformedOrders: Order[] = orders.map((order: any) => {
      // Map SnapTrade side to your enum
      const side: OrderSide = (order.action || '').toLowerCase() === 'buy' ? 'buy' : 'sell';
      
      // Map SnapTrade order type to your enum
      let type: OrderType = 'market';
      const orderTypeStr = (order.order_type || '').toLowerCase();
      if (orderTypeStr.includes('limit') && orderTypeStr.includes('stop')) {
        type = 'stop_limit';
      } else if (orderTypeStr.includes('limit')) {
        type = 'limit';
      } else if (orderTypeStr.includes('stop')) {
        type = 'stop';
      }
      
      // Map SnapTrade status to your enum
      let status: Order['status'] = 'unknown';
      const statusStr = (order.status || '').toLowerCase();
      if (statusStr.includes('pending') || statusStr.includes('open')) {
        status = 'open';
      } else if (statusStr.includes('filled') || statusStr.includes('executed')) {
        status = 'filled';
      } else if (statusStr.includes('cancelled')) {
        status = 'cancelled';
      } else if (statusStr.includes('rejected')) {
        status = 'rejected';
      } else if (statusStr.includes('partial')) {
        status = 'partial_filled';
      }
      
      // Map time in force
      let timeInForce: TimeInForce | null = null;
      const tifStr = (order.time_in_force || '').toLowerCase();
      if (tifStr.includes('gtc')) {
        timeInForce = 'gtc';
      } else if (tifStr.includes('ioc')) {
        timeInForce = 'ioc';
      } else if (tifStr.includes('fok')) {
        timeInForce = 'fok';
      } else if (tifStr.includes('day')) {
        timeInForce = 'day';
      }
      
      return {
        id: order.id,
        placedAt: order.created_at || null,
        status,
        side,
        type,
        timeInForce,
        symbol: order.symbol?.symbol?.symbol || order.symbol?.raw_symbol || 'Unknown',
        quantity: order.quantity || 0,
        limitPrice: order.price ? {
          amount: order.price,
          currency: order.currency || 'USD'
        } : null,
        averageFillPrice: order.fill_price || order.average_fill_price ? {
          amount: order.fill_price || order.average_fill_price,
          currency: order.currency || 'USD'
        } : null
      };
    });
    
    const response: OrdersResponse = {
      orders: transformedOrders
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
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
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
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
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
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
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
      credentials.snaptradeUserId!,
      credentials.userSecret,
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
      credentials.snaptradeUserId!,
      credentials.userSecret,
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
    
    // Get positions using fine-grained API
    const positionsResponse = await accountsApi.getUserAccountPositions({
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
      accountId
    });
    
    const positions = positionsResponse.data || [];
    
    // Transform positions to normalized DTO
    const transformedPositions: Position[] = positions.map((position: any) => ({
      symbol: position.symbol?.symbol?.symbol || position.symbol?.raw_symbol || position.symbol?.symbol || 'Unknown',
      description: position.symbol?.symbol?.description || position.symbol?.description || null,
      quantity: position.units || position.fractional_units || 0,
      avgPrice: position.average_purchase_price ? {
        amount: position.average_purchase_price,
        currency: position.currency?.code || 'USD'
      } : null,
      marketPrice: position.price ? {
        amount: position.price,
        currency: position.currency?.code || 'USD'
      } : null,
      marketValue: position.price ? {
        amount: (position.units || position.fractional_units || 0) * position.price,
        currency: position.currency?.code || 'USD'
      } : null,
      unrealizedPnl: position.open_pnl ? {
        amount: position.open_pnl,
        currency: position.currency?.code || 'USD'
      } : null,
      currency: position.currency?.code || 'USD'
    }));
    
    const response: PositionsResponse = {
      accountId: accountId as UUID,
      positions: transformedPositions,
      asOf: new Date().toISOString() as ISODate
    };
    
    res.json(response);
    
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
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    
    console.log('[SnapTrade Accounts] Getting account orders:', {
      flintUserId: flintUser.id,
      accountId,
      status,
      from,
      to
    });
    
    // Get orders with optional status filter
    const ordersResponse = await accountsApi.getUserAccountOrders({
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
      accountId
    });
    
    let orders = ordersResponse.data || [];
    
    // Apply status filter if provided
    if (status && status !== 'all') {
      orders = orders.filter((order: any) => {
        const orderStatus = (order.status || '').toLowerCase();
        if (status === 'open') {
          return orderStatus.includes('pending') || orderStatus.includes('open');
        }
        return orderStatus.includes(status.toLowerCase());
      });
    }
    
    // Apply date filters if provided
    if (from || to) {
      orders = orders.filter((order: any) => {
        const orderDate = new Date(order.created_at);
        if (from && orderDate < new Date(from)) return false;
        if (to && orderDate > new Date(to)) return false;
        return true;
      });
    }
    
    // Transform orders to normalized DTO  
    const transformedOrders: Order[] = orders.map((order: any) => {
      // Map SnapTrade side to your enum
      const side: OrderSide = (order.action || '').toLowerCase() === 'buy' ? 'buy' : 'sell';
      
      // Map SnapTrade order type to your enum
      let type: OrderType = 'market';
      const orderTypeStr = (order.order_type || '').toLowerCase();
      if (orderTypeStr.includes('limit') && orderTypeStr.includes('stop')) {
        type = 'stop_limit';
      } else if (orderTypeStr.includes('limit')) {
        type = 'limit';
      } else if (orderTypeStr.includes('stop')) {
        type = 'stop';
      }
      
      // Map SnapTrade status to your enum
      let orderStatus: Order['status'] = 'unknown';
      const statusStr = (order.status || '').toLowerCase();
      if (statusStr.includes('pending') || statusStr.includes('open')) {
        orderStatus = 'open';
      } else if (statusStr.includes('filled') || statusStr.includes('executed')) {
        orderStatus = 'filled';
      } else if (statusStr.includes('cancelled')) {
        orderStatus = 'cancelled';
      } else if (statusStr.includes('rejected')) {
        orderStatus = 'rejected';
      } else if (statusStr.includes('partial')) {
        orderStatus = 'partial_filled';
      }
      
      // Map time in force
      let timeInForce: TimeInForce | null = null;
      const tifStr = (order.time_in_force || '').toLowerCase();
      if (tifStr.includes('gtc')) {
        timeInForce = 'gtc';
      } else if (tifStr.includes('ioc')) {
        timeInForce = 'ioc';
      } else if (tifStr.includes('fok')) {
        timeInForce = 'fok';
      } else if (tifStr.includes('day')) {
        timeInForce = 'day';
      }
      
      return {
        id: order.id,
        placedAt: order.created_at || null,
        status: orderStatus,
        side,
        type,
        timeInForce,
        symbol: order.symbol?.symbol?.symbol || order.symbol?.raw_symbol || 'Unknown',
        quantity: order.quantity || 0,
        limitPrice: order.price ? {
          amount: order.price,
          currency: order.currency || 'USD'
        } : null,
        averageFillPrice: order.fill_price || order.average_fill_price ? {
          amount: order.fill_price || order.average_fill_price,
          currency: order.currency || 'USD'
        } : null
      };
    });
    
    const response: OrdersResponse = {
      orders: transformedOrders
    };
    
    res.json(response);
    
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
    const activitiesResponse = await accountsApi.getAccountActivities({
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
      accountId
    });
    
    let activities = activitiesResponse.data || [];
    
    // Apply date filters if provided
    if (from || to) {
      activities = activities.filter((activity: any) => {
        const activityDate = new Date(activity.trade_date || activity.settlement_date);
        if (from && activityDate < new Date(from)) return false;
        if (to && activityDate > new Date(to)) return false;
        return true;
      });
    }
    
    // Transform activities to normalized DTO
    const transformedActivities: Activity[] = activities.map((activity: any) => {
      // Map SnapTrade activity type to your enum
      let type: ActivityType = 'trade';
      const activityType = (activity.type || '').toLowerCase();
      if (activityType.includes('dividend')) {
        type = 'dividend';
      } else if (activityType.includes('interest')) {
        type = 'interest';
      } else if (activityType.includes('fee') || activityType.includes('commission')) {
        type = 'fee';
      } else if (activityType.includes('transfer') || activityType.includes('deposit') || activityType.includes('withdrawal')) {
        type = 'transfer';
      }
      
      return {
        id: activity.id,
        date: (activity.trade_date || activity.settlement_date) as ISODate,
        type,
        description: activity.description || `${activity.type || 'Activity'} ${activity.symbol?.symbol?.symbol || ''}`.trim(),
        amount: {
          amount: parseFloat(activity.net_amount || activity.price || activity.quantity || '0') || 0,
          currency: activity.currency || 'USD'
        },
        symbol: activity.symbol?.symbol?.symbol || activity.symbol?.raw_symbol || null
      };
    });
    
    const response: ActivitiesResponse = {
      activities: transformedActivities
    };
    
    res.json(response);
    
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

/**
 * GET /api/snaptrade/options/:accountId/holdings
 * Get options holdings for an account (optional endpoint)
 */
router.get('/options/:accountId/holdings', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const accountId = req.params.accountId;
    
    console.log('[SnapTrade Options] Getting options holdings:', {
      flintUserId: flintUser.id,
      accountId
    });
    
    // Get positions and filter for options
    const positionsResponse = await accountsApi.getUserAccountPositions({
      userId: credentials.snaptradeUserId!,
      userSecret: credentials.userSecret,
      accountId
    });
    
    const positions = positionsResponse.data || [];
    
    // Filter for options positions (typically have longer symbols with strike/expiry)
    const optionsPositions = positions.filter((position: any) => {
      const symbol = position.symbol?.symbol?.symbol || position.symbol?.raw_symbol || '';
      // Options typically have OCC symbols with spaces and specific format
      return symbol.length > 10 && (symbol.includes('C') || symbol.includes('P')) && /\d{6}/.test(symbol);
    });
    
    // Transform options positions to normalized DTO
    const transformedOptions: OptionHolding[] = optionsPositions.map((position: any) => ({
      symbol: position.symbol?.symbol?.symbol || position.symbol?.raw_symbol || 'Unknown',
      description: position.symbol?.symbol?.description || position.symbol?.description || null,
      quantity: position.units || position.fractional_units || 0,
      marketPrice: position.price ? {
        amount: position.price,
        currency: position.currency?.code || 'USD'
      } : null,
      marketValue: position.price ? {
        amount: (position.units || position.fractional_units || 0) * position.price,
        currency: position.currency?.code || 'USD'
      } : null,
      unrealizedPnl: position.open_pnl ? {
        amount: position.open_pnl,
        currency: position.currency?.code || 'USD'
      } : null
    }));
    
    const response: OptionHoldingsResponse = {
      holdings: transformedOptions
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_options_holdings', error, requestId, { accountId: req.params.accountId });
    
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