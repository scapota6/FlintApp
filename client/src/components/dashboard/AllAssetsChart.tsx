import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface AllAssetsChartProps {
  totalValue: number;
  changePercent: number;
  marketCap?: number;
}

export function AllAssetsChart({ totalValue, changePercent, marketCap }: AllAssetsChartProps) {
  const isPositive = changePercent >= 0;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatLargeNumber = (value: number) => {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(1)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    }
    return formatCurrency(value);
  };

  // Generate sparkline points for demo
  const sparklinePoints = React.useMemo(() => {
    const points = [];
    const baseValue = 100;
    for (let i = 0; i < 30; i++) {
      const variation = (Math.sin(i * 0.2) + Math.random() * 0.4) * 10;
      const value = baseValue + variation + (isPositive ? i * 0.5 : -i * 0.3);
      points.push(Math.max(80, value));
    }
    return points;
  }, [isPositive]);

  const maxPoint = Math.max(...sparklinePoints);
  const minPoint = Math.min(...sparklinePoints);
  const range = maxPoint - minPoint;

  return (
    <Card className="trade-card col-span-full lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-purple-400" />
            <span>All Assets Summary</span>
          </CardTitle>
          <div className={`flex items-center space-x-1 text-sm ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Portfolio Value */}
          <div>
            <div className="text-3xl font-bold text-white mb-1">
              {formatCurrency(totalValue)}
            </div>
            <div className="text-sm text-gray-400">
              Total Portfolio Value
            </div>
          </div>

          {/* Sparkline Chart */}
          <div className="relative h-16 bg-gray-800 rounded-lg p-2">
            <svg width="100%" height="100%" className="overflow-visible">
              <defs>
                <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.1" />
                </linearGradient>
              </defs>
              
              {/* Area under the curve */}
              <path
                d={`M 0,${60 - ((sparklinePoints[0] - minPoint) / range) * 40} ${sparklinePoints
                  .map((point, index) => 
                    `L ${(index / (sparklinePoints.length - 1)) * 100},${60 - ((point - minPoint) / range) * 40}`
                  )
                  .join(' ')} L 100,60 L 0,60 Z`}
                fill="url(#sparklineGradient)"
                vectorEffect="non-scaling-stroke"
                transform="scale(3.5, 1)"
              />
              
              {/* Line */}
              <path
                d={`M 0,${60 - ((sparklinePoints[0] - minPoint) / range) * 40} ${sparklinePoints
                  .map((point, index) => 
                    `L ${(index / (sparklinePoints.length - 1)) * 100},${60 - ((point - minPoint) / range) * 40}`
                  )
                  .join(' ')}`}
                stroke={isPositive ? "#10b981" : "#ef4444"}
                strokeWidth="1.5"
                fill="none"
                vectorEffect="non-scaling-stroke"
                transform="scale(3.5, 1)"
              />
              
              {/* Animated dot at the end */}
              <circle
                cx={((sparklinePoints.length - 1) / (sparklinePoints.length - 1)) * 350}
                cy={60 - ((sparklinePoints[sparklinePoints.length - 1] - minPoint) / range) * 40}
                r="3"
                fill={isPositive ? "#10b981" : "#ef4444"}
                className="animate-pulse"
              />
            </svg>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Today's Change</div>
              <div className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalValue * (changePercent / 100))}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Market Cap</div>
              <div className="text-white font-medium">
                {marketCap ? formatLargeNumber(marketCap) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Performance indicator */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>1D</span>
            <span>1W</span>
            <span>1M</span>
            <span className="text-purple-400 font-medium">3M</span>
            <span>6M</span>
            <span>1Y</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}