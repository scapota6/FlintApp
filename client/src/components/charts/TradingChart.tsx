/**
 * TradingView Lightweight Charts Component
 * Real-time chart with multiple timeframes and WebSocket support
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CrosshairMode, Time, CandlestickData, HistogramData } from 'lightweight-charts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { marketCache } from '@/lib/market-cache';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface TradingChartProps {
  symbol: string;
  height?: number;
  showVolume?: boolean;
  onPriceUpdate?: (price: number) => void;
}

const TIMEFRAMES = [
  { label: '1D', value: '1D', interval: 86400 },
  { label: '1W', value: '1W', interval: 604800 },
  { label: '1M', value: '1M', interval: 2592000 },
  { label: '3M', value: '3M', interval: 7776000 },
  { label: '6M', value: '6M', interval: 15552000 },
  { label: '1Y', value: '1Y', interval: 31536000 },
  { label: '5Y', value: '5Y', interval: 157680000 }
];

export default function TradingChart({ 
  symbol, 
  height = 400, 
  showVolume = true,
  onPriceUpdate 
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [isLoading, setIsLoading] = useState(false);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volumeSeries = showVolume ? chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    }) : null;

    if (volumeSeries) {
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height, showVolume]);

  // Fetch candle data
  const fetchCandles = useCallback(async () => {
    if (!candleSeriesRef.current) return;
    
    setIsLoading(true);
    
    try {
      // Check cache first
      let candles = await marketCache.getCachedCandles(symbol, selectedTimeframe);
      
      if (!candles) {
        // Fetch from server
        const response = await fetch(
          `/api/market/candles?symbol=${symbol}&tf=${selectedTimeframe}&limit=500`,
          {
            credentials: 'include'
          }
        );
        
        if (!response.ok) throw new Error('Failed to fetch candles');
        
        const data = await response.json();
        candles = data.candles;
        
        // Cache the data
        if (candles && candles.length > 0) {
          await marketCache.setCachedCandles(symbol, selectedTimeframe, candles);
        }
      }
      
      // Update chart
      if (candles && candles.length > 0) {
        // Convert time to Time type
        const chartData = candles.map((c: any) => ({
          ...c,
          time: c.time as Time
        }));
        candleSeriesRef.current.setData(chartData);
        
        if (volumeSeriesRef.current && showVolume) {
          const volumeData = candles.map((c: any) => ({
            time: c.time as Time,
            value: c.volume,
            color: c.close >= c.open ? '#26a69a' : '#ef5350'
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
        
        // Update latest price
        const lastCandle = candles[candles.length - 1];
        setLatestPrice(lastCandle.close);
        
        // Calculate price change
        const firstCandle = candles[0];
        const change = lastCandle.close - firstCandle.open;
        const changePercent = (change / firstCandle.open) * 100;
        setPriceChange(change);
        setPriceChangePercent(changePercent);
        
        if (onPriceUpdate) {
          onPriceUpdate(lastCandle.close);
        }
        
        // Fit content
        chartRef.current?.timeScale().fitContent();
      }
    } catch (error) {
      console.error('Error fetching candles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, selectedTimeframe, showVolume, onPriceUpdate]);

  // Fetch quote and update real-time
  const fetchQuote = useCallback(async () => {
    try {
      // Check cache first
      let quote = await marketCache.getCachedQuote(symbol);
      
      if (!quote) {
        const response = await fetch(`/api/market/quote?symbol=${symbol}`, {
          credentials: 'include'
        });
        
        if (!response.ok) return;
        
        quote = await response.json();
        await marketCache.setCachedQuote(symbol, quote);
      }
      
      if (quote && candleSeriesRef.current) {
        const now = Math.floor(Date.now() / 1000);
        
        // Update the latest candle with fallback values
        const updateData = {
          time: now as any,
          open: quote.price, // Use current price as fallback
          high: quote.price,
          low: quote.price,
          close: quote.price
        };
        
        try {
          candleSeriesRef.current.update(updateData);
        } catch (err) {
          console.warn('Chart update failed:', err);
        }
        
        setLatestPrice(quote.price);
        setPriceChange(quote.change || 0);
        setPriceChangePercent(quote.changePercent || 0);
        
        if (onPriceUpdate) {
          onPriceUpdate(quote.price);
        }
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
    }
  }, [symbol, onPriceUpdate]);

  // Setup WebSocket or polling
  useEffect(() => {
    // Try WebSocket first (if available)
    const setupWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/market`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('Market WebSocket connected');
          // Subscribe to symbol
          ws.send(JSON.stringify({ 
            action: 'subscribe', 
            symbols: [symbol] 
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.symbol === symbol && data.price) {
              // Update real-time price
              if (candleSeriesRef.current) {
                const time = Math.floor(Date.now() / 1000);
                candleSeriesRef.current.update({
                  time: time as any,
                  close: data.price
                });
              }
              
              setLatestPrice(data.price);
              if (onPriceUpdate) {
                onPriceUpdate(data.price);
              }
            }
          } catch (err) {
            console.error('WebSocket message error:', err);
          }
        };
        
        ws.onerror = () => {
          console.log('WebSocket error, falling back to polling');
          // Fall back to polling
          setupPolling();
        };
        
        ws.onclose = () => {
          console.log('WebSocket closed');
        };
        
        wsRef.current = ws;
      } catch (error) {
        console.log('WebSocket not available, using polling');
        setupPolling();
      }
    };
    
    // Fallback polling mechanism
    const setupPolling = () => {
      // Poll every 15 seconds
      pollingIntervalRef.current = setInterval(fetchQuote, 15000);
    };
    
    // Initial data fetch
    fetchCandles();
    fetchQuote();
    
    // Setup real-time updates
    setupWebSocket();
    
    return () => {
      // Cleanup WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Cleanup polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [symbol, selectedTimeframe, fetchCandles, fetchQuote]);

  // Handle timeframe change
  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
  };

  return (
    <Card className="border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">{symbol}</h3>
            {latestPrice && (
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">
                  ${latestPrice.toFixed(2)}
                </span>
                <span className={`flex items-center text-sm ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {Math.abs(priceChange).toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={selectedTimeframe} onValueChange={handleTimeframeChange}>
              <TabsList className="grid grid-cols-7 h-8">
                {TIMEFRAMES.map(tf => (
                  <TabsTrigger key={tf.value} value={tf.value} className="text-xs px-2">
                    {tf.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCandles}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={chartContainerRef} className="w-full" />
      </CardContent>
    </Card>
  );
}