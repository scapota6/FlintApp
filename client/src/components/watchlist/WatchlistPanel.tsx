/**
 * Watchlist Panel Component
 * Displays user's watchlist with prices and quick actions
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  X, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Search,
  Bell,
  BellOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WatchlistItem {
  id: number;
  symbol: string;
  addedAt: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

export default function WatchlistPanel() {
  const [newSymbol, setNewSymbol] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  // Fetch watchlist
  const { data: watchlist, isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ['/api/watchlist'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Add to watchlist
  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return await apiRequest('/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      setNewSymbol('');
      setIsAdding(false);
      toast({
        title: 'Added to watchlist',
        description: `${newSymbol.toUpperCase()} has been added to your watchlist`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add to watchlist',
        variant: 'destructive'
      });
    }
  });

  // Remove from watchlist
  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return await apiRequest(`/api/watchlist/${symbol}`, {
        method: 'DELETE'
      });
    },
    onSuccess: (_, symbol) => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      toast({
        title: 'Removed from watchlist',
        description: `${symbol} has been removed from your watchlist`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove from watchlist',
        variant: 'destructive'
      });
    }
  });

  const handleAdd = () => {
    if (newSymbol.trim()) {
      addMutation.mutate(newSymbol.trim().toUpperCase());
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (change?: number, changePercent?: number) => {
    if (change === undefined || changePercent === undefined) return null;
    
    const isPositive = change >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? 'text-green-500' : 'text-red-500';
    
    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm">
          {isPositive ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
        </span>
      </div>
    );
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold text-white">
          Watchlist
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          className="bg-purple-600/10 border-purple-500 hover:bg-purple-600/20"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Symbol
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Add symbol input */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2"
            >
              <Input
                placeholder="Enter symbol (e.g., AAPL)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Button
                onClick={handleAdd}
                disabled={!newSymbol.trim() || addMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Add
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewSymbol('');
                }}
              >
                Cancel
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Watchlist items */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">
            Loading watchlist...
          </div>
        ) : watchlist && watchlist.length > 0 ? (
          <div className="space-y-2">
            {watchlist.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {item.symbol}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Stock
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-gray-300">
                      {formatPrice(item.currentPrice)}
                    </span>
                    {formatChange(item.change, item.changePercent)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-purple-400"
                    title="Set price alert"
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMutation.mutate(item.symbol)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Your watchlist is empty</p>
            <p className="text-sm mt-1">Add symbols to track their prices</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}