import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Initialize SnapTrade SDK
let snapTradeClient: Snaptrade | null = null;
if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY) {
  console.log('Initializing SnapTrade SDK with clientId:', process.env.SNAPTRADE_CLIENT_ID);
  
  try {
    snapTradeClient = new Snaptrade({
      clientId: process.env.SNAPTRADE_CLIENT_ID!,
      consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
    });
    console.log('SnapTrade SDK initialized successfully');
  } catch (error) {
    console.error('Failed to initialize SnapTrade SDK:', error);
  }
} else {
  console.log('SnapTrade environment variables missing - SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY required');
}

// SnapTrade user registration with proper error handling
router.post("/register", isAuthenticated, async (req: any, res, next) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    const flintUserId = req.user.claims.sub;
    
    if (!email) {
      return res.status(400).json({ error: "User email required" });
    }

    // Check if already registered
    const existingUser = await storage.getSnapTradeUser(flintUserId);
    if (existingUser && existingUser.snaptradeUserId && existingUser.userSecret) {
      return res.json({ registered: true, userId: existingUser.snaptradeUserId });
    }

    // SnapTrade call with error handling
    const { data } = await snapTradeClient!.authentication.registerSnapTradeUser({
      userId: email
    });

    // Save plaintext secret
    await storage.createSnapTradeUser(flintUserId, data.userId!, data.userSecret!);

    // Return success
    return res.json({ registered: true, userId: data.userId });
  } catch (error: any) {
    console.error("SnapTrade registration error:", error);
    
    // Handle the case where user already exists
    if (error.responseBody && error.responseBody.detail && error.responseBody.detail.includes("already exist")) {
      console.log("User already exists in SnapTrade, fetching existing user...");
      
      try {
        // Try to find existing user in our storage first
        const flintUserId = req.user.claims.sub;
        const existingUser = await storage.getSnapTradeUser(flintUserId);
        
        if (existingUser && existingUser.snaptradeUserId) {
          return res.json({ registered: true, userId: existingUser.snaptradeUserId });
        }
        
        // If not in our storage, return error asking to use fresh account
        return res.status(409).json({ 
          error: "User already registered", 
          message: "This email is already registered with SnapTrade. Please use the 'Fresh Account' option to create a new account.",
          code: "USER_EXISTS"
        });
      } catch (storageError) {
        console.error("Error checking existing user:", storageError);
        return res.status(500).json({ error: "Failed to check existing registration" });
      }
    }
    
    // Handle other errors
    return res.status(500).json({ 
      error: "Registration failed", 
      message: error.message || "Unknown error occurred",
      details: error.responseBody || error
    });
  }
});

// SnapTrade connection URL generator
router.get("/connect-url", isAuthenticated, async (req: any, res) => {
  try {
    if (!snapTradeClient) {
      return res.status(502).json({ 
        error: "SnapTrade not configured", 
        details: "SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY environment variables required" 
      });
    }

    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ 
        error: "User email required", 
        details: "User email is required for SnapTrade operations" 
      });
    }

    // Ensure registration first
    const flintUserId = req.user.claims.sub;
    let snapTradeUser = await storage.getSnapTradeUser(flintUserId);
    
    if (!snapTradeUser?.snaptradeUserId) {
      // Register user first with error handling
      try {
        const { data } = await snapTradeClient.authentication.registerSnapTradeUser({
          userId: email
        });
        await storage.createSnapTradeUser(flintUserId, data.userId!, data.userSecret!);
        snapTradeUser = { snaptradeUserId: data.userId!, userSecret: data.userSecret! };
      } catch (regError: any) {
        // Handle case where user already exists
        if (regError.responseBody && regError.responseBody.detail && regError.responseBody.detail.includes("already exist")) {
          return res.status(409).json({
            error: "User already registered",
            message: "This email is already registered with SnapTrade. Please contact support to link your existing account.",
            code: "USER_EXISTS"
          });
        }
        throw regError; // Re-throw other errors to be caught by outer try-catch
      }
    }

    // Minimal SDK call—no redirect params
    console.log("SnapTrade login payload:", { 
      userId: snapTradeUser.snaptradeUserId, 
      userSecret: snapTradeUser.userSecret 
    });
    
    const { data } = await snapTradeClient.authentication.loginSnapTradeUser({
      userId: snapTradeUser.snaptradeUserId!, 
      userSecret: snapTradeUser.userSecret!
    });

    // data.redirectURI is the connection URL
    return res.json({ url: (data as any).redirectURI });
  } catch (err: any) {
    console.error("SnapTrade connect-url error:", err.response?.data || err);
    console.error("Request config:", err.config);
    console.error("Response data:", err.response?.data);
    return res.status(502).json({
      error: "SnapTrade URL generation failed",
      details: err.response?.data || err.message,
    });
  }
});

// SnapTrade search endpoint (existing functionality)
router.get('/search', isAuthenticated, async (req: any, res) => {
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
      { symbol: 'NFLX', name: 'Netflix Inc.', price: 492.80, changePercent: 1.1, volume: 18000000 }
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
      // Company name starts with query
      else if (nameLower.startsWith(queryLower)) score += 700;
      // Any word in company name starts with query
      const nameWords = nameLower.split(' ');
      if (nameWords.some(word => word.startsWith(queryLower))) score += 500;
      // Company name contains query anywhere
      else if (nameLower.includes(queryLower)) score += 300;
      
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
    console.error("Search error:", error);
    res.status(500).json({ 
      error: "Search failed",
      details: error.message 
    });
  }
});

export default router;