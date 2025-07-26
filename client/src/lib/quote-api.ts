import { apiRequest } from "@/lib/queryClient";
import React from "react";

export interface RealTimeQuote {
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
  lastUpdate: string;
}

export class QuoteAPI {
  static async getQuote(symbol: string): Promise<RealTimeQuote> {
    const response = await apiRequest("GET", `/api/quotes/${symbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch quote for ${symbol}`);
    }
    return response.json();
  }
}

// Real-time quote hook for React components
export function useRealTimeQuote(symbol: string, intervalMs: number = 10000) {
  const [quote, setQuote] = React.useState<RealTimeQuote | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!symbol) return;

    const fetchQuote = async () => {
      try {
        setError(null);
        const data = await QuoteAPI.getQuote(symbol);
        setQuote(data);
      } catch (err: any) {
        setError(err.message);
        console.error(`Failed to fetch quote for ${symbol}:`, err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchQuote();

    // Set up interval for real-time updates
    const interval = setInterval(fetchQuote, intervalMs);

    return () => clearInterval(interval);
  }, [symbol, intervalMs]);

  return { quote, loading, error };
}