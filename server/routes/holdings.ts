import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";

const router = Router();

// Get user's portfolio holdings with real-time market data
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const userEmail = req.user.claims.email;
    
    console.log('Fetching holdings for user:', userEmail);
    
    const user = await storage.getUser(userId);
    const enrichedHoldings = [];

    // Fetch holdings from SnapTrade if connected
    if ((global as any).snapTradeClient && user?.snaptradeUserId && user?.snaptradeUserSecret) {
      try {
        // Get all user accounts
        const accounts = await (global as any).snapTradeClient.accountInformation.listUserAccounts({
          userId: user.snaptradeUserId,
          userSecret: user.snaptradeUserSecret,
        });

        if (accounts.data && Array.isArray(accounts.data)) {
          // Get holdings for each account
          for (const account of accounts.data) {
            try {
              const holdings = await (global as any).snapTradeClient.accountInformation.getUserAccountPositions({
                userId: user.snaptradeUserId,
                userSecret: user.snaptradeUserSecret,
                accountId: account.id,
              });

              if (holdings.data && Array.isArray(holdings.data)) {
                for (const position of holdings.data) {
                  if (position.symbol && position.quantity && parseFloat(position.quantity) > 0) {
                    // Get current market price
                    let currentPrice = parseFloat(position.price?.amount || '0');
                    
                    // Fetch real-time price from our market data service
                    try {
                      const priceResponse = await fetch(`http://localhost:5000/api/quotes/${position.symbol.symbol}`);
                      if (priceResponse.ok) {
                        const priceData = await priceResponse.json();
                        currentPrice = priceData.price || currentPrice;
                      }
                    } catch (error) {
                      console.error(`Error fetching price for ${position.symbol.symbol}:`, error);
                    }
                    
                    const quantity = parseFloat(position.quantity);
                    const avgCost = parseFloat(position.average_purchase_price?.amount || '0');
                    const marketValue = currentPrice * quantity;
                    const totalCost = avgCost * quantity;
                    const totalGainLoss = marketValue - totalCost;
                    const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
                    
                    enrichedHoldings.push({
                      id: `${account.id}-${position.symbol.symbol}`,
                      symbol: position.symbol.symbol || 'N/A',
                      name: position.symbol.description || position.symbol.symbol || 'Unknown',
                      type: getAssetType(position.symbol.symbol),
                      quantity: quantity,
                      avgCost: avgCost,
                      currentPrice: currentPrice,
                      marketValue: marketValue,
                      totalGainLoss: totalGainLoss,
                      totalGainLossPct: totalGainLossPct,
                      dayChange: 0, // Would need additional API call for daily change
                      dayChangePct: 0,
                      accountProvider: account.institution_name || 'SnapTrade',
                      logo: getAssetLogo(position.symbol.symbol)
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching holdings for account ${account.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching SnapTrade holdings:', error);
      }
    }

    // Add any local holdings from our database
    try {
      const localHoldings = await storage.getHoldings(userId);
      
      for (const holding of localHoldings) {
        // Enrich with real-time market data
        let currentPrice = holding.currentPrice || 0;
        
        try {
          const priceResponse = await fetch(`http://localhost:5000/api/quotes/${holding.symbol}`);
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            currentPrice = priceData.price || currentPrice;
          }
        } catch (error) {
          console.error(`Error fetching price for ${holding.symbol}:`, error);
        }
        
        const quantity = parseFloat(holding.quantity);
        const avgCost = parseFloat(holding.averagePrice);
        const marketValue = currentPrice * quantity;
        const totalCost = avgCost * quantity;
        const totalGainLoss = marketValue - totalCost;
        const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
        
        enrichedHoldings.push({
          id: holding.id,
          symbol: holding.symbol,
          name: holding.symbol, // Could be enhanced with company name lookup
          type: getAssetType(holding.symbol),
          quantity: quantity,
          avgCost: avgCost,
          currentPrice: currentPrice,
          marketValue: marketValue,
          totalGainLoss: totalGainLoss,
          totalGainLossPct: totalGainLossPct,
          dayChange: 0,
          dayChangePct: 0,
          accountProvider: 'Flint',
          logo: getAssetLogo(holding.symbol)
        });
      }
    } catch (error) {
      console.error('Error fetching local holdings:', error);
    }

    console.log(`Found ${enrichedHoldings.length} holdings for user`);
    res.json(enrichedHoldings);
    
  } catch (error: any) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch holdings' 
    });
  }
});

// Helper function to determine asset type
function getAssetType(symbol: string): 'stock' | 'crypto' | 'etf' {
  if (symbol.includes('-USD') || symbol.includes('BTC') || symbol.includes('ETH')) {
    return 'crypto';
  }
  
  const etfSymbols = ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'EFA', 'EEM', 'TLT', 'GLD', 'SLV'];
  if (etfSymbols.includes(symbol.toUpperCase())) {
    return 'etf';
  }
  
  return 'stock';
}

// Helper function to get asset logos
function getAssetLogo(symbol: string): string | undefined {
  const logoMap: { [key: string]: string } = {
    'AAPL': 'https://logo.clearbit.com/apple.com',
    'GOOGL': 'https://logo.clearbit.com/google.com',
    'MSFT': 'https://logo.clearbit.com/microsoft.com',
    'TSLA': 'https://logo.clearbit.com/tesla.com',
    'AMZN': 'https://logo.clearbit.com/amazon.com',
    'META': 'https://logo.clearbit.com/meta.com',
    'NVDA': 'https://logo.clearbit.com/nvidia.com',
    'BTC-USD': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    'ETH-USD': 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
  };
  
  return logoMap[symbol];
}

export default router;