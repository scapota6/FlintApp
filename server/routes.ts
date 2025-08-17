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
import { authApi } from './lib/snaptrade';
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

  // GET /api/csrf-token endpoint - provides CSRF token for state-changing requests
  app.get('/api/csrf-token', rateLimits.auth, (req, res) => {
    // Check if session exists
    if (!req.session) {
      return res.status(500).json({ 
        message: "Session not initialized",
        error: "SESSION_NOT_INITIALIZED"
      });
    }
    
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    
    res.json({ 
      csrfToken: req.session.csrfToken,
      message: "Include this token in X-CSRF-Token header for state-changing requests"
    });
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

      // Fetch real bank account data from Teller
      try {
        console.log('Fetching bank accounts for user:', userEmail);
        const bankAccounts = await storage.getBankAccounts(userId);
        
        for (const account of bankAccounts) {
          const balance = parseFloat(account.balance) || 0;
          bankBalance += balance;
          totalBalance += balance;
          
          enrichedAccounts.push({
            id: account.id,
            provider: 'teller',
            accountName: account.name || 'Bank Account',
            balance: balance,
            type: 'bank' as const,
            institution: account.institution || 'Bank',
            lastUpdated: account.lastSynced || new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error fetching bank accounts:', error);
      }

      // Fetch real investment account data from SnapTrade
      let snapTradeError = null;
      try {
        console.log('Fetching SnapTrade accounts for user:', userEmail);
        
        // Use the persistent store instead of database storage
        const snapUser = await getSnapUser(userEmail);
        if (snapUser?.userSecret) {
          const { accountsApi } = await import('./lib/snaptrade');
          const accounts = await accountsApi.listUserAccounts({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
          });
          
          console.log('SnapTrade accounts fetched:', accounts.data?.length || 0);
          
          if (accounts.data && Array.isArray(accounts.data)) {
            for (const account of accounts.data) {
              const balance = parseFloat(account.total_value?.amount || '0') || 0;
              const cash = parseFloat(account.cash?.amount || '0') || 0;
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
          console.log('[SnapTrade] Detected stale user credentials, triggering repair flow for:', userEmail);
          try {
            await deleteUserLocal(userEmail);
            console.log('[SnapTrade] Deleted stale user credentials for repair');
          } catch (deleteError) {
            console.error('[SnapTrade] Error deleting stale user:', deleteError);
          }
        } else {
          snapTradeError = 'fetch_failed';
        }
      }

      // Add any legacy connected accounts that aren't covered above
      // Skip placeholder accounts to avoid showing false data
      for (const account of connectedAccounts) {
        const existingAccount = enrichedAccounts.find(ea => ea.id === account.id);
        if (!existingAccount && account.provider !== 'placeholder') {
          const accountBalance = parseFloat(account.balance?.toString() || '0') || 0;
          
          // Skip accounts with exactly 100000 balance (placeholder)
          if (accountBalance === 100000) continue;
          
          let accountType: 'bank' | 'investment' | 'crypto' = 'investment';
          if (account.provider === 'teller') accountType = 'bank';
          else if (account.provider === 'crypto') accountType = 'crypto';
          
          if (accountType === 'crypto') {
            cryptoValue += accountBalance;
          }
          totalBalance += accountBalance;
          
          enrichedAccounts.push({
            id: account.id,
            provider: account.provider,
            accountName: account.accountName || 'Account',
            balance: accountBalance,
            type: accountType,
            institution: account.accountName || account.provider,
            lastUpdated: account.lastSynced || new Date().toISOString()
          });
        }
      }
      
      // Check if we have any connected accounts
      const hasConnectedAccounts = enrichedAccounts.length > 0;
      const needsConnection = !hasConnectedAccounts || snapTradeError === 'not_connected';
      
      const dashboardData = {
        totalBalance: hasConnectedAccounts ? totalBalance : 0,
        bankBalance,
        investmentValue,
        cryptoValue,
        accounts: enrichedAccounts,
        subscriptionTier: user?.subscriptionTier || 'free',
        needsConnection,
        connectionStatus: {
          hasAccounts: hasConnectedAccounts,
          snapTradeError: snapTradeError,
          message: needsConnection ? 'Connect your accounts to see your portfolio' : null
        }
      };
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      
      // Return empty state instead of 500 error for better UX
      const emptyDashboardData = {
        totalBalance: 0,
        bankBalance: 0,
        investmentValue: 0,
        cryptoValue: 0,
        accounts: [],
        subscriptionTier: user?.subscriptionTier || 'free',
        needsConnection: true,
        connectionStatus: {
          hasAccounts: false,
          snapTradeError: 'fetch_failed',
          message: 'Connect your accounts to see your portfolio'
        }
      };
      
      res.json(emptyDashboardData);
    }
  });



  // Log user login activity with SnapTrade registration check
  app.post('/api/log-login', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // SnapTrade registration is now handled on-demand during connection
      
      await storage.createActivityLog({
        userId,
        action: 'login',
        description: 'User logged in',
        metadata: { timestamp: new Date().toISOString() }
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging activity:", error);
      res.status(500).json({ message: "Failed to log activity" });
    }
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

  // Admin middleware - restrict to platform owner only
  const isAdmin = (req: any, res: any, next: any) => {
    const userEmail = req.user?.claims?.email;
    const adminEmails = ['scapota@flint-investing.com']; // Platform owner email
    
    if (!adminEmails.includes(userEmail)) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
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
  
  const accountsRouter = await import('./routes/accounts');
  app.use('/api', accountsRouter.default);
  
  const portfolioRouter = await import('./routes/portfolio');
  app.use('/api/portfolio', portfolioRouter.default);
  
  const marketRouter = await import('./routes/market');
  app.use('/api/market', marketRouter.default);
  
  const watchlistRouter = await import('./routes/watchlist');
  app.use(watchlistRouter.default);
  
  // Mount the holdings router
  const holdingsRouter = await import('./routes/holdings');
  app.use('/api', holdingsRouter.default);
  
  // Mount the connections SnapTrade routes
  const connectionsSnaptradeRouter = await import('./routes/connections.snaptrade');
  app.use('/api', connectionsSnaptradeRouter.default);
  
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
  
  const tradingRouter = await import('./routes/trading');
  app.use('/api/trade', tradingRouter.default);

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