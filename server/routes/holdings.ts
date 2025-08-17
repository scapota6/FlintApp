import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { accountsApi, portfolioApi } from '../lib/snaptrade';
import { ensureSnaptradeUser } from '../services/snaptradeProvision';

const r = Router();

/** GET /api/holdings - Auto-provision and fetch holdings */
r.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    console.log('[SnapTrade] Fetching holdings for userId:', userId);

    // Auto-provision if needed
    const rec = await ensureSnaptradeUser(userId);

    try {
      const accounts = await accountsApi.listAccounts({ userId: rec.userId, userSecret: rec.userSecret });
      const positions = await portfolioApi.getPortfolioInfo({ userId: rec.userId, userSecret: rec.userSecret });
      
      console.log('[SnapTrade] Successfully fetched holdings for userId:', userId);
      res.json({ 
        accounts: accounts.data || [], 
        positions: positions.data || [],
        success: true 
      });
    } catch (snapError: any) {
      console.error('[SnapTrade] Holdings fetch error:', snapError?.responseBody || snapError?.message);
      res.status(500).json({ 
        message: 'Failed to fetch holdings from SnapTrade',
        error: snapError?.message,
        code: snapError?.responseBody?.code 
      });
    }
  } catch (error: any) {
    console.error('[Holdings] General error:', error);
    res.status(500).json({ message: 'Holdings endpoint failed', error: error.message });
  }
});

export default r;