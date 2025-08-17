import { Router } from 'express';
import { authApi } from '../lib/snaptrade';
import { getSnapUser, saveSnapUser } from '../store/snapUsers';

const r = Router();

/** body: { userId: string }  // MUST be your stable internal user id, NOT email */
r.post('/connections/snaptrade/register', async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ message: 'userId required' });

    console.log('[SnapTrade] Authenticated registration for userId:', userId);

    // 1) Register (idempotent) and store the SECRET RETURNED BY SNAPTRADE
    let rec = await getSnapUser(userId);
    if (!rec) {
      const created = await authApi.registerUser({ userId }); // returns userSecret
      if (!created.userSecret) throw new Error('SnapTrade did not return userSecret');
      rec = { userId: created.userId!, userSecret: created.userSecret! };
      await saveSnapUser(rec);
      console.log('[SnapTrade] Registered & stored userSecret len:', rec.userSecret.length, 'userId:', rec.userId);
    } else {
      console.log('[SnapTrade] Using stored userSecret len:', rec.userSecret.length, 'userId:', rec.userId);
    }

    // 2) Create Connection Portal URL (expires ~5 minutes)
    const login = await authApi.loginSnapTradeUser({
      userId: rec.userId,
      userSecret: rec.userSecret,
      brokerRedirectUri: process.env.SNAPTRADE_REDIRECT_URI!,
    });
    const url = login.redirectURI || login.loginRedirectURI || login.url;
    if (!url) throw new Error('No Connection Portal URL returned');
    return res.json({ connect: { url } });
  } catch (e: any) {
    console.error('SnapTrade Registration Error:', e?.responseBody || e?.message || e);
    // 1076 here = signature invalid -> fix creds/env/redirect
    return res.status(401).json({ message: e?.message || 'SnapTrade register failed', code: e?.code || e?.responseBody?.code });
  }
});

export default r;