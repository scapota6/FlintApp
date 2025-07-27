import { Snaptrade } from "snaptrade-typescript-sdk";

// Market data cache to prevent excessive API calls
interface MarketDataCache {
  [symbol: string]: {
    data: MarketData;
    timestamp: number;
  };
}

interface MarketData {
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap: number;
  company_name?: string;
  logo_url?: string;
}

class MarketDataService {
  private cache: MarketDataCache = {};
  private readonly CACHE_DURATION = 5000; // 5 seconds cache
  private snaptrade: Snaptrade;
  private alphaVantageKey: string;

  constructor() {
    this.snaptrade = new Snaptrade({
      clientId: process.env.SNAPTRADE_CLIENT_ID!,
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
    });
    
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || '';
  }

  async getMarketData(symbol: string): Promise<MarketData | null> {
    const cacheKey = symbol.toUpperCase();
    const now = Date.now();

    // Return cached data if still fresh
    if (this.cache[cacheKey] && (now - this.cache[cacheKey].timestamp) < this.CACHE_DURATION) {
      return this.cache[cacheKey].data;
    }

    try {
      // Use Alpaca as primary source for real-time data
      let marketData = await this.fetchFromAlpaca(symbol);
      
      // Fallback to Alpha Vantage if Alpaca fails
      if (!marketData && this.alphaVantageKey) {
        marketData = await this.fetchFromAlphaVantage(symbol);
      }
      
      // Final fallback to SnapTrade
      if (!marketData) {
        marketData = await this.fetchFromSnapTrade(symbol);
      }

      if (marketData) {
        // Cache the result
        this.cache[cacheKey] = {
          data: marketData,
          timestamp: now
        };
        
        return marketData;
      }

    } catch (error) {
      console.error(`Failed to fetch market data for ${symbol}:`, error);
    }

    return null;
  }

