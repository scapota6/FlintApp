import React, { useState, useEffect } from 'react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Moon, Sun, BarChart3, TrendingUp } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  className?: string;
}

interface ChartConfig {
  interval: string;
  theme: 'light' | 'dark';
  chartType: string;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  height = 500,
  className = ''
}) => {
  const [config, setConfig] = useState<ChartConfig>({
    interval: 'D',
    theme: 'dark',
    chartType: '1'
  });

  const intervals = [
    { label: '1m', value: '1' },
    { label: '5m', value: '5' },
    { label: '15m', value: '15' },
    { label: '1h', value: '60' },
    { label: '4h', value: '240' },
    { label: '1D', value: 'D' },
    { label: '1W', value: 'W' },
    { label: '1M', value: 'M' }
  ];

  const chartTypes = [
    { label: 'Candles', value: '1' },
    { label: 'Bars', value: '0' },
    { label: 'Line', value: '2' },
    { label: 'Area', value: '3' }
  ];

  // Key for forcing re-render when symbol changes
  const chartKey = `${symbol}-${config.interval}-${config.theme}-${config.chartType}`;

  return (
    <div className={`trading-chart-container ${className}`}>
      {/* Chart Controls */}
      <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
        {/* Time Intervals */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Interval:</span>
          <Select value={config.interval} onValueChange={(value) => setConfig({...config, interval: value})}>
            <SelectTrigger className="w-20 h-8 bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              {intervals.map(interval => (
                <SelectItem key={interval.value} value={interval.value} className="text-white hover:bg-gray-700">
                  {interval.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chart Type */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Type:</span>
          <Select value={config.chartType} onValueChange={(value) => setConfig({...config, chartType: value})}>
            <SelectTrigger className="w-24 h-8 bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              {chartTypes.map(type => (
                <SelectItem key={type.value} value={type.value} className="text-white hover:bg-gray-700">
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfig({...config, theme: config.theme === 'dark' ? 'light' : 'dark'})}
          className="h-8 px-3 bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
        >
          {config.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Chart Indicator */}
        <div className="flex items-center gap-2 ml-auto">
          <BarChart3 className="h-4 w-4 text-green-500" />
          <span className="text-sm text-gray-400">Live Chart</span>
        </div>
      </div>

      {/* TradingView Chart */}
      <div className="chart-wrapper rounded-lg overflow-hidden bg-gray-900" style={{ height: `${height}px` }}>
        <AdvancedRealTimeChart
          key={chartKey}
          theme={config.theme}
          width="100%"
          height={height}
          symbol={symbol}
          interval={config.interval as any}
          timezone="Etc/UTC"
          style={config.chartType as any}
          locale="en"
          toolbar_bg={config.theme === 'dark' ? '#1f2937' : '#f1f3f6'}
          enable_publishing={false}
          allow_symbol_change={true}
          hide_top_toolbar={false}
          hide_legend={false}
          save_image={false}
          container_id={`tradingview_${symbol.replace(':', '_')}`}
          autosize={true}
          studies={[
            // Popular technical indicators
            'MASimple@tv-basicstudies', // Moving Average
            'RSI@tv-basicstudies',      // RSI
            'MACD@tv-basicstudies'      // MACD
          ]}
          show_popup_button={false}
          popup_width="1000"
          popup_height="650"
          hide_side_toolbar={false}
          details={true}
          hotlist={true}
          calendar={true}
          news={["headlines"]}
          range="6M"
        />
      </div>

      {/* Chart Info */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Powered by TradingView • Real-time data • Professional charting tools
      </div>
    </div>
  );
};

export default TradingViewChart;