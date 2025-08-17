import { Router } from 'express';
import { accountsApi, portfoliosApi } from '../lib/snaptrade';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

const r = Router();

r.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const userId = String(req.user?.claims?.email || '').toLowerCase();
    if (!userId) return res.status(401).json({ message: 'No user' });

    const rec = await storage.getSnapTradeUserByEmail(userId);
    const userSecret = rec?.snaptradeUserSecret;
    if (!userSecret) return res.status(400).json({ message: 'SnapTrade not registered for user' });

    const accounts = await accountsApi.listUserAccounts({ userId, userSecret });

    const positions = await Promise.all(
      accounts.map(a =>
        portfoliosApi.getUserAccountPositions({
          userId,
          userSecret,
          accountId: a.id!,
        })
      )
    );

    return res.json({ accounts, positions });
  } catch (err: any) {
    console.error('Error fetching holdings:', err?.responseBody || err?.message || err);
    return res.status(500).json({ message: 'Failed to fetch holdings' });
  }
});

export default r;