  private async fetchFromAlpaca(symbol: string): Promise<MarketData | null> {
    try {
      console.log(`Fetching real-time data for ${symbol} from Alpaca Markets`);
      
      // Use Alpaca's latest quotes endpoint for real-time data
      const alpacaBaseUrl = 'https://data.alpaca.markets/v2/stocks';
      const response = await fetch(`${alpacaBaseUrl}/${symbol}/quotes/latest`, {
        headers: {
          'Apca-Api-Key-Id': process.env.ALPACA_API_KEY || '',
          'Apca-Api-Secret-Key': process.env.ALPACA_SECRET_KEY || ''
        }
      });

      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.quote && data.quote.ap && data.quote.bp) {
        // Use average of ask/bid prices for current price
        const askPrice = parseFloat(data.quote.ap);
        const bidPrice = parseFloat(data.quote.bp);
        const currentPrice = (askPrice + bidPrice) / 2;
        
        // Get additional data from bars endpoint for volume/change
        const barsResponse = await fetch(`${alpacaBaseUrl}/${symbol}/bars/latest`, {
          headers: {
            'Apca-Api-Key-Id': process.env.ALPACA_API_KEY || '',
            'Apca-Api-Secret-Key': process.env.ALPACA_SECRET_KEY || ''
          }
        });

        let volume = 0;
        let changePct = 0;
        
        if (barsResponse.ok) {
          const barsData = await barsResponse.json();
          if (barsData.bar) {
            volume = barsData.bar.v || 0;
            const openPrice = parseFloat(barsData.bar.o);
            changePct = openPrice ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
          }
        }

        console.log(`Successfully fetched ${symbol} from Alpaca: $${currentPrice.toFixed(2)}`);

        return {
          symbol: symbol.toUpperCase(),
          price: parseFloat(currentPrice.toFixed(2)),
          changePct: parseFloat(changePct.toFixed(2)),
          volume,
          marketCap: this.getMarketCapEstimate(symbol),
          company_name: this.getCompanyName(symbol),
          logo_url: undefined
        };
      }

      console.log(`No valid quote data from Alpaca for ${symbol}`);
      return null;
    } catch (error: any) {
      console.log(`Alpaca fetch failed for ${symbol}:`, error?.message || 'Unknown error');
      return null;
    }
  }

  private async fetchFromSnapTrade(symbol: string): Promise<MarketData | null> {
    try {
      // Use SnapTrade as fallback only
      console.log(`Attempting SnapTrade fallback for ${symbol}`);
      return null;
    } catch (error: any) {
      console.log(`SnapTrade fetch failed for ${symbol}:`, error?.message || 'Unknown error');
      return null;
    }
  }

  private getMarketCapEstimate(symbol: string): number {
    const marketCapEstimates: {[key: string]: number} = {
      'AAPL': 3300000000000,
      'GOOGL': 1800000000000, 
      'MSFT': 2800000000000,
      'TSLA': 780000000000,
      'AMZN': 1600000000000,
      'META': 800000000000,
      'NVDA': 1700000000000
    };
    return marketCapEstimates[symbol.toUpperCase()] || 0;
  }

  private async fetchFromAlphaVantage(symbol: string): Promise<MarketData | null> {
    if (!this.alphaVantageKey) {
      console.log('Alpha Vantage API key not available');
      return null;
    }

    try {
      console.log(`Fetching real-time data for ${symbol} from Alpha Vantage`);
      
      // Fetch quote data from Alpha Vantage GLOBAL_QUOTE endpoint
      const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.alphaVantageKey}`;
      const response = await fetch(quoteUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check for API limit or error responses
      if (data['Error Message']) {
        throw new Error(data['Error Message']);
      }
      
      if (data['Information']) {
        console.log(`Alpha Vantage rate limit: ${data['Information']}`);
        return null;
      }

      const quote = data['Global Quote'];
      if (quote && quote['05. price']) {
        const price = parseFloat(quote['05. price']);
        const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
        const volume = parseInt(quote['06. volume']) || 0;

        console.log(`Successfully fetched ${symbol}: $${price} (${changePercent > 0 ? '+' : ''}${changePercent}%)`);

        // Use market cap estimates to avoid rate limits

        return {
          symbol: symbol.toUpperCase(),
          price,
          changePct: changePercent,
          volume,
          marketCap: this.getMarketCapEstimate(symbol),
          company_name: this.getCompanyName(symbol),
          logo_url: undefined
        };
      } else {
        console.log(`No valid quote data received for ${symbol}`, data);
      }
    } catch (error: any) {
      console.log(`Alpha Vantage fetch failed for ${symbol}:`, error?.message || 'Unknown error');
    }

    return null;
  }

  private getCompanyName(symbol: string): string {
    const companyNames: {[key: string]: string} = {
      'AAPL': 'Apple Inc.',
      'GOOGL': 'Alphabet Inc.',
      'MSFT': 'Microsoft Corporation', 
      'TSLA': 'Tesla, Inc.',
      'AMZN': 'Amazon.com Inc.',
      'META': 'Meta Platforms Inc.',
      'NVDA': 'NVIDIA Corporation'
    };
    
    return companyNames[symbol.toUpperCase()] || symbol.toUpperCase();
  }

  // Get multiple symbols at once
  async getBulkMarketData(symbols: string[]): Promise<{[symbol: string]: MarketData | null}> {
    const results: {[symbol: string]: MarketData | null} = {};
    
    // Process symbols in parallel
    const promises = symbols.map(async (symbol) => {
      const data = await this.getMarketData(symbol);
      return { symbol: symbol.toUpperCase(), data };
    });

    const responses = await Promise.all(promises);
    
    responses.forEach(({ symbol, data }) => {
      results[symbol] = data;
    });

    return results;
  }

  // Clear cache for testing
  clearCache(): void {
    this.cache = {};
  }

  // Get cache stats for monitoring
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: Object.keys(this.cache).length,
      keys: Object.keys(this.cache)
    };
  }

  async getMultipleQuotes(symbols: string[]): Promise<Record<string, MarketData>> {
    const quotes: Record<string, MarketData> = {};
    
    // Fetch all quotes in parallel
    const promises = symbols.map(async (symbol) => {
      const quote = await this.getMarketData(symbol);
      if (quote) {
        quotes[symbol.toUpperCase()] = quote;
      }
    });

    await Promise.all(promises);
    return quotes;
  }
}

export const marketDataService = new MarketDataService();
export type { MarketData };