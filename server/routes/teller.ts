import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { logger } from "@shared/logger";
import { storage } from "../storage";
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/teller/connect-init
 * Initialize Teller Connect flow
 */
router.post("/connect-init", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const applicationId = process.env.TELLER_APPLICATION_ID;
    
    if (!applicationId) {
      return res.status(503).json({ 
        message: "Banking service not configured",
        error: "Teller.io integration is not available"
      });
    }
    
    logger.info("Initializing Teller Connect", { userId });
    
    res.json({
      applicationId,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    });
    
  } catch (error: any) {
    logger.error("Failed to initialize Teller Connect", { error });
    res.status(500).json({ 
      message: "Failed to initialize bank connection",
      error: error.message 
    });
  }
});

/**
 * POST /api/teller/exchange-token
 * Exchange Teller enrollment ID for access token and store account info
 */
router.post("/exchange-token", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { token, enrollmentId } = req.body; // Accept both token and enrollmentId
    
    const tellerToken = token || enrollmentId;
    
    if (!tellerToken) {
      return res.status(400).json({ 
        message: "Token or enrollment ID is required" 
      });
    }
    
    logger.info("Exchanging Teller token", { userId, tokenReceived: !!tellerToken });
    
    // Fetch account details from Teller
    const tellerResponse = await fetch(
      `https://api.teller.io/accounts`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(tellerToken + ":").toString("base64")}`,
        },
      }
    );
    
    if (!tellerResponse.ok) {
      throw new Error(`Teller API error: ${tellerResponse.statusText}`);
    }
    
    const accounts = await tellerResponse.json();
    
    // Store each account in database
    for (const account of accounts) {
      await storage.createConnectedAccount({
        userId,
        provider: 'teller',
        accountType: account.type === 'credit' ? 'card' : 'bank',
        accountName: account.name,
        accountNumber: account.last_four || '',
        balance: String(account.balance?.available || 0),
        currency: account.currency || 'USD',
        institution: account.institution?.name || 'Unknown Bank',
        externalAccountId: account.id,
        connectionId: account.enrollment_id,
        institutionId: account.institution?.id,
        accessToken: tellerToken, // Store enrollment ID as token
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    
    logger.info("Teller accounts connected", { 
      userId, 
      count: accounts.length 
    });
    
    res.json({ 
      success: true,
      accounts: accounts.length,
      message: "Bank accounts connected successfully"
    });
    
  } catch (error: any) {
    logger.error("Teller exchange error", { error: error.message });
    res.status(500).json({ 
      message: "Failed to connect bank accounts",
      error: error.message
    });
  }
});

/**
 * GET /api/teller/accounts
 * Get connected Teller accounts
 */
router.get("/accounts", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    const accounts = await storage.getConnectedAccounts(userId);
    const tellerAccounts = accounts.filter(acc => acc.provider === 'teller');
    
    res.json({ accounts: tellerAccounts });
    
  } catch (error: any) {
    logger.error("Failed to fetch Teller accounts", { error });
    res.status(500).json({ 
      message: "Failed to fetch bank accounts",
      error: error.message 
    });
  }
});

export default router;