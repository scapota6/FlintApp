import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getSnapUser } from '../store/snapUsers.js';
import { getOrderImpact, searchSymbols, placeOrder } from '../lib/snaptrade.js';

const router = Router();

// Validation schemas
const OrderPreviewSchema = z.object({
  accountId: z.string(),
  symbol: z.string(),
  action: z.enum(['BUY', 'SELL']),
  orderType: z.enum(['Market', 'Limit']),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  timeInForce: z.enum(['Day', 'GTC', 'IOC', 'FOK']).optional().default('Day'),
});

const ConfirmOrderSchema = z.object({
  accountId: z.string(),
  symbol: z.string(),
  action: z.enum(['BUY', 'SELL']),
  orderType: z.enum(['Market', 'Limit']),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  timeInForce: z.enum(['Day', 'GTC', 'IOC', 'FOK']).optional().default('Day'),
  universalSymbolId: z.string(),
  previewData: z.object({
    estimatedCost: z.number(),
    estimatedFees: z.number(),
    estimatedTotal: z.number(),
    impactPrice: z.number().optional(),
    previewId: z.string().optional(),
  }),
});

/**
 * POST /api/order-preview
 * Preview an order before placement - Step 1 of SnapTrade's two-step process
 */
router.post('/', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = req.user!;
    const data = OrderPreviewSchema.parse(req.body);

    const userEmail = (user as any).email || user.id;
    console.log('Order preview request for user:', userEmail);
    console.log('Preview details:', data);

    // Get user's SnapTrade credentials
    const snapUser = await getSnapUser(userEmail);
    if (!snapUser?.userSecret) {
      return res.status(400).json({ 
        message: 'SnapTrade account not connected. Please connect your brokerage account first.' 
      });
    }

    // Search for the symbol to get universal symbol ID
    const symbols = await searchSymbols(snapUser.userId || userEmail, snapUser.userSecret, data.accountId, data.symbol);
    if (!symbols || symbols.length === 0) {
      return res.status(404).json({ 
        message: `Symbol ${data.symbol} not found or not tradable in this account` 
      });
    }

    const universalSymbolId = symbols[0].id;
    const symbolInfo = symbols[0];

    // Get order impact from SnapTrade
    const orderImpact = await getOrderImpact(
      snapUser.userId || userEmail,
      snapUser.userSecret,
      data.accountId,
      {
        action: data.action,
        universalSymbolId,
        orderType: data.orderType,
        timeInForce: data.timeInForce,
        units: data.quantity,
        price: data.limitPrice,
      }
    );

    // Calculate estimated costs
    const currentPrice = orderImpact.price || orderImpact.ask_price || orderImpact.bid_price || 0;
    const executionPrice = data.orderType === 'Limit' && data.limitPrice ? data.limitPrice : currentPrice;
    const estimatedCost = executionPrice * data.quantity;
    const estimatedFees = orderImpact.commission || orderImpact.fees || 0;
    const estimatedTotal = data.action === 'BUY' 
      ? estimatedCost + estimatedFees 
      : estimatedCost - estimatedFees;

    // Prepare preview response
    const preview = {
      success: true,
      preview: {
        // Order details
        symbol: data.symbol,
        symbolName: symbolInfo.description || symbolInfo.symbol,
        action: data.action,
        orderType: data.orderType,
        quantity: data.quantity,
        limitPrice: data.limitPrice,
        timeInForce: data.timeInForce,
        
        // Price information
        currentPrice,
        executionPrice,
        impactPrice: orderImpact.price,
        bidPrice: orderImpact.bid_price,
        askPrice: orderImpact.ask_price,
        
        // Cost breakdown
        estimatedCost,
        estimatedFees,
        estimatedTotal,
        currency: orderImpact.currency || 'USD',
        
        // Risk and impact information
        buyingPowerRequired: orderImpact.buying_power_required,
        buyingPowerAfter: orderImpact.buying_power_after,
        accountValue: orderImpact.account_value,
        
        // Confirmation data for step 2
        universalSymbolId,
        previewId: `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        
        // Raw SnapTrade data for debugging
        rawImpactData: orderImpact,
      },
      
      // Warnings and validations
      warnings: [],
      canProceed: true,
    };

    // Add warnings based on order analysis
    if (data.action === 'BUY' && orderImpact.buying_power_required > (orderImpact.buying_power_after || 0)) {
      preview.warnings.push('This order may exceed your buying power');
      preview.canProceed = false;
    }

    if (data.orderType === 'Limit' && data.limitPrice) {
      const priceDifference = Math.abs(data.limitPrice - currentPrice) / currentPrice;
      if (priceDifference > 0.05) { // 5% difference
        preview.warnings.push(`Limit price is ${(priceDifference * 100).toFixed(1)}% away from current market price`);
      }
    }

    if (estimatedTotal < 1) {
      preview.warnings.push('Order value is very small and may not execute');
    }

    console.log('Order preview generated successfully:', {
      symbol: data.symbol,
      estimatedTotal,
      fees: estimatedFees,
      warnings: preview.warnings.length,
    });

    res.json(preview);

  } catch (error: any) {
    console.error('Error generating order preview:', error);
    
    if (error.response?.data) {
      const errorData = error.response.data;
      console.error('SnapTrade preview error details:', errorData);
      
      return res.status(error.response.status || 400).json({
        message: errorData.detail || errorData.message || 'Failed to generate order preview',
        error: errorData,
      });
    }

    res.status(500).json({ 
      message: 'Failed to generate order preview',
      error: error.message,
    });
  }
});

/**
 * POST /api/order-preview/confirm
 * Confirm and place order - Step 2 of SnapTrade's two-step process
 */
router.post('/confirm', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = req.user!;
    const data = ConfirmOrderSchema.parse(req.body);

    const userEmail = (user as any).email || user.id;
    console.log('Order confirmation request for user:', userEmail);
    console.log('Confirmation details:', { symbol: data.symbol, action: data.action, quantity: data.quantity });

    // Get user's SnapTrade credentials
    const snapUser = await getSnapUser(userEmail);
    if (!snapUser?.userSecret) {
      return res.status(400).json({ 
        message: 'SnapTrade account not connected' 
      });
    }

    // Generate idempotency key for safe retries (industry best practice)
    const idempotencyKey = randomUUID();
    
    console.log('Placing order with idempotency key:', idempotencyKey);

    // Place the order using the confirmed preview data
    const order = await placeOrder(
      snapUser.userId || userEmail,
      snapUser.userSecret,
      data.accountId,
      {
        action: data.action,
        universalSymbolId: data.universalSymbolId,
        orderType: data.orderType,
        timeInForce: data.timeInForce,
        units: data.quantity,
        price: data.limitPrice,
        idempotencyKey,
      }
    );

    console.log('Order placed successfully:', {
      orderId: order.brokerage_order_id || order.id,
      symbol: data.symbol,
      status: order.status,
    });

    res.json({
      success: true,
      orderId: order.brokerage_order_id || order.id,
      status: order.status,
      symbol: data.symbol,
      action: data.action,
      quantity: data.quantity,
      orderType: data.orderType,
      limitPrice: data.limitPrice,
      estimatedCost: data.previewData.estimatedCost,
      estimatedFees: data.previewData.estimatedFees,
      estimatedTotal: data.previewData.estimatedTotal,
      placedAt: new Date().toISOString(),
      idempotencyKey,
      message: `${data.action} order for ${data.quantity} shares of ${data.symbol} placed successfully`,
      rawOrderData: order,
    });

  } catch (error: any) {
    console.error('Error confirming order:', error);
    
    if (error.response?.data) {
      const errorData = error.response.data;
      console.error('SnapTrade confirm error details:', errorData);
      
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

export default router;