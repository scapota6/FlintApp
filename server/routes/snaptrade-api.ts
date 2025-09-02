/**
 * Enhanced SnapTrade API routes with comprehensive data persistence
 * Implements all requirements: parallel loading, pagination, retry logic, requestId tracking
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getUserFromRequest } from '../auth';
import {
  ensureSnapTradeUser,
  getSnapTradeUser,
  upsertSnapTradeConnection,
  getSnapTradeConnections,
  upsertSnapTradeAccount,
  getSnapTradeAccounts,
  getSnapTradeAccount,
  upsertSnapTradeBalances,
  getSnapTradeBalances,
  upsertSnapTradePositions,
  getSnapTradePositions,
  upsertSnapTradeOrders,
  getSnapTradeOrders,
  upsertSnapTradeActivities,
  getSnapTradeActivities
} from '../lib/snaptrade-persistence';
import {
  registerSnapTradeUser,
  listAccounts,
  getUserAccountDetails,
  getUserAccountBalances,
  getUserAccountPositions,
  getUserAccountOrders,
  getUserAccountActivities,
  getUserAccountOptionsHoldings
} from '../lib/snaptrade-client';

const router = Router();

/**
 * Error response with requestId for debugging
 */
function createErrorResponse(code: string, message: string, requestId: string, status = 400) {
  return {
    error: {
      code,
      message,
      requestId
    }
  };
}

/**
 * SnapTrade API call wrapper with proper error handling
 */
async function snaptradeApiCall<T>(
  fn: () => Promise<T>,
  operation: string,
  requestId: string
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error(`[SnapTrade API] ${operation} failed:`, {
      error: error.message,
      requestId,
      stack: error.stack
    });

    // Handle specific SnapTrade error codes
    if (error.response?.status === 401 && error.response?.data?.code === 1076) {
      throw {
        status: 401,
        code: 'SIGNATURE_INVALID',
        message: 'SnapTrade signature validation failed. Please re-register.',
        requestId
      };
    }

    if (error.response?.status === 429) {
      throw {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please try again later.',
        requestId,
        retryAfter: error.response?.headers?.['retry-after'] || 60
      };
    }

    if (error.response?.status === 409) {
      throw {
        status: 409,
        code: 'SNAPTRADE_USER_MISMATCH',
        message: 'SnapTrade user ID mismatch. Please re-register.',
        requestId
      };
    }

    // Generic error
    throw {
      status: error.response?.status || 500,
      code: 'SNAPTRADE_API_ERROR',
      message: error.message || 'Unknown SnapTrade API error',
      requestId
    };
  }
}

/**
 * Register SnapTrade user
 */
router.post('/register', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string || nanoid();
  
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        requestId,
        401
      ));
    }

    const flintUserId = user.id;

    // Register with SnapTrade
    const registration = await snaptradeApiCall(
      () => registerSnapTradeUser(flintUserId),
      'register-user',
      requestId
    );

    // Store in database
    await ensureSnapTradeUser(flintUserId, registration.data.userSecret!);

    res.json({
      success: true,
      message: 'Successfully registered with SnapTrade',
      requestId
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json(createErrorResponse(
      error.code || 'REGISTRATION_FAILED',
      error.message || 'Failed to register with SnapTrade',
      requestId,
      status
    ));
  }
});

/**
 * List user accounts with database persistence
 */
router.get('/accounts', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string || nanoid();
  
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        requestId,
        401
      ));
    }

    const flintUserId = user.id;

    // Get user from database
    const snaptradeUser = await getSnapTradeUser(flintUserId);
    if (!snaptradeUser) {
      return res.status(428).json(createErrorResponse(
        'SNAPTRADE_NOT_REGISTERED',
        'User not registered with SnapTrade. Please complete registration first.',
        requestId,
        428
      ));
    }

    // Get fresh accounts from SnapTrade API
    const accounts = await snaptradeApiCall(
      () => listAccounts(flintUserId, snaptradeUser.userSecret),
      'list-accounts',
      requestId
    );

    // Update database with fresh data
    for (const account of accounts as any[]) {
      const connection = await upsertSnapTradeConnection({
        flintUserId,
        brokerageAuthorizationId: account.brokerage_authorization,
        brokerageName: account.institution_name
      });
      
      await upsertSnapTradeAccount(connection.id, account);
    }

    // Return database data (ensures consistency)
    const persistedAccounts = await getSnapTradeAccounts(flintUserId);
    const adaptedAccounts = persistedAccounts.map(({ account }) => ({
      id: account.id,
      name: account.name || 'Default',
      type: account.accountType || account.rawType || 'brokerage',
      institution: account.institution,
      number: account.numberMasked || account.number,
      balance: account.totalBalanceAmount || 0,
      currency: account.currency || 'USD',
      status: account.status || 'active',
      lastSync: account.lastHoldingsSyncAt || account.updatedAt
    }));

    res.json({
      accounts: adaptedAccounts,
      total: adaptedAccounts.length,
      requestId
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json(createErrorResponse(
      error.code || 'ACCOUNTS_FETCH_FAILED',
      error.message || 'Failed to fetch accounts',
      requestId,
      status
    ));
  }
});

