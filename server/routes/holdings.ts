import { Router } from 'express';
import { accountsApi, portfolioApi } from '../lib/snaptrade';
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
      const accounts = await accountsApi.listUserAccounts({ userId: rec.userId, userSecret: rec.userSecret });
      const positions = await Promise.all(
        accounts.data.map((a:any)=> portfolioApi.getUserAccountPositions({ userId: rec.userId, userSecret: rec.userSecret, accountId: a.id }))
      );
      return res.json({ accounts, positions });
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