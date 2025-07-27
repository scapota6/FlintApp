import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
// import { TradeModal } from '@/components/modals/trade-modal';

interface QuickActionsBarProps {
  className?: string;
}

export function QuickActionsBar({ className = '' }: QuickActionsBarProps) {
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeAction, setTradeAction] = useState<'BUY' | 'SELL'>('BUY');

  const handleQuickBuy = () => {
    setTradeAction('BUY');
    setShowTradeModal(true);
  };

  const handleQuickSell = () => {
    setTradeAction('SELL');
    setShowTradeModal(true);
  };

  const handleTransfer = () => {
    // TODO: Implement transfer modal
    console.log('Transfer funds clicked');
  };

  return (
    <>
      <div className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 ${className}`}>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleQuickBuy}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]
              hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] group"
          >
            <TrendingUp className="h-5 w-5 mr-2 group-hover:animate-pulse" />
            Quick Buy
          </Button>
          
          <Button
            onClick={handleQuickSell}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]
              hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] group"
          >
            <TrendingDown className="h-5 w-5 mr-2 group-hover:animate-pulse" />
            Quick Sell
          </Button>
          
          <Button
            onClick={handleTransfer}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]
              hover:shadow-[0_0_20px_rgba(142,68,173,0.4)] group"
          >
            <ArrowUpDown className="h-5 w-5 mr-2 group-hover:animate-pulse" />
            Transfer Funds
          </Button>
        </div>
      </div>

      {/* TODO: Add TradeModal when component is available */}
    </>
  );
}