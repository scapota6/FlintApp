import { Router } from 'express';
import { accountsApi, portfoliosApi } from '../lib/snaptrade';
import { getUser } from '../store/snapUsers';
import { isAuthenticated } from '../replitAuth';

const r = Router();

// Pick immutable userId you send from the client (NOT email). For now accept header/query.
function pickId(req: any) {
  console.log('[Holdings] User object:', req.user);
  console.log('[Holdings] User claims:', req.user?.claims);
  return (req.user?.claims?.email || req.headers['x-user-id'] || req.query.userId || '').toString().trim().toLowerCase();
}

r.get('/', isAuthenticated, async (req, res) => {
  console.log('[Holdings] Route hit with authentication verified');
  const userId = pickId(req);
  if (!userId) return res.status(401).json({ message: 'No userId' });

  const rec = await getUser(userId);
  if (!rec?.userSecret) return res.status(428).json({ code: 'SNAPTRADE_NOT_REGISTERED', message: 'No SnapTrade user' });

  try {
    const accounts = await accountsApi.listUserAccounts({ userId: rec.userId, userSecret: rec.userSecret });
    const positions = await Promise.all(
      accounts.data.map((a: any) => portfoliosApi.listPortfolioAccountPositions({ userId: rec.userId, userSecret: rec.userSecret, accountId: a.id }))
    );
    return res.json({ accounts: accounts.data, positions: positions.map(p => p.data) });
  } catch (e: any) {
    const body = e?.responseBody || {};
    if (e?.status === 401 && String(body?.code) === '1083') {
      // SnapTrade says: the stored secret doesn't match their copy
      return res.status(409).json({ code: 'SNAPTRADE_USER_MISMATCH', message: 'Stored secret does not match SnapTrade.' });
    }
    console.error('Holdings error:', body || e?.message || e);
    return res.status(500).json({ message: 'Failed to fetch holdings' });
  }
});

export default r;