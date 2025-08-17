import { Router } from 'express';
import { accountsApi, portfoliosApi } from '../lib/snaptrade';
import { getSnapUserByEmail } from '../store/snapUserStore';

const r = Router();

function pickEmail(req: any): string | null {
  // Preferred: req.user.email from your auth middleware
  const e1 = req.user?.claims?.email;
  const e2 = req.headers["x-user-email"];
  const e3 = req.query.userEmail;
  const email = (e1 || e2 || e3 || "").toString().trim().toLowerCase();
  return email || null;
}

r.get('/', async (req, res) => {
  try {
    const userId = pickEmail(req);
    if (!userId) return res.status(401).json({ message: 'No user' });

    const rec = await getSnapUserByEmail(userId);
    const userSecret = rec?.snaptrade_user_secret;
    if (!userSecret) return res.status(400).send('SnapTrade not registered for user');

    console.log('[SnapTrade] Fetching accounts with userSecret len:', userSecret.length, 'for', userId);
    const accounts = await accountsApi.listAccounts({ userId, userSecret });
    const positions = await Promise.all(
      accounts.map(a => portfoliosApi.getPositions({ userId, userSecret, accountId: a.id! }))
    );
    res.json({ accounts, positions });
  } catch (err: any) {
    console.error('Error fetching holdings:', err?.responseBody || err?.message || err);
    res.status(500).json({ message: 'Failed to fetch holdings' });
  }
});

export default r;