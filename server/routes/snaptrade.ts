// routes/snaptrade.ts

import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Validate environment variables
const clientId = process.env.SNAPTRADE_CLIENT_ID?.trim();
const consumerKey = process.env.SNAPTRADE_CLIENT_SECRET?.trim();

if (!clientId || !consumerKey) {
  throw new Error('Missing SnapTrade environment variables');
}

console.log('SnapTrade SDK Configuration:', {
  clientId: clientId,
  consumerKeyLength: consumerKey.length,
  consumerKeyStart: consumerKey.substring(0, 8) + '...',
});

// SDK Initialization (top of 'routes/snaptrade.ts'):
const snaptrade = new Snaptrade({
  clientId: clientId,
  consumerKey: consumerKey,
});

// --- DB helper functions ---
async function getUserByEmail(email: string) {
  // Get user from database - we need to query by email
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0];
}

async function saveSnaptradeCredentials(
  email: string,
  snaptradeUserId: string,
  userSecret: string,
) {
  const user = await getUserByEmail(email);
  if (user) {
    // Use the correct storage method
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
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// Debug endpoint for environment verification
router.get("/debug-env", async (req: any, res) => {
  const clientId = process.env.SNAPTRADE_CLIENT_ID?.trim();
  const consumerKey = process.env.SNAPTRADE_CLIENT_SECRET?.trim();
  
  return res.json({
    hasClientId: !!clientId,
    clientId: clientId || 'MISSING',
    hasConsumerKey: !!consumerKey,
    consumerKeyLength: consumerKey?.length || 0,
    consumerKeyPreview: consumerKey ? consumerKey.substring(0, 8) + '...' : 'MISSING',
    serverTimestamp: Math.floor(Date.now() / 1000),
    serverTime: new Date().toISOString()
  });
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
        status: registerError.response?.status,
        data: registerError.response?.data,
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
    console.error('SnapTrade API test failed:', err);
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

    // If missing credentials, register with SnapTrade
    if (!user.snaptradeUserId || !user.snaptradeUserSecret) {
      try {
        const { data } = await snaptrade.authentication.registerSnapTradeUser({
          userId: email,
        });
        await saveSnaptradeCredentials(email, data.userId!, data.userSecret!);
        user = await getUserByEmail(email);
      } catch (err: any) {
        // Enhanced error logging to capture response body
        console.error("🔴 SnapTrade registerSnapTradeUser full error:", {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          headers: err.response?.headers,
          message: err.message,
          config: {
            url: err.config?.url,
            method: err.config?.method,
            data: err.config?.data
          }
        });

        // Try to extract error response body
        let errorBody = null;
        if (err.response?.data) {
          errorBody = err.response.data;
        } else if (err.message && err.message.includes('RESPONSE HEADERS:')) {
          // Extract response body from error message if available
          console.log("🔴 Raw error message:", err.message);
        }
        
        // Handle USER_EXISTS and 1010 as "already registered"
        const errData = err.response?.data;
        if (
          errData?.code === "USER_EXISTS" ||
          errData?.code === "1010" ||
          /already exist/i.test(errData?.detail || errData?.message || "")
        ) {
          user = await getUserByEmail(email);
          if (!user?.snaptradeUserId || !user?.snaptradeUserSecret) {
            return res.status(409).json({
              error: "User already registered",
              details: "User exists in SnapTrade but credentials not found in database"
            });
          }
        } else {
          // Forward the actual error response
          const status = err.response?.status || 500;
          const body = err.response?.data || { 
            message: err.message,
            error: "SnapTrade API Error",
            details: errorBody
          };
          return res.status(status).json(body);
        }
      }
    }

    // Generate connection URL using stored credentials
    console.log('SnapTrade Register: Logging in user with credentials:', {
      userId: user.snaptradeUserId,
      userSecretLength: user.snaptradeUserSecret?.length
    });
    
    try {
      const { data: portal } = await snaptrade.authentication.loginSnapTradeUser({
        userId: user.snaptradeUserId!,
        userSecret: user.snaptradeUserSecret!,
      });
      
      console.log('SnapTrade Register: Portal response:', portal);
      return res.json({ url: (portal as any).redirectURI });
    } catch (loginErr: any) {
      console.error("🔴 SnapTrade loginSnapTradeUser error:", {
        status: loginErr.response?.status,
        data: loginErr.response?.data,
        headers: loginErr.response?.headers,
        message: loginErr.message
      });
      
      const status = loginErr.response?.status || 500;
      const body = loginErr.response?.data || { message: loginErr.message };
      return res.status(status).json(body);
    }
    
  } catch (err: any) {
    // Pass error to Express error handler middleware
    return next(err);
  }
});



// Add endpoints (or use existing) to:
// GET /api/snaptrade/accounts → call listUserAccounts
router.get("/accounts", isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }
    
    const user = await getUserByEmail(email);
    
    // Require that getUserByEmail(email) returns a non-null userSecret
    if (!user?.snaptradeUserSecret) {
      return res.status(401).json({ error: "Please connect your brokerage first" });
    }

    const { data } = await snaptrade.accountInformation.listUserAccounts({
      userId: user.snaptradeUserId!,
      userSecret: user.snaptradeUserSecret!,
    });
    
    return res.json(data);
  } catch (err: any) {
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// GET /api/snaptrade/holdings?accountId=... → call getUserHoldings
router.get("/holdings", isAuthenticated, async (req: any, res) => {
  try {
    const { accountId } = req.query;
    const email = req.user.claims.email?.toLowerCase();
    const user = await getUserByEmail(email);
    
    if (!user?.snaptradeUserId || !user?.snaptradeUserSecret) {
      return res.status(400).json({ error: "SnapTrade user not registered" });
    }

    const { data } = await snaptrade.accountInformation.getUserHoldings({
      userId: user.snaptradeUserId!,
      userSecret: user.snaptradeUserSecret!,
      accountId: accountId as string,
    });
    
    return res.json(data);
  } catch (err: any) {
    const status = err.response?.status || 500;
    const body = err.response?.data || { message: err.message };
    return res.status(status).json(body);
  }
});

// --- (Optional) Fuzzy Search Endpoint ---
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
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// Add Express error handler middleware at the bottom of the file:
router.use((err: any, req: any, res: any, next: any) => {
  console.error("🔴 SnapTrade Express error handler:", {
    url: req.url,
    method: req.method,
    status: err.response?.status,
    data: err.response?.data,
    headers: err.response?.headers,
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3) // First 3 lines of stack trace
  });
  
  const status = err.response?.status || 500;
  const body = err.response?.data || { message: err.message };
  res.status(status).json(body);
});

export default router;
