import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useWatchlist() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user's watchlist
  const { data: watchlist = [], isLoading, error } = useQuery({
    queryKey: ["/api/watchlist"],
    retry: 2,
  });

  // Add to watchlist mutation
  const addToWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("/api/watchlist/add", {
        method: "POST",
        body: { symbol: symbol.toUpperCase() },
      });
    },
    onSuccess: (data, symbol) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Added to Watchlist",
        description: `${symbol.toUpperCase()} has been added to your watchlist.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add",
        description: error.message || "Unable to add symbol to watchlist.",
        variant: "destructive",
      });
    },
  });

  // Remove from watchlist mutation
  const removeFromWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("/api/watchlist/remove", {
        method: "DELETE",
        body: { symbol: symbol.toUpperCase() },
      });
    },
    onSuccess: (data, symbol) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Removed from Watchlist",
        description: `${symbol.toUpperCase()} has been removed from your watchlist.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Remove",
        description: error.message || "Unable to remove symbol from watchlist.",
        variant: "destructive",
      });
    },
  });

  // Check if symbol is in watchlist
  const checkWatchlist = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("/api/watchlist/check", {
        method: "POST",
        body: { symbol: symbol.toUpperCase() },
      });
    },
  });

  // Toggle watchlist status
  const toggleWatchlist = async (symbol: string) => {
    try {
      const checkResult = await checkWatchlist.mutateAsync(symbol);
      
      if (checkResult.inWatchlist) {
        await removeFromWatchlist.mutateAsync(symbol);
      } else {
        await addToWatchlist.mutateAsync(symbol);
      }
    } catch (error) {
      console.error("Failed to toggle watchlist:", error);
    }
  };

  return {
    watchlist: Array.isArray(watchlist?.watchlist) ? watchlist.watchlist : [],
    isLoading,
    error,
    addToWatchlist: addToWatchlist.mutate,
    removeFromWatchlist: removeFromWatchlist.mutate,
    toggleWatchlist,
    isAdding: addToWatchlist.isPending,
    isRemoving: removeFromWatchlist.isPending,
    isChecking: checkWatchlist.isPending,
  };
}