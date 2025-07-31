/**
 * Real-time TradingView Synchronization Service
 * Synchronizes Flint's displayed numbers with TradingView widget updates
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

  // Real-time sync only uses live API data - no fallback prices

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
   * Start real-time updates for a symbol
   */
  private startRealTimeUpdates(symbol: string) {
    // Clear existing interval
    this.stopRealTimeUpdates(symbol);
    
    const updateData = () => {
      // Real-time sync only uses actual API data - no base prices
      // This method should fetch from real market data APIs
      console.warn('Real-time sync requires actual market data API integration');
      return;
      
      // Update high/low based on current price
      const currentHigh = Math.max(baseData.high, currentPrice);
      const currentLow = Math.min(baseData.low, currentPrice);

      const quote: RealTimeQuote = {
        symbol,
        price: Number(currentPrice.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: currentVolume,
        open: baseData.open,
        high: Number(currentHigh.toFixed(2)),
        low: Number(currentLow.toFixed(2)),
        timestamp: now
      };

      // Update cache
      this.currentData.set(symbol, quote);

      // Notify subscribers
      const subscribers = this.subscribers.get(symbol);
      if (subscribers) {
        subscribers.forEach(callback => callback(quote));
      }
    };

    // Initial update
    updateData();
    
    // Set up interval for continuous updates
    const interval = setInterval(updateData, this.updateFrequency);
    this.intervals.set(symbol, interval);
  }

  /**
   * Generate realistic market movement patterns
   */
  private generateMarketMovement(symbol: string, timeDiff: number): { priceChange: number } {
    // Different volatility for different stocks
    const volatility = this.getVolatility(symbol);
    
    // Use sine wave + random walk for realistic movement
    const timeInMinutes = timeDiff / (1000 * 60);
    const sineComponent = Math.sin(timeInMinutes * 0.1) * volatility * 0.3;
    
    // Random walk component
    const randomWalk = (Math.random() - 0.5) * volatility * 0.1;
    
    // Trend component (slight bias)
    const trendComponent = Math.sin(timeInMinutes * 0.01) * volatility * 0.05;
    
    const priceChange = sineComponent + randomWalk + trendComponent;
    
    return { priceChange };
  }

  /**
   * Get volatility coefficient for different stocks
   */
  private getVolatility(symbol: string): number {
    const volatilities: { [key: string]: number } = {
      'AAPL': 0.5,
      'GOOGL': 0.7,
      'MSFT': 0.4,
      'TSLA': 2.0, // Higher volatility
      'META': 0.8,
      'AMZN': 0.6
    };
    
    return volatilities[symbol] || 0.5;
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
   * Get current data for a symbol
   */
  getCurrentData(symbol: string): RealTimeQuote | null {
    return this.currentData.get(this.cleanSymbol(symbol)) || null;
  }

  /**
   * Clean symbol format
   */
  private cleanSymbol(symbol: string): string {
    return symbol.replace(/^(NASDAQ:|NYSE:|BINANCE:)/, '').replace(/USDT$/, '').toUpperCase();
  }

  /**
   * Cleanup all intervals
   */
  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscribers.clear();
    this.currentData.clear();
  }
}

// Export singleton
export const realTimeSyncService = new RealTimeSyncService();

// React hook for easy integration
import { useState, useEffect } from 'react';

export function useRealTimeQuote(symbol: string) {
  const [quote, setQuote] = useState<RealTimeQuote | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setIsConnected(false);
    
    const unsubscribe = realTimeSyncService.subscribe(symbol, (data) => {
      setQuote(data);
      setIsConnected(true);
    });

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [symbol]);

  return { quote, isConnected };
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realTimeSyncService.cleanup();
  });
}