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

// Get real-time quote for a symbol
router.get("/:symbol", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const { symbol } = req.params;
    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    // Get user credentials
    const credentials = await getUserSnapTradeCredentials(email);

    console.log(`Getting quote for ${symbol.toUpperCase()}`);

    // First get user's accounts to use for quotes
    const { data: userAccounts } = await snaptrade.accountInformation.listUserAccounts({
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    if (!userAccounts.length) {
      return res.status(400).json({ 
        error: "No connected accounts found. Please connect a brokerage account first." 
      });
    }

    // Use the first account for quotes
    const accountId = userAccounts[0].id;

    // Get the latest quote from SnapTrade
    const { data: quotes } = await snaptrade.trading.getUserAccountQuotes({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      symbols: symbol.toUpperCase(),
      accountId: accountId,
      useTicker: true
    });

    if (!quotes.length) {
      return res.status(404).json({ error: `Quote not found for symbol: ${symbol}` });
    }

    const quote = quotes[0];
    console.log(`Quote received for ${symbol}:`, {
      symbol: quote.symbol,
      price: quote.last_trade_price,
      bid: quote.bid_price,
      ask: quote.ask_price
    });

    // Transform to our expected format
    const transformedQuote = {
      symbol: quote.symbol,
      name: (quote as any).description || `${quote.symbol} Inc.`,
      price: quote.last_trade_price || quote.ask_price || quote.bid_price || 0,
      change: 0, // SnapTrade doesn't provide change in quotes
      changePercent: 0, // SnapTrade doesn't provide change percent in quotes
      volume: (quote.bid_size || 0) + (quote.ask_size || 0),
      open: quote.last_trade_price || 0,
      high: quote.last_trade_price || 0,
      low: quote.last_trade_price || 0,
      marketCap: 0, // Not available in quotes
      lastUpdate: new Date().toISOString()
    };

    res.json(transformedQuote);

  } catch (err: any) {
    console.error('Quote fetch error:', {
      path: req.originalUrl,
      symbol: req.params.symbol,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { 
      message: err.message,
      error: "Quote fetch failed"
    };
    return res.status(status).json(body);
  }
});

export default router;