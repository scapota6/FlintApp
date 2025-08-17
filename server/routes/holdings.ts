import { Router } from 'express';
import { accountsApi, portfolioApi } from '../lib/snaptrade';
import { getSnapUser } from '../store/snapUsers';

const r = Router();

// Pick your internal userId (NOT email). For now allow header or query.
function pickId(req: any) {
  return (req.user?.claims?.sub || req.user?.id || req.headers['x-user-id'] || req.query.userId || '').toString().trim();
}

r.get('/holdings', async (req, res) => {
  try {
    const userId = pickId(req);
    if (!userId) return res.status(401).json({ message: 'No userId' });

    const rec = await getSnapUser(userId);
    if (!rec?.userSecret) return res.status(428).json({ code: 'SNAPTRADE_NOT_REGISTERED', message: 'No SnapTrade user for this userId' });

    try {
      const accounts = await accountsApi.listAccounts({ userId: rec.userId, userSecret: rec.userSecret });
      const positions = await Promise.all(
        accounts.map((a: any) => portfolioApi.getUserAccountPositions({ userId: rec.userId, userSecret: rec.userSecret, accountId: a.id }))
      );
      return res.json({ accounts, positions: positions.map((p: any) => p.data) });
    } catch (e: any) {
      const body = e?.responseBody || {};
      if (e?.status === 401 && String(body?.code) === '1083') {
        // Docs: invalid userId/userSecret pair
        return res.status(409).json({ code: 'SNAPTRADE_USER_MISMATCH', message: 'Stored userSecret does not match provider.' });
      }
      throw e;
    }
  } catch (e: any) {
    console.error('Holdings error:', e?.responseBody || e?.message || e);
    return res.status(500).json({ message: 'Failed to fetch holdings' });
  }
});

export default r;