import { Switch, Route } from "wouter";
import { AnimatePresence } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import GlobalNavbar from "@/components/layout/global-navbar";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import SuccessPage from "@/pages/success";
import Dashboard from "@/pages/dashboard";
import Trading from "@/pages/Trading";
import Transfers from "@/pages/transfers";
import WatchlistPage from "@/pages/Watchlist";
import Activity from "@/pages/activity";
import Subscribe from "@/pages/subscribe";
import Admin from "@/pages/Admin";
import Profile from "@/pages/profile";
import News from "@/pages/news";
import StockDetail from "@/pages/stock-detail";
import AssetDetail from "@/pages/asset-detail";
import Accounts from "@/pages/Accounts";
import BrokerageDetail from "@/pages/BrokerageDetail";
import BankDetail from "@/pages/BankDetail";
import Connections from "@/pages/connections";
import Portfolio from "@/pages/Portfolio";
import Settings from "@/pages/Settings";
import Security from "@/pages/Security";
import Monitoring from "@/pages/Monitoring";
import TellerCallback from "@/pages/TellerCallback";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && <GlobalNavbar />}
      <div className={isAuthenticated ? "pt-16" : ""}>
        <AnimatePresence mode="wait">
          <Switch>
            {!isAuthenticated ? (
              <>
                <Route path="/" component={Landing} />
                <Route path="/success" component={SuccessPage} />
              </>
            ) : (
              <>
                <Route path="/" component={Dashboard} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/trading" component={Trading} />
                <Route path="/transfers" component={Transfers} />
                <Route path="/watchlist" component={WatchlistPage} />
                <Route path="/activity" component={Activity} />
                <Route path="/subscribe" component={Subscribe} />
                <Route path="/admin" component={Admin} />
                <Route path="/profile" component={Profile} />
                <Route path="/news" component={News} />
                <Route path="/stock/:symbol" component={StockDetail} />
                <Route path="/asset/:symbol" component={AssetDetail} />
                <Route path="/portfolio" component={Portfolio} />
                <Route path="/accounts" component={Accounts} />
                <Route path="/accounts/brokerage/:id" component={BrokerageDetail} />
                <Route path="/accounts/bank/:id" component={BankDetail} />
                <Route path="/connections" component={Connections} />
                <Route path="/settings" component={Settings} />
                <Route path="/security" component={Security} />
                <Route path="/monitoring" component={Monitoring} />
                <Route path="/teller/callback" component={TellerCallback} />
              </>
            )}
            <Route component={NotFound} />
          </Switch>
        </AnimatePresence>
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div>
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
