import { Router } from 'express';
import { authApi, accountsApi, getUserAccountDetails, getUserAccountBalance, getUserAccountPositions, getUserAccountOrders, getAccountActivities } from '../lib/snaptrade';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { users, snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { mapSnapTradeError, logSnapTradeError, checkConnectionStatus, RateLimitHandler } from '../lib/snaptrade-errors';

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
    
    // Transform accounts for frontend consumption
    const transformedAccounts = accounts.map((account: any) => ({
      id: account.id,
      brokerage: account.institution_name,
      name: account.name === 'Default' 
        ? `${account.institution_name} ${account.meta?.type || account.raw_type || 'Account'}`.trim()
        : account.name,
      number: account.number || account.account_number,
      syncStatus: {
        holdings: account.sync_status?.holdings,
        transactions: account.sync_status?.transactions
      },
      totalBalance: parseFloat(account.balance?.total?.amount || '0') || 0,
      currency: account.balance?.total?.currency || 'USD',
      type: account.meta?.brokerage_account_type || account.meta?.type || account.raw_type,
      status: account.status || 'active',
      institutionName: account.institution_name,
      createdDate: account.created_date,
      lastSynced: account.sync_status?.holdings?.last_successful_sync || account.sync_status?.transactions?.last_successful_sync
    }));
    
    res.json({
      success: true,
      accounts: transformedAccounts,
      totalAccounts: transformedAccounts.length,
      totalBalance: transformedAccounts.reduce((sum, acc) => sum + acc.totalBalance, 0)
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('list_accounts', error, requestId, { flintUserId: req.user?.claims?.sub });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    // Handle rate limiting with backoff
    if (mappedError.code === '429') {
      const remaining = RateLimitHandler.getRemainingRequests(error.headers);
      const reset = RateLimitHandler.getResetTime(error.headers);
      
      res.status(429).json({
        success: false,
        message: mappedError.userMessage,
        error: mappedError,
        retryAfter: reset,
        remaining
      });
      return;
    }
    
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
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError,
      accounts: []
    });
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
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    
    res.json({
      success: true,
      accountDetails: {
        id: account.id,
        institutionName: account.institution_name,
        name: account.name === 'Default' 
          ? `${account.institution_name} ${account.meta?.type || account.raw_type || 'Account'}`.trim()
          : account.name,
        number: account.number || account.account_number,
        status: account.status || 'active',
        rawType: account.raw_type,
        type: account.meta?.brokerage_account_type || account.meta?.type,
        currency: account.balance?.total?.currency || 'USD',
        createdDate: account.created_date,
        syncStatus: account.sync_status
      }
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_details', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_details_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
      return res.status(404).json({
        success: false,
        message: 'Account balances not found'
      });
    }
    
    // Extract balance information
    const totalBalance = parseFloat((balances as any).total?.amount || '0') || 0;
    const cashBalance = parseFloat((balances as any).cash?.amount || '0') || 0;
    const equityBalance = totalBalance - cashBalance;
    const buyingPower = parseFloat((balances as any).buying_power?.amount || '0') || null;
    
    res.json({
      success: true,
      balances: {
        total: totalBalance,
        cash: cashBalance,
        equity: equityBalance,
        buyingPower: buyingPower,
        currency: (balances as any).currency || 'USD',
        cashAvailableToTrade: cashBalance,
        totalEquityValue: equityBalance,
        buyingPowerOrMargin: buyingPower
      }
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_balances', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_balances_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    
    // Transform positions for frontend table
    const transformedPositions = positions.map((position: any) => ({
      symbol: position.symbol?.symbol?.symbol || position.symbol?.raw_symbol || position.symbol?.symbol || 'Unknown',
      name: position.symbol?.symbol?.description || position.symbol?.description || '',
      quantity: position.units || position.fractional_units || 0,
      averagePrice: position.average_purchase_price || 0, // Cost basis
      currentPrice: position.price || 0,
      marketValue: (position.units || position.fractional_units || 0) * (position.price || 0),
      unrealizedPnL: position.open_pnl || 0,
      currency: position.currency?.code || 'USD',
      type: position.symbol?.symbol?.type?.description || position.symbol?.type?.description || 'Stock'
    }));
    
    res.json({
      success: true,
      positions: transformedPositions,
      totalPositions: transformedPositions.length,
      totalMarketValue: transformedPositions.reduce((sum, pos) => sum + pos.marketValue, 0)
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_positions', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_positions_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    
    // Transform orders for frontend
    const transformedOrders = orders.map((order: any) => ({
      id: order.id,
      symbol: order.symbol?.symbol?.symbol || order.symbol?.raw_symbol || 'Unknown',
      side: order.action, // buy/sell
      quantity: order.quantity,
      orderType: order.order_type,
      price: order.price,
      timeInForce: order.time_in_force,
      status: order.status,
      filledQuantity: order.filled_quantity || 0,
      createdAt: order.created_at,
      updatedAt: order.updated_at
    }));
    
    res.json({
      success: true,
      orders: transformedOrders,
      totalOrders: transformedOrders.length
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_orders', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_orders_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    
    const transformedOrders = recentOrders.map((order: any) => ({
      id: order.id,
      symbol: order.symbol?.symbol?.symbol || order.symbol?.raw_symbol || 'Unknown',
      side: order.action,
      quantity: order.quantity,
      orderType: order.order_type,
      price: order.price,
      status: order.status,
      filledQuantity: order.filled_quantity || 0,
      createdAt: order.created_at,
      updatedAt: order.updated_at
    }));
    
    res.json({
      success: true,
      orders: transformedOrders,
      totalOrders: transformedOrders.length
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_recent_orders', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`recent_orders_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    
    // Transform activities for frontend
    const transformedActivities = activities.map((activity: any) => ({
      id: activity.id,
      type: activity.type || activity.activity_type,
      description: activity.description,
      symbol: activity.symbol?.symbol?.symbol || activity.symbol?.raw_symbol || activity.symbol,
      quantity: activity.quantity || activity.units,
      amount: activity.net_amount || activity.price,
      fee: activity.fee,
      tradeDate: activity.trade_date,
      settlementDate: activity.settlement_date,
      createdDate: activity.created_date,
      currency: activity.currency?.code || 'USD'
    }));
    
    res.json({
      success: true,
      activities: transformedActivities,
      totalActivities: transformedActivities.length
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('get_account_activities', error, requestId, { accountId: req.params.accountId });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`account_activities_${req.params.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
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
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
  }
});

export { router as snaptradeAccountsRouter };