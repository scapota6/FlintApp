/**
 * Market Data Cache using IndexedDB
 * Caches candle data to reduce API calls
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketDB extends DBSchema {
  candles: {
    key: string;
    value: {
      symbol: string;
      timeframe: string;
      candles: CandleData[];
      lastUpdated: number;
    };
  };
  quotes: {
    key: string;
    value: {
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
      volume: number;
      timestamp: number;
    };
  };
}

class MarketDataCache {
  private db: IDBPDatabase<MarketDB> | null = null;
  private readonly DB_NAME = 'MarketDataCache';
  private readonly DB_VERSION = 1;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  async init() {
    if (this.db) return;

    this.db = await openDB<MarketDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        // Create candles store
        if (!db.objectStoreNames.contains('candles')) {
          db.createObjectStore('candles');
        }
        // Create quotes store
        if (!db.objectStoreNames.contains('quotes')) {
          db.createObjectStore('quotes');
        }
      },
    });
  }

  private getCacheKey(symbol: string, timeframe: string): string {
    return `${symbol}_${timeframe}`;
  }

  async getCachedCandles(symbol: string, timeframe: string): Promise<CandleData[] | null> {
    await this.init();
    if (!this.db) return null;

    try {
      const key = this.getCacheKey(symbol, timeframe);
      const cached = await this.db.get('candles', key);
      
      if (!cached) return null;
      
      // Check if cache is still valid
      const now = Date.now();
      if (now - cached.lastUpdated > this.CACHE_TTL) {
        // Cache expired
        await this.db.delete('candles', key);
        return null;
      }
      
      return cached.candles;
    } catch (error) {
      console.error('Error getting cached candles:', error);
      return null;
    }
  }

  async setCachedCandles(symbol: string, timeframe: string, candles: CandleData[]) {
    await this.init();
    if (!this.db) return;

    try {
      const key = this.getCacheKey(symbol, timeframe);
      await this.db.put('candles', {
        symbol,
        timeframe,
        candles,
        lastUpdated: Date.now()
      }, key);
    } catch (error) {
      console.error('Error caching candles:', error);
    }
  }

  async getCachedQuote(symbol: string) {
    await this.init();
    if (!this.db) return null;

    try {
      const cached = await this.db.get('quotes', symbol);
      
      if (!cached) return null;
      
      // Check if quote is recent (within 15 seconds)
      const now = Date.now();
      if (now - cached.timestamp > 15000) {
        await this.db.delete('quotes', symbol);
        return null;
      }
      
      return cached;
    } catch (error) {
      console.error('Error getting cached quote:', error);
      return null;
    }
  }

  async setCachedQuote(symbol: string, quote: any) {
    await this.init();
    if (!this.db) return;

    try {
      await this.db.put('quotes', {
        symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        timestamp: Date.now()
      }, symbol);
    } catch (error) {
      console.error('Error caching quote:', error);
    }
  }

  async clearCache() {
    await this.init();
    if (!this.db) return;

    try {
      const tx = this.db.transaction(['candles', 'quotes'], 'readwrite');
      await Promise.all([
        tx.objectStore('candles').clear(),
        tx.objectStore('quotes').clear()
      ]);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

export const marketCache = new MarketDataCache();