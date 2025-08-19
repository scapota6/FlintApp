/**
 * Trading Routes
 * Handles order placement, cancellation, and management through SnapTrade
 */

import { Router } from "express";
import crypto from 'crypto';
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { logger } from "@shared/logger";
import { getSnapUser } from '../store/snapUsers';
import { resolveInstrumentBySymbol, normalizePreview } from '../lib/snaptrade';
import { z } from "zod";

// Import SnapTrade SDK and utility functions
import * as Snaptrade from 'snaptrade-typescript-sdk';
function hasFn(obj:any,n:string){ return obj && typeof obj[n]==='function'; }
function mkTradingApi(){
  const S:any = Snaptrade;
  const Ctor = S.TradingApi || S.TradesApi || S.AccountsAndTradesApi;
  if (!Ctor) throw new Error('Trading API not available in SDK');
  return new Ctor((S as any).configuration || undefined);
}

async function tradingCheckOrderImpact(input:any){
  const api = mkTradingApi();
  const payload = {
    userId: input.userId,
    userSecret: input.userSecret,
    accountId: input.accountId,
    // Common fields:
    symbol: input.symbol,                        // equity symbol
    universalSymbol: input.universalSymbol,      // if resolver provided it
    instrumentId: input.instrumentId,            // if resolver provided it
    action: input.side,                          // BUY/SELL
    orderType: input.type,                       // MARKET/LIMIT
    units: Number(input.quantity),
    limitPrice: input.type === 'LIMIT' ? Number(input.limitPrice) : undefined,
    timeInForce: input.timeInForce || 'DAY',
  };

  const fns = ['checkOrderImpact','previewOrder','impactOrder','previewTrade'];
  for (const fn of fns) {
    if (hasFn(api, fn)) {
      return (api as any)[fn](payload);
    }
  }
  throw new Error('No preview/impact function on Trading API');
}

async function tradingPlaceOrder(input:any){
  const api = mkTradingApi();
  const base = {
    userId: input.userId,
    userSecret: input.userSecret,
    accountId: input.accountId,
    idempotencyKey: input.idempotencyKey,
  };

  // Prefer tradeId-based placement:
  for (const fn of ['placeOrderById','executePreview','executeTrade','confirmOrder']) {
    if (input.tradeId && hasFn(api, fn)) {
      return (api as any)[fn]({ ...base, tradeId: input.tradeId });
    }
  }

  // Fallback: direct order placement
  const direct = {
    ...base,
    symbol: input.symbol,
    universalSymbol: input.universalSymbol,
    instrumentId: input.instrumentId,
    action: input.side,
    orderType: input.type,
    units: Number(input.quantity),
    limitPrice: input.type === 'LIMIT' ? Number(input.limitPrice) : undefined,
    timeInForce: input.timeInForce || 'DAY',
  };
  for (const fn of ['placeOrder','placeTrade','submitOrder','placeSimpleOrder']) {
    if (hasFn(api, fn)) {
      return (api as any)[fn](direct);
    }
  }
  throw new Error('No place order method on Trading API');
}

const router = Router();



