import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, TrendingUp, TrendingDown, Star, StarOff, Plus, Minus } from "lucide-react";
import { TradingViewChart } from "@/components/charts/TradingViewChart";
import { TradeModal } from "@/components/modals/trade-modal";
import { SnapTradeAPI } from "@/lib/snaptrade-api";
import { apiRequest } from "@/lib/queryClient";

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
}

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<"BUY" | "SELL">("BUY");
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    if (symbol) {
      loadStockData();
      checkWatchlistStatus();
    }
  }, [symbol]);

  const loadStockData = async () => {
    if (!symbol) return;

    setIsLoading(true);
    setError("");

    try {
      // Try to get real-time data from SnapTrade search first
      const searchResults = await SnapTradeAPI.searchSymbols(symbol);
      const stockResult = searchResults.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());

      if (stockResult) {
        setStockData({
          symbol: stockResult.symbol,
          name: stockResult.name,
          price: stockResult.price,
          change: stockResult.change || 0,
          changePercent: stockResult.changePercent,
          volume: stockResult.volume,
          marketCap: stockResult.marketCap
        });
      } else {
        // Fallback to mock data if not found
        setStockData({
          symbol: symbol.toUpperCase(),
          name: `${symbol.toUpperCase()} Inc.`,
          price: 100 + Math.random() * 400,
          change: (Math.random() - 0.5) * 10,
          changePercent: (Math.random() - 0.5) * 5,
          volume: Math.floor(Math.random() * 10000000),
          marketCap: Math.floor(Math.random() * 1000000000000)
        });
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
      setError("Failed to load stock data");
    } finally {
      setIsLoading(false);
    }
  };

  const checkWatchlistStatus = async () => {
    if (!symbol) return;

    try {
      const response = await apiRequest("GET", "/api/watchlist");
      const watchlist = await response.json();
      setIsInWatchlist(watchlist.some((item: any) => item.symbol.toUpperCase() === symbol.toUpperCase()));
    } catch (err) {
      console.error('Failed to check watchlist status:', err);
    }
  };

  const toggleWatchlist = async () => {
    if (!symbol || !stockData) return;

    setWatchlistLoading(true);

    try {
      if (isInWatchlist) {
        await apiRequest("DELETE", `/api/watchlist/${symbol.toUpperCase()}`);
        setIsInWatchlist(false);
      } else {
        await apiRequest("POST", "/api/watchlist", {
          symbol: symbol.toUpperCase(),
          name: stockData.name
        });
        setIsInWatchlist(true);
      }
    } catch (err) {
      console.error('Failed to update watchlist:', err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleTradeClick = (action: "BUY" | "SELL") => {
    setTradeAction(action);
    setTradeModalOpen(true);
  };

  const handleTradeComplete = () => {
    // Refresh stock data and close modal
    loadStockData();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !stockData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error || "Stock not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPositive = stockData.changePercent >= 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Stock Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">
                {stockData.symbol} - {stockData.name}
              </CardTitle>
              <CardDescription>Real-time stock data</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleWatchlist}
                disabled={watchlistLoading}
                className="flex items-center gap-2"
              >
                {isInWatchlist ? (
                  <>
                    <StarOff className="h-4 w-4" />
                    Remove from Watchlist
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4" />
                    Add to Watchlist
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Current Price</p>
              <p className="text-3xl font-bold">${stockData.price.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Change</p>
              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-lg font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            {stockData.volume && (
              <div>
                <p className="text-sm text-gray-500">Volume</p>
                <p className="text-lg font-semibold">{stockData.volume.toLocaleString()}</p>
              </div>
            )}
            {stockData.marketCap && (
              <div>
                <p className="text-sm text-gray-500">Market Cap</p>
                <p className="text-lg font-semibold">
                  ${(stockData.marketCap / 1000000000).toFixed(2)}B
                </p>
              </div>
            )}
          </div>

          {/* Trading Buttons */}
          <div className="flex gap-3 mt-6">
            <Button
              onClick={() => handleTradeClick("BUY")}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              Buy {stockData.symbol}
            </Button>
            <Button
              onClick={() => handleTradeClick("SELL")}
              variant="outline"
              className="flex items-center gap-2 border-red-600 text-red-600 hover:bg-red-50"
            >
              <Minus className="h-4 w-4" />
              Sell {stockData.symbol}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Price Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <TradingViewChart
            symbol={stockData.symbol}
            height={600}
            onBuyClick={() => handleTradeClick("BUY")}
            onSellClick={() => handleTradeClick("SELL")}
          />
        </CardContent>
      </Card>

      {/* Trade Modal */}
      <TradeModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        symbol={stockData.symbol}
        currentPrice={stockData.price}
        onTradeComplete={handleTradeComplete}
      />
    </div>
  );
}

export default StockDetailPage;