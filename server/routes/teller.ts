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
    
    // Build the callback URL for Teller redirect
    const redirectUri = `${req.protocol}://${req.get('host')}/teller/callback`;
    
    res.json({
      applicationId,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      redirectUri
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
    
    logger.info("Exchanging Teller token", { userId });
    
    // Use enrollment ID as Basic Auth username (per Teller docs)
    const authHeader = `Basic ${Buffer.from(tellerToken + ":").toString("base64")}`;
    
    logger.info("Fetching Teller accounts with enrollment ID");
    
    // Fetch account details from Teller
    const tellerResponse = await fetch(
      'https://api.teller.io/accounts',
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!tellerResponse.ok) {
      const errorText = await tellerResponse.text();
      logger.error("Teller API error", { 
        status: tellerResponse.status,
        error: errorText 
      });
      throw new Error(`Teller API error: ${tellerResponse.status} - ${errorText}`);
    }
    
    const accounts = await tellerResponse.json();
    logger.info("Teller accounts fetched", { count: accounts.length });
    
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
        institutionName: account.institution?.name || 'Unknown Bank',
        externalAccountId: account.id,
        connectionId: account.enrollment_id,
        institutionId: account.institution?.id,
        accessToken: tellerToken, // Store enrollment ID as token
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    
    logger.info("Teller accounts connected", { 
      userId
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

/**
 * GET /api/teller/transactions/:accountId
 * Get transactions for a specific account
 */
router.get("/transactions/:accountId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { accountId } = req.params;
    
    // Get account with access token
    const account = await storage.getConnectedAccountByExternalId(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ message: "Account not found" });
    }
    
    // Fetch transactions from Teller
    const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
    const response = await fetch(
      `https://api.teller.io/accounts/${accountId}/transactions`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.status}`);
    }
    
    const transactions = await response.json();
    res.json({ transactions });
    
  } catch (error: any) {
    logger.error("Failed to fetch transactions", { error: error.message });
    res.status(500).json({ 
      message: "Failed to fetch transactions",
      error: error.message 
    });
  }
});

/**
 * POST /api/teller/transfer
 * Initiate a bank transfer (ACH)
 */
router.post("/transfer", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { fromAccountId, toAccountId, amount, description } = req.body;
    
    if (!fromAccountId || !amount) {
      return res.status(400).json({ 
        message: "From account and amount are required" 
      });
    }
    
    // Get source account
    const fromAccount = await storage.getConnectedAccountByExternalId(fromAccountId);
    if (!fromAccount || fromAccount.userId !== userId) {
      return res.status(404).json({ message: "Source account not found" });
    }
    
    // For demo purposes, we'll simulate the transfer
    // In production, you would use Teller's ACH API
    const transfer = {
      id: `transfer_${Date.now()}`,
      from: fromAccountId,
      to: toAccountId,
      amount,
      description,
      status: 'pending',
      createdAt: new Date()
    };
    
    // Log the transfer
    await storage.createActivity({
      userId,
      type: 'transfer',
      description: `Transfer initiated: $${amount} from ${fromAccount.accountName}`,
      metadata: transfer,
      createdAt: new Date()
    });
    
    res.json({ 
      success: true,
      transfer,
      message: "Transfer initiated successfully"
    });
    
  } catch (error: any) {
    logger.error("Transfer failed", { error: error.message });
    res.status(500).json({ 
      message: "Failed to initiate transfer",
      error: error.message 
    });
  }
});

/**
 * POST /api/teller/pay-card
 * Make a credit card payment
 */
router.post("/pay-card", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { cardAccountId, fromAccountId, amount } = req.body;
    
    if (!cardAccountId || !fromAccountId || !amount) {
      return res.status(400).json({ 
        message: "Card account, source account, and amount are required" 
      });
    }
    
    // Get both accounts
    const cardAccount = await storage.getConnectedAccountByExternalId(cardAccountId);
    const bankAccount = await storage.getConnectedAccountByExternalId(fromAccountId);
    
    if (!cardAccount || cardAccount.userId !== userId) {
      return res.status(404).json({ message: "Card account not found" });
    }
    
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(404).json({ message: "Bank account not found" });
    }
    
    // Simulate credit card payment
    // In production, you would use Teller's payment API
    const payment = {
      id: `payment_${Date.now()}`,
      cardAccount: cardAccountId,
      fromAccount: fromAccountId,
      amount,
      status: 'processing',
      createdAt: new Date()
    };
    
    // Log the payment
    await storage.createActivity({
      userId,
      type: 'payment',
      description: `Credit card payment: $${amount} to ${cardAccount.accountName}`,
      metadata: payment,
      createdAt: new Date()
    });
    
    res.json({ 
      success: true,
      payment,
      message: "Credit card payment initiated"
    });
    
  } catch (error: any) {
    logger.error("Card payment failed", { error: error.message });
    res.status(500).json({ 
      message: "Failed to process card payment",
      error: error.message 
    });
  }
});

/**
 * GET /api/teller/balances
 * Get real-time balances for all connected accounts
 */
router.get("/balances", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get all connected Teller accounts
    const accounts = await storage.getConnectedAccountsByProvider(userId, 'teller');
    
    const balances = [];
    for (const account of accounts) {
      const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
      
      try {
        const response = await fetch(
          `https://api.teller.io/accounts/${account.externalAccountId}`,
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          balances.push({
            accountId: account.externalAccountId,
            accountName: account.accountName,
            balance: data.balance,
            type: account.accountType
          });
        }
      } catch (err) {
        logger.error("Failed to fetch balance for account", { 
          accountId: account.externalAccountId,
          error: err 
        });
      }
    }
    
    res.json({ balances });
    
  } catch (error: any) {
    logger.error("Failed to fetch balances", { error: error.message });
    res.status(500).json({ 
      message: "Failed to fetch balances",
      error: error.message 
    });
  }
});

export default router;