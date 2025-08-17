import { Router } from "express";
import { authApi } from "../lib/snaptrade";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// SnapTrade debug configuration route  
router.get('/debug-config', isAuthenticated, async (req: any, res) => {
  try {
    // Use centralized SnapTrade SDK configuration
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
    
    res.json({
      clientId: clientId || 'missing',
      consumerKey: consumerKey ? 'loaded' : 'missing',
      baseUrl: 'https://api.snaptrade.com/api/v1',
      sdkConfigured: !!authApi,
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