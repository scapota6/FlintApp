/**
 * Trading Routes
 * Handles order placement, cancellation, and management through SnapTrade
 */

import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { logger } from "@shared/logger";
import { snaptradeClient } from '../lib/snaptrade';
import { z } from "zod";

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
 * Preview an order before placement
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
    
    // Verify account ownership
    const account = await storage.getConnectedAccount(accountId);
    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        message: "Account not found or unauthorized"
      });
    }
    
    try {
      // Get symbol details from SnapTrade
      const { data: symbolData } = await snaptradeClient.referenceData.getSymbolsByTicker({
        query: symbol
      });
      
      if (!symbolData || symbolData.length === 0) {
        return res.status(404).json({ 
          message: `Symbol ${symbol} not found`
        });
      }
      
      const universalSymbolId = symbolData[0].id;
      
      // Build order impact preview
      const action = side === 'buy' ? 'BUY' : 'SELL';
      const orderTypeSnap = orderType === 'market' ? 'Market' : 'Limit';
      
      // Get order impact from SnapTrade
      const { data: impact } = await snaptradeClient.trading.getOrderImpact({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: account.externalAccountId!,
        action,
        universalSymbolId: universalSymbolId!,
        orderType: orderTypeSnap,
        timeInForce: 'Day',
        units: quantity,
        price: limitPrice
      });
      
      // Calculate estimated costs
      const estimatedValue = (limitPrice || impact.price || 0) * quantity;
      const commission = impact.brokerage_order_impact?.estimated_commissions || 0;
      const totalCost = side === 'buy' 
        ? estimatedValue + commission
        : estimatedValue - commission;
      
      res.json({
        symbol,
        side,
        quantity,
        orderType,
        limitPrice,
        estimatedPrice: impact.price || limitPrice,
        estimatedValue,
        commission,
        totalCost,
        buyingPower: impact.buying_power_effect,
        account: {
          id: accountId,
          name: account.accountName,
          provider: account.provider
        }
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade preview error", { snapError });
      return res.status(400).json({ 
        message: "Failed to preview order",
        error: snapError.response?.data?.detail?.message || snapError.message
      });
    }
    
  } catch (error) {
    logger.error("Error previewing order", { error });
    res.status(500).json({ 
      message: "Failed to preview order",
      error: error instanceof Error ? error.message : "Unknown error"
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
    
    // Get SnapTrade credentials
    const snaptradeUser = await storage.getSnapTradeUser(userId);
    if (!snaptradeUser?.snaptradeUserId || !snaptradeUser?.userSecret) {
      return res.status(403).json({ 
        message: "No brokerage account connected"
      });
    }
    
    // Verify account ownership
    const account = await storage.getConnectedAccount(accountId);
    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        message: "Account not found or unauthorized"
      });
    }
    
    try {
      // Get symbol details
      const { data: symbolData } = await snaptradeClient.referenceData.getSymbolsByTicker({
        query: symbol
      });
      
      if (!symbolData || symbolData.length === 0) {
        return res.status(404).json({ 
          message: `Symbol ${symbol} not found`
        });
      }
      
      const universalSymbolId = symbolData[0].id;
      
      // Map order parameters
      const action = side === 'buy' ? 'BUY' : 'SELL';
      const orderType = type === 'market' ? 'Market' : 'Limit';
      const tif = timeInForce === 'gtc' ? 'GTC' : 
                  timeInForce === 'ioc' ? 'IOC' :
                  timeInForce === 'fok' ? 'FOK' : 'Day';
      
      // Place the order
      const { data: order } = await snaptradeClient.trading.placeOrder({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: account.externalAccountId!,
        action,
        universalSymbolId: universalSymbolId!,
        orderType,
        timeInForce: tif,
        units: qty,
        price: limitPrice,
        notionalValue: undefined // Let SnapTrade calculate
      });
      
      // Log trade activity
      await storage.logActivity(userId, 'trade_placed', {
        orderId: order.brokerage_order_id,
        symbol,
        side,
        quantity: qty,
        orderType: type,
        limitPrice,
        accountId
      });
      
      res.json({
        success: true,
        orderId: order.brokerage_order_id,
        symbol,
        side,
        quantity: qty,
        orderType: type,
        limitPrice,
        status: order.status,
        message: `Order placed successfully`
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade place order error", { snapError });
      
      // Parse error message
      const errorMessage = snapError.response?.data?.detail?.message || 
                          snapError.response?.data?.message || 
                          snapError.message;
      
      return res.status(400).json({ 
        message: "Failed to place order",
        error: errorMessage,
        details: snapError.response?.data
      });
    }
    
  } catch (error) {
    logger.error("Error placing order", { error });
    res.status(500).json({ 
      message: "Failed to place order",
      error: error instanceof Error ? error.message : "Unknown error"
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
    
    // Verify account ownership
    const account = await storage.getConnectedAccount(accountId);
    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        message: "Account not found or unauthorized"
      });
    }
    
    try {
      // Cancel the order
      await snaptradeClient.trading.cancelUserAccountOrder({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: account.externalAccountId!,
        brokerageOrderId: orderId
      });
      
      // Log activity
      await storage.logActivity(userId, 'trade_cancelled', {
        orderId,
        accountId
      });
      
      res.json({
        success: true,
        orderId,
        message: "Order cancelled successfully"
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade cancel order error", { snapError });
      
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
    
    // Verify account ownership
    const account = await storage.getConnectedAccount(accountId as string);
    if (!account || account.userId !== userId) {
      return res.status(403).json({ 
        message: "Account not found or unauthorized"
      });
    }
    
    try {
      // Get orders from SnapTrade
      const { data: orders } = await snaptradeClient.accountInformation.getUserAccountOrders({
        userId: snaptradeUser.snaptradeUserId,
        userSecret: snaptradeUser.userSecret,
        accountId: account.externalAccountId!,
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
        accountName: account.accountName
      });
      
    } catch (snapError: any) {
      logger.error("SnapTrade get orders error", { snapError });
      
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

export default router;