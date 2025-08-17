import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { getUserEmailOptional } from '@/lib/userEmail';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { useState } from 'react';

interface Holding {
  accountId: string;
  accountName: string;
  brokerageName: string;
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
  currency: string;
  type: string;
}

interface RealTimeHoldingsProps {
  maxItems?: number;
  showAccountProvider?: boolean;
  onHoldingClick?: (symbol: string, name: string) => void;
}

export default function RealTimeHoldings({ 
  maxItems = 20, 
  showAccountProvider = true,
  onHoldingClick 
}: RealTimeHoldingsProps) {
  const [sortBy, setSortBy] = useState<'value' | 'gainloss' | 'symbol'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch user's holdings with real-time data
  const { data: holdingsData = [], isLoading, error } = useQuery<Holding[]>({
    queryKey: ['/api/holdings'],
    queryFn: async () => {
      // Get authenticated user data first for user ID
      const userResp = await apiRequest("/api/auth/user");
      if (!userResp.ok) throw new Error("Authentication required");
      const userData = await userResp.json();
      
      const resp = await fetch("/api/holdings", {
        headers: { "x-user-id": userData.id },
        credentials: "include",
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(t || "Failed to load holdings");
      }
      const data = await resp.json();
      // Handle both direct array and object with holdings property
      return Array.isArray(data) ? data : (data.holdings || []);
    },
    refetchInterval: 15000, // Update every 15 seconds for real-time pricing
  });

  const holdings = Array.isArray(holdingsData) ? holdingsData : [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getHoldingIcon = (symbol: string, type: string) => {
    // Icon mapping based on symbol and type
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
      'SPY': '📊',
      'QQQ': '📈'
    };
    
    if (iconMap[symbol]) return iconMap[symbol];
    if (type === 'crypto') return '🪙';
    if (type === 'etf') return '📊';
    return '📈';
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'value':
        aValue = a.currentValue;
        bValue = b.currentValue;
        break;
      case 'gainloss':
        aValue = a.profitLossPercent;
        bValue = b.profitLossPercent;
        break;
      case 'symbol':
        aValue = a.symbol;
        bValue = b.symbol;
        break;
      default:
        aValue = a.currentValue;
        bValue = b.currentValue;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    
    return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
  });

  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalGainLoss = holdings.reduce((sum, holding) => sum + holding.profitLoss, 0);
  const totalGainLossPct = totalValue > 0 ? (totalGainLoss / (totalValue - totalGainLoss)) * 100 : 0;

  if (isLoading) {
    return (
      <Card className="flint-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Portfolio Holdings</span>
            <Badge variant="secondary">Real-Time</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-gray-700 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-gray-700 rounded w-20 mb-1"></div>
                    <div className="h-3 bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flint-card">
        <CardHeader>
          <CardTitle>Portfolio Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Failed to load holdings</p>
            <p className="text-sm">Check your brokerage connections</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flint-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Portfolio Holdings</span>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-600/20 text-green-400">
              Live Prices
            </Badge>
            <Badge variant="outline" className="text-gray-400">
              {holdings.length} positions
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Portfolio Summary */}
        {holdings.length > 0 && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-lg">
            <div>
              <div className="text-sm text-gray-400">Total Value</div>
              <div className="text-xl font-bold text-white">
                {formatCurrency(totalValue)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Total Gain/Loss</div>
              <div className={`text-xl font-bold flex items-center ${
                totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {totalGainLoss >= 0 ? 
                  <TrendingUp className="h-5 w-5 mr-1" /> : 
                  <TrendingDown className="h-5 w-5 mr-1" />
                }
                {formatCurrency(totalGainLoss)} ({formatPercent(totalGainLossPct)})
              </div>
            </div>
          </div>
        )}

        {/* Sort Controls */}
        {holdings.length > 0 && (
          <div className="flex space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
            >
              <option value="value">Sort by Value</option>
              <option value="gainloss">Sort by Gain/Loss</option>
              <option value="symbol">Sort by Symbol</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm hover:bg-gray-700"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        )}

        {/* Holdings List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedHoldings.slice(0, maxItems).map((holding) => (
            <div 
              key={`${holding.accountId}-${holding.symbol}`} 
              className="group flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              onClick={() => onHoldingClick?.(holding.symbol, holding.name)}
            >
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {getHoldingIcon(holding.symbol, holding.type)}
                </div>
                <div>
                  <div className="font-semibold text-white flex items-center space-x-2">
                    <span>{holding.symbol}</span>
                    {showAccountProvider && holding.brokerageName && (
                      <Badge variant="secondary" className="text-xs">
                        {holding.brokerageName}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {holding.quantity.toFixed(4)} shares @ {formatCurrency(holding.averageCost)}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold text-white">
                  {formatCurrency(holding.currentValue)}
                </div>
                <div className="text-sm text-gray-400">
                  {formatCurrency(holding.currentPrice)} current
                </div>
                <div className={`text-sm flex items-center justify-end ${
                  holding.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {holding.profitLoss >= 0 ? 
                    <TrendingUp className="h-3 w-3 mr-1" /> : 
                    <TrendingDown className="h-3 w-3 mr-1" />
                  }
                  {formatCurrency(holding.profitLoss)} ({formatPercent(holding.profitLossPercent)})
                </div>
              </div>
            </div>
          ))}
          
          {holdings.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No holdings found</p>
              <p className="text-sm">Connect your brokerage accounts to view your portfolio</p>
            </div>
          )}
        </div>

        {/* Data source info */}
        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
          Live prices from Polygon.io & CoinGecko • Updates every 15s
        </div>
      </CardContent>
    </Card>
  );
}