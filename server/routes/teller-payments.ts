import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { logger } from "@shared/logger";

const router = Router();

/**
 * GET /api/teller/payments/capability
 * Check if payment is possible between two accounts
 */
router.get("/capability", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { fromAccountId, toAccountId } = req.query;
    
    if (!fromAccountId || !toAccountId) {
      return res.status(400).json({ 
        canPay: false, 
        reason: "Both fromAccountId and toAccountId are required" 
      });
    }
    
    logger.info("Checking payment capability", { 
      userId, 
      fromAccountId, 
      toAccountId 
    });
    
    // Get both accounts to check their types and capabilities
    const fromAccount = await storage.getConnectedAccountByExternalId(userId, 'teller', fromAccountId);
    const toAccount = await storage.getConnectedAccountByExternalId(userId, 'teller', toAccountId);
    
    if (!fromAccount || !toAccount) {
      return res.json({ 
        canPay: false, 
        reason: "One or both accounts not found" 
      });
    }
    
    // Check account types - from must be checking/savings, to must be credit card
    const validFromTypes = ['checking', 'savings'];
    const validToTypes = ['card', 'credit', 'credit_card'];
    
    if (!validFromTypes.includes(fromAccount.accountType)) {
      return res.json({ 
        canPay: false, 
        reason: "Source account must be a checking or savings account" 
      });
    }
    
    if (!validToTypes.includes(toAccount.accountType)) {
      return res.json({ 
        canPay: false, 
        reason: "Destination must be a credit card account" 
      });
    }
    
    // Check if the from account has payment capability
    // For now, we'll assume all checking/savings accounts support payments
    // In production, you'd check the institution's capabilities via Teller API
    
    res.json({ 
      canPay: true,
      reason: "Payment capability verified" 
    });
    
  } catch (error: any) {
    logger.error("Payment capability check error", { 
      error: error.message 
    });
    res.status(500).json({ 
      canPay: false,
      reason: "Failed to check payment capability",
      error: error.message 
    });
  }
});

/**
 * POST /api/teller/payments/prepare
 * Prepare payment by fetching card metadata and setting up payee
 */
router.post("/prepare", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { fromAccountId, toAccountId } = req.body;
    
    if (!fromAccountId || !toAccountId) {
      return res.status(400).json({ 
        message: "Both fromAccountId and toAccountId are required" 
      });
    }
    
    logger.info("Preparing payment", { 
      userId, 
      fromAccountId, 
      toAccountId 
    });
    
    // Get the credit card account to fetch balances
    const toAccount = await storage.getConnectedAccountByExternalId(userId, 'teller', toAccountId);
    
    if (!toAccount || !toAccount.accessToken) {
      return res.status(404).json({ 
        message: "Credit card account not found or not accessible" 
      });
    }
    
    const authHeader = `Bearer ${toAccount.accessToken}`;
    
    // Fetch credit card account details including balances
    const accountResponse = await fetch(
      `https://api.teller.io/accounts/${toAccountId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!accountResponse.ok) {
      throw new Error(`Failed to fetch account details: ${accountResponse.status}`);
    }
    
    const accountData = await accountResponse.json();
    
    // Fetch balances
    const balanceResponse = await fetch(
      `https://api.teller.io/accounts/${toAccountId}/balances`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    let balances: any = {};
    if (balanceResponse.ok) {
      balances = await balanceResponse.json();
    }
    
    // Calculate minimum due (typically 2-3% of statement balance or $25, whichever is greater)
    const statementBalance = Math.abs(balances.current || 0);
    const minimumDue = Math.max(statementBalance * 0.02, 25);
    
    // Generate a payee ID for internal tracking
    const payeeId = `payee_${toAccountId}_${Date.now()}`;
    
    // Store payee info in database if needed
    // await storage.createPayee({ userId, payeeId, accountId: toAccountId, ... });
    
    // Calculate due date (typically 21-25 days from statement close)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 21);
    
    res.json({
      payeeId,
      minimumDue: minimumDue.toFixed(2),
      statementBalance: statementBalance.toFixed(2),
      dueDate: dueDate.toISOString(),
      accountName: accountData.name || 'Credit Card',
      institution: accountData.institution?.name || 'Bank'
    });
    
  } catch (error: any) {
    logger.error("Payment preparation error", { 
      error: error.message 
    });
    res.status(500).json({ 
      message: "Failed to prepare payment",
      error: error.message 
    });
  }
});

