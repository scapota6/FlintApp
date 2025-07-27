import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { rateLimits } from "../middleware/rateLimiter";
import { polygonMarketDataService } from "../services/polygon-market-data";

const router = Router();

// Get single quote
router.get("/quote/:symbol", rateLimits.data, async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ message: "Symbol is required" });
    }

    const quote = await polygonMarketDataService.getQuote(symbol);
    res.json(quote);
    
  } catch (error: any) {
    console.error(`Error fetching quote for ${req.params.symbol}:`, error);
    res.status(500).json({ 
      message: "Failed to fetch quote",
      error: error.message
    });
  }
});

// Get real-time quote
router.get("/realtime/:symbol", rateLimits.data, async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ message: "Symbol is required" });
    }

    const quote = await polygonMarketDataService.getRealTimeQuote(symbol);
    res.json(quote);
    
  } catch (error: any) {
    console.error(`Error fetching real-time quote for ${req.params.symbol}:`, error);
    res.status(500).json({ 
      message: "Failed to fetch real-time quote",
      error: error.message
    });
  }
});

// Get multiple quotes
router.post("/quotes", rateLimits.data, async (req, res) => {
  try {
    const { symbols } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ message: "Valid symbols array required" });
    }

    if (symbols.length > 10) {
      return res.status(400).json({ message: "Maximum 10 symbols allowed per request" });
    }

    const quotes = await polygonMarketDataService.getMultipleQuotes(symbols);
    res.json(quotes);
    
  } catch (error: any) {
    console.error("Error fetching multiple quotes:", error);
    res.status(500).json({ 
      message: "Failed to fetch quotes",
      error: error.message
    });
  }
});

// Search symbols
router.get("/search", rateLimits.data, async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: "Search query is required" });
    }

    const results = await polygonMarketDataService.searchSymbols(query);
    res.json(results);
    
  } catch (error: any) {
    console.error(`Error searching symbols for "${req.query.q}":`, error);
    res.status(500).json({ 
      message: "Failed to search symbols",
      error: error.message
    });
  }
});

// Get historical data
router.get("/historical/:symbol", rateLimits.data, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { 
      timespan = 'day', 
      multiplier = '1', 
      from, 
      to 
    } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ message: "Symbol is required" });
    }

    if (!from || !to) {
      return res.status(400).json({ message: "From and to dates are required (YYYY-MM-DD format)" });
    }

    const data = await polygonMarketDataService.getHistoricalData(
      symbol, 
      timespan as string, 
      parseInt(multiplier as string), 
      from as string, 
      to as string
    );
    
    res.json(data);
    
  } catch (error: any) {
    console.error(`Error fetching historical data for ${req.params.symbol}:`, error);
    res.status(500).json({ 
      message: "Failed to fetch historical data",
      error: error.message
    });
  }
});

// Test API connection
router.get("/test", async (req, res) => {
  try {
    const result = await polygonMarketDataService.testConnection();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(503).json(result);
    }
    
  } catch (error: any) {
    console.error("Error testing API connection:", error);
    res.status(500).json({ 
      success: false,
      message: "Connection test failed",
      error: error.message
    });
  }
});

// Bulk market data endpoint for dashboard
router.get("/bulk", rateLimits.data, async (req, res) => {
  try {
    const { symbols: symbolsParam } = req.query;
    
    let symbols: string[];
    if (typeof symbolsParam === 'string') {
      symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    } else {
      // Default symbols for dashboard
      symbols = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'AMZN', 'NVDA', 'META', 'NFLX'];
    }

    if (symbols.length > 20) {
      return res.status(400).json({ message: "Maximum 20 symbols allowed for bulk request" });
    }

    const quotes = await polygonMarketDataService.getMultipleQuotes(symbols);
    
    // Format for frontend consumption
    const formattedQuotes = quotes.reduce((acc: any, quote) => {
      acc[quote.symbol] = quote;
      return acc;
    }, {});

    res.json({
      success: true,
      data: formattedQuotes,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error fetching bulk market data:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch bulk market data",
      error: error.message
    });
  }
});

export default router;