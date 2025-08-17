import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { createConnectionPortal } from '../services/snaptradeProvision';

const r = Router();

/** GET /api/snaptrade/connect - Auto-provision and return Connection Portal URL */
r.get('/connect', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub; // Use stable userId from auth
    console.log('[SnapTrade] Auto-provisioning for userId:', userId);

    const portalUrl = await createConnectionPortal(userId);
    
    console.log('[SnapTrade] Connection Portal URL generated for userId:', userId);
    res.json({ success: true, portalUrl });
  } catch (error: any) {
    console.error('[SnapTrade Connect Error]:', error);
    res.status(500).json({ success: false, message: 'Failed to create connection portal', error: error.message });
  }
});

export default r;