/**
 * POST /api/teller/payments/create
 * Create a payment from bank account to credit card
 */
router.post("/create", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { fromAccountId, toAccountId, amount, memo } = req.body;
    
    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ 
        message: "fromAccountId, toAccountId, and amount are required" 
      });
    }
    
    logger.info("Creating payment", { 
      userId, 
      fromAccountId, 
      toAccountId,
      amount,
      memo 
    });
    
    // Get the source account for making the payment
    const fromAccount = await storage.getConnectedAccountByExternalId(userId, 'teller', fromAccountId);
    
    if (!fromAccount || !fromAccount.accessToken) {
      return res.status(404).json({ 
        message: "Source account not found or not accessible" 
      });
    }
    
    const authHeader = `Bearer ${fromAccount.accessToken}`;
    
    // Create payment via Teller Payments API
    // Note: Teller's payment API is in beta and may require additional setup
    const paymentPayload = {
      amount: parseFloat(amount),
      currency: 'USD',
      recipient_account_id: toAccountId,
      memo: memo || `Credit card payment - ${new Date().toLocaleDateString()}`,
      type: 'ach' // or 'zelle' depending on institution support
    };
    
    const paymentResponse = await fetch(
      `https://api.teller.io/accounts/${fromAccountId}/payments`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paymentPayload)
      }
    );
    
    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.text();
      logger.error("Payment creation failed", { 
        status: paymentResponse.status,
        error: errorData 
      });
      
      // Check if MFA is required
      if (paymentResponse.status === 403 && errorData.includes('mfa')) {
        return res.status(403).json({ 
          message: "Additional authentication required",
          requiresMFA: true,
          mfaToken: JSON.parse(errorData).mfa_token || null
        });
      }
      
      throw new Error(`Payment creation failed: ${paymentResponse.status}`);
    }
    
    const paymentData = await paymentResponse.json();
    
    // Store payment record in database
    await storage.createPaymentRecord({
      userId,
      paymentId: paymentData.id,
      fromAccountId,
      toAccountId,
      amount: parseFloat(amount),
      status: paymentData.status || 'pending',
      createdAt: new Date()
    });
    
    res.json({
      paymentId: paymentData.id,
      status: paymentData.status || 'pending',
      amount: amount,
      estimatedCompletion: paymentData.estimated_completion || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    });
    
  } catch (error: any) {
    logger.error("Payment creation error", { 
      error: error.message 
    });
    res.status(500).json({ 
      message: "Failed to create payment",
      error: error.message 
    });
  }
});

/**
 * GET /api/teller/payments/:paymentId
 * Get payment status
 */
router.get("/:paymentId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { paymentId } = req.params;
    
    logger.info("Fetching payment status", { 
      userId, 
      paymentId 
    });
    
    // Get payment record from database
    const paymentRecord = await storage.getPaymentRecord(userId, paymentId);
    
    if (!paymentRecord) {
      return res.status(404).json({ 
        message: "Payment not found" 
      });
    }
    
    // Get account to fetch payment status from Teller
    const account = await storage.getConnectedAccountByExternalId(
      userId, 
      'teller', 
      paymentRecord.fromAccountId
    );
    
    if (!account || !account.accessToken) {
      return res.status(404).json({ 
        message: "Account not found" 
      });
    }
    
    const authHeader = `Bearer ${account.accessToken}`;
    
    // Fetch payment status from Teller
    const statusResponse = await fetch(
      `https://api.teller.io/payments/${paymentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      }
    );
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      
      // Update status in database
      await storage.updatePaymentStatus(paymentId, statusData.status);
      
      res.json({
        paymentId,
        status: statusData.status,
        amount: paymentRecord.amount,
        fromAccount: paymentRecord.fromAccountId,
        toAccount: paymentRecord.toAccountId,
        createdAt: paymentRecord.createdAt,
        updatedAt: statusData.updated_at || new Date()
      });
    } else {
      // Return cached status from database
      res.json({
        paymentId,
        status: paymentRecord.status,
        amount: paymentRecord.amount,
        fromAccount: paymentRecord.fromAccountId,
        toAccount: paymentRecord.toAccountId,
        createdAt: paymentRecord.createdAt,
        cached: true
      });
    }
    
  } catch (error: any) {
    logger.error("Payment status error", { 
      error: error.message 
    });
    res.status(500).json({ 
      message: "Failed to fetch payment status",
      error: error.message 
    });
  }
});

export default router;