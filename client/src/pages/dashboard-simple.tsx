import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SimpleWatchlist from '@/components/watchlist/simple-watchlist';
import RealTimeHoldings from '@/components/portfolio/real-time-holdings';
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function DashboardSimple() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: FinancialAPI.getDashboardData,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Log user login
  useEffect(() => {
    FinancialAPI.logLogin().catch(console.error);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-2xl font-bold mb-4">Flint</div>
          <div className="text-gray-400">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Error Loading Dashboard</h2>
            <p className="text-gray-400">Please try refreshing the page</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-2">
            Financial Dashboard
          </h2>
          <p className="text-gray-400 text-sm">Real-time market data and portfolio tracking</p>
        </div>

        {/* Account Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="flint-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-400">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${dashboardData?.totalBalance?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Across all accounts
              </p>
            </CardContent>
          </Card>

          <Card className="flint-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-400">Bank Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${dashboardData?.bankBalance?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Connected bank accounts
              </p>
            </CardContent>
          </Card>

          <Card className="flint-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-400">Investment Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${dashboardData?.investmentBalance?.toLocaleString() || '0'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Brokerage accounts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Real-Time Market Data Section */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-6">Real-Time Market Data</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimpleWatchlist />
            <RealTimeHoldings showAccountProvider={true} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="flint-card cursor-pointer hover:bg-gray-800/50 transition-colors">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">🏦</div>
                <h4 className="font-semibold text-white mb-1">Connect Bank</h4>
                <p className="text-sm text-gray-400">Link your bank account</p>
              </CardContent>
            </Card>

            <Card className="flint-card cursor-pointer hover:bg-gray-800/50 transition-colors">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">📈</div>
                <h4 className="font-semibold text-white mb-1">Connect Brokerage</h4>
                <p className="text-sm text-gray-400">Link investment accounts</p>
              </CardContent>
            </Card>

            <Card className="flint-card cursor-pointer hover:bg-gray-800/50 transition-colors">
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">💰</div>
                <h4 className="font-semibold text-white mb-1">Start Trading</h4>
                <p className="text-sm text-gray-400">Buy and sell securities</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* API Status */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-800">
          Live data powered by Polygon.io, CoinGecko, SnapTrade, and Teller.io
        </div>
      </main>
    </div>
  );
}