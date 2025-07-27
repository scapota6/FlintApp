import { Router } from "express";
import { marketDataService } from "../services/market-data";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Get market data for a single symbol
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ 
        error: "Symbol parameter is required" 
      });
    }

    // Get user's SnapTrade credentials for real market data
    const userId = req.user.claims.sub;
    const { storage } = await import("../storage");
    const user = await storage.getUser(userId);
    
    let snaptradeUserId: string | undefined;
    let snaptradeUserSecret: string | undefined;
    
    if (user?.snaptradeUserId && user?.snaptradeUserSecret) {
      snaptradeUserId = user.snaptradeUserId;
      snaptradeUserSecret = user.snaptradeUserSecret;
    }

    const marketData = await marketDataService.getMarketData(symbol, snaptradeUserId, snaptradeUserSecret);

    if (!marketData) {
      return res.status(404).json({ 
        error: `No market data found for symbol: ${symbol}` 
      });
    }

    res.json(marketData);
  } catch (error) {
    console.error("Error fetching market data:", error);
    res.status(500).json({ 
      error: "Failed to fetch market data" 
    });
  }
});

// Get market data for multiple symbols
router.post("/bulk", isAuthenticated, async (req: any, res) => {
  try {
    const { symbols } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ 
        error: "Symbols array is required" 
      });
    }

    // Limit to 50 symbols to prevent abuse
    if (symbols.length > 50) {
      return res.status(400).json({ 
        error: "Maximum 50 symbols allowed per request" 
      });
    }

    // Get user's SnapTrade credentials
    const userId = req.user.claims.sub;
    const { storage } = await import("../storage");
    const user = await storage.getUser(userId);
    
    let snaptradeUserId: string | undefined;
    let snaptradeUserSecret: string | undefined;
    
    if (user?.snaptradeUserId && user?.snaptradeUserSecret) {
      snaptradeUserId = user.snaptradeUserId;
      snaptradeUserSecret = user.snaptradeUserSecret;
    }

    // Update getBulkMarketData to accept credentials
    const results: {[symbol: string]: any} = {};
    
    // Process symbols in parallel with user credentials
    const promises = symbols.map(async (symbol: string) => {
      const data = await marketDataService.getMarketData(symbol, snaptradeUserId, snaptradeUserSecret);
      return { symbol: symbol.toUpperCase(), data };
    });

    const responses = await Promise.all(promises);
    
    responses.forEach(({ symbol, data }) => {
      results[symbol] = data;
    });

    res.json(results);
  } catch (error) {
    console.error("Error fetching bulk market data:", error);
    res.status(500).json({ 
      error: "Failed to fetch bulk market data" 
    });
  }
});

// Get watchlist with market data (authenticated endpoint)
router.get("/watchlist", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get user's watchlist symbols from database
    const { db } = await import("../db");
    const { watchlist } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    const userWatchlist = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId));

    if (userWatchlist.length === 0) {
      return res.json({ watchlist: [] });
    }

    // Get market data for all watchlist symbols
    const symbols = userWatchlist.map(item => item.symbol);
    const marketData = await marketDataService.getBulkMarketData(symbols);

    // Combine watchlist items with market data
    const enrichedWatchlist = userWatchlist.map(item => ({
      ...item,
      marketData: marketData[item.symbol]
    }));

    res.json({ watchlist: enrichedWatchlist });
  } catch (error) {
    console.error("Error fetching watchlist with market data:", error);
    res.status(500).json({ 
      error: "Failed to fetch watchlist market data" 
    });
  }
});

// Cache management endpoints (for debugging)
router.get("/cache/stats", (req, res) => {
  const stats = marketDataService.getCacheStats();
  res.json(stats);
});

router.post("/cache/clear", (req, res) => {
  marketDataService.clearCache();
  res.json({ message: "Cache cleared successfully" });
});

export default router;