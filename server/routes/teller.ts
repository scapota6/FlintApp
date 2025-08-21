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
      logger.error(`Teller API error: ${tellerResponse.status}`, { 
        error: new Error(errorText)
      });
      throw new Error(`Teller API error: ${tellerResponse.status} - ${errorText}`);
    }
    
    const accounts = await tellerResponse.json();
    logger.info(`Teller accounts fetched: ${accounts.length} accounts`);
    
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
      action: 'transfer',
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
      action: 'payment',
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
          `https://api.teller.io/accounts/${account.externalAccountId}/balances`,
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
            available: data.available,
            current: data.current,
            type: account.accountType
          });
        }
      } catch (err) {
        logger.error(`Failed to fetch balance for account: ${account.externalAccountId}`, { 
          error: err as Error
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

/**
 * GET /api/teller/identity
 * Get beneficial owner identity information for connected accounts
 */
router.get("/identity", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Get all connected Teller accounts
    const accounts = await storage.getConnectedAccountsByProvider(userId, 'teller');
    
    if (accounts.length === 0) {
      return res.json({ identity: [] });
    }
    
    // Use the first account's token to get identity info
    const authHeader = `Basic ${Buffer.from(accounts[0].accessToken + ":").toString("base64")}`;
    
    const response = await fetch(
      'https://api.teller.io/identity',
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch identity: ${response.status}`);
    }
    
    const identityData = await response.json();
    res.json({ identity: identityData });
    
  } catch (error: any) {
    logger.error("Failed to fetch identity", { error: error.message });
    res.status(500).json({ 
      message: "Failed to fetch identity information",
      error: error.message 
    });
  }
});

/**
 * GET /api/teller/account/:accountId/details
 * Get detailed account information including routing/account numbers
 */
router.get("/account/:accountId/details", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { accountId } = req.params;
    
    // Get account with access token
    const account = await storage.getConnectedAccountByExternalId(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ message: "Account not found" });
    }
    
    const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
    
    const response = await fetch(
      `https://api.teller.io/accounts/${accountId}/details`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch details: ${response.status}`);
    }
    
    const details = await response.json();
    res.json({ details });
    
  } catch (error: any) {
    logger.error("Failed to fetch account details", { error: error.message });
    res.status(500).json({ 
      message: "Failed to fetch account details",
      error: error.message 
    });
  }
});

/**
 * GET /api/teller/institutions
 * List all supported financial institutions
 */
router.get("/institutions", async (req, res) => {
  try {
    const response = await fetch('https://api.teller.io/institutions', {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch institutions: ${response.status}`);
    }
    
    const institutions = await response.json();
    res.json({ institutions });
    
  } catch (error: any) {
    logger.error("Failed to fetch institutions", { error: error.message });
    res.status(500).json({ 
      message: "Failed to fetch institutions",
      error: error.message 
    });
  }
});

/**
 * POST /api/teller/webhook
 * Handle Teller webhook events
 */
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers['teller-signature'] as string;
    
    if (!signature) {
      return res.status(401).json({ message: "Missing signature" });
    }
    
    // Parse signature header: t=timestamp,v1=signature
    const signatureMatch = signature.match(/t=(\d+),v1=([a-f0-9]+)/);
    if (!signatureMatch) {
      return res.status(401).json({ message: "Invalid signature format" });
    }
    
    const [, timestamp, receivedSignature] = signatureMatch;
    
    // Verify timestamp (reject if older than 3 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const signatureTime = parseInt(timestamp, 10);
    if (currentTime - signatureTime > 180) {
      return res.status(401).json({ message: "Signature expired" });
    }
    
    // TODO: Verify signature with webhook secret once configured
    // For now, just process the webhook
    
    const { id, type, payload, timestamp: eventTime } = req.body;
    
    logger.info(`Received Teller webhook: ${type}`);
    
    switch (type) {
      case 'enrollment.disconnected':
        // Handle disconnected enrollment
        const { enrollment_id, reason } = payload;
        logger.warn(`Enrollment disconnected: ${enrollment_id} - ${reason}`);
        
        // Mark accounts as disconnected in database
        await storage.markEnrollmentDisconnected(enrollment_id, reason);
        break;
        
      case 'transactions.processed':
        // Handle processed transactions
        const { transactions } = payload;
        logger.info(`Transactions processed: ${transactions.length} transactions`);
        
        // Store or update transactions in database
        for (const transaction of transactions) {
          await storage.upsertTransaction(transaction);
        }
        break;
        
      case 'account.number_verification.processed':
        // Handle account verification
        const { account_id, status } = payload;
        logger.info(`Account verification processed: ${account_id} - ${status}`);
        
        // Update account verification status
        await storage.updateAccountVerificationStatus(account_id, status);
        break;
        
      case 'webhook.test':
        // Test webhook
        logger.info("Test webhook received");
        break;
        
      default:
        logger.warn(`Unknown webhook type: ${type}`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.json({ received: true });
    
  } catch (error: any) {
    logger.error("Webhook processing error", { error: error.message });
    // Still respond with 200 to prevent retries
    res.json({ received: true, error: error.message });
  }
});

/**
 * POST /api/teller/payments
 * Initiate ACH payment from account
 */
router.post("/payments", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { 
      accountId, 
      amount, 
      recipientName, 
      recipientRoutingNumber, 
      recipientAccountNumber,
      description 
    } = req.body;
    
    if (!accountId || !amount || !recipientName || !recipientRoutingNumber || !recipientAccountNumber) {
      return res.status(400).json({ 
        message: "Missing required payment information" 
      });
    }
    
    // Get account with access token
    const account = await storage.getConnectedAccountByExternalId(accountId);
    if (!account || account.userId !== userId) {
      return res.status(404).json({ message: "Account not found" });
    }
    
    const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
    
    // Create ACH payment via Teller
    const response = await fetch(
      `https://api.teller.io/accounts/${accountId}/payments`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          amount,
          recipient: {
            name: recipientName,
            routing_number: recipientRoutingNumber,
            account_number: recipientAccountNumber
          },
          description
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Payment failed: ${response.status} - ${errorData}`);
    }
    
    const payment = await response.json();
    
    // Log the payment
    await storage.createActivity({
      userId,
      action: 'ach_payment',
      description: `ACH payment: $${amount} to ${recipientName}`,
      metadata: payment,
      createdAt: new Date()
    });
    
    res.json({ 
      success: true,
      payment,
      message: "ACH payment initiated successfully"
    });
    
  } catch (error: any) {
    logger.error("ACH payment failed", { error: error.message });
    res.status(500).json({ 
      message: "Failed to initiate ACH payment",
      error: error.message 
    });
  }
});

/**
 * GET /api/teller/enrollment/:enrollmentId/status
 * Check enrollment connection status
 */
router.get("/enrollment/:enrollmentId/status", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { enrollmentId } = req.params;
    
    // Get account by enrollment ID
    const accounts = await storage.getConnectedAccountsByProvider(userId, 'teller');
    const account = accounts.find(acc => acc.connectionId === enrollmentId);
    
    if (!account) {
      return res.status(404).json({ message: "Enrollment not found" });
    }
    
    const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
    
    // Try to fetch account to check if connection is still valid
    const response = await fetch(
      `https://api.teller.io/accounts/${account.externalAccountId}`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    const status = response.ok ? 'connected' : 'disconnected';
    const statusCode = response.status;
    
    res.json({ 
      enrollmentId,
      status,
      statusCode,
      accountId: account.externalAccountId
    });
    
  } catch (error: any) {
    logger.error("Failed to check enrollment status", { error: error.message });
    res.status(500).json({ 
      message: "Failed to check enrollment status",
      error: error.message 
    });
  }
});

export default router;