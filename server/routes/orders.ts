import { Router } from 'express';
import { z } from 'zod';
import { authApi, accountsApi } from '../lib/snaptrade';
import { storage } from '../storage';

const router = Router();

// Order placement schema
const placeOrderSchema = z.object({
  accountId: z.string(),
  symbol: z.string(),
  action: z.enum(['buy', 'sell']),
  orderType: z.enum(['market', 'limit']),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok']).default('day'),
});

// Place an order
router.post('/orders', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const data = placeOrderSchema.parse(req.body);
    const user = req.user!;

    console.log('Placing order for user:', user.email);
    console.log('Order details:', data);

    // Get user's SnapTrade credentials
    const userSecret = await storage.getUserSecret(user.id, 'snaptrade');
    if (!userSecret) {
      return res.status(400).json({ 
        message: 'SnapTrade account not connected. Please connect your brokerage account first.' 
      });
    }

    // Verify account belongs to user
    const accounts = await snaptrade.accountInformation.listUserAccounts({
      userId: user.email,
      userSecret,
    });

    const account = accounts.data.find(acc => acc.id === data.accountId);
    if (!account) {
      return res.status(403).json({ 
        message: 'Invalid account or account not found' 
      });
    }

    // Get symbol ID from SnapTrade
    const symbolSearchResults = await snaptrade.referenceData.symbolsSearchUserAccount({
      userId: user.email,
      userSecret,
      accountId: data.accountId,
      query: data.symbol,
    });

    if (!symbolSearchResults.data || symbolSearchResults.data.length === 0) {
      return res.status(404).json({ 
        message: `Symbol ${data.symbol} not found or not tradable in this account` 
      });
    }

    const symbolId = symbolSearchResults.data[0].id;

    // Prepare order parameters
    const orderParams: any = {
      userId: user.email,
      userSecret,
      accountId: data.accountId,
      action: data.action.toUpperCase(),
      orderType: data.orderType === 'market' ? 'Market' : 'Limit',
      quantity: data.quantity,
      symbolId,
      timeInForce: data.timeInForce.toUpperCase(),
    };

    // Add limit price for limit orders
    if (data.orderType === 'limit' && data.limitPrice) {
      orderParams.price = data.limitPrice;
    }

    // Place the order
    console.log('Placing order with params:', { ...orderParams, userSecret: '[HIDDEN]' });
    
    const orderResponse = await snaptrade.trading.placeOrder(orderParams);

    // Log activity
    await storage.logActivity(user.id, 'trade', {
      action: data.action,
      symbol: data.symbol,
      quantity: data.quantity,
      orderType: data.orderType,
      price: data.limitPrice || 'market',
      accountId: data.accountId,
      orderId: orderResponse.data?.orderId,
    });

    console.log('Order placed successfully:', orderResponse.data);

    res.json({
      success: true,
      orderId: orderResponse.data?.orderId,
      message: `${data.action} order for ${data.quantity} shares of ${data.symbol} placed successfully`,
      details: orderResponse.data,
    });

  } catch (error: any) {
    console.error('Error placing order:', error);
    
    // Handle SnapTrade specific errors
    if (error.response?.data) {
      const errorData = error.response.data;
      console.error('SnapTrade error details:', errorData);
      
      return res.status(error.response.status || 400).json({
        message: errorData.detail || errorData.message || 'Failed to place order',
        error: errorData,
      });
    }

    res.status(500).json({ 
      message: 'Failed to place order',
      error: error.message,
    });
  }
});

// Get order history
router.get('/orders', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = req.user!;
    const { accountId, status, days = 30 } = req.query;

    // Get user's SnapTrade credentials
    const userSecret = await storage.getUserSecret(user.id, 'snaptrade');
    if (!userSecret) {
      return res.status(400).json({ 
        message: 'SnapTrade account not connected' 
      });
    }

    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    // Get orders from SnapTrade
    const params: any = {
      userId: user.email,
      userSecret,
      startDate,
      endDate,
    };

    if (accountId) {
      params.accountId = accountId as string;
    }

    if (status) {
      params.status = status as string;
    }

    const ordersResponse = await snaptrade.transactionsAndReporting.getActivities(params);

    // Filter for order activities
    const orders = ordersResponse.data.filter(
      activity => activity.type === 'ORDER' || activity.type === 'TRADE'
    );

    res.json({
      orders,
      count: orders.length,
      period: { startDate, endDate },
    });

  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      message: 'Failed to fetch order history',
      error: error.message,
    });
  }
});

// Cancel an order
router.delete('/orders/:orderId', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = req.user!;
    const { orderId } = req.params;
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ 
        message: 'Account ID is required' 
      });
    }

    // Get user's SnapTrade credentials
    const userSecret = await storage.getUserSecret(user.id, 'snaptrade');
    if (!userSecret) {
      return res.status(400).json({ 
        message: 'SnapTrade account not connected' 
      });
    }

    // Cancel the order
    const cancelResponse = await snaptrade.trading.cancelOrder({
      userId: user.email,
      userSecret,
      accountId,
      orderId,
    });

    // Log activity
    await storage.logActivity(user.id, 'cancel_order', {
      orderId,
      accountId,
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      details: cancelResponse.data,
    });

  } catch (error: any) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      message: 'Failed to cancel order',
      error: error.message,
    });
  }
});

export default router;