import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Star, StarOff } from "lucide-react";
import { MarketData } from "@/hooks/useMarketData";
import { StockIcon } from "@/components/ui/stock-icon";

interface WatchlistCardProps {
  symbol: string;
  marketData: MarketData | null;
  isInWatchlist?: boolean;
  onToggleWatchlist?: (symbol: string) => void;
  onTrade?: (symbol: string) => void;
  onClick?: (symbol: string) => void;
}

export function WatchlistCard({ 
  symbol, 
  marketData, 
  isInWatchlist = false,
  onToggleWatchlist,
  onTrade,
  onClick 
}: WatchlistCardProps) {
  const isPositive = (marketData?.changePct || 0) >= 0;
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (changePct: number) => {
    const sign = changePct >= 0 ? '+' : '';
    return `${sign}${changePct.toFixed(2)}%`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1000000000000) {
      return `$${(marketCap / 1000000000000).toFixed(1)}T`;
    } else if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(1)}B`;
    } else if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(1)}M`;
    }
    return `$${marketCap.toLocaleString()}`;
  };

  return (
    <Card 
      className="trade-card hover:scale-105 transition-all duration-200 cursor-pointer group"
      onClick={() => onClick?.(symbol)}
    >
      <CardContent className="p-4">
        {/* Header with logo and watchlist toggle */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <StockIcon symbol={symbol} className="w-8 h-8" />
            <div>
              <h3 className="font-semibold text-white text-lg">{symbol}</h3>
              <p className="text-sm text-gray-400 truncate max-w-[120px]">
                {marketData?.company_name || symbol}
              </p>
            </div>
          </div>
          
          {onToggleWatchlist && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist(symbol);
              }}
              className="text-gray-400 hover:text-yellow-400 transition-colors"
            >
              {isInWatchlist ? (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Price and change */}
        <div className="mb-4">
          {marketData ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">
                  {formatPrice(marketData.price)}
                </span>
                <div className={`flex items-center space-x-1 ${
                  isPositive ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {formatChange(marketData.changePct)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-16"></div>
            </div>
          )}
        </div>

        {/* Market stats */}
        {marketData && (
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div>
              <p className="text-gray-400">Volume</p>
              <p className="text-white font-medium">{formatVolume(marketData.volume)}</p>
            </div>
            <div>
              <p className="text-gray-400">Market Cap</p>
              <p className="text-white font-medium">{formatMarketCap(marketData.marketCap)}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {onTrade && (
          <div className="grid grid-cols-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onTrade(symbol);
              }}
            >
              Buy
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onTrade(symbol);
              }}
            >
              Sell
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}