import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { db } from "../db";
import { connectedAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { tellerForUser } from "../teller/client";
import { accountsApi } from "../lib/snaptrade";

const router = Router();

// Fetch detailed account information for Teller/SnapTrade accounts
router.get("/accounts/:accountId/details", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.claims.sub;
    
    console.log('[Account Details] Fetching for account:', accountId, 'user:', userId);
    
    // Try to parse as number for database ID
    const dbId = parseInt(accountId);
    let provider: string | null = null;
    let externalId: string | null = null;
    
    if (!isNaN(dbId)) {
      // It's a database ID - look up the actual external account ID
      const [dbAccount] = await db
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.id, dbId));
        
      if (dbAccount) {
        provider = dbAccount.provider;
        externalId = dbAccount.externalAccountId;
        console.log('[Account Details] Found DB account:', { 
          id: dbId, 
          provider, 
          externalId,
          institutionName: dbAccount.institutionName 
        });
      }
    } else {
      // It's already an external ID - find the provider
      const [dbAccount] = await db
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.externalAccountId, accountId));
        
      if (dbAccount) {
        provider = dbAccount.provider;
        externalId = accountId;
        console.log('[Account Details] Found by external ID:', { 
          provider, 
          externalId,
          institutionName: dbAccount.institutionName 
        });
      }
    }
    
    if (!provider || !externalId) {
      console.log('[Account Details] Account not found:', accountId);
      return res.status(404).json({ message: "Account not found" });
    }
    
    // Fetch details based on provider
    if (provider === 'teller') {
      const teller = await tellerForUser(userId);
      
      try {
        const [account, transactions] = await Promise.all([
          teller.accounts.get(externalId),
          teller.transactions.list({
            account_id: externalId,
            count: 10
          })
        ]);
        
        console.log('[Account Details] Teller response:', {
          hasAccount: !!account,
          transactionCount: transactions?.length || 0
        });
        
        res.json({
          provider: 'teller',
          account: {
            id: account.id,
            name: account.name,
            type: account.type,
            subtype: account.subtype,
            status: account.status,
            institution: account.institution,
            currency: account.currency,
            enrollment_id: account.enrollment_id,
            last_four: account.last_four,
            balance: {
              available: account.balance?.available,
              current: account.balance?.current,
              ledger: account.balance?.ledger
            },
            details: account.details || {}
          },
          transactions: transactions || []
        });
      } catch (error: any) {
        console.error('[Account Details] Teller API error:', error);
        return res.status(500).json({ 
          message: "Failed to fetch account details",
          error: error.message 
        });
      }
    } else if (provider === 'snaptrade') {
      // Get SnapTrade credentials
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get SnapTrade user credentials from separate table
      // Note: This would need a proper table definition in schema.ts
      // For now, let's use a simpler approach by checking if we have snap trade setup
      const snapUser = null; // TODO: Implement proper SnapTrade user lookup
      
      if (!snapUser) {
        console.log('[Account Details] No SnapTrade credentials for user');
        return res.status(400).json({ message: "SnapTrade not connected" });
      }
      
      try {
        // For now, return a stub response since we don't have SnapTrade user lookup implemented
        return res.status(501).json({ message: "SnapTrade account details not implemented yet" });
      } catch (error: any) {
        console.error('[Account Details] SnapTrade API error:', error);
        return res.status(500).json({ 
          message: "Failed to fetch account details",
          error: error.message 
        });
      }
    } else {
      return res.status(400).json({ message: "Unknown provider" });
    }
  } catch (error: any) {
    console.error('[Account Details] Error:', error);
    res.status(500).json({ 
      message: "Failed to fetch account details",
      error: error.message 
    });
  }
});

// Legacy route with provider in path (kept for compatibility)
router.get("/accounts/:provider/:accountId/details", isAuthenticated, async (req: any, res) => {
  try {
    const { provider, accountId } = req.params;
    const userId = req.user.claims.sub;
    
    console.log('[Account Details Legacy] Provider:', provider, 'Account:', accountId);
    
    if (provider === 'teller') {
      const teller = await tellerForUser(userId);
      
      const [account, transactions] = await Promise.all([
        teller.accounts.get(accountId),
        teller.transactions.list({
          account_id: accountId,
          count: 10
        })
      ]);
      
      res.json({
        provider: 'teller',
        account,
        transactions
      });
    } else if (provider === 'snaptrade') {
      // Similar SnapTrade logic as above
      res.json({
        provider: 'snaptrade',
        account: { id: accountId, name: "SnapTrade Account" },
        transactions: []
      });
    } else {
      res.status(400).json({ message: "Invalid provider" });
    }
  } catch (error: any) {
    console.error('[Account Details Legacy] Error:', error);
    res.status(500).json({ 
      message: "Failed to fetch account details",
      error: error.message 
    });
  }
});

export default router;