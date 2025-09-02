/**
 * SnapTrade Account Information endpoints
 * Comprehensive account data: details, balances, positions, holdings, orders, activities
 */

import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { 
  listAccounts, 
  getAccountPositionsDetailed,
  getAllUserHoldings,
  getUserAccountOrders,
  getUserAccountActivities,
  getUserAccountBalance,
  getSnapTradeAccountDetails
} from '../lib/snaptrade';
import { extractSnapTradeRequestId, createApiError, validate } from '../lib/validation';
import type { ErrorResponse, Account, Position, Holding, Order, Activity } from '@shared/types';

const router = Router();

// Helper to get SnapTrade credentials for authenticated user
async function getSnapTradeCredentials(email: string) {
  const flintUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email)
  });
  
  if (!flintUser) {
    throw new Error('User not found');
  }
  
  const [credentials] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.flintUserId, flintUser.id))
    .limit(1);
  
  if (!credentials) {
    throw new Error('SnapTrade account not connected');
  }
  
  return {
    userId: credentials.flintUserId,
    userSecret: credentials.userSecret
  };
}

/**
 * GET /api/snaptrade/accounts
 * List all user accounts from all connected brokerages
 */
router.get('/accounts', isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Account Info] Listing user accounts:', {
      email,
      userId: credentials.userId
    });
    
    // Get all user accounts from SnapTrade
    const accountsData = await listAccounts(credentials.userId, credentials.userSecret);
    
    console.log('[SnapTrade Account Info] Listed user accounts:', {
      count: accountsData?.length || 0
    });
    
    // Transform to normalized DTO format
    const accounts: Account[] = (accountsData || []).map((account: any) => ({
      id: account.id,
      name: account.name || 'Unknown Account',
      number: account.number || null,
      institutionName: account.institution_name || null,
      brokerageAuthorizationId: account.brokerage_authorization || null,
      accountType: account.meta?.type || null,
      status: account.status || null,
      balance: {
        total: account.balance?.total?.amount || 0,
        currency: account.balance?.total?.currency || 'USD'
      },
      syncStatus: {
        holdingsLastSync: account.sync_status?.holdings?.last_successful_sync || null,
        transactionsLastSync: account.sync_status?.transactions?.last_successful_sync || null,
        initialSyncCompleted: account.sync_status?.holdings?.initial_sync_completed || false
      },
      createdAt: account.created_date || null,
      rawType: account.raw_type || null,
      cashRestrictions: account.cash_restrictions || []
    }));
    
    res.json({
      accounts
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Account Info] Error listing accounts:', {
      email: req.user?.claims?.email,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to list accounts',
      error.response?.data?.code || 'LIST_ACCOUNTS_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId
 * Get detailed information for a specific account
 */
router.get('/accounts/:accountId', isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Account Info] Getting account details:', {
      email,
      accountId
    });
    
    // Get account details from SnapTrade (this may not be a direct API - use account list filter)
    const accountsData = await listAccounts(credentials.userId, credentials.userSecret);
    const accountDetail = accountsData?.find((acc: any) => acc.id === accountId);
    
    if (!accountDetail) {
      return res.status(404).json({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
          requestId: null
        }
      });
    }
    
    console.log('[SnapTrade Account Info] Retrieved account details:', {
      accountId,
      institutionName: accountDetail.institution_name
    });
    
    // Transform to normalized DTO format
    const account: Account = {
      id: accountDetail.id,
      name: accountDetail.name || 'Unknown Account',
      number: accountDetail.number || null,
      institutionName: accountDetail.institution_name || null,
      brokerageAuthorizationId: accountDetail.brokerage_authorization || null,
      accountType: accountDetail.meta?.type || null,
      status: accountDetail.status || null,
      balance: {
        total: accountDetail.balance?.total?.amount || 0,
        currency: accountDetail.balance?.total?.currency || 'USD'
      },
      syncStatus: {
        holdingsLastSync: accountDetail.sync_status?.holdings?.last_successful_sync || null,
        transactionsLastSync: accountDetail.sync_status?.transactions?.last_successful_sync || null,
        initialSyncCompleted: accountDetail.sync_status?.holdings?.initial_sync_completed || false
      },
      createdAt: accountDetail.created_date || null,
      rawType: accountDetail.raw_type || null,
      cashRestrictions: accountDetail.cash_restrictions || [],
      // Extended details
      meta: accountDetail.meta || null
    };
    
    res.json({
      account
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Account Info] Error getting account details:', {
      accountId: req.params.accountId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get account details',
      error.response?.data?.code || 'GET_ACCOUNT_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/positions
 * Get account positions (holdings) using fine-grained API
 */
router.get('/accounts/:accountId/positions', isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Account Info] Getting account positions:', {
      email,
      accountId
    });
    
    // Get account positions using fine-grained API
    const positionsData = await getAccountPositionsDetailed(credentials.userId, credentials.userSecret, accountId);
    
    console.log('[SnapTrade Account Info] Retrieved account positions:', {
      accountId,
      count: positionsData?.length || 0
    });
    
    // Transform to normalized DTO format
    const positions: Position[] = (positionsData || []).map((position: any) => ({
      symbol: position.symbol?.symbol || null,
      symbolId: position.symbol?.id || null,
      description: position.symbol?.description || null,
      quantity: parseFloat(position.units) || 0,
      averagePrice: parseFloat(position.average_price) || 0,
      price: parseFloat(position.price) || 0,
      avgPrice: { amount: parseFloat(position.average_price) || 0, currency: position.currency?.code || 'USD' },
      marketPrice: { amount: parseFloat(position.price) || 0, currency: position.currency?.code || 'USD' },
      marketValue: parseFloat(position.market_value) || 0,
      unrealizedPnl: parseFloat(position.unrealized_pnl) || 0,
      unrealizedPnlPercent: parseFloat(position.unrealized_pnl_percent) || 0,
      currency: position.currency?.code || 'USD',
      accountId: accountId
    }));
    
    res.json({
      positions,
      accountId
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Account Info] Error getting account positions:', {
      accountId: req.params.accountId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get account positions',
      error.response?.data?.code || 'GET_POSITIONS_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/orders
 * Get account orders/trades
 */
router.get('/accounts/:accountId/orders', isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Account Info] Getting account orders:', {
      email,
      accountId
    });
    
    // Get account orders from SnapTrade
    const ordersData = await getUserAccountOrders(credentials.userId, credentials.userSecret, accountId);
    
    console.log('[SnapTrade Account Info] Retrieved account orders:', {
      accountId,
      count: ordersData?.length || 0
    });
    
    // Transform to normalized DTO format
    const orders: Order[] = (ordersData || []).map((order: any) => ({
      id: order.id,
      symbol: order.symbol?.symbol || null,
      symbolId: order.symbol?.id || null,
      type: order.order_type?.type || null,
      side: order.side || null,
      quantity: parseFloat(order.universal_symbol?.units) || 0,
      price: parseFloat(order.price) || null,
      status: order.status || null,
      timeInForce: order.time_in_force || null,
      filledQuantity: parseFloat(order.filled_units) || 0,
      filledPrice: parseFloat(order.price) || null,
      createdAt: order.created_date || null,
      updatedAt: order.updated_date || null,
      accountId: accountId,
      placedAt: order.created_date || null,
      limitPrice: order.price ? { amount: parseFloat(order.price), currency: 'USD' } : null,
      averageFillPrice: order.price ? { amount: parseFloat(order.price), currency: 'USD' } : null
    }));
    
    res.json({
      orders,
      accountId
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Account Info] Error getting account orders:', {
      accountId: req.params.accountId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get account orders',
      error.response?.data?.code || 'GET_ORDERS_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/activities  
 * Get account activities/transactions
 */
router.get('/accounts/:accountId/activities', isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Account Info] Getting account activities:', {
      email,
      accountId
    });
    
    // Get account activities from SnapTrade
    const activitiesData = await getUserAccountActivities(credentials.userId, credentials.userSecret, accountId);
    
    console.log('[SnapTrade Account Info] Retrieved account activities:', {
      accountId,
      count: activitiesData?.length || 0
    });
    
    // Transform to normalized DTO format
    const activities: Activity[] = (activitiesData || []).map((activity: any) => ({
      id: activity.id,
      symbol: activity.symbol?.symbol || null,
      symbolId: activity.symbol?.id || null,
      description: activity.description || null,
      type: activity.type || null,
      tradeDate: activity.trade_date || null,
      settlementDate: activity.settlement_date || null,
      quantity: parseFloat(activity.units) || 0,
      price: parseFloat(activity.price) || null,
      amount: { amount: parseFloat(activity.net_cash) || 0, currency: activity.currency?.code || 'USD' },
      currency: activity.currency?.code || 'USD',
      accountId: accountId,
      date: activity.trade_date || activity.settlement_date || null
    }));
    
    res.json({
      activities,
      accountId
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Account Info] Error getting account activities:', {
      accountId: req.params.accountId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get account activities',
      error.response?.data?.code || 'GET_ACTIVITIES_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/holdings
 * Get all user holdings across all accounts (aggregate view)
 */
router.get('/holdings', isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Account Info] Getting all user holdings:', {
      email,
      userId: credentials.userId
    });
    
    // Get all user holdings from SnapTrade
    const holdingsData = await getAllUserHoldings(credentials.userId, credentials.userSecret);
    
    console.log('[SnapTrade Account Info] Retrieved all user holdings:', {
      count: holdingsData?.length || 0
    });
    
    // Transform to normalized DTO format
    const holdings: Holding[] = [];
    
    (holdingsData || []).forEach((accountData: any) => {
      const accountId = accountData.account?.id;
      (accountData.positions || []).forEach((position: any) => {
        holdings.push({
          symbol: position.symbol?.symbol || null,
          symbolId: position.symbol?.id || null,
          description: position.symbol?.description || null,
          quantity: parseFloat(position.units) || 0,
          averagePrice: parseFloat(position.average_price) || 0,
          price: parseFloat(position.price) || 0,
          marketValue: parseFloat(position.market_value) || 0,
          unrealizedPnl: parseFloat(position.unrealized_pnl) || 0,
          unrealizedPnlPercent: parseFloat(position.unrealized_pnl_percent) || 0,
          currency: position.currency?.code || 'USD',
          accountId: accountId,
          accountName: accountData.account?.name || null,
          institutionName: accountData.account?.institution_name || null
        });
      });
    });
    
    res.json({
      holdings
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Account Info] Error getting all holdings:', {
      email: req.user?.claims?.email,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get holdings',
      error.response?.data?.code || 'GET_HOLDINGS_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

export default router;