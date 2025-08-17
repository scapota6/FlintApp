import { Router } from 'express';
import { getSnapUser } from '../store/snapUsers.js';
import { listOpenOrders, listOrderHistory, cancelOrder, getOrderStatus } from '../lib/snaptrade.js';

const router = Router();

// Get orders for an account
router.get('/', async (req, res) => {
  try {
    const user = req.user!;
    const { accountId, days = '7' } = req.query;

    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account ID is required' 
      });
    }

    const userEmail = (user as any).email || (user as any).id;
    console.log('Fetching orders for user:', userEmail, 'account:', accountId);

    // Get user's SnapTrade credentials
    const snapUser = await getSnapUser(userEmail);
    if (!snapUser?.userSecret) {
      return res.status(400).json({ 
        success: false,
        message: 'SnapTrade account not connected' 
      });
    }

    // Fetch both open orders and order history in parallel
    const [openOrders, orderHistory] = await Promise.all([
      listOpenOrders(snapUser.userId || userEmail, snapUser.userSecret, accountId as string),
      listOrderHistory(snapUser.userId || userEmail, snapUser.userSecret, accountId as string)
    ]);

    console.log('Orders fetched:', {
      openOrders: openOrders?.length || 0,
      orderHistory: orderHistory?.length || 0
    });

    // Combine and format orders
    const allOrders = [
      ...(openOrders || []).map((order: any) => ({ ...order, type: 'open' })),
      ...(orderHistory || []).map((order: any) => ({ ...order, type: 'history' }))
    ];

    // Sort by timestamp (most recent first)
    allOrders.sort((a, b) => {
      const timeA = new Date(a.time || a.timestamp || a.created_at || 0).getTime();
      const timeB = new Date(b.time || b.timestamp || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    // Filter by days if specified
    const dayLimit = parseInt(days as string);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dayLimit);

    const filteredOrders = allOrders.filter(order => {
      const orderTime = new Date(order.time || order.timestamp || order.created_at || 0);
      return orderTime >= cutoffDate;
    });

    res.json({
      success: true,
      orders: filteredOrders,
      metadata: {
        totalCount: filteredOrders.length,
        openCount: filteredOrders.filter(o => o.type === 'open').length,
        closedCount: filteredOrders.filter(o => o.type === 'history').length,
        dayLimit,
        accountId,
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch orders' 
    });
  }
});

// Cancel an order
router.delete('/:orderId', async (req, res) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account ID is required' 
      });
    }

    const userEmail = (user as any).email || (user as any).id;
    console.log('Cancelling order:', orderId, 'for user:', userEmail);

    // Get user's SnapTrade credentials
    const snapUser = await getSnapUser(userEmail);
    if (!snapUser?.userSecret) {
      return res.status(400).json({ 
        success: false,
        message: 'SnapTrade account not connected' 
      });
    }

    try {
      // Attempt to cancel the order through SnapTrade
      const cancelResult = await cancelOrder(
        snapUser.userId || userEmail,
        snapUser.userSecret,
        accountId,
        orderId
      );

      console.log('Order cancellation successful:', {
        orderId: orderId.slice(-6),
        status: cancelResult?.status
      });

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        orderId,
        status: cancelResult?.status || 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelData: cancelResult
      });

    } catch (cancelError: any) {
      console.error('Order cancellation failed:', cancelError.message);

      // Handle specific cancellation error cases with proper HTTP status codes
      if (cancelError.message === 'BROKERAGE_CANCEL_NOT_SUPPORTED') {
        return res.status(501).json({
          success: false,
          error: 'NOT_IMPLEMENTED',
          message: 'Order cancellation is not supported by this brokerage',
          orderId,
          brokerageName: 'Unknown' // Could be enhanced to include actual brokerage name
        });
      }

      if (cancelError.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: 'Order not found or already processed',
          orderId
        });
      }

      if (cancelError.message === 'ORDER_ALREADY_FILLED') {
        return res.status(409).json({
          success: false,
          error: 'ORDER_ALREADY_FILLED',
          message: 'Cannot cancel order - already executed',
          orderId
        });
      }

      // Generic cancellation failure
      throw cancelError;
    }

  } catch (error: any) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to cancel order' 
    });
  }
});

// Get specific order status
router.get('/:orderId', async (req, res) => {
  try {
    const user = req.user!;
    const { orderId } = req.params;
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account ID is required' 
      });
    }

    const userEmail = (user as any).email || (user as any).id;
    console.log('Fetching order status:', orderId.slice(-6), 'for user:', userEmail);

    // Get user's SnapTrade credentials
    const snapUser = await getSnapUser(userEmail);
    if (!snapUser?.userSecret) {
      return res.status(400).json({ 
        success: false,
        message: 'SnapTrade account not connected' 
      });
    }

    try {
      // Fetch the specific order status
      const orderStatus = await getOrderStatus(
        snapUser.userId || userEmail,
        snapUser.userSecret,
        accountId as string,
        orderId
      );

      console.log('Order status fetched:', {
        orderId: orderId.slice(-6),
        status: orderStatus?.status
      });

      res.json({
        success: true,
        order: orderStatus,
        metadata: {
          orderId,
          accountId,
          fetchedAt: new Date().toISOString(),
          userEmail
        }
      });

    } catch (statusError: any) {
      console.error('Order status fetch failed:', statusError.message);

      if (statusError.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: 'Order not found',
          orderId
        });
      }

      throw statusError;
    }

  } catch (error: any) {
    console.error('Error fetching order status:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch order status' 
    });
  }
});

export default router;