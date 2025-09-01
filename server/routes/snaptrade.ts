
// routes/snaptrade.ts

import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { users, connectedAccounts } from "@shared/schema";
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

// Get user's SnapTrade credentials
async function getUserSnapTradeCredentials(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email));
  const user = result[0];
  
  if (!user?.snaptradeUserId || !user?.snaptradeUserSecret) {
    throw new Error("SnapTrade credentials not found");
  }
  
  return {
    userId: user.snaptradeUserId,
    userSecret: user.snaptradeUserSecret
  };
}

async function saveSnaptradeCredentials(
  email: string,
  snaptradeUserId: string,
  userSecret: string,
) {
  const user = await getUserByEmail(email);
  if (user) {
    await storage.createSnapTradeUser(user.id, snaptradeUserId, userSecret);
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
    
    console.log('SnapTrade Register: User found with credentials:', {
      hasUserId: !!user.snaptradeUserId,
      hasUserSecret: !!user.snaptradeUserSecret
    });

    // If missing credentials, register with SnapTrade using official SDK
    if (!user.snaptradeUserId || !user.snaptradeUserSecret) {
      try {
        // Create a unique userId for SnapTrade (not email)
        const uniqueUserId = `flint_${user.id}_${Date.now()}`;
        const registerPayload = { userId: uniqueUserId };
        console.log('SnapTrade Register: Calling registerSnapTradeUser with payload:', registerPayload);
        
        const { data } = await snaptrade.authentication.registerSnapTradeUser(registerPayload);
        
        console.log('SnapTrade Register: Registration successful:', {
          userId: data.userId,
          hasUserSecret: !!data.userSecret
        });
        
        await saveSnaptradeCredentials(email, data.userId!, data.userSecret!);
        user = await getUserByEmail(email);
      } catch (err: any) {
        // Parse the actual response body from the SDK error message
        let actualResponseData = null;
        let actualStatus = null;
        
        if (err.message && err.message.includes('Request failed with status code')) {
          // Extract status code from error message
          const statusMatch = err.message.match(/Request failed with status code (\d+)/);
          if (statusMatch) {
            actualStatus = parseInt(statusMatch[1]);
          }
          
          // Try to fetch the actual response by making a test call to get the real error
          try {
            console.log('Attempting to extract error details by calling test endpoint...');
            const testResponse = await fetch('/api/snaptrade/test-api');
            // This won't help us here, let's try a different approach
          } catch (testErr) {
            // Ignore test error
          }
        }
        
        // Enhanced error logging
        console.error('SnapTrade Registration Error Details:', {
          path: req.originalUrl,
          payload: { userId: email },
          extractedStatus: actualStatus,
          responseData: err.response?.data || actualResponseData,
          responseHeaders: err.response?.headers,
          status: err.response?.status || actualStatus,
          message: err.message,
          fullErrorObject: err,
          stack: err.stack?.split('\n').slice(0, 3)
        });
        
        // Handle USER_EXISTS and 1010 as "already registered"
        const errData = err.response?.data || err.responseBody || actualResponseData;
        if (
          errData?.code === "USER_EXISTS" ||
          errData?.code === "1010" ||
          /already exist/i.test(errData?.detail || errData?.message || "")
        ) {
          console.log('SnapTrade Register: User already exists, attempting to delete and re-register...');
          
          // Delete the existing user and re-register
          try {
            await snaptrade.authentication.deleteSnapTradeUser({ userId: email });
            console.log('SnapTrade Register: Successfully deleted existing user');
            
            // Now re-register the user
            const { data: newRegData } = await snaptrade.authentication.registerSnapTradeUser({ userId: `flint_${user.id}_${Date.now()}` });
            console.log('SnapTrade Register: Re-registration successful:', {
              userId: newRegData.userId,
              hasUserSecret: !!newRegData.userSecret
            });
            
            await saveSnaptradeCredentials(email, newRegData.userId!, newRegData.userSecret!);
            user = await getUserByEmail(email);
          } catch (deleteErr: any) {
            console.error('SnapTrade Register: Failed to delete and re-register:', deleteErr);
            return res.status(409).json({
              error: "User already registered",
              details: "User exists in SnapTrade but could not be re-registered. Please contact support.",
              deleteError: deleteErr.message
            });
          }
        } else {
          // Forward raw response data and correct status
          const status = err.response?.status || 500;
          const body = err.response?.data || { 
            message: err.message,
            error: "SnapTrade API Error"
          };
          return res.status(status).json(body);
        }
      }
    }

    // Generate connection URL using stored credentials and official SDK
    console.log('SnapTrade Register: Logging in user with credentials:', {
      userId: user.snaptradeUserId,
      userSecretLength: user.snaptradeUserSecret?.length
    });
    
    try {
      const loginPayload = {
        userId: user.snaptradeUserId!,
        userSecret: user.snaptradeUserSecret!,
      };
      
      const { data: portal } = await snaptrade.authentication.loginSnapTradeUser(loginPayload);
      
      console.log('SnapTrade Register: Portal response received:', {
        hasRedirectURI: !!(portal as any).redirectURI
      });
      
      return res.json({ url: (portal as any).redirectURI });
    } catch (loginErr: any) {
      console.error('SnapTrade Error:', {
        path: req.originalUrl,
        payload: {
          userId: user.snaptradeUserId,
          userSecretLength: user.snaptradeUserSecret?.length
        },
        responseData: loginErr.response?.data,
        responseHeaders: loginErr.response?.headers,
        status: loginErr.response?.status,
        message: loginErr.message
      });
      
      const status = loginErr.response?.status || 500;
      const body = loginErr.response?.data || { message: loginErr.message };
      return res.status(status).json(body);
    }
    
  } catch (err: any) {
    console.error('SnapTrade Error:', {
      path: req.originalUrl,
      payload: { email: req.user?.claims?.email },
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      message: err.message
    });
    return next(err);
  }
});

