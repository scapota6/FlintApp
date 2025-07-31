import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  Banknote, 
  Building2, 
  Bitcoin,
  Wallet,
  Target
} from 'lucide-react';

interface PortfolioBreakdownProps {
  bankBalance: number;
  investmentBalance: number;
  cryptoBalance?: number;
  cashBalance?: number;
  isLoading?: boolean;
}

interface PortfolioSegment {
  name: string;
  value: number;
  percentage: number;
  color: string;
  icon: any;
  description: string;
}

const COLORS = {
  stocks: '#10B981', // green
  crypto: '#F59E0B', // orange
  bank: '#3B82F6',   // blue
  cash: '#8B5CF6'    // purple
};

export function PortfolioBreakdown({ 
  bankBalance, 
  investmentBalance, 
  cryptoBalance = 0, 
  cashBalance = 0,
  isLoading 
}: PortfolioBreakdownProps) {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const portfolioData = useMemo(() => {
    const totalBalance = bankBalance + investmentBalance + cryptoBalance + cashBalance;
    
    if (totalBalance === 0) {
      return {
        totalBalance: 0,
        segments: [],
        chartData: []
      };
    }

    const segments: PortfolioSegment[] = [
      {
        name: 'Stocks & ETFs',
        value: investmentBalance,
        percentage: (investmentBalance / totalBalance) * 100,
        color: COLORS.stocks,
        icon: TrendingUp,
        description: 'Investment accounts & securities'
      },
      {
        name: 'Bank Accounts',
        value: bankBalance,
        percentage: (bankBalance / totalBalance) * 100,
        color: COLORS.bank,
        icon: Building2,
        description: 'Checking & savings accounts'
      }
    ];

    // Add crypto if balance exists
    if (cryptoBalance > 0) {
      segments.push({
        name: 'Cryptocurrency',
        value: cryptoBalance,
        percentage: (cryptoBalance / totalBalance) * 100,
        color: COLORS.crypto,
        icon: Bitcoin,
        description: 'Digital assets & crypto wallets'
      });
    }

    // Add cash if balance exists
    if (cashBalance > 0) {
      segments.push({
        name: 'Cash & Money Market',
        value: cashBalance,
        percentage: (cashBalance / totalBalance) * 100,
        color: COLORS.cash,
        icon: Wallet,
        description: 'Cash positions & money market'
      });
    }

    // Filter out zero balances and sort by value
    const filteredSegments = segments
      .filter(segment => segment.value > 0)
      .sort((a, b) => b.value - a.value);

    const chartData = filteredSegments.map(segment => ({
      name: segment.name,
      value: segment.value,
      percentage: segment.percentage,
      color: segment.color
    }));

    return {
      totalBalance,
      segments: filteredSegments,
      chartData
    };
  }, [bankBalance, investmentBalance, cryptoBalance, cashBalance]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-green-400 font-semibold">{formatCurrency(data.value)}</p>
          <p className="text-gray-400 text-sm">{formatPercent(data.percentage)}</p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="trade-card shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Portfolio Breakdown</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/2 mb-4"></div>
            <div className="h-64 bg-gray-800 rounded-lg mb-4"></div>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="trade-card shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Portfolio Breakdown</span>
          </CardTitle>
          <Badge variant="outline" className="text-blue-400 border-blue-600">
            {portfolioData.segments.length} Asset Classes
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Total Balance */}
        <div className="mb-6 p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg border border-green-600/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(portfolioData.totalBalance)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Diversified across</p>
              <p className="text-lg font-semibold text-green-400">
                {portfolioData.segments.length} categories
              </p>
            </div>
          </div>
        </div>

        {portfolioData.totalBalance === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No portfolio data available</p>
            <p className="text-gray-500 text-sm mt-1">
              Connect your accounts to see portfolio breakdown
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="flex flex-col">
              <h3 className="text-white font-medium mb-4 text-center">Asset Allocation</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioData.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {portfolioData.chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                          stroke={entry.color}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="flex flex-col">
              <h3 className="text-white font-medium mb-4">Category Breakdown</h3>
              <div className="space-y-3 flex-1">
                {portfolioData.segments.map((segment, index) => {
                  const Icon = segment.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:bg-gray-800/70 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: segment.color }}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{segment.name}</p>
                          <p className="text-gray-400 text-xs">{segment.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold text-sm">
                          {formatCurrency(segment.value)}
                        </p>
                        <p 
                          className="text-xs font-medium"
                          style={{ color: segment.color }}
                        >
                          {formatPercent(segment.percentage)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Insights */}
        {portfolioData.segments.length > 0 && (
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-2 flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Portfolio Insights</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Largest Allocation</p>
                <p className="text-white font-medium">
                  {portfolioData.segments[0]?.name} ({formatPercent(portfolioData.segments[0]?.percentage || 0)})
                </p>
              </div>
              <div>
                <p className="text-gray-400">Asset Diversity</p>
                <p className="text-white font-medium">
                  {portfolioData.segments.length} categories
                </p>
              </div>
              <div>
                <p className="text-gray-400">Risk Level</p>
                <p className="text-white font-medium">
                  {portfolioData.segments.length >= 3 ? 'Well Diversified' : 'Moderate'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}