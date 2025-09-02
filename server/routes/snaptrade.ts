/**
 * Versioned SnapTrade API routes under /api/snaptrade/*
 * All responses conform to Zod DTOs with proper error handling
 */

import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { snaptradeUsers, snaptradeConnections } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { normalizeSnapTradeError } from '../lib/normalize-snaptrade-error';
import { rateLimitMiddleware, fetchWithRateLimit } from '../lib/rate-limiting';
import { handleBrokenConnection, snaptradeApiCall } from '../lib/broken-connections';
import {
  registerUser,
  listAccounts,
  getPositions,
  getAccountBalances,
  getUserAccountDetails as getAccountDetails,
  listActivities as getActivities,
  listActivities,
  searchSymbols,
  getOrderImpact as checkOrderImpact,
  placeOrder as placeOrderWithImpactId,
  authApi,
  accountsApi,
  tradingApi
} from '../lib/snaptrade';

// Import adapter functions
import {
  adaptSnapTradeUserStatus,
  adaptSnapTradeUserRegistration,
  adaptConnection,
  adaptAccountSummary,
  adaptAccountDetails,
  adaptAccountBalances,
  adaptPosition,
  adaptOrder,
  adaptActivity,
  adaptSymbolInfo
} from '../../client/src/adapters/snaptradeAdapter';

// Import Zod schemas for validation
import {
  ImpactRequestSchema,
  PlaceOrderRequestSchema
} from '../../client/src/schemas/snaptrade';

const router = Router();

/**
 * Validation helper
 */
function validate<T>(data: any, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error: any) {
    console.error('[Validation Error]:', error.errors);
    throw new Error(`Validation failed: ${error.errors?.[0]?.message || 'Invalid data'}`);
  }
}

/**
 * Rate limiting middleware for SnapTrade routes
 */
const snaptradeRateLimit = rateLimitMiddleware((req) => {
  return `snaptrade:${req.user?.id || 'anonymous'}`;
});

/**
 * Error handler for SnapTrade API calls
 */
function handleSnapTradeError(error: any, context: string, res: any) {
  const normalized = normalizeSnapTradeError(error, context);
  
  console.error(`[SnapTrade API Error] ${context}:`, {
    code: normalized.code,
    message: normalized.message,
    requestId: normalized.requestId
  });

  // Map normalized codes to HTTP status codes
  let status = 500;
  switch (normalized.code) {
    case 'SNAPTRADE_NOT_REGISTERED':
      status = 428;
      break;
    case 'SNAPTRADE_USER_MISMATCH':
    case 'CONNECTION_DISABLED':
      status = 409;
      break;
    case 'SIGNATURE_INVALID':
      status = 401;
      break;
    case 'RATE_LIMITED':
      status = 429;
      break;
    case 'CLIENT_ERROR':
      status = 400;
      break;
    default:
      status = 500;
  }

  return res.status(status).json({
    error: normalized
  });
}

/**
 * POST /api/snaptrade/register
 * Registers user if missing; persists userSecret
 */
router.post('/register', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    console.log('[SnapTrade Register] Starting registration:', { flintUserId, requestId });

    // Check if user is already registered
    const [existingUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (existingUser) {
      console.log('[SnapTrade Register] User already registered:', { 
        flintUserId, 
        hasSecret: !!existingUser.userSecret,
        requestId 
      });
      
      return res.json(adaptSnapTradeUserStatus({
        userId: flintUserId,
        userSecret: existingUser.userSecret,
        createdAt: existingUser.createdAt,
        rotatedAt: existingUser.rotatedAt
      }));
    }

    // Register new user with SnapTrade
    const registration = await snaptradeApiCall(
      () => registerUser(flintUserId),
      'register',
      'user-registration'
    );

    console.log('[SnapTrade Register] Registration successful:', { 
      flintUserId, 
      userId: registration.data.userId,
      requestId 
    });

    // Persist userSecret in database
    const [savedUser] = await db
      .insert(snaptradeUsers)
      .values({
        flintUserId: flintUserId,
        userSecret: registration.data.userSecret!
      })
      .returning();

    const response = adaptSnapTradeUserRegistration({
      userId: registration.data.userId,
      userSecret: registration.data.userSecret,
      createdAt: savedUser.createdAt
    });

    res.json(response);

  } catch (error: any) {
    return handleSnapTradeError(error, 'register', res);
  }
});

