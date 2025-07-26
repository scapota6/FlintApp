// Brokerage compatibility mapping based on SnapTrade supported brokerages
export interface BrokerageInfo {
  id: string;
  name: string;
  displayName: string;
  supportsStocks: boolean;
  supportsCrypto: boolean;
  supportsOptions: boolean;
  supportsETFs: boolean;
  cryptoExchanges?: string[]; // For crypto brokerages, which exchanges they use
  tickerFormat?: string; // How tickers are formatted (e.g., "NASDAQ:AAPL" vs "AAPL")
}

export const SUPPORTED_BROKERAGES: BrokerageInfo[] = [
  // Major US Stock Brokerages
  {
    id: 'robinhood',
    name: 'robinhood',
    displayName: 'Robinhood',
    supportsStocks: true,
    supportsCrypto: true,
    supportsOptions: true,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  {
    id: 'fidelity',
    name: 'fidelity',
    displayName: 'Fidelity',
    supportsStocks: true,
    supportsCrypto: false,
    supportsOptions: true,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  {
    id: 'schwab',
    name: 'schwab',
    displayName: 'Charles Schwab',
    supportsStocks: true,
    supportsCrypto: false,
    supportsOptions: true,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  {
    id: 'etrade',
    name: 'etrade',
    displayName: 'E*TRADE',
    supportsStocks: true,
    supportsCrypto: false,
    supportsOptions: true,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  {
    id: 'interactive_brokers',
    name: 'interactive_brokers',
    displayName: 'Interactive Brokers',
    supportsStocks: true,
    supportsCrypto: true,
    supportsOptions: true,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  {
    id: 'webull',
    name: 'webull',
    displayName: 'Webull',
    supportsStocks: true,
    supportsCrypto: true,
    supportsOptions: true,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  {
    id: 'alpaca',
    name: 'alpaca',
    displayName: 'Alpaca',
    supportsStocks: true,
    supportsCrypto: true,
    supportsOptions: false,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  
  // Crypto Exchanges
  {
    id: 'coinbase',
    name: 'coinbase',
    displayName: 'Coinbase',
    supportsStocks: false,
    supportsCrypto: true,
    supportsOptions: false,
    supportsETFs: false,
    cryptoExchanges: ['COINBASE'],
    tickerFormat: 'COINBASE:SYMBOL'
  },
  {
    id: 'binance_us',
    name: 'binance_us',
    displayName: 'Binance.US',
    supportsStocks: false,
    supportsCrypto: true,
    supportsOptions: false,
    supportsETFs: false,
    cryptoExchanges: ['BINANCE'],
    tickerFormat: 'BINANCE:SYMBOLUSDT'
  },
  {
    id: 'kraken',
    name: 'kraken',
    displayName: 'Kraken',
    supportsStocks: false,
    supportsCrypto: true,
    supportsOptions: false,
    supportsETFs: false,
    cryptoExchanges: ['KRAKEN'],
    tickerFormat: 'KRAKEN:SYMBOLUSD'
  },
  
  // International
  {
    id: 'questrade',
    name: 'questrade',
    displayName: 'Questrade',
    supportsStocks: true,
    supportsCrypto: false,
    supportsOptions: true,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  },
  {
    id: 'wealthsimple',
    name: 'wealthsimple',
    displayName: 'Wealthsimple',
    supportsStocks: true,
    supportsCrypto: true,
    supportsOptions: false,
    supportsETFs: true,
    tickerFormat: 'SYMBOL'
  }
];

export interface Asset {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto' | 'etf';
  exchange?: string;
  tradingViewSymbol?: string; // Custom TradingView format if different
}

export interface CompatibilityResult {
  asset: Asset;
  compatibleBrokerages: BrokerageInfo[];
  isCompatible: boolean;
}

export class BrokerageCompatibilityEngine {
  static getCompatibleBrokerages(asset: Asset, connectedBrokerages: string[]): BrokerageInfo[] {
    const availableBrokerages = SUPPORTED_BROKERAGES.filter(b => connectedBrokerages.includes(b.id));
    
    return availableBrokerages.filter(brokerage => {
      switch (asset.type) {
        case 'stock':
          return brokerage.supportsStocks;
        case 'crypto':
          return brokerage.supportsCrypto;
        case 'etf':
          return brokerage.supportsETFs;
        default:
          return false;
      }
    });
  }

  static checkAssetCompatibility(asset: Asset, connectedBrokerages: string[]): CompatibilityResult {
    const compatibleBrokerages = this.getCompatibleBrokerages(asset, connectedBrokerages);
    
    return {
      asset,
      compatibleBrokerages,
      isCompatible: compatibleBrokerages.length > 0
    };
  }

  static getTradingViewSymbol(asset: Asset, preferredBrokerage?: BrokerageInfo): string {
    // If custom TradingView symbol is specified, use it
    if (asset.tradingViewSymbol) {
      return asset.tradingViewSymbol;
    }

    // For stocks, use standard format
    if (asset.type === 'stock' || asset.type === 'etf') {
      // Determine exchange prefix based on common patterns
      const symbol = asset.symbol.toUpperCase();
      
      // Major tech stocks are usually NASDAQ
      const nasdaqStocks = ['AAPL', 'GOOGL', 'GOOG', 'MSFT', 'AMZN', 'META', 'NFLX', 'NVDA', 'AMD', 'INTC', 'ADBE'];
      if (nasdaqStocks.includes(symbol)) {
        return `NASDAQ:${symbol}`;
      }
      
      // Some specific NYSE stocks
      const nyseStocks = ['TSLA', 'TWTR', 'DIS', 'JPM', 'BAC', 'WMT', 'JNJ', 'PG', 'KO', 'XOM'];
      if (nyseStocks.includes(symbol)) {
        return `NYSE:${symbol}`;
      }
      
      // Default to NASDAQ for most stocks
      return `NASDAQ:${symbol}`;
    }

    // For crypto, use the most liquid exchange
    if (asset.type === 'crypto') {
      const symbol = asset.symbol.toUpperCase();
      
      // Major crypto pairs - use Binance as most liquid
      const majorCryptos = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'SHIB', 'AVAX', 'MATIC', 'LINK'];
      if (majorCryptos.includes(symbol)) {
        return `BINANCE:${symbol}USDT`;
      }
      
      // For less common cryptos, try different exchange formats
      return `BINANCE:${symbol}USDT`;
    }

    return asset.symbol;
  }

  static filterAssetsByCompatibility(assets: Asset[], connectedBrokerages: string[], showOnlyCompatible: boolean): Asset[] {
    if (!showOnlyCompatible || connectedBrokerages.length === 0) {
      return assets; // Research mode - show all assets
    }

    // Trading mode - show only compatible assets
    return assets.filter(asset => {
      const result = this.checkAssetCompatibility(asset, connectedBrokerages);
      return result.isCompatible;
    });
  }
}

// Extended asset database with compatibility info
export const EXTENDED_ASSETS: Asset[] = [
  // Major Stocks
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', tradingViewSymbol: 'NASDAQ:AAPL' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', tradingViewSymbol: 'NASDAQ:GOOGL' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', tradingViewSymbol: 'NASDAQ:MSFT' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', tradingViewSymbol: 'NASDAQ:AMZN' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', tradingViewSymbol: 'NASDAQ:TSLA' },
  { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock', tradingViewSymbol: 'NASDAQ:META' },
  { symbol: 'NFLX', name: 'Netflix Inc.', type: 'stock', tradingViewSymbol: 'NASDAQ:NFLX' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', tradingViewSymbol: 'NASDAQ:NVDA' },
  
  // Meme Stocks
  { symbol: 'GME', name: 'GameStop Corp.', type: 'stock', tradingViewSymbol: 'NYSE:GME' },
  { symbol: 'AMC', name: 'AMC Entertainment Holdings Inc.', type: 'stock', tradingViewSymbol: 'NYSE:AMC' },
  { symbol: 'BB', name: 'BlackBerry Limited', type: 'stock', tradingViewSymbol: 'NYSE:BB' },
  { symbol: 'NOK', name: 'Nokia Corporation', type: 'stock', tradingViewSymbol: 'NYSE:NOK' },
  
  // Major Crypto
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', tradingViewSymbol: 'BINANCE:BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto', tradingViewSymbol: 'BINANCE:ETHUSDT' },
  { symbol: 'BNB', name: 'Binance Coin', type: 'crypto', tradingViewSymbol: 'BINANCE:BNBUSDT' },
  { symbol: 'ADA', name: 'Cardano', type: 'crypto', tradingViewSymbol: 'BINANCE:ADAUSDT' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto', tradingViewSymbol: 'BINANCE:SOLUSDT' },
  { symbol: 'XRP', name: 'Ripple', type: 'crypto', tradingViewSymbol: 'BINANCE:XRPUSDT' },
  { symbol: 'DOT', name: 'Polkadot', type: 'crypto', tradingViewSymbol: 'BINANCE:DOTUSDT' },
  
  // Meme Coins
  { symbol: 'DOGE', name: 'Dogecoin', type: 'crypto', tradingViewSymbol: 'BINANCE:DOGEUSDT' },
  { symbol: 'SHIB', name: 'Shiba Inu', type: 'crypto', tradingViewSymbol: 'BINANCE:SHIBUSDT' },
  { symbol: 'PEPE', name: 'Pepe', type: 'crypto', tradingViewSymbol: 'BINANCE:PEPEUSDT' },
  
  // ETFs
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'etf', tradingViewSymbol: 'NASDAQ:SPY' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', tradingViewSymbol: 'NASDAQ:QQQ' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'etf', tradingViewSymbol: 'NASDAQ:VTI' }
];