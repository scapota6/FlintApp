import { Router } from "express";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Get detailed asset information
router.get("/:symbol", isAuthenticated, async (req: any, res) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();
    
    let assetData = null;
    
    // Determine if it's crypto or stock
    const isCrypto = upperSymbol.includes('-USD') || 
                     ['BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'LINK', 'MATIC', 'AVAX', 'ATOM', 'ALGO'].includes(upperSymbol);
    
    if (isCrypto) {
      // Fetch crypto data from CoinGecko
      assetData = await fetchCryptoDetail(upperSymbol);
    } else {
      // Fetch stock data from Polygon.io
      assetData = await fetchStockDetail(upperSymbol);
    }
    
    if (!assetData) {
      return res.status(404).json({ 
        success: false, 
        message: 'Asset not found' 
      });
    }
    
    res.json(assetData);
  } catch (error: any) {
    console.error('Error fetching asset detail:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch asset detail' 
    });
  }
});

// Get asset news
router.get("/:symbol/news", isAuthenticated, async (req: any, res) => {
  try {
    const { symbol } = req.params;
    const upperSymbol = symbol.toUpperCase();
    
    // Mock news data for now - could integrate with real news APIs
    const mockNews = [
      {
        title: `${upperSymbol} Reaches New Price Levels Amid Market Volatility`,
        summary: `Recent trading activity shows ${upperSymbol} experiencing significant price movements as investors react to market conditions.`,
        url: `#`,
        publishedAt: new Date().toISOString(),
        source: 'Financial News'
      },
      {
        title: `Market Analysis: ${upperSymbol} Technical Indicators`,
        summary: `Technical analysis suggests key support and resistance levels for ${upperSymbol} in the current market environment.`,
        url: `#`,
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        source: 'Market Analytics'
      },
      {
        title: `Institutional Interest in ${upperSymbol} Continues to Grow`,
        summary: `Major institutional investors show continued interest in ${upperSymbol} as part of portfolio diversification strategies.`,
        url: `#`,
        publishedAt: new Date(Date.now() - 7200000).toISOString(),
        source: 'Investment Report'
      }
    ];
    
    res.json(mockNews);
  } catch (error: any) {
    console.error('Error fetching asset news:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch asset news' 
    });
  }
});

// Fetch crypto details from CoinGecko
async function fetchCryptoDetail(symbol: string) {
  try {
    const coinId = getCoinGeckoId(symbol);
    if (!coinId) return null;
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      symbol: symbol,
      name: data.name,
      price: data.market_data?.current_price?.usd || 0,
      change: data.market_data?.price_change_24h || 0,
      changePct: data.market_data?.price_change_percentage_24h || 0,
      marketCap: data.market_data?.market_cap?.usd,
      volume: data.market_data?.total_volume?.usd,
      dayHigh: data.market_data?.high_24h?.usd,
      dayLow: data.market_data?.low_24h?.usd,
      yearHigh: data.market_data?.ath?.usd,
      yearLow: data.market_data?.atl?.usd,
      type: 'crypto' as const,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching crypto detail for ${symbol}:`, error);
    return null;
  }
}

// Fetch stock details from internal quotes API
async function fetchStockDetail(symbol: string) {
  try {
    // Use internal quotes API for basic price data
    const response = await fetch(`http://localhost:5000/api/quotes/${symbol}`);
    
    if (!response.ok) return null;
    
    const quoteData = await response.json();
    
    // Get additional market data from Polygon.io if available
    let additionalData = {};
    try {
      // This would be replaced with actual Polygon.io API call for detailed market data
      additionalData = {
        marketCap: getEstimatedMarketCap(symbol, quoteData.price),
        volume: Math.floor(Math.random() * 10000000) + 1000000, // Mock volume
        dayHigh: quoteData.price * (1 + Math.random() * 0.05),
        dayLow: quoteData.price * (1 - Math.random() * 0.05),
        yearHigh: quoteData.price * (1 + Math.random() * 0.5 + 0.1),
        yearLow: quoteData.price * (1 - Math.random() * 0.3)
      };
    } catch (error) {
      console.error('Error fetching additional market data:', error);
    }
    
    return {
      symbol: symbol,
      name: getCompanyName(symbol),
      price: quoteData.price || 0,
      change: quoteData.change || 0,
      changePct: quoteData.changePct || 0,
      ...additionalData,
      type: 'stock' as const,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching stock detail for ${symbol}:`, error);
    return null;
  }
}

// Helper function to map crypto symbols to CoinGecko IDs
function getCoinGeckoId(symbol: string): string | null {
  const symbolMap: { [key: string]: string } = {
    'BTC-USD': 'bitcoin',
    'BTC': 'bitcoin',
    'ETH-USD': 'ethereum',
    'ETH': 'ethereum',
    'ADA-USD': 'cardano',
    'ADA': 'cardano',
    'SOL-USD': 'solana',
    'SOL': 'solana',
    'DOT-USD': 'polkadot',
    'DOT': 'polkadot',
    'LINK-USD': 'chainlink',
    'LINK': 'chainlink',
    'MATIC-USD': 'matic-network',
    'MATIC': 'matic-network',
    'AVAX-USD': 'avalanche-2',
    'AVAX': 'avalanche-2',
    'ATOM-USD': 'cosmos',
    'ATOM': 'cosmos',
    'ALGO-USD': 'algorand',
    'ALGO': 'algorand'
  };
  
  return symbolMap[symbol] || null;
}

// Helper function to get company names
function getCompanyName(symbol: string): string {
  const nameMap: { [key: string]: string } = {
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet Inc.',
    'TSLA': 'Tesla Inc.',
    'MSFT': 'Microsoft Corporation',
    'AMZN': 'Amazon.com Inc.',
    'META': 'Meta Platforms Inc.',
    'NVDA': 'NVIDIA Corporation',
    'NFLX': 'Netflix Inc.',
    'AMD': 'Advanced Micro Devices Inc.',
    'INTC': 'Intel Corporation'
  };
  
  return nameMap[symbol] || `${symbol} Corporation`;
}

// Helper function to estimate market cap
function getEstimatedMarketCap(symbol: string, price: number): number {
  const shareEstimates: { [key: string]: number } = {
    'AAPL': 15.33e9,    // 15.33 billion shares
    'GOOGL': 12.69e9,   // 12.69 billion shares
    'TSLA': 3.17e9,     // 3.17 billion shares
    'MSFT': 7.43e9,     // 7.43 billion shares
    'AMZN': 10.47e9,    // 10.47 billion shares
    'META': 2.54e9,     // 2.54 billion shares
    'NVDA': 24.6e9,     // 24.6 billion shares
  };
  
  const shares = shareEstimates[symbol] || 1e9; // Default 1 billion shares
  return Math.floor(price * shares);
}

export default router;