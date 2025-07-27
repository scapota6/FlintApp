import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface SearchResult {
  symbol: string;
  name: string;
}

interface SearchBarProps {
  className?: string;
}

export default function SearchBar({ className = '' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['/api/snaptrade/search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const response = await apiRequest('GET', `/api/snaptrade/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: query.length > 0,
    staleTime: 30000,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search stocks, ETFs..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-4 py-2 bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 rounded-xl w-full"
        />
      </div>

      {isOpen && query && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 flint-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 text-center text-gray-400">Searching...</div>
            ) : results.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                {results.slice(0, 8).map((result: SearchResult) => (
                  <Link key={result.symbol} href={`/stock/${result.symbol}`}>
                    <div 
                      className="flex items-center gap-3 p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0 transition-colors"
                      onClick={() => {
                        setIsOpen(false);
                        setQuery('');
                      }}
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-white">{result.symbol}</div>
                        <div className="text-sm text-gray-400">{result.name}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400">No results found</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}