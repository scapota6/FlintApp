import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Navigation from "@/components/layout/navigation";
import MobileNav from "@/components/layout/mobile-nav";
import BalanceCards from "@/components/dashboard/balance-cards";
import WatchlistCard from "@/components/dashboard/watchlist-card";
import QuickTrade from "@/components/dashboard/quick-trade";
import SimpleConnectButtons from "@/components/dashboard/simple-connect-buttons";
import ActivityFeed from "@/components/dashboard/activity-feed";
import { HoldingsCard } from "@/components/dashboard/holdings-card";
import QuickTransfer from "@/components/dashboard/quick-transfer";
import AccountDetailModal from "@/components/dashboard/account-detail-modal";
import AccountCard from "@/components/dashboard/account-card";
import SmartSearchBar from "@/components/search/SmartSearchBar";
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

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
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-2">
            Good morning, User
          </h2>
          <p className="text-gray-400 text-sm">Here's your financial overview</p>
        </div>

        {/* Universal Search Bar */}
        <div className="mb-8">
          <SmartSearchBar 
            connectedBrokerages={['robinhood', 'fidelity']} // Mock connected accounts
            showCompatibilityFilter={true}
            placeholder="Search stocks, crypto, ETFs..."
            className="max-w-2xl mx-auto"
          />
        </div>

        {/* Balance Cards */}
        <BalanceCards data={dashboardData} />

        {/* Connected Accounts */}
        {dashboardData?.accounts && dashboardData.accounts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Connected Accounts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.accounts.map((account: any) => (
                <AccountCard
                  key={account.id}
                  id={account.id}
                  name={account.accountName}
                  provider={account.provider}
                  type={account.accountType || 'investment'}
                  balance={account.balance}
                  currency={account.currency}
                  institutionName={account.institutionName}
                />
              ))}
            </div>
          </div>
        )}

        {/* Simple Connect Buttons */}
        <SimpleConnectButtons 
          accounts={dashboardData?.accounts || []} 
          userTier="basic"
        />

        {/* Balance Cards */}
        <BalanceCards data={dashboardData} />

        <div className="grid gap-6 md:grid-cols-2">
          <HoldingsCard data={dashboardData?.holdings || []}/>
          <WatchlistCard 
            data={dashboardData?.watchlist || []} 
            onAccountDetail={handleAccountDetail}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <QuickTrade />
          <ActivityFeed activities={dashboardData?.recentActivity || []} />
        </div>
      </main>

      <MobileNav />

      {/* Account Detail Modal */}
      <AccountDetailModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        account={selectedAccount}
      />
    </div>
  );
}