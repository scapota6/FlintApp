import { TrendingUp, Wallet, Building2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SummaryCardsProps {
  totalBalance: number;
  bankBalance: number;
  investmentValue: number;
  change24h?: number;
}

export default function SummaryCards({ 
  totalBalance, 
  bankBalance, 
  investmentValue, 
  change24h = 2.4 
}: SummaryCardsProps) {
  const isPositive = change24h >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Total Balance */}
      <Card className="flint-card flint-card-accent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Total Balance</CardTitle>
          <TrendingUp className="h-4 w-4 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            ${totalBalance.toLocaleString()}
          </div>
          <div className={`flex items-center text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            )}
            {isPositive ? '+' : ''}{change24h}% (24h)
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts */}
      <Card className="flint-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Bank Accounts</CardTitle>
          <Building2 className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            ${bankBalance.toLocaleString()}
          </div>
          <p className="text-xs text-gray-400">
            Available cash
          </p>
        </CardContent>
      </Card>

      {/* Investments */}
      <Card className="flint-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Investments</CardTitle>
          <Wallet className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            ${investmentValue.toLocaleString()}
          </div>
          <p className="text-xs text-gray-400">
            Portfolio value
          </p>
        </CardContent>
      </Card>
    </div>
  );
}