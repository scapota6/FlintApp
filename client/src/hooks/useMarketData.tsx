import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface MarketData {
  symbol: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap: number;
  company_name?: string;
  logo_url?: string;
}

// Hook for single symbol market data with real-time updates
export function useMarketData(symbol: string, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ["/api/market-data", symbol],
    queryFn: async (): Promise<MarketData> => {
      const response = await fetch(`/api/market-data?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch market data for ${symbol}`);
      }
      return response.json();
    },
    enabled: enabled && !!symbol,
    staleTime: 4000, // Consider data stale after 4 seconds
    refetchInterval: 5000, // Refetch every 5 seconds
    retry: 2,
  });

  // Set up real-time polling
  useEffect(() => {
    if (!enabled || !symbol) return;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval for real-time updates
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/market-data", symbol] 
      });
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [symbol, enabled, queryClient]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook for multiple symbols market data
export function useBulkMarketData(symbols: string[], enabled: boolean = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ["/api/market-data/bulk", symbols.sort().join(",")],
    queryFn: async (): Promise<{[symbol: string]: MarketData | null}> => {
      const response = await fetch("/api/market-data/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbols }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch bulk market data");
      }
      
      return response.json();
    },
    enabled: enabled && symbols.length > 0,
    staleTime: 4000,
    refetchInterval: 5000,
    retry: 2,
  });

  // Set up real-time polling for bulk data
  useEffect(() => {
    if (!enabled || symbols.length === 0) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/market-data/bulk", symbols.sort().join(",")] 
      });
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [symbols, enabled, queryClient]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook for watchlist with enriched market data
export function useWatchlistMarketData() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const query = useQuery({
    queryKey: ["/api/market-data/watchlist"],
    queryFn: async () => {
      const response = await fetch("/api/market-data/watchlist");
      if (!response.ok) {
        throw new Error("Failed to fetch watchlist market data");
      }
      return response.json();
    },
    staleTime: 4000,
    refetchInterval: 5000,
    retry: 2,
  });

  // Real-time updates for watchlist
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/market-data/watchlist"] 
      });
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [queryClient]);

  return {
    watchlist: query.data?.watchlist || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export type { MarketData };