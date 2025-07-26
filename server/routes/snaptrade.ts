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

// SnapTrade user registration with robust error handling
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
    if (existingUser && existingUser.snaptradeUserId && existingUser.userSecret && !existingUser.userSecret.startsWith('secret_')) {
      console.log('SnapTrade user already registered:', existingUser.snaptradeUserId);
      return res.json({ 
        success: true, 
        message: 'User already registered', 
        userId: existingUser.snaptradeUserId 
      });
    }

    console.log('Registering SnapTrade user with email:', userEmail);

    try {
      // Use correct SDK method: authentication.registerSnapTradeUser with proper structure
      console.log('Calling SnapTrade authentication.registerSnapTradeUser with userId:', userEmail);
      
      const registrationResponse = await snapTradeClient.authentication.registerSnapTradeUser({
        userId: userEmail
      });

      console.log('SnapTrade registration response received:', {
        status: registrationResponse.status,
        hasData: !!registrationResponse.data,
        dataKeys: registrationResponse.data ? Object.keys(registrationResponse.data) : []
      });

      const { userId, userSecret } = registrationResponse.data;
      
      if (!userId || !userSecret) {
        console.error('Invalid registration response structure:', registrationResponse.data);
        throw new Error('Invalid registration response from SnapTrade - missing userId or userSecret');
      }

      // Save both userId and userSecret to PostgreSQL
      await storage.createSnapTradeUser(flintUserId, userId, userSecret);
      
      console.log('SnapTrade user registered and saved successfully:', userId);
      
      res.json({
        success: true,
        message: "Successfully registered with SnapTrade",
        userId: userId
      });

    } catch (snapTradeError: any) {
      // Always log the full error from SnapTrade (err.response.data)
      console.error('SnapTrade registration failed with detailed error:');
      console.error('Error message:', snapTradeError.message);
      console.error('Error response data:', JSON.stringify(snapTradeError.response?.data, null, 2));
      console.error('Error status:', snapTradeError.response?.status);
      console.error('Error headers:', JSON.stringify(snapTradeError.response?.headers, null, 2));
      
      // Return the full err.response.data if it fails, so we see the exact cause
      const fullErrorData = snapTradeError.response?.data || { message: snapTradeError.message };
      return res.status(502).json({ 
        error: 'SnapTrade registration failed', 
        details: fullErrorData,
        fullResponse: snapTradeError.response?.data,
        debug: {
          message: snapTradeError.message,
          status: snapTradeError.response?.status,
          url: snapTradeError.config?.url,
          method: snapTradeError.config?.method
        }
      });
    }

  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

// SnapTrade connection URL generator with registration and robust error handling
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

    // First ensure registration (call the same registration logic)
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
        // Use correct SDK method: authentication.registerSnapTradeUser with proper structure
        console.log('Connect-URL: Calling SnapTrade authentication.registerSnapTradeUser with userId:', userEmail);
        
        const registrationResponse = await snapTradeClient.authentication.registerSnapTradeUser({
          userId: userEmail
        });

        const { userId, userSecret } = registrationResponse.data;
        
        if (!userId || !userSecret) {
          throw new Error('Invalid registration response from SnapTrade');
        }

        // Save credentials to database
        await storage.createSnapTradeUser(flintUserId, userId, userSecret);
        
        savedUserId = userId;
        savedUserSecret = userSecret;
        
        console.log('SnapTrade user registered successfully:', savedUserId);

      } catch (snapTradeError: any) {
        // Always log the error from SnapTrade (err.response.data)
        console.error('Connect-URL: SnapTrade registration failed:', snapTradeError.message);
        console.error('Connect-URL: Full error response data:', JSON.stringify(snapTradeError.response?.data, null, 2));
        
        const errorDetails = snapTradeError.response?.data || snapTradeError.message || 'Unknown SnapTrade error';
        return res.status(502).json({ 
          error: 'SnapTrade registration failed', 
          details: errorDetails,
          fullResponse: snapTradeError.response?.data
        });
      }
    }

    // Then load saved userId/userSecret from DB and generate connection URL
    const frontendCallbackUrl = `https://${req.get('host')}/dashboard?connected=true`;
    
    console.log('Generating SnapTrade connection URL for user:', savedUserId);

    try {
      // Call SnapTrade login method for connection URL using correct SDK interface
      const connectResponse = await snapTradeClient.authentication.loginSnapTradeUser({
        userId: savedUserId!,
        userSecret: savedUserSecret!,
        broker: undefined,
        immediateRedirect: true,
        customRedirect: frontendCallbackUrl,
        connectionType: 'read'
      });

      console.log('SnapTrade connection URL generated successfully');
      
      // Return JSON { url } - the response should contain redirectURI
      const responseData = connectResponse.data;
      if (responseData && typeof responseData === 'object' && 'redirectURI' in responseData) {
        res.json({ url: (responseData as any).redirectURI });
      } else {
        throw new Error('No redirectURI in SnapTrade response');
      }

    } catch (snapTradeError: any) {
      console.error('SnapTrade URL generation failed:', snapTradeError);
      const errorDetails = snapTradeError.response?.data || snapTradeError.message || 'Unknown SnapTrade error';
      return res.status(502).json({ 
        error: 'SnapTrade URL generation failed', 
        details: errorDetails
      });
    }

  } catch (error: any) {
    console.error("Connection URL error:", error);
    res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

export default router;