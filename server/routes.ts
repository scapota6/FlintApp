import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { rateLimits } from "./middleware/rateLimiter";
import snaptradeEnhancedRoutes from "./routes/snaptrade-enhanced";
import { WalletService } from "./services/WalletService";
import { TradingAggregator } from "./services/TradingAggregator";
import { marketDataService } from "./services/market-data";
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

// Initialize SnapTrade SDK with proper environment variables and debugging
let snapTradeClient: Snaptrade | null = null;
if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CLIENT_SECRET) {
  console.log('Initializing SnapTrade SDK with clientId:', process.env.SNAPTRADE_CLIENT_ID);
  console.log('Environment check - CLIENT_ID length:', process.env.SNAPTRADE_CLIENT_ID.length);
  console.log('Environment check - CLIENT_SECRET length:', process.env.SNAPTRADE_CLIENT_SECRET.length);
  
  try {
    snapTradeClient = new Snaptrade({
      clientId: process.env.SNAPTRADE_CLIENT_ID,
      consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
    });
    console.log('SnapTrade SDK initialized successfully');
    
    // Test basic API connectivity
    snapTradeClient.apiStatus.check().then(status => {
      console.log('SnapTrade API Status:', status.data);
    }).catch(err => {
      console.error('SnapTrade API Status Check Failed:', err.message);
    });
    
  } catch (error) {
    console.error('Failed to initialize SnapTrade SDK:', error);
  }
} else {
  console.log('SnapTrade environment variables missing - SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET required');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes (with rate limiting)
  app.get('/api/auth/user', rateLimits.auth, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard data (with data rate limiting)
  app.get('/api/dashboard', rateLimits.data, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const accounts = await storage.getConnectedAccounts(userId);
      const user = await storage.getUser(userId);
      
      let totalBalance = 0;
      let bankBalance = 0;
      let investmentValue = 0;
      let cryptoValue = 0;
      
      accounts.forEach(account => {
        const accountBalance = typeof account.balance === 'string' ? parseFloat(account.balance) : (account.balance || 0);
        if (account.provider === 'teller') {
          bankBalance += accountBalance;
        } else if (account.provider === 'snaptrade') {
          investmentValue += accountBalance;
        } else if (account.provider === 'crypto') {
          cryptoValue += accountBalance;
        }
        totalBalance += accountBalance;
      });
      
      const dashboardData = {
        totalBalance,
        bankBalance,
        investmentValue,
        cryptoValue,
        accounts: accounts.map(account => ({
          id: account.id,
          provider: account.provider,
          accountName: account.accountName,
          balance: account.balance,
          lastUpdated: account.lastSynced
        })),
        subscriptionTier: user?.subscriptionTier || 'free'
      };
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
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

  // Register enhanced SnapTrade routes
  app.use('/api/snaptrade', snaptradeEnhancedRoutes);
  
  // Register market data routes directly
  app.get('/api/polygon/test', async (req, res) => {
    try {
      const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apikey=${process.env.POLYGON_API_KEY}`);
      if (response.ok) {
        const data = await response.json();
        res.json({ success: true, message: 'Polygon.io API connected successfully', data: data.results?.[0] });
      } else {
        res.status(503).json({ success: false, message: 'Polygon.io API error' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/polygon/quote/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apikey=${process.env.POLYGON_API_KEY}`);
      
      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch quote' });
      }
      
      const data = await response.json();
      if (data.results && data.results[0]) {
        const result = data.results[0];
        res.json({
          symbol: symbol.toUpperCase(),
          price: result.c,
          change: result.c - result.o,
          changePct: ((result.c - result.o) / result.o) * 100,
          volume: result.v,
          source: 'polygon.io'
        });
      } else {
        res.status(404).json({ error: 'No data found' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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