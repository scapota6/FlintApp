import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  Building2, 
  CheckCircle, 
  AlertTriangle,
  Zap,
  Eye
} from 'lucide-react';
import { Link } from 'wouter';
import { BrokerageCompatibilityEngine, EXTENDED_ASSETS, type Asset } from '@shared/brokerage-compatibility';

interface SmartSearchBarProps {
  onAssetSelect?: (asset: Asset) => void;
  connectedBrokerages?: string[];
  showCompatibilityFilter?: boolean;
  placeholder?: string;
  className?: string;
}

const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  onAssetSelect,
  connectedBrokerages = [],
  showCompatibilityFilter = true,
  placeholder = "Search stocks, crypto, ETFs...",
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyCompatible, setShowOnlyCompatible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Smart search with fuzzy matching and ranking
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    const term = searchTerm.toLowerCase().trim();
    
    // Filter assets based on compatibility mode
    const assetsToSearch = BrokerageCompatibilityEngine.filterAssetsByCompatibility(
      EXTENDED_ASSETS,
      connectedBrokerages,
      showOnlyCompatible
    );

    // Smart search with multiple criteria
    const results = assetsToSearch
      .map(asset => {
        const symbol = asset.symbol.toLowerCase();
        const name = asset.name.toLowerCase();
        let score = 0;

        // Exact symbol match (highest priority)
        if (symbol === term) score += 100;
        // Symbol starts with search term
        else if (symbol.startsWith(term)) score += 80;
        // Symbol contains search term
        else if (symbol.includes(term)) score += 60;
        
        // Exact name match
        if (name === term) score += 90;
        // Name starts with search term
        else if (name.startsWith(term)) score += 70;
        // Name contains search term
        else if (name.includes(term)) score += 50;
        
        // Word boundary matches in name (e.g., "apple" matches "Apple Inc.")
        const words = name.split(/\s+/);
        if (words.some(word => word.startsWith(term))) score += 65;
        
        // Popular stocks boost
        const popularSymbols = ['aapl', 'googl', 'msft', 'tsla', 'amzn', 'meta', 'nflx', 'nvda', 'btc', 'eth'];
        if (popularSymbols.includes(symbol)) score += 10;

        return { asset, score };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8) // Limit to top 8 results
      .map(result => result.asset);

    return results;
  }, [searchTerm, connectedBrokerages, showOnlyCompatible]);

  // Auto-expand when there are results
  useEffect(() => {
    setIsExpanded(searchResults.length > 0);
  }, [searchResults.length]);

  const handleAssetClick = (asset: Asset) => {
    onAssetSelect?.(asset);
    setSearchTerm('');
    setIsExpanded(false);
  };

  const getCompatibilityInfo = (asset: Asset) => {
    const result = BrokerageCompatibilityEngine.checkAssetCompatibility(asset, connectedBrokerages);
    return result;
  };

  const getAssetTypeColor = (type: string) => {
    switch (type) {
      case 'stock': return 'bg-blue-500';
      case 'crypto': return 'bg-orange-500';
      case 'etf': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'stock': return <TrendingUp className="h-3 w-3" />;
      case 'crypto': return <Zap className="h-3 w-3" />;
      case 'etf': return <Building2 className="h-3 w-3" />;
      default: return <Eye className="h-3 w-3" />;
    }
  };

  return (
    <div className={`smart-search-container relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
          onFocus={() => setIsExpanded(true)}
        />
        
        {/* Search Stats */}
        {searchTerm && (
          <div className="absolute right-3 top-3 text-xs text-gray-400">
            {searchResults.length} results
          </div>
        )}
      </div>

      {/* Compatibility Filter */}
      {showCompatibilityFilter && connectedBrokerages.length > 0 && (
        <div className="flex items-center gap-3 mt-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2">
            <Switch
              id="compatibility-filter"
              checked={showOnlyCompatible}
              onCheckedChange={setShowOnlyCompatible}
            />
            <Label htmlFor="compatibility-filter" className="text-sm text-gray-300">
              Show only tradeable assets
            </Label>
          </div>
          <Badge variant="secondary" className="bg-blue-900 text-blue-200">
            {connectedBrokerages.length} account{connectedBrokerages.length !== 1 ? 's' : ''} connected
          </Badge>
        </div>
      )}

      {/* Search Results Dropdown */}
      {isExpanded && searchResults.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 bg-gray-900 border-gray-700 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search Results
              {showOnlyCompatible && (
                <Badge variant="outline" className="border-green-600 text-green-400">
                  Trading Mode
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {searchResults.map((asset, index) => {
                const compatibility = getCompatibilityInfo(asset);
                
                return (
                  <Link
                    key={`${asset.symbol}-${index}`}
                    href={`/stock/${asset.symbol}`}
                    className="block"
                  >
                    <div
                      className="flex items-center justify-between p-3 hover:bg-gray-800 border-b border-gray-700 last:border-b-0 cursor-pointer transition-colors"
                      onClick={() => handleAssetClick(asset)}
                    >
                      {/* Asset Info */}
                      <div className="flex items-center gap-3 flex-1">
                        {/* Asset Type Badge */}
                        <div className={`p-1.5 rounded-md ${getAssetTypeColor(asset.type)}`}>
                          {getAssetTypeIcon(asset.type)}
                        </div>
                        
                        {/* Symbol and Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {asset.symbol}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getAssetTypeColor(asset.type)} text-white`}
                            >
                              {asset.type.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 truncate">
                            {asset.name}
                          </p>
                        </div>
                      </div>

                      {/* Compatibility Status */}
                      <div className="flex items-center gap-2">
                        {compatibility.isCompatible ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs">
                              {compatibility.compatibleBrokerages.length} account{compatibility.compatibleBrokerages.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-400">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs">Research only</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {/* Footer */}
            <div className="p-3 bg-gray-800 border-t border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {showOnlyCompatible ? 'Trading mode: Compatible assets only' : 'Research mode: All assets shown'}
                </span>
                <span>
                  Press Enter to view details
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {isExpanded && searchTerm && searchResults.length === 0 && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 bg-gray-900 border-gray-700">
          <CardContent className="p-6 text-center">
            <Search className="h-8 w-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 mb-2">No assets found for "{searchTerm}"</p>
            {showOnlyCompatible && (
              <p className="text-xs text-gray-500">
                Try disabling the compatibility filter to see all assets
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Click outside to close */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};

export default SmartSearchBar;