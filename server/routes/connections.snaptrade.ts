import { Router } from 'express';
import { authApi } from '../lib/snaptrade';
import { getSnapUser, saveSnapUser } from '../store/snapUsers';

const r = Router();

/** POST /api/connections/snaptrade/register  body: { userId: string } */
r.post('/connections/snaptrade/register', async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ message: 'userId required' });

    // Register (idempotent) and store the SECRET RETURNED BY SNAPTRADE
    let rec = await getSnapUser(userId);
    if (!rec) {
      const created = await authApi.registerUser({ userId }); // returns { userId, userSecret }
      if (!created?.userSecret) throw new Error('SnapTrade did not return userSecret');
      rec = { userId: created.userId as string, userSecret: created.userSecret as string };
      await saveSnapUser(rec);
      console.log('[SnapTrade] Registered & stored userSecret len:', rec.userSecret.length, 'userId:', rec.userId);
    } else {
      console.log('[SnapTrade] Using stored userSecret len:', rec.userSecret.length, 'userId:', rec.userId);
    }

    // Create Connection Portal URL (expires ~5m)
    const login = await authApi.loginSnapTradeUser({
      userId: rec.userId,
      userSecret: rec.userSecret,
      brokerRedirectUri: process.env.SNAPTRADE_REDIRECT_URI!,
    });
    const url = (login.redirectURI || login.loginRedirectURI || login.url) as string;
    if (!url) throw new Error('No Connection Portal URL returned');

    return res.json({ connect: { url } });
  } catch (e: any) {
    // If you see code 1076 here, it is still a signature/creds/env mismatch.
    console.error('SnapTrade registration error:', e?.responseBody || e?.message || e);
    return res.status(500).json({ message: 'Failed to register with SnapTrade' });
  }
});

export default r;