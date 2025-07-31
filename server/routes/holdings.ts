import { Router } from 'express';
import { db } from '../db';
import { users } from '@/shared/schema';
import { eq } from 'drizzle-orm';
import { Snaptrade } from 'snaptrade-typescript-sdk';

const router = Router();

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// Initialize SnapTrade client
const getSnapTradeClient = () => {
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CLIENT_SECRET;

  if (!clientId || !consumerKey) {
    throw new Error('Missing SnapTrade credentials');
  }

  return new Snaptrade({
    clientId,
    consumerKey,
  });
};

// Get holdings for all connected accounts
router.get('/holdings', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    console.log(`Fetching holdings for user: ${req.user?.email}`);
    
    const snaptrade = await getSnapTradeClient();
    
    // Get all connected accounts
    const accountsResponse = await snaptrade.accountInformation.listUserAccounts({
      userId: req.user?.email || userId,
      userSecret: req.user?.snapTradeUserSecret || '',
    });

    const accounts = accountsResponse.data || [];
    console.log(`Found ${accounts.length} connected accounts`);

    // Fetch positions for each account
    const holdingsPromises = accounts.map(async (account) => {
      try {
        const positionsResponse = await snaptrade.accountInformation.getUserAccountPositions({
          userId: req.user?.email || userId,
          userSecret: req.user?.snapTradeUserSecret || '',
          accountId: account.id,
        });

        const positions = positionsResponse.data?.positions || [];
        
        // Get real-time quotes for all positions
        const symbols = positions.map(p => p.symbol?.symbol).filter(Boolean);
        const quotesMap = new Map();
        
        if (symbols.length > 0) {
          try {
            // Get quotes from market data service
            const quotesResponse = await apiRequest('POST', '/api/quotes/batch', { symbols });
            const quotesData = await quotesResponse.json();
            
            if (quotesData.quotes) {
              quotesData.quotes.forEach((quote: any) => {
                quotesMap.set(quote.symbol, quote.price);
              });
            }
          } catch (error) {
            console.error('Error fetching quotes:', error);
          }
        }

        // Transform positions with real-time data
        return positions.map(position => {
          const symbol = position.symbol?.symbol || '';
          const quantity = position.quantity || 0;
          const averageCost = position.price || 0;
          const currentPrice = quotesMap.get(symbol) || position.price || 0;
          const currentValue = quantity * currentPrice;
          const totalCost = quantity * averageCost;
          const profitLoss = currentValue - totalCost;
          const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

          return {
            accountId: account.id,
            accountName: account.name,
            brokerageName: account.institution_name || 'Unknown',
            symbol: symbol,
            name: position.symbol?.description || symbol,
            quantity: quantity,
            averageCost: averageCost,
            currentPrice: currentPrice,
            currentValue: currentValue,
            totalCost: totalCost,
            profitLoss: profitLoss,
            profitLossPercent: profitLossPercent,
            currency: position.symbol?.currency || 'USD',
            type: position.symbol?.type || 'stock',
          };
        });
      } catch (error) {
        console.error(`Error fetching positions for account ${account.id}:`, error);
        return [];
      }
    });

    const allHoldings = await Promise.all(holdingsPromises);
    const flattenedHoldings = allHoldings.flat();

    console.log(`Found ${flattenedHoldings.length} total holdings across all accounts`);

    // Calculate portfolio summary
    const totalValue = flattenedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalCost = flattenedHoldings.reduce((sum, h) => sum + h.totalCost, 0);
    const totalProfitLoss = totalValue - totalCost;
    const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

    res.json({
      holdings: flattenedHoldings,
      summary: {
        totalValue,
        totalCost,
        totalProfitLoss,
        totalProfitLossPercent,
        positionCount: flattenedHoldings.length,
        accountCount: accounts.length,
      }
    });

  } catch (error: any) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch holdings', 
      error: error.message 
    });
  }
});

// Get holdings for a specific account
router.get('/holdings/:accountId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const snaptrade = await getSnapTradeClient();
    
    const positionsResponse = await snaptrade.accountInformation.getUserAccountPositions({
      userId: req.user?.email || userId,
      userSecret: req.user?.snapTradeUserSecret || '',
      accountId: accountId,
    });

    const positions = positionsResponse.data?.positions || [];
    
    // Get real-time quotes
    const symbols = positions.map(p => p.symbol?.symbol).filter(Boolean);
    const quotesMap = new Map();
    
    if (symbols.length > 0) {
      try {
        const quotesResponse = await apiRequest('POST', '/api/quotes/batch', { symbols });
        const quotesData = await quotesResponse.json();
        
        if (quotesData.quotes) {
          quotesData.quotes.forEach((quote: any) => {
            quotesMap.set(quote.symbol, quote.price);
          });
        }
      } catch (error) {
        console.error('Error fetching quotes:', error);
      }
    }

    // Transform positions
    const holdings = positions.map(position => {
      const symbol = position.symbol?.symbol || '';
      const quantity = position.quantity || 0;
      const averageCost = position.price || 0;
      const currentPrice = quotesMap.get(symbol) || position.price || 0;
      const currentValue = quantity * currentPrice;
      const totalCost = quantity * averageCost;
      const profitLoss = currentValue - totalCost;
      const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

      return {
        symbol: symbol,
        name: position.symbol?.description || symbol,
        quantity: quantity,
        averageCost: averageCost,
        currentPrice: currentPrice,
        currentValue: currentValue,
        totalCost: totalCost,
        profitLoss: profitLoss,
        profitLossPercent: profitLossPercent,
        currency: position.symbol?.currency || 'USD',
        type: position.symbol?.type || 'stock',
      };
    });

    res.json({ holdings });

  } catch (error: any) {
    console.error('Error fetching account holdings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch account holdings', 
      error: error.message 
    });
  }
});

export default router;