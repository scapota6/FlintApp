import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface WatchlistCardProps {
  data: any[];
}

export default function WatchlistCard({ data }: WatchlistCardProps) {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatPercent = (percent: string | number) => {
    const num = typeof percent === 'string' ? parseFloat(percent) : percent;
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getColorFromSymbol = (symbol: string) => {
    const colors = {
      'AAPL': 'bg-blue-500',
      'TSLA': 'bg-green-500',
      'BTC': 'bg-orange-500',
      'ETH': 'bg-purple-500',
      'NFLX': 'bg-red-500',
      'GOOGL': 'bg-yellow-500',
    };
    return colors[symbol as keyof typeof colors] || 'bg-gray-500';
  };

  // Show default items if no data
  const displayItems = data?.length > 0 ? data : [
    { symbol: 'TSLA', name: 'Tesla, Inc.', currentPrice: '248.42', changePercent: '4.7' },
    { symbol: 'ETH', name: 'Ethereum', currentPrice: '2847.32', changePercent: '-0.8' },
    { symbol: 'NFLX', name: 'Netflix, Inc.', currentPrice: '367.45', changePercent: '1.9' },
  ];

  return (
    <Card className="trade-card shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">Watchlist</CardTitle>
          <Button variant="ghost" className="text-blue-500 text-sm font-medium">
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayItems.map((item) => (
            <div
              key={item.symbol}
              className="watchlist-item flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${getColorFromSymbol(item.symbol)} rounded-full flex items-center justify-center`}>
                  <span className="text-white text-sm font-bold">
                    {item.symbol === 'BTC' ? '₿' : item.symbol === 'ETH' ? 'E' : item.symbol[0]}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{item.symbol}</p>
                  <p className="text-gray-400 text-sm">{item.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">{formatCurrency(item.currentPrice)}</p>
                <p className={`text-sm ${parseFloat(item.changePercent) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(item.changePercent)}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {data?.length === 0 && (
          <div className="text-center py-8">
            <Star className="h-8 w-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400">No items in your watchlist</p>
            <Button variant="outline" className="mt-2" size="sm">
              Add Symbols
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
