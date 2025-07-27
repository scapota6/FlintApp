import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SnapTradeService } from "@/services/snaptrade-service";
import { useToast } from "@/hooks/use-toast";

// Hook for fetching SnapTrade accounts
export function useSnapTradeAccounts() {
  return useQuery({
    queryKey: ['/api/snaptrade/accounts'],
    queryFn: () => SnapTradeService.getAccounts(),
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: false
  });
}

// Hook for fetching account positions
export function useAccountPositions(accountId: string | null) {
  return useQuery({
    queryKey: ['/api/snaptrade/accounts', accountId, 'positions'],
    queryFn: () => accountId ? SnapTradeService.getAccountPositions(accountId) : Promise.resolve([]),
    enabled: !!accountId,
    refetchInterval: 30000
  });
}

// Hook for fetching account orders
export function useAccountOrders(accountId: string | null) {
  return useQuery({
    queryKey: ['/api/snaptrade/accounts', accountId, 'orders'],
    queryFn: () => accountId ? SnapTradeService.getAccountOrders(accountId) : Promise.resolve([]),
    enabled: !!accountId,
    refetchInterval: 10000 // Orders update more frequently
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
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/snaptrade/accounts'] });
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
      
      queryClient.invalidateQueries({ queryKey: ['/api/snaptrade/accounts'] });
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
      
      queryClient.invalidateQueries({ queryKey: ['/api/snaptrade/accounts'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/snaptrade'] });
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
      
      queryClient.invalidateQueries({ queryKey: ['/api/snaptrade/accounts'] });
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