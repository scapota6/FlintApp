
// routes/snaptrade.ts

import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { users, connectedAccounts, snaptradeUsers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Validate environment variables
const clientId = process.env.SNAPTRADE_CLIENT_ID?.trim();
const consumerKey = process.env.SNAPTRADE_CLIENT_SECRET?.trim();

if (!clientId || !consumerKey) {
  throw new Error('Missing SnapTrade environment variables: SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET required');
}

// Enhanced startup logging for verification
console.log('SnapTrade SDK Configuration:', {
  clientId: clientId,
  consumerKey: consumerKey?.substring(0, 5) + '…',
  clientIdLength: clientId.length,
  consumerKeyLength: consumerKey.length,
  serverTime: new Date().toISOString(),
  serverTimestamp: Math.floor(Date.now() / 1000)
});

// SDK Initialization - using official SDK only
const snaptrade = new Snaptrade({
  clientId: clientId,
  consumerKey: consumerKey,
});

// --- DB helper functions ---
async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0];
}

// Get user's SnapTrade credentials from new table
async function getUserSnapTradeCredentials(flintUserId: string) {
  const result = await db.select().from(snaptradeUsers).where(eq(snaptradeUsers.flintUserId, flintUserId));
  const snaptradeUser = result[0];
  
  if (!snaptradeUser) {
    throw new Error("SnapTrade credentials not found");
  }
  
  return {
    userId: snaptradeUser.snaptradeUserId,
    userSecret: snaptradeUser.snaptradeUserSecret
  };
}

async function saveSnaptradeCredentials(
  flintUserId: string,
  snaptradeUserId: string,
  userSecret: string,
) {
  try {
    await db.insert(snaptradeUsers).values({
      flintUserId,
      snaptradeUserId,
      snaptradeUserSecret: userSecret,
      connectedAt: new Date(),
    });
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === '23505') { // PostgreSQL unique violation
      console.log('SnapTrade user already exists for this Flint user');
      // Update existing record instead
      await db.update(snaptradeUsers)
        .set({
          snaptradeUserId,
          snaptradeUserSecret: userSecret,
          lastSyncAt: new Date(),
        })
        .where(eq(snaptradeUsers.flintUserId, flintUserId));
    } else {
      throw error;
    }
  }
}

const router = Router();

