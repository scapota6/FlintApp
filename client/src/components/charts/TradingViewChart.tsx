import React, { useEffect, useRef, useCallback } from 'react';

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  theme?: 'light' | 'dark';
  interval?: string;
  onBuyClick?: () => void;
  onSellClick?: () => void;
  onPriceUpdate?: (price: number) => void;
}

export function TradingViewChart({ 
  symbol, 
  height = 500, 
  theme = 'light',
  interval = '1D',
  onBuyClick,
  onSellClick,
  onPriceUpdate
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to extract price from TradingView widget
  const extractPriceFromWidget = useCallback(() => {
    try {
      // Look for TradingView price elements in the DOM
      const priceElements = document.querySelectorAll('[data-name="legend-source-item"] [class*="price"], [class*="valueValue"], .js-symbol-last');
      
      for (const element of priceElements) {
        const text = element.textContent || '';
        const priceMatch = text.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[0].replace(/,/g, ''));
          if (price > 0 && price < 10000) { // Reasonable stock price range
            onPriceUpdate?.(price);
            console.log(`Extracted TradingView price: $${price}`);
            return price;
          }
        }
      }

      // Alternative: Look for price in TradingView widget iframe
      const iframes = document.querySelectorAll('iframe[src*="tradingview"]');
      for (const iframe of iframes) {
        try {
          const iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
          if (iframeDoc) {
            const priceElements = iframeDoc.querySelectorAll('[class*="price"], [class*="last"]');
            for (const element of priceElements) {
              const text = element.textContent || '';
              const priceMatch = text.match(/[\d,]+\.?\d*/);
              if (priceMatch) {
                const price = parseFloat(priceMatch[0].replace(/,/g, ''));
                if (price > 0 && price < 10000) {
                  onPriceUpdate?.(price);
                  console.log(`Extracted TradingView iframe price: $${price}`);
                  return price;
                }
              }
            }
          }
        } catch (e) {
          // Cross-origin iframe access blocked, this is expected
        }
      }

      // Fallback: Use TradingView's global object if available
      if (typeof window !== 'undefined' && (window as any).TradingView) {
        const tv = (window as any).TradingView;
        if (tv.activeChart && tv.activeChart.chart) {
          const lastPrice = tv.activeChart.chart().getVisibleRange()?.to;
          if (lastPrice && typeof lastPrice === 'number') {
            onPriceUpdate?.(lastPrice);
            console.log(`Extracted TradingView API price: $${lastPrice}`);
            return lastPrice;
          }
        }
      }

    } catch (error) {
      console.log('TradingView price extraction not available:', error);
    }
    return null;
  }, [onPriceUpdate]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear existing content
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;

    const widgetId = `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

    script.textContent = JSON.stringify({
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
      support_host: 'https://www.tradingview.com',
      container_id: widgetId
    });

    const container = document.createElement('div');
    container.id = widgetId;
    container.style.width = '100%';
    container.style.height = `${height}px`;
    
    containerRef.current.appendChild(container);
    container.appendChild(script);

    // Start price extraction after widget loads
    const startPriceExtraction = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Start extracting price every 5 seconds
      intervalRef.current = setInterval(() => {
        extractPriceFromWidget();
      }, 5000);

      // Try initial extraction after 3 seconds
      setTimeout(extractPriceFromWidget, 3000);
    };

    // Start extraction after script loads
    script.onload = startPriceExtraction;
    
    // Fallback: start extraction after 5 seconds even if onload doesn't fire
    setTimeout(startPriceExtraction, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height, theme, interval, extractPriceFromWidget]);

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