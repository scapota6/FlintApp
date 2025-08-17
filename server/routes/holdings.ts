import { Router } from 'express';
import { accountsApi, portfoliosApi } from '../lib/snaptrade';
import { getSnapUserByEmail } from '../store/snapUserStore';

const r = Router();

function pickEmail(req: any): string | null {
  const e1 = req.user?.email, e2 = req.headers['x-user-email'], e3 = req.query.userEmail;
  const email = (e1 || e2 || e3 || '').toString().trim().toLowerCase();
  return email || null;
}

r.get('/', async (req, res) => {
  try {
    const userId = pickEmail(req);
    if (!userId) return res.status(401).send('No user');

    const rec = await getSnapUserByEmail(userId);
    const userSecret = rec?.snaptrade_user_secret;
    if (!userSecret) return res.status(400).send('SnapTrade not registered for user');

    console.log('[SnapTrade] Fetching accounts with userSecret len:', userSecret.length, 'for', userId);
    
    // Using the correct SDK method names
    const accountsResponse = await accountsApi.listUserAccounts({ userId, userSecret });
    const accounts = accountsResponse.data || [];
    
    const positionsPromises = accounts.map(async (account) => {
      try {
        const positionsResponse = await portfoliosApi.getUserAccountPositions({ 
          userId, 
          userSecret, 
          accountId: account.id! 
        });
        return {
          accountId: account.id,
          accountName: account.name,
          positions: positionsResponse.data?.positions || []
        };
      } catch (error) {
        console.error(`Error fetching positions for account ${account.id}:`, error);
        return {
          accountId: account.id,
          accountName: account.name,
          positions: []
        };
      }
    });
    
    const positions = await Promise.all(positionsPromises);
    res.json({ accounts, positions });
  } catch (err: any) {
    console.error('Error fetching holdings:', err?.responseBody || err?.message || err);
    res.status(500).json({ message: 'Failed to fetch holdings' });
  }
});

export default r;