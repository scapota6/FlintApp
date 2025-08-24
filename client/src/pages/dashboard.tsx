import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import UnifiedDashboard from "@/components/dashboard/unified-dashboard";
import SimpleConnectButtons from "@/components/dashboard/simple-connect-buttons";
import AccountDetailModal from "@/components/dashboard/account-detail-modal";
import AccountCard from "@/components/dashboard/account-card";
import SnapTradeConnectionAlert from "@/components/dashboard/snaptrade-connection-alert";
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RealTimeHoldings from '@/components/portfolio/real-time-holdings';

// import TransactionHistory from '@/components/activity/transaction-history';
import AssetSearch from '@/components/search/asset-search';

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Fetch dashboard data with proper Teller refresh cadence
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["teller", "accounts", "balances"],
    queryFn: FinancialAPI.getDashboardData,
    staleTime: 12 * 60 * 60 * 1000, // 12 hours - data considered fresh for 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in cache for 24 hours
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when connection restored
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
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
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-2">
              Financial Dashboard
            </h2>
            <p className="text-gray-400 text-sm">Unified view of your total net worth across all accounts</p>
          </div>
          <AssetSearch />
        </div>

        {/* Unified Dashboard - Real API Data Only */}
        <UnifiedDashboard />

        {/* Portfolio Holdings Section */}
        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-6">Portfolio Holdings</h3>
          <RealTimeHoldings showAccountProvider={true} maxItems={50} />
        </div>


        {/* Connection Options */}
        <div className="mt-12">
          <SimpleConnectButtons 
            accounts={dashboardData?.accounts || []} 
            userTier={dashboardData?.subscriptionTier || "free"}
            isAdmin={dashboardData?.isAdmin || false}
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