/**
 * GET /api/snaptrade/connections
 * List authorizations
 */
router.get('/connections', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Get authorizations from SnapTrade
    const authorizations = await snaptradeApiCall(
      () => authApi.listBrokerageAuthorizations({ 
        userId: flintUserId, 
        userSecret: snaptradeUser.userSecret 
      }),
      'list-connections',
      'list-authorizations'
    );

    const connections = (authorizations.data as any[]).map(adaptConnection);

    res.json({ connections });

  } catch (error: any) {
    return handleSnapTradeError(error, 'list-connections', res);
  }
});

/**
 * GET /api/snaptrade/accounts
 * List accounts (summary)
 */
router.get('/accounts', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Get accounts from SnapTrade
    const accounts = await snaptradeApiCall(
      () => listAccounts(flintUserId, snaptradeUser.userSecret),
      'list-accounts',
      'list-accounts'
    );

    const accountSummaries = accounts.map(adaptAccountSummary);

    res.json({ accounts: accountSummaries });

  } catch (error: any) {
    return handleSnapTradeError(error, 'list-accounts', res);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/details
 * Account details
 */
router.get('/accounts/:accountId/details', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  const { accountId } = req.params;
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Get account details from SnapTrade
    const accountDetails = await snaptradeApiCall(
      () => getAccountDetails(flintUserId, snaptradeUser.userSecret, accountId),
      accountId,
      'account-details'
    );

    const account = adaptAccountDetails(accountDetails);

    res.json({ account });

  } catch (error: any) {
    return handleSnapTradeError(error, 'account-details', res);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/balances
 * Account balances
 */
router.get('/accounts/:accountId/balances', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  const { accountId } = req.params;
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Get balances from SnapTrade
    const balances = await snaptradeApiCall(
      () => getAccountBalances(flintUserId, snaptradeUser.userSecret, accountId),
      accountId,
      'account-balances'
    );

    const accountBalances = adaptAccountBalances(balances);

    res.json({ balances: accountBalances });

  } catch (error: any) {
    return handleSnapTradeError(error, 'account-balances', res);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/positions
 * Account positions/holdings
 */
router.get('/accounts/:accountId/positions', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  const { accountId } = req.params;
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Get positions from SnapTrade
    const positions = await snaptradeApiCall(
      () => getPositions(flintUserId, snaptradeUser.userSecret, accountId),
      accountId,
      'account-positions'
    );

    // Extract positions from the response structure
    const positionData = positions[0]?.positions || positions || [];
    const adaptedPositions = positionData.map(adaptPosition);

    res.json({ positions: adaptedPositions });

  } catch (error: any) {
    return handleSnapTradeError(error, 'account-positions', res);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/orders
 * Recent orders with optional date paging
 */
router.get('/accounts/:accountId/orders', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  const { accountId } = req.params;
  const { startDate, endDate, page = '1', pageSize = '50' } = req.query;
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Get orders from SnapTrade  
    const orders = await snaptradeApiCall(
      () => listActivities(flintUserId, snaptradeUser.userSecret, accountId),
      accountId,
      'account-orders'
    );

    const adaptedOrders = (orders as any[]).map(adaptOrder);

    // Simple pagination (SnapTrade doesn't support native pagination)
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const startIndex = (pageNum - 1) * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    const paginatedOrders = adaptedOrders.slice(startIndex, endIndex);

    res.json({ 
      orders: paginatedOrders,
      total: adaptedOrders.length,
      page: pageNum,
      pageSize: pageSizeNum
    });

  } catch (error: any) {
    return handleSnapTradeError(error, 'account-orders', res);
  }
});

/**
 * GET /api/snaptrade/accounts/:accountId/activities
 * Activities with date filters
 */
router.get('/accounts/:accountId/activities', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  const { accountId } = req.params;
  const { startDate, endDate, page = '1', pageSize = '50' } = req.query;
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Get activities from SnapTrade
    const activities = await snaptradeApiCall(
      () => listActivities(flintUserId, snaptradeUser.userSecret, accountId),
      accountId,
      'account-activities'
    );

    const adaptedActivities = (activities as any[]).map(adaptActivity);

    // Simple pagination
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const startIndex = (pageNum - 1) * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    const paginatedActivities = adaptedActivities.slice(startIndex, endIndex);

    res.json({ 
      activities: paginatedActivities,
      total: adaptedActivities.length,
      page: pageNum,
      pageSize: pageSizeNum
    });

  } catch (error: any) {
    return handleSnapTradeError(error, 'account-activities', res);
  }
});

