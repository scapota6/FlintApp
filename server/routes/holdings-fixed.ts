import { Router } from 'express';
import { accountsApi, portfoliosApi } from '../lib/snaptrade';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

const r = Router();

r.get('/', isAuthenticated, async (req: any, res) => {
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
      console.log('No SnapTrade credentials found for user:', userEmail);
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
    console.log('Found SnapTrade credentials, fetching accounts...');

    const accounts = await accountsApi.listAccounts({ userId: userEmail, userSecret });

    const positions = await Promise.all(
      accounts.map(a =>
        portfoliosApi.getPositions({
          userId: userEmail,
          userSecret,
          accountId: a.id!,
        })
      )
    );
        
        // Transform positions
        return positions.map((position: any) => {
          const symbol = position.symbol?.symbol || '';
          const quantity = parseFloat(position.units || position.quantity || 0);
          const averageCost = parseFloat(position.average_purchase_price || position.price || 0);
          const currentPrice = parseFloat(position.price || 0);
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
            currency: position.symbol?.currency?.code || 'USD',
            type: position.symbol?.type || 'stock',
          };
        });
      } catch (error: any) {
        console.error(`Error fetching positions for account ${account.id}:`, error.response?.data || error);
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
    console.error('Error fetching holdings:', error.response?.data || error);
    return res.status(500).json({ 
      message: 'Failed to fetch holdings',
      error: error.message 
    });
  }
});

export default router;