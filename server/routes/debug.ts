import { Router } from 'express';
import { authApi } from '../lib/snaptrade';
import { getSnapUserByEmail } from '../store/snapUserStore';

const r = Router();

r.get('/snaptrade/user', async (req, res) => {
  const email = (req.query.email || '').toString().trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'email required' });
  const rec = await getSnapUserByEmail(email);
  res.json({
    exists: !!rec,
    userId: rec?.userId,
    userSecretLen: rec?.snaptrade_user_secret?.length || 0,
  });
});

export default r;