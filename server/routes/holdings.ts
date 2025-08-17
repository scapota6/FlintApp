import { Router } from 'express';
import { listAccounts, getPositions } from '../lib/snaptrade';
import { getSnapUser } from '../store/snapUsers';

const r = Router();
const pickId = (req:any)=> (req.user?.id || req.headers['x-user-id'] || req.query.userId || '').toString().trim();

r.get('/holdings', async (req, res) => {
  try {
    const userId = pickId(req);
    if (!userId) return res.status(401).json({ message: 'No userId' });

    const rec = await getSnapUser(userId);
    if (!rec?.userSecret) return res.status(428).json({ code:'SNAPTRADE_NOT_REGISTERED', message:'No SnapTrade user for this userId' });

    try {
      const accounts = await listAccounts(rec.userId, rec.userSecret);
      console.log(`DEBUG: getAllUserHoldings response length: ${accounts.length}`);
      
      const positionsArrays = await Promise.all(
        accounts.map(async (a:any) => {
          const positions = await getPositions(rec.userId, rec.userSecret, a.id);
          console.log(`DEBUG: Found positions for account: ${a.id} count: ${positions.length}`);
          return positions.map((pos: any) => ({
            accountId: a.id,
            accountName: a.name || 'Unknown Account',
            brokerageName: a.institution_name || 'Unknown',
            symbol: pos.symbol || pos.universal_symbol?.symbol || 'N/A',
            name: pos.universal_symbol?.description || pos.instrument?.name || pos.symbol || 'N/A',
            quantity: parseFloat(pos.units) || 0,
            averageCost: parseFloat(pos.average_purchase_price) || 0,
            currentPrice: parseFloat(pos.price) || 0,
            currentValue: parseFloat(pos.price) * parseFloat(pos.units) || 0,
            totalCost: parseFloat(pos.average_purchase_price) * parseFloat(pos.units) || 0,
            profitLoss: (parseFloat(pos.price) - parseFloat(pos.average_purchase_price)) * parseFloat(pos.units) || 0,
            profitLossPercent: pos.average_purchase_price ? 
              ((parseFloat(pos.price) - parseFloat(pos.average_purchase_price)) / parseFloat(pos.average_purchase_price)) * 100 : 0,
            currency: pos.universal_symbol?.currency?.code || 'USD',
            type: pos.universal_symbol?.type || 'stock',
          }));
        })
      );
      
      // Flatten all positions into a single array
      const holdings = positionsArrays.flat();
      
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
  } catch (e:any) {
    console.error('Holdings error:', e?.responseBody || e?.message || e);
    return res.status(500).json({ message: 'Failed to fetch holdings' });
  }
});

export default r;