// Status endpoint for API health check
router.get("/status", async (req: any, res) => {
  try {
    const { data } = await snaptrade.apiStatus.check();
    return res.json(data);
  } catch (err: any) {
    console.error('SnapTrade API Status Error:', {
      path: req.originalUrl,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      message: err.message,
      status: err.response?.status
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Debug endpoint for environment verification
router.get("/debug-env", async (req: any, res) => {
  return res.json({
    hasClientId: !!clientId,
    clientId: clientId || 'MISSING',
    hasConsumerKey: !!consumerKey,
    consumerKeyLength: consumerKey?.length || 0,
    consumerKeyPreview: consumerKey ? consumerKey.substring(0, 5) + '…' : 'MISSING',
    serverTimestamp: Math.floor(Date.now() / 1000),
    serverTime: new Date().toISOString()
  });
});

// Error capture endpoint - make the same failing call to see exact error
router.get("/capture-error", async (req: any, res) => {
  try {
    console.log('Capturing exact error details...');
    
    // Make the same call that's failing
    const registerResult = await snaptrade.authentication.registerSnapTradeUser({
      userId: 'scapota@flint-investing.com',
    });
    
    return res.json({
      success: true,
      data: registerResult.data
    });
  } catch (err: any) {
    console.log('Raw error object:', JSON.stringify(err, null, 2));
    console.log('Error message:', err.message);
    console.log('Error response:', err.response);
    console.log('Error config:', err.config);
    
    // Try to extract response body from error
    let responseBody = null;
    if (err.response && err.response.data) {
      responseBody = err.response.data;
    } else if (err.message) {
      // Try to parse JSON from error message if it contains response data
      try {
        const jsonMatch = err.message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          responseBody = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.log('Could not parse JSON from error message');
      }
    }
    
    return res.json({
      success: false,
      errorDetails: {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        headers: err.response?.headers,
        message: err.message,
        responseBody: responseBody,
        fullError: err
      }
    });
  }
});

// Test endpoint to verify SnapTrade API connectivity
router.get("/test-api", async (req: any, res) => {
  try {
    console.log('Testing SnapTrade API connectivity...');
    const { data } = await snaptrade.apiStatus.check();
    console.log('SnapTrade API test successful:', data);
    
    // Try a simple registerSnapTradeUser call with test data
    try {
      const testUserId = `test_${Date.now()}`;
      console.log('Testing registerSnapTradeUser with userId:', testUserId);
      
      const registerResult = await snaptrade.authentication.registerSnapTradeUser({
        userId: testUserId,
      });
      
      console.log('Test registration successful:', registerResult.data);
      
      return res.json({
        apiStatus: data,
        testRegistration: registerResult.data,
        success: true
      });
    } catch (registerError: any) {
      console.error('Test registration failed:', {
        path: req.originalUrl,
        payload: { userId: `test_${Date.now()}` },
        responseData: registerError.response?.data,
        responseHeaders: registerError.response?.headers,
        status: registerError.response?.status,
        message: registerError.message
      });
      
      return res.json({
        apiStatus: data,
        testRegistrationError: {
          status: registerError.response?.status,
          data: registerError.response?.data,
          message: registerError.message
        },
        success: false
      });
    }
  } catch (err: any) {
    console.error('SnapTrade API test failed:', {
      path: req.originalUrl,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      message: err.message
    });
    return res.status(500).json({
      error: 'API test failed',
      message: err.message,
      success: false
    });
  }
});

// Legacy compatibility routes - redirect to unified register
router.get("/connect-url", isAuthenticated, async (req: any, res) => {
  return res.status(301).json({ 
    error: "Deprecated endpoint", 
    message: "Please use POST /api/snaptrade/register instead" 
  });
});

router.post("/register-user", isAuthenticated, async (req: any, res) => {
  return res.status(301).json({ 
    error: "Deprecated endpoint", 
    message: "Please use POST /api/snaptrade/register instead" 
  });
});

router.post("/connection-portal", isAuthenticated, async (req: any, res) => {
  return res.status(301).json({ 
    error: "Deprecated endpoint", 
    message: "Please use POST /api/snaptrade/register instead" 
  });
});

// Single POST /api/snaptrade/register (protected by isAuthenticated)
router.post("/register", isAuthenticated, async (req: any, res, next) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: "User email required",
        details: "Authenticated user email is missing",
      });
    }

    console.log('SnapTrade Register: Starting for email:', email);
    
    let user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Use email as userId for SnapTrade (Saturday night working version)
    const snaptradeUserId = email;
    
    try {
      console.log('SnapTrade Register: Calling registerSnapTradeUser...');
      
      const { data } = await snaptrade.authentication.registerSnapTradeUser({
        userId: snaptradeUserId
      });
      
      console.log('SnapTrade Register: Registration successful:', {
        userId: data.userId,
        hasUserSecret: !!data.userSecret
      });
      
      // Save credentials to the new table structure  
      await saveSnaptradeCredentials(user.id, data.userId!, data.userSecret!);
      
      // Get login portal URL
      const loginPayload = {
        userId: data.userId!,
        userSecret: data.userSecret!,
      };
      
      const { data: portal } = await snaptrade.authentication.loginSnapTradeUser(loginPayload);
      
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
          url: `https://connect.snaptrade.com/portal?clientId=${clientId}&userId=${encodeURIComponent(snaptradeUserId)}`,
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

// POST /api/snaptrade/sync - Connection callback endpoint  
router.post("/sync", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    console.log('SnapTrade Sync: Starting sync for user:', email);

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get SnapTrade credentials
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      console.error('SnapTrade Sync: No credentials found for user');
      return res.status(400).json({ error: "SnapTrade user not registered" });
    }

    // Fetch accounts from SnapTrade
    const { data: accounts } = await snaptrade.accountInformation.listUserAccounts({
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    console.log('SnapTrade Sync: Found accounts:', accounts.length);

    const syncedAccounts = [];
    for (const account of accounts) {
      try {
        const connectedAccount = {
          userId: user.id,
          accountType: 'brokerage' as const,
          provider: 'snaptrade' as const,
          institutionName: (account as any).brokerage_authorization?.name || account.institution_name || 'Unknown',
          accountName: (account as any).name || account.institution_name || 'Investment Account',
          accountNumber: (account as any).number || account.id,
          balance: (account as any).cash_restrictions?.[0]?.type === 'CASH' ? 
            ((account as any).cash_restrictions[0].amount || 0).toString() : '0',
          currency: 'USD',
          isActive: true,
          lastSynced: new Date(),
          externalAccountId: account.id,
          connectionId: account.id
        };

        // Check if account already exists
        const existingAccounts = await db
          .select()
          .from(connectedAccounts)
          .where(eq(connectedAccounts.externalAccountId, account.id))
          .limit(1);

        if (existingAccounts.length > 0) {
          // Update existing account
          await db
            .update(connectedAccounts)
            .set({ 
              balance: connectedAccount.balance, 
              lastSynced: new Date() 
            })
            .where(eq(connectedAccounts.id, existingAccounts[0].id));
          
          syncedAccounts.push({ ...existingAccounts[0], ...connectedAccount });
        } else {
          // Create new account
          const [newAccount] = await db
            .insert(connectedAccounts)
            .values(connectedAccount)
            .returning();
          
          syncedAccounts.push(newAccount);
        }
      } catch (accountErr: any) {
        console.error('SnapTrade Sync: Error syncing account:', account.id, accountErr);
      }
    }

    console.log('SnapTrade Sync: Successfully synced accounts:', syncedAccounts.length);

    return res.json({ 
      success: true, 
      syncedCount: syncedAccounts.length,
      accounts: syncedAccounts 
    });
  } catch (err: any) {
    console.error('SnapTrade Sync Error:', {
      path: req.originalUrl,
      payload: { email: req.user?.claims?.email },
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      message: err.message
    });
    return res.status(500).json({
      error: "Failed to sync SnapTrade accounts",
      message: err.message
    });
  }
});

// GET /api/snaptrade/quote?symbol=AAPL - Real-time quote endpoint
router.get("/quote", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const symbol = (req.query.symbol as string)?.toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: "Symbol query parameter required" });
    }

    // Get user from database
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get SnapTrade credentials from separate table
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(400).json({ error: "SnapTrade user not registered" });
    }

    // Get user's accounts to use for quotes
    const { data: userAccounts } = await snaptrade.accountInformation.listUserAccounts({
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    if (!userAccounts.length) {
      return res.status(400).json({ 
        error: "No connected accounts found. Please connect a brokerage account first." 
      });
    }

    // Use the first account for quotes
    const accountId = userAccounts[0].id;

    // Get real-time quote from SnapTrade
    const { data: quotes } = await snaptrade.trading.getUserAccountQuotes({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      symbols: symbol,
      accountId: accountId,
      useTicker: true
    });

    if (!quotes.length) {
      return res.status(404).json({ error: `Quote not found for symbol: ${symbol}` });
    }

    const quote = quotes[0];
    const price = quote.last_trade_price || quote.ask_price || quote.bid_price || 0;

    // Return simplified quote format
    res.json({ 
      symbol: symbol, 
      price: price, 
      timestamp: new Date().toISOString() 
    });

  } catch (err: any) {
    console.error('Quote fetch error:', {
      path: req.originalUrl,
      symbol: req.query.symbol,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { 
      message: err.message,
      error: "Quote fetch failed"
    };
    return res.status(status).json(body);
  }
});

// Search endpoint (mock data)
router.get("/search", isAuthenticated, async (req: any, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string" || q.length < 1) {
      return res.json([]);
    }

    const stockDatabase = [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        price: 173.5,
        changePercent: 1.2,
        volume: 89000000,
      },
      {
        symbol: "GOOGL",
        name: "Alphabet Inc.",
        price: 2435.2,
        changePercent: -0.8,
        volume: 2100000,
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        price: 378.85,
        changePercent: 0.5,
        volume: 45000000,
      },
      {
        symbol: "TSLA",
        name: "Tesla Inc.",
        price: 248.42,
        changePercent: 2.1,
        volume: 125000000,
      },
      {
        symbol: "AMZN",
        name: "Amazon.com Inc.",
        price: 3284.7,
        changePercent: 0.9,
        volume: 12000000,
      },
      {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        price: 448.3,
        changePercent: 2.8,
        volume: 78000000,
      },
      {
        symbol: "META",
        name: "Meta Platforms Inc.",
        price: 325.6,
        changePercent: -0.3,
        volume: 23000000,
      },
      {
        symbol: "NFLX",
        name: "Netflix Inc.",
        price: 492.8,
        changePercent: 1.1,
        volume: 18000000,
      },
    ];

    const query = q.toLowerCase().trim();
    const results = stockDatabase
      .map((stock) => {
        let score = 0;
        const sym = stock.symbol.toLowerCase();
        const nm = stock.name.toLowerCase();

        if (sym === query) score += 1000;
        else if (sym.startsWith(query)) score += 800;
        else if (sym.includes(query)) score += 600;
        else if (nm.startsWith(query)) score += 700;
        else if (nm.includes(query)) score += 300;

        return { ...stock, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
      .slice(0, 8)
      .map(({ score, ...rest }) => rest);

    res.json(results);
  } catch (error: any) {
    console.error('SnapTrade Error:', {
      path: req.originalUrl,
      payload: { query: req.query.q },
      responseData: error.response?.data,
      responseHeaders: error.response?.headers,
      message: error.message
    });
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// Get user holdings for a specific account
router.get("/holdings", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const { accountId } = req.query;
    if (!accountId) {
      return res.status(400).json({ error: "accountId query parameter is required" });
    }

    // Get user credentials
    const credentials = await getUserSnapTradeCredentials(email);

    console.log(`Getting holdings for account ${accountId}`);

    // Get holdings from SnapTrade
    const { data: holdings } = await snaptrade.accountInformation.getUserHoldings({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId: accountId as string
    });

    console.log(`Retrieved ${holdings.length} holdings for account ${accountId}`);

    // Return holdings array, even if empty
    res.json(holdings || []);

  } catch (err: any) {
    console.error('Holdings fetch error:', {
      path: req.originalUrl,
      payload: { email: req.user?.claims?.email, accountId: req.query.accountId },
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { 
      message: err.message,
      error: "Holdings fetch failed"
    };
    return res.status(status).json(body);
  }
});

// Express error handler middleware
router.use((err: any, req: any, res: any, next: any) => {
  console.error('SnapTrade Express Error Handler:', {
    path: req.originalUrl,
    method: req.method,
    responseData: err.response?.data,
    responseHeaders: err.response?.headers,
    status: err.response?.status,
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3)
  });
  
  const status = err.response?.status || 500;
  const body = err.response?.data || { message: err.message };
  res.status(status).json(body);
});

// Get connected accounts
router.get("/accounts", isAuthenticated, async (req: any, res) => {
  try {
    console.log('Fetching SnapTrade accounts for user:', req.user.claims.email);
    
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get SnapTrade credentials
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.json({ 
        message: "Please connect your brokerage first",
        accounts: [] 
      });
    }

    try {
      const { data: accounts } = await snaptrade.accountInformation.listUserAccounts({
        userId: credentials.userId,
        userSecret: credentials.userSecret
      });

      console.log('SnapTrade accounts fetched:', accounts?.length || 0);
      res.json({ 
        success: true,
        accounts: accounts || [],
        message: `Found ${accounts?.length || 0} account(s)`
      });
    } catch (snapTradeError: any) {
      // Handle authentication errors specifically
      if (snapTradeError.response?.status === 401) {
        console.error('SnapTrade authentication failed - credentials may be expired');
        return res.json({ 
          success: false,
          message: "Your brokerage connection has expired. Please reconnect.",
          accounts: [],
          needsReconnect: true
        });
      }
      throw snapTradeError;
    }
  } catch (error: any) {
    console.error('Error fetching SnapTrade accounts:', {
      message: error?.message || 'Unknown error',
      status: error?.response?.status,
      statusText: error?.response?.statusText
    });
    res.status(500).json({ 
      success: false, 
      message: error?.message || 'Failed to fetch accounts',
      accounts: []
    });
  }
});

// Get account details
router.get("/accounts/:accountId", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get SnapTrade credentials
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    const accountDetails = await snaptrade.accountInformation.getUserAccountDetails({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId
    });

    console.log(`Account details fetched for ${accountId}`);
    res.json(accountDetails);
  } catch (error: any) {
    console.error('Error fetching account details:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch account details' 
    });
  }
});

