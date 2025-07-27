import { ShoppingCart, TrendingDown, ArrowLeftRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface QuickActionsBarProps {
  onQuickBuy: () => void;
  onQuickSell: () => void;
  onTransferFunds: () => void;
}

export default function QuickActionsBar({ onQuickBuy, onQuickSell, onTransferFunds }: QuickActionsBarProps) {
  const { toast } = useToast();

  const handleQuickBuy = () => {
    toast({
      title: "Quick Buy",
      description: "Opening quick buy interface...",
    });
    onQuickBuy();
  };

  const handleQuickSell = () => {
    toast({
      title: "Quick Sell",
      description: "Opening quick sell interface...",
    });
    onQuickSell();
  };

  const handleTransferFunds = () => {
    toast({
      title: "Transfer Funds",
      description: "Opening transfer interface...",
    });
    onTransferFunds();
  };

  return (
    <div className="w-full bg-gradient-to-r from-gray-800/30 to-gray-700/30 border border-gray-700/50 rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Button
          onClick={handleQuickBuy}
          className="quick-action-btn quick-buy-btn flex-1 sm:flex-none min-w-[180px] h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-green-500/25"
          title="Buy stocks quickly"
        >
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5 quick-action-icon" />
            <span>Quick Buy</span>
            <Zap className="h-4 w-4 opacity-75" />
          </div>
        </Button>

        <Button
          onClick={handleQuickSell}
          className="quick-action-btn quick-sell-btn flex-1 sm:flex-none min-w-[180px] h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-red-500/25"
          title="Sell stocks quickly"
        >
          <div className="flex items-center space-x-2">
            <TrendingDown className="h-5 w-5 quick-action-icon" />
            <span>Quick Sell</span>
            <Zap className="h-4 w-4 opacity-75" />
          </div>
        </Button>

        <Button
          onClick={handleTransferFunds}
          className="quick-action-btn transfer-btn flex-1 sm:flex-none min-w-[180px] h-12 bg-[#8e44ad] hover:bg-[#7d3c98] text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          title="Transfer funds between accounts"
        >
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="h-5 w-5 quick-action-icon" />
            <span>Transfer Funds</span>
            <Zap className="h-4 w-4 opacity-75" />
          </div>
        </Button>
      </div>
    </div>
  );
}