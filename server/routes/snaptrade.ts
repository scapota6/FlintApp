import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Initialize SnapTrade SDK
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

// SnapTrade user registration with correct parameter structure
router.post('/register', isAuthenticated, async (req: any, res) => {
  try {
    if (!snapTradeClient) {
      return res.status(502).json({ 
        error: "SnapTrade not configured", 
        details: "SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET environment variables required" 
      });
    }

    const flintUserId = req.user.claims.sub;
    const userEmail = req.user.claims.email?.toLowerCase();
    
    if (!userEmail) {
      return res.status(400).json({ 
        error: "User email required", 
        details: "User email is required for SnapTrade registration" 
      });
    }

    // Check DB for existing snaptradeUserId/Secret
    const existingUser = await storage.getSnapTradeUser(flintUserId);
    if (existingUser && existingUser.snaptradeUserId && existingUser.userSecret) {
      console.log('SnapTrade user already registered:', existingUser.snaptradeUserId);
      return res.json({ 
        registered: true,
        userId: existingUser.snaptradeUserId 
      });
    }

    console.log('Registering SnapTrade user with email:', userEmail);

    try {
      // Use exact specification from user
      const { data } = await snapTradeClient.authentication.registerSnapTradeUser({
        snapTradeRegisterUserRequestBody: { userId: userEmail }
      });

      console.log('SnapTrade registration response received:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
      });

      // Save data.userId and data.userSecret to PostgreSQL
      await storage.createSnapTradeUser(flintUserId, data.userId, data.userSecret);
      
      console.log('SnapTrade user registered and saved successfully:', data.userId);
      
      // Return JSON { registered: true, userId: data.userId }
      res.json({
        registered: true,
        userId: data.userId
      });

    } catch (snapTradeError: any) {
      console.error('SnapTrade registration failed with detailed error:');
      console.error('Error message:', snapTradeError.message);
      console.error('Error response data:', JSON.stringify(snapTradeError.response?.data, null, 2));
      
      // On error, return 502 with err.response.data or err.message
      return res.status(502).json(snapTradeError.response?.data || { message: snapTradeError.message });
    }

  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

// SnapTrade connection URL generator
router.get('/connect-url', isAuthenticated, async (req: any, res) => {
  try {
    if (!snapTradeClient) {
      return res.status(502).json({ 
        error: "SnapTrade not configured", 
        details: "SNAPTRADE_CLIENT_ID and SNAPTRADE_CLIENT_SECRET environment variables required" 
      });
    }

    const flintUserId = req.user.claims.sub;
    const userEmail = req.user.claims.email?.toLowerCase();
    
    if (!userEmail) {
      return res.status(400).json({ 
        error: "User email required", 
        details: "User email is required for SnapTrade operations" 
      });
    }

    // First call the same registration logic (or hit /register internally)
    let snapTradeUser = await storage.getSnapTradeUser(flintUserId);
    let savedUserId = snapTradeUser?.snaptradeUserId;
    let savedUserSecret = snapTradeUser?.userSecret;

    // If missing credentials, register the user first
    if (!savedUserId || !savedUserSecret) {
      console.log('SnapTrade credentials missing, registering user:', userEmail);
      
      try {
        const { data } = await snapTradeClient.authentication.registerSnapTradeUser({
          snapTradeRegisterUserRequestBody: { userId: userEmail }
        });

        await storage.createSnapTradeUser(flintUserId, data.userId, data.userSecret);
        
        savedUserId = data.userId;
        savedUserSecret = data.userSecret;
        
        console.log('SnapTrade user registered successfully for connect-url:', savedUserId);

      } catch (snapTradeError: any) {
        console.error('Connect-URL: SnapTrade registration failed:', snapTradeError.message);
        return res.status(502).json(snapTradeError.response?.data || { message: snapTradeError.message });
      }
    }

    // Retrieve saved snaptradeUserId and snaptradeUserSecret from DB
    const frontendCallbackUrl = `https://${req.get('host')}/dashboard?connected=snaptrade`;
    
    console.log('Generating SnapTrade connection URL for user:', savedUserId);
    console.log('Frontend callback URL:', frontendCallbackUrl);

    try {
      // Call snaptrade.authentication.loginSnapTradeUser with correct parameters
      const connectResponse = await snapTradeClient.authentication.loginSnapTradeUser({
        userId: savedUserId!,
        userSecret: savedUserSecret!,
        broker: undefined,
        immediateRedirect: true,
        customRedirect: frontendCallbackUrl,
        connectionType: 'read'
      });
      
      console.log('SnapTrade connect response status:', connectResponse.status);
      console.log('SnapTrade connect response data structure:', Object.keys(connectResponse.data || {}));

      const responseData = connectResponse.data;
      console.log('Full SnapTrade response data:', JSON.stringify(responseData, null, 2));
      
      // Return JSON { url: data.url } (or redirectURI)
      if (responseData && typeof responseData === 'object' && 'redirectURI' in responseData) {
        const connectionUrl = (responseData as any).redirectURI;
        console.log('Returning connection URL:', connectionUrl);
        res.json({ url: connectionUrl });
      } else {
        console.error('No redirectURI found in response:', responseData);
        throw new Error('No redirectURI in SnapTrade response');
      }

    } catch (snapTradeError: any) {
      console.error('SnapTrade URL generation failed:', snapTradeError);
      // On error, return 502 with details
      return res.status(502).json(snapTradeError.response?.data || { message: snapTradeError.message });
    }

  } catch (error: any) {
    console.error("Connection URL error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
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