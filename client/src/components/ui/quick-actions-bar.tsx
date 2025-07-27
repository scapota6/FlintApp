import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";

interface QuickActionsBarProps {
  onQuickBuy?: () => void;
  onQuickSell?: () => void;
  onTransferFunds?: () => void;
}

export function QuickActionsBar({ onQuickBuy, onQuickSell, onTransferFunds }: QuickActionsBarProps) {
  return (
    <Card className="flint-card mb-8">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={onQuickBuy}
            className="h-12 bg-green-600 hover:bg-green-700 text-white font-medium
              rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 
              transform hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <TrendingUp className="h-5 w-5" />
            Quick Buy
          </Button>
          
          <Button
            onClick={onQuickSell}
            className="h-12 bg-red-600 hover:bg-red-700 text-white font-medium
              rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 
              transform hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <TrendingDown className="h-5 w-5" />
            Quick Sell
          </Button>
          
          <Button
            onClick={onTransferFunds}
            className="h-12 bg-purple-600 hover:bg-purple-700 text-white font-medium
              rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 
              transform hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Funds
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}