import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, ArrowLeft, BarChart3, Activity } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import TradingViewChart from '@/components/charts/tradingview-chart';

interface AssetData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap?: number;
  volume?: number;
  dayHigh?: number;
  dayLow?: number;
  yearHigh?: number;
  yearLow?: number;
  type: 'stock' | 'crypto';
  lastUpdated: string;
}

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
}

export default function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('overview');

  // Fetch asset data with real-time updates
  const { data: assetData, isLoading, error } = useQuery<AssetData>({
    queryKey: ['/api/asset', symbol],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/asset/${symbol}`);
      if (!response.ok) throw new Error('Failed to fetch asset data');
      return response.json();
    },
    refetchInterval: 10000, // Update every 10 seconds
    enabled: !!symbol,
  });

  // Fetch asset news
  const { data: newsData = [] } = useQuery<NewsItem[]>({
    queryKey: ['/api/asset/news', symbol],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/asset/${symbol}/news`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!symbol,
  });

  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number, changePct: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
    return `$${marketCap.toLocaleString()}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toLocaleString();
  };

  const handleTrade = (action: 'buy' | 'sell') => {
    toast({
      title: `${action.toUpperCase()} ${symbol}`,
      description: `Opening trading interface for ${assetData?.name}`,
    });
    // Could open trading modal or navigate to trading page
  };

  const handleAddToWatchlist = async () => {
    try {
      const response = await apiRequest('POST', '/api/watchlist', {
        symbol: symbol!.toUpperCase(),
        name: assetData?.name || symbol!.toUpperCase(),
        type: assetData?.type || 'stock'
      });
      
      if (response.ok) {
        toast({
          title: "Added to Watchlist",
          description: `${symbol} has been added to your watchlist`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add to watchlist",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-32 mb-4"></div>
            <div className="h-12 bg-gray-700 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-96 bg-gray-800 rounded-lg"></div>
                <div className="h-64 bg-gray-800 rounded-lg"></div>
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-gray-800 rounded-lg"></div>
                <div className="h-32 bg-gray-800 rounded-lg"></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !assetData) {
    return (
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">Asset Not Found</h2>
            <p className="text-gray-400 mb-6">Unable to load data for {symbol}</p>
            <Button onClick={() => setLocation('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/dashboard')}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Asset Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{assetData.name}</h1>
              <div className="flex items-center space-x-3">
                <Badge 
                  variant="outline" 
                  className={assetData.type === 'crypto' ? 'text-orange-400 border-orange-400' : 'text-purple-400 border-purple-400'}
                >
                  {assetData.symbol}
                </Badge>
                <Badge variant="secondary" className="bg-green-600/20 text-green-400">
                  Live Data
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold mb-2">
                {formatPrice(assetData.price)}
              </div>
              <div className={`text-lg flex items-center justify-end ${
                assetData.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {assetData.change >= 0 ? 
                  <TrendingUp className="h-5 w-5 mr-1" /> : 
                  <TrendingDown className="h-5 w-5 mr-1" />
                }
                {formatChange(assetData.change, assetData.changePct)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button 
              onClick={() => handleTrade('buy')}
              className="bg-green-600 hover:bg-green-700"
            >
              Buy {assetData.symbol}
            </Button>
            <Button 
              onClick={() => handleTrade('sell')}
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-600/20"
            >
              Sell {assetData.symbol}
            </Button>
            <Button 
              onClick={handleAddToWatchlist}
              variant="outline"
            >
              Add to Watchlist
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3 bg-gray-800 mb-6">
                <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="chart" className="data-[state=active]:bg-purple-600">
                  Chart
                </TabsTrigger>
                <TabsTrigger value="news" className="data-[state=active]:bg-purple-600">
                  News
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <Card className="flint-card">
                  <CardHeader>
                    <CardTitle>Market Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {assetData.marketCap && (
                        <div>
                          <div className="text-sm text-gray-400">Market Cap</div>
                          <div className="text-lg font-semibold">{formatMarketCap(assetData.marketCap)}</div>
                        </div>
                      )}
                      {assetData.volume && (
                        <div>
                          <div className="text-sm text-gray-400">24h Volume</div>
                          <div className="text-lg font-semibold">{formatVolume(assetData.volume)}</div>
                        </div>
                      )}
                      {assetData.dayHigh && (
                        <div>
                          <div className="text-sm text-gray-400">Day High</div>
                          <div className="text-lg font-semibold">{formatPrice(assetData.dayHigh)}</div>
                        </div>
                      )}
                      {assetData.dayLow && (
                        <div>
                          <div className="text-sm text-gray-400">Day Low</div>
                          <div className="text-lg font-semibold">{formatPrice(assetData.dayLow)}</div>
                        </div>
                      )}
                      {assetData.yearHigh && (
                        <div>
                          <div className="text-sm text-gray-400">52W High</div>
                          <div className="text-lg font-semibold">{formatPrice(assetData.yearHigh)}</div>
                        </div>
                      )}
                      {assetData.yearLow && (
                        <div>
                          <div className="text-sm text-gray-400">52W Low</div>
                          <div className="text-lg font-semibold">{formatPrice(assetData.yearLow)}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chart">
                <Card className="flint-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Price Chart - {assetData.symbol}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-1">
                    <TradingViewChart 
                      symbol={assetData.symbol}
                      height={450}
                      theme="dark"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="news">
                <Card className="flint-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      Latest News
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {newsData.length > 0 ? (
                      <div className="space-y-4">
                        {newsData.slice(0, 5).map((news, index) => (
                          <div key={index} className="border-b border-gray-800 pb-4 last:border-b-0">
                            <h4 className="font-semibold mb-2 hover:text-purple-400 cursor-pointer">
                              {news.title}
                            </h4>
                            <p className="text-sm text-gray-400 mb-2">{news.summary}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{news.source}</span>
                              <span>{new Date(news.publishedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No recent news available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="flint-card">
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Price</span>
                  <span className="font-semibold">{formatPrice(assetData.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">24h Change</span>
                  <span className={assetData.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatChange(assetData.change, assetData.changePct)}
                  </span>
                </div>
                {assetData.marketCap && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Market Cap</span>
                    <span className="font-semibold">{formatMarketCap(assetData.marketCap)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Asset Type</span>
                  <Badge variant="outline" className="text-xs">
                    {assetData.type.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Trading Actions */}
            <Card className="flint-card">
              <CardHeader>
                <CardTitle>Trading Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => handleTrade('buy')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Buy {assetData.symbol}
                </Button>
                <Button 
                  onClick={() => handleTrade('sell')}
                  variant="outline"
                  className="w-full border-red-600 text-red-400 hover:bg-red-600/20"
                >
                  Sell {assetData.symbol}
                </Button>
                <Button 
                  onClick={handleAddToWatchlist}
                  variant="outline"
                  className="w-full"
                >
                  Add to Watchlist
                </Button>
              </CardContent>
            </Card>

            {/* Data Source */}
            <Card className="flint-card">
              <CardContent className="text-center py-4">
                <div className="text-xs text-gray-500">
                  <p className="mb-1">Real-time data from</p>
                  <p className="font-medium">
                    {assetData.type === 'crypto' ? 'CoinGecko API' : 'Polygon.io'}
                  </p>
                  <p className="mt-2">
                    Last updated: {new Date(assetData.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}