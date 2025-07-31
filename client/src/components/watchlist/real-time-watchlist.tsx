import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { TrendingUp, TrendingDown, Plus, X, Eye } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  price: number;
  change: number;
  changePct: number;
  marketCap?: number;
  volume?: number;
  logo?: string;
  chartData?: number[];
}

interface RealTimeWatchlistProps {
  maxItems?: number;
  showAddButton?: boolean;
  onStockClick?: (symbol: string, name: string) => void;
}

export default function RealTimeWatchlist({ 
  maxItems = 10, 
  showAddButton = true,
  onStockClick 
}: RealTimeWatchlistProps) {
  const [newSymbol, setNewSymbol] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  // Fetch user's watchlist
  const { data: watchlistData = [], isLoading, refetch } = useQuery<WatchlistItem[]>({
    queryKey: ['/api/watchlist'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/watchlist');
      if (!response.ok) throw new Error('Failed to fetch watchlist');
      const data = await response.json();
      // Handle both direct array and object with watchlist property
      return Array.isArray(data) ? data : (data.watchlist || []);
    },
    refetchInterval: 10000, // Update every 10 seconds for real-time data
  });

  const watchlistItems = Array.isArray(watchlistData) ? watchlistData : [];

  // Add to watchlist
  const addToWatchlist = async (symbol: string) => {
    try {
      setIsAdding(true);
      
      // Determine if it's crypto based on symbol format
      const isCrypto = symbol.includes('-USD') || symbol.includes('BTC') || symbol.includes('ETH');
      const type = isCrypto ? 'crypto' : 'stock';
      
      const response = await apiRequest('POST', '/api/watchlist', {
        symbol: symbol.toUpperCase(),
        name: symbol.toUpperCase(),
        type
      });
      
      if (!response.ok) throw new Error('Failed to add to watchlist');
      
      await refetch();
      setNewSymbol('');
      
      toast({
        title: "Added to Watchlist",
        description: `${symbol.toUpperCase()} has been added to your watchlist.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add to watchlist",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Remove from watchlist
  const removeFromWatchlist = async (id: string, symbol: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/watchlist/${id}`);
      if (!response.ok) throw new Error('Failed to remove from watchlist');
      
      await refetch();
      
      toast({
        title: "Removed from Watchlist",
        description: `${symbol} has been removed from your watchlist.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove from watchlist",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number, changePct: number) => {
    const safeChange = change || 0;
    const safeChangePct = changePct || 0;
    const sign = safeChange >= 0 ? '+' : '';
    return `${sign}${safeChange.toFixed(2)} (${sign}${safeChangePct.toFixed(2)}%)`;
  };

  const getStockIcon = (symbol: string) => {
    // Simple icon mapping based on symbol
    const iconMap: { [key: string]: string } = {
      'AAPL': '🍎',
      'GOOGL': '🔍',
      'TSLA': '🚗',
      'MSFT': '🖥️',
      'AMZN': '📦',
      'META': '📘',
      'NVDA': '🎮',
      'BTC-USD': '₿',
      'ETH-USD': 'Ξ',
    };
    return iconMap[symbol] || '📈';
  };

  if (isLoading) {
    return (
      <Card className="flint-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Watchlist</span>
            <Badge variant="secondary">Real-Time</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-gray-700 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-700 rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flint-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Watchlist</span>
          <Badge variant="secondary" className="bg-green-600/20 text-green-400">
            Live Data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new symbol */}
        {showAddButton && (
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Add symbol (AAPL, BTC-USD...)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSymbol.trim()) {
                  addToWatchlist(newSymbol.trim());
                }
              }}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
            />
            <Button
              onClick={() => newSymbol.trim() && addToWatchlist(newSymbol.trim())}
              disabled={!newSymbol.trim() || isAdding}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Watchlist items */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {watchlistItems.slice(0, maxItems).map((item) => (
            <div 
              key={item.id} 
              className="group flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={() => onStockClick?.(item.symbol, item.name)}
            >
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {getStockIcon(item.symbol)}
                </div>
                <div>
                  <div className="font-semibold text-white">{item.symbol}</div>
                  <div className="text-sm text-gray-400">{item.name}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {formatPrice(item.price || 0)}
                  </div>
                  <div className={`text-sm flex items-center ${
                    (item.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(item.change || 0) >= 0 ? 
                      <TrendingUp className="h-3 w-3 mr-1" /> : 
                      <TrendingDown className="h-3 w-3 mr-1" />
                    }
                    {formatChange(item.change || 0, item.changePct || 0)}
                  </div>
                </div>
                
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStockClick?.(item.symbol, item.name);
                    }}
                    className="h-8 w-8 p-0 text-purple-400 hover:text-purple-300"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(item.id, item.symbol);
                    }}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          
          {watchlistItems.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Your watchlist is empty</p>
              <p className="text-sm">Add stocks or crypto to start tracking real-time prices</p>
            </div>
          )}
        </div>

        {/* Data source info */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
          Live data from Polygon.io & CoinGecko • Updates every 10s
        </div>
      </CardContent>
    </Card>
  );
}