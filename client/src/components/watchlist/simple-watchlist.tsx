import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  price: number;
  change: number;
  changePct: number;
}

export default function SimpleWatchlist() {
  // Fetch user's watchlist with real-time pricing
  const { data: watchlistItems = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ['/api/watchlist'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/watchlist');
      if (!response.ok) throw new Error('Failed to fetch watchlist');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 10000, // Update every 10 seconds
  });

  const formatPrice = (price: number) => {
    const safePrice = price || 0;
    if (safePrice >= 1000) {
      return `$${safePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return `$${safePrice.toFixed(2)}`;
  };

  const formatChange = (change: number, changePct: number) => {
    const safeChange = change || 0;
    const safeChangePct = changePct || 0;
    const sign = safeChange >= 0 ? '+' : '';
    return `${sign}${safeChange.toFixed(2)} (${sign}${safeChangePct.toFixed(2)}%)`;
  };

  const getStockIcon = (symbol: string) => {
    const iconMap: { [key: string]: string } = {
      'AAPL': '🍎',
      'GOOGL': '🔍',
      'TSLA': '🚗',
      'MSFT': '🖥️',
      'BTC-USD': '₿',
      'ETH-USD': 'Ξ',
    };
    return iconMap[symbol] || '📈';
  };

  if (isLoading) {
    return (
      <Card className="flint-card">
        <CardHeader>
          <CardTitle>Real-Time Watchlist</CardTitle>
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
          <span>Real-Time Watchlist</span>
          <Badge variant="secondary" className="bg-green-600/20 text-green-400">
            Live Data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {watchlistItems.length > 0 ? (
            watchlistItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
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
                
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {formatPrice(item.price)}
                  </div>
                  <div className={`text-sm flex items-center justify-end ${
                    (item.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(item.change || 0) >= 0 ? 
                      <TrendingUp className="h-3 w-3 mr-1" /> : 
                      <TrendingDown className="h-3 w-3 mr-1" />
                    }
                    {formatChange(item.change, item.changePct)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Your watchlist is empty</p>
              <p className="text-sm">Add stocks or crypto to start tracking real-time prices</p>
            </div>
          )}
        </div>

        {/* Data source info */}
        <div className="text-xs text-gray-500 text-center pt-4 mt-4 border-t border-gray-800">
          Live data from Polygon.io & CoinGecko • Updates every 10s
        </div>
      </CardContent>
    </Card>
  );
}