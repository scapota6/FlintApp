import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";
import { TellerService } from "../services/TellerService";
import { db } from "../db";
import { connectedAccounts } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Connect bank account via Teller.io
router.post("/connect", isAuthenticated, async (req: any, res) => {
  try {
    const userEmail = req.user.claims.email;
    const userId = req.user.claims.sub;

    if (!TellerService.isConfigured()) {
      return res.status(500).json({
        success: false,
        message: "Bank account connection is not configured. Please contact support."
      });
    }

    console.log(`🏦 Generating Teller connect URL for user: ${userEmail}`);

    // Generate Teller Connect URL
    const returnUrl = `${req.protocol}://${req.get('host')}/banking/callback`;
    const connectUrl = TellerService.generateConnectUrl(userId, returnUrl);

    res.json({
      success: true,
      connectUrl
    });
  } catch (error: any) {
    console.error('❌ Error generating Teller connect URL:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate connect URL'
    });
  }
});

// Handle Teller.io callback after account connection
router.post("/callback", isAuthenticated, async (req: any, res) => {
  try {
    const { code, state } = req.body;
    const userEmail = req.user.claims.email;
    const userId = req.user.claims.sub;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code required"
      });
    }

    console.log(`🏦 Processing Teller callback for user: ${userEmail}`);

    // Exchange code for access token and account info
    const { accessToken, accountId, institutionName } = await TellerService.exchangeToken(code);

    // Get account details from Teller
    const accountDetails = await TellerService.getAccount(accessToken, accountId);
    const balanceData = await TellerService.getAccountBalance(accessToken, accountId);

    // Store connected account in database
    const connectedAccount = {
      userId,
      provider: 'teller' as const,
      externalAccountId: accountId,
      accountType: accountDetails.type || 'checking',
      accountName: accountDetails.name || `${institutionName} Account`,
      institutionName,
      balance: balanceData.available?.toString() || '0',
      currency: accountDetails.currency || 'USD',
      accessToken: accessToken, // Store encrypted in production
      isActive: true,
      lastSynced: new Date(),
      metadata: {
        mask: accountDetails.mask,
        accountNumber: accountDetails.account_number,
        routingNumber: accountDetails.routing_number
      }
    };

    // Check if account already exists
    const existingAccounts = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.externalAccountId, accountId)
      ));

    let savedAccount;
    if (existingAccounts.length > 0) {
      // Update existing account
      await db
        .update(connectedAccounts)
        .set({
          ...connectedAccount,
          updatedAt: new Date()
        })
        .where(eq(connectedAccounts.id, existingAccounts[0].id));

      savedAccount = { ...existingAccounts[0], ...connectedAccount };
    } else {
      // Create new account
      const [newAccount] = await db
        .insert(connectedAccounts)
        .values(connectedAccount)
        .returning();

      savedAccount = newAccount;
    }

    // Log the connection activity
    await storage.createActivityLog({
      userId,
      action: 'bank_account_connected',
      description: `Connected ${institutionName} account via Teller`,
      metadata: { provider: 'teller', accountId, institutionName }
    });

    console.log(`✅ Bank account connected successfully: ${accountId}`);

    res.json({
      success: true,
      message: 'Bank account connected successfully',
      account: savedAccount
    });
  } catch (error: any) {
    console.error('❌ Error processing Teller callback:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to connect bank account'
    });
  }
});

// Get bank account transactions
router.get("/transactions/:accountId", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const { count = 50, fromId } = req.query;
    const userEmail = req.user.claims.email;
    const userId = req.user.claims.sub;
    
    console.log(`💰 Fetching transactions for account ${accountId} - user: ${userEmail}`);
    
    // Get connected account from database
    const account = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.externalAccountId, accountId),
        eq(connectedAccounts.provider, 'teller')
      ))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const connectedAccount = account[0];
    if (!connectedAccount.accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Bank account access token missing. Please reconnect your account.'
      });
    }

    // Fetch transactions from Teller
    const transactions = await TellerService.getTransactions(
      connectedAccount.accessToken,
      accountId,
      { count: parseInt(count as string), fromId: fromId as string }
    );

    console.log(`💰 Retrieved ${transactions.length} transactions for account ${accountId}`);

    res.json({
      success: true,
      transactions: transactions || []
    });
  } catch (error: any) {
    console.error('❌ Error fetching transactions:', error);
    
    // Handle token expiration or invalid credentials
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      return res.status(401).json({
        success: false,
        message: 'Bank account access has expired. Please reconnect your account.',
        needsReconnect: true
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch transactions' 
    });
  }
});

