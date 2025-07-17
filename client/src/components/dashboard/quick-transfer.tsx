import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, TrendingUp } from "lucide-react";
import { useState } from "react";
import TransferModal from "@/components/modals/transfer-modal";

interface QuickTransferProps {
  accounts: any[];
}

export default function QuickTransfer({ accounts }: QuickTransferProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Default transfer options if no accounts
  const transferOptions = accounts?.length > 0 ? accounts.slice(0, 2).map(account => ({
    from: account.accountName,
    to: 'Savings',
    available: account.balance,
    icon: account.accountType === 'bank' ? Building : TrendingUp,
    iconColor: account.accountType === 'bank' ? 'bg-blue-500' : 'bg-purple-500',
  })) : [
    {
      from: 'Chase',
      to: 'Savings',
      available: '12,847.32',
      icon: Building,
      iconColor: 'bg-blue-500',
    },
    {
      from: 'Savings',
      to: 'Robinhood',
      available: '32,779.87',
      icon: TrendingUp,
      iconColor: 'bg-purple-500',
    },
  ];

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <>
      <Card className="trade-card shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">Quick Transfer</CardTitle>
            <Button variant="ghost" className="text-blue-500 text-sm font-medium">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transferOptions.map((option, index) => {
              const Icon = option.icon;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 ${option.iconColor} rounded-full flex items-center justify-center`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{option.from} → {option.to}</p>
                      <p className="text-gray-400 text-sm">
                        Available: {formatCurrency(option.available)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Transfer
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <TransferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
      />
    </>
  );
}
