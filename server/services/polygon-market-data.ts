import { storage } from "../storage";

// Polygon.io Market Data Service with real-time data
class PolygonMarketDataService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds for Polygon.io rate limiting
  private readonly POLYGON_API_KEY = process.env.POLYGON_API_KEY;

  async getQuote(symbol: string): Promise<any> {
    const cacheKey = `quote:${symbol}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      if (!this.POLYGON_API_KEY) {
        console.warn('POLYGON_API_KEY not found, using fallback data');
        return this.getFallbackQuote(symbol);
      }

      // Get real-time quote from Polygon.io
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/prev?adjusted=true&apikey=${this.POLYGON_API_KEY}`
      );

      if (!response.ok) {
        console.error(`Polygon.io API error: ${response.status} ${response.statusText}`);
        return this.getFallbackQuote(symbol);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        console.warn(`No data found for symbol ${symbol}`);
        return this.getFallbackQuote(symbol);
      }

      const result = data.results[0];
      const quote = {
        symbol: symbol.toUpperCase(),
        price: result.c, // Close price
        change: result.c - result.o, // Close - Open
        changePct: ((result.c - result.o) / result.o) * 100,
        volume: result.v,
        high: result.h,
        low: result.l,
        open: result.o,
        marketCap: await this.getMarketCap(symbol),
        lastUpdated: new Date().toISOString(),
        source: 'polygon.io'
      };

      this.cache.set(cacheKey, { data: quote, timestamp: Date.now() });
      
      // Store in database for persistence
      await storage.updateMarketData({
        symbol: symbol.toUpperCase(),
        price: quote.price,
        changePercent: quote.changePct,
        volume: quote.volume ? quote.volume.toString() : "0",
        marketCap: quote.marketCap?.toString(),
      });

      return quote;

    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return this.getFallbackQuote(symbol);
    }
  }

  async getRealTimeQuote(symbol: string): Promise<any> {
    try {
      if (!this.POLYGON_API_KEY) {
        return this.getFallbackQuote(symbol);
      }

      // Get real-time last trade from Polygon.io
      const response = await fetch(
        `https://api.polygon.io/v1/last/stocks/${symbol.toUpperCase()}?apikey=${this.POLYGON_API_KEY}`
      );

      if (!response.ok) {
        console.error(`Polygon.io real-time API error: ${response.status}`);
        return this.getQuote(symbol); // Fall back to previous day data
      }

      const data = await response.json();
      
      if (data.status !== 'OK' || !data.last) {
        return this.getQuote(symbol);
      }

      const quote = {
        symbol: symbol.toUpperCase(),
        price: data.last.price,
        change: 0, // Would need previous close to calculate
        changePct: 0,
        volume: data.last.size,
        timestamp: data.last.timestamp,
        lastUpdated: new Date().toISOString(),
        source: 'polygon.io-realtime'
      };

      return quote;

    } catch (error) {
      console.error(`Error fetching real-time quote for ${symbol}:`, error);
      return this.getQuote(symbol);
    }
  }

  async getMarketCap(symbol: string): Promise<number | undefined> {
    try {
      if (!this.POLYGON_API_KEY) {
        return undefined;
      }

      const response = await fetch(
        `https://api.polygon.io/v3/reference/tickers/${symbol.toUpperCase()}?apikey=${this.POLYGON_API_KEY}`
      );

      if (!response.ok) {
        return undefined;
      }

      const data = await response.json();
      return data.results?.market_cap;

    } catch (error) {
      console.error(`Error fetching market cap for ${symbol}:`, error);
      return undefined;
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<any[]> {
    // Process in batches to respect API limits
    const batchSize = 5;
    const results: any[] = [];

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(symbol => this.getQuote(symbol));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Failed to fetch quote for ${batch[index]}:`, result.reason);
          results.push(this.getFallbackQuote(batch[index]));
        }
      });

      // Rate limiting delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async searchSymbols(query: string): Promise<any[]> {
    try {
      if (!this.POLYGON_API_KEY) {
        return this.getFallbackSearch(query);
      }

      const response = await fetch(
        `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=10&apikey=${this.POLYGON_API_KEY}`
      );

      if (!response.ok) {
        return this.getFallbackSearch(query);
      }

      const data = await response.json();
      
      return (data.results || []).map((ticker: any) => ({
        symbol: ticker.ticker,
        name: ticker.name,
        market: ticker.market,
        type: ticker.type,
        active: ticker.active,
        currency_name: ticker.currency_name,
      }));

    } catch (error) {
      console.error(`Error searching symbols for ${query}:`, error);
      return this.getFallbackSearch(query);
    }
  }

  private getFallbackQuote(symbol: string): any {
    // High-quality fallback with realistic prices
    const basePrices: { [key: string]: number } = {
      'AAPL': 215.42,
      'GOOGL': 140.85,
      'TSLA': 248.50,
      'MSFT': 389.75,
      'AMZN': 147.20,
      'NVDA': 892.30,
      'META': 492.85,
      'NFLX': 431.60,
      'AMD': 165.40,
      'INTC': 28.95,
    };
    
    const basePrice = basePrices[symbol.toUpperCase()] || 100;
    const variance = basePrice * 0.015 * (Math.random() - 0.5); // ±0.75% variance
    const price = Math.round((basePrice + variance) * 100) / 100;
    const change = price - basePrice;
    const changePct = (change / basePrice) * 100;

    return {
      symbol: symbol.toUpperCase(),
      price,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume: Math.floor(Math.random() * 5000000) + 500000,
      high: Math.round((price * 1.03) * 100) / 100,
      low: Math.round((price * 0.97) * 100) / 100,
      open: basePrice,
      marketCap: Math.floor(Math.random() * 1000000000000) + 50000000000,
      lastUpdated: new Date().toISOString(),
      source: 'fallback'
    };
  }

  private getFallbackSearch(query: string): any[] {
    const commonSymbols = [
      { symbol: 'AAPL', name: 'Apple Inc.', market: 'stocks', type: 'CS' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'stocks', type: 'CS' },
      { symbol: 'TSLA', name: 'Tesla, Inc.', market: 'stocks', type: 'CS' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'stocks', type: 'CS' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.', market: 'stocks', type: 'CS' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'stocks', type: 'CS' },
      { symbol: 'META', name: 'Meta Platforms, Inc.', market: 'stocks', type: 'CS' },
      { symbol: 'NFLX', name: 'Netflix, Inc.', market: 'stocks', type: 'CS' },
    ];

    return commonSymbols.filter(s => 
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Get historical data
  async getHistoricalData(symbol: string, timespan: string = 'day', multiplier: number = 1, from: string, to: string): Promise<any> {
    try {
      if (!this.POLYGON_API_KEY) {
        return { status: 'ERROR', message: 'API key required for historical data' };
      }

      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&apikey=${this.POLYGON_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return { status: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Test API connectivity
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.POLYGON_API_KEY) {
        return { success: false, message: 'POLYGON_API_KEY not configured' };
      }

      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apikey=${this.POLYGON_API_KEY}`
      );

      if (!response.ok) {
        return { success: false, message: `API Error: ${response.status} ${response.statusText}` };
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return { success: true, message: 'Polygon.io API connected successfully' };
      } else {
        return { success: false, message: 'API connected but no data returned' };
      }

    } catch (error) {
      return { 
        success: false, 
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

export const polygonMarketDataService = new PolygonMarketDataService();