import { usePolygonConnection, usePolygonQuote } from "@/hooks/usePolygonMarketData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, CheckCircle, XCircle } from "lucide-react";

export function PolygonMarketDataTest() {
  const connectionQuery = usePolygonConnection();
  const appleQuery = usePolygonQuote("AAPL");
  const teslaQuery = usePolygonQuote("TSLA");
  const googleQuery = usePolygonQuote("GOOGL");

  const renderQuoteCard = (query: any, symbol: string, companyName: string) => {
    if (query.isLoading) {
      return (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">{symbol}</CardTitle>
            <CardDescription className="text-gray-400">{companyName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse">
              <div className="h-8 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-24"></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (query.error) {
      return (
        <Card className="bg-gray-900 border-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">{symbol}</CardTitle>
            <CardDescription className="text-red-400">Error loading data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-red-400 text-sm">
              {query.error?.message || 'Failed to load'}
            </div>
          </CardContent>
        </Card>
      );
    }

    const quote = query.data;
    if (!quote) return null;

    const isPositive = quote.change >= 0;
    const changeColor = isPositive ? "text-green-400" : "text-red-400";
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;

    return (
      <Card className="bg-gray-900 border-gray-700 hover:border-purple-500 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-white text-lg">{symbol}</CardTitle>
              <CardDescription className="text-gray-400">{companyName}</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {quote.source}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-white">
              ${quote.price.toFixed(2)}
            </div>
            <div className={`flex items-center space-x-1 ${changeColor}`}>
              <TrendIcon className="w-4 h-4" />
              <span className="font-medium">
                {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
              </span>
            </div>
            <div className="text-gray-400 text-sm">
              Volume: {quote.volume.toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Polygon.io API Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectionQuery.isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
              <span className="text-gray-400">Testing connection...</span>
            </div>
          ) : connectionQuery.error ? (
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">Connection failed</span>
            </div>
          ) : (connectionQuery.data as any)?.success ? (
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400">{(connectionQuery.data as any).message}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">API unavailable</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Market Data */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Live Market Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderQuoteCard(appleQuery, "AAPL", "Apple Inc.")}
          {renderQuoteCard(teslaQuery, "TSLA", "Tesla, Inc.")}
          {renderQuoteCard(googleQuery, "GOOGL", "Alphabet Inc.")}
        </div>
      </div>
    </div>
  );
}