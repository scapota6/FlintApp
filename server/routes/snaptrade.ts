import { Router } from 'express';
import { authApi } from '../lib/snaptrade';
import { getUser, saveUser } from '../store/snapUsers';

const r = Router();

/** body: { userId: string }  // <- USE YOUR IMMUTABLE APP USER ID, NOT EMAIL */
r.post('/register', async (req, res) => {
  try {
    const userId = String(req.body.userId || '').trim();
    if (!userId) return res.status(400).json({ message: 'userId required' });

    // If we already have a userSecret stored, reuse it; else register to get secret from SnapTrade
    let rec = await getUser(userId);
    if (!rec) {
      const created = await authApi.registerSnapTradeUser({ userId }); // returns { userId, userSecret }
      rec = { userId: created.data.userId!, userSecret: created.data.userSecret! };
      await saveUser(rec);
      console.log('[SnapTrade] Registered + stored secret len:', rec.userSecret.length, 'userId:', rec.userId);
    } else {
      console.log('[SnapTrade] Using stored secret len:', rec.userSecret.length, 'userId:', rec.userId);
    }

    // Generate Connection Portal URL (expires in ~5 minutes)
    const login = await authApi.loginSnapTradeUser({
      userId: rec.userId,
      userSecret: rec.userSecret,
      broker: 'ALPACA',
      immediateRedirect: true,
      customRedirect: process.env.SNAPTRADE_REDIRECT_URI!,
    });
    // Field name differs by SDK version; support a few:
    const url = (login.data?.redirectURI || login.data?.loginRedirectURI || login.data?.url) as string;
    return res.json({ connect: { url } });
  } catch (e: any) {
    console.error('SnapTrade Authenticated Registration Error:', e?.responseBody || e?.message || e);
    return res.status(500).json({ message: e?.message || 'register failed' });
  }
});

export default r;