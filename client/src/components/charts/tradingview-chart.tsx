import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  theme?: 'light' | 'dark';
}

export default function TradingViewChart({ 
  symbol, 
  height = 400, 
  theme = 'dark' 
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Clear existing content
    containerRef.current.innerHTML = '';
    
    // Create TradingView widget script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol.includes('-') ? `COINBASE:${symbol}` : `NASDAQ:${symbol}`,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: theme,
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      width: '100%',
      height: height,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
      gridColor: theme === 'dark' ? '#2a2a2a' : '#f0f0f0',
      studies: [
        'STD;SMA',
        'STD;MACD'
      ],
      container_id: `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`
    });
    
    // Create container div for TradingView widget
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = `${height}px`;
    widgetContainer.style.width = '100%';
    
    const widgetDiv = document.createElement('div');
    widgetDiv.id = `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = 'calc(100% - 32px)';
    widgetDiv.style.width = '100%';
    
    widgetContainer.appendChild(widgetDiv);
    widgetContainer.appendChild(script);
    
    containerRef.current.appendChild(widgetContainer);
    
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height, theme]);
  
  return (
    <div 
      ref={containerRef}
      className="w-full bg-gray-900 rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    />
  );
}