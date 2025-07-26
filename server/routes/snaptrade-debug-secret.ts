import express from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

const router = express.Router();

// Returns the stored SnapTrade secret for the current user
router.get("/secret", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const snapTradeUser = await storage.getSnapTradeUser(userId);
    
    return res.json({ 
      snaptradeUserId: snapTradeUser?.snaptradeUserId,
      userSecret: snapTradeUser?.userSecret,
      userSecretType: typeof snapTradeUser?.userSecret,
      userSecretLength: snapTradeUser?.userSecret?.length
    });
  } catch (err: any) {
    console.error("Debug secret error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;