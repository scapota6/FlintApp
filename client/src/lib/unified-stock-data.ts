/**
 * Unified Stock Data Service
 * Uses TradingView as the authoritative source for all stock data
 */

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  marketCap?: number;
  peRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  lastUpdate: Date;
}

class UnifiedStockDataService {
  private cache: Map<string, StockQuote> = new Map();
  private updateInterval: number = 5000; // 5 seconds

  // No hardcoded data - all prices must come from APIs

  /**
   * Get real-time stock data (synchronized with TradingView)
   */
  async getStockQuote(symbol: string): Promise<StockQuote> {
    const cleanSymbol = this.cleanSymbol(symbol);
    
    // Check cache first
    const cached = this.cache.get(cleanSymbol);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    try {
      const response = await fetch(`/api/quotes/${cleanSymbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch quote for ${cleanSymbol}`);
      }
      
      const data = await response.json();
      
      const quote: StockQuote = {
        symbol: data.symbol || cleanSymbol,
        name: data.name || `${cleanSymbol} Stock`,
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || 0,
        open: data.open || data.price || 0,
        high: data.high || data.price || 0,
        low: data.low || data.price || 0,
        marketCap: data.marketCap,
        peRatio: data.peRatio,
        fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: data.fiftyTwoWeekLow,
        lastUpdate: new Date()
      };
      
      this.cache.set(cleanSymbol, quote);
      return quote;
    } catch (error) {
      console.error(`Error fetching stock quote for ${cleanSymbol}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple stock quotes
   */
  async getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
    const promises = symbols.map(symbol => this.getStockQuote(symbol));
    return Promise.all(promises);
  }

  /**
   * Search for stocks via API (no hardcoded data)
   */
  async searchStocks(query: string): Promise<StockQuote[]> {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Failed to search for "${query}"`);
      }
      
      const results = await response.json();
      return results.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        price: item.price || 0,
        change: item.change || 0,
        changePercent: item.changePercent || 0,
        volume: item.volume || 0,
        open: item.open || item.price || 0,
        high: item.high || item.price || 0,
        low: item.low || item.price || 0,
        marketCap: item.marketCap,
        peRatio: item.peRatio,
        fiftyTwoWeekHigh: item.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: item.fiftyTwoWeekLow,
        lastUpdate: new Date()
      }));
    } catch (error) {
      console.error(`Error searching stocks for "${query}":`, error);
      return [];
    }
  }

  /**
   * Convert symbol to TradingView format
   */
  getTradingViewSymbol(symbol: string): string {
    const cleanSymbol = this.cleanSymbol(symbol);
    
    // Crypto symbols
    if (['BTC', 'ETH', 'ADA', 'SOL', 'DOGE', 'SHIB'].includes(cleanSymbol)) {
      return `BINANCE:${cleanSymbol}USDT`;
    }
    
    // Stock symbols - determine exchange
    const nasdaqStocks = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX'];
    if (nasdaqStocks.includes(cleanSymbol)) {
      return `NASDAQ:${cleanSymbol}`;
    }
    
    // Default to NYSE for other stocks
    return `NYSE:${cleanSymbol}`;
  }

  /**
   * Clean symbol (remove exchange prefixes)
   */
  private cleanSymbol(symbol: string): string {
    return symbol.replace(/^(NASDAQ:|NYSE:|BINANCE:)/, '').replace(/USDT$/, '');
  }

  /**
   * Add small real-time variations to price data
   */
  private addRealtimeVariation(baseValue: number, variationPercent: number = 0.005): number {
    const variation = (Math.random() - 0.5) * 2 * variationPercent;
    return baseValue * (1 + variation);
  }

  /**
   * Check if cached data is still valid (5 seconds)
   */
  private isCacheValid(quote: StockQuote): boolean {
    const now = new Date().getTime();
    const cacheTime = quote.lastUpdate.getTime();
    return (now - cacheTime) < this.updateInterval;
  }

  /**
   * Clear cache (useful for forcing fresh data)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const stockDataService = new UnifiedStockDataService();

// React hook for easy component integration
import { useState, useEffect } from 'react';

export function useStockQuote(symbol: string) {
  const [data, setData] = useState<StockQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const quote = await stockDataService.getStockQuote(symbol);
        if (mounted) {
          setData(quote);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Update every 5 seconds
    const interval = setInterval(fetchData, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  return { data, isLoading, error };
}