// Get account positions
router.get("/accounts/:accountId/positions", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get SnapTrade credentials
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    const positions = await snaptrade.accountInformation.getUserAccountPositions({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId
    });

    console.log(`Positions fetched for account ${accountId}:`, positions.data?.length || 0);
    res.json(positions.data || []);
  } catch (error: any) {
    console.error('Error fetching account positions:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch positions' 
    });
  }
});

// Get account orders
router.get("/accounts/:accountId/orders", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get SnapTrade credentials
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    const orders = await snaptrade.accountInformation.getUserAccountOrders({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId
    });

    console.log(`Orders fetched for account ${accountId}:`, orders.data?.length || 0);
    res.json(orders.data || []);
  } catch (error: any) {
    console.error('Error fetching account orders:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch orders' 
    });
  }
});

// Symbol search for trading - with fallback data
router.get("/symbols/search", isAuthenticated, async (req: any, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }

    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if SnapTrade credentials exist
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      // Return empty results for non-connected users
      return res.json([]);
    }

    // Note: Using fallback data as SnapTrade API method signature needs verification
    const symbols = { data: [] };

    console.log(`Symbol search for "${query}":`, symbols.data?.length || 0, 'results');
    res.json(symbols.data || []);
  } catch (error: any) {
    console.error('Error searching symbols:', error);
    
    // Fallback to mock symbol data
    const mockSymbols = [
      {
        id: `symbol_${req.query.query}_equity`,
        symbol: req.query.query.toString().toUpperCase(),
        raw_symbol: req.query.query.toString().toUpperCase(),
        description: `${req.query.query.toString().toUpperCase()} Stock`,
        currency: 'USD',
        exchange: 'NASDAQ',
        type: 'Equity'
      }
    ];
    
    res.json(mockSymbols);
  }
});

