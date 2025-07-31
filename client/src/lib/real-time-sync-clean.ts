/**
 * Real-Time Market Data Sync Service
 * Only uses authentic market data from APIs - no mock or fallback data
 */

export interface RealTimeQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  timestamp: number;
}

class RealTimeSyncService {
  private subscribers: Map<string, ((data: RealTimeQuote) => void)[]> = new Map();
  private currentData: Map<string, RealTimeQuote> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private updateFrequency = 1000; // 1 second for real-time feel

  /**
   * Subscribe to real-time updates for a symbol
   */
  subscribe(symbol: string, callback: (data: RealTimeQuote) => void): () => void {
    const cleanSymbol = this.cleanSymbol(symbol);
    
    if (!this.subscribers.has(cleanSymbol)) {
      this.subscribers.set(cleanSymbol, []);
      this.startRealTimeUpdates(cleanSymbol);
    }
    
    this.subscribers.get(cleanSymbol)!.push(callback);
    
    // Send current data immediately if available
    const current = this.currentData.get(cleanSymbol);
    if (current) {
      callback(current);
    }
    
    return () => {
      const subs = this.subscribers.get(cleanSymbol);
      if (subs) {
        const index = subs.indexOf(callback);
        if (index > -1) {
          subs.splice(index, 1);
        }
        
        // Stop updates if no more subscribers
        if (subs.length === 0) {
          this.stopRealTimeUpdates(cleanSymbol);
        }
      }
    };
  }

  /**
   * Start real-time updates for a symbol using actual market data APIs
   */
  private startRealTimeUpdates(symbol: string) {
    // Clear existing interval
    this.stopRealTimeUpdates(symbol);
    
    const fetchRealData = async () => {
      try {
        // Fetch real market data from our unified API
        const response = await fetch(`/api/quotes/${symbol}`);
        if (response.ok) {
          const data = await response.json();
          
          const quote: RealTimeQuote = {
            symbol: data.symbol,
            price: data.price,
            change: data.change || 0,
            changePercent: data.changePct || 0,
            volume: data.volume || 0,
            open: data.open || data.price,
            high: data.high || data.price,
            low: data.low || data.price,
            timestamp: Date.now()
          };
          
          this.currentData.set(symbol, quote);
          
          // Notify all subscribers
          const subscribers = this.subscribers.get(symbol);
          if (subscribers) {
            subscribers.forEach(callback => callback(quote));
          }
        } else {
          console.warn(`Failed to fetch real-time data for ${symbol}: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error fetching real-time data for ${symbol}:`, error);
      }
    };
    
    // Fetch immediately
    fetchRealData();
    
    // Set up interval for continuous updates
    const interval = setInterval(fetchRealData, this.updateFrequency);
    this.intervals.set(symbol, interval);
  }

  /**
   * Stop real-time updates for a symbol
   */
  private stopRealTimeUpdates(symbol: string) {
    const interval = this.intervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(symbol);
    }
  }

  /**
   * Clean symbol format for consistency
   */
  private cleanSymbol(symbol: string): string {
    return symbol.replace(/^(NASDAQ|NYSE|BINANCE):/, '').toUpperCase();
  }

  /**
   * Get current data for a symbol
   */
  getCurrentData(symbol: string): RealTimeQuote | null {
    return this.currentData.get(this.cleanSymbol(symbol)) || null;
  }

  /**
   * Cleanup all subscriptions
   */
  destroy() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscribers.clear();
    this.currentData.clear();
  }
}

export const realTimeSyncService = new RealTimeSyncService();