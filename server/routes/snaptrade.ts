/**
 * SnapTrade API routes - Fixed authentication flow
 */
import { Router } from 'express';
import { authApi } from '../lib/snaptrade';
import { generateUserSecret } from '../lib/crypto';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

const router = Router();

/**
 * Register or return SnapTrade user - idempotent
 * Creates a new SnapTrade user or returns existing connection URL
 */
router.post('/register', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub; // Flint user ID
    const userEmail = req.user.claims.email?.toLowerCase();
    
    if (!userEmail) {
      return res.status(400).json({ message: 'User email required' });
    }

    console.log('SnapTrade registration for:', userEmail);

    // 1) Fetch or create secret for this user
    let snaptradeUser = await storage.getSnapTradeUserByEmail(userEmail);
    let userSecret = snaptradeUser?.snaptradeUserSecret;
    
    if (!userSecret) {
      // Generate new secret and save it
      userSecret = generateUserSecret();
      await storage.upsertSnapTradeUser(userId, userEmail, userSecret);
      console.log('Generated new SnapTrade secret for user:', userEmail);
    } else {
      console.log('Using existing SnapTrade secret for user:', userEmail);
    }

    // 2) Ensure user exists at SnapTrade (idempotent call)
    try {
      const registerResponse = await authApi.registerUser({
        userId: userEmail, // Use email as SnapTrade userId
        userSecret: userSecret,
      });
      console.log('SnapTrade user registered/verified:', userEmail);
    } catch (error: any) {
      // 409 means user already exists, which is fine
      if (error.response?.status === 409) {
        console.log('SnapTrade user already exists:', userEmail);
      } else {
        throw error;
      }
    }

    // 3) Generate connection portal URL
    const connectResponse = await authApi.loginSnapTradeUser({
      userId: userEmail,
      userSecret: userSecret,
      brokerRedirectUri: process.env.SNAPTRADE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/snaptrade/callback`,
      customRedirect: process.env.SNAPTRADE_CUSTOM_REDIRECT || `${req.protocol}://${req.get('host')}/dashboard`,
    });

    return res.json({
      success: true,
      connect: connectResponse.data,
      message: 'SnapTrade registration successful'
    });

  } catch (error: any) {
    console.error('SnapTrade Registration Error:', error.response?.data || error);
    return res.status(500).json({ 
      message: error.message || 'SnapTrade registration failed',
      error: error.response?.data || error.message 
    });
  }
});

/**
 * Generate connection portal URL for existing user
 */
router.post('/connect', isAuthenticated, async (req: any, res) => {
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
router.get('/callback', async (req, res) => {
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
router.get('/status', isAuthenticated, async (req: any, res) => {
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

export default router;