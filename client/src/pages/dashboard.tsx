import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import UnifiedDashboard from "@/components/dashboard/unified-dashboard";
import SimpleConnectButtons from "@/components/dashboard/simple-connect-buttons";
import AccountDetailModal from "@/components/dashboard/account-detail-modal";
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SimpleWatchlist from '@/components/watchlist/simple-watchlist';
import RealTimeHoldings from '@/components/portfolio/real-time-holdings';

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

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

  const handleAccountDetail = (account: any) => {
    setSelectedAccount(account);
    setIsAccountModalOpen(true);
  };

  const handleAddToWatchlist = async (symbol: string, name: string) => {
    try {
      await FinancialAPI.addToWatchlist(symbol, name, 'stock');
      toast({
        title: "Added to Watchlist",
        description: `${symbol} has been added to your watchlist.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add to watchlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTradeSymbol = (symbol: string, name: string) => {
    // Navigate to trade page with symbol
    window.location.href = `/trading?symbol=${symbol}`;
  };

  // Handle unauthorized errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Error Loading Dashboard</h2>
            <p className="text-gray-400">Please try refreshing the page</p>
          </div>
        </main>
        <MobileNav />
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
          <p className="text-gray-400 text-sm">Unified view of your total net worth across all accounts</p>
        </div>

        {/* Unified Dashboard - Real API Data Only */}
        <UnifiedDashboard />

        {/* Real-Time Market Data Section */}
        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-6">Real-Time Market Data</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimpleWatchlist />
            <RealTimeHoldings showAccountProvider={true} />
          </div>
        </div>

        {/* Connection Options */}
        <div className="mt-12">
          <SimpleConnectButtons 
            accounts={dashboardData?.accounts || []} 
            userTier="basic"
          />
        </div>
      </main>

      {/* Account Detail Modal */}
      <AccountDetailModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        account={selectedAccount}
      />
    </div>
  );
}