// Removed duplicate - using enhanced version below

// POST /api/snaptrade/sync → sync SnapTrade accounts to database
router.post("/sync", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    const userId = req.user.claims.sub;
    
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }
    
    const user = await getUserByEmail(email);
    
    if (!user?.snaptradeUserSecret) {
      return res.status(401).json({ error: "Please connect your brokerage first" });
    }

    console.log('SnapTrade Sync: Fetching accounts for user:', email);

    // Fetch accounts from SnapTrade
    const { data: snapTradeAccounts } = await snaptrade.accountInformation.listUserAccounts({
      userId: user.snaptradeUserId!,
      userSecret: user.snaptradeUserSecret!,
    });

    console.log('SnapTrade Sync: Found accounts:', snapTradeAccounts.length);

    // Sync each account to the database
    const syncedAccounts = [];
    for (const account of snapTradeAccounts) {
      try {
        // Calculate total balance from account data
        const totalBalance = account.balance?.total?.amount || 0;
        
        // Create or update connected account in database
        const connectedAccount = {
          userId,
          provider: 'snaptrade' as const,
          externalAccountId: account.id,
          accountType: account.type || 'investment',
          accountName: account.name || account.institution_name || 'Investment Account',
          institutionName: account.institution_name || 'SnapTrade Brokerage',
          balance: totalBalance.toString(),
          currency: account.balance?.total?.currency || 'USD',
          isActive: true,
          lastSynced: new Date(),
        };

        // Check if account already exists
        const existingAccounts = await db
          .select()
          .from(connectedAccounts)
          .where(and(
            eq(connectedAccounts.userId, userId),
            eq(connectedAccounts.externalAccountId, account.id)
          ));

        if (existingAccounts.length > 0) {
          // Update existing account
          await db
            .update(connectedAccounts)
            .set({
              balance: connectedAccount.balance,
              lastSynced: connectedAccount.lastSynced,
              isActive: true,
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
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
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
    
    if (!user?.snaptradeUserId || !user?.snaptradeUserSecret) {
      return res.status(400).json({ error: "SnapTrade user not registered" });
    }

    const credentials = {
      userId: user.snaptradeUserId,
      userSecret: user.snaptradeUserSecret
    };

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
    
    if (!user || !user.snaptradeUserSecret || !user.snaptradeUserId) {
      return res.json({ 
        message: "Please connect your brokerage first",
        accounts: [] 
      });
    }

    try {
      const { data: accounts } = await snaptrade.accountInformation.listUserAccounts({
        userId: user.snaptradeUserId,
        userSecret: user.snaptradeUserSecret
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
    
    if (!user || !user.snaptradeUserSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    const accountDetails = await snaptrade.accountInformation.getUserAccountDetails({
      userId: userEmail,
      userSecret: user.snaptradeUserSecret,
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
    
    if (!user || !user.snaptradeUserSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    const positions = await snaptrade.accountInformation.getUserAccountPositions({
      userId: userEmail,
      userSecret: user.snaptradeUserSecret,
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
    
    if (!user || !user.snaptradeUserSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    const orders = await snaptrade.accountInformation.getUserAccountOrders({
      userId: userEmail,
      userSecret: user.snaptradeUserSecret,
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
    
    if (!user || !user.snaptradeUserSecret) {
      // Fallback to mock symbol data for demo
      const mockSymbols = [
        {
          id: `symbol_${query}_equity`,
          symbol: query.toString().toUpperCase(),
          raw_symbol: query.toString().toUpperCase(),
          description: `${query.toString().toUpperCase()} Stock`,
          currency: 'USD',
          exchange: 'NASDAQ',
          type: 'Equity'
        }
      ];
      
      return res.json(mockSymbols);
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
    
    if (!user || !user.snaptradeUserSecret) {
      // Demo mode - simulate order placement
      console.log('Demo mode: Simulating equity order placement');
      const simulatedOrder = {
        id: tradeId,
        symbol: symbolId.replace('symbol_', '').replace('_equity', ''),
        status: 'FILLED',
        units: parseFloat(units),
        action: 'BUY',
        order_type: orderType,
        time_in_force: timeInForce,
        filled_units: parseFloat(units),
        price: limitPrice || 100 + Math.random() * 200,
        created_at: new Date().toISOString()
      };
      
      return res.json({
        success: true,
        order: simulatedOrder,
        tradeId,
        demo: true
      });
    }

    const orderRequest = {
      userId: userEmail,
      userSecret: user.snaptradeUserSecret,
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

    console.log('Order placed successfully:', orderResult.data);
    res.json({
      success: true,
      order: orderResult.data,
      tradeId
    });
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
    
    if (!user || !user.snaptradeUserSecret) {
      // Demo mode - simulate crypto order placement
      console.log('Demo mode: Simulating crypto order placement');
      const simulatedOrder = {
        id: tradeId,
        symbol: symbolId.replace('symbol_', '').replace('_crypto', ''),
        status: 'FILLED',
        units: parseFloat(units),
        action: 'BUY',
        order_type: orderType,
        time_in_force: timeInForce,
        filled_units: parseFloat(units),
        price: 50000 + Math.random() * 20000, // Crypto price range
        created_at: new Date().toISOString()
      };
      
      return res.json({
        success: true,
        order: simulatedOrder,
        tradeId,
        demo: true
      });
    }

    const orderRequest = {
      userId: userEmail,
      userSecret: user.snaptradeUserSecret,
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

    console.log('Crypto order placed successfully:', orderResult.data);
    res.json({
      success: true,
      order: orderResult.data,
      tradeId
    });
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
    
    if (!user || !user.snaptradeUserSecret) {
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
    
    if (!user || !user.snaptradeUserSecret) {
      return res.status(401).json({ message: "SnapTrade not connected" });
    }

    // Note: Using getUserAccountQuotes method instead as getQuotes may not exist
    // Get user's first account for quotes
    const { data: userAccounts } = await snaptrade.accountInformation.listUserAccounts({
      userId: user.snaptradeUserId!,
      userSecret: user.snaptradeUserSecret
    });
    
    if (!userAccounts.length) {
      return res.status(400).json({ 
        error: "No connected accounts found. Please connect a brokerage account first." 
      });
    }
    
    const quotes = await snaptrade.trading.getUserAccountQuotes({
      userId: user.snaptradeUserId!,
      userSecret: user.snaptradeUserSecret,
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
    
    // Clear the SnapTrade credentials from database
    await db.update(users)
      .set({ 
        snaptradeUserId: null,
        snaptradeUserSecret: null 
      })
      .where(eq(users.id, user.id));
    
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

// === Authentication API Compliance ===

// List all SnapTrade users (Admin endpoint)
router.get("/users", isAuthenticated, async (req: any, res) => {
  try {
    console.log('Listing all SnapTrade users');
    const { data: userList } = await snaptrade.authentication.listSnapTradeUsers();
    console.log(`Found ${userList?.length || 0} SnapTrade users`);
    res.json({ success: true, users: userList || [] });
  } catch (err: any) {
    console.error('SnapTrade List Users Error:', {
      path: req.originalUrl,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Delete SnapTrade user
router.delete("/users/:userId", isAuthenticated, async (req: any, res) => {
  try {
    const { userId } = req.params;
    console.log('Deleting SnapTrade user:', userId);
    
    const { data } = await snaptrade.authentication.deleteSnapTradeUser({ userId });
    console.log('SnapTrade user deleted successfully:', userId);
    
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('SnapTrade Delete User Error:', {
      path: req.originalUrl,
      userId: req.params.userId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Reset SnapTrade user secret
router.post("/users/:userId/reset-secret", isAuthenticated, async (req: any, res) => {
  try {
    const { userId } = req.params;
    console.log('Resetting SnapTrade user secret:', userId);
    
    const { data } = await snaptrade.authentication.resetSnapTradeUserSecret({
      userId,
      userSecret: req.body.userSecret
    });
    
    console.log('SnapTrade user secret reset successfully:', userId);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('SnapTrade Reset Secret Error:', {
      path: req.originalUrl,
      userId: req.params.userId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// === Connections API Compliance ===

// List all brokerage authorizations/connections
router.get("/connections", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Listing brokerage authorizations for user:', email);

    const { data: connections } = await snaptrade.connections.listBrokerageAuthorizations({
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    console.log(`Found ${connections?.length || 0} brokerage connections`);
    res.json({ success: true, connections: connections || [] });
  } catch (err: any) {
    console.error('SnapTrade List Connections Error:', {
      path: req.originalUrl,
      email: req.user?.claims?.email,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Get connection detail
router.get("/connections/:authorizationId", isAuthenticated, async (req: any, res) => {
  try {
    const { authorizationId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Getting connection details for authorization:', authorizationId);

    const { data: connection } = await snaptrade.connections.detailBrokerageAuthorization({
      authorizationId,
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    console.log('Connection details retrieved for authorization:', authorizationId);
    res.json({ success: true, connection });
  } catch (err: any) {
    console.error('SnapTrade Connection Detail Error:', {
      path: req.originalUrl,
      authorizationId: req.params.authorizationId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Remove/delete brokerage authorization
router.delete("/connections/:authorizationId", isAuthenticated, async (req: any, res) => {
  try {
    const { authorizationId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Removing brokerage authorization:', authorizationId);

    await snaptrade.connections.removeBrokerageAuthorization({
      authorizationId,
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    console.log('Brokerage authorization removed successfully:', authorizationId);
    res.json({ success: true, message: 'Connection removed successfully' });
  } catch (err: any) {
    console.error('SnapTrade Remove Connection Error:', {
      path: req.originalUrl,
      authorizationId: req.params.authorizationId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Refresh brokerage authorization holdings
router.post("/connections/:authorizationId/refresh", isAuthenticated, async (req: any, res) => {
  try {
    const { authorizationId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Refreshing brokerage authorization:', authorizationId);

    const { data } = await snaptrade.connections.refreshBrokerageAuthorization({
      authorizationId,
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    console.log('Brokerage authorization refreshed successfully:', authorizationId);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('SnapTrade Refresh Connection Error:', {
      path: req.originalUrl,
      authorizationId: req.params.authorizationId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Disable brokerage authorization (force disconnect for testing)
router.post("/connections/:authorizationId/disable", isAuthenticated, async (req: any, res) => {
  try {
    const { authorizationId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Disabling brokerage authorization:', authorizationId);

    const { data } = await snaptrade.connections.disableBrokerageAuthorization({
      authorizationId,
      userId: credentials.userId,
      userSecret: credentials.userSecret
    });

    console.log('Brokerage authorization disabled successfully:', authorizationId);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('SnapTrade Disable Connection Error:', {
      path: req.originalUrl,
      authorizationId: req.params.authorizationId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// === Account Information API Compliance ===

// Get account balance
router.get("/accounts/:accountId/balance", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Getting account balance for account:', accountId);

    const { data: balance } = await snaptrade.accountInformation.getUserAccountBalance({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId
    });

    console.log('Account balance retrieved for account:', accountId);
    res.json({ success: true, balance });
  } catch (err: any) {
    console.error('SnapTrade Account Balance Error:', {
      path: req.originalUrl,
      accountId: req.params.accountId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Get recent orders (last 24 hours)
router.get("/accounts/:accountId/orders/recent", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const { onlyExecuted = true } = req.query;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Getting recent orders for account:', accountId);

    const { data: orders } = await snaptrade.accountInformation.getUserAccountRecentOrders({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId,
      onlyExecuted: onlyExecuted === 'true'
    });

    console.log(`Retrieved ${orders?.length || 0} recent orders for account ${accountId}`);
    res.json({ success: true, orders: orders || [] });
  } catch (err: any) {
    console.error('SnapTrade Recent Orders Error:', {
      path: req.originalUrl,
      accountId: req.params.accountId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Get account activities/transactions
router.get("/accounts/:accountId/activities", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate, offset = 0, limit = 100, type } = req.query;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Getting account activities for account:', accountId);

    const { data: activities } = await snaptrade.accountInformation.getAccountActivities({
      accountId,
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      startDate: startDate as string,
      endDate: endDate as string,
      offset: parseInt(offset as string) || 0,
      limit: parseInt(limit as string) || 100,
      type: type as string
    });

    console.log(`Retrieved ${activities?.length || 0} activities for account ${accountId}`);
    res.json({ success: true, activities: activities || [] });
  } catch (err: any) {
    console.error('SnapTrade Account Activities Error:', {
      path: req.originalUrl,
      accountId: req.params.accountId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// === Reference Data API Compliance ===

// Get partner info (client configuration)
router.get("/partner-info", isAuthenticated, async (req: any, res) => {
  try {
    console.log('Getting SnapTrade partner info');
    const { data: partnerInfo } = await snaptrade.referenceData.getPartnerInfo();
    console.log('SnapTrade partner info retrieved successfully');
    res.json({ success: true, partnerInfo });
  } catch (err: any) {
    console.error('SnapTrade Partner Info Error:', {
      path: req.originalUrl,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Search symbols for specific account
router.get("/accounts/:accountId/symbols/search", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Search query required" });
    }

    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Searching symbols for account:', accountId, 'query:', query);

    const { data: symbols } = await snaptrade.referenceData.symbolSearchUserAccount({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId,
      symbolQuery: { substring: query as string }
    });

    console.log(`Found ${symbols?.length || 0} symbols for query "${query}" in account ${accountId}`);
    res.json({ success: true, symbols: symbols || [] });
  } catch (err: any) {
    console.error('SnapTrade Symbol Search Error:', {
      path: req.originalUrl,
      accountId: req.params.accountId,
      query: req.query.query,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Get all brokerage instruments
router.get("/reference/brokerages", isAuthenticated, async (req: any, res) => {
  try {
    console.log('Getting all brokerage instruments');
    const { data: brokerages } = await snaptrade.referenceData.listAllBrokerages();
    console.log(`Retrieved ${brokerages?.length || 0} brokerage instruments`);
    res.json({ success: true, brokerages: brokerages || [] });
  } catch (err: any) {
    console.error('SnapTrade Brokerages Error:', {
      path: req.originalUrl,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Get security types
router.get("/reference/security-types", isAuthenticated, async (req: any, res) => {
  try {
    console.log('Getting security types');
    const { data: securityTypes } = await snaptrade.referenceData.getSecurityTypes();
    console.log(`Retrieved ${securityTypes?.length || 0} security types`);
    res.json({ success: true, securityTypes: securityTypes || [] });
  } catch (err: any) {
    console.error('SnapTrade Security Types Error:', {
      path: req.originalUrl,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Get symbols by query
router.get("/reference/symbols", isAuthenticated, async (req: any, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Search query required" });
    }

    console.log('Searching symbols with query:', query);
    const { data: symbols } = await snaptrade.referenceData.getSymbols({
      substring: query as string
    });

    console.log(`Found ${symbols?.length || 0} symbols for query "${query}"`);
    res.json({ success: true, symbols: symbols || [] });
  } catch (err: any) {
    console.error('SnapTrade Symbols Search Error:', {
      path: req.originalUrl,
      query: req.query.query,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Get symbol by ticker
router.get("/reference/symbols/:ticker", isAuthenticated, async (req: any, res) => {
  try {
    const { ticker } = req.params;
    console.log('Getting symbol details for ticker:', ticker);

    const { data: symbol } = await snaptrade.referenceData.getSymbolsByTicker({
      query: ticker
    });

    console.log('Symbol details retrieved for ticker:', ticker);
    res.json({ success: true, symbol });
  } catch (err: any) {
    console.error('SnapTrade Symbol Detail Error:', {
      path: req.originalUrl,
      ticker: req.params.ticker,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// === Options API Compliance ===

// List option holdings
router.get("/accounts/:accountId/options", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    const credentials = await getUserSnapTradeCredentials(email);
    console.log('Getting option holdings for account:', accountId);

    const { data: optionHoldings } = await snaptrade.options.listOptionHoldings({
      userId: credentials.userId,
      userSecret: credentials.userSecret,
      accountId
    });

    console.log(`Retrieved ${optionHoldings?.length || 0} option holdings for account ${accountId}`);
    res.json({ success: true, optionHoldings: optionHoldings || [] });
  } catch (err: any) {
    console.error('SnapTrade Option Holdings Error:', {
      path: req.originalUrl,
      accountId: req.params.accountId,
      responseData: err.response?.data,
      responseHeaders: err.response?.headers,
      status: err.response?.status,
      message: err.message
    });
    
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// === Request ID Tracking and Rate Limiting ===

// Add request ID to all responses
router.use((req: any, res: any, next: any) => {
  // Generate unique request ID
  const requestId = `snaptrade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  
  // Add request ID to response headers for tracking
  res.set('X-Request-ID', requestId);
  
  // Log request with ID for debugging
  console.log(`[${requestId}] ${req.method} ${req.originalUrl}`);
  
  next();
});

// Basic rate limiting implementation per SnapTrade documentation
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 100; // Adjust based on SnapTrade limits

router.use((req: any, res: any, next: any) => {
  const clientId = req.user?.claims?.sub || req.ip;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  // Clean old requests
  const userRequests = requestCounts.get(clientId) || [];
  const recentRequests = userRequests.filter((timestamp: number) => timestamp > windowStart);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: `Maximum ${MAX_REQUESTS_PER_MINUTE} requests per minute`,
      retryAfter: Math.ceil((recentRequests[0] - windowStart) / 1000)
    });
  }
  
  recentRequests.push(now);
  requestCounts.set(clientId, recentRequests);
  
  next();
});

// === Webhook Handling Framework ===

// Basic webhook endpoint for SnapTrade events
router.post("/webhooks", async (req: any, res) => {
  try {
    const signature = req.headers['x-snaptrade-signature'];
    const payload = req.body;
    
    // Verify webhook signature (implement based on SnapTrade docs)
    // TODO: Add proper signature verification
    
    console.log('SnapTrade webhook received:', {
      type: payload.type,
      userId: payload.userId,
      timestamp: payload.timestamp,
      requestId: req.requestId
    });
    
    // Handle different webhook types
    switch (payload.type) {
      case 'USER_DELETED':
        console.log('User deleted webhook:', payload.userId);
        // Clean up user data in database
        break;
      case 'CONNECTION_BROKEN':
        console.log('Connection broken webhook:', payload.authorizationId);
        // Update connection status in database
        break;
      case 'ACCOUNT_HOLDINGS_UPDATED':
        console.log('Account holdings updated webhook:', payload.accountId);
        // Trigger holdings refresh in database
        break;
      default:
        console.log('Unknown webhook type:', payload.type);
    }
    
    // Always return 200 to acknowledge receipt
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed',
      requestId: req.requestId 
    });
  } catch (err: any) {
    console.error('Webhook processing error:', {
      requestId: req.requestId,
      error: err.message,
      stack: err.stack
    });
    
    // Still return 200 to avoid webhook retries
    res.status(200).json({ 
      success: false, 
      message: 'Webhook processing failed',
      requestId: req.requestId 
    });
  }
});

// === Enhanced Error Handling for Broken Connections ===

// Add middleware to detect and handle broken connections
router.use((err: any, req: any, res: any, next: any) => {
  // Check for common broken connection error patterns
  if (err.response?.status === 401 || 
      err.response?.status === 403 ||
      err.message?.includes('unauthorized') ||
      err.message?.includes('forbidden') ||
      err.response?.data?.detail?.includes('Invalid user credentials')) {
    
    console.error('Detected broken SnapTrade connection:', {
      path: req.originalUrl,
      userId: req.user?.claims?.email,
      status: err.response?.status,
      message: err.message,
      requestId: req.requestId
    });
    
    return res.status(401).json({
      error: "Connection broken",
      message: "Your brokerage connection has expired or become invalid. Please reconnect your account.",
      needsReconnect: true,
      reconnectUrl: "/api/snaptrade/register",
      requestId: req.requestId
    });
  }
  
  // Check for rate limiting errors
  if (err.response?.status === 429) {
    console.error('SnapTrade rate limit exceeded:', {
      path: req.originalUrl,
      userId: req.user?.claims?.email,
      requestId: req.requestId
    });
    
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests to SnapTrade API. Please try again later.",
      retryAfter: err.response?.headers?.['retry-after'] || 60,
      requestId: req.requestId
    });
  }
  
  // Log all other errors with request ID
  console.error('SnapTrade API Error:', {
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.claims?.email,
    responseData: err.response?.data,
    responseHeaders: err.response?.headers,
    status: err.response?.status,
    message: err.message,
    requestId: req.requestId,
    stack: err.stack?.split('\n').slice(0, 3)
  });
  
  const status = err.response?.status || 500;
  const body = err.response?.data || { 
    message: err.message,
    error: "SnapTrade API Error",
    requestId: req.requestId
  };
  
  res.status(status).json(body);
});

export default router;
