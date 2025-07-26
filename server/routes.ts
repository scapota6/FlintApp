import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import crypto from "crypto";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
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

// Initialize SnapTrade SDK (using correct parameter names from docs)
let snapTradeClient: Snaptrade | null = null;
if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CLIENT_SECRET) {
  console.log('Initializing SnapTrade SDK with:', {
    clientId: process.env.SNAPTRADE_CLIENT_ID,
    consumerKeyPrefix: process.env.SNAPTRADE_CLIENT_SECRET.substring(0, 10)
  });
  
  snapTradeClient = new Snaptrade({
    clientId: process.env.SNAPTRADE_CLIENT_ID,
    consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
    // Note: API keys configured for flint-investing.com domain
  });
  
  console.log('SnapTrade SDK initialized successfully for flint-investing.com domain');
} else {
  console.log('SnapTrade environment variables not found - SnapTrade functionality disabled');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard data
  app.get('/api/dashboard', isAuthenticated, async (req: any, res) => {
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

  // Log user login activity
  app.post('/api/log-login', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Trade management  
  app.get('/api/trades', isAuthenticated, async (req: any, res) => {
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

  // Teller.io integration routes
  app.post('/api/teller/connect', isAuthenticated, async (req: any, res) => {
    try {
      const { connectUrl } = req.body;
      console.log('Received Teller connect URL:', connectUrl);
      
      if (!connectUrl) {
        return res.status(400).json({ message: "Connect URL is required" });
      }
      
      // Extract token from the connect URL
      const url = new URL(connectUrl);
      const token = url.searchParams.get('token');
      
      if (!token) {
        return res.status(400).json({ message: "No token found in URL" });
      }
      
      console.log('Extracted token:', token.substring(0, 20) + '...');
      
      // Exchange token for account information
      const response = await fetch('https://api.teller.io/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`
        }
      });
      
      console.log('Teller API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Teller API error:', errorText);
        throw new Error(`Teller API error: ${response.status} - ${errorText}`);
      }
      
      const tokenData = await response.json();
      console.log('Token exchange successful, access_token length:', tokenData.access_token?.length);
      
      // Fetch account details
      const accountsResponse = await fetch('https://api.teller.io/accounts', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('Teller accounts API error:', errorText);
        throw new Error(`Failed to fetch accounts: ${accountsResponse.status} - ${errorText}`);
      }
      
      const accounts = await accountsResponse.json();
      console.log('Retrieved accounts:', accounts.length);
      
      // Store connected accounts
      const userId = req.user.claims.sub;
      const connectedAccounts = [];
      
      for (const account of accounts) {
        const accountData = {
          userId,
          provider: 'teller',
          externalAccountId: account.id,
          accountName: account.name,
          accountType: account.type,
          balance: parseFloat(account.balances.available) || 0,
          accessToken: tokenData.access_token,
          lastUpdated: new Date()
        };
        
        const validatedData = insertConnectedAccountSchema.parse(accountData);
        const connectedAccount = await storage.createConnectedAccount(validatedData);
        connectedAccounts.push(connectedAccount);
        
        console.log('Stored account:', account.name, 'Balance:', accountData.balance);
      }
      
      // Log the connection activity
      await storage.createActivityLog({
        userId,
        action: 'account_connected',
        description: 'Account connected successfully',
        metadata: {
          provider: 'teller',
          accountCount: accounts.length
        }
      });
      
      res.json({ 
        success: true, 
        accounts: connectedAccounts,
        message: `Successfully connected ${accounts.length} account(s)`
      });
      
    } catch (error: any) {
      console.error("Error connecting Teller account:", error);
      res.status(500).json({ message: "Failed to connect account: " + error.message });
    }
  });

  // SnapTrade user registration
  app.post('/api/snaptrade/register', isAuthenticated, async (req: any, res) => {
    try {
      const flintUserId = req.user.claims.sub;
      
      if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CLIENT_SECRET) {
        return res.status(500).json({ message: "SnapTrade not configured." });
      }
      
      // Check if user already exists
      const existingUser = await storage.getSnapTradeUser(flintUserId);
      if (existingUser) {
        return res.json({ success: true, message: 'User already registered', userId: existingUser.snaptradeUserId });
      }
      
      // Create unique userId for SnapTrade
      const snapTradeUserId = `flint_user_${flintUserId}_${Date.now()}`;
      
      const clientId = process.env.SNAPTRADE_CLIENT_ID.trim();
      const consumerSecret = process.env.SNAPTRADE_CLIENT_SECRET.trim();

      const registerResponse = await fetch('https://api.snaptrade.com/api/v1/snapTrade/registerUser', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'clientId': clientId,
          'consumerSecret': consumerSecret
        },
        body: JSON.stringify({ userId: snapTradeUserId })
      });

      const responseText = await registerResponse.text();
      console.log('SnapTrade register response:', registerResponse.status, responseText);

      if (!registerResponse.ok) {
        throw new Error(`Registration failed: ${registerResponse.status} - ${responseText}`);
      }

      const registerData = JSON.parse(responseText);
      
      if (registerData?.userId && registerData?.userSecret) {
        await storage.createSnapTradeUser(flintUserId, registerData.userId, registerData.userSecret);
        res.json({ success: true, message: 'SnapTrade user registered successfully', userId: registerData.userId });
      } else {
        throw new Error('Registration failed - invalid response format');
      }

    } catch (error: any) {
      console.error('SnapTrade registration error:', error);
      res.status(500).json({ success: false, message: 'Failed to register SnapTrade user', error: error.message });
    }
  });

  // SnapTrade connection URL generator  
  app.get('/api/snaptrade/connect-url', isAuthenticated, async (req: any, res) => {
    try {
      const flintUserId = req.user.claims.sub;
      
      if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CLIENT_SECRET) {
        return res.status(500).json({ message: "SnapTrade not configured." });
      }
      
      const snapTradeUser = await storage.getSnapTradeUser(flintUserId);
      if (!snapTradeUser) {
        return res.status(400).json({
          message: "SnapTrade user not registered. Please register first.",
          requiresRegistration: true
        });
      }
      
      const clientId = process.env.SNAPTRADE_CLIENT_ID.trim();
      const consumerSecret = process.env.SNAPTRADE_CLIENT_SECRET.trim();
      const redirectURI = `https://${req.get('host')}/dashboard?connected=true`;
      
      const queryParams = new URLSearchParams({
        userId: snapTradeUser.snaptradeUserId || '',
        userSecret: snapTradeUser.userSecret
      });

      console.log('SnapTrade Login attempt with:', {
        clientId: clientId.substring(0, 10) + '...',
        consumerSecret: consumerSecret.substring(0, 10) + '...',
        userId: snapTradeUser.snaptradeUserId,
        userSecret: snapTradeUser.userSecret.substring(0, 10) + '...'
      });

      const loginResponse = await fetch(`https://api.snaptrade.com/api/v1/snapTrade/login?${queryParams}`, {
        method: 'POST',
        headers: {
          'clientId': clientId,
          'consumerSecret': consumerSecret,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          broker: null,
          immediateRedirect: false,
          customRedirect: redirectURI,
          connectionType: 'read'
        })
      });

      const responseText = await loginResponse.text();
      console.log('SnapTrade login response:', loginResponse.status, responseText);

      if (!loginResponse.ok) {
        throw new Error(`SnapTrade login failed: ${loginResponse.status} - ${responseText}`);
      }

      const loginData = JSON.parse(responseText);
      if (loginData.redirectURI) {
        res.json({ url: loginData.redirectURI });
      } else {
        throw new Error('No redirectURI in SnapTrade response');
      }
      
    } catch (error: any) {
      console.error("SnapTrade connection error:", error);
      res.status(500).json({ message: "Failed to generate connection URL: " + error.message });
    }
  });

  // SnapTrade search endpoint
  app.get('/api/snaptrade/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      // Mock data for now - should be replaced with real SnapTrade search
      const mockResults = [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 173.50, changePercent: 1.2, volume: 89000000 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 2435.20, changePercent: -0.8, volume: 2100000 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.85, changePercent: 0.5, volume: 45000000 },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.42, changePercent: 2.1, volume: 125000000 },
        { symbol: 'BTC', name: 'Bitcoin', price: 42350.00, changePercent: -1.5, volume: 35000000 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 3284.70, changePercent: 0.9, volume: 12000000 },
        { symbol: 'ETH', name: 'Ethereum', price: 2950.00, changePercent: 3.2, volume: 15000000 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 448.30, changePercent: 2.8, volume: 78000000 },
        { symbol: 'META', name: 'Meta Platforms Inc.', price: 325.60, changePercent: -0.3, volume: 23000000 },
        { symbol: 'NFLX', name: 'Netflix Inc.', price: 492.80, changePercent: 1.1, volume: 18000000 },
      ].filter(item => 
        item.symbol.toLowerCase().includes(q.toLowerCase()) ||
        item.name.toLowerCase().includes(q.toLowerCase())
      );
      
      res.json(mockResults);
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

  const httpServer = createServer(app);
  return httpServer;
}