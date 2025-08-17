/**
 * Market Data Routes
 * Provides real-time quotes and historical candles for charting
 */

import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { marketDataService } from "../services/market-data";
import { snaptradeClient } from '../lib/snaptrade';
import { logger } from "@shared/logger";

const router = Router();



// Supported timeframes
const TIMEFRAMES = {
  '1D': { interval: 'DAY', days: 1 },
  '1W': { interval: 'WEEK', days: 7 },
  '1M': { interval: 'MONTH', days: 30 },
  '3M': { interval: 'MONTH', days: 90 },
  '6M': { interval: 'MONTH', days: 180 },
  '1Y': { interval: 'YEAR', days: 365 },
  '5Y': { interval: 'YEAR', days: 1825 }
};

/**
 * GET /api/market/quote
 * Returns real-time quote data for a symbol
 */
router.get("/quote", isAuthenticated, async (req: any, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ message: "Symbol is required" });
    }

    // Try to get real-time quote from market data service
    const quote = await marketDataService.getMarketData(symbol as string);
    
    if (!quote) {
      return res.status(404).json({ message: "Quote not found" });
    }
    
    // Format response
    const response = {
      symbol: quote.symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      high: quote.dayHigh,
      low: quote.dayLow,
      open: quote.open,
      previousClose: quote.previousClose,
      volume: quote.volume,
      marketCap: quote.marketCap,
      peRatio: quote.peRatio,
      weekHigh52: quote.week52High,
      weekLow52: quote.week52Low,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error("Error fetching quote", { error });
    res.status(500).json({ 
      message: "Failed to fetch quote",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/market/candles
 * Returns historical candle data for charting
 */
router.get("/candles", isAuthenticated, async (req: any, res) => {
  try {
    const { symbol, tf = '1D', limit = '500' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ message: "Symbol is required" });
    }
    
    const timeframe = TIMEFRAMES[tf as keyof typeof TIMEFRAMES] || TIMEFRAMES['1D'];
    const candleLimit = Math.min(parseInt(limit as string), 1500);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - timeframe.days);
    
    // Try SnapTrade first for historical data
    if (snaptradeClient) {
      try {
        const userId = req.user.claims.sub;
        const snaptradeUser = await (await import("../storage")).storage.getSnapTradeUser(userId);
        
        if (snaptradeUser?.snaptradeUserId && snaptradeUser?.userSecret) {
          // Get historical prices from SnapTrade
          const { data: priceHistory } = await snaptradeClient.marketData.getOptionStrategy({
            userId: snaptradeUser.snaptradeUserId,
            userSecret: snaptradeUser.userSecret,
            underlyingSymbolId: symbol as string,
            strategyType: 'CUSTOM' // Using CUSTOM to get underlying prices
          });
          
          // Convert to candle format if data available
          if (priceHistory) {
            const candles = [];
            // SnapTrade response would need proper parsing here
            // This is a placeholder structure
            return res.json({
              symbol,
              timeframe: tf,
              candles,
              source: 'snaptrade'
            });
          }
        }
      } catch (snapError) {
        logger.warn("SnapTrade historical data failed, falling back", { snapError });
      }
    }
    
    // Fallback to generating sample candle data for development
    // In production, this would call a proper market data API
    const candles = [];
    const basePrice = 100 + Math.random() * 400; // Random base price between 100-500
    let currentPrice = basePrice;
    
    for (let i = candleLimit - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate realistic OHLC data with some volatility
      const volatility = 0.02; // 2% daily volatility
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = currentPrice * (1 + change);
      
      const open = currentPrice;
      const close = currentPrice * (1 + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
      const volume = Math.floor(1000000 + Math.random() * 9000000);
      
      candles.push({
        time: Math.floor(date.getTime() / 1000), // Unix timestamp in seconds
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume
      });
      
      currentPrice = close; // Next candle opens at previous close
    }
    
    res.json({
      symbol,
      timeframe: tf,
      candles,
      source: 'synthetic' // Indicate this is sample data
    });
    
  } catch (error) {
    logger.error("Error fetching candles", { error });
    res.status(500).json({ 
      message: "Failed to fetch candle data",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/market/search
 * Search for symbols
 */
router.get("/search", isAuthenticated, async (req: any, res) => {
  try {
    const { query } = req.query;
    
    if (!query || (query as string).length < 2) {
      return res.status(400).json({ message: "Query must be at least 2 characters" });
    }
    
    // For now, return common symbols that match the query
    // In production, this would search a proper symbol database
    const commonSymbols = [
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock' },
      { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' },
      { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock' },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.', type: 'stock' },
      { symbol: 'V', name: 'Visa Inc.', type: 'stock' },
      { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'stock' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf' },
      { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf' },
      { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
      { symbol: 'ETH', name: 'Ethereum', type: 'crypto' }
    ];
    
    const searchTerm = (query as string).toUpperCase();
    const results = commonSymbols.filter(s => 
      s.symbol.includes(searchTerm) || 
      s.name.toUpperCase().includes(searchTerm)
    );
    
    res.json(results);
    
  } catch (error) {
    logger.error("Error searching symbols", { error });
    res.status(500).json({ 
      message: "Failed to search symbols",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;