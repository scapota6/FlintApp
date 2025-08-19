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

const r = Router();
const pickUserId = (req:any)=> (req.user?.id || req.headers['x-user-id'] || req.body?.userId || '').toString().trim();

function validateOrder(b:any){
  const e:string[]=[];
  if(!b.accountId) e.push('accountId required');
  if(!b.symbol) e.push('symbol required');
  if(!b.side || !['BUY','SELL'].includes(String(b.side).toUpperCase())) e.push('side must be BUY or SELL');
  if(!b.quantity || Number(b.quantity)<=0) e.push('quantity must be > 0');
  if(!b.type || !['MARKET','LIMIT'].includes(String(b.type).toUpperCase())) e.push('type must be MARKET or LIMIT');
  if(String(b.type).toUpperCase()==='LIMIT' && (!b.limitPrice || Number(b.limitPrice)<=0)) e.push('limitPrice required for LIMIT');
  return e;
}



r.post('/trade/preview', async (req,res)=>{
  try{
    const userId = pickUserId(req);
    if(!userId) return res.status(401).json({message:'No userId'});

    const body = req.body||{};
    body.side = String(body.side||'').toUpperCase();
    body.type = String(body.type||'').toUpperCase();
    const errs = validateOrder(body);
    if (errs.length) return res.status(400).json({ message:'Invalid order', errors:errs });

    const rec = await getSnapUser(userId);
    if(!rec?.userSecret) return res.status(428).json({ code:'SNAPTRADE_NOT_REGISTERED', message:'Connect brokerage first' });

    // Resolve instrument for the symbol to prevent 400s from missing instrument fields
    const inst = await resolveInstrumentBySymbol(body.symbol).catch(()=> null);
    const payload = {
      userId: rec.userId,
      userSecret: rec.userSecret,
      accountId: body.accountId,
      symbol: body.symbol,
      side: body.side,
      quantity: Number(body.quantity),
      type: body.type,
      limitPrice: body.limitPrice ? Number(body.limitPrice) : undefined,
      timeInForce: body.timeInForce || 'DAY',
      universalSymbol: inst?.universalSymbol || inst?.universal_symbol || undefined,
      instrumentId: inst?.id || inst?.instrumentId || undefined,
    };

    const raw = await tradingCheckOrderImpact(payload);
    const { tradeId, impact } = normalizePreview(raw);

    if (!impact && !tradeId) {
      console.error('Preview returned unexpected shape:', raw);
      return res.status(502).json({ message:'Preview returned unexpected response', raw });
    }

    return res.json({ ok:true, tradeId, impact, raw }); // keep raw for debugging in UI if needed
  }catch(e:any){
    console.error('SnapTrade preview error - Full details:', e?.responseBody || e?.message || e);
    return res.status(400).json({ message:'Failed to preview order', error: e?.responseBody || e?.message || e });
  }
});

r.post('/trade/place', async (req,res)=>{
  try{
    const userId = pickUserId(req);
    if(!userId) return res.status(401).json({message:'No userId'});

    const body = req.body||{};
    body.side = body.side ? String(body.side).toUpperCase() : undefined;
    body.type = body.type ? String(body.type).toUpperCase() : undefined;

    const rec = await getSnapUser(userId);
    if(!rec?.userSecret) return res.status(428).json({ code:'SNAPTRADE_NOT_REGISTERED', message:'Connect brokerage first' });

    // If no tradeId provided, validate and resolve instrument, then direct place
    let inst:any = null;
    if (!body.tradeId) {
      const errs = validateOrder(body);
      if (errs.length) return res.status(400).json({ message:'Invalid order', errors:errs });
      inst = await resolveInstrumentBySymbol(body.symbol).catch(()=> null);
    }

    const idempotencyKey = crypto.randomUUID();
    const placed = await tradingPlaceOrder({
      userId: rec.userId, userSecret: rec.userSecret, accountId: body.accountId,
      tradeId: body.tradeId || undefined,
      symbol: body.symbol,
      side: body.side, quantity: Number(body.quantity),
      type: body.type, limitPrice: body.limitPrice ? Number(body.limitPrice) : undefined,
      timeInForce: body.timeInForce || 'DAY',
      universalSymbol: inst?.universalSymbol || inst?.universal_symbol,
      instrumentId: inst?.id || inst?.instrumentId,
      idempotencyKey,
    });

    return res.json({ ok:true, order: placed, idempotencyKey });
  }catch(e:any){
    console.error('SnapTrade place order error - Full details:', e?.responseBody || e?.message || e);
    return res.status(400).json({ message:'Failed to place order', error: e?.responseBody || e?.message || e });
  }
});

/**
 * POST /api/trade/cancel
 * Cancel an order
 */
r.post("/cancel", isAuthenticated, async (req: any, res) => {
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
r.get("/quotes", isAuthenticated, async (req: any, res) => {
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
r.get("/orders", isAuthenticated, async (req: any, res) => {
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
r.post("/replace", isAuthenticated, async (req: any, res) => {
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
r.get("/crypto/search", isAuthenticated, async (req: any, res) => {
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

export default r;