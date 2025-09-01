import { Router } from 'express';
import { authApi, accountsApi, tradingApi, searchSymbols, getOrderImpact } from '../lib/snaptrade';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { users, snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { mapSnapTradeError, logSnapTradeError, RateLimitHandler } from '../lib/snaptrade-errors';
import type { SymbolInfo, SymbolSearchResponse, ImpactRequest, ImpactResponse, ImpactSummaryLine, PlaceOrderRequest, PlaceOrderResponse, ErrorResponse, ISODate, UUID, Money } from '@shared/types';

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
 * GET /api/snaptrade/symbols/:query
 * Search for symbols by query string - used for search and ticker header
 */
router.get('/symbols/:query', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const query = req.params.query.toUpperCase();
    
    console.log('[SnapTrade Trading] Symbol search for:', {
      flintUserId: flintUser.id,
      query
    });
    
    // Search for symbols using SnapTrade API
    const symbols = await searchSymbols(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      req.query.accountId as string || '',
      query
    );
    
    // Transform symbols to normalized DTO
    const transformedSymbols: SymbolInfo[] = symbols.map((symbol: any) => ({
      symbol: symbol.symbol || symbol.raw_symbol,
      description: symbol.description || symbol.symbol || symbol.raw_symbol,
      exchange: symbol.exchange || null,
      currency: symbol.currency?.code || symbol.currency || 'USD',
      tradable: symbol.is_tradable !== false, // Default to tradable unless explicitly false
      securityType: symbol.type?.description || symbol.type || 'EQUITY'
    }));
    
    console.log('[SnapTrade Trading] Found', transformedSymbols.length, 'symbols for query:', query);
    
    const response: SymbolSearchResponse = {
      results: transformedSymbols
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('symbol_search', error, requestId, { query: req.params.query });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`symbol_search_${req.params.query}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId
      }
    };
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * POST /api/snaptrade/trades/impact
 * Check equity order impact - preview cost, fees, potential rejections
 */
router.post('/trades/impact', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    
    // Validate request body matches ImpactRequest interface
    const impactRequest: ImpactRequest = {
      accountId: req.body.accountId,
      symbol: req.body.symbol,
      side: req.body.side,
      quantity: req.body.quantity,
      type: req.body.type,
      timeInForce: req.body.timeInForce,
      limitPrice: req.body.limitPrice,
      stopPrice: req.body.stopPrice
    };
    
    console.log('[SnapTrade Trading] Checking order impact:', {
      flintUserId: flintUser.id,
      ...impactRequest
    });
    
    // First search for the symbol to get universal symbol ID
    const symbols = await searchSymbols(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      impactRequest.accountId,
      impactRequest.symbol
    );
    
    if (!symbols || symbols.length === 0) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'SYMBOL_NOT_FOUND',
          message: `Symbol ${impactRequest.symbol} not found or not tradable`,
          requestId: req.headers['x-request-id'] || null
        }
      };
      return res.status(404).json(errorResponse);
    }
    
    const universalSymbolId = symbols[0].id;
    
    // Check order impact using SnapTrade API
    const impact = await getOrderImpact(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      impactRequest.accountId,
      {
        action: impactRequest.side.toUpperCase() as 'BUY' | 'SELL',
        orderType: impactRequest.type === 'market' ? 'Market' : 'Limit',
        timeInForce: (impactRequest.timeInForce || 'day') === 'gtc' ? 'GTC' : 'Day',
        units: impactRequest.quantity,
        universalSymbolId,
        price: impactRequest.limitPrice || undefined
      }
    );
    
    console.log('[SnapTrade Trading] Order impact calculated:', {
      impactId: impact?.trade?.id,
      estimatedCommissions: impact?.trade?.estimated_commissions,
      buyingPowerEffect: impact?.trade?.buying_power_effect
    });
    
    // Transform to your ImpactResponse interface
    const estimatedCost = impact?.trade?.price ? impact.trade.price * impactRequest.quantity : 0;
    const fees = impact?.trade?.estimated_commissions || 0;
    const totalCost = impactRequest.side === 'buy' ? estimatedCost + fees : estimatedCost - fees;
    
    const lines: ImpactSummaryLine[] = [
      {
        label: impactRequest.side === 'buy' ? 'Estimated cost' : 'Estimated proceeds',
        value: `$${estimatedCost.toFixed(2)}`
      }
    ];
    
    if (fees > 0) {
      lines.push({
        label: 'Fees',
        value: `$${fees.toFixed(2)}`
      });
    }
    
    lines.push({
      label: 'Settlement',
      value: 'T+2'
    });
    
    const hasErrors = impact?.warnings?.some((w: any) => w.severity === 'error');
    
    const response: ImpactResponse = {
      impactId: impact?.trade?.id || `imp_${Date.now()}`,
      accepted: !hasErrors,
      reason: hasErrors ? impact.warnings.find((w: any) => w.severity === 'error')?.description : null,
      estCost: {
        amount: totalCost,
        currency: 'USD'
      },
      lines
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('order_impact', error, requestId, { 
      accountId: req.body.accountId,
      symbol: req.body.symbol,
      side: req.body.side
    });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`order_impact_${req.body.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId
      }
    };
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

/**
 * POST /api/snaptrade/trades/place
 * Place equity order using impact_id from preview step
 */
router.post('/trades/place', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    
    // Validate request body matches PlaceOrderRequest interface
    const placeOrderRequest: PlaceOrderRequest = {
      impactId: req.body.impactId
    };
    
    if (!placeOrderRequest.impactId) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'MISSING_IMPACT_ID',
          message: 'impactId is required from impact preview step',
          requestId: req.headers['x-request-id'] || null
        }
      };
      return res.status(400).json(errorResponse);
    }
    
    console.log('[SnapTrade Trading] Placing order:', {
      flintUserId: flintUser.id,
      impactId: placeOrderRequest.impactId
    });
    
    // Place the order using the impact ID
    const orderResponse = await tradingApi.placeOrder({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      tradeId: placeOrderRequest.impactId // Use impact_id from preview
    });
    
    const placedOrder = orderResponse.data;
    
    console.log('[SnapTrade Trading] Order placed successfully:', {
      orderId: placedOrder?.id,
      status: placedOrder?.status,
      symbol: placedOrder?.symbol
    });
    
    // Optionally refresh positions and recent orders after successful trade
    try {
      console.log('[SnapTrade Trading] Refreshing account data after trade...');
      
      const [positionsResponse, ordersResponse] = await Promise.all([
        accountsApi.getUserAccountPositions({
          userId: credentials.snaptradeUserId,
          userSecret: credentials.snaptradeUserSecret,
          accountId
        }).catch(() => ({ data: [] })),
        
        accountsApi.getUserAccountOrders({
          userId: credentials.snaptradeUserId,
          userSecret: credentials.snaptradeUserSecret,
          accountId
        }).catch(() => ({ data: [] }))
      ]);
      
      console.log('[SnapTrade Trading] Account data refreshed:', {
        positionsCount: positionsResponse.data?.length || 0,
        ordersCount: ordersResponse.data?.length || 0
      });
      
    } catch (refreshError) {
      console.warn('[SnapTrade Trading] Failed to refresh account data after trade:', refreshError);
    }
    
    // Map SnapTrade status to your enum
    const statusMap: Record<string, PlaceOrderResponse['status']> = {
      'NEW': 'submitted',
      'FILLED': 'filled',
      'PARTIALLY_FILLED': 'partial_filled',
      'REPLACED': 'replaced',
      'REJECTED': 'rejected',
      'PENDING': 'submitted',
      'CANCELLED': 'rejected'
    };
    
    const response: PlaceOrderResponse = {
      orderId: placedOrder?.id || `order_${Date.now()}`,
      status: statusMap[placedOrder?.status] || 'submitted',
      submittedAt: placedOrder?.created_at || new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    logSnapTradeError('place_order', error, requestId, { 
      impactId: placeOrderRequest.impactId
    });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`place_order_${req.body.accountId}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    const errorResponse: ErrorResponse = {
      error: {
        code: mappedError.code,
        message: mappedError.userMessage,
        requestId
      }
    };
    res.status(mappedError.httpStatus).json(errorResponse);
  }
});

export { router as snaptradeTradingRouter };