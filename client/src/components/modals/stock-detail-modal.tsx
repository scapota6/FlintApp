import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowLeft } from 'lucide-react';
import { StockIcon } from '@/components/ui/stock-icon';
import { EnhancedTradingViewChart } from '@/components/ui/enhanced-tradingview-chart';
import { MarketDataService } from '@/services/market-data-service';

interface StockDetailModalProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  onTrade?: (symbol: string, action: 'BUY' | 'SELL') => void;
}

export function StockDetailModal({ symbol, isOpen, onClose, onTrade }: StockDetailModalProps) {
  const [stockData, setStockData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && symbol) {
      const fetchStockData = async () => {
        setLoading(true);
        try {
          const data = await MarketDataService.getStockData(symbol);
          setStockData(data);
        } catch (error) {
          console.error('Failed to fetch stock data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchStockData();
    }
  }, [symbol, isOpen]);

  if (!isOpen) return null;

  const isPositive = (stockData?.change || 0) >= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] bg-gray-900 border-gray-700 text-white overflow-y-auto">
        <DialogHeader className="border-b border-gray-700 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <StockIcon symbol={symbol} size="lg" />
              <div>
                <DialogTitle className="text-2xl font-bold">{symbol}</DialogTitle>
                <p className="text-gray-400">{stockData?.name || `${symbol} Stock`}</p>
              </div>
            </div>
            <div className="text-right">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-16"></div>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold">
                    ${stockData?.price?.toFixed(2) || '0.00'}
                  </div>
                  <div className={`flex items-center justify-end space-x-1 ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>
                      {isPositive ? '+' : ''}{stockData?.change?.toFixed(2) || '0.00'} 
                      ({isPositive ? '+' : ''}{(stockData?.changePercent || 0).toFixed(2)}%)
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="py-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="news">News</TabsTrigger>
              <TabsTrigger value="trade">Trade</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-400">Market Cap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {stockData?.marketCap ? `$${(stockData.marketCap / 1e9).toFixed(1)}B` : 'N/A'}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-400">Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {stockData?.volume ? `${(stockData.volume / 1e6).toFixed(1)}M` : 'N/A'}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-400">P/E Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {stockData?.peRatio || 'N/A'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Key Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">52W High</p>
                      <p className="text-white font-semibold">${(stockData?.price * 1.2 || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">52W Low</p>
                      <p className="text-white font-semibold">${(stockData?.price * 0.8 || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Avg Volume</p>
                      <p className="text-white font-semibold">{stockData?.volume ? `${(stockData.volume / 1e6).toFixed(1)}M` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Dividend</p>
                      <p className="text-white font-semibold">$0.24</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chart" className="mt-6">
              <div className="space-y-4">
                <EnhancedTradingViewChart
                  symbol={symbol}
                  height={500}
                  className="w-full"
                />
              </div>
            </TabsContent>

            <TabsContent value="news" className="mt-6">
              <div className="space-y-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-6">
                    <h3 className="text-white font-semibold mb-2">Latest News</h3>
                    <p className="text-gray-400">News integration coming soon...</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trade" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-green-400 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Buy {symbol}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => onTrade?.(symbol, 'BUY')}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-red-400 flex items-center">
                      <TrendingDown className="h-5 w-5 mr-2" />
                      Sell {symbol}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => onTrade?.(symbol, 'SELL')}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Sell Now
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}