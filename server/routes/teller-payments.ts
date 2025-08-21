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
    const teller = await tellerForUser(userId);
    
    // Create payment via Payments API (Zelle)
    // Exact shape depends on Teller SDK; follow Payments doc:
    // POST /accounts/:fromAccountId/payments  { amount, payee/contact for card issuer, memo }
    const payment = await teller.payments.create(fromAccountId, {
      amount: parseFloat(amount),
      currency: 'USD',
      // payee/contact fields here if required (Zelle email/phone or bank-provided payee id)
      destinationAccountId: toAccountId, // if SDK allows direct account-to-account within same user
      memo: memo || 'Credit card payment from Flint',
    });
    
    res.json({ paymentId: payment.id, status: payment.status });
    
  } catch (e: any) {
    // If Teller asks to complete MFA via Connect, surface that token to the client
    if (e?.requiresConnectToken) {
      return res.status(409).json({ step: 'mfa', connectToken: e.requiresConnectToken });
    }
    res.status(400).json({ message: 'Failed to create payment', error: e.message || e });
  }
});

/**
 * GET /api/teller/payments/:paymentId
 * Get payment status
 */
router.get("/:paymentId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const teller = await tellerForUser(userId);
    const p = await teller.payments.get(req.params.paymentId);
    res.json({ status: p.status, payment: p });
  } catch (e: any) {
    res.status(404).json({ message: 'Payment not found', error: e.message || e });
  }
});

export default router;

function toLower(x?: string) { return (x || '').toLowerCase(); }