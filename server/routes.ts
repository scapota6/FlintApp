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
} from "@shared/schema";

// Initialize Stripe (only if API key is provided)
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Initialize SnapTrade SDK
let snapTradeClient: Snaptrade | null = null;
if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CLIENT_SECRET) {
  snapTradeClient = new Snaptrade({
    clientId: process.env.SNAPTRADE_CLIENT_ID,
    consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
  });
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
      
      if (!process.env.SNAPTRADE_CLIENT_ID || !process.env.SNAPTRADE_CLIENT_SECRET) {
        return res.status(500).json({ message: "SnapTrade not configured. Please add SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET to environment variables." });
      }
      
      console.log('SnapTrade Client ID:', process.env.SNAPTRADE_CLIENT_ID);
      console.log('SnapTrade Consumer Key present:', !!process.env.SNAPTRADE_CLIENT_SECRET);
      
      // Check if we have stored the userSecret for this user
      let userSecret = null;
      
      // Check our database for existing SnapTrade user data
      const existingSnapTradeUser = await storage.getSnapTradeUser(userId);
      
      if (existingSnapTradeUser) {
        userSecret = existingSnapTradeUser.userSecret;
        console.log('Found stored SnapTrade user secret');
      } else {
        // Create new user in SnapTrade
        userSecret = `secret_${userId}_${Math.floor(Date.now() / 1000)}`;
        
        try {
          const regTimestamp = Math.floor(Date.now() / 1000);
          const regQueryParams = new URLSearchParams({
            clientId: process.env.SNAPTRADE_CLIENT_ID,
            timestamp: regTimestamp.toString()
          });
          
          const registerSignature = generateSnapTradeSignature(
            'eJunnhdd52XTHCdrmzMItkKthmh7OwclxO32uvG89pEstYPXeM',
            { userId, userSecret },
            '/api/v1/snapTrade/registerUser',
            regQueryParams.toString()
          );
          
          const registerResponse = await fetch(`https://api.snaptrade.com/api/v1/snapTrade/registerUser?${regQueryParams}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Signature': registerSignature,
            },
            body: JSON.stringify({
              userId,
              userSecret
            }),
          });
          
          if (registerResponse.ok) {
            console.log('Successfully registered new SnapTrade user');
            // Store the userSecret in our database for future use
            await storage.createSnapTradeUser(userId, userSecret);
          } else {
            const regResponseText = await registerResponse.text();
            console.log('Register response:', regResponseText);
            
            // If user already exists, use a modified user ID to create a fresh account
            if (registerResponse.status === 400 && regResponseText.includes('already exist')) {
              console.log('User already exists in SnapTrade - creating with modified ID...');
              
              // Use a unique user ID by appending timestamp
              const uniqueUserId = `${userId}_${Math.floor(Date.now() / 1000)}`;
              const uniqueUserSecret = `secret_${uniqueUserId}_${Math.floor(Date.now() / 1000)}`;
              
              try {
                const newTimestamp = Math.floor(Date.now() / 1000);
                const newQueryParams = new URLSearchParams({
                  clientId: process.env.SNAPTRADE_CLIENT_ID,
                  timestamp: newTimestamp.toString()
                });
                
                const newSignature = generateSnapTradeSignature(
                  'eJunnhdd52XTHCdrmzMItkKthmh7OwclxO32uvG89pEstYPXeM',
                  { userId: uniqueUserId, userSecret: uniqueUserSecret },
                  '/api/v1/snapTrade/registerUser',
                  newQueryParams.toString()
                );
                
                const retryResponse = await fetch(`https://api.snaptrade.com/api/v1/snapTrade/registerUser?${newQueryParams}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Signature': newSignature,
                  },
                  body: JSON.stringify({
                    userId: uniqueUserId,
                    userSecret: uniqueUserSecret
                  }),
                });
                
                if (retryResponse.ok) {
                  console.log('Successfully registered SnapTrade user with unique ID');
                  console.log('DEBUG: Registered user ID:', uniqueUserId);
                  console.log('DEBUG: Registered user secret pattern:', uniqueUserSecret.substring(0, 30) + '...');
                  
                  userSecret = uniqueUserSecret;
                  userId = uniqueUserId; // Update the userId to use the unique one
                  
                  await storage.createSnapTradeUser(req.user.claims.sub, uniqueUserSecret); // Store with original Flint userId
                  console.log('DEBUG: Stored user secret in database for user:', req.user.claims.sub);
                  
                  // Don't return here, let the main login flow continue
                } else {
                  const retryError = await retryResponse.text();
                  console.log('Retry registration failed:', retryError);
                  throw new Error('Failed to register user with unique ID');
                }
              } catch (uniqueError) {
                console.error('Error in unique user flow:', uniqueError);
                throw new Error('Failed to create unique user');
              }
            } else {
              throw new Error('User registration failed');
            }
          }
        } catch (error) {
          console.error('Failed to register SnapTrade user:', error);
          throw error;
        }
      }
      
      // Generate login link with query parameters (UNIX timestamp in seconds)
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Get the actual stored user data to use correct SnapTrade user ID
      const storedUser = await storage.getSnapTradeUser(req.user.claims.sub);
      let actualUserId = userId;
      let actualUserSecret = userSecret;
      
      if (storedUser) {
        console.log('DEBUG: Found stored SnapTrade user data');
        actualUserSecret = storedUser.userSecret;
        // Try to extract the unique user ID from the stored secret pattern: secret_{uniqueUserId}_{timestamp}
        const secretMatch = storedUser.userSecret.match(/secret_(.+)_\d+$/);
        if (secretMatch) {
          actualUserId = secretMatch[1]; // This captures the full unique user ID including the timestamp suffix
          console.log('DEBUG: Extracted unique user ID from stored secret:', actualUserId);
        }
      } else {
        console.log('DEBUG: No stored SnapTrade user found, registration should have been completed above');
      }
      
      console.log('DEBUG: Final userId for login:', actualUserId);
      console.log('DEBUG: Final userSecret pattern:', actualUserSecret.substring(0, 20) + '...');
      
      const queryParams = new URLSearchParams({
        clientId: process.env.SNAPTRADE_CLIENT_ID,
        userId: actualUserId,
        userSecret: actualUserSecret,
        timestamp: timestamp.toString()
      });
      
      console.log('DEBUG: Login query params:', queryParams.toString());
      
      const loginSignature = generateSnapTradeSignature(
        'eJunnhdd52XTHCdrmzMItkKthmh7OwclxO32uvG89pEstYPXeM',
        { 
          broker: 'QUESTRADE',
          immediateRedirect: true,
          customRedirect: `${process.env.REPLIT_DOMAINS || 'http://localhost:5000'}/dashboard`
        },
        '/api/v1/snapTrade/login',
        queryParams.toString()
      );
      
      console.log('DEBUG: Login signature generated:', loginSignature);
      
      const loginResponse = await fetch(`https://api.snaptrade.com/api/v1/snapTrade/login?${queryParams}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Signature': loginSignature,
        },
        body: JSON.stringify({
          broker: 'QUESTRADE',
          immediateRedirect: true,
          customRedirect: `${process.env.REPLIT_DOMAINS || 'http://localhost:5000'}/dashboard`
        }),
      });
      
      const responseText = await loginResponse.text();
      console.log('SnapTrade login response status:', loginResponse.status);
      console.log('SnapTrade login response:', responseText);
      
      if (!loginResponse.ok) {
        throw new Error(`Failed to generate login link: ${loginResponse.status} - ${responseText}`);
      }
      
      const loginData = JSON.parse(responseText);
      res.json({ url: loginData.redirectURI });
      
    } catch (error: any) {
      console.error("Error generating SnapTrade connection URL:", error);
      res.status(500).json({ message: "Failed to generate connection URL: " + error.message });
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
      
      // Ensure every Flint user has a SnapTrade account
      try {
        const existingSnapTradeUser = await storage.getSnapTradeUser(userId);
        if (!existingSnapTradeUser) {
          console.log('Creating automatic SnapTrade account for new user:', userId);
          
          const timestamp = Math.floor(Date.now() / 1000);
          const uniqueUserId = `${userId}_${timestamp}`;
          const uniqueUserSecret = `secret_${uniqueUserId}_${timestamp}`;
          
          const queryParams = new URLSearchParams({
            clientId: process.env.SNAPTRADE_CLIENT_ID,
            timestamp: timestamp.toString()
          });
          
          const registerSignature = generateSnapTradeSignature(
            'eJunnhdd52XTHCdrmzMItkKthmh7OwclxO32uvG89pEstYPXeM',
            { userId: uniqueUserId, userSecret: uniqueUserSecret },
            '/api/v1/snapTrade/registerUser',
            queryParams.toString()
          );
          
          const registerResponse = await fetch(`https://api.snaptrade.com/api/v1/snapTrade/registerUser?${queryParams}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Signature': registerSignature,
            },
            body: JSON.stringify({
              userId: uniqueUserId,
              userSecret: uniqueUserSecret
            }),
          });
          
          if (registerResponse.ok) {
            await storage.createSnapTradeUser(userId, uniqueUserSecret);
            console.log('Successfully created automatic SnapTrade account for user:', userId);
          } else {
            console.log('Failed to create automatic SnapTrade account, will retry on connection attempt');
          }
        }
      } catch (snaptradeError) {
        console.log('Error creating automatic SnapTrade account:', snaptradeError);
        // Don't fail the login process if SnapTrade account creation fails
      }
      
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

  // List all SnapTrade users for debugging
  app.get('/api/snaptrade/list-users', isAuthenticated, async (req: any, res) => {
    try {
      if (!snapTradeClient) {
        return res.status(500).json({ message: 'SnapTrade client not initialized' });
      }
      
      console.log('Listing all SnapTrade users for debugging...');
      const response = await snapTradeClient.authentication.listSnapTradeUsers();
      
      console.log('SnapTrade users count:', response.length);
      const userList = response.map((user: any) => ({
        userId: user.userId,
        createdDate: user.createdDate,
        // Don't return the full user secret for security
        hasSecret: !!user.userSecret
      }));
      
      res.json({ users: userList, totalCount: response.length });
      
    } catch (error: any) {
      console.error('Error listing SnapTrade users:', error);
      res.status(500).json({ message: 'Failed to list users: ' + (error.message || error.toString()) });
    }
  });

  // Delete a specific SnapTrade user
  app.delete('/api/snaptrade/delete-user/:snaptradeUserId', isAuthenticated, async (req: any, res) => {
    try {
      if (!snapTradeClient) {
        return res.status(500).json({ message: 'SnapTrade client not initialized' });
      }
      
      const { snaptradeUserId } = req.params;
      console.log('Deleting SnapTrade user:', snaptradeUserId);
      
      const response = await snapTradeClient.authentication.deleteSnapTradeUser({
        userId: snaptradeUserId
      });
      
      console.log('Successfully deleted SnapTrade user:', snaptradeUserId);
      res.json({ success: true, message: 'User deleted successfully' });
      
    } catch (error: any) {
      console.error('Error deleting SnapTrade user:', error);
      res.status(500).json({ message: 'Failed to delete user: ' + (error.message || error.toString()) });
    }
  });

  // Force create fresh SnapTrade account for current user
  app.post('/api/snaptrade/create-fresh-account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('Creating fresh SnapTrade account using SDK for user:', userId);
      
      if (!snapTradeClient) {
        return res.status(500).json({ success: false, message: 'SnapTrade client not initialized' });
      }
      
      // Delete existing credentials if any
      try {
        const existingUser = await storage.getSnapTradeUser(userId);
        if (existingUser) {
          console.log('Deleting existing SnapTrade credentials from database');
          await storage.deleteSnapTradeUser(userId);
        }
      } catch (error) {
        console.log('No existing credentials to delete');
      }
      
      // Create unique user ID
      const timestamp = Math.floor(Date.now() / 1000);
      const uniqueUserId = `flint_${userId}_${timestamp}`;
      
      console.log('Creating SnapTrade user with SDK, ID:', uniqueUserId);
      
      // Use SnapTrade SDK to register user
      const registerResponse = await snapTradeClient.authentication.registerSnapTradeUser({
        requestBody: {
          userId: uniqueUserId
        }
      });
      
      if (registerResponse && registerResponse.userSecret) {
        // Store the credentials returned by SnapTrade
        await storage.createSnapTradeUser(userId, uniqueUserId, registerResponse.userSecret);
        console.log('Successfully created fresh SnapTrade account with SDK');
        
        res.json({ 
          success: true, 
          message: 'Fresh SnapTrade account created', 
          uniqueUserId,
          userSecret: registerResponse.userSecret.substring(0, 10) + '...' // Partial for debugging
        });
      } else {
        console.log('Registration failed: No user secret returned');
        res.status(500).json({ success: false, message: 'Failed to create SnapTrade account - no secret returned' });
      }
      
    } catch (error: any) {
      console.error('Error creating fresh SnapTrade account:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error creating account', 
        error: error.message || error.toString()
      });
    }
  });

  // SnapTrade callback handler
  app.get('/api/snaptrade/callback', isAuthenticated, async (req: any, res) => {
    try {
      const { code, state } = req.query;
      const userId = req.user.claims.sub;
      
      if (code) {
        console.log('SnapTrade connection successful, fetching real account data...');
        
        // Get the user's SnapTrade credentials
        const storedUser = await storage.getSnapTradeUser(userId);
        if (!storedUser) {
          console.log('No SnapTrade user found for callback');
          res.redirect('/dashboard?error=no_user_found');
          return;
        }
        
        // Extract the unique user ID from stored secret
        const secretMatch = storedUser.userSecret.match(/secret_(.+)_\d+$/);
        const snapTradeUserId = secretMatch ? secretMatch[1] : userId;
        
        // Fetch real SnapTrade accounts
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          const queryParams = new URLSearchParams({
            clientId: process.env.SNAPTRADE_CLIENT_ID,
            userId: snapTradeUserId,
            userSecret: storedUser.userSecret,
            timestamp: timestamp.toString()
          });
          
          const accountsSignature = generateSnapTradeSignature(
            'eJunnhdd52XTHCdrmzMItkKthmh7OwclxO32uvG89pEstYPXeM',
            {},
            '/api/v1/accounts',
            queryParams.toString()
          );
          
          const accountsResponse = await fetch(`https://api.snaptrade.com/api/v1/accounts?${queryParams}`, {
            method: 'GET',
            headers: {
              'Signature': accountsSignature,
            }
          });
          
          if (accountsResponse.ok) {
            const snapTradeAccounts = await accountsResponse.json();
            console.log('Retrieved SnapTrade accounts:', snapTradeAccounts.length);
            
            // Create connected accounts from SnapTrade data
            for (const account of snapTradeAccounts) {
              const accountData = {
                userId,
                accountType: 'brokerage',
                provider: 'snaptrade',
                institutionName: account.institution_name || 'SnapTrade Brokerage',
                accountName: account.name || account.number,
                balance: account.total_value?.toString() || "0.00",
                currency: account.currency || 'USD',
                accessToken: code,
                externalAccountId: account.id,
                isActive: true,
              };
              
              await storage.createConnectedAccount(accountData);
            }
            
            // Log the connection
            await storage.logActivity({
              userId,
              action: 'account_connected',
              description: `Connected ${snapTradeAccounts.length} brokerage account(s) via SnapTrade`,
              metadata: { provider: 'snaptrade', accountCount: snapTradeAccounts.length },
              ipAddress: req.ip,
              userAgent: req.get('User-Agent') || '',
            });
            
            console.log('Successfully created connected accounts from SnapTrade');
            res.redirect('/dashboard?connected=snaptrade');
          } else {
            console.log('Failed to fetch SnapTrade accounts, creating placeholder');
            // Create a placeholder account if API call fails
            const accountData = {
              userId,
              accountType: 'brokerage',
              provider: 'snaptrade',
              institutionName: 'Connected Brokerage',
              accountName: 'Investment Account',
              balance: "0.00",
              currency: 'USD',
              accessToken: code,
              externalAccountId: 'snaptrade_pending_' + Date.now(),
              isActive: true,
            };
            
            await storage.createConnectedAccount(accountData);
            res.redirect('/dashboard?connected=snaptrade&status=pending');
          }
        } catch (error) {
          console.error('Error fetching SnapTrade accounts:', error);
          res.redirect('/dashboard?error=account_fetch_failed');
        }
      } else {
        res.redirect('/dashboard?error=connection_failed');
      }
    } catch (error: any) {
      console.error("Error handling SnapTrade callback:", error);
      res.redirect('/dashboard?error=connection_failed');
    }
  });

  // Fetch existing SnapTrade connections and accounts
  app.get('/api/snaptrade/sync-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get the user's SnapTrade credentials
      const storedUser = await storage.getSnapTradeUser(userId);
      if (!storedUser) {
        return res.status(404).json({ message: 'No SnapTrade user found. Please create a fresh account first.' });
      }
      
      // Extract the unique user ID from stored secret
      const secretMatch = storedUser.userSecret.match(/secret_(.+)_\d+$/);
      const snapTradeUserId = secretMatch ? secretMatch[1] : userId;
      
      console.log('Syncing SnapTrade accounts for user:', snapTradeUserId);
      
      const timestamp = Math.floor(Date.now() / 1000);
      const queryParams = new URLSearchParams({
        clientId: process.env.SNAPTRADE_CLIENT_ID,
        userId: snapTradeUserId,
        userSecret: storedUser.userSecret,
        timestamp: timestamp.toString()
      });
      
      const accountsSignature = generateSnapTradeSignature(
        'eJunnhdd52XTHCdrmzMItkKthmh7OwclxO32uvG89pEstYPXeM',
        {},
        '/api/v1/accounts',
        queryParams.toString()
      );
      
      const accountsResponse = await fetch(`https://api.snaptrade.com/api/v1/accounts?${queryParams}`, {
        method: 'GET',
        headers: {
          'Signature': accountsSignature,
        }
      });
      
      if (accountsResponse.ok) {
        const snapTradeAccounts = await accountsResponse.json();
        console.log('Retrieved SnapTrade accounts:', snapTradeAccounts.length);
        
        // Create/update connected accounts from SnapTrade data
        let syncedCount = 0;
        for (const account of snapTradeAccounts) {
          const accountData = {
            userId,
            accountType: 'brokerage' as const,
            provider: 'snaptrade',
            institutionName: account.institution_name || 'SnapTrade Brokerage',
            accountName: account.name || account.number,
            balance: account.total_value?.toString() || "0.00",
            currency: account.currency || 'USD',
            accessToken: 'snaptrade_connected',
            externalAccountId: account.id,
            isActive: true,
          };
          
          await storage.createConnectedAccount(accountData);
          syncedCount++;
        }
        
        // Log the sync
        await storage.logActivity({
          userId,
          action: 'accounts_synced',
          description: `Synced ${syncedCount} SnapTrade account(s)`,
          metadata: { provider: 'snaptrade', syncedCount },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
        });
        
        res.json({ 
          success: true, 
          message: `Successfully synced ${syncedCount} account(s)`,
          accountCount: syncedCount 
        });
      } else {
        const errorText = await accountsResponse.text();
        console.log('Failed to fetch SnapTrade accounts:', errorText);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch SnapTrade accounts',
          error: errorText 
        });
      }
      
    } catch (error: any) {
      console.error("Error syncing SnapTrade accounts:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error syncing accounts",
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to generate SnapTrade HMAC signature
function generateSnapTradeSignature(consumerKey: string, content: any, path: string, query: string): string {
  const sigObject = {
    content,
    path,
    query
  };
  
  // Use exact JSON format as specified in SnapTrade docs - no spaces, compact format
  const sigContent = JSON.stringify(sigObject, null, 0).replace(/\s/g, '');
  
  console.log('Signature content:', sigContent);
  console.log('Consumer key (first 10 chars):', consumerKey.substring(0, 10));
  
  const signature = crypto
    .createHmac('sha256', consumerKey)
    .update(sigContent)
    .digest('base64');
    
  console.log('Generated signature:', signature);
  return signature;
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
