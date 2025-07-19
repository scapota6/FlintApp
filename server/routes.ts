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
          accountType: 'bank',
          provider: 'teller',
          institutionName: account.institution?.name || 'Connected Bank',
          accountName: account.name || 'Bank Account',
          balance: account.balance?.available || "0.00",
          currency: account.currency || 'USD',
          accessToken: token,
          externalAccountId: account.id,
          isActive: true,
        };
        
        await storage.createConnectedAccount(accountData);
      }
      
      // Log the connection
      await storage.logActivity({
        userId,
        action: 'account_connected',
        description: `Connected ${accounts.length} bank account(s) via Teller`,
        metadata: { provider: 'teller', accountType: 'bank', count: accounts.length },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || '',
      });
      
      res.json({ success: true, accountsConnected: accounts.length });
    } catch (error: any) {
      console.error("Error exchanging Teller token:", error);
      res.status(500).json({ message: "Failed to exchange token: " + error.message });
    }
  });

  // SnapTrade API routes
  app.post('/api/snaptrade/register', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!process.env.SNAPTRADE_CLIENT_ID) {
        return res.status(500).json({ message: "SnapTrade not configured. Please add SNAPTRADE_CLIENT_ID to environment variables." });
      }
      
      // For now, just return success - registration is handled in the connect flow
      res.json({ 
        userId: userId,
        userSecret: 'secret_' + Date.now()
      });
    } catch (error: any) {
      console.error("Error registering SnapTrade user:", error);
      res.status(500).json({ message: "Failed to register SnapTrade user: " + error.message });
    }
  });

  app.get('/api/snaptrade/connect-url', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!process.env.SNAPTRADE_CLIENT_ID) {
        return res.status(500).json({ message: "SnapTrade not configured. Please add SNAPTRADE_CLIENT_ID to environment variables." });
      }
      
      // Generate SnapTrade connection URL using correct format
      const baseUrl = process.env.REPLIT_DOMAINS || 'http://localhost:5000';
      const redirectUri = `${baseUrl}/api/snaptrade/callback`;
      
      // Use the correct SnapTrade Connect URL format
      const connectionUrl = `https://connect.snaptrade.com/connect?user_id=${userId}&client_id=${process.env.SNAPTRADE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&user_secret=secret_${userId}_${Date.now()}`;
      
      res.json({ url: connectionUrl });
    } catch (error) {
      console.error("Error generating SnapTrade connection URL:", error);
      res.status(500).json({ message: "Failed to generate connection URL" });
    }
  });

  app.get('/api/snaptrade/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      // Use mock data for search results for now
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

  app.get('/api/account-details/:accountId', isAuthenticated, async (req: any, res) => {
    try {
      const { accountId } = req.params;
      const userId = req.user.claims.sub;
      
      // Get the account to verify ownership
      const account = await storage.getConnectedAccount(parseInt(accountId));
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }
      
      let details = [];
      
      if (account.provider === 'teller' && account.accessToken) {
        try {
          // Fetch transactions from Teller API
          const transactionsResponse = await fetch(`https://api.teller.io/accounts/${account.externalAccountId}/transactions`, {
            headers: {
              'Authorization': `Bearer ${account.accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (transactionsResponse.ok) {
            details = await transactionsResponse.json();
          }
        } catch (error) {
          console.error('Error fetching Teller transactions:', error);
        }
      } else if (account.provider === 'snaptrade' && account.accessToken) {
        try {
          // Fetch holdings from SnapTrade API
          const holdingsResponse = await fetch(`https://api.snaptrade.com/api/v1/accounts/${account.externalAccountId}/holdings`, {
            headers: {
              'Authorization': `Bearer ${account.accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (holdingsResponse.ok) {
            details = await holdingsResponse.json();
          }
        } catch (error) {
          console.error('Error fetching SnapTrade holdings:', error);
        }
      }
      
      res.json(details);
    } catch (error: any) {
      console.error("Error fetching account details:", error);
      res.status(500).json({ message: "Failed to fetch account details: " + error.message });
    }
  });

  app.get('/api/snaptrade/quote/:symbol', isAuthenticated, async (req: any, res) => {
    try {
      const { symbol } = req.params;
      
      // Use mock data for quote data
      const mockQuote = {
        symbol: symbol.toUpperCase(),
        name: getCompanyName(symbol),
        price: Math.random() * 1000 + 50,
        changePercent: (Math.random() - 0.5) * 10,
        volume: Math.random() * 10000000,
        marketCap: Math.random() * 1000000000000,
      };
      
      res.json(mockQuote);
    } catch (error: any) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ message: "Failed to fetch quote: " + error.message });
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

  // SnapTrade callback handler
  app.get('/api/snaptrade/callback', isAuthenticated, async (req: any, res) => {
    try {
      const { code, state } = req.query;
      const userId = req.user.claims.sub;
      
      if (code) {
        // Create a mock brokerage account for successful connection
        const accountData = {
          userId,
          accountType: 'brokerage',
          provider: 'snaptrade',
          institutionName: 'Connected Broker',
          accountName: 'Investment Account',
          balance: "10000.00",
          currency: 'USD',
          accessToken: code,
          externalAccountId: 'snaptrade_acc_' + Date.now(),
          isActive: true,
        };
        
        await storage.createConnectedAccount(accountData);
        
        // Log the connection
        await storage.logActivity({
          userId,
          action: 'account_connected',
          description: 'Connected brokerage account via SnapTrade',
          metadata: { provider: 'snaptrade', accountType: 'brokerage' },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
        });
        
        res.redirect('/dashboard?connected=snaptrade');
      } else {
        res.redirect('/dashboard?error=connection_failed');
      }
    } catch (error: any) {
      console.error("Error handling SnapTrade callback:", error);
      res.redirect('/dashboard?error=connection_failed');
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to get account limits based on subscription tier
function getAccountLimit(tier: string): number {
  switch (tier) {
    case 'free': return 2;
    case 'basic': return 3;
    case 'pro': return 10;
    case 'premium': return Infinity;
    default: return 2;
  }
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
