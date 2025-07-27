import React from "react";
import { Building2, TrendingUp, Zap, Users, Cpu, Car, ShoppingCart, Smartphone } from "lucide-react";

interface StockIconProps {
  symbol: string;
  className?: string;
}

export function StockIcon({ symbol, className = "w-6 h-6" }: StockIconProps) {
  const getIconForSymbol = (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    
    // Map common stock symbols to appropriate icons
    switch (upperSymbol) {
      case 'AAPL':
        return <Smartphone className={`${className} text-gray-300`} />;
      case 'GOOGL':
      case 'GOOG':
        return <Users className={`${className} text-blue-400`} />;
      case 'MSFT':
        return <Cpu className={`${className} text-blue-500`} />;
      case 'TSLA':
        return <Car className={`${className} text-red-500`} />;
      case 'AMZN':
        return <ShoppingCart className={`${className} text-orange-400`} />;
      case 'NVDA':
        return <Zap className={`${className} text-green-500`} />;
      case 'META':
        return <Users className={`${className} text-blue-600`} />;
      default:
        return <TrendingUp className={`${className} text-purple-400`} />;
    }
  };

  return (
    <div className="flex items-center justify-center w-8 h-8 bg-gray-800 rounded-full">
      {getIconForSymbol(symbol)}
    </div>
  );
}