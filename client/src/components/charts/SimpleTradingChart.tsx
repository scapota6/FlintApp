/**
 * Simple Trading Chart - Fallback for when TradingChart fails
 * Basic price display without complex charting
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface SimpleTradingChartProps {
  symbol: string;
  height?: number;
  onPriceUpdate?: (price: number) => void;
}

export default function SimpleTradingChart({ 
  symbol, 
  height = 400,
  onPriceUpdate 
}: SimpleTradingChartProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);
  const [changePercent, setChangePercent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQuote = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/market/quote?symbol=${symbol}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const quote = await response.json();
        setPrice(quote.price);
        setChange(quote.change || 0);
        setChangePercent(quote.changePercent || 0);
        
        if (onPriceUpdate) {
          onPriceUpdate(quote.price);
        }
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuote();
    const interval = setInterval(fetchQuote, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [symbol]);

  const isPositive = change >= 0;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-lg font-semibold">{symbol}</h3>
        <RefreshCw 
          className={`h-4 w-4 cursor-pointer ${isLoading ? 'animate-spin' : ''}`}
          onClick={fetchQuote}
        />
      </CardHeader>
      <CardContent>
        <div 
          className="flex items-center justify-center flex-col space-y-4"
          style={{ height: height - 80 }}
        >
          {price !== null ? (
            <>
              <div className="text-center">
                <div className="text-4xl font-bold font-mono">
                  ${price.toFixed(2)}
                </div>
                <div className={`flex items-center justify-center mt-2 text-lg ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="h-5 w-5 mr-2" />
                  ) : (
                    <TrendingDown className="h-5 w-5 mr-2" />
                  )}
                  <span className="font-mono">
                    {isPositive ? '+' : ''}${change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                <p>Real-time price for {symbol}</p>
                <p className="text-xs mt-1">Updates every 5 seconds</p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading price data...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}