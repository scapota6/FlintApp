import React, { useEffect, useRef } from 'react';
import { RealTimeAPI, type LiveQuote } from '@/lib/real-time-api';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewChartProps {
  symbol: string;
  theme?: 'light' | 'dark';
  width?: string | number;
  height?: string | number;
  interval?: string;
  hideTopToolbar?: boolean;
  hideSideToolbar?: boolean;
  style?: string;
  onQuoteUpdate?: (quote: LiveQuote | null) => void;
}

export function TradingViewChart({
  symbol,
  theme = 'dark',
  width = '100%',
  height = 400,
  interval = '1D',
  hideTopToolbar = false,
  hideSideToolbar = false,
  style = '1',
  onQuoteUpdate
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    // Load TradingView script if not already loaded
    if (!document.getElementById('tradingview-script')) {
      const script = document.createElement('script');
      script.id = 'tradingview-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => initializeWidget();
      document.head.appendChild(script);
    } else if (window.TradingView) {
      initializeWidget();
    }

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (e) {
          console.warn('Error removing TradingView widget:', e);
        }
      }
    };
  }, [symbol]);

  // Fetch real-time quote and sync with chart
  useEffect(() => {
    if (!onQuoteUpdate) return;

    const fetchQuote = async () => {
      try {
        const quote = await RealTimeAPI.getQuote(symbol);
        onQuoteUpdate(quote);
      } catch (error) {
        console.error('Error fetching quote:', error);
        onQuoteUpdate(null);
      }
    };

    // Initial fetch
    fetchQuote();

    // Set up interval for real-time updates
    const interval = setInterval(fetchQuote, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [symbol, onQuoteUpdate]);

  const initializeWidget = () => {
    if (!window.TradingView || !containerRef.current) return;

    // Clear existing widget
    if (widgetRef.current) {
      try {
        widgetRef.current.remove();
      } catch (e) {
        console.warn('Error removing existing widget:', e);
      }
    }

    // Validate symbol before creating widget
    if (!symbol || symbol.length === 0) {
      console.warn('Invalid symbol provided to TradingView chart');
      return;
    }

    try {
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: symbol.toUpperCase(),
        interval: interval,
        container_id: containerRef.current.id,
        theme: theme,
        style: style, // 1 = Line, 2 = Area, 3 = Columns, etc.
        locale: 'en',
        toolbar_bg: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        enable_publishing: false,
        hide_top_toolbar: hideTopToolbar,
        hide_side_toolbar: hideSideToolbar,
        allow_symbol_change: false,
        watchlist: [],
        details: false,
        hotlist: false,
        calendar: false,
        studies: [],
        disabled_features: [
          'use_localstorage_for_settings',
          'header_symbol_search',
          'symbol_search_hot_key'
        ],
        enabled_features: [
          'hide_left_toolbar_by_default'
        ],
        loading_screen: {
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
          foregroundColor: theme === 'dark' ? '#ffffff' : '#000000'
        },
        overrides: {
          'paneProperties.background': theme === 'dark' ? '#1e1e1e' : '#ffffff',
          'paneProperties.vertGridProperties.color': theme === 'dark' ? '#2a2a2a' : '#e0e0e0',
          'paneProperties.horzGridProperties.color': theme === 'dark' ? '#2a2a2a' : '#e0e0e0',
          'symbolWatermarkProperties.transparency': 90,
          'scalesProperties.textColor': theme === 'dark' ? '#ffffff' : '#000000'
        }
      });
    } catch (error) {
      console.error('Error initializing TradingView widget:', error);
    }
  };

  return (
    <div className="tradingview-chart-container">
      <div
        ref={containerRef}
        id={`tradingview_${symbol}_${Date.now()}`}
        style={{ width, height }}
        className="rounded-lg overflow-hidden"
      />
    </div>
  );
}