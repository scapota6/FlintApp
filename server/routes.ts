import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import crypto from "crypto";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { rateLimits } from "./middleware/rateLimiter";
import { WalletService } from "./services/WalletService";
import { TradingAggregator } from "./services/TradingAggregator";
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

// Initialize SnapTrade SDK with proper environment variables
let snapTradeClient: Snaptrade | null = null;
if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CLIENT_SECRET) {
  console.log('Initializing SnapTrade SDK with clientId:', process.env.SNAPTRADE_CLIENT_ID);
  
  try {
    snapTradeClient = new Snaptrade({
      clientId: process.env.SNAPTRADE_CLIENT_ID,
      consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
    });
    console.log('SnapTrade SDK initialized successfully');
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
      
      const validatedData = insertTradeSchema.parse({
        ...req.body,
        userId
      });
      
      const trade = await storage.createTrade(validatedData);
      
      // Log the trade activity
      await storage.createActivityLog({
        userId,
        action: 'trade',
        description: 'Trade executed',
        metadata: {
          symbol: validatedData.symbol,
          side: validatedData.side,
          quantity: validatedData.quantity,
          price: validatedData.price
        }
      });
      
      res.json({ trade });
    } catch (error: any) {
      console.error("Error creating trade:", error);
      res.status(500).json({ message: "Failed to create trade: " + error.message });
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

  // SnapTrade user registration - one-time registration with proper flow
  app.post('/api/snaptrade/register', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user.claims;
      const flintUserId = currentUser.sub;
      const userEmail = currentUser.email?.toLowerCase() || `user_${flintUserId}`;
      
      if (!snapTradeClient) {
        return res.status(502).json({ 
          error: "SnapTrade not configured", 
          details: "SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET environment variables required" 
        });
      }
      
      // Check if user already has valid SnapTrade credentials
      const existingUser = await storage.getSnapTradeUser(flintUserId);
      if (existingUser && existingUser.snaptradeUserId && existingUser.userSecret && !existingUser.userSecret.startsWith('secret_')) {
        console.log('SnapTrade user already registered:', existingUser.snaptradeUserId);
        return res.json({ 
          success: true, 
          message: 'User already registered', 
          userId: existingUser.snaptradeUserId 
        });
      }
      
      // Register new user with SnapTrade using email as userId
      console.log('Registering SnapTrade user with email:', userEmail);

      try {
        const registrationResponse = await snapTradeClient.authentication.registerSnapTradeUser({
          userId: userEmail,
          firstName: currentUser.name || 'User',
          lastName: currentUser.family_name || ''
        });

        const registrationData = registrationResponse.data;
        console.log('SnapTrade registration successful:', {
          userId: registrationData.userId,
          hasSecret: !!registrationData.userSecret
        });
        
        // Store SnapTrade credentials in database
        if (registrationData.userId && registrationData.userSecret) {
          await storage.createSnapTradeUser(
            flintUserId,
            registrationData.userId,
            registrationData.userSecret
          );
          
          res.json({
            success: true,
            message: "Successfully registered with SnapTrade",
            userId: registrationData.userId
          });
        } else {
          throw new Error('Invalid registration response from SnapTrade');
        }
        
      } catch (regError: any) {
        console.error('SnapTrade registration failed:', regError);
        return res.status(502).json({ 
          error: 'SnapTrade registration failed', 
          details: regError.message || 'Unknown registration error'
        });
      }
      
    } catch (error: any) {
      console.error("SnapTrade registration error:", error);
      res.status(500).json({ 
        error: "Internal server error",
        details: error.message 
      });
    }
  });

  // SnapTrade connection URL generator - with proper registration flow  
  app.get('/api/snaptrade/connect-url', isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.user.claims;
      const flintUserId = currentUser.sub;
      const userEmail = currentUser.email?.toLowerCase() || `user_${flintUserId}`;
      
      if (!snapTradeClient) {
        return res.status(502).json({ 
          error: "SnapTrade not configured", 
          details: "SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET environment variables required" 
        });
      }
      
      // Check if user has valid SnapTrade credentials in DB
      let snapTradeUser = await storage.getSnapTradeUser(flintUserId);
      let savedUserId = snapTradeUser?.snaptradeUserId;
      let savedUserSecret = snapTradeUser?.userSecret;
      
      // If missing or invalid credentials, register the user
      if (!savedUserId || !savedUserSecret || savedUserSecret.startsWith('secret_')) {
        console.log('SnapTrade credentials missing or invalid, registering user:', userEmail);
        
        // Clean up old credentials
        if (snapTradeUser) {
          await storage.deleteSnapTradeUser(flintUserId);
        }
        
        try {
          const registrationResponse = await snapTradeClient.authentication.registerSnapTradeUser({
            userId: userEmail,
            firstName: currentUser.name || 'User',
            lastName: currentUser.family_name || ''
          });

          const registrationData = registrationResponse.data;
          
          if (!registrationData.userId || !registrationData.userSecret) {
            throw new Error('Invalid registration response from SnapTrade');
          }
          
          // Save credentials to database
          await storage.createSnapTradeUser(
            flintUserId,
            registrationData.userId,
            registrationData.userSecret
          );
          
          savedUserId = registrationData.userId;
          savedUserSecret = registrationData.userSecret;
          
          console.log('SnapTrade user registered successfully:', savedUserId);
          
        } catch (regError: any) {
          console.error('SnapTrade registration failed:', regError);
          return res.status(502).json({ 
            error: 'SnapTrade registration failed', 
            details: regError.message || 'Registration error'
          });
        }
      }
      
      // Generate connection URL using saved credentials
      const FRONTEND_URL = `https://${req.get('host')}`;
      const redirectURI = `${FRONTEND_URL}/dashboard?connected=true`;
      
      console.log('Generating SnapTrade connection URL for user:', savedUserId);

      try {
        const { data } = await snapTradeClient.authentication.getConnectUrl({
          userId: savedUserId,
          userSecret: savedUserSecret,
          redirectURI: redirectURI,
          immediateRedirect: true
        });

        console.log('SnapTrade connection URL generated successfully');
        res.json({ url: data.url });
        
      } catch (urlError: any) {
        console.error('SnapTrade URL generation failed:', urlError);
        return res.status(502).json({ 
          error: 'SnapTrade URL generation failed', 
          details: urlError.message || 'URL generation error'
        });
      }
      
    } catch (error: any) {
      console.error("SnapTrade connection error:", error);
      res.status(500).json({ 
        error: "Internal server error",
        details: error.message 
      });
    }
  });

  // SnapTrade search endpoint with enhanced fuzzy matching
  app.get('/api/snaptrade/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string' || q.length < 1) {
        return res.json([]);
      }

      // Expanded stock database with comprehensive search capabilities
      const stockDatabase = [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 173.50, changePercent: 1.2, volume: 89000000 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 2435.20, changePercent: -0.8, volume: 2100000 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.85, changePercent: 0.5, volume: 45000000 },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.42, changePercent: 2.1, volume: 125000000 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 3284.70, changePercent: 0.9, volume: 12000000 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 448.30, changePercent: 2.8, volume: 78000000 },
        { symbol: 'META', name: 'Meta Platforms Inc.', price: 325.60, changePercent: -0.3, volume: 23000000 },
        { symbol: 'NFLX', name: 'Netflix Inc.', price: 492.80, changePercent: 1.1, volume: 18000000 },
        { symbol: 'AMC', name: 'AMC Entertainment Holdings Inc.', price: 4.25, changePercent: 5.67, volume: 185000000 },
        { symbol: 'GME', name: 'GameStop Corp.', price: 18.45, changePercent: -2.34, volume: 95000000 },
        { symbol: 'BBBY', name: 'Bed Bath & Beyond Inc.', price: 0.25, changePercent: 12.50, volume: 125000000 },
        { symbol: 'SNAP', name: 'Snap Inc.', price: 11.80, changePercent: 1.45, volume: 78000000 },
        { symbol: 'SPOT', name: 'Spotify Technology S.A.', price: 289.40, changePercent: 0.87, volume: 12000000 },
        { symbol: 'UBER', name: 'Uber Technologies Inc.', price: 62.15, changePercent: -1.78, volume: 34000000 },
        { symbol: 'LYFT', name: 'Lyft Inc.', price: 14.20, changePercent: 2.90, volume: 18000000 },
        { symbol: 'SQ', name: 'Block Inc.', price: 78.95, changePercent: 1.25, volume: 24000000 },
        { symbol: 'PYPL', name: 'PayPal Holdings Inc.', price: 58.30, changePercent: -0.65, volume: 28000000 },
        { symbol: 'COIN', name: 'Coinbase Global Inc.', price: 185.70, changePercent: 4.12, volume: 45000000 },
        { symbol: 'ROKU', name: 'Roku Inc.', price: 55.40, changePercent: -3.20, volume: 16000000 },
        { symbol: 'ZM', name: 'Zoom Video Communications Inc.', price: 69.85, changePercent: 0.45, volume: 22000000 },
        { symbol: 'SHOP', name: 'Shopify Inc.', price: 67.20, changePercent: 2.10, volume: 15000000 },
        { symbol: 'DIS', name: 'The Walt Disney Company', price: 89.50, changePercent: -1.15, volume: 32000000 },
        { symbol: 'NKE', name: 'Nike Inc.', price: 104.25, changePercent: 0.80, volume: 18000000 },
        { symbol: 'BA', name: 'Boeing Company', price: 214.30, changePercent: -2.45, volume: 28000000 },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 158.70, changePercent: 1.05, volume: 35000000 },
        { symbol: 'JNJ', name: 'Johnson & Johnson', price: 164.80, changePercent: 0.25, volume: 24000000 },
        { symbol: 'V', name: 'Visa Inc.', price: 249.60, changePercent: 0.90, volume: 15000000 },
        { symbol: 'BTC', name: 'Bitcoin', price: 42350.00, changePercent: -1.5, volume: 35000000 },
        { symbol: 'ETH', name: 'Ethereum', price: 2950.00, changePercent: 3.2, volume: 15000000 },
        { symbol: 'ADBE', name: 'Adobe Inc.', price: 567.45, changePercent: -2.10, volume: 12000000 },
        { symbol: 'CRM', name: 'Salesforce Inc.', price: 251.80, changePercent: 0.95, volume: 18000000 },
        { symbol: 'INTC', name: 'Intel Corporation', price: 48.90, changePercent: 1.85, volume: 45000000 },
        { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', price: 142.35, changePercent: 3.20, volume: 78000000 },
        { symbol: 'ORCL', name: 'Oracle Corporation', price: 112.50, changePercent: 0.75, volume: 28000000 },
        { symbol: 'IBM', name: 'International Business Machines Corp.', price: 195.40, changePercent: -0.45, volume: 18000000 }
      ];

      const queryLower = q.toLowerCase().trim();
      
      // Enhanced fuzzy matching with multiple scoring criteria
      const searchResults = stockDatabase.map(stock => {
        const symbolLower = stock.symbol.toLowerCase();
        const nameLower = stock.name.toLowerCase();
        let score = 0;
        
        // Exact symbol match (highest priority)
        if (symbolLower === queryLower) score += 1000;
        
        // Symbol starts with query
        else if (symbolLower.startsWith(queryLower)) score += 800;
        
        // Symbol contains query
        else if (symbolLower.includes(queryLower)) score += 600;
        
        // Company name exact match
        if (nameLower === queryLower) score += 950;
        
        // Company name starts with query
        else if (nameLower.startsWith(queryLower)) score += 700;
        
        // Any word in company name starts with query
        const nameWords = nameLower.split(' ');
        if (nameWords.some(word => word.startsWith(queryLower))) score += 500;
        
        // Company name contains query anywhere
        else if (nameLower.includes(queryLower)) score += 300;
        
        // Partial fuzzy matching for close matches
        if (score === 0) {
          // Check if query is close to symbol (for typos)
          if (symbolLower.length >= queryLower.length && 
              symbolLower.substring(0, queryLower.length) === queryLower) {
            score += 400;
          }
          
          // Check for common abbreviations or partial matches
          if (queryLower.length >= 2) {
            const queryChars = queryLower.split('');
            let symbolMatch = 0;
            let nameMatch = 0;
            
            // Character sequence matching in symbol
            for (let i = 0; i < queryChars.length; i++) {
              if (symbolLower.includes(queryChars[i])) symbolMatch++;
              if (nameLower.includes(queryChars[i])) nameMatch++;
            }
            
            if (symbolMatch === queryChars.length) score += 200;
            if (nameMatch === queryChars.length) score += 150;
          }
        }
        
        return { ...stock, searchScore: score };
      }).filter(stock => stock.searchScore > 0);

      // Sort by search score (highest first), then alphabetically
      const sortedResults = searchResults
        .sort((a, b) => {
          if (a.searchScore !== b.searchScore) return b.searchScore - a.searchScore;
          return a.symbol.localeCompare(b.symbol);
        })
        .slice(0, 8) // Limit to top 8 results
        .map(({ searchScore, ...stock }) => stock); // Remove search score from response
      
      res.json(sortedResults);
    } catch (error: any) {
      console.error("Error searching symbols:", error);
      res.status(500).json({ message: "Failed to search symbols: " + error.message });
    }
  });

  // User profile management endpoints
  app.patch('/api/users/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName } = req.body;
      
      const [user] = await db
        .update(users)
        .set({ 
          firstName,
          lastName,
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId))
        .returning();
        
      res.json(user);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile: " + error.message });
    }
  });

  app.patch('/api/users/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // In a real app, you'd store notification preferences in the database
      // For now, just return success
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating notifications:", error);
      res.status(500).json({ message: "Failed to update notifications: " + error.message });
    }
  });

  // News endpoints
  app.get('/api/news', async (req: any, res) => {
    try {
      const { category, sentiment, search } = req.query;
      
      // Mock news data - in production this would fetch from news APIs
      const mockNews = [
        {
          id: '1',
          title: 'Federal Reserve Signals Potential Rate Cut in Q2 2025',
          summary: 'The Federal Reserve hints at monetary policy changes amid economic indicators showing...',
          source: 'Reuters',
          publishedAt: new Date().toISOString(),
          url: '#',
          sentiment: 'positive',
          category: 'Federal Reserve',
          symbols: ['SPY', 'QQQ'],
        },
        {
          id: '2', 
          title: 'Tech Stocks Rally on AI Infrastructure Spending',
          summary: 'Major technology companies report increased investments in artificial intelligence infrastructure...',
          source: 'Bloomberg',
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
          url: '#',
          sentiment: 'positive',
          category: 'Technology',
          symbols: ['AAPL', 'GOOGL', 'MSFT'],
        }
      ];
      
      res.json(mockNews);
    } catch (error: any) {
      console.error("Error fetching news:", error);
      res.status(500).json({ message: "Failed to fetch news: " + error.message });
    }
  });

  // Teller.io API routes
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