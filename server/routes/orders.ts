
import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { v4 as uuidv4 } from 'uuid';

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

    // Place order via SnapTrade using placeForceOrder - no tradeId needed
    const orderPayload = {
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      account_id: accountId, // SnapTrade expects account_id
      action: action.toUpperCase(), // BUY or SELL
      symbol: symbol.toUpperCase(),
      order_type: orderType === 'MARKET' ? 'Market' : 'Limit', // Capitalize first letter
      time_in_force: 'Day', // Default time in force
      units: Number(quantity), // SnapTrade uses 'units' for quantity
      ...(orderType === 'LIMIT' && price && { price: Number(price) })
    };

    console.log('Placing order:', {
      userId: credentials.userId,
      userSecret: '***',
      ...orderPayload
    });

    const { data: orderResult } = await snaptrade.trading.placeForceOrder(orderPayload);

    console.log('Order placed successfully:', orderResult);

    res.json({
      success: true,
      order: orderResult,
      message: `Order placed successfully for ${quantity} shares of ${symbol}`
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

    if (!accountId) {
      return res.status(400).json({ error: "accountId is required" });
    }

    // Get order history using getAccountActivities
    const ordersPayload = {
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId: accountId as string,
      type: "BUY,SELL,OPTION_BUY,OPTION_SELL", // Filter for order types
      limit: 100 // Limit to last 100 orders
    };

    const { data: orders } = await snaptrade.accountInformation.getAccountActivities(ordersPayload);

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
