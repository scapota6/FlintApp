
import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { Snaptrade } from "snaptrade-typescript-sdk";

// Initialize SnapTrade client
const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID!,
  consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
});

const router = Router();

// Get user's SnapTrade credentials
async function getUserSnapTradeCredentials(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email));
  const user = result[0];
  
  if (!user?.snaptradeUserId || !user?.snaptradeUserSecret) {
    throw new Error("SnapTrade credentials not found");
  }
  
  return {
    userId: user.snaptradeUserId,
    userSecret: user.snaptradeUserSecret
  };
}

// Place order endpoint
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const { accountId, symbol, action, quantity, price, orderType } = req.body;

    // Validate input
    if (!accountId || !symbol || !action || !quantity || !orderType) {
      return res.status(400).json({ 
        error: "Missing required fields: accountId, symbol, action, quantity, orderType" 
      });
    }

    if (!['BUY', 'SELL'].includes(action)) {
      return res.status(400).json({ error: "Action must be BUY or SELL" });
    }

    if (!['MARKET', 'LIMIT'].includes(orderType)) {
      return res.status(400).json({ error: "OrderType must be MARKET or LIMIT" });
    }

    if (orderType === 'LIMIT' && !price) {
      return res.status(400).json({ error: "Price required for LIMIT orders" });
    }

    // Get user credentials
    const credentials = await getUserSnapTradeCredentials(email);

    // Place order via SnapTrade
    const orderPayload = {
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId,
      orderRequest: {
        symbol,
        action: action.toLowerCase(),
        quantity: Number(quantity),
        order_type: orderType,
        ...(orderType === 'LIMIT' && { price: Number(price) })
      }
    };

    console.log('Placing order:', orderPayload);

    const { data: orderResult } = await snaptrade.trading.placeOrder(orderPayload);

    console.log('Order placed successfully:', orderResult);

    res.json({
      success: true,
      order: orderResult,
      message: "Order placed successfully"
    });

  } catch (err: any) {
    console.error('Order placement error:', {
      path: req.originalUrl,
      payload: req.body,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { 
      message: err.message,
      error: "Order placement failed"
    };
    return res.status(status).json(body);
  }
});

// Get user's orders
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const { accountId } = req.query;
    const credentials = await getUserSnapTradeCredentials(email);

    const ordersPayload = {
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      ...(accountId && { accountId: accountId as string })
    };

    const { data: orders } = await snaptrade.trading.getUserOrders(ordersPayload);

    res.json(orders);

  } catch (err: any) {
    console.error('Get orders error:', {
      path: req.originalUrl,
      responseData: err.response?.data,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

export default router;
