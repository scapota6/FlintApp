import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertConnectedAccountSchema,
  insertWatchlistItemSchema,
  insertTradeSchema,
  insertTransferSchema,
  insertActivityLogSchema,
} from "@shared/schema";

// Initialize Stripe (only if API key is provided)
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
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
      const holdings = await storage.getHoldings(userId);
      const watchlist = await storage.getWatchlist(userId);
      const recentTrades = await storage.getTrades(userId, 5);
      const recentTransfers = await storage.getTransfers(userId, 5);
      const recentActivity = await storage.getActivityLog(userId, 10);

      // Calculate totals
      const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const bankBalance = accounts
        .filter(account => account.accountType === 'bank')
        .reduce((sum, account) => sum + parseFloat(account.balance), 0);
      const investmentBalance = accounts
        .filter(account => account.accountType === 'brokerage' || account.accountType === 'crypto')
        .reduce((sum, account) => sum + parseFloat(account.balance), 0);

      res.json({
        totalBalance,
        bankBalance,
        investmentBalance,
        accounts,
        holdings,
        watchlist,
        recentTrades,
        recentTransfers,
        recentActivity,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Connected accounts
  app.get('/api/accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const accounts = await storage.getConnectedAccounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.post('/api/accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertConnectedAccountSchema.parse({
        ...req.body,
        userId,
      });
      
      const account = await storage.createConnectedAccount(validatedData);
      
      // Log activity
      await storage.logActivity({
        userId,
        action: 'account_connected',
        description: `Connected ${account.institutionName} account`,
        metadata: { accountId: account.id },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });
      
      res.json(account);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Watchlist
  app.get('/api/watchlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
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
        userId,
      });
      
      const item = await storage.addToWatchlist(validatedData);
      
      // Log activity
      await storage.logActivity({
        userId,
        action: 'watchlist_add',
        description: `Added ${item.symbol} to watchlist`,
        metadata: { symbol: item.symbol },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });
      
      res.json(item);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete('/api/watchlist/:symbol', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { symbol } = req.params;
      
      await storage.removeFromWatchlist(userId, symbol);
      
      // Log activity
      await storage.logActivity({
        userId,
        action: 'watchlist_remove',
        description: `Removed ${symbol} from watchlist`,
        metadata: { symbol },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // Trades
  app.get('/api/trades', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trades = await storage.getTrades(userId);
      res.json(trades);
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
        userId,
        status: 'pending',
      });
      
      const trade = await storage.createTrade(validatedData);
      
      // Simulate trade execution (in real app, this would be async)
      setTimeout(async () => {
        await storage.updateTradeStatus(trade.id, 'filled', new Date());
        
        // Log activity
        await storage.logActivity({
          userId,
          action: 'trade_executed',
          description: `${trade.side.toUpperCase()} ${trade.quantity} ${trade.symbol} at $${trade.price}`,
          metadata: { tradeId: trade.id, symbol: trade.symbol, side: trade.side },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
        });
      }, 1000);
      
      res.json(trade);
    } catch (error) {
      console.error("Error creating trade:", error);
      res.status(500).json({ message: "Failed to create trade" });
    }
  });

  // Transfers
  app.get('/api/transfers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transfers = await storage.getTransfers(userId);
      res.json(transfers);
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
        userId,
        status: 'pending',
      });
      
      const transfer = await storage.createTransfer(validatedData);
      
      // Simulate transfer execution
      setTimeout(async () => {
        await storage.updateTransferStatus(transfer.id, 'completed', new Date());
        
        // Log activity
        await storage.logActivity({
          userId,
          action: 'transfer_completed',
          description: `Transferred $${transfer.amount} between accounts`,
          metadata: { transferId: transfer.id, amount: transfer.amount },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
        });
      }, 2000);
      
      res.json(transfer);
    } catch (error) {
      console.error("Error creating transfer:", error);
      res.status(500).json({ message: "Failed to create transfer" });
    }
  });

  // Activity log
  app.get('/api/activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activities = await storage.getActivityLog(userId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activity log:", error);
      res.status(500).json({ message: "Failed to fetch activity log" });
    }
  });

  // Market data (mock API)
  app.get('/api/market/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Mock market data - in real app, this would fetch from financial data provider
      const mockData = {
        symbol: symbol.toUpperCase(),
        name: getCompanyName(symbol),
        price: Math.random() * 1000 + 50,
        changePercent: (Math.random() - 0.5) * 10,
        volume: Math.random() * 10000000,
        marketCap: Math.random() * 1000000000000,
      };
      
      res.json(mockData);
    } catch (error) {
      console.error("Error fetching market data:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  // Stripe subscription routes
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured. Please contact administrator." });
      }

      const userId = req.user.claims.sub;
      const { tier } = req.body;
      
      let user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get price ID based on tier
      const priceIds = {
        basic: process.env.STRIPE_PRICE_ID_BASIC,
        pro: process.env.STRIPE_PRICE_ID_PRO,
        premium: process.env.STRIPE_PRICE_ID_PREMIUM,
      };

      const priceId = priceIds[tier as keyof typeof priceIds];
      if (!priceId) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }

      // Create or retrieve customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || '',
          name: `${user.firstName} ${user.lastName}`,
        });
        customerId = customer.id;
        user = await storage.updateUserStripeInfo(userId, customerId, '');
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      await storage.updateUserStripeInfo(userId, customerId, subscription.id);

      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      });
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // Log user login
  app.post('/api/log-login', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      await storage.logActivity({
        userId,
        action: 'login',
        description: 'User logged in',
        metadata: {},
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging login:", error);
      res.status(500).json({ message: "Failed to log login" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function getCompanyName(symbol: string): string {
  const companies: { [key: string]: string } = {
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet Inc.',
    'MSFT': 'Microsoft Corporation',
    'AMZN': 'Amazon.com Inc.',
    'TSLA': 'Tesla Inc.',
    'META': 'Meta Platforms Inc.',
    'NFLX': 'Netflix Inc.',
    'NVDA': 'NVIDIA Corporation',
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'ADA': 'Cardano',
    'DOT': 'Polkadot',
  };
  
  return companies[symbol.toUpperCase()] || `${symbol.toUpperCase()} Corp.`;
}
