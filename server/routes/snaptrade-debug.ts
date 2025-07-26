import { Router } from "express";
import { Snaptrade } from "snaptrade-typescript-sdk";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// SnapTrade debug configuration route  
router.get('/debug-config', isAuthenticated, async (req: any, res) => {
  try {
    // Instantiate SnapTrade SDK with process.env keys
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CLIENT_SECRET;
    
    let testClient = null;
    let initError = null;
    
    try {
      testClient = new Snaptrade({
        clientId: clientId || '',
        consumerKey: consumerKey || '',
      });
    } catch (error: any) {
      initError = error.message;
    }
    
    res.json({
      clientId: clientId || 'missing',
      consumerKey: consumerKey ? 'loaded' : 'missing',
      baseUrl: 'https://api.snaptrade.com/api/v1',
      initError: initError,
      envVarLengths: {
        clientId: clientId?.length || 0,
        consumerKey: consumerKey?.length || 0
      }
    });
    
  } catch (error: any) {
    res.status(500).json({
      error: 'Debug config failed',
      details: error.message
    });
  }
});

export default router;