// Get all connected bank accounts
router.get("/accounts", isAuthenticated, async (req: any, res) => {
  try {
    const userEmail = req.user.claims.email;
    const userId = req.user.claims.sub;
    console.log(`🏦 Fetching bank accounts for user: ${userEmail}`);
    
    // Get connected Teller accounts from database
    const accounts = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.provider, 'teller'),
        eq(connectedAccounts.isActive, true)
      ));

    console.log(`🏦 Found ${accounts.length} connected bank accounts`);

    // For each account, fetch updated balance if possible
    const accountsWithBalance = await Promise.all(accounts.map(async (account) => {
      try {
        if (account.accessToken) {
          const balanceData = await TellerService.getAccountBalance(
            account.accessToken,
            account.externalAccountId
          );
          
          // Update balance in database
          await db
            .update(connectedAccounts)
            .set({
              balance: balanceData.available?.toString() || account.balance,
              lastSynced: new Date()
            })
            .where(eq(connectedAccounts.id, account.id));

          return {
            ...account,
            balance: balanceData.available?.toString() || account.balance,
            availableBalance: balanceData.available,
            ledgerBalance: balanceData.ledger
          };
        }
        return account;
      } catch (error) {
        console.warn(`⚠️ Failed to update balance for account ${account.externalAccountId}:`, error);
        return account;
      }
    }));

    res.json({
      success: true,
      accounts: accountsWithBalance
    });
  } catch (error: any) {
    console.error('❌ Error fetching bank accounts:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch bank accounts' 
    });
  }
});

// Disconnect bank account
router.delete("/accounts/:accountId/disconnect", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    const userId = req.user.claims.sub;
    
    console.log(`🔌 Disconnecting bank account ${accountId} for user: ${userEmail}`);
    
    // Get connected account from database
    const account = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.externalAccountId, accountId),
        eq(connectedAccounts.provider, 'teller')
      ))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const connectedAccount = account[0];

    try {
      // Revoke access with Teller
      if (connectedAccount.accessToken) {
        await TellerService.disconnectAccount(
          connectedAccount.accessToken,
          accountId
        );
      }
    } catch (tellerError) {
      console.warn('⚠️ Failed to revoke Teller access, proceeding with local disconnection:', tellerError);
    }

    // Mark account as inactive in database
    await db
      .update(connectedAccounts)
      .set({
        isActive: false,
        // Clear stored token
      accessToken: null as string | null,
        updatedAt: new Date()
      })
      .where(eq(connectedAccounts.id, connectedAccount.id));

    // Log the disconnection activity
    await storage.createActivityLog({
      userId,
      action: 'bank_account_disconnected',
      description: `Disconnected bank account ${accountId} via Teller`,
      metadata: { provider: 'teller', accountId, institutionName: connectedAccount.institutionName }
    });

    console.log(`✅ Bank account ${accountId} successfully disconnected`);
    
    res.json({ 
      success: true, 
      message: 'Bank account disconnected successfully',
      accountId 
    });
  } catch (error: any) {
    console.error('❌ Error disconnecting account:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to disconnect account' 
    });
  }
});

// Get specific account details
router.get("/accounts/:accountId", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    const userId = req.user.claims.sub;
    
    console.log(`🏦 Fetching details for account ${accountId} - user: ${userEmail}`);
    
    // Get connected account from database
    const account = await db
      .select()
      .from(connectedAccounts)
      .where(and(
        eq(connectedAccounts.userId, userId),
        eq(connectedAccounts.externalAccountId, accountId),
        eq(connectedAccounts.provider, 'teller')
      ))
      .limit(1);

    if (!account.length) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    const connectedAccount = account[0];

    try {
      // Fetch fresh account details from Teller
      if (connectedAccount.accessToken) {
        const [accountDetails, balanceData, identityData] = await Promise.all([
          TellerService.getAccount(connectedAccount.accessToken, accountId),
          TellerService.getAccountBalance(connectedAccount.accessToken, accountId),
          TellerService.getIdentity(connectedAccount.accessToken, accountId).catch(() => null)
        ]);

        const enhancedDetails = {
          ...connectedAccount,
          ...accountDetails,
          balance: balanceData.available,
          availableBalance: balanceData.available,
          ledgerBalance: balanceData.ledger,
          identity: identityData,
          lastUpdated: new Date().toISOString(),
          features: ['online_banking', 'mobile_deposit', 'ach_transfers']
        };

        res.json({
          success: true,
          account: enhancedDetails
        });
      } else {
        // Return stored account data if no access token
        res.json({
          success: true,
          account: connectedAccount
        });
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch fresh account data, returning stored data:', error);
      res.json({
        success: true,
        account: connectedAccount
      });
    }
  } catch (error: any) {
    console.error('❌ Error fetching account details:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch account details' 
    });
  }
});

// Teller webhook endpoint
router.post("/webhooks", async (req: any, res) => {
  try {
    const signature = req.headers['teller-signature'];
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!TellerService.verifyWebhookSignature(payload, signature)) {
      console.warn('⚠️ Invalid Teller webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    console.log('🔔 Teller webhook received:', {
      type: event.type,
      accountId: event.payload?.account_id,
      timestamp: event.timestamp
    });

    // Handle different webhook events
    switch (event.type) {
      case 'account.connected':
        console.log('✅ Account connected webhook:', event.payload.account_id);
        break;
      case 'account.disconnected':
        console.log('🔌 Account disconnected webhook:', event.payload.account_id);
        // Mark account as inactive
        await db
          .update(connectedAccounts)
          .set({ isActive: false })
          .where(eq(connectedAccounts.externalAccountId, event.payload.account_id));
        break;
      case 'transaction.posted':
        console.log('💰 New transaction webhook:', event.payload.transaction_id);
        // Could trigger real-time updates to frontend
        break;
      default:
        console.log('❓ Unknown Teller webhook type:', event.type);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ Error processing Teller webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;