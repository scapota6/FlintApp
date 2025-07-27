import { apiRequest } from './queryClient';

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  lastUpdated: string;
}

export class RealTimeAPI {
  private static cache = new Map<string, { data: LiveQuote; timestamp: number }>();
  private static cacheTimeout = 30000; // 30 seconds

  static async getQuote(symbol: string): Promise<LiveQuote | null> {
    try {
      // Check cache first
      const cached = this.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const response = await apiRequest('GET', `/api/quotes/${symbol}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Quote not found for symbol: ${symbol}`);
          return null;
        }
        throw new Error(`Failed to fetch quote: ${response.status}`);
      }

      const quote: LiveQuote = await response.json();
      
      // Cache the result
      this.cache.set(symbol, { data: quote, timestamp: Date.now() });
      
      return quote;
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  static async getMultipleQuotes(symbols: string[]): Promise<Record<string, LiveQuote | null>> {
    try {
      if (symbols.length === 0) return {};

      const response = await apiRequest('POST', '/api/quotes', {
        symbols: symbols
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch quotes: ${response.status}`);
      }

      const quotes: Record<string, LiveQuote | null> = await response.json();
      
      // Cache all results
      Object.entries(quotes).forEach(([symbol, quote]) => {
        if (quote) {
          this.cache.set(symbol, { data: quote, timestamp: Date.now() });
        }
      });

      return quotes;
    } catch (error) {
      console.error('Error fetching multiple quotes:', error);
      return {};
    }
  }

  static clearCache() {
    this.cache.clear();
  }

  static getCachedQuote(symbol: string): LiveQuote | null {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }
}