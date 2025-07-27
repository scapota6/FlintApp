// Real-Time Pricing Service - Unified Live Data Source
import { RealTimeAPI } from '@/lib/real-time-api';

export interface RealTimePriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdated: string;
  source: 'snaptrade' | 'alpha_vantage' | 'tradingview';
}

export class RealTimePricingService {
  private static cache = new Map<string, { data: RealTimePriceData; timestamp: number }>();
  private static CACHE_DURATION = 5000; // 5 seconds for real-time updates
  private static activeSubscriptions = new Set<string>();

  // Symbol mapping for different exchanges
  private static symbolMapping: Record<string, string> = {
    'BTC': 'CRYPTO:BTCUSD',
    'ETH': 'CRYPTO:ETHUSD',
    'BITCOIN': 'CRYPTO:BTCUSD',
    'ETHEREUM': 'CRYPTO:ETHUSD',
    'AAPL': 'NASDAQ:AAPL',
    'GOOGL': 'NASDAQ:GOOGL',
    'TSLA': 'NASDAQ:TSLA',
    'MSFT': 'NASDAQ:MSFT',
    'AMZN': 'NASDAQ:AMZN',
    'NVDA': 'NASDAQ:NVDA',
    'META': 'NASDAQ:META'
  };

  static async getRealTimePrice(symbol: string): Promise<RealTimePriceData> {
    const cacheKey = symbol.toUpperCase();
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still fresh (5 seconds)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Try multiple sources in order of preference
      const priceData = await this.fetchFromMultipleSources(symbol);
      
      // Cache the result
      this.cache.set(cacheKey, { data: priceData, timestamp: Date.now() });
      return priceData;
    } catch (error) {
      console.error(`Failed to fetch real-time price for ${symbol}:`, error);
      throw new Error(`Unable to fetch price data for ${symbol}`);
    }
  }

  private static async fetchFromMultipleSources(symbol: string): Promise<RealTimePriceData> {
    const promises = [
      this.fetchFromSnapTrade(symbol),
      this.fetchFromAlphaVantage(symbol),
      this.fetchFromTradingView(symbol)
    ];

    const results = await Promise.allSettled(promises);
    
    // Use first successful result
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }

    // If all sources fail, return default structure
    return {
      symbol: symbol.toUpperCase(),
      price: 0,
      change: 0,
      changePercent: 0,
      lastUpdated: new Date().toISOString(),
      source: 'snaptrade'
    };
  }

  private static async fetchFromSnapTrade(symbol: string): Promise<RealTimePriceData | null> {
    try {
      const response = await fetch(`/api/snaptrade/quote?symbol=${symbol}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return {
        symbol: symbol.toUpperCase(),
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume,
        marketCap: data.marketCap,
        lastUpdated: new Date().toISOString(),
        source: 'snaptrade'
      };
    } catch (error) {
      return null;
    }
  }

  private static async fetchFromAlphaVantage(symbol: string): Promise<RealTimePriceData | null> {
    try {
      const quotes = await RealTimeAPI.getMultipleQuotes([symbol]);
      const quote = quotes[symbol.toUpperCase()];
      if (!quote) return null;

      return {
        symbol: symbol.toUpperCase(),
        price: quote.price || 0,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        volume: quote.volume,
        marketCap: quote.marketCap,
        lastUpdated: new Date().toISOString(),
        source: 'alpha_vantage'
      };
    } catch (error) {
      return null;
    }
  }

  private static async fetchFromTradingView(symbol: string): Promise<RealTimePriceData | null> {
    // TradingView integration would go here
    // For now, return null to fall back to other sources
    return null;
  }

  // Batch fetch for multiple symbols
  static async getRealTimePrices(symbols: string[]): Promise<Record<string, RealTimePriceData>> {
    const promises = symbols.map(symbol => 
      this.getRealTimePrice(symbol).catch(error => {
        console.error(`Failed to fetch ${symbol}:`, error);
        return null;
      })
    );

    const results = await Promise.all(promises);
    const priceData: Record<string, RealTimePriceData> = {};

    results.forEach((result, index) => {
      if (result) {
        priceData[symbols[index].toUpperCase()] = result;
      }
    });

    return priceData;
  }

  // Start real-time subscription for symbols
  static startRealTimeUpdates(symbols: string[], callback: (prices: Record<string, RealTimePriceData>) => void) {
    symbols.forEach(symbol => this.activeSubscriptions.add(symbol.toUpperCase()));

    const updateInterval = setInterval(async () => {
      try {
        const activeSymphols = Array.from(this.activeSubscriptions);
        if (activeSymphols.length === 0) {
          clearInterval(updateInterval);
          return;
        }

        const prices = await this.getRealTimePrices(activeSymphols);
        callback(prices);
      } catch (error) {
        console.error('Real-time update failed:', error);
      }
    }, 5000); // Update every 5 seconds

    return () => {
      symbols.forEach(symbol => this.activeSubscriptions.delete(symbol.toUpperCase()));
      if (this.activeSubscriptions.size === 0) {
        clearInterval(updateInterval);
      }
    };
  }

  static clearCache(): void {
    this.cache.clear();
  }
}