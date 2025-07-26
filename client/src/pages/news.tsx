import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, Clock, ExternalLink, Filter } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  category: string;
  symbols?: string[];
  imageUrl?: string;
}

const mockNews: NewsArticle[] = [
  {
    id: '1',
    title: 'Federal Reserve Signals Potential Rate Cut in Q2 2025',
    summary: 'The Federal Reserve hints at monetary policy changes amid economic indicators showing...',
    source: 'Reuters',
    publishedAt: '2025-07-26T14:30:00Z',
    url: '#',
    sentiment: 'positive',
    category: 'Federal Reserve',
    symbols: ['SPY', 'QQQ'],
    imageUrl: '/api/placeholder/400/200'
  },
  {
    id: '2',
    title: 'Tech Stocks Rally on AI Infrastructure Spending',
    summary: 'Major technology companies report increased investments in artificial intelligence infrastructure...',
    source: 'Bloomberg',
    publishedAt: '2025-07-26T13:15:00Z',
    url: '#',
    sentiment: 'positive',
    category: 'Technology',
    symbols: ['AAPL', 'GOOGL', 'MSFT'],
  },
  {
    id: '3',
    title: 'Bitcoin Surges Past $45,000 Amid Institutional Adoption',
    summary: 'Cryptocurrency markets see significant gains as more institutions announce Bitcoin adoption...',
    source: 'CoinDesk',
    publishedAt: '2025-07-26T12:45:00Z',
    url: '#',
    sentiment: 'positive',
    category: 'Cryptocurrency',
    symbols: ['BTC'],
  },
  {
    id: '4',
    title: 'Energy Sector Faces Headwinds Despite Oil Price Stability',
    summary: 'Traditional energy companies report mixed earnings as renewable transition accelerates...',
    source: 'Wall Street Journal',
    publishedAt: '2025-07-26T11:30:00Z',
    url: '#',
    sentiment: 'negative',
    category: 'Energy',
    symbols: ['XOM', 'CVX'],
  },
  {
    id: '5',
    title: 'Healthcare Innovation Drives Biotech Sector Growth',
    summary: 'Breakthrough treatments and FDA approvals boost biotech stock valuations across the board...',
    source: 'MarketWatch',
    publishedAt: '2025-07-26T10:15:00Z',
    url: '#',
    sentiment: 'positive',
    category: 'Healthcare',
    symbols: ['JNJ', 'PFE', 'MRNA'],
  }
];

export default function News() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSentiment, setSelectedSentiment] = useState('all');

  // In a real app, this would fetch from your news API
  const { data: articles = mockNews, isLoading } = useQuery<NewsArticle[]>({
    queryKey: ['/api/news', selectedCategory, selectedSentiment, searchQuery],
    queryFn: () => Promise.resolve(mockNews), // Replace with actual API call
  });

  const categories = ['all', 'Technology', 'Cryptocurrency', 'Energy', 'Healthcare', 'Federal Reserve'];
  const sentiments = ['all', 'positive', 'negative', 'neutral'];

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    const matchesSentiment = selectedSentiment === 'all' || article.sentiment === selectedSentiment;
    return matchesSearch && matchesCategory && matchesSentiment;
  });

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-600';
      case 'negative': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const publishedAt = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded w-1/3"></div>
            <div className="grid grid-cols-1 gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-800 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Market News</h1>
        </div>

        {/* Search and Filters */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search news articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Sentiment:</span>
                  <select
                    value={selectedSentiment}
                    onChange={(e) => setSelectedSentiment(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white text-sm"
                  >
                    {sentiments.map(sentiment => (
                      <option key={sentiment} value={sentiment}>
                        {sentiment === 'all' ? 'All Sentiments' : sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* News Articles */}
        <div className="grid grid-cols-1 gap-6">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {article.imageUrl && (
                    <div className="flex-shrink-0 w-24 h-24 bg-gray-800 rounded-lg overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600"></div>
                    </div>
                  )}
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-xl font-semibold text-white leading-tight hover:text-blue-400 transition-colors">
                        {article.title}
                      </h2>
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white flex-shrink-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-gray-300 line-clamp-2">{article.summary}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Clock className="h-4 w-4" />
                        {formatTimeAgo(article.publishedAt)}
                      </div>
                      
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-400">{article.source}</span>
                      
                      <Badge className={`${getSentimentColor(article.sentiment)} text-white`}>
                        {article.sentiment}
                      </Badge>
                      
                      <Badge variant="outline" className="border-gray-600 text-gray-300">
                        {article.category}
                      </Badge>
                      
                      {article.symbols && article.symbols.length > 0 && (
                        <div className="flex gap-1">
                          {article.symbols.slice(0, 3).map(symbol => (
                            <Badge key={symbol} variant="secondary" className="bg-blue-600/20 text-blue-400 text-xs">
                              {symbol}
                            </Badge>
                          ))}
                          {article.symbols.length > 3 && (
                            <Badge variant="secondary" className="bg-gray-600/20 text-gray-400 text-xs">
                              +{article.symbols.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No articles found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}