import { useState, useRef, useEffect } from 'react';
import { Search, Plus, TrendingUp, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface SearchResult {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  exchange?: string;
  currency?: string;
}

export default function AssetSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'stock' | 'crypto'>('all');
  const searchRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for assets
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['/api/search', query, selectedType],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      
      const params = new URLSearchParams({ 
        q: query,
        type: selectedType 
      });
      
      const response = await apiRequest('GET', `/api/search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: query.length >= 2,
  });

  // Add to watchlist mutation
  const addToWatchlist = useMutation({
    mutationFn: async (asset: SearchResult) => {
      const response = await apiRequest('POST', '/api/watchlist', {
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        exchange: asset.exchange,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add to watchlist');
      }
      
      return response.json();
    },
    onSuccess: (data, asset) => {
      toast({
        title: "Added to Watchlist",
        description: `${asset.symbol} has been added to your watchlist`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      setQuery('');
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = (value: string) => {
    setQuery(value);
    setIsOpen(value.length >= 2);
  };

  const results = searchResults?.results || [];

  return (
    <div ref={searchRef} className="relative w-full max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search stocks or crypto..."
          className="pl-10 pr-4 bg-gray-800 border-gray-700 focus:border-purple-500"
          onFocus={() => query.length >= 2 && setIsOpen(true)}
        />
        
        {/* Type filter buttons */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
          <Button
            size="sm"
            variant={selectedType === 'all' ? 'default' : 'ghost'}
            className="h-6 px-2 text-xs"
            onClick={() => setSelectedType('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'stock' ? 'default' : 'ghost'}
            className="h-6 px-2 text-xs"
            onClick={() => setSelectedType('stock')}
          >
            Stocks
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'crypto' ? 'default' : 'ghost'}
            className="h-6 px-2 text-xs"
            onClick={() => setSelectedType('crypto')}
          >
            Crypto
          </Button>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {isLoading ? (
            <div className="p-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-500" />
              <p className="text-sm text-gray-400 mt-2">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result: SearchResult) => (
                <div
                  key={`${result.type}-${result.symbol}`}
                  className="px-4 py-3 hover:bg-gray-700 flex items-center justify-between group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{result.symbol}</span>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${
                            result.type === 'crypto' 
                              ? 'bg-orange-600/20 text-orange-400' 
                              : 'bg-blue-600/20 text-blue-400'
                          }`}
                        >
                          {result.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{result.name}</p>
                      {result.exchange && (
                        <p className="text-xs text-gray-500">{result.exchange}</p>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => addToWatchlist.mutate(result)}
                    disabled={addToWatchlist.isPending}
                  >
                    {addToWatchlist.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}