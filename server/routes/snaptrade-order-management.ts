import { Router } from "express";
import { Snaptrade } from 'snaptrade-typescript-sdk';
import { v4 as uuidv4 } from 'uuid';
import { unifiedMarketDataService } from '../services/market-data-unified';

const router = Router();

// Initialize SnapTrade client
let snapTradeClient: Snaptrade | null = null;

if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CLIENT_SECRET) {
  snapTradeClient = new Snaptrade({
    clientId: process.env.SNAPTRADE_CLIENT_ID,
    consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
  });
}

// Enhanced order placement with UUID tracking and live pricing
router.post('/place-order', async (req, res) => {
  try {
    if (!snapTradeClient) {
      return res.status(500).json({ error: 'SnapTrade client not initialized' });
    }

    const { accountId, symbol, quantity, action, orderType } = req.body;

    // Validate required fields
    if (!accountId || !symbol || !quantity || !action || !orderType) {
      return res.status(400).json({ 
        error: 'Missing required fields: accountId, symbol, quantity, action, orderType' 
      });
    }

    // Generate UUID v4 for this trade
    const tradeId = uuidv4();

    // Fetch latest price via unified market data service
    const latestQuote = await unifiedMarketDataService.getMarketData(symbol);
    const currentPrice = latestQuote?.price || 0;

    if (!currentPrice) {
      return res.status(400).json({ 
        error: `Unable to fetch current price for ${symbol}` 
      });
    }

    // Test credentials (in production these would come from user session)
    const userId = 'scapota@flint-investing.com';
    const userSecret = 'test_secret'; // This should come from database

    try {
      // Place order using SnapTrade API with live pricing
      const orderResponse = await snapTradeClient.trading.placeForceOrder({
        userId: userId,
        userSecret: userSecret,
        accountId,
        action: action.toUpperCase(),
        orderType: orderType,
        symbol: symbol.toUpperCase(),
        units: quantity,
        price: orderType === 'Market' ? undefined : currentPrice,
        timeInForce: 'DAY'
      });

      res.json({
        success: true,
        tradeId,
        orderId: orderResponse.data?.id,
        symbol: symbol.toUpperCase(),
        quantity,
        action: action.toUpperCase(),
        orderType,
        price: currentPrice,
        estimatedValue: currentPrice * quantity,
        status: 'submitted',
        message: `${action.toUpperCase()} order for ${quantity} shares of ${symbol} submitted successfully`,
      });

    } catch (snapError: any) {
      // Handle 403/401 errors by attempting credential refresh
      if (snapError.response?.status === 403 || snapError.response?.status === 401) {
        console.log('Attempting to refresh SnapTrade credentials...');
        
        try {
          // Re-register and retry once
          const registerResponse = await snapTradeClient.authentication.registerSnapTradeUser({
            userId: userId,
          });
          
          if (registerResponse.data?.userSecret) {
            // Retry the order with new credentials
            const retryResponse = await snapTradeClient.trading.placeForceOrder({
              userId: userId,
              userSecret: registerResponse.data.userSecret,
              accountId,
              action: action.toUpperCase(),
              orderType: orderType,
              symbol: symbol.toUpperCase(),
              units: quantity,
              price: orderType === 'Market' ? undefined : currentPrice,
              timeInForce: 'DAY'
            });

            return res.json({
              success: true,
              tradeId,
              orderId: retryResponse.data?.id,
              symbol: symbol.toUpperCase(),
              quantity,
              action: action.toUpperCase(),
              orderType,
              price: currentPrice,
              estimatedValue: currentPrice * quantity,
              status: 'submitted',
              message: `${action.toUpperCase()} order for ${quantity} shares of ${symbol} submitted successfully (after credential refresh)`,
            });
          }
        } catch (retryError) {
          console.error('Credential refresh failed:', retryError);
        }
      }

      throw snapError;
    }

  } catch (error: any) {
    console.error('Order placement error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to place order',
      tradeId: req.body.tradeId || null,
    });
  }
});

// Get order history with proper error handling
router.get('/orders/history', async (req, res) => {
  try {
    if (!snapTradeClient) {
      return res.status(500).json({ error: 'SnapTrade client not initialized' });
    }

    const userId = 'scapota@flint-investing.com';
    const userSecret = 'test_secret';

    const activitiesResponse = await snapTradeClient.accountInformation.getAccountActivities({
      userId,
      userSecret,
    });

    // Filter for trading activities
    const tradingActivities = (activitiesResponse.data || []).filter((activity: any) => 
      ['BUY', 'SELL', 'OPTION_BUY', 'OPTION_SELL'].includes(activity.action)
    );

    res.json({
      success: true,
      orders: tradingActivities,
      count: tradingActivities.length,
    });

  } catch (error: any) {
    console.error('Order history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch order history',
    });
  }
});

export default router;