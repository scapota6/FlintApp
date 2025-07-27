import { TrendingUp, Wallet, Building2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { ChartPlaceholder } from '@/components/ui/chart-placeholder';

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

  // Sample chart data for micro-interactions
  const balanceChartData = [65, 68, 72, 70, 75, 78, 82, 79, 85, 88, 92, 90];
  const investmentChartData = [45, 52, 48, 61, 59, 67, 71, 68, 74, 78, 82, 85];
  const bankChartData = [30, 32, 35, 33, 36, 38, 41, 39, 42, 45, 48, 46];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Total Balance - Enhanced with Micro-interactions */}
      <div className="relative">
        <MetricCard
          title="Total Balance"
          value={totalBalance}
          change={change24h}
          changeType={isPositive ? 'positive' : 'negative'}
          icon={TrendingUp}
          iconColor="text-purple-400"
          prefix="$"
          className="relative overflow-hidden"
        />
        
        {/* Mini chart overlay */}
        <div className="absolute bottom-6 left-6 right-6 h-6 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
          <ChartPlaceholder 
            data={balanceChartData} 
            height={24} 
            color="#8e44ad"
            animated={true}
          />
        </div>
      </div>

      {/* Bank Balance - Enhanced */}
      <div className="relative">
        <MetricCard
          title="Bank Accounts"
          value={bankBalance}
          icon={Building2}
          iconColor="text-blue-400"
          prefix="$"
          showProgress={true}
          progressMax={totalBalance || 100000}
          className="relative overflow-hidden"
        />
        
        {/* Mini chart overlay */}
        <div className="absolute bottom-6 left-6 right-6 h-6 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
          <ChartPlaceholder 
            data={bankChartData} 
            height={24} 
            color="#3b82f6"
            animated={true}
          />
        </div>
      </div>

      {/* Investment Value - Enhanced */}
      <div className="relative">
        <MetricCard
          title="Investments"
          value={investmentValue}
          change={3.2}
          changeType="positive"
          icon={Wallet}
          iconColor="text-green-400"
          prefix="$"
          showProgress={true}
          progressMax={totalBalance || 100000}
          className="relative overflow-hidden"
        />
        
        {/* Mini chart overlay */}
        <div className="absolute bottom-6 left-6 right-6 h-6 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
          <ChartPlaceholder 
            data={investmentChartData} 
            height={24} 
            color="#22c55e"
            animated={true}
          />
        </div>
      </div>
    </div>
  );
}