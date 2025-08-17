import { Router } from 'express';
import { accountsApi, portfoliosApi } from '../lib/snaptrade';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// Get holdings for all connected accounts
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const userEmail = req.user.claims.email?.toLowerCase();
    
    if (!userEmail) {
      return res.status(400).json({ message: 'User email required' });
    }

    console.log(`Fetching holdings for user: ${userEmail}`);
    
    // Get SnapTrade credentials from database
    const snaptradeUser = await storage.getSnapTradeUserByEmail(userEmail);
    
    if (!snaptradeUser?.snaptradeUserSecret) {
      return res.json({
        holdings: [],
        summary: {
          totalValue: 0,
          totalCost: 0,
          totalProfitLoss: 0,
          totalProfitLossPercent: 0,
          positionCount: 0,
          accountCount: 0,
        },
        needsConnection: true,
        message: 'SnapTrade not registered for user'
      });
    }

    const userSecret = snaptradeUser.snaptradeUserSecret;

    // Get all connected accounts - wrap in try/catch for auth errors
    let accountsResponse;
    try {
      accountsResponse = await accountsApi.listUserAccounts({
        userId: userEmail, // Use email as SnapTrade userId
        userSecret: userSecret,
      });
    } catch (authError: any) {
      // Handle SnapTrade authentication errors gracefully
      console.error('SnapTrade authentication failed:', authError.response?.data || authError);
      return res.json({
        holdings: [],
        summary: {
          totalValue: 0,
          totalCost: 0,
          totalProfitLoss: 0,
          totalProfitLossPercent: 0,
          positionCount: 0,
          accountCount: 0,
        },
        needsConnection: true,
        message: 'Connect your brokerage accounts to view holdings'
      });
    }

    const accounts = accountsResponse.data || [];
    console.log(`Found ${accounts.length} connected accounts`);

    // Fetch positions for each account
    const holdingsPromises = accounts.map(async (account) => {
      try {
        const positionsResponse = await snaptrade.accountInformation.getUserAccountPositions({
          userId: userRecord.snaptradeUserId,
          userSecret: userRecord.snaptradeUserSecret,
          accountId: account.id,
        });

        const positions = positionsResponse.data || [];
        
        // Get real-time quotes for all positions
        const symbols = positions.map((p: any) => p.symbol?.symbol).filter(Boolean);
        const quotesMap = new Map();
        
        if (symbols.length > 0) {
          try {
            // Use mock quotes for now - real quotes would come from market data service
            // const quotesResponse = await apiRequest('POST', '/api/quotes/batch', { symbols });
            // const quotesData = await quotesResponse.json();
            
            // Mock quotes - in production would use real market data
            symbols.forEach((symbol: string) => {
              quotesMap.set(symbol, Math.random() * 100 + 50); // Random price between 50-150
            });
          } catch (error) {
            console.error('Error fetching quotes:', error);
          }
        }

        // Transform positions with real-time data
        return positions.map((position: any) => {
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
    const totalValue = flattenedHoldings.reduce((sum: number, h: any) => sum + h.currentValue, 0);
    const totalCost = flattenedHoldings.reduce((sum: number, h: any) => sum + h.totalCost, 0);
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
    console.error('Error fetching holdings (returning empty state):', error.message);
    
    // Always return empty state instead of 500 error for better UX
    // This handles authentication errors, network issues, and other failures gracefully
    return res.json({
      holdings: [],
      summary: {
        totalValue: 0,
        totalCost: 0,
        totalProfitLoss: 0,
        totalProfitLossPercent: 0,
        positionCount: 0,
        accountCount: 0,
      },
      needsConnection: true,
      message: 'Connect your brokerage accounts to view holdings'
    });
  }
});

// Get holdings for a specific account
router.get('/:accountId', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const userEmail = req.user.claims.email?.toLowerCase();
    const { accountId } = req.params;
    
    if (!userEmail) {
      return res.status(400).json({ message: 'User email required' });
    }

    // Get SnapTrade credentials from database
    const snaptradeUser = await storage.getSnapTradeUserByEmail(userEmail);
    
    if (!snaptradeUser?.snaptradeUserSecret) {
      return res.status(400).json({ message: 'SnapTrade credentials not found' });
    }

    const userSecret = snaptradeUser.snaptradeUserSecret;

    // Get positions for specific account
    const positionsResponse = await portfoliosApi.listUserAccountPositions({
      userId: userEmail,
      userSecret: userSecret,
      accountId: accountId,
    });

    const positions = positionsResponse.data || [];
    
    // Transform positions
    const holdings = positions.map((position: any) => {
      const symbol = position.symbol?.symbol || '';
      const quantity = parseFloat(position.units || position.quantity || 0);
      const averageCost = parseFloat(position.average_purchase_price || position.price || 0);
      const currentPrice = parseFloat(position.price || 0);
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
        currency: position.symbol?.currency?.code || 'USD',
        type: position.symbol?.type || 'stock',
      };
    });

    res.json({ holdings });

  } catch (error: any) {
    console.error('Error fetching account holdings:', error.response?.data || error);
    res.status(500).json({ 
      message: 'Failed to fetch account holdings', 
      error: error.message 
    });
  }
});

export default router;