import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, ArrowUpDown, DollarSign, CreditCard } from 'lucide-react';
import { TransferModal } from '@/components/modals/transfer-modal';
import { DepositModal } from '@/components/modals/deposit-modal';

interface QuickActionsBarProps {
  className?: string;
  accounts?: any[];
}

export function QuickActionsBar({ className = '', accounts = [] }: QuickActionsBarProps) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const handleQuickBuy = () => {
    // Redirect to trading page with buy action
    window.location.href = '/trading?action=buy';
  };

  const handleQuickSell = () => {
    // Redirect to trading page with sell action  
    window.location.href = '/trading?action=sell';
  };

  const handleTransfer = () => {
    setShowTransferModal(true);
  };

  const handleDeposit = () => {
    setShowDepositModal(true);
  };

  return (
    <>
      <div className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 ${className}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            onClick={handleQuickBuy}
            className="bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]
              hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] group"
          >
            <TrendingUp className="h-5 w-5 mr-2 group-hover:animate-pulse" />
            Quick Buy
          </Button>
          
          <Button
            onClick={handleQuickSell}
            className="bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]
              hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] group"
          >
            <TrendingDown className="h-5 w-5 mr-2 group-hover:animate-pulse" />
            Quick Sell
          </Button>
          
          <Button
            onClick={handleDeposit}
            className="bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]
              hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] group"
          >
            <DollarSign className="h-5 w-5 mr-2 group-hover:animate-pulse" />
            Deposit
          </Button>
          
          <Button
            onClick={handleTransfer}
            className="bg-purple-600 hover:bg-purple-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]
              hover:shadow-[0_0_20px_rgba(142,68,173,0.4)] group"
          >
            <ArrowUpDown className="h-5 w-5 mr-2 group-hover:animate-pulse" />
            Transfer
          </Button>
        </div>
      </div>

      {/* Transfer Modal */}
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        accounts={accounts}
      />

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        accounts={accounts}
      />
    </>
  );
}