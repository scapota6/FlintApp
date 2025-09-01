import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { tellerForUser, accountSupportsZelle, accountSupportsPayments, validateZelleAddress, formatPaymentAmount, generateIdempotencyKey } from "../teller/client";
import { v4 as uuidv4 } from 'uuid';

const r = Router();

/**
 * GET /capability?from=acc_xxx&to=acc_yyy
 * Returns if we should show the "Pay Card" button.
 * Following Teller docs: check payment schemes and account compatibility
 */
r.get("/capability", isAuthenticated, async (req: any, res) => {
  try {
    const { from, to } = req.query as any;
    if (!from || !to) {
      return res.json({ canPay: false, reason: "Missing from/to account IDs" });
    }

    const userId = req.user.claims.sub;
    const teller = await tellerForUser(userId);
    
    // Get account details
    const fromAcc = await teller.accounts.get(from);
    const toAcc = await teller.accounts.get(to);

    // Check account types following Teller docs
    const fromIsDDA = ["checking", "savings"].includes((fromAcc.subtype || "").toLowerCase());
    const toIsCard = (toAcc.subtype || "").toLowerCase() === "credit_card";
    
    if (!fromIsDDA) {
      return res.json({ canPay: false, reason: "Payments can only be made from checking or savings accounts" });
    }
    
    if (!toIsCard) {
      return res.json({ canPay: false, reason: "Payments can only be made to credit card accounts" });
    }

    // Check if source account supports payments using Teller's discovery API
    try {
      const schemes = await teller.payments.discoverSchemes(from);
      const supportsZelle = schemes.schemes.some(scheme => scheme.name === 'zelle');
      
      if (!supportsZelle) {
        return res.json({ canPay: false, reason: "Account does not support Zelle payments" });
      }
      
      return res.json({ 
        canPay: true, 
        schemes: schemes.schemes,
        fromAccount: {
          name: fromAcc.name,
          type: fromAcc.subtype,
          last_four: fromAcc.last_four
        },
        toAccount: {
          name: toAcc.name,
          type: toAcc.subtype,
          last_four: toAcc.last_four
        }
      });
    } catch (discoveryError: any) {
      // If discovery fails, fall back to basic account type check
      if (accountSupportsPayments(fromAcc) && accountSupportsZelle(fromAcc)) {
        return res.json({ 
          canPay: true,
          fallback: true,
          fromAccount: {
            name: fromAcc.name,
            type: fromAcc.subtype,
            last_four: fromAcc.last_four
          },
          toAccount: {
            name: toAcc.name,
            type: toAcc.subtype,
            last_four: toAcc.last_four
          }
        });
      }
      
      return res.json({ 
        canPay: false, 
        reason: "Payment capability check failed",
        error: discoveryError.message
      });
    }
  } catch (e: any) {
    console.error('[Teller Payments] Capability check failed:', e);
    return res.json({ canPay: false, reason: e?.message || "Unknown error" });
  }
});

/**
 * POST /create-payee
 * Create a new payee for future payments
 * Following: https://teller.io/docs/api/account/payments#create-a-payee
 */
r.post("/create-payee", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId, payee } = req.body;
    const userId = req.user.claims.sub;
    
    if (!accountId || !payee) {
      return res.status(400).json({ 
        error: "accountId and payee are required" 
      });
    }
    
    // Validate payee data
    const { scheme, address, name, type } = payee;
    if (!scheme || !address || !name || !type) {
      return res.status(400).json({
        error: "Payee must include scheme, address, name, and type"
      });
    }
    
    // Validate Zelle address
    if (scheme === 'zelle') {
      const validation = validateZelleAddress(address);
      if (!validation.isValid) {
        return res.status(400).json({
          error: "Invalid Zelle address. Must be a valid email or phone number."
        });
      }
    }
    
    const teller = await tellerForUser(userId);
    const result = await teller.payments.createPayee(accountId, payee);
    
    res.json(result);
  } catch (error: any) {
    console.error('[Teller Payments] Create payee failed:', error);
    
    if (error.mfaRequired) {
      return res.status(409).json({
        error: "MFA_REQUIRED",
        message: "Multi-factor authentication required to create payee",
        connect_token: error.requiresConnectToken
      });
    }
    
    res.status(500).json({ 
      error: error.message || "Failed to create payee" 
    });
  }
});

/**
 * POST /initiate
 * Initiate a Zelle payment to credit card
 * Following: https://teller.io/docs/api/account/payments#initiate-a-payment
 */
r.post("/initiate", isAuthenticated, async (req: any, res) => {
  try {
    const { fromAccountId, toAccountId, amount, memo, payeeEmail } = req.body;
    const userId = req.user.claims.sub;
    
    if (!fromAccountId || !toAccountId || !amount || !payeeEmail) {
      return res.status(400).json({
        error: "fromAccountId, toAccountId, amount, and payeeEmail are required"
      });
    }
    
    // Format amount properly
    const formattedAmount = typeof amount === 'number' ? formatPaymentAmount(amount) : amount;
    
    // Validate Zelle address
    const validation = validateZelleAddress(payeeEmail);
    if (!validation.isValid) {
      return res.status(400).json({
        error: "Invalid payee email/phone format"
      });
    }
    
    const teller = await tellerForUser(userId);
    
    // Get target account details for payee name
    const toAccount = await teller.accounts.get(toAccountId);
    
    // Create payment with idempotency
    const idempotencyKey = generateIdempotencyKey();
    
    const payment = {
      amount: formattedAmount,
      memo: memo || `Credit card payment to ${toAccount.name}`,
      payee: {
        scheme: 'zelle',
        address: payeeEmail,
        name: toAccount.name || `${toAccount.institution.name} Account`,
        type: 'business' // Credit card payments are typically business
      },
      idempotencyKey
    };
    
    console.log('[Teller Payments] Initiating payment:', {
      fromAccountId,
      toAccountId: toAccountId.slice(-6),
      amount: formattedAmount,
      payeeType: validation.type,
      idempotencyKey
    });
    
    const result = await teller.payments.create(fromAccountId, payment);
    
    res.json({
      success: true,
      payment: result,
      idempotencyKey
    });
  } catch (error: any) {
    console.error('[Teller Payments] Payment initiation failed:', error);
    
    if (error.mfaRequired) {
      return res.status(409).json({
        error: "MFA_REQUIRED",
        message: "Multi-factor authentication required to complete payment",
        connect_token: error.requiresConnectToken
      });
    }
    
    res.status(500).json({ 
      error: error.message || "Failed to initiate payment" 
    });
  }
});

/**
 * GET /list/:accountId
 * List all payments for an account
 * Following: https://teller.io/docs/api/account/payments#list-payments
 */
r.get("/list/:accountId", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.claims.sub;
    
    const teller = await tellerForUser(userId);
    const payments = await teller.payments.list(accountId);
    
    res.json({ payments });
  } catch (error: any) {
    console.error('[Teller Payments] List payments failed:', error);
    res.status(500).json({ 
      error: error.message || "Failed to list payments" 
    });
  }
});

/**
 * GET /status/:accountId/:paymentId
 * Get payment status
 * Following: https://teller.io/docs/api/account/payments#get-payment
 */
r.get("/status/:accountId/:paymentId", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId, paymentId } = req.params;
    const userId = req.user.claims.sub;
    
    const teller = await tellerForUser(userId);
    const payment = await teller.payments.get(accountId, paymentId);
    
    res.json({ payment });
  } catch (error: any) {
    console.error('[Teller Payments] Get payment status failed:', error);
    res.status(500).json({ 
      error: error.message || "Failed to get payment status" 
    });
  }
});

export default r;