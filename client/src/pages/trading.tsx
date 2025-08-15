import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTransition } from "@/components/auth/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TradeModal from "@/components/modals/trade-modal";
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Search, TrendingUp, TrendingDown, Eye, Plus } from "lucide-react";
import { Link } from "wouter";
import { ComplianceDisclaimer } from "@/components/compliance/ComplianceDisclaimer";

export default function Trading() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [presetAction, setPresetAction] = useState<'BUY' | 'SELL' | null>(null);

  // Check URL parameters for preset action
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const symbol = urlParams.get('symbol');
    
    if (action === 'buy') {
      setPresetAction('BUY');
      if (symbol) {
        // If symbol is provided, pre-populate the search and open trade modal
        setSearchTerm(symbol);
        // Create a mock asset for the symbol
        const mockAsset = {
          symbol: symbol.toUpperCase(),
          name: `${symbol.toUpperCase()} Stock`,
          price: 0, // Will be fetched from real-time data
          change: 0,
          changePercent: 0
        };
        setSelectedAsset(mockAsset);
        setIsTradeModalOpen(true);
      }
    } else if (action === 'sell') {
      setPresetAction('SELL');
      if (symbol) {
        setSearchTerm(symbol);
        const mockAsset = {
          symbol: symbol.toUpperCase(),
          name: `${symbol.toUpperCase()} Stock`,
          price: 0,
          change: 0,
          changePercent: 0
        };
        setSelectedAsset(mockAsset);
        setIsTradeModalOpen(true);
      }
    }
  }, []);

  // Fetch holdings and trades
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["/api/dashboard"],
    queryFn: FinancialAPI.getDashboardData,
    refetchInterval: 30000,
  });

  const { data: tradesResponse, isLoading: tradesLoading } = useQuery({
    queryKey: ["/api/trades"],
    queryFn: FinancialAPI.getTrades,
    refetchInterval: 10000,
  });

  // Safely extract trades array from response
  const trades = Array.isArray(tradesResponse?.trades) ? tradesResponse.trades : [];

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

  const handleTradeClick = (asset: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedAsset(asset);
    setIsTradeModalOpen(true);
  };

  const handleQuickAction = (action: 'BUY' | 'SELL') => {
    setPresetAction(action);
    // Show a helper message if no asset is selected
    if (!selectedAsset) {
      toast({
        title: `Quick ${action}`,
        description: `Search for a stock to ${action.toLowerCase()} using the search bar above`,
      });
    } else {
      setIsTradeModalOpen(true);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatPercent = (percent: number | string) => {
    const num = typeof percent === 'string' ? parseFloat(percent) : percent;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const popularAssets = [
    { symbol: "AAPL", name: "Apple Inc.", price: 175.84, change: 2.3, color: "bg-blue-500", letter: "A" },
    { symbol: "TSLA", name: "Tesla Inc.", price: 248.42, change: 4.7, color: "bg-green-500", letter: "T" },
    { symbol: "GOOGL", name: "Alphabet Inc.", price: 2847.32, change: -0.8, color: "bg-red-500", letter: "G" },
    { symbol: "MSFT", name: "Microsoft Corp.", price: 367.45, change: 1.9, color: "bg-blue-600", letter: "M" },
    { symbol: "BTC", name: "Bitcoin", price: 43267.89, change: -1.2, color: "bg-orange-500", letter: "₿" },
    { symbol: "ETH", name: "Ethereum", price: 2847.32, change: 3.4, color: "bg-purple-500", letter: "E" },
  ];

  const filteredAssets = popularAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <PageTransition className="min-h-screen bg-[#121212] text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-[#121212] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 font-mono">
            <span className="sparkle-title">Trading</span>
          </h1>
          <p className="text-gray-400">Execute trades and monitor your positions</p>
        </div>

        {/* Trading Compliance Disclaimer */}
        <div className="mb-6">
          <ComplianceDisclaimer type="trading" compact showOnce />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search and Popular Assets */}
          <div className="lg:col-span-2">
            <Card className="trade-card shadow-lg mb-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Search Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search stocks, ETFs, or crypto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                
                <div className="space-y-3">
                  {filteredAssets.map((asset) => (
                    <Link key={asset.symbol} href={`/stock/${asset.symbol}`}>
                      <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 ${asset.color} rounded-full flex items-center justify-center`}>
                          <span className="text-white font-bold">{asset.letter}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{asset.symbol}</p>
                          <p className="text-gray-400 text-sm">{asset.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-white font-medium">{formatCurrency(asset.price)}</p>
                          <p className={`text-sm ${asset.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {asset.change >= 0 ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                            {formatPercent(asset.change)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-800"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Watch
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => handleTradeClick(asset, e)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Trade
                          </Button>
                        </div>
                      </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Summary */}
          <div>
            <Card className="trade-card shadow-lg mb-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Portfolio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Value</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(dashboardData?.investmentBalance || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Day's Change</span>
                    <span className="text-green-500 font-semibold">+$1,234.56</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Return</span>
                    <span className="text-green-500 font-semibold">+15.67%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="trade-card shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData?.holdings?.slice(0, 5).map((holding: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{holding.symbol}</p>
                        <p className="text-gray-400 text-sm">{holding.quantity} shares</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white">{formatCurrency(holding.marketValue)}</p>
                        <p className={`text-sm ${parseFloat(holding.gainLoss) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatPercent(holding.gainLossPercentage)}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-gray-400 text-center py-4">No holdings yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Trades */}
        <Card className="trade-card shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-800">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="filled">Filled</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-3 mt-4">
                {trades.slice(0, 10).map((trade: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'}>
                        {trade.side.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="text-white font-medium">{trade.symbol}</p>
                        <p className="text-gray-400 text-sm">{trade.quantity} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white">{formatCurrency(trade.totalAmount)}</p>
                      <p className="text-gray-400 text-sm">{trade.status}</p>
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-400 text-center py-8">No trades yet</p>
                )}
              </TabsContent>
              <TabsContent value="pending" className="space-y-3 mt-4">
                {trades.filter((trade: any) => trade.status === 'pending').map((trade: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{trade.side.toUpperCase()}</Badge>
                      <div>
                        <p className="text-white font-medium">{trade.symbol}</p>
                        <p className="text-gray-400 text-sm">{trade.quantity} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white">{formatCurrency(trade.totalAmount)}</p>
                      <p className="text-yellow-500 text-sm">Pending</p>
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-400 text-center py-8">No pending trades</p>
                )}
              </TabsContent>
              <TabsContent value="filled" className="space-y-3 mt-4">
                {trades.filter((trade: any) => trade.status === 'filled').map((trade: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'}>
                        {trade.side.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="text-white font-medium">{trade.symbol}</p>
                        <p className="text-gray-400 text-sm">{trade.quantity} shares</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white">{formatCurrency(trade.totalAmount)}</p>
                      <p className="text-green-500 text-sm">Filled</p>
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-400 text-center py-8">No filled trades</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      
      <TradeModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        symbol={selectedAsset?.symbol}
        currentPrice={selectedAsset?.price}
        presetAction={presetAction}
        onTradeComplete={() => {
          setIsTradeModalOpen(false);
          setPresetAction(null);
        }}
      />
    </PageTransition>
  );
}
