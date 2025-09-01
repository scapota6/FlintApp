import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SnapTradeService } from "@/services/snaptrade-service";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Hook for fetching SnapTrade accounts
export function useSnapTradeAccounts() {
  return useQuery({
    queryKey: ['accounts.list'],
    queryFn: () => apiRequest('/api/snaptrade/accounts').then(r => r.json()),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours as specified
    retry: false
  });
}

// Hook for fetching account positions
export function useAccountPositions(accountId: string | null) {
  return useQuery({
    queryKey: ['accounts.positions', accountId],
    queryFn: () => accountId ? apiRequest(`/api/snaptrade/accounts/${accountId}/positions`).then(r => r.json()) : Promise.resolve([]),
    enabled: !!accountId,
    staleTime: 60 * 1000 // 60s for positions/balances as specified
  });
}

// Hook for fetching account orders
export function useAccountOrders(accountId: string | null, status: 'open' | 'all' = 'all') {
  return useQuery({
    queryKey: ['accounts.orders', accountId, status],
    queryFn: () => accountId ? apiRequest(`/api/snaptrade/accounts/${accountId}/orders?status=${status}`).then(r => r.json()) : Promise.resolve([]),
    enabled: !!accountId,
    staleTime: 10 * 1000 // 10s for orders after a trade as specified
  });
}

// Hook for account details
export function useAccountDetails(accountId: string | null) {
  return useQuery({
    queryKey: ['accounts.details', accountId],
    queryFn: () => accountId ? apiRequest(`/api/snaptrade/accounts/${accountId}/details`).then(r => r.json()) : Promise.resolve(null),
    enabled: !!accountId,
    staleTime: 60 * 1000 // 60s for account details
  });
}

// Hook for account balances
export function useAccountBalances(accountId: string | null) {
  return useQuery({
    queryKey: ['accounts.balances', accountId],
    queryFn: () => accountId ? apiRequest(`/api/snaptrade/accounts/${accountId}/balances`).then(r => r.json()) : Promise.resolve(null),
    enabled: !!accountId,
    staleTime: 60 * 1000 // 60s for positions/balances as specified
  });
}

// Hook for account activities
export function useAccountActivities(accountId: string | null, from?: string, to?: string) {
  return useQuery({
    queryKey: ['accounts.activities', accountId, from, to],
    queryFn: () => {
      if (!accountId) return Promise.resolve([]);
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const query = params.toString() ? `?${params.toString()}` : '';
      return apiRequest(`/api/snaptrade/accounts/${accountId}/activities${query}`).then(r => r.json());
    },
    enabled: !!accountId,
    staleTime: 60 * 1000 // 60s for activities
  });
}

// Hook for symbol search
export function useSymbolSearch(query: string) {
  return useQuery({
    queryKey: ['/api/snaptrade/symbols/search', query],
    queryFn: () => SnapTradeService.searchSymbols(query),
    enabled: query.length > 0,
    staleTime: 300000 // Cache for 5 minutes
  });
}

// Hook for placing equity orders
export function usePlaceEquityOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: SnapTradeService.placeEquityOrder,
    onSuccess: (data) => {
      toast({
        title: "Order Placed Successfully",
        description: `Trade ID: ${data.tradeId}`,
        variant: "default"
      });
      
      // Refresh positions & recent orders after successful trade
      queryClient.invalidateQueries({ queryKey: ['accounts.positions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts.orders'] });
      queryClient.invalidateQueries({ queryKey: ['accounts.list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

// Hook for placing crypto orders
export function usePlaceCryptoOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: SnapTradeService.placeCryptoOrder,
    onSuccess: (data) => {
      toast({
        title: "Crypto Order Placed",
        description: `Trade ID: ${data.tradeId}`,
        variant: "default"
      });
      
      // Refresh positions & recent orders after successful trade
      queryClient.invalidateQueries({ queryKey: ['accounts.positions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts.orders'] });
      queryClient.invalidateQueries({ queryKey: ['accounts.list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Crypto Order Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

// Hook for cancelling orders
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ orderId, accountId }: { orderId: string; accountId: string }) =>
      SnapTradeService.cancelOrder(orderId, accountId),
    onSuccess: () => {
      toast({
        title: "Order Cancelled",
        description: "Your order has been successfully cancelled.",
        variant: "default"
      });
      
      // Refresh orders after cancellation
      queryClient.invalidateQueries({ queryKey: ['accounts.orders'] });
      queryClient.invalidateQueries({ queryKey: ['accounts.positions'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

// Hook for connecting brokerage
export function useConnectBrokerage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: SnapTradeService.connectBrokerage,
    onSuccess: () => {
      toast({
        title: "Brokerage Connected",
        description: "Your brokerage account has been connected successfully.",
        variant: "default"
      });
      
      // Invalidate all SnapTrade related queries
      queryClient.invalidateQueries({ queryKey: ['accounts.list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

// Hook for syncing accounts
export function useSyncAccounts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: SnapTradeService.syncAccounts,
    onSuccess: (data) => {
      toast({
        title: "Accounts Synced",
        description: `Synced ${data.syncedCount} accounts successfully.`,
        variant: "default"
      });
      
      queryClient.invalidateQueries({ queryKey: ['accounts.list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

// Hook for fetching quotes
export function useSnapTradeQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ['/api/snaptrade/quotes', symbols],
    queryFn: () => SnapTradeService.getQuotes(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 30000
  });
}