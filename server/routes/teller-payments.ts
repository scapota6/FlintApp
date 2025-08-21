import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { tellerForUser, toLower } from "../teller/client";
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
    const { fromAccountId, toAccountId } = req.query as any;
    
    if (!fromAccountId || !toAccountId) {
      return res.json({ 
        canPay: false, 
        reason: "Both fromAccountId and toAccountId are required" 
      });
    }
    
    logger.info("Checking payment capability", { userId });
    
    const teller = await tellerForUser(userId);
    
    try {
      const from = await teller.accounts.get(fromAccountId);
      const to = await teller.accounts.get(toAccountId);
      
      // Check account subtypes
      if (!['checking', 'savings'].includes(toLower(from.subtype))) {
        return res.json({ 
          canPay: false, 
          reason: 'Funding account must be checking or savings' 
        });
      }
      
      if (toLower(to.subtype) !== 'credit_card' && toLower(to.type) !== 'credit') {
        return res.json({ 
          canPay: false, 
          reason: 'Destination must be a credit card account' 
        });
      }
      
      // If we get here, accounts are valid types for payment
      return res.json({ canPay: true });
      
    } catch (e: any) {
      return res.json({ 
        canPay: false, 
        reason: e.message || 'Capability unknown' 
      });
    }
    
  } catch (error: any) {
    logger.error("Payment capability check error", { 
      error: error.message 
    });
    return res.json({ 
      canPay: false,
      reason: error.message || 'Failed to check payment capability'
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
    
    logger.info("Preparing payment", { userId });
    
    const teller = await tellerForUser(userId);
    
    // Get the credit card account - may include statement/min due fields
    const card = await teller.accounts.get(toAccountId);
    
    // Try to get balances, but don't fail if unavailable
    const balances = await teller.balances.get(toAccountId).catch(() => ({} as any));
    
    // If your integration requires a payee object (Zelle contact) create/lookup here:
    // const payee = await teller.payees.ensure({ accountId: fromAccountId, ...issuerContact });
    const payeeId = null; // optional depending on SDK style
    
    // Extract payment details from card or balances objects
    // Use nullish coalescing to safely access nested fields
    const minimumDue = (card as any)?.minimum_payment_due ?? balances?.minimum_payment_due ?? null;
    const statementBalance = balances?.statement ?? balances?.current ?? null;
    const dueDate = (card as any)?.payment_due_date ?? null;
    
    res.json({ 
      payeeId, 
      minimumDue, 
      statementBalance, 
      dueDate,
      accountName: card.name || 'Credit Card',
      institution: card.institution?.name || 'Bank'
    });
    
  } catch (error: any) {
    logger.error("Payment preparation error", { 
      error: error.message 
    });
    res.status(400).json({ 
      message: "Failed to prepare payment",
      error: error.message || error 
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
    
    logger.info("Creating payment", { userId });
    
    const teller = await tellerForUser(userId);
    
    // Create payment via Teller Payments API
    // Note: Teller's payment API is in beta and uses Zelle as the current scheme
    const paymentPayload = {
      amount: parseFloat(amount),
      currency: 'USD',
      recipient_account_id: toAccountId,
      memo: memo || `Credit card payment - ${new Date().toLocaleDateString()}`,
      type: 'zelle' // Teller Payments uses Zelle scheme
    };
    
    try {
      const paymentData = await teller.payments.create(fromAccountId, paymentPayload);
      
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
      
    } catch (paymentError: any) {
      // Check if MFA is required
      if (paymentError.message?.includes('403') || paymentError.message?.includes('mfa')) {
        return res.status(403).json({ 
          message: "Additional authentication required",
          requiresMFA: true,
          error: "Please complete MFA in your bank app"
        });
      }
      
      throw paymentError;
    }
    
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
    
    logger.info("Fetching payment status", { userId });
    
    // Get payment record from database
    const paymentRecord = await storage.getPaymentRecord(userId, paymentId);
    
    if (!paymentRecord) {
      // Try to fetch directly from Teller
      try {
        const teller = await tellerForUser(userId);
        const statusData = await teller.payments.get(paymentId);
        
        return res.json({
          paymentId,
          status: statusData.status,
          amount: statusData.amount,
          createdAt: statusData.created_at,
          updatedAt: statusData.updated_at || new Date()
        });
      } catch (e) {
        return res.status(404).json({ 
          message: "Payment not found" 
        });
      }
    }
    
    try {
      const teller = await tellerForUser(userId);
      const statusData = await teller.payments.get(paymentId);
      
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
    } catch (fetchError) {
      // Return cached status from database if Teller fetch fails
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