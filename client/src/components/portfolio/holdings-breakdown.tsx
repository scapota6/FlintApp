import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Building, DollarSign, BarChart3 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';

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

interface HoldingsSummary {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  positionCount: number;
  accountCount: number;
}

export default function HoldingsBreakdown() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/holdings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/holdings');
      if (!response.ok) throw new Error('Failed to fetch holdings');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const holdings: Holding[] = data?.holdings || [];
  const summary: HoldingsSummary = data?.summary || {
    totalValue: 0,
    totalCost: 0,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
    positionCount: 0,
    accountCount: 0,
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Holdings Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 bg-gray-800" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Holdings Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">Failed to load holdings. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Holdings Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">No holdings found. Connect a brokerage account to see your positions.</p>
        </CardContent>
      </Card>
    );
  }

  // Group holdings by account
  const holdingsByAccount = holdings.reduce((acc, holding) => {
    if (!acc[holding.accountId]) {
      acc[holding.accountId] = {
        accountName: holding.accountName,
        brokerageName: holding.brokerageName,
        holdings: [],
        totalValue: 0,
        totalProfitLoss: 0,
      };
    }
    acc[holding.accountId].holdings.push(holding);
    acc[holding.accountId].totalValue += holding.currentValue;
    acc[holding.accountId].totalProfitLoss += holding.profitLoss;
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <Card className="bg-gray-900 border-purple-600/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Portfolio Summary
            </span>
            <Badge variant="secondary" className="bg-purple-600/20 text-purple-400">
              {summary.positionCount} Positions • {summary.accountCount} Accounts
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-400">Total Value</p>
              <p className="text-2xl font-bold">${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Cost</p>
              <p className="text-xl">${summary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total P/L</p>
              <p className={`text-xl font-semibold flex items-center gap-1 ${summary.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {summary.totalProfitLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                ${Math.abs(summary.totalProfitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Return</p>
              <p className={`text-xl font-semibold ${summary.totalProfitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {summary.totalProfitLossPercent >= 0 ? '+' : ''}{summary.totalProfitLossPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holdings by Account */}
      {Object.entries(holdingsByAccount).map(([accountId, accountData]) => (
        <Card key={accountId} className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-400" />
                <div>
                  <h3 className="font-semibold">{accountData.accountName}</h3>
                  <p className="text-sm text-gray-400">{accountData.brokerageName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Account Value</p>
                <p className="font-semibold">${accountData.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accountData.holdings.map((holding: Holding) => (
                <div key={`${accountId}-${holding.symbol}`} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-lg">{holding.symbol}</h4>
                      <p className="text-sm text-gray-400">{holding.name}</p>
                    </div>
                    <Badge variant={holding.type === 'crypto' ? 'secondary' : 'default'} className="text-xs">
                      {holding.type}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400">Quantity</p>
                      <p className="font-medium">{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Avg Cost</p>
                      <p className="font-medium">${holding.averageCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Current Price</p>
                      <p className="font-medium">${holding.currentPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Market Value</p>
                      <p className="font-medium">${holding.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">P/L</p>
                      <div className={`font-medium ${holding.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        <p className="flex items-center gap-1">
                          {holding.profitLoss >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          ${Math.abs(holding.profitLoss).toFixed(2)}
                        </p>
                        <p className="text-xs">
                          ({holding.profitLossPercent >= 0 ? '+' : ''}{holding.profitLossPercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}