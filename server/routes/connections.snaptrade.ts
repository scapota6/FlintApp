import { Router } from 'express';
import { registerUser, createLoginUrl } from '../lib/snaptrade';
import { getSnapUser, saveSnapUser } from '../store/snapUsers';

const r = Router();

/** POST /api/connections/snaptrade/register { userId: string } */
r.post('/connections/snaptrade/register', async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ message: 'userId required' });

    // If first time: register → store provider-returned userSecret
    let rec = await getSnapUser(userId);
    if (!rec) {
      const created = await registerUser(userId); // version-safe wrapper
      if (!created?.data?.userSecret) throw new Error('SnapTrade did not return userSecret');
      rec = { userId: created.data.userId as string, userSecret: created.data.userSecret as string };
      await saveSnapUser(rec);
      console.log('[SnapTrade] Registered & stored userSecret len:', rec.userSecret.length, 'userId:', rec.userId);
    } else {
      console.log('[SnapTrade] Using stored userSecret len:', rec.userSecret.length, 'userId:', rec.userId);
    }

    // Create Connection Portal URL (expires ~5 min)
    const url = await createLoginUrl({
      userId: rec.userId,
      userSecret: rec.userSecret,
      redirect: process.env.SNAPTRADE_REDIRECT_URI!,
    });
    if (!url) throw new Error('No Connection Portal URL returned');

    return res.json({ connect: { url } });
  } catch (e: any) {
    console.error('SnapTrade registration error:', e?.responseBody || e?.message || e);
    return res.status(500).json({ message: 'Failed to register with SnapTrade' });
  }
});

export default r;