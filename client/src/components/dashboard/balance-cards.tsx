import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Building, TrendingUp, ArrowUp } from "lucide-react";

interface BalanceCardsProps {
  data: any;
}

export default function BalanceCards({ data }: BalanceCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const cards = [
    {
      title: "Total Balance",
      amount: data?.totalBalance || 0,
      change: "+2.4%",
      changeAmount: "+$2,947.32",
      icon: Wallet,
      iconColor: "bg-blue-600",
      isPositive: true,
    },
    {
      title: "Bank Accounts",
      amount: data?.bankBalance || 0,
      change: "+1.2%",
      changeAmount: "+$547.19",
      icon: Building,
      iconColor: "bg-green-600",
      isPositive: true,
    },
    {
      title: "Investments",
      amount: data?.investmentBalance || 0,
      change: "+5.7%",
      changeAmount: "+$4,123.45",
      icon: TrendingUp,
      iconColor: "bg-purple-600",
      isPositive: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="balance-card shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${card.iconColor} rounded-full flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-400 text-sm font-medium">{card.title}</h3>
                    <p className="text-2xl font-semibold text-white">
                      {formatCurrency(card.amount)}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center space-x-1 text-sm ${
                  card.isPositive ? 'text-green-500' : 'text-red-500'
                }`}>
                  <ArrowUp className="h-4 w-4" />
                  <span>{card.change}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Since last month</span>
                <span className={card.isPositive ? 'text-green-500' : 'text-red-500'}>
                  {card.changeAmount}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
