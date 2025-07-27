import { useQuery, useQueries } from "@tanstack/react-query";

interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  source: string;
}

// Hook for single symbol
export function usePolygonQuote(symbol: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [`/api/polygon/quote/${symbol}`],
    enabled: enabled && !!symbol,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });
}

// Hook for multiple symbols
export function usePolygonQuotes(symbols: string[]) {
  return useQueries({
    queries: symbols.map(symbol => ({
      queryKey: [`/api/polygon/quote/${symbol}`],
      staleTime: 30000,
      refetchInterval: 60000,
    }))
  });
}

// Hook for testing API connectivity
export function usePolygonConnection() {
  return useQuery({
    queryKey: ['/api/polygon/test'],
    staleTime: 300000, // 5 minutes
    retry: 3,
  });
}

// Custom hook for dashboard data
export function useDashboardMarketData() {
  const symbols = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'AMZN', 'NVDA', 'META', 'NFLX'];
  
  return useQueries({
    queries: symbols.map(symbol => ({
      queryKey: [`/api/polygon/quote/${symbol}`],
      staleTime: 30000,
      refetchInterval: 60000,
    }))
  });
}