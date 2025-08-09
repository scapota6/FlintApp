import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import GlobalNavbar from "@/components/layout/global-navbar";
import { useAuth } from "@/hooks/useAuth";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Trading = lazy(() => import("@/pages/trading"));
const Transfers = lazy(() => import("@/pages/transfers"));
const WatchlistPage = lazy(() => import("@/pages/watchlist"));
const Activity = lazy(() => import("@/pages/activity"));
const Subscribe = lazy(() => import("@/pages/subscribe"));
const Admin = lazy(() => import("@/pages/admin"));
const Profile = lazy(() => import("@/pages/profile"));
const News = lazy(() => import("@/pages/news"));
const StockDetail = lazy(() => import("@/pages/stock-detail"));
const AssetDetail = lazy(() => import("@/pages/asset-detail"));

const LazyAnimatePresence = lazy(() =>
  import("framer-motion").then((m) => ({ default: m.AnimatePresence })),
);

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
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        }
      >
        {!isAuthenticated ? (
          <Switch>
            <Route path="/" component={Landing} />
            <Route component={NotFound} />
          </Switch>
        ) : (
          <LazyAnimatePresence mode="wait">
            <Switch>
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
            </Switch>
          </LazyAnimatePresence>
        )}
      </Suspense>
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