// Order validation schemas
const PreviewOrderSchema = z.object({
  accountId: z.string(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  orderType: z.enum(['market', 'limit']),
  limitPrice: z.number().positive().optional()
});

const PlaceOrderSchema = z.object({
  accountId: z.string(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit']),
  qty: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok']).default('day')
});

const CancelOrderSchema = z.object({
  orderId: z.string(),
  accountId: z.string()
});

/**
 * POST /api/trade/preview
 * Preview an order before placement using enhanced instrument resolution
 */
router.post("/preview", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Validate request body
    const validation = PreviewOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Invalid request",
        errors: validation.error.flatten() 
      });
    }
    
    const { accountId, symbol, side, quantity, orderType, limitPrice } = validation.data;
    
    // Get SnapTrade credentials using the robust store
    const snapUser = await getSnapUser(userId);
    if (!snapUser?.userSecret) {
      return res.status(403).json({ 
        message: "No brokerage account connected"
      });
    }

    console.log('Preview request:', {
      userId: userId.slice(-6),
      accountId: accountId.slice(-6),
      symbol,
      side,
      quantity,
      orderType
    });

    // Enhanced instrument resolution
    let instrument;
    try {
      instrument = await resolveInstrumentBySymbol(symbol);
      console.log('Resolved instrument:', { 
        symbol, 
        instrumentId: instrument?.id,
        universalSymbolId: instrument?.id 
      });
    } catch (error) {
      console.error('Instrument resolution failed:', error);
      return res.status(404).json({ 
        message: `Symbol ${symbol} not found or not supported`
      });
    }
    
    // Prepare order impact request
    const impactRequest = {
      userId: snapUser.snaptradeUserId,
      userSecret: snapUser.userSecret,
      accountId,
      symbol,
      universalSymbol: instrument?.symbol || instrument?.id,
      instrumentId: instrument?.id,
      side: side.toUpperCase(),
      type: orderType.toUpperCase(),
      quantity,
      limitPrice,
      timeInForce: 'DAY',
    };

    console.log('Impact request prepared:', impactRequest);

    // Use the robust trading API wrapper
    const impactResult = await tradingCheckOrderImpact(impactRequest);
    console.log('Impact result received:', !!impactResult);

    // Normalize the response using the helper function
    const normalized = normalizePreview(impactResult);
    console.log('Normalized preview:', { 
      hasTradeId: !!normalized.tradeId, 
      hasImpact: !!normalized.impact 
    });

    // Return normalized response
    return res.json({
      success: true,
      preview: normalized.impact,
      tradeId: normalized.tradeId,
      symbol,
      accountId
    });

  } catch (error: any) {
    console.error('Trade preview error:', error);
    return res.status(500).json({ 
      message: 'Failed to preview trade',
      error: error.message 
    });
  }
});

/**
 * POST /api/trade/place
 * Place an order
 */
router.post("/place", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Validate request body
    const validation = PlaceOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Invalid request",
        errors: validation.error.flatten() 
      });
    }
    
    const { accountId, symbol, side, type, qty, limitPrice, timeInForce } = validation.data;
    
    // Check if SnapTrade is configured
    if (!snaptradeClient) {
      return res.status(503).json({ 
        message: "Trading service not configured"
      });
    }
    
    // Get SnapTrade credentials using the robust store
    const snapUser = await getSnapUser(userId);
    if (!snapUser?.userSecret) {
      return res.status(403).json({ 
        message: "No brokerage account connected"
      });
    }

    // Enhanced instrument resolution
    let instrument;
    try {
      instrument = await resolveInstrumentBySymbol(symbol);
      console.log('Resolved instrument for placement:', { 
        symbol, 
        instrumentId: instrument?.id 
      });
    } catch (error) {
      console.error('Instrument resolution failed:', error);
      return res.status(404).json({ 
        message: `Symbol ${symbol} not found or not supported`
      });
    }
      
    // Generate idempotency key for order placement
    const idempotencyKey = crypto.randomUUID();

    // Prepare order placement request
    const orderRequest = {
      userId: snapUser.snaptradeUserId,
      userSecret: snapUser.userSecret,
      accountId,
      symbol,
      universalSymbol: instrument?.symbol || instrument?.id,
      instrumentId: instrument?.id,
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: qty,
      limitPrice,
      timeInForce: timeInForce.toUpperCase(),
      idempotencyKey,
      tradeId: null, // Will be populated from preview if available
    };

    console.log('Order placement request prepared:', orderRequest);

    // Use the robust trading API wrapper
    const orderResult = await tradingPlaceOrder(orderRequest);
    console.log('Order placement result received:', !!orderResult);

    // Normalize the response
    const normalized = normalizePreview(orderResult);
    console.log('Normalized order result:', { 
      hasTradeId: !!normalized.tradeId, 
      hasImpact: !!normalized.impact 
    });

    // Log trade activity (with safe access to order properties)
    const orderId = normalized.tradeId || orderResult?.id || 'unknown';
    await storage.logActivity({
      userId,
      action: 'trade_placed',
      description: `Placed ${side} order for ${qty} shares of ${symbol}`,
      metadata: {
        orderId,
        symbol,
        side,
        quantity: qty,
        orderType: type,
        limitPrice,
        accountId
      }
    });

    // Return normalized response
    return res.json({
      success: true,
      orderId,
      symbol,
      side,
      quantity: qty,
      orderType: type,
      limitPrice,
      status: orderResult?.status || 'pending',
      message: `Order placed successfully`
    });

  } catch (error: any) {
    console.error('Trade placement error:', error);
    return res.status(500).json({ 
      message: 'Failed to place trade',
      error: error.message 
    });
  }

});

