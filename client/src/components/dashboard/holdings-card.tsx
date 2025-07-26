
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, RefreshCw, ExternalLink } from "lucide-react";
import { SnapTradeAPI, SnapTradeHolding } from "@/lib/snaptrade-api";
import { useNavigate } from 'react-router-dom';

export function HoldingsCard() {
  const [holdings, setHoldings] = useState<SnapTradeHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      const holdingsData = await SnapTradeAPI.getAllHoldings();
      setHoldings(holdingsData);
    } catch (err: any) {
      console.error('Failed to load holdings:', err);
      setError("Failed to load holdings");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotalValue = () => {
    return holdings.reduce((total, holding) => total + holding.market_value, 0);
  };

  const calculateTotalPnL = () => {
    return holdings.reduce((total, holding) => {
      const costBasis = holding.quantity * (holding.price || 0);
      return total + (holding.market_value - costBasis);
    }, 0);
  };

  const totalValue = calculateTotalValue();
  const totalPnL = calculateTotalPnL();
  const totalPnLPercent = totalValue > 0 ? (totalPnL / (totalValue - totalPnL)) * 100 : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Holdings</CardTitle>
          <CardDescription>Your current positions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Holdings</CardTitle>
          <CardDescription>Your current positions</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={loadHoldings} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Holdings</CardTitle>
          <CardDescription>Your current positions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No holdings found</p>
            <Button onClick={() => navigate('/trading')} variant="outline">
              Start Trading
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Portfolio Holdings</CardTitle>
          <CardDescription>Your current positions</CardDescription>
        </div>
        <Button onClick={loadHoldings} variant="ghost" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Portfolio Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total P&L</p>
            <div className="flex items-center gap-2">
              {totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-lg font-semibold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} ({totalPnLPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Holdings List */}
        <div className="space-y-3">
          {holdings.map((holding) => {
            const costBasis = holding.quantity * (holding.price || 0);
            const pnl = holding.market_value - costBasis;
            const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
            const isPositive = pnl >= 0;

            return (
              <div
                key={`${holding.account_id}-${holding.symbol}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/stock/${holding.symbol}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg">{holding.symbol}</span>
                    <Badge variant="outline" className="text-xs">
                      {holding.quantity} shares
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{holding.name}</p>
                  <p className="text-sm text-gray-400">
                    Avg Cost: ${(holding.price || 0).toFixed(2)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold text-lg">
                    ${holding.market_value.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 justify-end">
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '+' : ''}${pnl.toFixed(2)}
                    </span>
                  </div>
                  <p className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    ({pnlPercent.toFixed(2)}%)
                  </p>
                </div>

                <ExternalLink className="h-4 w-4 ml-2 text-gray-400" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