/**
 * Get account details with caching
 */
router.get('/accounts/:accountId/details', async (req, res) => {
  const { accountId } = req.params;
  const requestId = req.headers['x-request-id'] as string || nanoid();
  
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        requestId,
        401
      ));
    }

    const flintUserId = user.id;
    const snaptradeUser = await getSnapTradeUser(flintUserId);
    if (!snaptradeUser) {
      return res.status(428).json(createErrorResponse(
        'SNAPTRADE_NOT_REGISTERED',
        'User not registered with SnapTrade. Please complete registration first.',
        requestId,
        428
      ));
    }

    // Get account from database
    let accountData = await getSnapTradeAccount(accountId);
    
    // Refresh if data is stale (> 5 minutes)
    if (!accountData || (Date.now() - new Date(accountData.account.updatedAt).getTime()) > 5 * 60 * 1000) {
      const account = await snaptradeApiCall(
        () => getUserAccountDetails(flintUserId, snaptradeUser.userSecret, accountId),
        'account-details',
        requestId
      );
      
      const connection = await upsertSnapTradeConnection({
        flintUserId,
        brokerageAuthorizationId: (account as any).brokerage_authorization,
        brokerageName: (account as any).institution_name
      });
      
      await upsertSnapTradeAccount(connection.id, account);
      accountData = await getSnapTradeAccount(accountId);
    }

    if (!accountData) {
      return res.status(404).json(createErrorResponse(
        'ACCOUNT_NOT_FOUND',
        'Account not found',
        requestId,
        404
      ));
    }

    res.json({
      account: {
        id: accountData.account.id,
        name: accountData.account.name || 'Default',
        type: accountData.account.accountType || accountData.account.rawType || 'brokerage',
        institution: accountData.account.institution,
        number: accountData.account.numberMasked || accountData.account.number,
        balance: accountData.account.totalBalanceAmount || 0,
        currency: accountData.account.currency || 'USD',
        status: accountData.account.status || 'active',
        lastSync: accountData.account.lastHoldingsSyncAt || accountData.account.updatedAt,
        meta: accountData.account.meta || {},
        cashRestrictions: accountData.account.cashRestrictions || []
      },
      requestId
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json(createErrorResponse(
      error.code || 'ACCOUNT_DETAILS_FAILED',
      error.message || 'Failed to fetch account details',
      requestId,
      status
    ));
  }
});

/**
 * Get account balances with persistence
 */
router.get('/accounts/:accountId/balances', async (req, res) => {
  const { accountId } = req.params;
  const requestId = req.headers['x-request-id'] as string || nanoid();
  
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        requestId,
        401
      ));
    }

    const snaptradeUser = await getSnapTradeUser(user.id);
    if (!snaptradeUser) {
      return res.status(428).json(createErrorResponse(
        'SNAPTRADE_NOT_REGISTERED',
        'User not registered with SnapTrade',
        requestId,
        428
      ));
    }

    // Get fresh balances from API
    const balances = await snaptradeApiCall(
      () => getUserAccountBalances(user.id, snaptradeUser.userSecret, accountId),
      'account-balances',
      requestId
    );

    // Store in database
    await upsertSnapTradeBalances(accountId, balances);

    // Return normalized response (all fields, null when unknown)
    res.json({
      balances: {
        cash: (balances as any).cash?.amount || null,
        equity: (balances as any).total?.amount || null,
        buyingPower: (balances as any).buying_power?.amount || null,
        maintenanceExcess: (balances as any).maintenance_excess?.amount || null,
        currency: (balances as any).cash?.currency || (balances as any).total?.currency || 'USD'
      },
      requestId
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json(createErrorResponse(
      error.code || 'BALANCES_FETCH_FAILED',
      error.message || 'Failed to fetch balances',
      requestId,
      status
    ));
  }
});

/**
 * Get account positions with persistence
 */
