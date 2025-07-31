import { Router } from 'express';

const router = Router();

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Search for assets (stocks via Polygon, crypto via CoinGecko)
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q: query, type = 'all' } = req.query;
    
    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.json({ results: [] });
    }

    const results: any[] = [];

    // Search stocks via Polygon.io
    if (type === 'all' || type === 'stock') {
      if (process.env.POLYGON_API_KEY) {
        try {
          const polygonUrl = `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=10&apiKey=${process.env.POLYGON_API_KEY}`;
          const polygonResponse = await fetch(polygonUrl);
          
          if (polygonResponse.ok) {
            const polygonData = await polygonResponse.json();
            const tickers = polygonData.results || [];
            
            tickers.forEach((ticker: any) => {
              results.push({
                symbol: ticker.ticker,
                name: ticker.name,
                type: 'stock',
                exchange: ticker.primary_exchange,
                currency: ticker.currency_name || 'USD',
              });
            });
          }
        } catch (error) {
          console.error('Polygon search error:', error);
        }
      }
    }

    // Search crypto via CoinGecko
    if (type === 'all' || type === 'crypto') {
      try {
        const coinGeckoUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
        const coinGeckoResponse = await fetch(coinGeckoUrl);
        
        if (coinGeckoResponse.ok) {
          const coinGeckoData = await coinGeckoResponse.json();
          const coins = coinGeckoData.coins || [];
          
          // Limit to top 10 crypto results
          coins.slice(0, 10).forEach((coin: any) => {
            results.push({
              symbol: coin.symbol.toUpperCase(),
              name: coin.name,
              type: 'crypto',
              exchange: 'CoinGecko',
              currency: 'USD',
              coinGeckoId: coin.id,
            });
          });
        }
      } catch (error) {
        console.error('CoinGecko search error:', error);
      }
    }

    // If no external APIs available, search SnapTrade
    if (results.length === 0 && process.env.SNAPTRADE_CLIENT_ID) {
      try {
        // Note: This would require the user's SnapTrade credentials
        // For now, we'll return empty if no other search sources
        console.log('No external search APIs configured');
      } catch (error) {
        console.error('SnapTrade search error:', error);
      }
    }

    res.json({ 
      results,
      query,
      type,
      total: results.length 
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ 
      message: 'Search failed', 
      error: error.message 
    });
  }
});

export default router;