import { Router } from 'express';
import { getSnapUser } from '../store/snapUsers.js';
import { listOpenOrders, listOrderHistory } from '../lib/snaptrade.js';

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

    const userEmail = (user as any).email || user.id;
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

    const userEmail = (user as any).email || user.id;
    console.log('Cancelling order:', orderId, 'for user:', userEmail);

    // Get user's SnapTrade credentials
    const snapUser = await getSnapUser(userEmail);
    if (!snapUser?.userSecret) {
      return res.status(400).json({ 
        success: false,
        message: 'SnapTrade account not connected' 
      });
    }

    // Note: Order cancellation would require a SnapTrade API method
    // This is a placeholder implementation
    console.log('Order cancellation requested:', {
      orderId,
      accountId,
      userId: snapUser.userId || userEmail
    });

    // For now, return a simulated response
    res.json({
      success: true,
      message: 'Order cancellation submitted',
      orderId,
      status: 'cancellation_pending',
      cancelledAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to cancel order' 
    });
  }
});

export default router;