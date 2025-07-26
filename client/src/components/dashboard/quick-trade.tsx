import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TradeModal } from "@/components/modals/trade-modal";

export default function QuickTrade() {
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const quickTrades = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 175.84,
      change: 2.3,
      color: "bg-blue-500",
      letter: "A",
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      price: 43267.89,
      change: -1.2,
      color: "bg-orange-500",
      letter: "₿",
    },
    {
      symbol: "TSLA",
      name: "Tesla Inc.",
      price: 248.42,
      change: 4.7,
      color: "bg-green-500",
      letter: "T",
    },
  ];

  const handleTradeClick = (asset: any) => {
    setSelectedAsset(asset);
    setIsModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <>
      <Card className="trade-card shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">Quick Trade</CardTitle>
            <Button variant="ghost" className="text-blue-500 text-sm font-medium">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quickTrades.map((trade) => (
              <div
                key={trade.symbol}
                className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${trade.color} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{trade.letter}</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{trade.symbol}</p>
                    <p className="text-gray-400 text-sm">{trade.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">{formatCurrency(trade.price)}</p>
                  <p className={`text-sm ${trade.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.change >= 0 ? '+' : ''}{trade.change}%
                  </p>
                </div>
                <Button
                  onClick={() => handleTradeClick(trade)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Buy
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        symbol={selectedAsset?.symbol || ""}
        currentPrice={selectedAsset?.price || 0}
      />
    </>
  );
}
