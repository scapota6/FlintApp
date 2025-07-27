import { Request, Response } from 'express';

interface AlphaVantageQuote {
  '01. symbol': string;
  '02. open': string;
  '03. high': string;
  '04. low': string;
  '05. price': string;
  '06. volume': string;
  '07. latest trading day': string;
  '08. previous close': string;
  '09. change': string;
  '10. change percent': string;
}

interface AlphaVantageResponse {
  'Global Quote': AlphaVantageQuote;
  'Error Message'?: string;
  'Note'?: string;
}

interface StockQuote {
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

class MarketDataService {
  private apiKey: string;
  private baseUrl = 'https://www.alphavantage.co/query';
  private cache = new Map<string, { data: StockQuote; timestamp: number }>();
  private cacheTimeout = 60000; // 1 minute cache

  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ALPHA_VANTAGE_API_KEY not found in environment variables');
    }
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      // Check cache first
      const cached = this.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data: AlphaVantageResponse = await response.json();

      // Check for API errors
      if (data['Error Message']) {
        console.error(`Alpha Vantage error for ${symbol}:`, data['Error Message']);
        return null;
      }

      if (data['Note']) {
        console.warn(`Alpha Vantage rate limit warning:`, data['Note']);
        return null;
      }

      const quote = data['Global Quote'];
      if (!quote) {
        console.error(`No quote data received for ${symbol}`);
        return null;
      }

      const stockQuote: StockQuote = {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        previousClose: parseFloat(quote['08. previous close']),
        lastUpdated: quote['07. latest trading day']
      };

      // Cache the result
      this.cache.set(symbol, { data: stockQuote, timestamp: Date.now() });

      return stockQuote;
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<Record<string, StockQuote | null>> {
    const quotes: Record<string, StockQuote | null> = {};
    
    // Fetch quotes with delay to respect rate limits (5 calls per minute)
    for (const symbol of symbols) {
      quotes[symbol] = await this.getQuote(symbol);
      
      // Add delay between requests to respect rate limits
      if (symbols.indexOf(symbol) < symbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12 seconds between calls
      }
    }

    return quotes;
  }
}

export const marketDataService = new MarketDataService();