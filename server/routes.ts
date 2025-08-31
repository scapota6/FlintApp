import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getSnapUser } from "./store/snapUsers";
import { rateLimits } from "./middleware/rateLimiter";
import { authApi, accountsApi, snaptradeClient, portfolioApi } from './lib/snaptrade';
import { deleteSnapUser, saveSnapUser } from './store/snapUsers';
import { WalletService } from "./services/WalletService";
import { TradingAggregator } from "./services/TradingAggregator";
import { marketDataService } from "./services/market-data";
import { alertMonitor } from "./services/alert-monitor";
import { getServerFeatureFlags } from "@shared/feature-flags";
import { logger } from "@shared/logger";
import { demoMode } from "@shared/demo-mode";
import { 
  insertConnectedAccountSchema,
  insertWatchlistItemSchema,
  insertTradeSchema,
  insertTransferSchema,
  insertActivityLogSchema,
  users,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

// Initialize Stripe (only if API key is provided)
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// SnapTrade SDK initialization is now handled in server/lib/snaptrade.ts

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Start alert monitoring service
  alertMonitor.start();

  // Feature flags endpoint (public, no auth required for demo mode)
  app.get('/api/feature-flags', (req, res) => {
    const flags = getServerFeatureFlags();
    logger.info('Feature flags requested', { metadata: { flags } });
    res.json(flags);
  });

  // SnapTrade callback handler for OAuth redirect
  app.get('/snaptrade/callback', async (req, res) => {
    try {
      // Handle success/error from SnapTrade connection
      const { success, error } = req.query;
      
      if (error) {
        logger.error('SnapTrade callback error', { error });
        return res.redirect('/?snaptrade=error');
      }
      
      // Success - redirect to dashboard or accounts page
      logger.info('SnapTrade connection successful');
      return res.redirect('/accounts?snaptrade=success');
    } catch (e: any) {
      logger.error('SnapTrade callback handler error', { error: e });
      return res.redirect('/?snaptrade=error');
    }
  });

  // SnapTrade health check endpoint
  app.get('/api/snaptrade/health', async (_req, res) => {
    try {
      const { authApi } = await import('./lib/snaptrade');
      // harmless idempotent call to test signatures/keys
      await authApi.registerSnapTradeUser({
        userId: 'healthcheck@flint-investing.com',
        userSecret: 'healthcheck-secret-1234567890',
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.responseBody || e?.message });
    }
  });

  // Debug endpoint to check userSecret storage
  app.get('/api/debug/snaptrade/user', async (req, res) => {
    const { getUser } = await import('./store/snapUsers');
    const email = (req.query.email || '').toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'email required' });
    const rec = await getUser(email);
    res.json({
      exists: !!rec,
      userId: rec?.userId,
      userSecretLen: rec?.userSecret?.length || 0,
    });
  });

  // Dev-only repair endpoint (if a user was registered under a different secret in the past)
  app.post('/api/debug/snaptrade/repair-user', async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      if (!userId) return res.status(400).json({ message: 'userId required' });

      await authApi.deleteSnapTradeUser({ userId });    // async provider-side deletion
      await deleteSnapUser(userId);                     // wipe local
      const created = await authApi.registerSnapTradeUser({ userId }); // fresh pair
      await saveSnapUser({ userId: created.data.userId!, userSecret: created.data.userSecret! });
      res.json({ ok: true, userId, userSecretLen: created.data.userSecret?.length || 0 });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.responseBody || e?.message });
    }
  });

  // GET /api/me endpoint - returns current user info
  app.get('/api/me', rateLimits.auth, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user info in required format
      const userInfo = {
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        createdAt: user.createdAt || new Date().toISOString(),
      };
      
      logger.info('User info requested', { 
        userId,
        action: 'GET_USER_INFO'
      });
      
      res.json(userInfo);
    } catch (error) {
      logger.error("Error fetching user info", { error });
      res.status(500).json({ message: "Failed to fetch user info" });
    }
  });



  // Auth routes (with rate limiting)
  app.get('/api/auth/user', rateLimits.auth, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      

      
      // Enable demo mode if feature flag is set
      if (getServerFeatureFlags().FF_DEMO_MODE && !user) {
        const demoUser = {
          id: 'demo-user',
          email: 'demo@flint.finance',
          firstName: 'Demo',
          lastName: 'User',
          profileImageUrl: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          subscriptionTier: 'premium',
          subscriptionStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        logger.info('Demo mode: returning demo user');
        return res.json(demoUser);
      }
      
      res.json(user);
    } catch (error) {
      logger.error("Error fetching user", { error });
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard data (with data rate limiting) - Enhanced with real API integration
  app.get('/api/dashboard', rateLimits.data, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email;
      
      const user = await storage.getUser(userId);
      const connectedAccounts = await storage.getConnectedAccounts(userId);
      
      let totalBalance = 0;
      let bankBalance = 0;
      let investmentValue = 0;
      let cryptoValue = 0;
      const enrichedAccounts = [];

      // Fetch real bank account data from Teller (including credit cards)
      // Only include accounts that we can successfully access via API
      try {
        console.log('Fetching bank accounts for user:', userEmail);
        const connectedAccounts = await storage.getConnectedAccounts(userId);
        const tellerAccounts = connectedAccounts.filter(acc => acc.provider === 'teller');
        
        for (const account of tellerAccounts) {
          // Always include accounts, validate access for real-time data
          if (account.accessToken) {
            try {
              // Fetch both account info and balances from Teller
              const [accountResponse, balancesResponse] = await Promise.all([
                fetch(`https://api.teller.io/accounts/${account.externalAccountId}`, {
                  headers: {
                    'Authorization': `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`,
                  },
                }),
                fetch(`https://api.teller.io/accounts/${account.externalAccountId}/balances`, {
                  headers: {
                    'Authorization': `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`,
                  },
                })
              ]);
              
              if (accountResponse.ok && balancesResponse.ok) {
                const tellerAccount = await accountResponse.json();
                const tellerBalances = await balancesResponse.json();
                
                console.log('[Dashboard] Teller account data:', {
                  accountId: account.id,
                  type: tellerAccount.type,
                  subtype: tellerAccount.subtype,
                  balances: tellerBalances
                });
                
                // Determine account type based on Teller's type and subtype
                const tellerType = tellerAccount.type?.toLowerCase() || '';
                const tellerSubtype = tellerAccount.subtype?.toLowerCase() || '';
                
                let accountType: 'bank' | 'credit';
                let displayBalance: number;
                let availableCredit: number | null = null;
                let amountSpent: number | null = null;
                
                // Asset accounts (green): checking, savings, money_market, cash_management
                if (['checking', 'savings', 'money_market', 'cash_management'].includes(tellerSubtype) || 
                    tellerType === 'depository') {
                  accountType = 'bank';
                  // For assets: show available_balance
                  displayBalance = parseFloat(tellerBalances.available || tellerBalances.current || '0') || 0;
                  bankBalance += displayBalance;
                  totalBalance += displayBalance;
                }
                // Liability/credit accounts (red): credit_card, line_of_credit
                else if (['credit_card', 'line_of_credit'].includes(tellerSubtype) || 
                         tellerType === 'credit') {
                  accountType = 'credit';
                  
                  // For credit cards: show amount spent this cycle
                  // Primary method: use current_balance if available
                  if (tellerBalances.current) {
                    amountSpent = Math.abs(parseFloat(tellerBalances.current));
                    displayBalance = amountSpent;
                  }
                  // Fallback: credit_limit - available_credit
                  else if (tellerBalances.credit_limit && tellerBalances.available) {
                    const creditLimit = parseFloat(tellerBalances.credit_limit) || 0;
                    const availableCreditAmount = parseFloat(tellerBalances.available) || 0;
                    amountSpent = creditLimit - availableCreditAmount;
                    displayBalance = Math.max(0, amountSpent);
                    availableCredit = availableCreditAmount;
                  }
                  // Last resort: use available as credit available and assume some spending
                  else {
                    displayBalance = 0;
                    availableCredit = parseFloat(tellerBalances.available || '0') || 0;
                  }
                  
                  // Set available credit for display
                  if (!availableCredit && tellerBalances.available) {
                    availableCredit = parseFloat(tellerBalances.available) || 0;
                  }
                }
                else {
                  // Default fallback based on stored account type
                  accountType = account.accountType === 'card' ? 'credit' : 'bank';
                  displayBalance = parseFloat(tellerBalances.available || tellerBalances.current || '0') || 0;
                  if (accountType === 'bank') {
                    bankBalance += displayBalance;
                    totalBalance += displayBalance;
                  }
                }
                
                console.log('[Dashboard] Account classification:', {
                  accountId: account.id,
                  tellerType,
                  tellerSubtype,
                  accountType,
                  displayBalance
                });
                
                // Update stored balance in database
                await storage.updateAccountBalance(account.id, displayBalance.toString());
                
                enrichedAccounts.push({
                  id: account.id,
                  provider: 'teller',
                  accountName: account.accountName || (accountType === 'credit' ? 'Credit Card' : 'Bank Account'),
                  balance: displayBalance,
                  type: accountType,
                  institution: account.institutionName || (accountType === 'credit' ? 'Credit Card' : 'Bank'),
                  lastUpdated: new Date().toISOString(),
                  // Store additional balance info for details view
                  availableBalance: parseFloat(tellerBalances.available || '0') || 0,
                  ledgerBalance: parseFloat(tellerBalances.ledger || '0') || 0,
                  currentBalance: parseFloat(tellerBalances.current || '0') || 0,
                  creditLimit: parseFloat(tellerBalances.credit_limit || '0') || null,
                  // Credit-specific fields
                  availableCredit: availableCredit,
                  amountSpent: amountSpent
                });
              } else if (accountResponse.status === 401 || accountResponse.status === 403) {
                // Account access expired - show stored balance and mark for reconnection
                console.log(`[Dashboard] Teller account ${account.id} access expired, using stored balance`);
                
                const storedBalance = parseFloat(account.balance) || 0;
                
                if (account.accountType === 'card') {
                  enrichedAccounts.push({
                    id: account.id,
                    provider: 'teller',
                    accountName: account.accountName || 'Credit Card',
                    balance: storedBalance,
                    type: 'credit' as const,
                    institution: account.institutionName || 'Credit Card',
                    lastUpdated: account.lastSynced || new Date().toISOString(),
                    needsReconnection: true
                  });
                } else {
                  bankBalance += storedBalance;
                  totalBalance += storedBalance;
                  
                  enrichedAccounts.push({
                    id: account.id,
                    provider: 'teller',
                    accountName: account.accountName || 'Bank Account',
                    balance: storedBalance,
                    type: 'bank' as const,
                    institution: account.institutionName || 'Bank',
                    lastUpdated: account.lastSynced || new Date().toISOString(),
                    needsReconnection: true
                  });
                }
              }
            } catch (fetchError) {
              console.error(`Error validating Teller account ${account.id}:`, fetchError);
              // Include stored balance for accounts we can't access
              const storedBalance = parseFloat(account.balance) || 0;
              
              if (account.accountType === 'card') {
                enrichedAccounts.push({
                  id: account.id,
                  provider: 'teller',
                  accountName: account.accountName || 'Credit Card',
                  balance: storedBalance,
                  type: 'credit' as const,
                  institution: account.institutionName || 'Credit Card',
                  lastUpdated: account.lastSynced || new Date().toISOString(),
                  needsReconnection: true
                });
              } else {
                bankBalance += storedBalance;
                totalBalance += storedBalance;
                
                enrichedAccounts.push({
                  id: account.id,
                  provider: 'teller',
                  accountName: account.accountName || 'Bank Account',
                  balance: storedBalance,
                  type: 'bank' as const,
                  institution: account.institutionName || 'Bank',
                  lastUpdated: account.lastSynced || new Date().toISOString(),
                  needsReconnection: true
                });
              }
            }
          } else {
            // No access token - show stored balance
            const storedBalance = parseFloat(account.balance) || 0;
            
            if (account.accountType === 'card') {
              enrichedAccounts.push({
                id: account.id,
                provider: 'teller',
                accountName: account.accountName || 'Credit Card',
                balance: storedBalance,
                type: 'credit' as const,
                institution: account.institutionName || 'Credit Card',
                lastUpdated: account.lastSynced || new Date().toISOString(),
                needsReconnection: true
              });
            } else {
              bankBalance += storedBalance;
              totalBalance += storedBalance;
              
              enrichedAccounts.push({
                id: account.id,
                provider: 'teller',
                accountName: account.accountName || 'Bank Account',
                balance: storedBalance,
                type: 'bank' as const,
                institution: account.institutionName || 'Bank',
                lastUpdated: account.lastSynced || new Date().toISOString(),
                needsReconnection: true
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching bank accounts:', error);
      }

      // Fetch real investment account data from SnapTrade
      let snapTradeError = null;
      let snapTradePositions: any[] = []; // Initialize positions array
      try {
        console.log('Fetching SnapTrade accounts for user:', userEmail);
        
        // Use the persistent store instead of database storage - use userId not email
        const snapUser = await getSnapUser(userId);
        if (snapUser?.userSecret) {
          const { accountsApi } = await import('./lib/snaptrade');
          const accounts = await accountsApi.listUserAccounts({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
          });
          
          console.log('SnapTrade accounts fetched:', accounts.data?.length || 0);
          console.log('SnapTrade raw accounts data:', JSON.stringify(accounts.data, null, 2));
          
          if (accounts.data && Array.isArray(accounts.data)) {
            for (const account of accounts.data) {
              const balance = parseFloat(account.total_value?.amount || account.balance?.total?.amount || '0') || 0;
              const cash = parseFloat(account.cash?.amount || account.balance?.cash?.amount || '0') || 0;
              const holdings = balance - cash;
              
              investmentValue += balance;
              totalBalance += balance;
              
              enrichedAccounts.push({
                id: account.id || `snaptrade-${Math.random()}`,
                provider: 'snaptrade',
                accountName: account.name || account.account_type || 'Investment Account',
                accountNumber: account.number,
                balance: balance,
                type: 'investment' as const,
                institution: account.institution_name || 'Brokerage',
                lastUpdated: new Date().toISOString(),
                cash: cash,
                holdings: holdings,
                buyingPower: parseFloat(account.buying_power?.amount || '0') || cash
              });
            }
          }
        } else {
          console.log('SnapTrade credentials not available for user');
          snapTradeError = 'not_connected';
        }
      } catch (error: any) {
        console.error('Error fetching SnapTrade accounts:', error);
        
        // Check if it's an authentication error
        if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Unable to verify signature') || error.responseBody?.code === '1083' || error.responseBody?.code === '1076') {
          snapTradeError = 'auth_failed';
          
          // Trigger repair flow - delete stale user and let them re-register
          console.log('[SnapTrade] Detected stale user credentials, triggering repair flow for:', userId);
          try {
            await deleteUserLocal(userId);
            console.log('[SnapTrade] Deleted stale user credentials for repair');
          } catch (deleteError) {
            console.error('[SnapTrade] Error deleting stale user:', deleteError);
          }
        } else {
          snapTradeError = 'fetch_failed';
        }
      }

      // Skip legacy connected accounts - only show accounts we can validate via API
      // This ensures the dashboard only displays accounts that are truly accessible
      
      // Check if we have any connected accounts
      const hasConnectedAccounts = enrichedAccounts.length > 0;
      const needsConnection = !hasConnectedAccounts || snapTradeError === 'not_connected';
      
      // Filter out disconnected accounts (ones with needsReconnection)
      const activeAccounts = enrichedAccounts.filter(account => !account.needsReconnection);
      
      // Calculate percentages based on total assets (excluding liabilities)
      const totalAssets = bankBalance + investmentValue + cryptoValue;
      const accountsWithPercentages = activeAccounts.map(account => {
        let percentOfTotal = 0;
        
        // Only calculate percentage for asset accounts (bank, investment, crypto)
        if (account.type !== 'credit' && totalAssets > 0) {
          percentOfTotal = (account.balance / totalAssets) * 100;
        }
        
        return {
          ...account,
          percentOfTotal: Math.round(percentOfTotal * 10) / 10 // Round to 1 decimal place
        };
      });

      const dashboardData = {
        totalBalance: hasConnectedAccounts ? (totalBalance ?? 0) : 0,
        bankBalance: bankBalance ?? 0,
        investmentBalance: investmentValue ?? 0, // Frontend expects investmentBalance
        cryptoValue: cryptoValue ?? 0,
        totalAssets: totalAssets ?? 0, // Assets only (for percentage calculations)
        accounts: accountsWithPercentages ?? [],      // never undefined
        positions: snapTradePositions ?? [],          // never undefined
        subscriptionTier: user?.subscriptionTier || 'free',
        isAdmin: user?.isAdmin || false,
        needsConnection,
        connectionStatus: {
          hasAccounts: hasConnectedAccounts,
          snapTradeError: snapTradeError,
          message: needsConnection ? 'Connect your accounts to see your portfolio' : null
        },
        // Add SnapTrade status for holdings component
        snapTradeStatus: {
          connected: !snapTradeError && investmentValue > 0
        }
      };
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      
      // Return empty state instead of 500 error for better UX
      const emptyDashboardData = {
        totalBalance: 0,
        bankBalance: 0,
        investmentBalance: 0,  // Frontend expects investmentBalance
        cryptoValue: 0,
        accounts: [],          // never undefined
        positions: [],         // never undefined
        subscriptionTier: 'free',
        needsConnection: true,
        connectionStatus: {
          hasAccounts: false,
          snapTradeError: 'fetch_failed',
          message: 'Connect your accounts to see your portfolio'
        },
        // Add SnapTrade status for holdings component
        snapTradeStatus: {
          connected: false
        }
      };
      
      res.json(emptyDashboardData);
    }
  });



  // Log user login activity with SnapTrade registration check
  app.post('/api/log-login', isAuthenticated, async (req: any, res) => {
    try {
      // Best-effort analytics logging
      const userId = req.user.claims.sub;
      
      // SnapTrade registration is now handled on-demand during connection
      
      await storage.createActivityLog({
        userId,
        action: 'login',
        description: 'User logged in',
        metadata: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      // Silently fail - analytics should never break user flows
      console.warn("Failed to log login activity:", error);
    }
    
    // Always return success regardless of analytics outcome
    res.json({ success: true });
  });

  // Account connection management
  app.get('/api/connected-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const accounts = await storage.getConnectedAccounts(userId);
      res.json({ accounts });
    } catch (error) {
      console.error("Error fetching connected accounts:", error);
      res.status(500).json({ message: "Failed to fetch connected accounts" });
    }
  });

  // Trading page accounts endpoint - returns brokerage accounts for trading
  app.get('/api/accounts', isAuthenticated, async (req: any, res) => {
    try {
      console.log('[/api/accounts] User object:', req.user ? 'exists' : 'missing');
      console.log('[/api/accounts] User claims:', req.user?.claims ? 'exists' : 'missing');
      console.log('[/api/accounts] User ID:', req.user?.claims?.sub || 'missing');
      
      if (!req.user || !req.user.claims || !req.user.claims.sub) {
        console.error('[/api/accounts] Authentication failed - missing user data');
        return res.status(401).json({ message: "Unauthorized", brokerages: [] });
      }
      
      const userId = req.user.claims.sub;
      console.log('[/api/accounts] Fetching accounts for user:', userId);
      const brokerages = [];
      
      // Get SnapTrade accounts if connected
      const snapTradeUser = await getSnapUser(userId);
      if (snapTradeUser && snapTradeUser.userSecret) {
        try {
          console.log('[/api/accounts] Fetching SnapTrade accounts');
          const accounts = await accountsApi.listUserAccounts({
            userId: snapTradeUser.userId,
            userSecret: snapTradeUser.userSecret
          });
          
          if (accounts.data && Array.isArray(accounts.data)) {
            for (const account of accounts.data) {
              brokerages.push({
                id: account.id,
                accountName: account.name || account.institution_name || 'Brokerage Account',
                provider: 'snaptrade',
                balance: account.balance?.total?.amount || account.total_value?.amount || '0',
                externalAccountId: account.id,
                institution: account.institution_name,
                accountNumber: account.number
              });
            }
          }
        } catch (error) {
          console.error('Error fetching SnapTrade accounts for trading:', error);
        }
      }
      
      res.json({ brokerages });
    } catch (error) {
      console.error("Error fetching accounts for trading:", error);
      res.status(500).json({ message: "Failed to fetch accounts", brokerages: [] });
    }
  });

  // Subscriptions endpoint - detect recurring payments from bank transactions
  app.get('/api/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get all connected Teller accounts
      const connectedAccounts = await storage.getConnectedAccounts(userId);
      const tellerAccounts = connectedAccounts.filter(acc => acc.provider === 'teller');
      
      if (tellerAccounts.length === 0) {
        return res.json({ subscriptions: [] });
      }

      const allTransactions = [];
      
      // Fetch transactions from all Teller accounts (last 12 months)
      for (const account of tellerAccounts) {
        if (!account.accessToken) continue;
        
        try {
          const response = await fetch(
            `https://api.teller.io/accounts/${account.externalAccountId}/transactions?count=500`,
            {
              headers: {
                'Authorization': `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`,
                'Accept': 'application/json'
              }
            }
          );
          
          if (response.ok) {
            const transactions = await response.json();
            
            // Only include outgoing transactions (negative amounts) for subscription detection
            const outgoingTransactions = transactions
              .filter(t => parseFloat(t.amount) < 0)
              .map(t => ({
                ...t,
                accountId: account.id,
                accountName: account.accountName,
                amount: Math.abs(parseFloat(t.amount)) // Convert to positive for easier comparison
              }));
              
            allTransactions.push(...outgoingTransactions);
          }
        } catch (error) {
          console.error(`Error fetching transactions for account ${account.id}:`, error);
        }
      }

      // Detect recurring subscriptions using helper functions from the end of file
      const subscriptions = detectRecurringPayments(allTransactions);
      
      res.json({ 
        subscriptions,
        totalMonthlySpend: subscriptions.reduce((sum, sub) => {
          const monthlyAmount = getMonthlyAmount(sub.amount, sub.frequency);
          return sum + monthlyAmount;
        }, 0)
      });
      
    } catch (error) {
      console.error('Error detecting subscriptions:', error);
      res.status(500).json({ 
        message: 'Failed to detect subscriptions',
        subscriptions: [] 
      });
    }
  });

  // Watchlist management
  app.get('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const watchlist = await storage.getWatchlist(userId);
      res.json({ watchlist });
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validatedData = insertWatchlistItemSchema.parse({
        ...req.body,
        userId
      });
      
      const item = await storage.createWatchlistItem(validatedData);
      res.json({ item });
    } catch (error: any) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add to watchlist: " + error.message });
    }
  });

  app.delete('/api/watchlist/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.deleteWatchlistItem(parseInt(id), userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist: " + error.message });
    }
  });

  // Wallet Service Routes
  app.get('/api/wallet/balance', rateLimits.data, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const balance = await WalletService.getWalletBalance(userId);
      res.json(balance);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      res.status(500).json({ message: "Failed to fetch wallet balance" });
    }
  });

  app.post('/api/wallet/hold', rateLimits.trading, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, purpose } = req.body;
      const result = await WalletService.holdFunds(userId, amount, purpose);
      res.json(result);
    } catch (error: any) {
      console.error("Error holding funds:", error);
      res.status(500).json({ message: error.message || "Failed to hold funds" });
    }
  });

  app.post('/api/wallet/allocate', rateLimits.trading, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, brokerageId, purpose } = req.body;
      const result = await WalletService.allocateToBrokerage({ userId, amount, brokerageId, purpose });
      res.json(result);
    } catch (error: any) {
      console.error("Error allocating funds:", error);
      res.status(500).json({ message: error.message || "Failed to allocate funds" });
    }
  });

  app.post('/api/transfers/ach', rateLimits.external, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fromAccountId, toAccountId, amount } = req.body;
      const result = await WalletService.initiateACHTransfer(userId, fromAccountId, toAccountId, amount);
      res.json(result);
    } catch (error: any) {
      console.error("Error initiating ACH transfer:", error);
      res.status(500).json({ message: error.message || "Failed to initiate transfer" });
    }
  });

  // Search endpoint for assets (stocks and crypto)
  app.get('/api/search', rateLimits.data, isAuthenticated, async (req: any, res) => {
    try {
      const { q: query, type = 'all' } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.json({ results: [] });
      }

      const results: any[] = [];

      // Search stocks via Polygon.io
      if (type === 'all' || type === 'stock') {
        if (process.env.POLYGON_API_KEY) {
          try {
            const polygonUrl = `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=10&apiKey=${process.env.POLYGON_API_KEY}`;
            const polygonResponse = await fetch(polygonUrl);
            
            if (polygonResponse.ok) {
              const polygonData = await polygonResponse.json();
              const tickers = polygonData.results || [];
              
              tickers.forEach((ticker: any) => {
                results.push({
                  symbol: ticker.ticker,
                  name: ticker.name,
                  type: 'stock',
                  exchange: ticker.primary_exchange,
                  currency: ticker.currency_name || 'USD',
                });
              });
            }
          } catch (error) {
            console.error('Polygon search error:', error);
          }
        }
      }

      // Search crypto via CoinGecko
      if (type === 'all' || type === 'crypto') {
        try {
          const coinGeckoUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
          const coinGeckoResponse = await fetch(coinGeckoUrl);
          
          if (coinGeckoResponse.ok) {
            const coinGeckoData = await coinGeckoResponse.json();
            const coins = coinGeckoData.coins || [];
            
            // Limit to top 10 crypto results
            coins.slice(0, 10).forEach((coin: any) => {
              results.push({
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                type: 'crypto',
                exchange: 'CoinGecko',
                currency: 'USD',
                coinGeckoId: coin.id,
              });
            });
          }
        } catch (error) {
          console.error('CoinGecko search error:', error);
        }
      }

      res.json({ 
        results,
        query,
        type,
        total: results.length 
      });

    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({ 
        message: 'Search failed', 
        error: error.message 
      });
    }
  });

  // Transactions endpoint - fetch from SnapTrade and Teller
  app.get('/api/transactions', rateLimits.data, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { startDate, endDate, accountId, type } = req.query;
      const transactions: any[] = [];

      // Fetch SnapTrade transactions (brokerage)
      if (snapTradeClient && user.snaptradeUserSecret) {
        try {
          // Get all connected SnapTrade accounts
          const accountsResponse = await snapTradeClient.accountInformation.listUserAccounts({
            userId: user.email,
            userSecret: user.snaptradeUserSecret,
          });

          const accounts = accountsResponse.data || [];
          
          // Fetch activities for each account
          for (const account of accounts) {
            // Skip if specific accountId is requested and doesn't match
            if (accountId && account.id !== accountId) continue;

            try {
              const activitiesResponse = await snapTradeClient.transactionsAndReporting.getActivities({
                userId: user.email,
                userSecret: user.snaptradeUserSecret,
                accountId: account.id,
                startDate: startDate as string,
                endDate: endDate as string,
              });

              const activities = activitiesResponse.data || [];
              
              // Transform SnapTrade activities to unified format
              activities.forEach((activity: any) => {
                // Filter by type if specified
                if (type && !activity.type?.toLowerCase().includes(type.toString().toLowerCase())) {
                  return;
                }

                transactions.push({
                  id: activity.id || `snaptrade-${Date.now()}-${Math.random()}`,
                  accountId: account.id,
                  accountName: account.name,
                  accountType: 'brokerage',
                  provider: 'snaptrade',
                  date: activity.trade_date || activity.settlement_date,
                  type: activity.type || 'trade',
                  description: activity.description || `${activity.action} ${activity.symbol?.symbol || ''}`,
                  symbol: activity.symbol?.symbol,
                  quantity: activity.units,
                  price: activity.price,
                  amount: activity.net_amount || (activity.units * activity.price),
                  fee: activity.fee,
                  currency: activity.currency?.code || 'USD',
                  status: activity.status || 'completed',
                });
              });
            } catch (error) {
              console.error(`Error fetching activities for SnapTrade account ${account.id}:`, error);
            }
          }
        } catch (error) {
          console.error('Error fetching SnapTrade transactions:', error);
        }
      }

      // Fetch Teller transactions (banking)
      const tellerAccounts = await storage.getConnectedAccounts(userId);
      const tellerBankAccounts = tellerAccounts.filter(acc => acc.provider === 'teller');

      for (const tellerAccount of tellerBankAccounts) {
        // Skip if specific accountId is requested and doesn't match
        if (accountId && tellerAccount.id.toString() !== accountId) continue;

        try {
          const tellerResponse = await fetch(
            `https://api.teller.io/accounts/${tellerAccount.externalAccountId}/transactions`,
            {
              headers: {
                'Authorization': `Bearer ${tellerAccount.accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (tellerResponse.ok) {
            const tellerTransactions = await tellerResponse.json();
            
            // Transform Teller transactions to unified format
            tellerTransactions.forEach((transaction: any) => {
              // Filter by date range
              const transactionDate = new Date(transaction.date);
              if (startDate && transactionDate < new Date(startDate as string)) return;
              if (endDate && transactionDate > new Date(endDate as string)) return;
              
              // Filter by type if specified
              if (type && type !== 'bank') return;

              transactions.push({
                id: transaction.id,
                accountId: tellerAccount.id.toString(),
                accountName: tellerAccount.accountName,
                accountType: 'bank',
                provider: 'teller',
                date: transaction.date,
                type: transaction.type || 'bank_transaction',
                description: transaction.description,
                amount: parseFloat(transaction.amount),
                currency: 'USD',
                status: transaction.status || 'posted',
                category: transaction.category,
                merchant: transaction.merchant_name,
              });
            });
          }
        } catch (error) {
          console.error(`Error fetching Teller transactions for account ${tellerAccount.id}:`, error);
        }
      }

      // Sort transactions by date (newest first)
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({
        transactions,
        total: transactions.length,
        filters: {
          startDate,
          endDate,
          accountId,
          type,
        },
      });

    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ 
        message: 'Failed to fetch transactions', 
        error: error.message 
      });
    }
  });



  // Trading Aggregation Routes
  app.get('/api/trading/positions', rateLimits.data, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const positions = await TradingAggregator.getAggregatedPositions(userId);
      res.json({ positions });
    } catch (error) {
      console.error("Error fetching aggregated positions:", error);
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.post('/api/trading/route', rateLimits.trading, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tradingRequest = { ...req.body, userId };
      const routing = await TradingAggregator.routeTrade(tradingRequest);
      res.json(routing);
    } catch (error: any) {
      console.error("Error routing trade:", error);
      res.status(500).json({ message: error.message || "Failed to route trade" });
    }
  });

  app.post('/api/trading/execute', rateLimits.trading, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tradingRequest = { ...req.body, userId };
      const result = await TradingAggregator.executeTrade(tradingRequest);
      res.json(result);
    } catch (error: any) {
      console.error("Error executing trade:", error);
      res.status(500).json({ message: error.message || "Failed to execute trade" });
    }
  });

  // Trade management  
  app.get('/api/trades', rateLimits.data, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trades = await storage.getTrades(userId);
      res.json({ trades });
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  app.post('/api/trades', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Generate UUID v4 for tradeId
      const tradeId = uuidv4();
      
      const validatedData = insertTradeSchema.parse({
        ...req.body,
        userId,
        tradeId
      });
      
      const trade = await storage.createTrade(validatedData);
      
      // Log the trade activity
      await storage.createActivityLog({
        userId,
        action: 'trade',
        description: 'Trade executed',
        metadata: {
          tradeId,
          symbol: validatedData.symbol,
          side: validatedData.side,
          quantity: validatedData.quantity,
          price: validatedData.price
        }
      });
      
      res.json({ trade, tradeId });
    } catch (error: any) {
      console.error("Error creating trade:", error);
      res.status(500).json({ message: "Failed to create trade: " + error.message });
    }
  });

  // Enhanced SnapTrade order placement with UUID
  app.post('/api/snaptrade/place-order', rateLimits.trading, isAuthenticated, async (req: any, res) => {
    try {
      if (!snapTradeClient) {
        return res.status(500).json({ message: 'SnapTrade client not initialized' });
      }

      const userId = req.user.claims.sub;
      const { accountId, symbol, quantity, action, orderType, price } = req.body;

      // Validate required fields
      if (!accountId || !symbol || !quantity || !action || !orderType) {
        return res.status(400).json({ 
          message: 'Missing required fields: accountId, symbol, quantity, action, orderType' 
        });
      }

      const userRecord = await storage.getUser(userId);
      if (!userRecord?.snaptradeUserSecret) {
        return res.status(404).json({ message: 'SnapTrade credentials not found' });
      }

      const credentials = {
        userId: userRecord.email,
        userSecret: userRecord.snaptradeUserSecret
      };

      // Generate UUID v4 for this trade
      const tradeId = uuidv4();

      // Place order using SnapTrade API
      const orderResponse = await snapTradeClient.trading.placeForceOrder({
        userId: credentials.userId,
        userSecret: credentials.userSecret,
        accountId,
        action: action.toUpperCase(), // BUY or SELL
        orderType: orderType, // Market, Limit, etc.
        symbol,
        units: quantity,
        price: price || undefined,
        timeInForce: 'DAY'
      });

      // Log successful order
      await storage.createActivityLog({
        userId,
        action: 'order_placed',
        description: `${action.toUpperCase()} order placed for ${symbol}`,
        metadata: {
          tradeId,
          symbol,
          quantity,
          action,
          orderType,
          price,
          snapTradeResponse: orderResponse.data
        }
      });

      res.json({ 
        success: true, 
        tradeId,
        orderId: orderResponse.data?.id,
        message: `${action.toUpperCase()} order placed successfully`,
        orderDetails: orderResponse.data
      });

    } catch (error: any) {
      console.error('SnapTrade order placement error:', error);
      
      // Log failed order attempt
      const userId = req.user?.claims?.sub;
      if (userId) {
        await storage.createActivityLog({
          userId,
          action: 'order_failed',
          description: 'Order placement failed',
          metadata: {
            error: error.message,
            requestBody: req.body
          }
        });
      }

      res.status(500).json({ 
        success: false,
        message: error.message || 'Failed to place order',
        error: error.response?.data || error.message
      });
    }
  });

  // Transfer management
  app.get('/api/transfers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transfers = await storage.getTransfers(userId);
      res.json({ transfers });
    } catch (error) {
      console.error("Error fetching transfers:", error);
      res.status(500).json({ message: "Failed to fetch transfers" });
    }
  });

  app.post('/api/transfers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validatedData = insertTransferSchema.parse({
        ...req.body,
        userId
      });
      
      const transfer = await storage.createTransfer(validatedData);
      
      // Log the transfer activity
      await storage.createActivityLog({
        userId,
        action: 'transfer',
        description: 'Transfer executed',
        metadata: {
          fromAccount: validatedData.fromAccountId,
          toAccount: validatedData.toAccountId,
          amount: validatedData.amount
        }
      });
      
      res.json({ transfer });
    } catch (error: any) {
      console.error("Error creating transfer:", error);
      res.status(500).json({ message: "Failed to create transfer: " + error.message });
    }
  });

  // Activity logs
  app.get('/api/activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activities = await storage.getActivityLogs(userId);
      res.json({ activities });
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Payment routes (Stripe integration)
  app.post('/api/create-payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Payment processing not configured" });
      }
      
      const { amount, tier } = req.body;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          tier,
          userId: req.user.claims.sub
        }
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent: " + error.message });
    }
  });

  app.post('/api/confirm-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const { tier } = req.body;
      const userId = req.user.claims.sub;
      
      // Update user subscription tier
      await storage.updateUserSubscription(userId, tier);
      
      // Log the subscription activity
      await storage.createActivityLog({
        userId,
        action: 'subscription_upgrade',
        description: 'Subscription upgraded',
        metadata: { tier }
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error confirming subscription:", error);
      res.status(500).json({ message: "Failed to confirm subscription: " + error.message });
    }
  });

  // Admin middleware - checks if user has admin privileges
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: 'Error checking admin status' });
    }
  };

  // Admin API routes for user and SnapTrade management (restricted to admin only)
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/snaptrade-users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      if (!snapTradeClient) {
        return res.status(500).json({ message: 'SnapTrade client not initialized' });
      }
      const { data } = await snapTradeClient.authentication.listSnapTradeUsers();
      res.json({ users: data });
    } catch (error: any) {
      console.error("Error listing SnapTrade users:", error);
      res.status(500).json({ message: "Failed to list SnapTrade users: " + error.message });
    }
  });

  app.delete('/api/admin/snaptrade-user/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      if (!snapTradeClient) {
        return res.status(500).json({ message: 'SnapTrade client not initialized' });
      }
      const { userId } = req.params;
      await snapTradeClient.authentication.deleteSnapTradeUser({
        userId
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting SnapTrade user:", error);
      res.status(500).json({ message: "Failed to delete SnapTrade user: " + error.message });
    }
  });

  // Teller.io API routes (simplified working version)
  app.post('/api/teller/connect-init', isAuthenticated, async (req: any, res) => {
    try {
      if (!process.env.TELLER_APPLICATION_ID) {
        return res.status(500).json({ message: "Teller not configured. Please add TELLER_APPLICATION_ID to environment variables." });
      }
      
      // Return Teller application ID for frontend integration
      res.json({ 
        applicationId: process.env.TELLER_APPLICATION_ID,
        environment: process.env.TELLER_ENVIRONMENT || 'sandbox'
      });
    } catch (error) {
      console.error("Error initiating Teller connect:", error);
      res.status(500).json({ message: "Failed to initiate Teller connection" });
    }
  });

  app.post('/api/teller/exchange-token', isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.body;
      const userId = req.user.claims.sub;
      
      if (!token) {
        return res.status(400).json({ message: "Access token is required" });
      }

      // Check user account limits
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const existingAccounts = await storage.getConnectedAccounts(userId);
      const accountLimit = getAccountLimit(user.subscriptionTier || 'free');
      
      if (existingAccounts.length >= accountLimit) {
        return res.status(403).json({ 
          message: "Account limit reached. Upgrade your plan to connect more accounts.",
          limit: accountLimit,
          current: existingAccounts.length
        });
      }
      
      // Validate with Teller API
      const tellerResponse = await fetch('https://api.teller.io/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!tellerResponse.ok) {
        throw new Error('Invalid Teller token');
      }
      
      const accounts = await tellerResponse.json();
      
      // Create account records for each connected account
      for (const account of accounts) {
        const accountData = {
          userId,
          provider: 'teller',
          externalAccountId: account.id,
          accountName: account.name || 'Bank Account',
          accountType: 'bank',
          balance: parseFloat(account.balance?.available || "0.00"),
          accessToken: token,
          lastUpdated: new Date()
        };
        
        const validatedData = insertConnectedAccountSchema.parse(accountData);
        await storage.createConnectedAccount(validatedData);
      }
      
      // Log the connection
      await storage.createActivityLog({
        userId,
        action: 'account_connected',
        description: `Connected ${accounts.length} bank account(s) via Teller`,
        metadata: { provider: 'teller', accountType: 'bank', count: accounts.length }
      });
      
      res.json({ success: true, accountsConnected: accounts.length });
    } catch (error: any) {
      console.error("Error exchanging Teller token:", error);
      res.status(500).json({ message: "Failed to exchange token: " + error.message });
    }
  });



// Clean replacement section for after the Teller exchange route
  // Teller.io bank account re-connection route for external popup flow
  app.post('/api/stock/external/teller', isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.body;
      const userId = req.user.claims.sub;
      
      if (!token) {
        return res.status(400).json({ 
          message: "Token is required" 
        });
      }

      // Check user account limits
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const existingAccounts = await storage.getConnectedAccounts(userId);
      const accountLimit = getAccountLimit(user.subscriptionTier || 'free');
      
      if (existingAccounts.length >= accountLimit) {
        return res.status(403).json({ 
          message: "Account limit reached. Upgrade your plan to connect more accounts.",
          limit: accountLimit,
          current: existingAccounts.length
        });
      }
      
      // Validate with Teller API
      const tellerResponse = await fetch('https://api.teller.io/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!tellerResponse.ok) {
        throw new Error('Invalid Teller token');
      }
      
      const accounts = await tellerResponse.json();
      
      // Create account records for each connected account
      for (const account of accounts) {
        const accountData = {
          userId,
          provider: 'teller',
          externalAccountId: account.id,
          accountName: account.name || 'Bank Account',
          accountType: 'bank',
          balance: parseFloat(account.balance?.available || "0.00"),
          accessToken: token,
          lastUpdated: new Date()
        };
        
        const validatedData = insertConnectedAccountSchema.parse(accountData);
        await storage.createConnectedAccount(validatedData);
      }
      
      // Log the connection
      await storage.createActivityLog({
        userId,
        action: 'account_connected',
        description: `Connected ${accounts.length} bank account(s) via Teller`,
        metadata: { provider: 'teller', accountType: 'bank', count: accounts.length }
      });
      
      res.json({ success: true, accountsConnected: accounts.length });
    } catch (error: any) {
      console.error("Error exchanging Teller token:", error);
      res.status(500).json({ message: "Failed to exchange token: " + error.message });
    }
  });

  // DELETE account disconnect route
  app.delete('/api/accounts/:provider/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { provider, id: accountId } = req.params;
      const user = req.user;

      if (!user?.claims?.sub) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const userId = user.claims.sub;

      // Validate provider
      if (!['teller', 'snaptrade'].includes(provider)) {
        return res.status(400).json({ message: 'Invalid provider' });
      }

      console.log(`🔌 Disconnecting ${provider} account ${accountId} for user ${userId}`);

      if (provider === 'teller') {
        // Handle Teller disconnect
        // Note: Teller doesn't require explicit disconnection - we just remove credentials
        const deletedAccounts = await storage.deleteConnectedAccount(userId, provider, accountId);
        
        if (deletedAccounts === 0) {
          return res.status(404).json({ message: 'Account not found' });
        }
        
        console.log(`✅ Teller account ${accountId} disconnected`);
      } else if (provider === 'snaptrade') {
        // Handle SnapTrade disconnect
        const userRecord = await storage.getUser(userId);
        if (!userRecord?.snaptradeUserSecret) {
          return res.status(404).json({ message: 'SnapTrade credentials not found' });
        }

        const credentials = {
          userId: userRecord.email,
          userSecret: userRecord.snaptradeUserSecret
        };

        try {
          // Delete SnapTrade user (this revokes all access)
          if (snapTradeClient) {
            await snapTradeClient.authentication.deleteSnapTradeUser({
              userId: credentials.userId,
              userSecret: credentials.userSecret
            });
            console.log(`✅ SnapTrade user ${credentials.userId} deleted`);
          }
        } catch (snapError) {
          console.warn(`⚠️ SnapTrade deletion failed (continuing with local cleanup):`, snapError);
        }

        // Remove credentials from database
        await storage.updateUser(userId, { snaptradeUserSecret: null });

        // Remove connected accounts
        await storage.deleteConnectedAccount(userId, provider, accountId);
        
        console.log(`✅ SnapTrade account ${accountId} disconnected`);
      }

      res.status(204).send();
    } catch (error) {
      console.error('❌ Account disconnect error:', error);
      res.status(500).json({ message: 'Failed to disconnect account' });
    }
  });

  // Live stock quotes endpoint
  app.get('/api/quotes/:symbol', rateLimits.data, async (req, res) => {
    try {
      const { symbol } = req.params;
      
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ message: 'Valid symbol required' });
      }

      const quote = await marketDataService.getMarketData(symbol.toUpperCase());
      
      if (!quote) {
        return res.status(404).json({ message: `Quote not found for symbol ${symbol}` });
      }

      res.json(quote);
    } catch (error) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ message: 'Failed to fetch quote' });
    }
  });

  // Multiple quotes endpoint
  app.post('/api/quotes', rateLimits.data, async (req, res) => {
    try {
      const { symbols } = req.body;
      
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ message: 'Valid symbols array required' });
      }

      if (symbols.length > 10) {
        return res.status(400).json({ message: 'Maximum 10 symbols allowed per request' });
      }

      const quotes = await marketDataService.getMultipleQuotes(symbols.map(s => s.toUpperCase()));
      res.json(quotes);
    } catch (error) {
      console.error('Error fetching multiple quotes:', error);
      res.status(500).json({ message: 'Failed to fetch quotes' });
    }
  });

  // SnapTrade registration endpoint (Saturday night working version)
  app.post('/api/snaptrade/register', rateLimits.auth, isAuthenticated, async (req: any, res) => {
    try {
      const email = req.user.claims.email?.toLowerCase();
      
      if (!email) {
        return res.status(400).json({
          error: "User email required",
          details: "Authenticated user email is missing",
        });
      }

      console.log('SnapTrade Register: Starting for email:', email);
      
      let user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!snapTradeClient) {
        return res.status(500).json({ error: "SnapTrade client not initialized" });
      }

      // Use email as userId for SnapTrade (Saturday night working version)
      const snaptradeUserId = email;
      
      try {
        console.log('SnapTrade Register: Calling registerSnapTradeUser...');
        
        const { data } = await snapTradeClient.authentication.registerSnapTradeUser({
          userId: snaptradeUserId
        });
        
        console.log('SnapTrade Register: Registration successful:', {
          userId: data.userId,
          hasUserSecret: !!data.userSecret
        });
        
        // Save credentials to the user record
        await storage.updateUser(user.id, {
          snaptradeUserId: data.userId!,
          snaptradeUserSecret: data.userSecret!
        });
        
        // Get login portal URL
        const loginPayload = {
          userId: data.userId!,
          userSecret: data.userSecret!,
        };
        
        const { data: portal } = await snapTradeClient.authentication.loginSnapTradeUser(loginPayload);
        
        console.log('SnapTrade Register: Portal response received:', {
          hasRedirectURI: !!(portal as any).redirectURI
        });
        
        return res.json({ url: (portal as any).redirectURI });
        
      } catch (err: any) {
        console.error('SnapTrade Registration Error:', err);
        
        // Handle USER_EXISTS error gracefully (user already registered) 
        const errData = err.response?.data || err.responseBody;
        if (errData?.code === "USER_EXISTS" || errData?.code === "1010") {
          console.log('SnapTrade Register: User already exists, returning success');
          
          // Return a success response - the connection flow can proceed
          return res.json({ 
            url: `https://connect.snaptrade.com/portal?clientId=${process.env.SNAPTRADE_CLIENT_ID}&userId=${encodeURIComponent(snaptradeUserId)}`,
            message: "User already registered" 
          });
        } else {
          // Other registration errors
          const status = err.response?.status || 500;
          const body = err.response?.data || { message: err.message };
          return res.status(status).json(body);
        }
      }
      
    } catch (error: any) {
      console.error('SnapTrade Register Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return res.status(500).json({
        error: "Failed to register SnapTrade user",
        message: error.message
      });
    }
  });

  // Mount connections and accounts routers
  const connectionsRouter = await import('./routes/connections');
  // SnapTrade registration route is now handled by server/routes/connections.snaptrade.ts

  app.use('/api/connections', connectionsRouter.default);
  
  const portfolioRouter = await import('./routes/portfolio');
  app.use('/api/portfolio', portfolioRouter.default);
  
  const marketRouter = await import('./routes/market');
  app.use('/api/market', marketRouter.default);
  
  const watchlistRouter = await import('./routes/watchlist');
  app.use(watchlistRouter.default);
  
  // Mount the holdings router BEFORE accounts router to avoid conflicts
  const holdingsRouter = await import('./routes/holdings');
  app.use('/api', holdingsRouter.default);
  
  // Mount accounts router AFTER holdings to prevent route conflicts
  const accountsRouter = await import('./routes/accounts');
  app.use('/api', accountsRouter.default);
  
  // Mount the connections SnapTrade routes
  const connectionsSnaptradeRouter = await import('./routes/connections.snaptrade');
  app.use('/api', connectionsSnaptradeRouter.default);
  
  // Disconnect account endpoint
  app.post('/api/accounts/disconnect', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { accountId } = req.body;
      
      if (!accountId) {
        return res.status(400).json({ message: 'Account ID is required' });
      }
      
      // For now, just return success since we don't have a real disconnect implementation
      // In production, this would:
      // 1. Call SnapTrade API to revoke authorization
      // 2. Remove from local database
      // 3. Clean up any cached data
      
      console.log(`[Disconnect] Would disconnect account ${accountId} for user ${userId}`);
      
      res.json({ success: true, message: 'Account disconnected successfully' });
    } catch (error) {
      console.error('Error disconnecting account:', error);
      res.status(500).json({ message: 'Failed to disconnect account' });
    }
  });

  // Account details endpoint that maps local account IDs to external account IDs
  app.get('/api/accounts/:accountId/details', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { accountId } = req.params;
      
      console.log(`[Account Details] User: ${userId}, Account ID: ${accountId}`);
      
      // Check if it's a SnapTrade account ID (UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidRegex.test(accountId)) {
        // This is a SnapTrade account - handle directly with SnapTrade API
        console.log(`[Account Details] SnapTrade account detected: ${accountId}`);
        
        try {
          const { getSnapUser } = await import('./services/snaptradeService');
          const snapUser = await getSnapUser(userId);
          
          if (!snapUser?.userSecret) {
            return res.status(404).json({ 
              message: "SnapTrade account not found or not connected",
              provider: "snaptrade" 
            });
          }
          
          const { accountsApi, portfolioApi } = await import('./lib/snaptrade');
          
          // Get account details
          const accountResponse = await accountsApi.listUserAccounts({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
          });
          
          const account = accountResponse.data?.find(acc => acc.id === accountId);
          if (!account) {
            return res.status(404).json({ 
              message: "SnapTrade account not found",
              provider: "snaptrade" 
            });
          }
          
          // Get positions for this account
          let positions = [];
          try {
            const positionsResponse = await portfolioApi.getUserHoldings({
              userId: snapUser.userId,
              userSecret: snapUser.userSecret,
              accountId: accountId,
            });
            positions = positionsResponse.data || [];
          } catch (error) {
            console.log(`Could not fetch positions for account: ${accountId}`);
          }
          
          // Return SnapTrade account details
          return res.json({
            provider: 'snaptrade',
            account: {
              id: account.id,
              name: account.name === 'Default' 
                ? `${account.institution_name} ${account.meta?.type || 'Account'}`.trim()
                : account.name,
              institution: account.institution_name,
              accountType: account.meta?.type || 'Investment',
              balance: account.balance?.total?.amount || 0,
              currency: account.balance?.total?.currency || 'USD',
              accountNumber: account.number,
              status: account.meta?.status || 'ACTIVE',
              lastSync: account.sync_status?.holdings?.last_successful_sync || new Date().toISOString(),
              positions: positions
            }
          });
        } catch (error) {
          console.error('Error fetching SnapTrade account details:', error);
          return res.status(500).json({ 
            message: "Failed to fetch SnapTrade account details",
            provider: "snaptrade" 
          });
        }
      }
      
      // It's a numeric ID - try to get from database
      const account = await storage.getConnectedAccount(parseInt(accountId));
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      console.log(`[Account Details] Found account: ${account.provider}, External ID: ${account.externalAccountId}`);
      
      if (account.provider === 'teller') {
        // Call Teller Accounts API to get the Account core object
        const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
        
        try {
          // Fetch account core object from Teller
          const accountResponse = await fetch(
            `https://api.teller.io/accounts/${account.externalAccountId}`,
            {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
              }
            }
          );
          
          if (!accountResponse.ok) {
            throw new Error(`Teller API error: ${accountResponse.status}`);
          }
          
          const tellerAccount = await accountResponse.json();
          
          // Fetch live balances from Teller Balances endpoint
          const balancesResponse = await fetch(
            `https://api.teller.io/accounts/${account.externalAccountId}/balances`,
            {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
              }
            }
          );
          
          const balances = balancesResponse.ok ? await balancesResponse.json() : null;
          
          // Fetch account details (routing/account info) for masked identifiers
          const detailsResponse = await fetch(
            `https://api.teller.io/accounts/${account.externalAccountId}/details`,
            {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
              }
            }
          );
          
          const accountDetails = detailsResponse.ok ? await detailsResponse.json() : null;
          
          // Fetch transactions with pagination (recent 30 days worth)
          const transactionsResponse = await fetch(
            `https://api.teller.io/accounts/${account.externalAccountId}/transactions?count=50`,
            {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
              }
            }
          );
          
          const transactions = transactionsResponse.ok ? await transactionsResponse.json() : [];
          
          // Fetch statements from Teller Statements resource
          const statementsResponse = await fetch(
            `https://api.teller.io/accounts/${account.externalAccountId}/statements`,
            {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
              }
            }
          );
          
          const statements = statementsResponse.ok ? await statementsResponse.json() : [];
          
          // Check payment capabilities for credit cards
          let paymentCapabilities = null;
          if (tellerAccount.subtype === 'credit_card') {
            try {
              const capabilitiesResponse = await fetch(
                `https://api.teller.io/accounts/${account.externalAccountId}/capabilities`,
                {
                  headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json'
                  }
                }
              );
              
              if (capabilitiesResponse.ok) {
                const capabilities = await capabilitiesResponse.json();
                paymentCapabilities = {
                  paymentsSupported: capabilities.payments || capabilities.zelle || false,
                  zelleSupported: capabilities.zelle || false,
                  supportedMethods: capabilities.payment_methods || []
                };
              }
            } catch (error) {
              // Payment capabilities check failed, continue without payments
              paymentCapabilities = { paymentsSupported: false };
            }
          }
          
          // Process credit card specific information if this is a credit card
          let creditCardInfo = null;
          if (tellerAccount.subtype === 'credit_card' && balances) {
            creditCardInfo = {
              statementBalance: balances.statement || null,
              minimumDue: balances.minimum_payment || null,
              paymentDueDate: balances.due_date || null,
              creditLimit: balances.credit_limit || null,
              availableCredit: balances.available || null,
              currentBalance: balances.current || null,
              // Add payment capabilities
              paymentCapabilities: paymentCapabilities
            };
          }
          
          // Return comprehensive Teller Account data
          res.json({
            provider: 'teller',
            account: {
              id: tellerAccount.id,
              name: tellerAccount.name,
              type: tellerAccount.type, // depository or credit
              subtype: tellerAccount.subtype, // checking, savings, credit_card, etc.
              institution: tellerAccount.institution, // Institution name and details
              currency: tellerAccount.currency || 'USD',
              last4: tellerAccount.last_four,
              mask: tellerAccount.mask,
              status: tellerAccount.status,
              // Links to related resources
              links: {
                balances: `/accounts/${tellerAccount.id}/balances`,
                transactions: `/accounts/${tellerAccount.id}/transactions`,
                details: `/accounts/${tellerAccount.id}/details`
              }
            },
            // Live balances from Balances endpoint
            balances: {
              available: balances?.available || null,
              ledger: balances?.ledger || null,
              current: balances?.current || null,
              statement: balances?.statement || null,
              creditLimit: balances?.credit_limit || null,
              availableCredit: balances?.available || null,
              minimumPayment: balances?.minimum_payment || null,
              dueDate: balances?.due_date || null
            },
            // Account details with masked routing/account numbers
            accountDetails: {
              routingNumber: accountDetails?.routing_number || null,
              accountNumber: accountDetails?.account_number || null,
              // Only show last 4 digits for security
              routingNumberMask: accountDetails?.routing_number ? 
                `****${accountDetails.routing_number.slice(-4)}` : null,
              accountNumberMask: accountDetails?.account_number ? 
                `****${accountDetails.account_number.slice(-4)}` : null
            },
            // Enhanced transactions with proper fields
            transactions: transactions.map((txn: any) => ({
              id: txn.id,
              date: txn.date,
              status: txn.status, // pending or posted
              description: txn.description,
              merchant: txn.counterparty?.name || null,
              amount: txn.amount,
              category: txn.category || null,
              type: txn.type,
              running_balance: txn.running_balance || null
            })),
            // Credit card specific info (if applicable)
            creditCardInfo,
            // Statements with download URLs
            statements: statements.map((stmt: any) => ({
              id: stmt.id,
              period: stmt.period || `${stmt.start_date} - ${stmt.end_date}`,
              startDate: stmt.start_date,
              endDate: stmt.end_date,
              downloadUrl: stmt.url || null,
              status: stmt.status || 'available'
            })),
            metadata: {
              fetched_at: new Date().toISOString(),
              account_type: tellerAccount.type,
              account_subtype: tellerAccount.subtype,
              is_credit_card: tellerAccount.subtype === 'credit_card',
              has_statements: statements.length > 0,
              payments_supported: paymentCapabilities?.paymentsSupported || false
            }
          });
          
        } catch (error: any) {
          logger.error('Failed to fetch Teller account details', { 
            error: error.message, 
            accountId: account.externalAccountId,
            userId 
          });
          res.status(500).json({ 
            message: "Failed to fetch account details from Teller",
            error: error.message 
          });
        }
        
      } else if (account.provider === 'snaptrade') {
        // Handle SnapTrade accounts
        try {
          const snapUser = await getSnapUser(userId);
          if (!snapUser?.userSecret) {
            return res.status(404).json({ message: "SnapTrade credentials not found" });
          }
          
          const { accountsApi, snaptradeClient } = await import('./lib/snaptrade');
          
          // Get account information
          const accountList = await accountsApi.listUserAccounts({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret
          });
          
          const snapAccount = accountList.data?.find(acc => acc.id === account.externalAccountId);
          if (!snapAccount) {
            return res.status(404).json({ message: "SnapTrade account not found" });
          }
          
          // Get account positions/holdings
          const positionsResponse = await snaptradeClient.accountInformation.getUserAccountPositions({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accountId: account.externalAccountId!
          });
          
          // Get recent activities/transactions
          const activitiesResponse = await snaptradeClient.transactionsAndReporting.getActivities({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accounts: account.externalAccountId!
          });
          
          // snapAccount is already defined above
          
          res.json({
            provider: 'snaptrade',
            accountInformation: {
              id: snapAccount.id,
              name: snapAccount.name,
              number: snapAccount.number,
              brokerage: snapAccount.institution_name,
              type: snapAccount.meta?.type || 'investment',
              status: snapAccount.meta?.status || 'active',
              currency: snapAccount.balance?.total?.currency || 'USD',
              balancesOverview: {
                cash: snapAccount.balance?.cash?.amount || 0,
                equity: snapAccount.balance?.total?.amount || 0,
                buyingPower: snapAccount.buying_power?.amount || 0
              }
            },
            balancesAndHoldings: {
              balances: {
                cashAvailableToTrade: snapAccount.balance?.cash?.amount || 0,
                totalEquityValue: snapAccount.balance?.total?.amount || 0,
                buyingPowerOrMargin: snapAccount.buying_power?.amount || 0
              },
              holdings: positionsResponse.data?.map((position: any) => ({
                symbol: position.symbol?.symbol || 'UNKNOWN',
                name: position.symbol?.name || position.symbol?.description || '',
                quantity: position.units || 0,
                costBasis: position.average_purchase_price || 0,
                marketValue: (position.units || 0) * (position.price || 0),
                currentPrice: position.price || 0,
                unrealized: position.open_pnl || 0
              })) || []
            },
            positionsAndOrders: {
              activePositions: positionsResponse.data || [],
              pendingOrders: [],
              orderHistory: []
            },
            tradingActions: {
              canPlaceOrders: true,
              canCancelOrders: true,
              canGetConfirmations: true
            },
            activityAndTransactions: activitiesResponse.data?.map((activity: any) => ({
              type: activity.type || 'trade',
              symbol: activity.symbol || '',
              amount: activity.amount || 0,
              quantity: activity.units || 0,
              timestamp: activity.trade_date || activity.settlement_date,
              description: activity.description || `${activity.type} ${activity.symbol}`
            })) || [],
            metadata: {
              fetched_at: new Date().toISOString(),
              last_sync: snapAccount.sync_status,
              cash_restrictions: snapAccount.cash_restrictions || [],
              account_created: snapAccount.created_date
            }
          });
          
        } catch (error: any) {
          logger.error('Failed to fetch SnapTrade account details', { 
            error: error.message, 
            accountId: account.externalAccountId,
            userId 
          });
          res.status(500).json({ 
            message: "Failed to fetch account details from SnapTrade",
            error: error.message 
          });
        }
        
      } else {
        res.status(400).json({ message: "Unknown account provider" });
      }
      
    } catch (error: any) {
      logger.error("Failed to fetch account details", { 
        error: error.message, 
        accountId: req.params.accountId,
        userId: req.user?.claims?.sub 
      });
      res.status(500).json({ 
        message: "Failed to fetch account details",
        error: error.message 
      });
    }
  });

  // Credit card payment route using Teller Payments API
  app.post('/api/accounts/:localAccountId/pay', isAuthenticated, async (req: any, res) => {
    const { amount, paymentType } = req.body; // paymentType: 'minimum', 'statement', 'custom'
    
    try {
      // Get the account from our database
      const account = await storage.getAccountByLocalId(parseInt(req.params.localAccountId));
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (account.provider !== 'teller') {
        return res.status(400).json({ message: "Payments only supported for Teller accounts" });
      }

      const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
      
      // First, check if payments are supported
      const capabilitiesResponse = await fetch(
        `https://api.teller.io/accounts/${account.externalAccountId}/capabilities`,
        {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        }
      );

      if (!capabilitiesResponse.ok) {
        return res.status(400).json({ 
          message: "Unable to check payment capabilities",
          fallback: "Your issuer doesn't support in-app payments via Zelle—use the bank or card app to pay."
        });
      }

      const capabilities = await capabilitiesResponse.json();
      if (!capabilities.payments && !capabilities.zelle) {
        return res.status(400).json({ 
          message: "Payments not supported for this account",
          fallback: "Your issuer doesn't support in-app payments via Zelle—use the bank or card app to pay."
        });
      }

      // Create form data for the payment request (Teller uses form-encoded requests)
      const paymentData = new URLSearchParams({
        amount: amount.toString(),
        currency: 'USD',
        description: `Credit card payment - ${paymentType}`,
        method: 'zelle'
      });

      // Initiate payment
      const paymentResponse = await fetch(
        `https://api.teller.io/accounts/${account.externalAccountId}/payments`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: paymentData
        }
      );

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({}));
        return res.status(paymentResponse.status).json({ 
          message: "Payment failed to initiate",
          error: errorData.message || 'Unknown payment error',
          fallback: "Your issuer doesn't support in-app payments via Zelle—use the bank or card app to pay."
        });
      }

      const payment = await paymentResponse.json();
      
      res.json({
        success: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          method: payment.method,
          description: payment.description,
          created_at: payment.created_at
        }
      });

    } catch (error: any) {
      logger.error('Failed to process payment', { 
        error: error.message, 
        accountId: req.params.localAccountId 
      });
      res.status(500).json({ 
        message: "Payment processing failed",
        fallback: "Your issuer doesn't support in-app payments via Zelle—use the bank or card app to pay."
      });
    }
  });
  
  // Dev-only SnapTrade user repair endpoint
  app.post('/api/debug/snaptrade/repair-user', async (req, res) => {
    try {
      const userId = (req.body?.userId || '').toString().trim();
      if (!userId) return res.status(400).json({ message: 'userId required' });

      const { authApi } = await import('./lib/snaptrade');
      const { deleteUserLocal, saveUser } = await import('./store/snapUsers');

      // 1) Try to delete server-side user (idempotent)
      try {
        await authApi.deleteSnapTradeUser({ userId }); // queues deletion; async on their side
        console.log('[Debug] SnapTrade user deletion queued for:', userId);
      } catch (deleteErr) {
        console.log('[Debug] SnapTrade user deletion failed (continuing):', deleteErr?.message);
      }

      // 2) Remove our local record
      await deleteUserLocal(userId);
      console.log('[Debug] Local user record deleted for:', userId);

      // 3) Re-register to get a fresh provider-side userSecret
      const created = await authApi.registerSnapTradeUser({ userId });
      await saveUser({ userId: created.userId!, userSecret: created.userSecret! });

      res.json({ ok: true, userId, userSecretLen: created.userSecret?.length || 0 });
    } catch (e: any) {
      console.error('[Debug] Repair user error:', e?.responseBody || e?.message);
      return res.status(500).json({ 
        ok: false, 
        error: e?.responseBody || e?.message 
      });
    }
  });

  // Mount debug routes
  const debugRouter = await import('./routes/debug');
  app.use('/api/debug', debugRouter.default);
  
  // Register settings routes
  const { registerSettingsRoutes } = await import('./routes/settings');
  registerSettingsRoutes(app);
  
  // Register security routes
  const { registerSecurityRoutes } = await import('./routes/security');
  registerSecurityRoutes(app);
  
  // Register health routes
  const { registerHealthRoutes } = await import('./routes/health');
  registerHealthRoutes(app);
  
  // Register demo routes
  const { registerDemoRoutes } = await import('./routes/demo');
  registerDemoRoutes(app);
  
  // Admin API routes - use existing isAdmin middleware
  app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const connectedAccounts = await storage.getConnectedAccounts('');
      
      const stats = {
        totalUsers: users.length,
        freeUsers: users.filter(u => u.subscriptionTier === 'free').length,
        proUsers: users.filter(u => u.subscriptionTier === 'pro').length,
        premiumUsers: users.filter(u => u.subscriptionTier === 'premium').length,
        totalRevenue: (users.filter(u => u.subscriptionTier === 'pro').length * 20) + 
                     (users.filter(u => u.subscriptionTier === 'premium').length * 50),
        totalConnectedAccounts: connectedAccounts.length,
        activeUsers: users.filter(u => {
          const lastLogin = u.lastLogin ? new Date(u.lastLogin) : new Date(u.createdAt);
          const daysSinceLogin = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceLogin < 7;
        }).length,
        churnRate: 0 // Placeholder for churn calculation
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });
  
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Get all connected accounts for all users
      const allAccounts = await Promise.all(
        users.map(user => storage.getConnectedAccounts(user.id))
      );
      const connectedAccounts = allAccounts.flat();
      
      // Enhance user data with connected accounts count and total balance
      const enhancedUsers = await Promise.all(users.map(async (user) => {
        const userAccounts = connectedAccounts.filter(acc => acc.userId === user.id);
        const totalBalance = userAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || '0'), 0);
        
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          subscriptionTier: user.subscriptionTier || 'free',
          subscriptionStatus: user.subscriptionStatus || 'active',
          connectedAccounts: userAccounts.length,
          totalBalance,
          lastLogin: user.lastLogin || user.createdAt,
          createdAt: user.createdAt,
          isAdmin: user.isAdmin || false,
          isBanned: user.isBanned || false
        };
      }));
      
      res.json(enhancedUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });
  
  app.post('/api/admin/upgrade-user', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, tier } = req.body;
      
      if (!userId || !tier) {
        return res.status(400).json({ message: 'User ID and tier are required' });
      }
      
      const updatedUser = await storage.updateUserSubscription(userId, tier, 'active');
      
      // Log the action
      await storage.logActivity({
        userId: req.user.claims.sub,
        action: 'admin_upgrade_user',
        description: `Upgraded user ${userId} to ${tier}`,
        metadata: { targetUserId: userId, newTier: tier }
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error upgrading user:', error);
      res.status(500).json({ message: 'Failed to upgrade user' });
    }
  });
  
  app.post('/api/admin/disconnect-accounts', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      // Delete all connected accounts for the user
      const userAccounts = await storage.getConnectedAccounts(userId);
      for (const account of userAccounts) {
        await storage.deleteConnectedAccount(userId, account.provider, account.externalAccountId);
      }
      
      // Delete SnapTrade user if exists
      await storage.deleteSnapTradeUser(userId);
      
      // Log the action
      await storage.logActivity({
        userId: req.user.claims.sub,
        action: 'admin_disconnect_accounts',
        description: `Disconnected all accounts for user ${userId}`,
        metadata: { targetUserId: userId }
      });
      
      res.json({ success: true, message: 'All accounts disconnected' });
    } catch (error) {
      console.error('Error disconnecting accounts:', error);
      res.status(500).json({ message: 'Failed to disconnect accounts' });
    }
  });
  
  app.post('/api/admin/ban-user', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      const updatedUser = await storage.updateUserBanStatus(userId, true);
      
      // Log the action
      await storage.logActivity({
        userId: req.user.claims.sub,
        action: 'admin_ban_user',
        description: `Banned user ${userId}`,
        metadata: { targetUserId: userId }
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error banning user:', error);
      res.status(500).json({ message: 'Failed to ban user' });
    }
  });
  
  app.post('/api/admin/unban-user', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      const updatedUser = await storage.updateUserBanStatus(userId, false);
      
      // Log the action
      await storage.logActivity({
        userId: req.user.claims.sub,
        action: 'admin_unban_user',
        description: `Unbanned user ${userId}`,
        metadata: { targetUserId: userId }
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error unbanning user:', error);
      res.status(500).json({ message: 'Failed to unban user' });
    }
  });
  
  // Mount comprehensive admin routes
  const adminRouter = await import('./routes/admin');
  app.use('/api/admin', adminRouter.default);
  
  const tradingRouter = await import('./routes/trading');
  app.use('/api/trade', tradingRouter.default);

  // Teller Payments routes  
  const tellerPaymentsRouter = await import('./routes/teller-payments');
  app.use('/api/teller/payments', tellerPaymentsRouter.default);

  // Legacy route: Account details without provider (for backward compatibility)
  app.get('/api/accounts/:accountId/details', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { accountId } = req.params;
      
      // Get the connected account to determine the provider and external ID
      const account = await storage.getConnectedAccount(parseInt(accountId));
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      if (account.provider === 'teller') {
        // Call the Teller API using the external account ID
        const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
        
        // Fetch account details from Teller
        const accountResponse = await fetch(
          `https://api.teller.io/accounts/${account.externalAccountId}/details`,
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          }
        );
        
        if (!accountResponse.ok) {
          throw new Error(`Failed to fetch account details: ${accountResponse.status}`);
        }
        
        const accountDetails = await accountResponse.json();
        
        // Fetch balances
        const balancesResponse = await fetch(
          `https://api.teller.io/accounts/${account.externalAccountId}/balances`,
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          }
        );
        
        const balances = balancesResponse.ok ? await balancesResponse.json() : null;
        
        res.json({
          success: true,
          account: accountDetails,
          balances,
        });
        
      } else if (account.provider === 'snaptrade') {
        // Handle SnapTrade account details here if needed
        res.status(501).json({ message: "SnapTrade account details not implemented yet" });
      } else {
        res.status(400).json({ message: "Unknown provider" });
      }
      
    } catch (error: any) {
      logger.error("Failed to fetch account details", { error: error.message, accountId: req.params.accountId });
      res.status(500).json({ 
        message: "Failed to fetch account details",
        error: error.message 
      });
    }
  });

  // Account details route that maps internal IDs to external IDs (with provider)
  app.get('/api/accounts/:provider/:accountId/details', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { provider, accountId } = req.params;
      
      if (provider === 'teller') {
        // Get the connected account to find the external ID
        const account = await storage.getConnectedAccount(parseInt(accountId));
        if (!account || account.userId !== userId || account.provider !== 'teller') {
          return res.status(404).json({ message: "Account not found" });
        }
        
        // Call the Teller API using the external account ID
        const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
        
        // Fetch account details from Teller
        const accountResponse = await fetch(
          `https://api.teller.io/accounts/${account.externalAccountId}/details`,
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          }
        );
        
        if (!accountResponse.ok) {
          throw new Error(`Failed to fetch account details: ${accountResponse.status}`);
        }
        
        const accountDetails = await accountResponse.json();
        
        // Fetch balances
        const balancesResponse = await fetch(
          `https://api.teller.io/accounts/${account.externalAccountId}/balances`,
          {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          }
        );
        
        const balances = balancesResponse.ok ? await balancesResponse.json() : null;
        
        res.json({
          success: true,
          account: accountDetails,
          balances,
        });
        
      } else if (provider === 'snaptrade') {
        // Handle SnapTrade account details here if needed
        res.status(501).json({ message: "SnapTrade account details not implemented yet" });
      } else {
        res.status(400).json({ message: "Invalid provider" });
      }
      
    } catch (error: any) {
      logger.error("Failed to fetch account details", { error: error.message, provider: req.params.provider, accountId: req.params.accountId });
      res.status(500).json({ 
        message: "Failed to fetch account details",
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function for account limits
function getAccountLimit(tier: string): number {
  switch (tier) {
    case 'free': return 1;
    case 'basic': return 3;
    case 'pro': return 10;
    case 'premium': return 25;
    default: return 1;
  }
}

// Helper functions for subscription detection
function detectRecurringPayments(transactions: any[]) {
  const subscriptions: any[] = [];
  
  // Group transactions by merchant/description similarity
  const merchantGroups = groupTransactionsByMerchant(transactions);
  
  for (const [merchantKey, merchantTransactions] of merchantGroups) {
    if (merchantTransactions.length < 2) continue; // Need at least 2 transactions
    
    // Sort by date
    merchantTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Check for recurring patterns
    const recurringPattern = analyzeRecurringPattern(merchantTransactions);
    
    if (recurringPattern && recurringPattern.confidence > 0.6) {
      const latestTransaction = merchantTransactions[merchantTransactions.length - 1];
      const subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        merchantName: getMerchantDisplayName(merchantKey),
        amount: recurringPattern.averageAmount,
        frequency: recurringPattern.frequency,
        nextBillingDate: calculateNextBillingDate(latestTransaction.date, recurringPattern.frequency),
        lastTransactionDate: latestTransaction.date,
        confidence: recurringPattern.confidence,
        category: categorizeSubscription(merchantKey),
        accountName: latestTransaction.accountName,
        transactions: merchantTransactions.slice(-6) // Last 6 transactions
      };
      
      subscriptions.push(subscription);
    }
  }
  
  // Sort by monthly spend (highest first)
  return subscriptions.sort((a, b) => {
    const aMonthly = getMonthlyAmount(a.amount, a.frequency);
    const bMonthly = getMonthlyAmount(b.amount, b.frequency);
    return bMonthly - aMonthly;
  });
}

function groupTransactionsByMerchant(transactions: any[]) {
  const groups = new Map();
  
  for (const transaction of transactions) {
    const key = getMerchantKey(transaction);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(transaction);
  }
  
  return groups;
}

function getMerchantKey(transaction: any) {
  // Try to extract clean merchant name from description
  const description = transaction.description || '';
  const merchant = transaction.merchant_name || '';
  
  // Use merchant name if available, otherwise clean up description
  if (merchant) {
    return merchant.toLowerCase().trim();
  }
  
  // Clean up common transaction prefixes/suffixes
  const cleaned = description
    .toLowerCase()
    .replace(/^(payment to|autopay|recurring|monthly|subscription)/gi, '')
    .replace(/(payment|autopay|recurring)$/gi, '')
    .replace(/\d{4}$/g, '') // Remove trailing numbers
    .replace(/[*#]/g, '') // Remove special characters
    .trim();
    
  return cleaned || description.toLowerCase();
}

function getMerchantDisplayName(merchantKey: string) {
  // Convert back to display format
  return merchantKey
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function analyzeRecurringPattern(transactions: any[]) {
  if (transactions.length < 2) return null;
  
  // Calculate intervals between transactions (in days)
  const intervals = [];
  for (let i = 1; i < transactions.length; i++) {
    const prev = new Date(transactions[i - 1].date);
    const curr = new Date(transactions[i].date);
    const daysDiff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysDiff);
  }
  
  // Check for monthly pattern (28-32 days)
  const monthlyIntervals = intervals.filter(interval => interval >= 28 && interval <= 32);
  if (monthlyIntervals.length >= Math.max(1, intervals.length * 0.6)) {
    return {
      frequency: 'monthly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: Math.min(0.9, monthlyIntervals.length / intervals.length)
    };
  }
  
  // Check for weekly pattern (6-8 days)
  const weeklyIntervals = intervals.filter(interval => interval >= 6 && interval <= 8);
  if (weeklyIntervals.length >= Math.max(1, intervals.length * 0.6)) {
    return {
      frequency: 'weekly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: Math.min(0.9, weeklyIntervals.length / intervals.length)
    };
  }
  
  // Check for quarterly pattern (88-95 days)
  const quarterlyIntervals = intervals.filter(interval => interval >= 88 && interval <= 95);
  if (quarterlyIntervals.length >= Math.max(1, intervals.length * 0.5)) {
    return {
      frequency: 'quarterly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: Math.min(0.8, quarterlyIntervals.length / intervals.length)
    };
  }
  
  // Check for yearly pattern (360-370 days)
  const yearlyIntervals = intervals.filter(interval => interval >= 360 && interval <= 370);
  if (yearlyIntervals.length >= 1) {
    return {
      frequency: 'yearly',
      averageAmount: calculateAverageAmount(transactions),
      confidence: 0.7
    };
  }
  
  return null;
}

function calculateAverageAmount(transactions: any[]) {
  const amounts = transactions.map(t => t.amount);
  return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
}

function calculateNextBillingDate(lastDate: string, frequency: string) {
  const date = new Date(lastDate);
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split('T')[0];
}

function categorizeSubscription(merchantKey: string) {
  const streaming = ['netflix', 'spotify', 'hulu', 'disney', 'amazon prime', 'apple music', 'youtube', 'hbo'];
  const utilities = ['electric', 'gas', 'water', 'internet', 'phone', 'cable', 'verizon', 'att', 'comcast'];
  const software = ['adobe', 'microsoft', 'google', 'dropbox', 'github', 'slack', 'zoom'];
  const fitness = ['gym', 'fitness', 'peloton', 'planet fitness', 'yoga'];
  const finance = ['bank', 'credit', 'loan', 'insurance', 'investment'];
  
  const key = merchantKey.toLowerCase();
  
  if (streaming.some(term => key.includes(term))) return 'Streaming';
  if (utilities.some(term => key.includes(term))) return 'Utilities';
  if (software.some(term => key.includes(term))) return 'Software';
  if (fitness.some(term => key.includes(term))) return 'Fitness';
  if (finance.some(term => key.includes(term))) return 'Financial';
  
  return 'Other';
}

function getMonthlyAmount(amount: number, frequency: string) {
  switch (frequency) {
    case 'weekly': return amount * 4.33; // Average weeks per month
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
    default: return amount;
  }
}