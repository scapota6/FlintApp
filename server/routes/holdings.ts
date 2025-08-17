import { Router } from 'express';
import { accountsApi, portfoliosApi } from '../lib/snaptrade';
import { getSnapUserByEmail } from '../store/snapUserStore';

const r = Router();

function getEmailFromReq(req: any): string | null {
  // prefer authenticated user if you have auth middleware; fallback to query for now
  const email = (req.user?.claims?.email || req.query.userEmail || req.headers['x-user-email'] || '').toString().toLowerCase();
  return email || null;
}

r.get('/', async (req, res) => {
  try {
    const userId = getEmailFromReq(req);
    if (!userId) return res.status(401).json({ message: 'No user' });

    const rec = await getSnapUserByEmail(userId);
    const userSecret = rec?.snaptrade_user_secret;
    if (!userSecret) {
      console.warn('[SnapTrade] No stored userSecret for', userId);
      return res.status(400).json({ message: 'SnapTrade not registered for user' });
    }

    console.log('[SnapTrade] Fetching accounts with userSecret len:', userSecret.length, 'for', userId);
    const accounts = await accountsApi.listAccounts({ userId, userSecret });

    const positions = await Promise.all(
      accounts.map(a => portfoliosApi.getPositions({ userId, userSecret, accountId: a.id! }))
    );

    return res.json({ accounts, positions });
  } catch (err: any) {
    console.error('Error fetching holdings:', err?.responseBody || err?.message || err);
    return res.status(500).json({ message: 'Failed to fetch holdings' });
  }
});

export default r;