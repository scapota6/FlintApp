import { useQuery } from '@tanstack/react-query';

interface MarketQuote {
  symbol: string;
  price: number;
  change?: number;
  changePct?: number;
  volume?: number;
  marketCap?: number;
  source: string;
}

export function useMarketData(symbol: string) {
  return useQuery<MarketQuote>({
    queryKey: ['/api/market-data', symbol],
    queryFn: async () => {
      const response = await fetch(`/api/market-data?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }
      return response.json();
    },
    staleTime: 5000, // Consider data fresh for 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
    retry: 3,
    retryDelay: 1000,
  });
}

export function useBulkMarketData(symbols: string[]) {
  return useQuery<Record<string, MarketQuote>>({
    queryKey: ['/api/market-data/bulk', symbols.sort().join(',')],
    queryFn: async () => {
      const response = await fetch('/api/market-data/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch bulk market data');
      }
      return response.json();
    },
    staleTime: 5000,
    refetchInterval: 10000,
    retry: 3,
    retryDelay: 1000,
    enabled: symbols.length > 0,
  });
}