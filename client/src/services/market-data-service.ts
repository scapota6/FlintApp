import { RealTimeAPI } from '@/lib/real-time-api';

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdated: string;
}

export interface WatchlistItem extends StockData {
  id: string;
  userId: string;
  addedAt: string;
}

export class MarketDataService {
  private static cache = new Map<string, { data: StockData; timestamp: number }>();
  private static CACHE_DURATION = 60000; // 1 minute cache

  // Company name mappings for known symbols
  private static companyNames: Record<string, string> = {
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet Inc.',
    'TSLA': 'Tesla, Inc.',
    'MSFT': 'Microsoft Corporation',
    'AMZN': 'Amazon.com Inc.',
    'NVDA': 'NVIDIA Corporation',
    'META': 'Meta Platforms Inc.',
    'NFLX': 'Netflix Inc.',
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
  };

  static async getStockData(symbol: string): Promise<StockData> {
    const cacheKey = symbol.toUpperCase();
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still fresh
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Fetch real-time data from multiple sources
      const [snapTradeQuote, alphaVantageQuote] = await Promise.allSettled([
        this.fetchSnapTradeQuote(symbol),
        this.fetchAlphaVantageQuote(symbol)
      ]);

      let stockData: StockData;

      if (snapTradeQuote.status === 'fulfilled' && snapTradeQuote.value) {
        stockData = snapTradeQuote.value;
      } else if (alphaVantageQuote.status === 'fulfilled' && alphaVantageQuote.value) {
        stockData = alphaVantageQuote.value;
      } else {
        // Fallback to basic structure
        stockData = {
          symbol: symbol.toUpperCase(),
          name: this.companyNames[symbol.toUpperCase()] || `${symbol.toUpperCase()} Stock`,
          price: 0,
          change: 0,
          changePercent: 0,
          lastUpdated: new Date().toISOString()
        };
      }

      // Cache the result
      this.cache.set(cacheKey, { data: stockData, timestamp: Date.now() });
      return stockData;
    } catch (error) {
      console.error(`Failed to fetch stock data for ${symbol}:`, error);
      throw error;
    }
  }

  private static async fetchSnapTradeQuote(symbol: string): Promise<StockData | null> {
    try {
      const response = await fetch(`/api/snaptrade/quote?symbol=${symbol}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return {
        symbol: symbol.toUpperCase(),
        name: this.companyNames[symbol.toUpperCase()] || `${symbol.toUpperCase()} Stock`,
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  private static async fetchAlphaVantageQuote(symbol: string): Promise<StockData | null> {
    try {
      const quotes = await RealTimeAPI.getMultipleQuotes([symbol]);
      const quote = quotes[symbol];
      if (!quote) return null;

      return {
        symbol: symbol.toUpperCase(),
        name: this.companyNames[symbol.toUpperCase()] || `${symbol.toUpperCase()} Stock`,
        price: quote.price || 0,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        volume: quote.volume,
        marketCap: quote.marketCap,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  static async getWatchlistData(symbols: string[]): Promise<StockData[]> {
    const promises = symbols.map(symbol => this.getStockData(symbol));
    const results = await Promise.allSettled(promises);
    
    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<StockData>).value)
      .filter(data => data.price > 0); // Only return valid data
  }

  static clearCache(): void {
    this.cache.clear();
  }
}