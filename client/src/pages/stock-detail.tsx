import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  Plus, 
  Minus, 
  BarChart3, 
  Newspaper, 
  Activity,
  ArrowLeft,
  DollarSign,
  Volume2
} from 'lucide-react';
import MobileNav from '@/components/layout/mobile-nav';
import TradeModal from '@/components/modals/trade-modal';
import { Link } from 'wouter';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe: number;
  dividend: number;
  high52w: number;
  low52w: number;
  about: string;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
}

export default function StockDetail() {
  const [match, params] = useRoute('/stock/:symbol');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'buy' | 'sell'>('buy');
  const symbol = params?.symbol?.toUpperCase() || '';

  // Mock stock data - in real app, fetch from SnapTrade API
  const stockData: StockData = {
    symbol,
    name: symbol === 'AAPL' ? 'Apple Inc.' : 
          symbol === 'GOOGL' ? 'Alphabet Inc.' :
          symbol === 'MSFT' ? 'Microsoft Corporation' :
          symbol === 'TSLA' ? 'Tesla, Inc.' :
          symbol === 'NVDA' ? 'NVIDIA Corporation' :
          `${symbol} Corporation`,
    price: Math.random() * 500 + 50,
    change: (Math.random() - 0.5) * 10,
    changePercent: (Math.random() - 0.5) * 5,
    volume: Math.floor(Math.random() * 100000000),
    marketCap: Math.floor(Math.random() * 1000000000000),
    pe: Math.random() * 50 + 10,
    dividend: Math.random() * 5,
    high52w: Math.random() * 600 + 100,
    low52w: Math.random() * 200 + 20,
    about: `${symbol} is a leading technology company known for innovation and market leadership.`
  };

  // Mock news data
  const newsData: NewsItem[] = [
    {
      id: '1',
      title: `${symbol} Reports Strong Q4 Earnings`,
      summary: `${symbol} exceeded analyst expectations with strong revenue growth and positive outlook.`,
      source: 'Financial News',
      publishedAt: '2 hours ago',
      url: '#'
    },
    {
      id: '2', 
      title: `Analysts Upgrade ${symbol} Rating`,
      summary: `Multiple analysts have upgraded their price targets following recent developments.`,
      source: 'Market Watch',
      publishedAt: '4 hours ago',
      url: '#'
    },
    {
      id: '3',
      title: `${symbol} Announces New Product Launch`,
      summary: `The company unveiled innovative products that could drive future growth.`,
      source: 'Tech Today',
      publishedAt: '6 hours ago',
      url: '#'
    }
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const openTradeModal = (action: 'buy' | 'sell') => {
    setSelectedAction(action);
    setIsTradeModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-6xl mx-auto p-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/trading">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {stockData.symbol}
                <Button variant="ghost" size="sm">
                  <Star className="h-4 w-4" />
                </Button>
              </h1>
              <p className="text-gray-400">{stockData.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => openTradeModal('buy')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Buy
            </Button>
            <Button 
              onClick={() => openTradeModal('sell')}
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              <Minus className="h-4 w-4 mr-2" />
              Sell
            </Button>
          </div>
        </div>

        {/* Price & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-3xl font-bold mb-2">
                    {formatCurrency(stockData.price)}
                  </div>
                  <div className={`flex items-center gap-2 ${stockData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stockData.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span className="font-medium">
                      {stockData.change >= 0 ? '+' : ''}{stockData.change.toFixed(2)} 
                      ({stockData.changePercent >= 0 ? '+' : ''}{stockData.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <Badge variant={stockData.change >= 0 ? 'default' : 'destructive'}>
                  {stockData.change >= 0 ? 'Up' : 'Down'}
                </Badge>
              </div>
              
              {/* Simple Chart Placeholder */}
              <div className="bg-gray-800 rounded-lg p-4 h-48 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-600" />
                  <p className="text-gray-400">Chart placeholder</p>
                  <p className="text-sm text-gray-500">Real charts coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Key Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Market Cap</span>
                <span>{formatNumber(stockData.marketCap)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Volume</span>
                <span>{stockData.volume.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">P/E Ratio</span>
                <span>{stockData.pe.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dividend</span>
                <span>{stockData.dividend.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">52W High</span>
                <span>{formatCurrency(stockData.high52w)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">52W Low</span>
                <span>{formatCurrency(stockData.low52w)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for News and About */}
        <Tabs defaultValue="news" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800">
            <TabsTrigger value="news" className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              News
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="news" className="mt-6">
            <div className="space-y-4">
              {newsData.map((news) => (
                <Card key={news.id} className="bg-gray-900 border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white">{news.title}</h3>
                      <span className="text-sm text-gray-400">{news.publishedAt}</span>
                    </div>
                    <p className="text-gray-300 mb-2">{news.summary}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-400">{news.source}</span>
                      <Button variant="ghost" size="sm">
                        Read more
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="about" className="mt-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">About {stockData.name}</h3>
                <p className="text-gray-300 leading-relaxed">
                  {stockData.about}
                </p>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-800 rounded-lg">
                    <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-500" />
                    <div className="text-xl font-bold">{formatNumber(stockData.marketCap)}</div>
                    <div className="text-sm text-gray-400">Market Cap</div>
                  </div>
                  <div className="text-center p-4 bg-gray-800 rounded-lg">
                    <Volume2 className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                    <div className="text-xl font-bold">{formatNumber(stockData.volume)}</div>
                    <div className="text-sm text-gray-400">Volume</div>
                  </div>
                  <div className="text-center p-4 bg-gray-800 rounded-lg">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                    <div className="text-xl font-bold">{stockData.pe.toFixed(1)}</div>
                    <div className="text-sm text-gray-400">P/E Ratio</div>
                  </div>
                  <div className="text-center p-4 bg-gray-800 rounded-lg">
                    <Star className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                    <div className="text-xl font-bold">{stockData.dividend.toFixed(1)}%</div>
                    <div className="text-sm text-gray-400">Dividend</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <MobileNav />
      
      <TradeModal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        asset={{
          symbol: stockData.symbol,
          name: stockData.name,
          price: stockData.price,
          type: 'stock'
        }}

      />
    </div>
  );
}