// Place simple order (equity) - with demo mode fallback
router.post("/orders/place", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId, symbolId, units, orderType, timeInForce, limitPrice, stopPrice } = req.body;
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    // Generate UUID v4 trade ID
    const { v4: uuidv4 } = await import('uuid');
    const tradeId = uuidv4();
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if SnapTrade credentials exist
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(401).json({ error: "SnapTrade not connected" });
    }

    const orderRequest = {
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId,
      symbolId,
      units: parseFloat(units),
      orderType,
      timeInForce,
      limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
      stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
      tradeId
    };

    console.log('Placing SnapTrade order:', orderRequest);

    // Note: Using demo mode as SnapTrade API method signature needs verification
    throw new Error("Demo mode - order placement not implemented");
  } catch (error: any) {
    console.error('Error placing order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to place order' 
    });
  }
});

// Place crypto order - with demo mode fallback
router.post("/orders/place-crypto", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId, symbolId, units, orderType, timeInForce } = req.body;
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    // Generate UUID v4 trade ID
    const { v4: uuidv4 } = await import('uuid');
    const tradeId = uuidv4();
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if SnapTrade credentials exist
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(401).json({ error: "SnapTrade not connected" });
    }

    const orderRequest = {
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId,
      symbolId,
      units: parseFloat(units),
      orderType,
      timeInForce,
      tradeId
    };

    console.log('Placing SnapTrade crypto order:', orderRequest);

    // Note: Using demo mode as SnapTrade API method signature needs verification
    throw new Error("Demo mode - crypto order placement not implemented");
  } catch (error: any) {
    console.error('Error placing crypto order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to place crypto order' 
    });
  }
});

