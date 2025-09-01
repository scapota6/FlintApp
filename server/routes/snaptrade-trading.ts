import { Router } from 'express';
import { authApi, accountsApi, tradingApi } from '../lib/snaptrade';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { users, snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
 * GET /api/snaptrade/symbols/:ticker
 * Get symbol metadata including description, exchange, type, currency
 */
router.get('/symbols/:ticker', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const ticker = req.params.ticker.toUpperCase();
    
    console.log('[SnapTrade Trading] Symbol search for:', {
      flintUserId: flintUser.id,
      ticker
    });
    
    // Search for symbols using SnapTrade API
    const symbolsResponse = await tradingApi.symbolSearchUserAccount({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId: req.query.accountId || '', // Account ID for context
      substring: ticker
    });
    
    const symbols = symbolsResponse.data || [];
    
    // Find exact match or best match for the ticker
    let symbol = symbols.find((s: any) => 
      s.symbol === ticker || s.raw_symbol === ticker
    );
    
    if (!symbol && symbols.length > 0) {
      // If no exact match, take the first result
      symbol = symbols[0];
    }
    
    if (!symbol) {
      return res.status(404).json({
        success: false,
        message: 'Symbol not found',
        ticker
      });
    }
    
    console.log('[SnapTrade Trading] Symbol found:', {
      ticker,
      symbolId: symbol.id,
      description: symbol.description
    });
    
    res.json({
      success: true,
      symbol: {
        id: symbol.id,
        symbol: symbol.symbol || symbol.raw_symbol,
        description: symbol.description,
        exchange: symbol.exchange,
        type: symbol.type?.description || symbol.type,
        currency: symbol.currency?.code || symbol.currency,
        isActive: symbol.is_tradable || true
      }
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Trading] Symbol search error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to search symbol'
    });
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
    
    const { accountId, symbolId, side, quantity, orderType, timeInForce } = req.body;
    
    console.log('[SnapTrade Trading] Checking order impact:', {
      flintUserId: flintUser.id,
      accountId,
      symbolId,
      side,
      quantity,
      orderType
    });
    
    // Check order impact using SnapTrade API
    const impactResponse = await tradingApi.checkOrderImpact({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      accountId,
      action: side, // buy/sell
      orderType: orderType || 'market',
      price: req.body.price || undefined, // For limit orders
      stop: req.body.stopPrice || undefined, // For stop orders
      timeInForce: timeInForce || 'day',
      units: quantity,
      universalSymbolId: symbolId
    });
    
    const impact = impactResponse.data;
    
    console.log('[SnapTrade Trading] Order impact calculated:', {
      impactId: impact?.trade?.id,
      estimatedCommissions: impact?.trade?.estimated_commissions,
      buyingPowerEffect: impact?.trade?.buying_power_effect
    });
    
    res.json({
      success: true,
      impact: {
        id: impact?.trade?.id, // impact_id for next step
        estimatedCommissions: impact?.trade?.estimated_commissions || 0,
        buyingPowerEffect: impact?.trade?.buying_power_effect || 0,
        estimatedCost: impact?.trade?.price || 0,
        fees: impact?.trade?.fees || [],
        warnings: impact?.warnings || [],
        canPlace: !impact?.warnings?.some((w: any) => w.severity === 'error'),
        trade: {
          symbol: impact?.trade?.symbol,
          side: impact?.trade?.action,
          quantity: impact?.trade?.units,
          orderType: impact?.trade?.order_type,
          price: impact?.trade?.price,
          timeInForce: impact?.trade?.time_in_force
        }
      }
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Trading] Order impact error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to check order impact'
    });
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
    
    const { impactId, accountId } = req.body;
    
    if (!impactId) {
      return res.status(400).json({
        success: false,
        message: 'impact_id is required from preview step'
      });
    }
    
    console.log('[SnapTrade Trading] Placing order:', {
      flintUserId: flintUser.id,
      impactId,
      accountId
    });
    
    // Place the order using the impact ID
    const orderResponse = await tradingApi.placeOrder({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      tradeId: impactId // Use impact_id from preview
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
    
    res.json({
      success: true,
      order: {
        id: placedOrder?.id,
        status: placedOrder?.status,
        symbol: placedOrder?.symbol,
        side: placedOrder?.action,
        quantity: placedOrder?.units,
        orderType: placedOrder?.order_type,
        price: placedOrder?.price,
        timeInForce: placedOrder?.time_in_force,
        filledQuantity: placedOrder?.filled_units || 0,
        createdAt: placedOrder?.created_at,
        updatedAt: placedOrder?.updated_at
      },
      message: 'Order placed successfully'
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Trading] Place order error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to place order'
    });
  }
});

export { router as snaptradeTradingRouter };