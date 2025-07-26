import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, TrendingUp, Bitcoin, DollarSign } from "lucide-react";

interface AccountCardProps {
  id: number;
  name: string;
  provider: string;
  type: string;
  balance: string | number;
  currency?: string;
  institutionName?: string;
}

export default function AccountCard({ 
  id, 
  name, 
  provider, 
  type, 
  balance, 
  currency = "USD",
  institutionName 
}: AccountCardProps) {
  const getIcon = () => {
    if (type === 'bank') return <Building className="w-5 h-5" />;
    if (type === 'crypto') return <Bitcoin className="w-5 h-5" />;
    if (type === 'investment' || type === 'brokerage') return <TrendingUp className="w-5 h-5" />;
    return <DollarSign className="w-5 h-5" />;
  };
  
  const getProviderBadge = () => {
    const providerMap: Record<string, { label: string; color: string }> = {
      snaptrade: { label: "SnapTrade", color: "bg-purple-500/20 text-purple-300" },
      teller: { label: "Teller", color: "bg-blue-500/20 text-blue-300" },
      crypto: { label: "Crypto", color: "bg-orange-500/20 text-orange-300" },
    };
    
    const config = providerMap[provider] || { label: provider, color: "bg-gray-500/20 text-gray-300" };
    
    return (
      <Badge variant="secondary" className={`${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };
  
  const formatBalance = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };
  
  const isAlpacaPaper = institutionName?.toLowerCase().includes('alpaca') && 
                        institutionName?.toLowerCase().includes('paper');
  
  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-800 rounded-lg">
              {getIcon()}
            </div>
            <div>
              <CardTitle className="text-lg font-medium">{name}</CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                {institutionName || type.charAt(0).toUpperCase() + type.slice(1)}
              </p>
            </div>
          </div>
          {getProviderBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-semibold">
              {formatBalance(balance)}
            </p>
            <p className="text-sm text-gray-400 mt-1">Available Balance</p>
          </div>
          {isAlpacaPaper && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              Paper Trading
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}