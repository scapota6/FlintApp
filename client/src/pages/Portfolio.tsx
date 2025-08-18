import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Wallet,
  CreditCard,
  RefreshCw,
  Info,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { queryClient } from "@/lib/queryClient";

// Type definitions
interface PortfolioSummary {
  totals: {
    netWorth: number;
    investable: number;
    cash: number;
    debt: number;
  };
  breakdown: Array<{
    bucket: string;
    value: number;
  }>;
  performance: {
    dayPct: number;
    dayValue: number;
    ytdPct: number;
    ytdValue: number;
  };
  metadata: {
    accountCount: number;
    lastUpdated: string;
    currency: string;
    dataDelayed: boolean;
  };
}

interface PortfolioHistory {
  period: string;
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  currency: string;
}

// Color palette for charts
const CHART_COLORS = {
  stocks: "#8b5cf6",  // Purple
  crypto: "#f59e0b",  // Amber
  cash: "#10b981",    // Emerald
  debt: "#ef4444"     // Red
};

// Format currency values
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Format percentage
const formatPercent = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// Custom tooltip for donut chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg">
        <p className="font-semibold">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(Math.abs(data.value))}
        </p>
        <p className="text-xs text-muted-foreground">
          {data.payload.percentage.toFixed(1)}% of portfolio
        </p>
      </div>
    );
  }
  return null;
};

export default function Portfolio() {
  const [selectedPeriod, setSelectedPeriod] = useState('1D');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch portfolio summary
  const { data: summary, isLoading, error } = useQuery<PortfolioSummary>({
    queryKey: ['/api/portfolio/summary'],
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch portfolio history for chart
  const { data: history } = useQuery<PortfolioHistory>({
    queryKey: ['/api/portfolio/history', selectedPeriod],
    enabled: !!summary
  });

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/history'] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Prepare donut chart data
  const chartData = summary?.breakdown?.map((item: any) => ({
    name: item.bucket,
    value: Math.abs(item.value),
    percentage: (Math.abs(item.value) / summary.totals.netWorth) * 100,
    fill: item.bucket === 'Stocks' ? CHART_COLORS.stocks :
          item.bucket === 'Crypto' ? CHART_COLORS.crypto :
          item.bucket === 'Cash' ? CHART_COLORS.cash :
          CHART_COLORS.debt
  })) || [];

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load portfolio data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPositive = (summary?.performance?.dayValue || 0) >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                Portfolio Overview
              </h1>
              <p className="text-slate-400 mt-2">
                Your complete financial picture across {summary?.metadata?.accountCount || 0} accounts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Data freshness indicator */}
        {summary?.metadata?.dataDelayed && (
          <Alert className="mb-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <Info className="h-4 w-4 text-purple-400" />
            <AlertDescription className="text-slate-300">
              Some market data may be delayed. Last updated: {new Date(summary.metadata.lastUpdated).toLocaleTimeString()}
            </AlertDescription>
          </Alert>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-400">
                Net Worth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(summary?.totals?.netWorth || 0)}
              </div>
              <div className={`flex items-center mt-2 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
                <span>{formatPercent(summary?.performance?.dayPct || 0)} today</span>
              </div>
            </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Investable Assets
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(summary?.totals?.investable || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Stocks & Crypto
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cash & Equivalents
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(summary?.totals?.cash || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Available for investment
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Total Debt
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {formatCurrency(Math.abs(summary?.totals?.debt || 0))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Credit cards & loans
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Mix Donut Chart */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Asset Allocation</CardTitle>
            <CardDescription className="text-slate-400">
              Portfolio breakdown by asset class
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-sm">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Chart */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-white">Performance</CardTitle>
                <CardDescription className="text-slate-400">
                  Portfolio value over time
                </CardDescription>
              </div>
              <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <TabsList className="grid grid-cols-5 w-[200px]">
                  <TabsTrigger value="1D">1D</TabsTrigger>
                  <TabsTrigger value="1W">1W</TabsTrigger>
                  <TabsTrigger value="1M">1M</TabsTrigger>
                  <TabsTrigger value="3M">3M</TabsTrigger>
                  <TabsTrigger value="1Y">1Y</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {history?.dataPoints ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={history.dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    stroke="#666"
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    stroke="#666"
                  />
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(value)}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading chart data...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card className="mt-6 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Today's Change</p>
              <p className={`text-lg font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary?.performance?.dayValue || 0)}
                <span className="text-sm ml-2">
                  ({formatPercent(summary?.performance?.dayPct || 0)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">YTD Change</p>
              <p className={`text-lg font-semibold ${(summary?.performance?.ytdValue || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary?.performance?.ytdValue || 0)}
                <span className="text-sm ml-2">
                  ({formatPercent(summary?.performance?.ytdPct || 0)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Accounts</p>
              <p className="text-lg font-semibold">
                {summary?.metadata?.accountCount || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currency</p>
              <p className="text-lg font-semibold">
                {summary?.metadata?.currency || 'USD'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Footer disclaimer */}
        <div className="mt-6 text-center text-xs text-slate-400">
          All values displayed in USD. Market data may be delayed by up to 15 minutes.
        </div>
      </div>
    </div>
  );
}