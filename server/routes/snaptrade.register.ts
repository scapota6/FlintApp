import { Router } from "express";
import { snaptrade } from "../snaptrade/client";
import { ensureUser } from "../middleware/auth";
import { db } from "../storage"; // your DB helpers

const r = Router();

/**
 * POST /api/connections/snaptrade/register
 * body: { userId?: string } // optional; otherwise take from session
 */
r.post("/api/connections/snaptrade/register", ensureUser, async (req, res) => {
  try {
    const userId = String(req.user.id); // e.g., "45137738"
    const email  = String(req.user.email);

    // 1) If we already have a userSecret, reuse it. Otherwise register.
    let creds = await db.getSnaptradeCreds(userId); // { userSecret } | null

    if (!creds?.userSecret) {
      const reg = await snaptrade.authentication.registerSnapTradeUser({
        userId,       // stable id in your system
        userEmail: email,
      });
      // Some SDKs return { userSecret }, others return { data: { userSecret } }
      const userSecret = (reg as any)?.userSecret ?? (reg as any)?.data?.userSecret;
      if (!userSecret) {
        return res.status(500).json({ message: "No userSecret from SnapTrade" });
      }
      await db.upsertSnaptradeCreds(userId, userSecret);
      creds = { userSecret };
    }

    // 2) Generate login link
    const loginLink = await snaptrade.authentication.loginSnapTradeUser({
      userId,
      userSecret: creds.userSecret,
      redirectURI: process.env.SNAPTRADE_REDIRECT_URI || "http://localhost:5000/snaptrade/callback",
    });

    // 3) Return connect URL
    const connectUrl = (loginLink as any)?.redirectURI ?? (loginLink as any)?.data?.redirectURI;
    if (!connectUrl) {
      return res.status(500).json({ message: "No connect URL from SnapTrade" });
    }

    res.json({ connect: { url: connectUrl } });
  } catch (error) {
    console.error("[SnapTrade] Registration error", {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message: "SnapTrade registration error",
      error: (error as Error).message,
      userId: req.user?.id,
    });
    res.status(500).json({ message: "Failed to register with SnapTrade" });
  }
});

export default r;