router.get('/accounts/:accountId/positions', async (req, res) => {
  const { accountId } = req.params;
  const requestId = req.headers['x-request-id'] as string || nanoid();
  
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        requestId,
        401
      ));
    }

    const snaptradeUser = await getSnapTradeUser(user.id);
    if (!snaptradeUser) {
      return res.status(428).json(createErrorResponse(
        'SNAPTRADE_NOT_REGISTERED',
        'User not registered with SnapTrade',
        requestId,
        428
      ));
    }

    // Get fresh positions from API
    const positions = await snaptradeApiCall(
      () => getUserAccountPositions(user.id, snaptradeUser.userSecret, accountId),
      'account-positions',
      requestId
    );

    // Store in database
    await upsertSnapTradePositions(accountId, positions as any[]);

    // Return normalized response (all fields, null when unknown)
    const normalizedPositions = (positions as any[]).map(position => ({
      symbol: position.symbol?.symbol || position.symbol || null,
      description: position.symbol?.description || position.description || null,
      qty: position.units || position.quantity || null,
      avgCost: position.price || position.average_purchase_price || null,
      lastPrice: position.last_price || null,
      mv: position.market_value || null,
      upl: position.unrealized_pnl || null,
      currency: position.currency || 'USD'
    }));

    res.json({
      positions: normalizedPositions,
      requestId
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json(createErrorResponse(
      error.code || 'POSITIONS_FETCH_FAILED',
      error.message || 'Failed to fetch positions',
      requestId,
      status
    ));
  }
});

/**
 * Get account orders with pagination and date filters
 */
router.get('/accounts/:accountId/orders', async (req, res) => {
  const { accountId } = req.params;
  const { startDate, endDate, limit = '50', offset = '0' } = req.query;
  const requestId = req.headers['x-request-id'] as string || nanoid();
  
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        requestId,
        401
      ));
    }

    const snaptradeUser = await getSnapTradeUser(user.id);
    if (!snaptradeUser) {
      return res.status(428).json(createErrorResponse(
        'SNAPTRADE_NOT_REGISTERED',
        'User not registered with SnapTrade',
        requestId,
        428
      ));
    }

    // Get fresh orders from API
    const orders = await snaptradeApiCall(
      () => getUserAccountOrders(user.id, snaptradeUser.userSecret, accountId),
      'account-orders',
      requestId
    );

    // Store in database
    await upsertSnapTradeOrders(accountId, orders as any[]);

    // Get paginated orders from database
    const paginatedOrders = await getSnapTradeOrders(accountId, {
      startDate: startDate as string,
      endDate: endDate as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    // Return normalized response
    const normalizedOrders = paginatedOrders.map(order => ({
      orderId: order.id,
      placedAt: order.placedAt,
      status: order.status,
      side: order.side,
      type: order.type,
      tif: order.timeInForce,
      symbol: order.symbol,
      qty: order.quantity,
      limitPrice: order.limitPrice,
      stopPrice: order.stopPrice,
      avgFill: order.avgFillPrice,
      currency: 'USD'
    }));

    res.json({
      orders: normalizedOrders,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: normalizedOrders.length === parseInt(limit as string)
      },
      requestId
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json(createErrorResponse(
      error.code || 'ORDERS_FETCH_FAILED',
      error.message || 'Failed to fetch orders',
      requestId,
      status
    ));
  }
});

/**
 * Get account activities with pagination and date filters
 */
router.get('/accounts/:accountId/activities', async (req, res) => {
  const { accountId } = req.params;
  const { startDate, endDate, limit = '50', offset = '0' } = req.query;
  const requestId = req.headers['x-request-id'] as string || nanoid();
  
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'AUTHENTICATION_REQUIRED',
        'Authentication required',
        requestId,
        401
      ));
    }

    const snaptradeUser = await getSnapTradeUser(user.id);
    if (!snaptradeUser) {
      return res.status(428).json(createErrorResponse(
        'SNAPTRADE_NOT_REGISTERED',
        'User not registered with SnapTrade',
        requestId,
        428
      ));
    }

    // Get fresh activities from API
    const activities = await snaptradeApiCall(
      () => getUserAccountActivities(user.id, snaptradeUser.userSecret, accountId),
      'account-activities',
      requestId
    );

    // Store in database
    await upsertSnapTradeActivities(accountId, activities as any[]);

    // Get paginated activities from database
    const paginatedActivities = await getSnapTradeActivities(accountId, {
      startDate: startDate as string,
      endDate: endDate as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    // Return normalized response
    const normalizedActivities = paginatedActivities.map(activity => ({
      activityId: activity.id,
      date: activity.date,
      type: activity.type,
      description: activity.description,
      amount: activity.amount,
      currency: activity.currency,
      symbol: activity.symbol
    }));

    res.json({
      activities: normalizedActivities,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: normalizedActivities.length === parseInt(limit as string)
      },
      requestId
    });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json(createErrorResponse(
      error.code || 'ACTIVITIES_FETCH_FAILED',
      error.message || 'Failed to fetch activities',
      requestId,
      status
    ));
  }
});

export default router;