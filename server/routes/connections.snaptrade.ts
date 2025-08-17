import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { createConnectionPortal } from '../services/snaptradeProvision';

const r = Router();

/** POST /api/connections/snaptrade/register { userId: string } */
r.post('/connections/snaptrade/register', isAuthenticated, async (req: any, res) => {
  try {
    // Use authenticated user's ID or allow override from body for flexibility
    const userId = String(req.body?.userId || req.user.claims.sub || '').trim();
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const url = await createConnectionPortal(userId); // auto-provisions if missing
    return res.json({ connect: { url } });
  } catch (e: any) {
    // 1076 here == signature invalid → creds/env/redirect mismatch
    console.error('SnapTrade registration error:', e?.responseBody || e?.message || e);
    return res.status(401).json({ message: 'Failed to register with SnapTrade' });
  }
});

export default r;