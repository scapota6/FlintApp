import React, { useState, useEffect } from "react";
import { Search, Plus, TrendingUp, TrendingDown, Eye } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { SnapTradeAPI, SnapTradeQuote } from "@/lib/snaptrade-api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface SearchBarProps {
  onAddToWatchlist?: (symbol: string, name: string) => void;
  onTrade?: (symbol: string, name: string) => void;
  className?: string;
}

export default function SearchBar({ onAddToWatchlist, onTrade, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SnapTradeQuote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const searchSymbols = async () => {
      if (query.length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await SnapTradeAPI.searchSymbols(query);
        setResults(searchResults);
        setShowResults(true);
      } catch (error) {
        console.error("Search error:", error);
        toast({
          title: "Search Error",
          description: "Unable to search symbols. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchSymbols, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, toast]);

  const handleAddToWatchlist = (symbol: string, name: string) => {
    if (onAddToWatchlist) {
      onAddToWatchlist(symbol, name);
    }
    setShowResults(false);
    setQuery("");
  };

  const handleTrade = (symbol: string, name: string) => {
    if (onTrade) {
      onTrade(symbol, name);
    }
    setShowResults(false);
    setQuery("");
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search stocks, ETFs, crypto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 bg-gray-800 border-gray-600 shadow-lg">
          <CardContent className="p-2">
            <div className="max-h-96 overflow-y-auto">
              {results.map((result) => (
                <Link key={result.symbol} href={`/stock/${result.symbol}`}>
                  <div className="p-3 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white">{result.symbol}</span>
                        <span className="text-gray-400 text-sm truncate">{result.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-lg font-bold text-white">
                          ${result.price.toFixed(2)}
                        </span>
                        <div className={`flex items-center space-x-1 ${
                          result.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {result.changePercent >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="text-sm">
                            {result.changePercent >= 0 ? '+' : ''}
                            {result.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {onAddToWatchlist && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddToWatchlist(result.symbol, result.name);
                          }}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Watch
                        </Button>
                      )}
                      {onTrade && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTrade(result.symbol, result.name);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Trade
                        </Button>
                      )}
                    </div>
                  </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && results.length === 0 && !isSearching && query.length >= 2 && (
        <Card className="absolute z-50 w-full mt-1 bg-gray-800 border-gray-600 shadow-lg">
          <CardContent className="p-4 text-center">
            <p className="text-gray-400">No results found for "{query}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}