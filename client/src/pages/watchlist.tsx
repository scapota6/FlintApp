import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/auth/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Star, Plus, TrendingUp, TrendingDown, Trash2, Eye, Search } from "lucide-react";

export default function Watchlist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newAssetType, setNewAssetType] = useState("");

  // Fetch watchlist
  const { data: watchlist, isLoading, error } = useQuery({
    queryKey: ["/api/watchlist"],
    queryFn: FinancialAPI.getWatchlist,
    refetchInterval: 30000,
  });

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async (data: { symbol: string; name: string; assetType: string }) => {
      return FinancialAPI.addToWatchlist(data.symbol, data.name, data.assetType);
    },
    onSuccess: () => {
      toast({
        title: "Added to Watchlist",
        description: `${newSymbol} has been added to your watchlist`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setIsAddModalOpen(false);
      setNewSymbol("");
      setNewAssetType("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add to watchlist. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove from watchlist mutation
  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return FinancialAPI.removeFromWatchlist(symbol);
    },
    onSuccess: (_, symbol) => {
      toast({
        title: "Removed from Watchlist",
        description: `${symbol} has been removed from your watchlist`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to remove from watchlist. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle unauthorized errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
    }
  }, [error, toast]);

  const handleAddToWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSymbol || !newAssetType) {
      toast({
        title: "Missing Information",
        description: "Please enter both symbol and asset type",
        variant: "destructive",
      });
      return;
    }

    const name = getCompanyName(newSymbol);
    addToWatchlistMutation.mutate({
      symbol: newSymbol.toUpperCase(),
      name,
      assetType: newAssetType,
    });
  };

  const handleRemoveFromWatchlist = (symbol: string) => {
    removeFromWatchlistMutation.mutate(symbol);
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatPercent = (percent: number | string) => {
    const num = typeof percent === 'string' ? parseFloat(percent) : percent;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getColorFromSymbol = (symbol: string) => {
    const colors = {
      'AAPL': 'bg-blue-500',
      'TSLA': 'bg-green-500',
      'BTC': 'bg-orange-500',
      'ETH': 'bg-purple-500',
      'GOOGL': 'bg-red-500',
      'MSFT': 'bg-blue-600',
      'AMZN': 'bg-yellow-600',
      'NFLX': 'bg-red-600',
    };
    return colors[symbol as keyof typeof colors] || 'bg-gray-500';
  };

  const getCompanyName = (symbol: string) => {
    const companies: { [key: string]: string } = {
      'AAPL': 'Apple Inc.',
      'GOOGL': 'Alphabet Inc.',
      'MSFT': 'Microsoft Corporation',
      'AMZN': 'Amazon.com Inc.',
      'TSLA': 'Tesla Inc.',
      'META': 'Meta Platforms Inc.',
      'NFLX': 'Netflix Inc.',
      'NVDA': 'NVIDIA Corporation',
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'ADA': 'Cardano',
      'DOT': 'Polkadot',
    };
    return companies[symbol.toUpperCase()] || `${symbol.toUpperCase()} Corp.`;
  };

  const filteredWatchlist = (Array.isArray(watchlist) ? watchlist : []).filter((item: any) =>
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <PageTransition className="min-h-screen bg-[#121212] text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-800 rounded-xl"></div>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-[#121212] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 font-mono">
            <span className="sparkle-title">Watchlist</span>
          </h1>
          <p className="text-gray-400">Track your favorite assets and market trends</p>
        </div>

        {/* Search and Add */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search your watchlist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Add Symbol
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle>Add to Watchlist</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddToWatchlist} className="space-y-4">
                <div>
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="e.g., AAPL, BTC"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="assetType">Asset Type</Label>
                  <Select value={newAssetType} onValueChange={setNewAssetType} required>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      <SelectItem value="etf">ETF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={addToWatchlistMutation.isPending}
                >
                  {addToWatchlistMutation.isPending ? 'Adding...' : 'Add to Watchlist'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Watchlist Items */}
        <Card className="trade-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">
              Your Watchlist ({filteredWatchlist.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredWatchlist.length > 0 ? (
              <div className="space-y-3">
                {filteredWatchlist.map((item: any) => (
                  <div
                    key={item.symbol}
                    className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${getColorFromSymbol(item.symbol)} rounded-full flex items-center justify-center`}>
                        <span className="text-white font-bold">
                          {item.symbol === 'BTC' ? '₿' : item.symbol === 'ETH' ? 'E' : item.symbol[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{item.symbol}</p>
                        <p className="text-gray-400 text-sm">{item.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-white font-medium">{formatCurrency(item.currentPrice)}</p>
                        <p className={`text-sm flex items-center ${
                          parseFloat(item.changePercent) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {parseFloat(item.changePercent) >= 0 ? 
                            <TrendingUp className="h-3 w-3 mr-1" /> : 
                            <TrendingDown className="h-3 w-3 mr-1" />
                          }
                          {formatPercent(item.changePercent)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveFromWatchlist(item.symbol)}
                          disabled={removeFromWatchlistMutation.isPending}
                          className="border-red-600 text-red-400 hover:bg-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">
                  {searchTerm ? 'No matching symbols found' : 'Your watchlist is empty'}
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  {searchTerm ? 'Try a different search term' : 'Add your first symbol to start tracking'}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Symbol
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Popular Symbols */}
        <Card className="trade-card shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Popular Symbols</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'BTC', 'ETH'].map((symbol) => (
                <Button
                  key={symbol}
                  variant="outline"
                  className="border-gray-600 text-white hover:bg-gray-800 flex items-center justify-center space-x-2"
                  onClick={() => {
                    setNewSymbol(symbol);
                    setNewAssetType(symbol.length <= 4 ? 'stock' : 'crypto');
                    setIsAddModalOpen(true);
                  }}
                >
                  <div className={`w-6 h-6 ${getColorFromSymbol(symbol)} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">
                      {symbol === 'BTC' ? '₿' : symbol === 'ETH' ? 'E' : symbol[0]}
                    </span>
                  </div>
                  <span>{symbol}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </PageTransition>
  );
}
