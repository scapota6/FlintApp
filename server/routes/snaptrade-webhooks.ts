import { Router } from 'express';
import { db } from '../db';
import { snaptradeConnections } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/snaptrade/webhooks
 * Handle SnapTrade webhook notifications for connection status changes
 */
router.post('/webhooks', async (req, res) => {
  try {
    const { type, brokerage_authorization_id, user_id, data } = req.body;
    
    console.log('[SnapTrade Webhooks] Received webhook:', {
      type,
      brokerageAuthorizationId: brokerage_authorization_id,
      userId: user_id,
      timestamp: new Date().toISOString()
    });
    
    // Handle different webhook types
    switch (type) {
      case 'attempted':
        console.log('[SnapTrade Webhooks] Connection attempted for authorization:', brokerage_authorization_id);
        break;
        
      case 'added':
        // New connection established
        if (brokerage_authorization_id) {
          await db
            .update(snaptradeConnections)
            .set({
              status: 'active',
              disabled: false,
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, brokerage_authorization_id));
          
          console.log('[SnapTrade Webhooks] Connection added:', brokerage_authorization_id);
        }
        break;
        
      case 'updated':
        // Connection updated (sync completed, etc.)
        if (brokerage_authorization_id) {
          await db
            .update(snaptradeConnections)
            .set({
              lastRefreshedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, brokerage_authorization_id));
          
          console.log('[SnapTrade Webhooks] Connection updated:', brokerage_authorization_id);
        }
        break;
        
      case 'deleted':
        // Connection removed
        if (brokerage_authorization_id) {
          await db
            .delete(snaptradeConnections)
            .where(eq(snaptradeConnections.brokerageAuthorizationId, brokerage_authorization_id));
          
          console.log('[SnapTrade Webhooks] Connection deleted:', brokerage_authorization_id);
        }
        break;
        
      case 'broken':
        // Connection broken - show "Reconnect" CTA instead of "Connect"
        if (brokerage_authorization_id) {
          await db
            .update(snaptradeConnections)
            .set({
              status: 'broken',
              disabled: true,
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, brokerage_authorization_id));
          
          console.log('[SnapTrade Webhooks] Connection broken (needs reconnect):', brokerage_authorization_id);
        }
        break;
        
      case 'fixed':
        // Connection fixed after reconnect
        if (brokerage_authorization_id) {
          await db
            .update(snaptradeConnections)
            .set({
              status: 'active',
              disabled: false,
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, brokerage_authorization_id));
          
          console.log('[SnapTrade Webhooks] Connection fixed:', brokerage_authorization_id);
        }
        break;
        
      default:
        console.log('[SnapTrade Webhooks] Unknown webhook type:', type);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      type,
      processedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Webhooks] Error processing webhook:', error?.message || error);
    
    // Still return 200 to prevent SnapTrade from retrying
    res.status(200).json({
      success: false,
      message: 'Webhook processing failed',
      error: error?.message || 'Unknown error'
    });
  }
});

export { router as snaptradeWebhooksRouter };