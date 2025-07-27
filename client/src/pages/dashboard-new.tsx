import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SummaryCards from "@/components/dashboard/summary-cards";
import ConnectedAccounts from "@/components/dashboard/connected-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Activity, RefreshCw } from "lucide-react";
import { SparkleTitle } from "@/components/auth/sparkle-animation";
import { PageTransition } from "@/components/auth/page-transition";
import { InteractiveTable } from "@/components/ui/interactive-table";
import { AnimatedBadge } from "@/components/ui/animated-badge";
import { ChartPlaceholder } from "@/components/ui/chart-placeholder";
import { Tooltip } from "@/components/ui/tooltip";
import { StockIcon } from "@/components/ui/stock-icon";
import { AccountDetailsModal } from "@/components/ui/account-details-modal";
import { EnhancedConnectedAccounts } from "@/components/dashboard/enhanced-connected-accounts";
import { QuickActionsBar } from "@/components/ui/quick-actions-bar";

import { ErrorRetryCard } from "@/components/ui/error-retry-card";
import { RealTimeAPI } from "@/lib/real-time-api";
import { StockDetailModal } from "@/components/modals/stock-detail-modal";

interface DashboardData {
  totalBalance: number;
  bankBalance: number;
  investmentValue: number;
  accounts: any[];
  holdings: any[];
  watchlist: any[];
  recentActivity: any[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, any>>({});
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Log user login
  useEffect(() => {
    const logLogin = async () => {
      try {
        await apiRequest('POST', '/api/log-login');
      } catch (error) {
        console.error('Failed to log login:', error);
      }
    };
    logLogin();
  }, []);

  // Fetch live quotes for watchlist
  useEffect(() => {
    const watchlistSymbols = ['AAPL', 'GOOGL', 'TSLA'];
    
    const fetchLiveQuotes = async () => {
      try {
        const quotes = await RealTimeAPI.getMultipleQuotes(watchlistSymbols);
        setLiveQuotes(quotes);
      } catch (error) {
        console.error('Failed to fetch live quotes:', error);
      }
    };

    fetchLiveQuotes();
    const interval = setInterval(fetchLiveQuotes, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleConnectBank = async () => {
    try {
      const response = await apiRequest('POST', '/api/teller/connect-init');
      if (!response.ok) throw new Error('Failed to initialize bank connection');
      
      const data = await response.json();
      const popup = window.open(
        `https://connect.teller.io/?applicationId=${data.applicationId}&environment=${data.environment}`,
        'teller_connect',
        'width=800,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          refetch(); // Refresh dashboard data
          toast({
            title: "Bank Connected",
            description: "Your bank account has been connected successfully.",
          });
        }
      }, 1000);
    } catch (error) {
      console.error('Bank connection error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect bank account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConnectBrokerage = async () => {
    try {
      const response = await apiRequest('POST', '/api/snaptrade/register');
      if (!response.ok) throw new Error('Failed to initialize brokerage connection');
      
      const data = await response.json();
      const popup = window.open(
        data.url,
        'snaptrade_connect',
        'width=800,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          refetch(); // Refresh dashboard data
          toast({
            title: "Brokerage Connected",
            description: "Your brokerage account has been connected successfully.",
          });
        }
      }, 1000);
    } catch (error) {
      console.error('Brokerage connection error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect brokerage account. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Transform accounts for ConnectedAccounts component
  const transformedAccounts = dashboardData?.accounts ? dashboardData.accounts.map((account: any) => ({
    id: account.id,
    provider: account.provider || 'unknown',
    accountName: account.name || account.accountName || 'Account',
    balance: account.balance?.toString() || '0',
    lastUpdated: account.lastSynced || new Date().toISOString(),
    institutionName: account.institutionName,
    accountType: account.accountType
  })) : [];

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flint-card h-32"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flint-card h-64"></div>
              <div className="flint-card h-64"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <div className="max-w-7xl mx-auto p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Error Loading Dashboard</h2>
            <p className="text-gray-400 mb-6">Please try refreshing the page</p>
            <Button onClick={() => refetch()} className="flint-btn-primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 font-mono">
            <SparkleTitle>Dashboard</SparkleTitle>
          </h1>
          <p className="text-gray-400">Welcome back, {(user as any)?.firstName || (user as any)?.email?.split('@')[0] || 'Trader'}</p>
        </div>

        {/* Summary Cards */}
        <SummaryCards 
          totalBalance={dashboardData?.totalBalance || 0}
          bankBalance={dashboardData?.bankBalance || 0}
          investmentValue={dashboardData?.investmentValue || 0}
          change24h={2.4} // This would come from real market data
        />

        {/* Connected Accounts */}
        <div className="mb-8">
          <ConnectedAccounts 
            accounts={transformedAccounts}
            onConnectBank={handleConnectBank}
            onConnectBrokerage={handleConnectBrokerage}
          />
        </div>

        {/* Quick Actions Bar */}
        <QuickActionsBar className="mb-8" />

        {/* Enhanced Quick Actions Bar with Tooltips */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Tooltip content="Buy quickly without detailed analysis" position="top">
                <button className="group flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25 hover:scale-105 btn-standard focus-visible:outline-green-400">
                  <TrendingUp className="h-5 w-5 mr-2 group-hover:animate-pulse" />
                  <span className="font-semibold text-white">Quick Buy</span>
                </button>
              </Tooltip>
              
              <Tooltip content="Sell positions quickly" position="top">
                <button className="group flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25 hover:scale-105 btn-standard focus-visible:outline-red-400">
                  <Activity className="h-5 w-5 mr-2 group-hover:animate-pulse" />
                  <span className="font-semibold text-white">Quick Sell</span>
                </button>
              </Tooltip>
              
              <Tooltip content="Move funds between accounts" position="top">
                <button className="group flex items-center justify-center px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 hover:scale-105 btn-standard focus-visible:outline-purple-400">
                  <RefreshCw className="h-5 w-5 mr-2 group-hover:animate-pulse" />
                  <span className="font-semibold text-white">Transfer Funds</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Enhanced Watchlist & Holdings with Micro-interactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Watchlist with Interactive Elements */}
          <Card className="flint-card group hover:border-purple-500/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white font-mono flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform duration-200" />
                Watchlist
                <AnimatedBadge variant="info" className="ml-auto">3 items</AnimatedBadge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Real-time watchlist data */}
                {Object.entries(liveQuotes).map(([symbol, quote], index) => (
                  <div 
                    key={symbol}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 
                      hover:bg-gray-800/50 cursor-pointer transform hover:scale-[1.02] 
                      transition-all duration-200 group/item relative"
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => {
                      setSelectedStock(symbol);
                      setIsStockModalOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <StockIcon symbol={symbol} size="sm" />
                      <div>
                        <p className="text-white font-medium">{symbol}</p>
                        <p className="text-xs text-gray-400">{(quote as any)?.name || `${symbol} Stock`}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">${(quote as any)?.price?.toFixed(2) || '0.00'}</p>
                      <div className={`text-xs flex items-center gap-1 ${
                        ((quote as any)?.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        <span>{((quote as any)?.change || 0) >= 0 ? '↗' : '↘'}</span>
                        <span>{Math.abs((quote as any)?.changePercent || 0).toFixed(2)}%</span>
                      </div>
                    </div>
                    
                    {/* Mini chart on hover */}
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-16 h-8 
                      opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <ChartPlaceholder 
                        data={[45, 52, 48, 61, 59, 67, 71, 68, 74, 78]} 
                        height={32} 
                        color={((quote as any)?.change || 0) >= 0 ? "#22c55e" : "#ef4444"}
                        animated={true}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Holdings with Interactive Table */}
          <Card className="flint-card group hover:border-green-500/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-white font-mono flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-400 group-hover:scale-110 transition-transform duration-200" />
                Holdings
                <AnimatedBadge variant="success" className="ml-auto">2 positions</AnimatedBadge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InteractiveTable
                data={[
                  { symbol: 'AAPL', shares: 50, avgPrice: 175.32, currentPrice: 189.45, value: 9472.50, pl: 706.50 },
                  { symbol: 'MSFT', shares: 25, avgPrice: 342.18, currentPrice: 338.11, value: 8452.75, pl: -101.75 }
                ]}
                columns={[
                  { 
                    key: 'symbol', 
                    header: 'Symbol', 
                    sortable: true,
                    render: (value) => (
                      <div className="font-medium text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        {value}
                      </div>
                    )
                  },
                  { 
                    key: 'shares', 
                    header: 'Shares', 
                    sortable: true,
                    render: (value) => <span className="text-gray-300">{value}</span>
                  },
                  { 
                    key: 'currentPrice', 
                    header: 'Price', 
                    sortable: true,
                    render: (value) => <span className="text-white">${value}</span>
                  },
                  { 
                    key: 'pl', 
                    header: 'P/L', 
                    sortable: true,
                    render: (value) => (
                      <AnimatedBadge 
                        variant={value >= 0 ? 'success' : 'error'}
                        glow={Math.abs(value) > 100}
                      >
                        {value >= 0 ? '+' : ''}${value.toFixed(2)}
                      </AnimatedBadge>
                    )
                  }
                ]}
                hoverable={true}
                className="bg-transparent"
              />
            </CardContent>
          </Card>
        </div>



        {/* Recent Activity */}
        <Card className="flint-card">
          <CardHeader>
            <CardTitle className="text-white font-mono">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity.</p>
              <p className="text-sm">Your transactions will appear here.</p>
            </div>
          </CardContent>
        </Card>

        {/* Stock Detail Modal */}
        <StockDetailModal
          symbol={selectedStock}
          isOpen={isStockModalOpen}
          onClose={() => setIsStockModalOpen(false)}
          onTrade={(symbol, action) => {
            console.log(`Trading ${symbol} - ${action}`);
            setIsStockModalOpen(false);
          }}
        />

        {/* Account Details Modal */}
        <AccountDetailsModal
          account={selectedAccount}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </div>
  );
}