/**
 * POST /api/trade/cancel
 * Cancel an order
 */
router.post("/cancel", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Validate request body
    const validation = CancelOrderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Invalid request",
        errors: validation.error.flatten() 
      });
    }
    
    const { orderId, accountId } = validation.data;
    
    // Check if SnapTrade is configured
    if (!snaptradeClient) {
      return res.status(503).json({ 
        message: "Trading service not configured"
      });
    }
    
    // Get SnapTrade credentials
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser?.userSecret) {
      return res.status(403).json({ 
        message: "No brokerage account connected"
      });
    }
    
    // For SnapTrade accounts, we don't need database lookup
    // The accountId is the SnapTrade external account ID (UUID)
    
    try {
      // Cancel the order
      await snaptradeClient.tradingApi.cancelUserAccountOrder({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: accountId, // Use the accountId directly - it's the SnapTrade external account ID
        brokerageOrderId: orderId
      });
      
      // Log activity
      await storage.logActivity({
        userId,
        action: 'trade_cancelled',
        description: `Cancelled order ${orderId}`,
        metadata: {
          orderId,
          accountId
        }
      });
      
      res.json({
        success: true,
        orderId,
        message: "Order cancelled successfully"
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade cancel order error", snapError);
      
      const errorMessage = snapError.response?.data?.detail?.message || 
                          snapError.response?.data?.message || 
                          snapError.message;
      
      return res.status(400).json({ 
        message: "Failed to cancel order",
        error: errorMessage
      });
    }
    
  } catch (error) {
    logger.error("Error cancelling order", { error });
    res.status(500).json({ 
      message: "Failed to cancel order",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/trade/quotes
 * Get live quotes for symbols in an account
 */
router.get("/quotes", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { accountId, symbols } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ 
        message: "Account ID is required"
      });
    }
    
    if (!symbols) {
      return res.status(400).json({ 
        message: "Symbols are required"
      });
    }
    
    // Check if SnapTrade is configured
    if (!snaptradeClient) {
      return res.status(503).json({ 
        message: "Trading service not configured"
      });
    }
    
    // Get SnapTrade credentials
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser?.userSecret) {
      return res.status(403).json({ 
        message: "No brokerage account connected"
      });
    }
    
    try {
      // Parse symbols (comma-separated)
      const symbolList = symbols.split(',').map((s: string) => s.trim());
      
      // Get quotes from SnapTrade
      const { data: quotes } = await snaptradeClient.tradingApi.getUserAccountQuotes({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: accountId as string,
        symbols: symbolList.join(',')
      });
      
      res.json({
        quotes,
        accountId
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade get quotes error", snapError);
      
      return res.status(400).json({ 
        message: "Failed to fetch quotes",
        error: snapError.response?.data?.detail?.message || snapError.message
      });
    }
    
  } catch (error) {
    logger.error("Error fetching quotes", { error });
    res.status(500).json({ 
      message: "Failed to fetch quotes",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/trade/orders
 * Get open and recent orders
 */
router.get("/orders", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ 
        message: "Account ID is required"
      });
    }
    
    // Check if SnapTrade is configured
    if (!snaptradeClient) {
      return res.status(503).json({ 
        message: "Trading service not configured"
      });
    }
    
    // Get SnapTrade credentials
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser?.userSecret) {
      return res.status(403).json({ 
        message: "No brokerage account connected"
      });
    }
    
    // For SnapTrade accounts, we don't need database lookup
    // The accountId is the SnapTrade external account ID (UUID)
    
    try {
      // Get orders from SnapTrade
      const { data: orders } = await snaptradeClient.accountsApi.getUserAccountOrders({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: accountId as string, // Use the accountId directly - it's the SnapTrade external account ID
        state: 'all' // Get all orders
      });
      
      // Format orders for response
      const formattedOrders = orders.map(order => ({
        id: order.brokerage_order_id,
        symbol: order.symbol,
        side: order.action?.toLowerCase(),
        quantity: order.total_quantity,
        filledQuantity: order.filled_quantity,
        orderType: order.order_type?.toLowerCase(),
        limitPrice: order.limit_price,
        status: order.status,
        timeInForce: order.time_in_force,
        placedAt: order.time_placed,
        updatedAt: order.time_updated,
        executionPrice: order.execution_price
      }));
      
      // Separate open and completed orders
      const openOrders = formattedOrders.filter(o => 
        ['new', 'accepted', 'pending', 'partially_filled'].includes(o.status?.toLowerCase() || '')
      );
      
      const recentOrders = formattedOrders.filter(o => 
        ['filled', 'cancelled', 'rejected', 'expired'].includes(o.status?.toLowerCase() || '')
      ).slice(0, 20); // Last 20 completed orders
      
      res.json({
        open: openOrders,
        recent: recentOrders,
        accountId,
        accountName: 'Brokerage Account'
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade get orders error", snapError);
      
      return res.status(400).json({ 
        message: "Failed to fetch orders",
        error: snapError.response?.data?.detail?.message || snapError.message
      });
    }
    
  } catch (error) {
    logger.error("Error fetching orders", { error });
    res.status(500).json({ 
      message: "Failed to fetch orders",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * POST /api/trade/replace
 * Replace/modify an existing order
 */
router.post("/replace", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    const { orderId, accountId, quantity, limitPrice } = req.body;
    
    if (!orderId || !accountId) {
      return res.status(400).json({ 
        message: "Order ID and Account ID are required"
      });
    }
    
    // Check if SnapTrade is configured
    if (!snaptradeClient) {
      return res.status(503).json({ 
        message: "Trading service not configured"
      });
    }
    
    // Get SnapTrade credentials
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser?.userSecret) {
      return res.status(403).json({ 
        message: "No brokerage account connected"
      });
    }
    
    try {
      // Replace the order
      const { data: replacedOrder } = await snaptradeClient.tradingApi.replaceOrder({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: accountId,
        brokerageOrderId: orderId,
        units: quantity,
        price: limitPrice
      });
      
      // Log activity
      await storage.logActivity({
        userId,
        action: 'order_replaced',
        description: `Replaced order ${orderId} with new quantity: ${quantity}, price: ${limitPrice}`,
        metadata: {
          orderId,
          accountId,
          newQuantity: quantity,
          newPrice: limitPrice
        }
      });
      
      res.json({
        success: true,
        order: replacedOrder,
        message: "Order replaced successfully"
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade replace order error", snapError);
      
      const errorMessage = snapError.response?.data?.detail?.message || 
                          snapError.response?.data?.message || 
                          snapError.message;
      
      return res.status(400).json({ 
        message: "Failed to replace order",
        error: errorMessage
      });
    }
    
  } catch (error) {
    logger.error("Error replacing order", { error });
    res.status(500).json({ 
      message: "Failed to replace order",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/trade/crypto/search
 * Search for cryptocurrency trading pairs
 */
router.get("/crypto/search", isAuthenticated, async (req: any, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        message: "Search query is required"
      });
    }
    
    // Check if SnapTrade is configured
    if (!snaptradeClient) {
      return res.status(503).json({ 
        message: "Trading service not configured"
      });
    }
    
    try {
      // Search for crypto pairs
      const { data: pairs } = await snaptradeClient.tradingApi.searchCryptocurrencyPairInstruments({
        query: query as string
      });
      
      res.json({
        pairs,
        query
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade crypto search error", snapError);
      
      return res.status(400).json({ 
        message: "Failed to search crypto pairs",
        error: snapError.response?.data?.detail?.message || snapError.message
      });
    }
    
  } catch (error) {
    logger.error("Error searching crypto pairs", { error });
    res.status(500).json({ 
      message: "Failed to search crypto pairs",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;