import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { connectedAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { tellerForUser } from "../teller/client";

const router = Router();

// Check payment capability between two accounts
router.post("/payment-capability", isAuthenticated, async (req: any, res) => {
  try {
    const { fromAccountId, toAccountId } = req.body;
    const userId = req.user.claims.sub;
    
    if (!fromAccountId || !toAccountId) {
      return res.status(400).json({ 
        canPay: false, 
        reason: "Both fromAccountId and toAccountId are required" 
      });
    }

    console.log('[Payment Capability] Checking payment capability:', {
      fromAccountId, 
      toAccountId, 
      userId
    });

    // Look up both accounts in the database
    const [fromAccount] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.externalAccountId, fromAccountId));

    const [toAccount] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.externalAccountId, toAccountId));

    if (!fromAccount || !toAccount) {
      return res.json({ 
        canPay: false, 
        reason: "One or both accounts not found" 
      });
    }

    // Both accounts must be Teller accounts for payments to work
    if (fromAccount.provider !== 'teller' || toAccount.provider !== 'teller') {
      return res.json({ 
        canPay: false, 
        reason: "Payments only supported between Teller accounts" 
      });
    }

    // From account should be checking or savings
    const validFromTypes = ['checking', 'savings'];
    if (!validFromTypes.includes(fromAccount.accountType?.toLowerCase() || '')) {
      return res.json({ 
        canPay: false, 
        reason: "Payments can only be made from checking or savings accounts" 
      });
    }

    // To account should be credit card
    if (toAccount.accountType?.toLowerCase() !== 'credit') {
      return res.json({ 
        canPay: false, 
        reason: "Payments can only be made to credit card accounts" 
      });
    }

    try {
      const teller = await tellerForUser(userId);
      
      // Check if the from account supports payments
      const fromAccountDetails = await teller.accounts.get(fromAccountId);
      const toAccountDetails = await teller.accounts.get(toAccountId);
      
      // Check if payments are supported
      const fromSupportsPayments = fromAccountDetails.capabilities?.payments_enabled !== false;
      const toSupportsPayments = toAccountDetails.capabilities?.payments_enabled !== false;
      
      if (!fromSupportsPayments) {
        return res.json({ 
          canPay: false, 
          reason: "Source account does not support outgoing payments" 
        });
      }

      if (!toSupportsPayments) {
        return res.json({ 
          canPay: false, 
          reason: "Credit card issuer does not support payments via Zelle/bill-pay" 
        });
      }

      // Check if the institutions support inter-bank payments
      const sameInstitution = fromAccountDetails.institution?.id === toAccountDetails.institution?.id;
      
      return res.json({ 
        canPay: true,
        paymentMethod: sameInstitution ? "internal_transfer" : "zelle_billpay",
        estimatedTime: sameInstitution ? "Instant" : "1-2 business days"
      });

    } catch (error: any) {
      console.error('[Payment Capability] Teller API error:', error);
      return res.json({ 
        canPay: false, 
        reason: "Unable to verify payment capabilities with bank" 
      });
    }

  } catch (error: any) {
    console.error('[Payment Capability] Error:', error);
    res.status(500).json({ 
      canPay: false, 
      reason: "Internal server error" 
    });
  }
});

export default router;