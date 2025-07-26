import { apiRequest } from "@/lib/queryClient";

export interface LiveQuote {
  symbol: string;
  price: number;
  timestamp: string;
}

export class LiveQuoteAPI {
  static async getQuote(symbol: string): Promise<LiveQuote> {
    const response = await apiRequest("GET", `/api/snaptrade/quote?symbol=${symbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch live quote for ${symbol}`);
    }
    return response.json();
  }
}

// React hook for live quote updates
export function useLiveQuote(symbol: string, intervalMs: number = 10000) {
  const [quote, setQuote] = React.useState<LiveQuote | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!symbol) return;

    const fetchQuote = async () => {
      try {
        setError(null);
        const data = await LiveQuoteAPI.getQuote(symbol);
        setQuote(data);
      } catch (err: any) {
        setError(err.message);
        console.error(`Failed to fetch live quote for ${symbol}:`, err);
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

// Import React for the hook
import React from 'react';