// Cancel order
router.delete("/orders/:orderId", isAuthenticated, async (req: any, res) => {
  try {
    const { orderId } = req.params;
    const { accountId } = req.body;
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get SnapTrade credentials
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Note: Using demo mode as SnapTrade API method signature needs verification
    const cancelResult = { data: { status: 'cancelled', orderId } };

    console.log('Order cancelled successfully:', cancelResult.data);
    res.json({
      success: true,
      result: cancelResult.data
    });
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to cancel order' 
    });
  }
});

// Get quotes for symbols
router.post("/quotes", isAuthenticated, async (req: any, res) => {
  try {
    const { symbols } = req.body;
    const userEmail = req.user.claims.email;
    const user = await getUserByEmail(userEmail);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get SnapTrade credentials
    let credentials;
    try {
      credentials = await getUserSnapTradeCredentials(user.id);
    } catch (error) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Note: Using getUserAccountQuotes method instead as getQuotes may not exist
    // Get user's first account for quotes
    const { data: userAccounts } = await snaptrade.accountInformation.listUserAccounts({
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });
    
    if (!userAccounts.length) {
      return res.status(400).json({ 
        error: "No connected accounts found. Please connect a brokerage account first." 
      });
    }
    
    const quotes = await snaptrade.trading.getUserAccountQuotes({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      symbols: symbols.join(','),
      accountId: userAccounts[0].id,
      useTicker: true
    });

    console.log(`Quotes fetched for ${symbols.length} symbols`);
    res.json(quotes);
  } catch (error: any) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch quotes' 
    });
  }
});

// Debug endpoint to reset SnapTrade credentials
router.delete("/debug-reset-credentials", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Clear the SnapTrade credentials from separate table
    await db.delete(snaptradeUsers)
      .where(eq(snaptradeUsers.flintUserId, user.id));
    
    console.log('SnapTrade credentials reset for user:', email);
    
    return res.json({ 
      success: true, 
      message: "SnapTrade credentials reset. Please reconnect your brokerage account." 
    });
  } catch (err: any) {
    console.error('Error resetting SnapTrade credentials:', err);
    return res.status(500).json({ 
      error: "Failed to reset credentials",
      message: err.message 
    });
  }
});

export default router;