/**
 * GET /api/snaptrade/symbols/search
 * Symbol search
 */
router.get('/symbols/search', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  const { q: query } = req.query;
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: {
          code: 'MISSING_QUERY',
          message: 'Query parameter "q" is required',
          requestId
        }
      });
    }

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Search symbols via SnapTrade
    const symbols = await snaptradeApiCall(
      () => searchSymbols(query, []),
      'symbol-search',
      'symbol-search'
    );

    const results = (symbols as any[]).map(adaptSymbolInfo);

    res.json({ results, query });

  } catch (error: any) {
    return handleSnapTradeError(error, 'symbol-search', res);
  }
});

/**
 * POST /api/snaptrade/trades/impact
 * Check order impact
 */
router.post('/trades/impact', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Validate request body
    const impactRequest = validate(req.body, ImpactRequestSchema);

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Check order impact via SnapTrade
    const impact = await snaptradeApiCall(
      () => checkOrderImpact(impactRequest),
      impactRequest.accountId,
      'check-order-impact'
    );

    // Adapt the impact response
    const impactData = impact as any;
    const response = {
      impactId: impactData.trade_id || nanoid(),
      accepted: impactData.trade !== null,
      estimatedCost: impactData.estimated_cost ? {
        amount: parseFloat(impactData.estimated_cost),
        currency: impactData.currency || 'USD'
      } : null,
      estimatedCommissions: impactData.estimated_commissions ? {
        amount: parseFloat(impactData.estimated_commissions),
        currency: impactData.currency || 'USD'
      } : null,
      estimatedFees: impactData.estimated_fees ? {
        amount: parseFloat(impactData.estimated_fees),
        currency: impactData.currency || 'USD'
      } : null,
      buyingPowerReduction: impactData.buying_power_effect ? {
        amount: parseFloat(impactData.buying_power_effect),
        currency: impactData.currency || 'USD'
      } : null,
      warnings: impactData.warnings || [],
      restrictions: impactData.restrictions || []
    };

    res.json(response);

  } catch (error: any) {
    return handleSnapTradeError(error, 'check-order-impact', res);
  }
});

/**
 * POST /api/snaptrade/trades/place
 * Place order with impactId
 */
router.post('/trades/place', snaptradeRateLimit, async (req: any, res: any) => {
  const requestId = req.headers['x-request-id'] || nanoid();
  
  try {
    const flintUserId = req.user?.id;
    if (!flintUserId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId
        }
      });
    }

    // Validate request body
    const placeRequest = validate(req.body, PlaceOrderRequestSchema);

    // Get user credentials
    const [snaptradeUser] = await db
      .select()
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, flintUserId))
      .limit(1);

    if (!snaptradeUser) {
      return res.status(428).json({
        error: {
          code: 'SNAPTRADE_NOT_REGISTERED',
          message: 'Please register with SnapTrade first',
          requestId
        }
      });
    }

    // Place order via SnapTrade
    const order = await snaptradeApiCall(
      () => placeOrderWithImpactId(placeRequest.impactId),
      'place-order',
      'place-order'
    );

    // Adapt the order response
    const orderData = order as any;
    const response = {
      orderId: orderData.id || nanoid(),
      status: orderData.state?.toLowerCase() === 'filled' ? 'filled' : 
              orderData.state?.toLowerCase() === 'cancelled' ? 'rejected' : 'submitted',
      submittedAt: orderData.created_date || new Date().toISOString()
    };

    res.json(response);

  } catch (error: any) {
    return handleSnapTradeError(error, 'place-order', res);
  }
});

export default router;