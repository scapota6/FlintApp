import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface RealTimeChartProps {
  symbol: string;
  price: number;
  change: number;
  height?: number;
  className?: string;
}

export function RealTimeChart({ symbol, price, change, height = 200, className = "" }: RealTimeChartProps) {
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState(price);

  // Simulate real-time price updates
  useEffect(() => {
    const initialHistory = Array.from({ length: 20 }, (_, i) => 
      price + (Math.random() - 0.5) * price * 0.02
    );
    setPriceHistory(initialHistory);

    const interval = setInterval(() => {
      const variation = (Math.random() - 0.5) * price * 0.005;
      const newPrice = Math.max(price + variation, 0);
      setCurrentPrice(newPrice);
      
      setPriceHistory(prev => [...prev.slice(1), newPrice]);
    }, 3000);

    return () => clearInterval(interval);
  }, [price, symbol]);

  const generatePath = () => {
    if (priceHistory.length < 2) return "";
    
    const min = Math.min(...priceHistory);
    const max = Math.max(...priceHistory);
    const range = max - min || 1;
    const width = 300;
    const chartHeight = height - 40;
    
    return priceHistory
      .map((price, index) => {
        const x = (index / (priceHistory.length - 1)) * width;
        const y = ((max - price) / range) * chartHeight + 20;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const chartColor = change >= 0 ? '#22c55e' : '#ef4444';
  const gradientId = `gradient-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className={`bg-gray-900 rounded-lg p-4 ${className}`} style={{ height }}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-medium">{symbol}</span>
        <div className="text-right">
          <div className="text-white font-semibold">${currentPrice.toFixed(2)}</div>
          <div className={`text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        </div>
      </div>
      
      <svg width="100%" height={height - 60} viewBox={`0 0 300 ${height - 40}`} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: chartColor, stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: chartColor, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        
        {/* Chart area */}
        <motion.path
          d={`${generatePath()} L 300 ${height - 20} L 0 ${height - 20} Z`}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        
        {/* Chart line */}
        <motion.path
          d={generatePath()}
          stroke={chartColor}
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
        
        {/* Animated price dot */}
        {priceHistory.length > 0 && (
          <motion.circle
            cx={300}
            cy={((Math.max(...priceHistory) - currentPrice) / (Math.max(...priceHistory) - Math.min(...priceHistory) || 1)) * (height - 40) + 20}
            r="3"
            fill={chartColor}
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </svg>
    </div>
  );
}