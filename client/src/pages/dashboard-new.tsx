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
          <h1 className="text-4xl font-bold mb-2 font-mono text-transparent bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text">
            Dashboard
          </h1>
          <p className="text-gray-400">Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'Trader'}</p>
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

        {/* Watchlist & Holdings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="flint-card">
            <CardHeader>
              <CardTitle className="text-white font-mono flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                Watchlist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-400">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Your watchlist is empty.</p>
                <p className="text-sm">Use the search bar to add stocks to track.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="flint-card">
            <CardHeader>
              <CardTitle className="text-white font-mono flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-400" />
                Holdings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-400">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No holdings found.</p>
                <p className="text-sm">Connect your brokerage to see your positions.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="flint-card mb-8">
          <CardHeader>
            <CardTitle className="text-white font-mono">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button className="flint-btn-buy text-sm">
                Quick Buy
              </button>
              <button className="flint-btn-sell text-sm">
                Quick Sell
              </button>
            </div>
            <div className="text-center">
              <button className="flint-btn-primary text-sm w-full">
                Transfer Funds
              </button>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}