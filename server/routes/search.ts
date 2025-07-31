import { Router } from "express";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Universal search endpoint for stocks, crypto, and companies
router.get("/universal", isAuthenticated, async (req: any, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.length < 1) {
      return res.json([]);
    }

    const results = [];
    const upperQuery = query.toUpperCase();
    const lowerQuery = query.toLowerCase();

    // Common stock symbols that match partial queries
    const commonStocks = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
      { symbol: 'NFLX', name: 'Netflix Inc.' },
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
      { symbol: 'QQQ', name: 'Invesco QQQ ETF' },
    ];

    // Common crypto pairs
    const cryptoPairs = [
      { symbol: 'BTC-USD', name: 'Bitcoin' },
      { symbol: 'ETH-USD', name: 'Ethereum' },
      { symbol: 'ADA-USD', name: 'Cardano' },
      { symbol: 'SOL-USD', name: 'Solana' },
      { symbol: 'DOT-USD', name: 'Polkadot' },
      { symbol: 'LINK-USD', name: 'Chainlink' },
      { symbol: 'MATIC-USD', name: 'Polygon' },
      { symbol: 'AVAX-USD', name: 'Avalanche' },
    ];

    // Search stocks by symbol or company name
    const stockMatches = commonStocks.filter(stock => 
      stock.symbol.includes(upperQuery) || 
      stock.name.toLowerCase().includes(lowerQuery)
    );
    results.push(...stockMatches);

    // Search crypto by symbol or name
    const cryptoMatches = cryptoPairs.filter(crypto => 
      crypto.symbol.includes(upperQuery) || 
      crypto.name.toLowerCase().includes(lowerQuery)
    );
    results.push(...cryptoMatches);

    // If exact symbol match, prioritize it
    if (upperQuery.length >= 2) {
      const exactMatch = results.find(r => r.symbol === upperQuery);
      if (exactMatch) {
        results.splice(results.indexOf(exactMatch), 1);
        results.unshift(exactMatch);
      }
    }

    // Limit results and remove duplicates
    const uniqueResults = results
      .filter((result, index, self) => 
        index === self.findIndex(r => r.symbol === result.symbol)
      )
      .slice(0, 10);

    res.json(uniqueResults);
  } catch (error: any) {
    console.error('Universal search error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Search failed' 
    });
  }
});

export default router;