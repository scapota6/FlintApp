import { Router } from 'express';
import { listAccounts, getPositions } from '../lib/snaptrade';
import { getSnapUser } from '../store/snapUsers';

const router = Router();

router.get('/portfolio-holdings', async (req: any, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Get user ID from authenticated session (use sub, not email)
    const userId = req.user?.claims?.sub;
    console.log('[Holdings API] User ID from claims.sub:', userId);
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const rec = await getSnapUser(userId);
    console.log('[Holdings API] SnapTrade user found:', rec ? 'yes' : 'no', 'userId:', rec?.userId);
    
    if (!rec?.userSecret) {
      console.log('SnapTrade not connected — returning empty holdings');
      return res.status(200).json({ holdings: [] });
    }

    try {
      const accounts = await listAccounts(rec.userId, rec.userSecret);
      console.log(`DEBUG: getAllUserHoldings response length: ${accounts.length}`);
      
      const positionsArrays = await Promise.all(
        accounts.map(async (a:any) => {
          const accountData = await getPositions(rec.userId, rec.userSecret, a.id);
          console.log(`DEBUG: Found account data for account: ${a.id} count: ${accountData.length}`);
          
          if (!accountData || accountData.length === 0) return [];
          
          // Extract positions from the account data structure
          const positions = accountData[0]?.positions || [];
          console.log(`DEBUG: Extracted positions for account ${a.id}:`, positions.length);
          console.log(`DEBUG: Raw position data sample:`, JSON.stringify(positions[0], null, 2));
          
          return positions.map((pos: any) => {
            // Extract symbol from deeply nested structure  
            let symbol = 'N/A';
            if (pos.symbol?.symbol?.symbol) {
              symbol = pos.symbol.symbol.symbol;
            } else if (typeof pos.symbol === 'string') {
              symbol = pos.symbol;
            } else if (pos.universal_symbol?.symbol) {
              symbol = pos.universal_symbol.symbol;
            }
            
            console.log(`DEBUG: Symbol extraction - pos.symbol type:`, typeof pos.symbol, 'symbol value:', symbol);
            const units = parseFloat(pos.units || pos.quantity) || 0;
            const avgPrice = parseFloat(pos.average_purchase_price || pos.average_cost || pos.avg_cost) || 0;
            const currentPrice = parseFloat(pos.price || pos.current_price || pos.market_value) || 0;
            
            console.log(`DEBUG: Processing position - Symbol: ${symbol}, Units: ${units}, AvgPrice: ${avgPrice}, CurrentPrice: ${currentPrice}`);
            
            // Map common brokerage names
            let brokerageName = a.institution_name || 'Unknown';
            if (brokerageName === 'Default' && a.name?.toLowerCase().includes('coinbase')) {
              brokerageName = 'Coinbase';
            } else if (brokerageName === 'Default') {
              brokerageName = a.name || 'Default';
            }
            
            return {
              accountId: a.id,
              accountName: a.name || 'Unknown Account',
              brokerageName: brokerageName,
              symbol: symbol,
              name: pos.symbol?.symbol?.description || pos.universal_symbol?.description || pos.instrument?.name || symbol,
              quantity: units,
              averageCost: avgPrice,
              currentPrice: currentPrice,
              currentValue: currentPrice * units,
              totalCost: avgPrice * units,
              profitLoss: (currentPrice - avgPrice) * units,
              profitLossPercent: avgPrice ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0,
              currency: pos.symbol?.symbol?.currency?.code || pos.universal_symbol?.currency?.code || pos.currency?.code || 'USD',
              type: pos.symbol?.symbol?.type?.description || pos.universal_symbol?.type || pos.type || 'stock',
              // Ensure all nullable fields are explicitly null instead of undefined
              costBasisPerShare: avgPrice || null,
              lastUpdated: pos.last_updated || null,
              exchange: pos.exchange || null,
              sector: pos.sector || null,
              marketCap: pos.market_cap || null
            };
          });
        })
      );
      
      // Flatten all positions into a single array and filter out empty positions
      const holdings = positionsArrays.flat().filter(h => h.quantity > 0 && h.symbol !== 'N/A');
      
      console.log(`DEBUG: Final holdings count after filtering: ${holdings.length}`);
      
      // Calculate summary
      const summary = {
        totalValue: holdings.reduce((sum, h) => sum + h.currentValue, 0),
        totalCost: holdings.reduce((sum, h) => sum + h.totalCost, 0),
        totalProfitLoss: holdings.reduce((sum, h) => sum + h.profitLoss, 0),
        totalProfitLossPercent: 0,
        positionCount: holdings.length,
        accountCount: accounts.length,
      };
      
      if (summary.totalCost > 0) {
        summary.totalProfitLossPercent = (summary.totalProfitLoss / summary.totalCost) * 100;
      }
      
      return res.json({ holdings, summary, accounts });
    } catch (e:any) {
      const body = e?.responseBody || {};
      if (e?.status===401 && String(body?.code)==='1083') {
        return res.status(409).json({ code:'SNAPTRADE_USER_MISMATCH', message:'Stored userSecret does not match provider.' });
      }
      throw e;
    }
  } catch (e: any) {
    const requestId = e.response?.headers?.['x-request-id'] || `req-${Date.now()}`;
    
    console.error('Holdings error:', {
      path: req.originalUrl,
      responseData: e.response?.data,
      responseHeaders: e.response?.headers,
      status: e.response?.status,
      message: e.message,
      snaptradeRequestId: requestId
    });
    
    const status = e.response?.status || 500;
    return res.status(status).json({
      error: {
        message: e.message || 'Failed to fetch holdings',
        code: e.response?.data?.code || 'HOLDINGS_FETCH_ERROR',
        requestId: requestId
      }
    });
  }
});

export default router;