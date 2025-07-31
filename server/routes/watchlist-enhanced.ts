import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { insertWatchlistItemSchema } from "@shared/schema";

const router = Router();

// Enhanced watchlist endpoint with real-time market data
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const watchlistItems = await storage.getWatchlist(userId);
    
    // Enrich watchlist items with real-time market data
    const enrichedItems = await Promise.all(
      watchlistItems.map(async (item) => {
        try {
          let marketData = null;
          
          if (item.assetType === 'crypto') {
            // Fetch crypto data from CoinGecko API
            marketData = await fetchCryptoData(item.symbol);
          } else {
            // Fetch stock data from Polygon.io or other market data service
            marketData = await fetchStockData(item.symbol);
          }
          
          return {
            id: item.id,
            symbol: item.symbol,
            name: item.name || item.symbol,
            type: item.type,
            price: marketData?.price || 0,
            change: marketData?.change || 0,
            changePct: marketData?.changePct || 0,
            marketCap: marketData?.marketCap,
            volume: marketData?.volume,
            logo: marketData?.logo,
            chartData: marketData?.chartData || [],
            lastUpdated: new Date().toISOString()
          };
        } catch (error) {
          console.error(`Error fetching market data for ${item.symbol}:`, error);
          // Return item with fallback data
          return {
            id: item.id,
            symbol: item.symbol,
            name: item.name || item.symbol,
            type: item.type,
            price: 0,
            change: 0,
            changePct: 0,
            lastUpdated: new Date().toISOString()
          };
        }
      })
    );

    res.json(enrichedItems);
  } catch (error: any) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch watchlist' 
    });
  }
});

// Add to watchlist
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const validatedData = insertWatchlistItemSchema.parse({
      ...req.body,
      userId
    });

    // Check if already exists
    const existingItems = await storage.getWatchlist(userId);
    const exists = existingItems.some(item => 
      item.symbol.toLowerCase() === validatedData.symbol.toLowerCase()
    );
    
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Symbol already in watchlist'
      });
    }

    const watchlistItem = await storage.addToWatchlist(validatedData);
    res.json(watchlistItem);
  } catch (error: any) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to add to watchlist' 
    });
  }
});

// Remove from watchlist
router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const itemId = req.params.id;

    await storage.removeFromWatchlist(userId, itemId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to remove from watchlist' 
    });
  }
});

// Fetch stock data from Polygon.io or market data service
async function fetchStockData(symbol: string) {
  try {
    // Use existing market data service that already has Polygon.io integration
    const response = await fetch(`http://localhost:5000/api/quotes/${symbol}`);
    if (!response.ok) throw new Error('Market data unavailable');
    
    const data = await response.json();
    
    return {
      price: data.price || 0,
      change: data.change || 0,
      changePct: data.changePct || 0,
      volume: data.volume,
      marketCap: data.marketCap,
      logo: getStockLogo(symbol)
    };
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error);
    return null;
  }
}

// Fetch crypto data from CoinGecko API (free tier)
async function fetchCryptoData(symbol: string) {
  try {
    // Convert symbol format (BTC-USD -> bitcoin)
    const coinId = getCoinGeckoId(symbol);
    if (!coinId) throw new Error('Unsupported crypto symbol');
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );
    
    if (!response.ok) throw new Error('CoinGecko API error');
    
    const data = await response.json();
    const coinData = data[coinId];
    
    if (!coinData) throw new Error('Coin data not found');
    
    return {
      price: coinData.usd || 0,
      change: coinData.usd_24h_change || 0,
      changePct: coinData.usd_24h_change || 0,
      volume: coinData.usd_24h_vol,
      marketCap: coinData.usd_market_cap,
      logo: getCryptoLogo(symbol)
    };
  } catch (error) {
    console.error(`Error fetching crypto data for ${symbol}:`, error);
    return null;
  }
}

// Helper function to map crypto symbols to CoinGecko IDs
function getCoinGeckoId(symbol: string): string | null {
  const symbolMap: { [key: string]: string } = {
    'BTC-USD': 'bitcoin',
    'ETH-USD': 'ethereum',
    'ADA-USD': 'cardano',
    'SOL-USD': 'solana',
    'DOT-USD': 'polkadot',
    'LINK-USD': 'chainlink',
    'MATIC-USD': 'matic-network',
    'AVAX-USD': 'avalanche-2',
    'ATOM-USD': 'cosmos',
    'ALGO-USD': 'algorand'
  };
  
  return symbolMap[symbol] || null;
}

// Helper function to get stock logos (simplified)
function getStockLogo(symbol: string): string | undefined {
  const logoMap: { [key: string]: string } = {
    'AAPL': 'https://logo.clearbit.com/apple.com',
    'GOOGL': 'https://logo.clearbit.com/google.com',
    'MSFT': 'https://logo.clearbit.com/microsoft.com',
    'TSLA': 'https://logo.clearbit.com/tesla.com',
    'AMZN': 'https://logo.clearbit.com/amazon.com',
    'META': 'https://logo.clearbit.com/meta.com',
    'NVDA': 'https://logo.clearbit.com/nvidia.com'
  };
  
  return logoMap[symbol];
}

// Helper function to get crypto logos
function getCryptoLogo(symbol: string): string | undefined {
  const logoMap: { [key: string]: string } = {
    'BTC-USD': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    'ETH-USD': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    'ADA-USD': 'https://cryptologos.cc/logos/cardano-ada-logo.png',
    'SOL-USD': 'https://cryptologos.cc/logos/solana-sol-logo.png'
  };
  
  return logoMap[symbol];
}

export default router;