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
            account_balance: (account as any).balance,
            fetched_balances: balances,
            account_details: (account as any).details,
            type: account.type,
            subtype: account.subtype
          }, null, 2));
          
          // Use fetched balances first, fallback to account balances
          const currentBalance = (balances as any)?.current ?? (account as any).balance?.current ?? null;
          const availableBalance = balances?.available ?? (account as any).balance?.available ?? null;
          const statementBalance = (balances as any)?.statement ?? (account as any).balance?.statement ?? null;
          const creditLimit = (balances as any)?.credit_limit ?? (account as any).balance?.limit ?? null;
          
          creditCardInfo = {
            // Payment & Due Date Information (all nullable - UI shows "—")
            paymentDueDate: (account as any).details?.payment_due_date ?? (account as any).details?.due_date ?? null,
            minimumDue: (account as any).details?.minimum_payment_due ?? (account as any).details?.minimum_due ?? null,
            statementBalance: statementBalance ?? (currentBalance ? Math.abs(currentBalance) : null),
            lastPayment: {
              date: (account as any).details?.last_payment_date ?? null,
              amount: (account as any).details?.last_payment_amount ?? null
            },
            
            // Credit Availability
            availableCredit: availableBalance ?? (account as any).details?.available_credit ?? null,
            creditLimit: creditLimit ?? (account as any).details?.credit_limit ?? null,
            currentBalance: currentBalance ? Math.abs(currentBalance) : null,
            
            // APR & Fees (all nullable)
            apr: (account as any).details?.apr ?? (account as any).details?.interest_rate ?? null,
            cashAdvanceApr: (account as any).details?.cash_advance_apr ?? null,
            annualFee: (account as any).details?.annual_fee ?? null,
            lateFee: (account as any).details?.late_fee ?? null,
            
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
            available: balances?.available ?? (account as any).balance?.available ?? null,
            current: (balances as any)?.current ?? (account as any).balance?.current ?? null,
            ledger: balances?.ledger ?? (account as any).balance?.ledger ?? null,
            statement: (balances as any)?.statement ?? null,
            credit_limit: (balances as any)?.credit_limit ?? null
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
        
        // Handle specific auth error cases as requested by user 
        if (statusCode === 403) {
          return res.status(403).json({ 
            code: 'TELLER_AUTH_ERROR',
            message: 'Teller auth error',
            provider: 'teller'
          });
        }
        
        if (statusCode === 401) {
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
            reconnectUrl: '/connections',
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
      try {
        // Get SnapTrade user credentials
        const { getSnapUser } = await import('../store/snapUsers');
        const snapUser = await getSnapUser(userId);
        
        if (!snapUser) {
          console.log('[Account Details API] SnapTrade not connected:', {
            userId,
            flintAccountId: dbId || 'unknown',
            snaptradeAccountId: externalId,
            reason: 'no SnapTrade credentials for user',
            provider: 'snaptrade'
          });
          return res.status(428).json({ 
            code: 'SNAPTRADE_NOT_REGISTERED',
            message: 'Please register with SnapTrade to view account details.',
            provider: 'snaptrade'
          });
        }
        
        console.log('[Account Details] User:', userId, 'Account ID:', externalId);
        console.log('[Account Details] SnapTrade account detected:', externalId);
        console.log('[Account Details] Looking up SnapTrade user for:', userId);
        console.log('[Account Details] Found SnapTrade user:', {
          userId: snapUser.userId,
          userSecret: snapUser.userSecret
        });
        
        // Fetch comprehensive account data using multiple SnapTrade APIs
        const [accountsList, accountDetails, accountBalance, positions, orders, activities] = await Promise.all([
          // 1. List user accounts to get basic account info
          accountsApi.listUserAccounts({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
          }).catch(() => ({ data: [] })),
          
          // 2. Get detailed account information
          accountsApi.getUserAccountDetails({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accountId: externalId,
          }).catch(() => null),
          
          // 3. Get detailed balance information
          accountsApi.getUserAccountBalance({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accountId: externalId,
          }).catch(() => null),
          
          // 4. Get positions/holdings
          accountsApi.getUserAccountPositions({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accountId: externalId,
          }).catch(() => ({ data: [] })),
          
          // 5. Get pending orders
          accountsApi.getUserAccountOrders({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accountId: externalId,
          }).catch(() => ({ data: [] })),
          
          // 6. Get recent activities/transactions
          accountsApi.getAccountActivities({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accountId: externalId,
          }).catch(() => ({ data: [] }))
        ]);
        
        // Find the specific account from the accounts list
        const account = accountsList.data?.find((acc: any) => acc.id === externalId);
        if (!account) {
          return res.status(404).json({ 
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found in SnapTrade',
            accountId: externalId 
          });
        }
        
        console.log('Using fine-grained getUserAccountPositions API (recommended by SnapTrade)');
        console.log('[Account Details] Fetched', positions.data?.length || 0, 'positions for account:', externalId);
        
        // Extract balance information from multiple sources
        const totalBalance = parseFloat((accountBalance?.data as any)?.total?.amount || (account as any).balance?.total?.amount || '0') || 0;
        const cashBalance = parseFloat((accountBalance?.data as any)?.cash?.amount || (account as any).balance?.cash_balance?.amount || '0') || 0;
        const equityBalance = totalBalance - cashBalance;
        
        // Extract buying power from account details or balance
        const buyingPower = parseFloat((accountBalance?.data as any)?.buying_power?.amount || 
                                      (accountDetails?.data as any)?.buying_power?.amount || 
                                      (accountDetails?.data as any)?.max_buying_power?.amount || '0') || null;
        
        // Update stored balance in database
        if (dbId && totalBalance) {
          try {
            await storage.updateAccountBalance(dbId, totalBalance.toString());
            console.log('[Account Details API] Updated stored balance:', {
              accountId: dbId,
              newBalance: totalBalance,
              lastSynced: new Date().toISOString()
            });
          } catch (error) {
            console.error('[Account Details API] Failed to update balance:', error);
          }
        }
        
        console.log('[Account Details API] SnapTrade data fetched successfully:', {
          userId,
          flintAccountId: dbId,
          snaptradeAccountId: externalId,
          provider: 'snaptrade',
          hasAccount: !!account,
          hasAccountDetails: !!accountDetails?.data,
          hasAccountBalance: !!accountBalance?.data,
          holdingsCount: positions.data?.length || 0,
          ordersCount: orders.data?.length || 0,
          activitiesCount: activities.data?.length || 0,
          httpStatus: 200
        });
        
        // Transform data to match AccountDetails interface expected by frontend
        res.json({
          provider: 'snaptrade',
          accountInformation: {
            id: account.id || externalId,
            name: account.name === 'Default' 
              ? `${account.institution_name} ${account.meta?.type || account.raw_type || 'Account'}`.trim()
              : account.name,
            number: account.number || account.account_number || null,
            brokerage: account.institution_name || 'Unknown Brokerage',
            type: account.meta?.brokerage_account_type || account.meta?.type || account.raw_type || 'Investment',
            status: account.status || 'Active',
            currency: (account as any).balance?.total?.currency || (accountBalance?.data as any)?.currency || 'USD',
            balancesOverview: {
              cash: cashBalance,
              equity: equityBalance,
              buyingPower: buyingPower
            }
          },
          balancesAndHoldings: {
            balances: {
              cashAvailableToTrade: cashBalance,
              totalEquityValue: equityBalance,
              buyingPowerOrMargin: buyingPower
            },
            holdings: positions.data?.map((holding: any) => ({
              symbol: holding.symbol?.symbol?.symbol || holding.symbol?.raw_symbol || holding.symbol?.symbol || 'Unknown',
              name: holding.symbol?.symbol?.description || holding.symbol?.description || '',
              quantity: holding.units || holding.fractional_units || 0,
              costBasis: holding.average_purchase_price || 0,
              marketValue: (holding.units || holding.fractional_units || 0) * (holding.price || 0),
              currentPrice: holding.price || 0,
              unrealized: holding.open_pnl || 0
            })) || []
          },
          positionsAndOrders: {
            activePositions: positions.data || [],
            pendingOrders: orders.data || [],
            orderHistory: []
          },
          tradingActions: {
            canPlaceOrders: true,
            canCancelOrders: true,
            canGetConfirmations: true
          },
          activityAndTransactions: activities.data?.map((activity: any) => ({
            type: activity.type || activity.activity_type || 'Unknown',
            symbol: activity.symbol?.symbol?.symbol || activity.symbol?.raw_symbol || activity.symbol || null,
            amount: activity.net_amount || activity.price || null,
            quantity: activity.quantity || activity.units || null,
            timestamp: activity.trade_date || activity.settlement_date || activity.created_date || null,
            description: activity.description || `${activity.type || 'Activity'}: ${activity.symbol?.symbol?.symbol || activity.symbol || ''}`
          })) || [],
          metadata: {
            fetched_at: new Date().toISOString(),
            last_sync: account.sync_status || null,
            cash_restrictions: account.cash_restrictions || [],
            account_created: account.created_date || null
          }
        });
        
      } catch (error: any) {
        const statusCode = error.response?.status || error.statusCode || 500;
        const errorMessage = error.message || 'SnapTrade API error';
        
        console.error('[Account Details API] SnapTrade API call failed:', {
          userId,
          flintAccountId: dbId || 'unknown',
          snaptradeAccountId: externalId,
          snaptradeHttpStatus: statusCode,
          reason: errorMessage,
          provider: 'snaptrade',
          errorData: error.response?.data
        });
        
        // Handle specific SnapTrade error cases
        if (statusCode === 428 || error.response?.data?.code === 'SNAPTRADE_NOT_REGISTERED') {
          return res.status(428).json({ 
            code: 'SNAPTRADE_NOT_REGISTERED',
            message: 'Please register with SnapTrade to view account details.',
            provider: 'snaptrade'
          });
        }
        
        if (statusCode === 401 || statusCode === 403) {
          return res.status(403).json({ 
            code: 'SNAPTRADE_AUTH_ERROR',
            message: 'SnapTrade authentication failed. Please reconnect your account.',
            provider: 'snaptrade'
          });
        }
        
        if (statusCode === 404) {
          // Mark account as disconnected
          if (dbId) {
            await storage.updateAccountConnectionStatus(dbId, 'disconnected');
          }
          
          return res.status(410).json({ 
            code: 'DISCONNECTED',
            reconnectUrl: '/connections',
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