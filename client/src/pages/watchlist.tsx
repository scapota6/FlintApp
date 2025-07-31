import { useState } from 'react';
import SimpleWatchlist from '@/components/watchlist/simple-watchlist';
import RealTimeHoldings from '@/components/portfolio/real-time-holdings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Eye, DollarSign } from 'lucide-react';

export default function WatchlistPage() {
  const [selectedTab, setSelectedTab] = useState('watchlist');

  const handleStockClick = (symbol: string, name: string) => {
    // Navigate to stock detail or open trading modal
    console.log('Stock clicked:', symbol, name);
    // Could open a stock detail modal or navigate to trading page
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Real-Time Market Data</h1>
          <p className="text-gray-400">Live prices from Polygon.io & CoinGecko APIs</p>
        </div>

        {/* Tabs for Watchlist and Holdings */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800 mb-6">
            <TabsTrigger 
              value="watchlist" 
              className="flex items-center space-x-2 data-[state=active]:bg-purple-600"
            >
              <Eye className="h-4 w-4" />
              <span>Watchlist</span>
            </TabsTrigger>
            <TabsTrigger 
              value="holdings" 
              className="flex items-center space-x-2 data-[state=active]:bg-purple-600"
            >
              <DollarSign className="h-4 w-4" />
              <span>Portfolio</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Watchlist */}
              <div className="lg:col-span-2">
                <SimpleWatchlist />
              </div>
              
              {/* Market Info Sidebar */}
              <div className="space-y-6">
                <Card className="flint-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Market Status</span>
                      <Badge variant="secondary" className="bg-green-600/20 text-green-400">
                        Open
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Data Source</span>
                      <span className="text-white">Polygon.io</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Update Frequency</span>
                      <span className="text-white">Every 10s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Crypto Data</span>
                      <span className="text-white">CoinGecko</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flint-card">
                  <CardHeader>
                    <CardTitle>Popular Symbols</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
                        { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' },
                        { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' },
                        { symbol: 'BTC-USD', name: 'Bitcoin', type: 'crypto' },
                        { symbol: 'ETH-USD', name: 'Ethereum', type: 'crypto' }
                      ].map((item) => (
                        <div 
                          key={item.symbol} 
                          className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => handleStockClick(item.symbol, item.name)}
                        >
                          <div>
                            <div className="font-medium text-white">{item.symbol}</div>
                            <div className="text-sm text-gray-400">{item.name}</div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={item.type === 'crypto' ? 'text-orange-400 border-orange-400' : 'text-purple-400 border-purple-400'}
                          >
                            {item.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="holdings">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Holdings */}
              <div className="lg:col-span-2">
                <RealTimeHoldings 
                  showAccountProvider={true}
                  onHoldingClick={handleStockClick}
                />
              </div>
              
              {/* Portfolio Info Sidebar */}
              <div className="space-y-6">
                <Card className="flint-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Portfolio Stats</span>
                      <TrendingUp className="h-5 w-5 text-green-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Data Source</span>
                      <span className="text-white">SnapTrade</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Price Updates</span>
                      <span className="text-white">Every 15s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Position Sync</span>
                      <span className="text-white">Real-time</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flint-card">
                  <CardHeader>
                    <CardTitle>Account Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { type: 'Individual', count: '1', icon: '👤' },
                        { type: 'IRA', count: '0', icon: '🏦' },
                        { type: 'Joint', count: '0', icon: '👥' },
                        { type: 'Trust', count: '0', icon: '🏛️' }
                      ].map((item) => (
                        <div 
                          key={item.type} 
                          className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-white">{item.type}</span>
                          </div>
                          <Badge variant="outline" className="text-gray-400">
                            {item.count} accounts
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}