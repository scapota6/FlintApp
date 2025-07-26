import React, { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  theme?: 'light' | 'dark';
  interval?: string;
  onBuyClick?: () => void;
  onSellClick?: () => void;
}

export function TradingViewChart({ 
  symbol, 
  height = 500, 
  theme = 'light',
  interval = '1D',
  onBuyClick,
  onSellClick 
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear existing content
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;

    script.innerHTML = JSON.stringify({
      autosize: false,
      width: '100%',
      height: height,
      symbol: symbol.toUpperCase(),
      interval: interval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#2b2b43',
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      details: true,
      hotlist: true,
      calendar: false,
      studies: [
        'Volume@tv-basicstudies',
        'MACD@tv-basicstudies'
      ],
      background_color: '#1e1e1e',
      gridlines_color: '#2b2b43',
      support_host: 'https://www.tradingview.com'
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height, theme, interval]);

  return (
    <div className="relative">
      <div 
        ref={containerRef} 
        className="tradingview-widget-container"
        style={{ height: `${height}px` }}
      />

      {/* Trading buttons overlay */}
      {(onBuyClick || onSellClick) && (
        <div className="absolute top-4 right-4 flex gap-2">
          {onBuyClick && (
            <button
              onClick={onBuyClick}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg"
            >
              Buy
            </button>
          )}
          {onSellClick && (
            <button
              onClick={onSellClick}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
            >
              Sell
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TradingViewChart;