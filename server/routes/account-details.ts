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
router.get("/accounts/:accountId/details", async (req: any, res) => {
  try {
    const { accountId } = req.params;
    // Support both authentication methods
    const userId = req.user?.claims?.sub || req.headers['x-user-id'];
    
    console.log('[Account Details API] Request:', {
      path: req.originalUrl,
      accountId,
      userId,
      hasAuthHeader: !!req.headers['x-user-id'],
      hasSession: !!req.user
    });
    
    if (!userId) {
      console.log('[Account Details API] Failed: No user ID (401)');
      return res.status(401).json({ 
        message: 'Unauthorized',
        code: 'NO_USER_ID' 
      });
    }
    
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
        console.log('[Account Details API] Account resolved:', { 
          userId,
          flintAccountId: dbId,
          tellerAccountId: externalId,
          provider, 
          institution: dbAccount.institutionName 
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
        console.log('[Account Details API] Account found by external ID:', { 
          userId,
          flintAccountId: dbAccount.id,
          tellerAccountId: externalId,
          provider,
          institution: dbAccount.institutionName 
        });
      }
    }
    
    if (!provider || !externalId) {
      console.log('[Account Details API] Failed: Account not found (404)', { 
        userId,
        requestedAccountId: accountId,
        reason: 'No matching account in database'
      });
      return res.status(404).json({ 
        message: "Account not found",
        code: 'ACCOUNT_NOT_FOUND',
        accountId 
      });
    }
    
    // Fetch details based on provider
    if (provider === 'teller') {
      try {
        const teller = await tellerForUser(userId);
        
        // Step 1: Get account metadata
        const account = await teller.accounts.get(externalId);
        
        // Step 2-4: Get balances, transactions, and details in parallel
        const [balances, transactions, accountDetails] = await Promise.all([
          teller.balances.get(externalId).catch(() => null), // Gracefully handle if balances fail
          teller.transactions.list({
            account_id: externalId,
            count: 90 // Get 90 days of transactions
          }).catch(() => []), // Return empty array if transactions fail
          teller.details.get(externalId).catch(() => null) // Get routing/masked numbers if available
        ]);
        
        // Note: Statements API would be called here if available
        // const statements = await teller.statements?.list(externalId).catch(() => []);
        
        // Update stored balance in database if we successfully fetched fresh balance
        if (balances?.available && dbId) {
          try {
            await storage.updateAccountBalance(dbId, balances.available.toString());
            console.log('[Account Details API] Updated stored balance:', {
              accountId: dbId,
              newBalance: balances.available,
              lastSynced: new Date().toISOString()
            });
          } catch (error) {
            console.error('[Account Details API] Failed to update balance:', error);
          }
        }

        console.log('[Account Details API] Teller data fetched successfully:', {
          userId,
          flintAccountId: dbId,
          tellerAccountId: externalId,
          provider: 'teller',
          hasAccount: !!account,
          hasBalances: !!balances,
          transactionCount: transactions?.length || 0,
          hasDetails: !!accountDetails,
          httpStatus: 200
        });
        
        // For credit cards, extract comprehensive payment and credit information
        let creditCardInfo = null;
        if (account.type === 'credit' || account.subtype === 'credit_card') {
          console.log('[Credit Card Debug] Raw data:', JSON.stringify({
            account_balance: account.balance,
            fetched_balances: balances,
            account_details: account.details,
            type: account.type,
            subtype: account.subtype
          }, null, 2));
          
          // Use fetched balances first, fallback to account balances
          const currentBalance = balances?.current ?? account.balance?.current ?? null;
          const availableBalance = balances?.available ?? account.balance?.available ?? null;
          const statementBalance = (balances as any)?.statement ?? (account.balance as any)?.statement ?? null;
          const creditLimit = balances?.credit_limit ?? (account.balance as any)?.limit ?? null;
          
          creditCardInfo = {
            // Payment & Due Date Information (all nullable - UI shows "—")
            paymentDueDate: account.details?.payment_due_date ?? account.details?.due_date ?? null,
            minimumDue: account.details?.minimum_payment_due ?? account.details?.minimum_due ?? null,
            statementBalance: statementBalance ?? (currentBalance ? Math.abs(currentBalance) : null),
            lastPayment: {
              date: account.details?.last_payment_date ?? null,
              amount: account.details?.last_payment_amount ?? null
            },
            
            // Credit Availability
            availableCredit: availableBalance ?? account.details?.available_credit ?? null,
            creditLimit: creditLimit ?? account.details?.credit_limit ?? null,
            currentBalance: currentBalance ? Math.abs(currentBalance) : null,
            
            // APR & Fees (all nullable)
            apr: account.details?.apr ?? account.details?.interest_rate ?? null,
            cashAdvanceApr: account.details?.cash_advance_apr ?? null,
            annualFee: account.details?.annual_fee ?? null,
            lateFee: account.details?.late_fee ?? null,
            
            // Account identifiers
            lastFour: account.last_four ?? null,
            
            // Payment capability checking - Most institutions don't support payments in sandbox
            paymentCapabilities: {
              canPay: false, // In sandbox mode, most institutions don't support Teller payments
              paymentMethods: ['zelle'],
              sandboxMode: true,
              reason: 'This institution does not support Teller payments in sandbox mode. In production, payment support varies by institution.',
              supportedInProduction: true // Would need to check actual institution capabilities in production
            }
          };
        }

        res.json({
          provider: 'teller',
          accountOverview: {
            id: account.id,
            name: account.name ?? null,
            type: account.type ?? null,
            subtype: account.subtype ?? null,
            status: account.status ?? null,
            institution: account.institution ?? { name: 'Unknown', id: '' },
            currency: account.currency ?? 'USD',
            enrollment_id: account.enrollment_id ?? null,
            last_four: account.last_four ?? null
          },
          balances: {
            // Use fetched balances with fallbacks
            available: balances?.available ?? account.balance?.available ?? null,
            current: balances?.current ?? account.balance?.current ?? null,
            ledger: balances?.ledger ?? account.balance?.ledger ?? null,
            statement: balances?.statement ?? null,
            credit_limit: balances?.credit_limit ?? null
          },
          accountDetails: accountDetails,
          creditCardInfo,
          paymentCapabilities: creditCardInfo?.paymentCapabilities || null,
          transactions: transactions || [],
          statements: [] // Placeholder - would be populated if Teller statements API available
        });
      } catch (error: any) {
        // Extract comprehensive error details
        const statusCode = error.response?.status || error.statusCode || 500;
        const errorMessage = error.message || 'Teller API error';
        const errorDetails = error.response?.data || {};
        
        // Enhanced diagnostic logging with all required fields
        console.error('[Account Details API] Teller API call failed:', {
          userId,
          flintAccountId: dbId || 'unknown',
          tellerAccountId: externalId,
          tellerHttpStatus: statusCode,
          reason: errorMessage,
          errorDetails: errorDetails,
          provider: 'teller'
        });
        
        // Handle specific auth error cases with 428 Precondition Required
        if (statusCode === 401 || statusCode === 403) {
          console.log('[Account Details API] Teller auth error - reconnect required:', {
            userId,
            flintAccountId: dbId || 'unknown',
            tellerAccountId: externalId,
            tellerHttpStatus: statusCode,
            reason: 'reconnect required - stale consent or wrong token/account mapping'
          });
          // Mark account as disconnected
          if (dbId) {
            await storage.updateAccountConnectionStatus(dbId, 'disconnected');
          }
          
          return res.status(410).json({ // 410 Gone for disconnected accounts
            code: 'DISCONNECTED',
            reconnectUrl: '/connect',
            message: 'Account connection has been lost. Please reconnect your account.',
            provider: 'teller'
          });
        }
        
        // For test accounts, provide fallback mock data when Teller API fails
        if (externalId?.includes('test') || externalId?.includes('acc_test')) {
          console.log('[Account Details API] Providing test data fallback:', {
            userId,
            flintAccountId: dbId || 'unknown',
            tellerAccountId: externalId,
            tellerHttpStatus: statusCode,
            reason: 'using test data fallback'
          });
          
          // Get account info from database for basic details
          const [dbAccount] = await db
            .select()
            .from(connectedAccounts)
            .where(eq(connectedAccounts.externalAccountId, externalId));
          
          if (dbAccount) {
            const isCredit = dbAccount.accountType === 'card';
            const balance = parseFloat(dbAccount.balance || '0');
            
            let creditCardInfo = null;
            if (isCredit) {
              creditCardInfo = {
                paymentDueDate: '2025-09-15',
                minimumDue: 25.00,
                statementBalance: balance,
                lastPayment: {
                  date: '2025-08-15',
                  amount: 150.00
                },
                availableCredit: 15000 - balance,
                creditLimit: 15000,
                currentBalance: balance,
                
                apr: 24.99,
                cashAdvanceApr: 29.99,
                annualFee: 695,
                lateFee: 39,
                lastFour: dbAccount.accountNumber?.slice(-4) || '8731',
                
                // Payment capabilities for test data
                paymentCapabilities: {
                  canPay: false,
                  paymentMethods: ['zelle'],
                  sandboxMode: true,
                  reason: 'This institution does not support Teller payments in sandbox mode. In production, payment support varies by institution.',
                  supportedInProduction: true,
                  paymentsSupported: true
                }
              };
            }
            
            return res.json({
              provider: 'teller',
              account: {
                id: externalId,
                name: dbAccount.accountName,
                type: isCredit ? 'credit' : 'depository',
                subtype: isCredit ? 'credit_card' : 'checking',
                status: 'open',
                institution: dbAccount.institutionName,
                currency: 'USD',
                enrollment_id: null,
                last_four: dbAccount.accountNumber?.slice(-4),
                balance: {
                  available: isCredit ? (15000 - balance) : balance,
                  current: isCredit ? -balance : balance,
                  ledger: isCredit ? -balance : balance
                },
                details: {}
              },
              creditCardInfo,
              transactions: [
                {
                  id: 'txn_test_1',
                  description: isCredit ? 'Payment - Thank You' : 'Direct Deposit',
                  amount: isCredit ? 150.00 : 3200.00,
                  date: '2025-08-20',
                  type: isCredit ? 'payment' : 'deposit'
                },
                {
                  id: 'txn_test_2', 
                  description: isCredit ? 'Amazon Purchase' : 'Grocery Store',
                  amount: isCredit ? -89.50 : -67.42,
                  date: '2025-08-18',
                  type: isCredit ? 'purchase' : 'withdrawal'
                }
              ]
            });
          }
        }
        
        return res.status(500).json({ 
          code: 'TELLER_FETCH_FAILED', 
          message: 'Failed to fetch account details from Teller'
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
        console.log('[Account Details API] SnapTrade not connected:', {
          userId,
          flintAccountId: dbId || 'unknown',
          snaptradeAccountId: externalId,
          reason: 'no SnapTrade credentials for user',
          provider: 'snaptrade'
        });
        return res.status(400).json({ message: "SnapTrade not connected" });
      }
      
      try {
        // For now, return a stub response since we don't have SnapTrade user lookup implemented
        return res.status(501).json({ message: "SnapTrade account details not implemented yet" });
      } catch (error: any) {
        const statusCode = error.response?.status || error.statusCode || 500;
        const errorMessage = error.message || 'SnapTrade API error';
        
        console.error('[Account Details API] SnapTrade API call failed:', {
          userId,
          flintAccountId: dbId || 'unknown',
          snaptradeAccountId: externalId,
          snaptradeHttpStatus: statusCode,
          reason: errorMessage,
          provider: 'snaptrade'
        });
        
        // Handle SnapTrade auth errors similarly
        if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
          // Mark account as disconnected
          if (dbId) {
            await storage.updateAccountConnectionStatus(dbId, 'disconnected');
          }
          
          return res.status(410).json({ 
            code: 'DISCONNECTED',
            reconnectUrl: '/connect',
            message: 'Account connection has been lost. Please reconnect your account.',
            provider: 'snaptrade'
          });
        }
        
        return res.status(500).json({ 
          code: 'SNAPTRADE_FETCH_FAILED',
          message: 'Failed to fetch account details from SnapTrade'
        });
      }
    } else {
      return res.status(400).json({ message: "Unknown provider" });
    }
  } catch (error: any) {
    console.error('[Account Details API] Unexpected error:', {
      userId: req.user?.claims?.sub || req.headers['x-user-id'],
      requestedAccountId: req.params.accountId,
      reason: error.message || 'unexpected server error'
    });
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
    const { provider } = req.params;
    console.error('[Account Details Legacy] Error:', error);
    
    // Handle auth errors for legacy route too
    const status = error?.response?.status || error?.status;
    if (status === 401 || status === 403) {
      return res.status(428).json({ 
        code: provider === 'teller' ? 'TELLER_RECONNECT_REQUIRED' : 'SNAPTRADE_RECONNECT_REQUIRED',
        message: 'Please re-authenticate this account to continue.',
        provider 
      });
    }
    
    res.status(500).json({ 
      code: provider === 'teller' ? 'TELLER_FETCH_FAILED' : 'SNAPTRADE_FETCH_FAILED',
      message: `Failed to fetch account details from ${provider}`
    });
  }
});

export default router;