import { Switch, Route } from "wouter";
import { AnimatePresence } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import GlobalNavbar from "@/components/layout/global-navbar";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard-new";
import Trading from "@/pages/trading";
import Transfers from "@/pages/transfers";
import Watchlist from "@/pages/watchlist";
import Activity from "@/pages/activity";
import Subscribe from "@/pages/subscribe";
import Admin from "@/pages/admin";
import Profile from "@/pages/profile";
import News from "@/pages/news";
import StockDetail from "@/pages/stock-detail";

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
      <AnimatePresence mode="wait">
        <Switch>
          {!isAuthenticated ? (
            <Route path="/" component={Landing} />
          ) : (
            <>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/trading" component={Trading} />
              <Route path="/transfers" component={Transfers} />
              <Route path="/watchlist" component={Watchlist} />
              <Route path="/activity" component={Activity} />
              <Route path="/subscribe" component={Subscribe} />
              <Route path="/admin" component={Admin} />
              <Route path="/profile" component={Profile} />
              <Route path="/news" component={News} />
              <Route path="/stock/:symbol" component={StockDetail} />
            </>
          )}
          <Route component={NotFound} />
        </Switch>
      </AnimatePresence>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
