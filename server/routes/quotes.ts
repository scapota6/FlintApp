import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { snaptradeUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { authApi, accountsApi, tradingApi } from "../lib/snaptrade";
import { validate, createApiError, extractSnapTradeRequestId } from '../lib/validation';

const router = Router();

// Helper function to get user's SnapTrade credentials
async function getSnapTradeCredentials(email: string) {
  // Find the Flint user by email
  const flintUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email)
  });
  
  if (!flintUser) {
    throw new Error('User not found');
  }
  
  // Get SnapTrade credentials
  const [credentials] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.flintUserId, flintUser.id))
    .limit(1);
  
  if (!credentials) {
    throw new Error('SnapTrade account not connected');
  }
  
  return {
    userId: credentials.flintUserId, // Use flintUserId as the SnapTrade userId
    userSecret: credentials.userSecret
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
    const credentials = await getSnapTradeCredentials(email);

    console.log(`Getting quote for ${symbol.toUpperCase()}`);

    // First get user's accounts to use for quotes
    const { data: userAccounts } = await accountsApi.listUserAccounts({
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
    const { data: quotes } = await tradingApi.getUserAccountQuotes({
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

    // Transform to our expected format with explicit null handling
    const transformedQuote = {
      symbol: (quote.symbol as any)?.raw_symbol || (quote.symbol as any)?.symbol || symbol.toUpperCase(),
      name: (quote.symbol as any)?.description || `${symbol.toUpperCase()} Inc.`,
      price: quote.last_trade_price || quote.ask_price || quote.bid_price || 0,
      change: null, // SnapTrade doesn't provide change in quotes
      changePercent: null, // SnapTrade doesn't provide change percent in quotes
      volume: (quote.bid_size || 0) + (quote.ask_size || 0),
      open: quote.last_trade_price || null,
      high: quote.last_trade_price || null,
      low: quote.last_trade_price || null,
      marketCap: null, // Not available in quotes
      previousClose: null, // Not available in quotes
      lastUpdate: new Date().toISOString(),
      bid: quote.bid_price || null,
      ask: quote.ask_price || null,
      bidSize: quote.bid_size || null,
      askSize: quote.ask_size || null
    };

    res.json(transformedQuote);

  } catch (err: any) {
    const requestId = extractSnapTradeRequestId(err.response);
    
    console.error('Quote fetch error:', {
      path: req.originalUrl,
      symbol: req.params.symbol,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message,
      snaptradeRequestId: requestId
    });
    
    const status = err.response?.status || 500;
    const apiError = createApiError(
      err.message || "Quote fetch failed",
      err.response?.data?.code || 'QUOTE_FETCH_ERROR',
      status,
      requestId
    );
    
    return res.status(status).json({
      error: {
        message: apiError.message,
        code: apiError.code,
        requestId: apiError.requestId || null
      }
    });
  }
});

export default router;