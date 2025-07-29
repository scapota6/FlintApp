import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useSymbolSearch } from "@/hooks/useSnapTrade";
import { EnhancedTradeModal } from "./enhanced-trade-modal";
import { StockIcon } from "@/components/ui/stock-icon";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Newspaper, X } from "lucide-react";

interface StockDetailModalProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StockDetailModal({ symbol, isOpen, onClose }: StockDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');

  const { data: marketData, isLoading } = useQuery({
    queryKey: ['/api/quotes', [symbol]],
    retry: false
  });
  const { data: symbolResults = [] } = useSymbolSearch(symbol);

  const quote = marketData?.[symbol];
  const price = quote?.price || 0;
  const changePercent = quote?.changePct || 0;
  const isPositive = changePercent >= 0;

  const symbolInfo = symbolResults[0];
  const isCrypto = symbolInfo?.type?.toLowerCase().includes('crypto') || 
                   symbolInfo?.currency === 'BTC' || 
                   ['BTC', 'ETH', 'DOGE', 'ADA', 'SOL'].includes(symbol.toUpperCase());

  // Mock key statistics - in real app, these would come from SnapTrade or market data API
  const keyStats = {
    marketCap: price * 16000000000, // Estimated shares outstanding
    volume: quote?.volume || Math.floor(Math.random() * 100000000),
    peRatio: Math.floor(Math.random() * 30) + 15,
    week52High: price * 1.2,
    week52Low: price * 0.8,
    avgVolume: Math.floor(Math.random() * 80000000) + 20000000,
    beta: (Math.random() * 2).toFixed(2),
    eps: (price / 25).toFixed(2)
  };

  const handleTrade = (action: 'buy' | 'sell') => {
    setTradeAction(action);
    setIsTradeModalOpen(true);
  };

  const handleCloseTradeModal = () => {
    setIsTradeModalOpen(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-700 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StockIcon symbol={symbol} />
                <div>
                  <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                    {symbol.toUpperCase()}
                    {isCrypto && <Badge variant="outline" className="text-xs">CRYPTO</Badge>}
                  </DialogTitle>
                  <p className="text-sm text-gray-400">
                    {symbolInfo?.description || `${symbol} Stock`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Price Display */}
            <div className="flex items-center gap-6 mt-4">
              <div>
                <p className="text-3xl font-bold text-white">
                  ${price.toFixed(2)}
                </p>
                <div className={`flex items-center gap-1 text-sm ${
                  isPositive ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleTrade('buy')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Buy {symbol}
                </Button>
                <Button 
                  onClick={() => handleTrade('sell')}
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-600/10"
                >
                  Sell {symbol}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="news">News</TabsTrigger>
              <TabsTrigger value="trade">Trade</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Key Statistics */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-400" />
                    Key Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">Market Cap</p>
                      <p className="text-sm font-medium text-white">
                        ${(keyStats.marketCap / 1000000000).toFixed(1)}B
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">Volume</p>
                      <p className="text-sm font-medium text-white">
                        {(keyStats.volume / 1000000).toFixed(1)}M
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">P/E Ratio</p>
                      <p className="text-sm font-medium text-white">{keyStats.peRatio}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">Beta</p>
                      <p className="text-sm font-medium text-white">{keyStats.beta}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">52W High</p>
                      <p className="text-sm font-medium text-white">${keyStats.week52High.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">52W Low</p>
                      <p className="text-sm font-medium text-white">${keyStats.week52Low.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">Avg Volume</p>
                      <p className="text-sm font-medium text-white">
                        {(keyStats.avgVolume / 1000000).toFixed(1)}M
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">EPS</p>
                      <p className="text-sm font-medium text-white">${keyStats.eps}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Market Data Source */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-purple-400" />
                    Market Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Data Source</p>
                      <p className="text-white font-medium">
                        {quote?.source || 'Polygon.io (Delayed)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Last Updated</p>
                      <p className="text-white font-medium">
                        {new Date().toLocaleTimeString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Currency</p>
                      <p className="text-white font-medium">
                        {symbolInfo?.currency || 'USD'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SnapTrade Integration Status */}
              {symbolInfo && (
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">SnapTrade Symbol Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Exchange</p>
                        <p className="text-white">{symbolInfo.exchange || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Type</p>
                        <p className="text-white">{symbolInfo.type || 'Equity'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Raw Symbol</p>
                        <p className="text-white">{symbolInfo.raw_symbol || symbol}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Universal ID</p>
                        <p className="text-white font-mono text-xs">{symbolInfo.id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="chart" className="space-y-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Price Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-lg">
                    <div className="text-center">
                      <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">TradingView chart integration available</p>
                      <p className="text-xs text-gray-500">Real-time charts with technical indicators</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="news" className="space-y-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-purple-400" />
                    Latest News
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      {
                        title: `${symbol} Reports Strong Quarterly Results`,
                        source: "Financial Times",
                        time: "2 hours ago",
                        summary: "Company exceeds analyst expectations with revenue growth and positive outlook."
                      },
                      {
                        title: `Analyst Upgrades ${symbol} Price Target`,
                        source: "Bloomberg",
                        time: "5 hours ago",
                        summary: "Major investment bank raises price target citing strong fundamentals."
                      },
                      {
                        title: `${symbol} Announces New Strategic Initiative`,
                        source: "Reuters",
                        time: "1 day ago",
                        summary: "Company outlines plans for expansion into emerging markets."
                      }
                    ].map((article, index) => (
                      <div key={index} className="p-3 rounded-lg bg-gray-700/30 border border-gray-600">
                        <h4 className="text-white font-medium text-sm mb-1">{article.title}</h4>
                        <p className="text-gray-400 text-xs mb-2">{article.summary}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{article.source}</span>
                          <span>{article.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trade" className="space-y-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Quick Trade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      onClick={() => handleTrade('buy')}
                      className="bg-green-600 hover:bg-green-700 text-white h-12"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Buy {symbol}
                    </Button>
                    <Button 
                      onClick={() => handleTrade('sell')}
                      variant="outline"
                      className="border-red-600 text-red-400 hover:bg-red-600/10 h-12"
                    >
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Sell {symbol}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-4">
                    Opens advanced trading interface with SnapTrade integration
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Enhanced Trade Modal */}
      <EnhancedTradeModal
        symbol={symbol}
        isOpen={isTradeModalOpen}
        onClose={handleCloseTradeModal}
        defaultAction={tradeAction}
      />
    </>
  );
}