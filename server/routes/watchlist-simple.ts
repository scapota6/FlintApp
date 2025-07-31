import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";

const router = Router();

// Simple watchlist endpoint that returns mock data with real-time pricing
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Mock watchlist items with real-time pricing
    const mockWatchlist = [
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' },
      { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' },
      { symbol: 'BTC-USD', name: 'Bitcoin', type: 'crypto' },
      { symbol: 'ETH-USD', name: 'Ethereum', type: 'crypto' }
    ];

    // Enrich with real-time market data
    const enrichedItems = await Promise.all(
      mockWatchlist.map(async (item, index) => {
        try {
          let price = 0;
          let change = 0;
          let changePct = 0;
          
          if (item.type === 'crypto') {
            // Fetch crypto data from CoinGecko API
            const coinId = getCoinGeckoId(item.symbol);
            if (coinId) {
              try {
                const response = await fetch(
                  `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
                );
                
                if (response.ok) {
                  const data = await response.json();
                  const coinData = data[coinId];
                  if (coinData) {
                    price = coinData.usd || 0;
                    changePct = coinData.usd_24h_change || 0;
                    change = (price * changePct) / 100;
                  }
                }
              } catch (error) {
                console.error(`CoinGecko error for ${item.symbol}:`, error);
              }
            }
          } else {
            // Fetch stock data using internal quotes API
            try {
              const response = await fetch(`http://localhost:5000/api/quotes/${item.symbol}`);
              if (response.ok) {
                const data = await response.json();
                price = data.price || 0;
                change = data.change || 0;
                changePct = data.changePct || 0;
              }
            } catch (error) {
              console.error(`Stock data error for ${item.symbol}:`, error);
            }
          }
          
          return {
            id: `watchlist-${index}`,
            symbol: item.symbol,
            name: item.name,
            type: item.type,
            price: price,
            change: change,
            changePct: changePct,
            lastUpdated: new Date().toISOString()
          };
        } catch (error) {
          console.error(`Error fetching market data for ${item.symbol}:`, error);
          return {
            id: `watchlist-${index}`,
            symbol: item.symbol,
            name: item.name,
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

// Add to watchlist (mock implementation)
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const { symbol, name, type } = req.body;
    
    // Mock successful addition
    const newItem = {
      id: `watchlist-${Date.now()}`,
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      type: type || 'stock',
      price: 0,
      change: 0,
      changePct: 0,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(newItem);
  } catch (error: any) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to add to watchlist' 
    });
  }
});

// Remove from watchlist (mock implementation)
router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to remove from watchlist' 
    });
  }
});

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

export default router;