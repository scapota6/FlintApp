import { Router } from "express";
import { authApi } from "../lib/snaptrade";
import { getUser, saveUser, deleteUserLocal } from "../store/snapUsers";
import { isAuthenticated } from "../replitAuth";

const r = Router();

r.post("/register", async (req, res) => {
  try {
    const userId = (req.body?.userEmail || "").toString().trim().toLowerCase();
    if (!userId) return res.status(400).json({ message: "userEmail required" });

    let rec = await getUser(userId);
    let userSecret = rec?.userSecret;

    if (!userSecret) {
      // Register with SnapTrade to get the userSecret
      console.log("[SnapTrade] Registering new user:", userId);
      const registerResponse = await authApi.registerSnapTradeUser({ userId });
      
      // SnapTrade returns { userId, userSecret }
      userSecret = registerResponse.data.userSecret;
      
      if (!userSecret) {
        throw new Error("SnapTrade did not return a userSecret");
      }
      
      // Store SnapTrade's userSecret
      await saveUser({ userId, userSecret });
      console.log("[SnapTrade] Stored SnapTrade userSecret len:", userSecret.length, "for", userId);
    } else {
      console.log("[SnapTrade] Using existing userSecret len:", userSecret.length, "for", userId);
    }

    const connect = await authApi.createSnapTradeLogin({
      userId,
      userSecret,
      brokerRedirectUri: process.env.SNAPTRADE_REDIRECT_URI!,
    });

    return res.json({ connect });
  } catch (err: any) {
    console.error("SnapTrade Registration Error:", err?.responseBody || err?.message || err);
    return res.status(500).json({ message: err?.message || "SnapTrade register failed" });
  }
});

/**
 * Generate connection portal URL for existing user
 */
r.post('/connect', isAuthenticated, async (req: any, res) => {
  try {
    const userEmail = req.user.claims.email?.toLowerCase();
    
    if (!userEmail) {
      return res.status(400).json({ message: 'User email required' });
    }

    // Get existing SnapTrade credentials
    const snaptradeUser = await storage.getSnapTradeUserByEmail(userEmail);
    
    if (!snaptradeUser?.snaptradeUserSecret) {
      return res.status(400).json({ 
        message: 'SnapTrade not registered. Please register first.',
        error: 'NOT_REGISTERED' 
      });
    }

    // Generate connection portal URL
    const connectResponse = await authApi.loginSnapTradeUser({
      userId: userEmail,
      userSecret: snaptradeUser.snaptradeUserSecret,
      brokerRedirectUri: process.env.SNAPTRADE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/snaptrade/callback`,
      customRedirect: process.env.SNAPTRADE_CUSTOM_REDIRECT || `${req.protocol}://${req.get('host')}/dashboard`,
    });

    return res.json({
      success: true,
      connect: connectResponse.data,
      message: 'Connection URL generated'
    });

  } catch (error: any) {
    console.error('SnapTrade Connect Error:', error.response?.data || error);
    return res.status(500).json({ 
      message: error.message || 'Failed to generate connection URL',
      error: error.response?.data || error.message 
    });
  }
});

/**
 * Callback handler after SnapTrade connection
 */
r.get('/callback', async (req, res) => {
  try {
    // SnapTrade redirects back with success/error parameters
    const { success, error } = req.query;
    
    if (success === 'true') {
      // Redirect to dashboard on success
      res.redirect('/dashboard');
    } else {
      // Redirect with error message
      res.redirect(`/?error=${encodeURIComponent(error as string || 'Connection failed')}`);
    }
  } catch (error) {
    console.error('SnapTrade callback error:', error);
    res.redirect('/?error=Callback+processing+failed');
  }
});

/**
 * Get SnapTrade connection status
 */
r.get('/status', isAuthenticated, async (req: any, res) => {
  try {
    const userEmail = req.user.claims.email?.toLowerCase();
    
    if (!userEmail) {
      return res.json({ 
        connected: false,
        message: 'User email not found' 
      });
    }

    const snaptradeUser = await storage.getSnapTradeUserByEmail(userEmail);
    
    res.json({
      connected: !!snaptradeUser?.snaptradeUserSecret,
      hasSecret: !!snaptradeUser?.snaptradeUserSecret,
      userId: snaptradeUser?.snaptradeUserId || null,
    });

  } catch (error) {
    console.error('SnapTrade status check error:', error);
    res.status(500).json({ 
      connected: false,
      error: 'Status check failed' 
    });
  }
});

r.get('/health', async (_req, res) => {
  try {
    // harmless idempotent call to test signatures/keys
    await authApi.registerSnapTradeUser({
      userId: 'healthcheck@flint-investing.com',
      userSecret: 'healthcheck-secret-1234567890',
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.responseBody || e?.message });
  }
});

// DEV ONLY - remove in prod
r.post("/reset-user", async (req, res) => {
  try {
    const userId = (req.body?.userEmail || "").toString().trim().toLowerCase();
    if (!userId) return res.status(400).json({ message: "userEmail required" });

    // generate new local secret
    const newSecret = generateUserSecret();
    await upsertSnapUserSecret(userId, newSecret);

    // try to register with new secret (must match provider-side)
    await authApi.registerSnapTradeUser({ userId, userSecret: newSecret });

    res.json({ ok: true, userId, userSecretLen: newSecret.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.responseBody || e?.message });
  }
});

export default r;