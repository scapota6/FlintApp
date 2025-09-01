import { Router } from 'express';
import { db } from '../db';
import { users, snaptradeUsers, snaptradeConnections } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { WebhookEvent, WebhookAck, WebhookType, ISODate, UUID } from '@shared/types';

const router = Router();

// Helper function to find Flint user by SnapTrade user ID
async function getFlintUserBySnapTradeId(snaptradeUserId: string): Promise<string | null> {
  try {
    const [snapUser] = await db
      .select({ flintUserId: snaptradeUsers.flintUserId })
      .from(snaptradeUsers)
      .where(eq(snaptradeUsers.snaptradeUserId, snaptradeUserId))
      .limit(1);
    
    return snapUser?.flintUserId || null;
  } catch (error) {
    console.error('[SnapTrade Webhook] Error finding Flint user:', error);
    return null;
  }
}

// Helper function to map SnapTrade webhook types to our normalized types
function mapWebhookType(snaptradeType: string): WebhookType | null {
  const typeMap: Record<string, WebhookType> = {
    'CONNECTION_ATTEMPTED': 'connection.attempted',
    'CONNECTION_ESTABLISHED': 'connection.added',
    'CONNECTION_UPDATED': 'connection.updated',
    'CONNECTION_DELETED': 'connection.deleted',
    'CONNECTION_BROKEN': 'connection.broken',
    'CONNECTION_FIXED': 'connection.fixed',
    'BROKERAGE_AUTHORIZATION_BROKEN': 'connection.broken',
    'BROKERAGE_AUTHORIZATION_REPAIRED': 'connection.fixed',
    'BROKERAGE_AUTHORIZATION_CREATED': 'connection.added',
    'attempted': 'connection.attempted',
    'added': 'connection.added',
    'updated': 'connection.updated',
    'deleted': 'connection.deleted',
    'broken': 'connection.broken',
    'fixed': 'connection.fixed',
    'connection.attempted': 'connection.attempted',
    'connection.added': 'connection.added',
    'connection.updated': 'connection.updated',
    'connection.deleted': 'connection.deleted',
    'connection.broken': 'connection.broken',
    'connection.fixed': 'connection.fixed'
  };
  
  return typeMap[snaptradeType] || null;
}

/**
 * POST /api/snaptrade/webhooks
 * Handle SnapTrade webhook events with normalized response format
 */
router.post('/webhooks', async (req, res) => {
  try {
    const rawEvent = req.body;
    
    console.log('[SnapTrade Webhook] Received webhook:', {
      headers: req.headers,
      body: rawEvent
    });
    
    // Validate webhook signature if provided
    if (req.headers['x-snaptrade-signature']) {
      // TODO: Implement webhook signature validation
      // For now, we'll accept all webhooks in development
      console.log('[SnapTrade Webhook] Signature validation skipped in development');
    }
    
    // Map SnapTrade webhook type to our normalized type
    const webhookType = mapWebhookType(rawEvent.type || rawEvent.event_type);
    if (!webhookType) {
      console.warn('[SnapTrade Webhook] Unknown webhook type:', rawEvent.type || rawEvent.event_type);
      const ack: WebhookAck = { ok: true };
      return res.json(ack);
    }
    
    // Find the Flint user ID from SnapTrade user ID
    const flintUserId = await getFlintUserBySnapTradeId(rawEvent.user_id || rawEvent.userId);
    if (!flintUserId) {
      console.warn('[SnapTrade Webhook] Flint user not found for SnapTrade user:', rawEvent.user_id || rawEvent.userId);
      const ack: WebhookAck = { ok: true };
      return res.json(ack);
    }
    
    // Create normalized webhook event
    const webhookEvent: WebhookEvent = {
      id: rawEvent.id || `webhook_${Date.now()}`,
      type: webhookType,
      createdAt: rawEvent.created_at || rawEvent.createdAt || new Date().toISOString(),
      userId: flintUserId,
      authorizationId: rawEvent.brokerage_authorization_id || rawEvent.authorizationId || null,
      details: {
        snaptradeUserId: rawEvent.user_id || rawEvent.userId,
        institutionName: rawEvent.institution_name || rawEvent.institutionName,
        accountId: rawEvent.account_id || rawEvent.accountId,
        errorMessage: rawEvent.error_message || rawEvent.errorMessage,
        raw: rawEvent
      }
    };
    
    console.log('[SnapTrade Webhook] Normalized webhook event:', {
      id: webhookEvent.id,
      type: webhookEvent.type,
      userId: webhookEvent.userId,
      authorizationId: webhookEvent.authorizationId
    });
    
    // Handle specific webhook types
    switch (webhookEvent.type) {
      case 'connection.broken':
        console.log('[SnapTrade Webhook] Connection broken - marking authorization as disabled');
        if (webhookEvent.authorizationId) {
          await db
            .update(snaptradeConnections)
            .set({
              status: 'broken',
              disabled: true,
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
          
          console.log('[SnapTrade Webhook] Authorization disabled:', webhookEvent.authorizationId);
        }
        break;
        
      case 'connection.fixed':
        console.log('[SnapTrade Webhook] Connection fixed - marking authorization as enabled');
        if (webhookEvent.authorizationId) {
          await db
            .update(snaptradeConnections)
            .set({
              status: 'active',
              disabled: false,
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
          
          console.log('[SnapTrade Webhook] Authorization enabled:', webhookEvent.authorizationId);
        }
        break;
        
      case 'connection.deleted':
        console.log('[SnapTrade Webhook] Connection deleted - removing authorization');
        if (webhookEvent.authorizationId) {
          await db
            .delete(snaptradeConnections)
            .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
          
          console.log('[SnapTrade Webhook] Authorization removed:', webhookEvent.authorizationId);
        }
        break;
        
      case 'connection.added':
        console.log('[SnapTrade Webhook] Connection added - marking authorization as active');
        if (webhookEvent.authorizationId) {
          await db
            .update(snaptradeConnections)
            .set({
              status: 'active',
              disabled: false,
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
          
          console.log('[SnapTrade Webhook] Authorization activated:', webhookEvent.authorizationId);
        }
        break;
        
      case 'connection.updated':
        console.log('[SnapTrade Webhook] Connection updated - refreshing sync timestamp');
        if (webhookEvent.authorizationId) {
          await db
            .update(snaptradeConnections)
            .set({
              lastRefreshedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
          
          console.log('[SnapTrade Webhook] Authorization refreshed:', webhookEvent.authorizationId);
        }
        break;
        
      default:
        console.log('[SnapTrade Webhook] Handling webhook type:', webhookEvent.type);
    }
    
    // TODO: Store webhook event in database for audit trail
    // TODO: Emit real-time event to frontend via WebSocket
    
    // Acknowledge webhook with exact interface
    const ack: WebhookAck = { ok: true };
    res.json(ack);
    
  } catch (error: any) {
    console.error('[SnapTrade Webhook] Error processing webhook:', error);
    
    // Always acknowledge webhooks to prevent retries
    const ack: WebhookAck = { ok: true };
    res.json(ack);
  }
});

/**
 * Handle SnapTrade webhook events - exported for direct use
 */
export async function handleSnapTradeWebhook(req: any, res: any) {
  const rawEvent = req.body;
  
  console.log('[SnapTrade Webhook] Received webhook:', {
    headers: req.headers,
    body: rawEvent
  });
  
  // Validate webhook signature if provided
  if (req.headers['x-snaptrade-signature']) {
    // TODO: Implement webhook signature validation
    // For now, we'll accept all webhooks in development
    console.log('[SnapTrade Webhook] Signature validation skipped in development');
  }
  
  // Map SnapTrade webhook type to our normalized type
  const webhookType = mapWebhookType(rawEvent.type || rawEvent.event_type);
  if (!webhookType) {
    console.warn('[SnapTrade Webhook] Unknown webhook type:', rawEvent.type || rawEvent.event_type);
    const ack: WebhookAck = { ok: true };
    return res.json(ack);
  }
  
  // Find the Flint user ID from SnapTrade user ID
  const flintUserId = await getFlintUserBySnapTradeId(rawEvent.user_id || rawEvent.userId);
  if (!flintUserId) {
    console.warn('[SnapTrade Webhook] Flint user not found for SnapTrade user:', rawEvent.user_id || rawEvent.userId);
    const ack: WebhookAck = { ok: true };
    return res.json(ack);
  }
  
  // Create normalized webhook event
  const webhookEvent: WebhookEvent = {
    id: rawEvent.id || `webhook_${Date.now()}`,
    type: webhookType,
    createdAt: rawEvent.created_at || rawEvent.createdAt || new Date().toISOString(),
    userId: flintUserId,
    authorizationId: rawEvent.brokerage_authorization_id || rawEvent.authorizationId || null,
    details: {
      snaptradeUserId: rawEvent.user_id || rawEvent.userId,
      institutionName: rawEvent.institution_name || rawEvent.institutionName,
      accountId: rawEvent.account_id || rawEvent.accountId,
      errorMessage: rawEvent.error_message || rawEvent.errorMessage,
      raw: rawEvent
    }
  };
  
  console.log('[SnapTrade Webhook] Normalized webhook event:', {
    id: webhookEvent.id,
    type: webhookEvent.type,
    userId: webhookEvent.userId,
    authorizationId: webhookEvent.authorizationId
  });
  
  // Handle specific webhook types
  switch (webhookEvent.type) {
    case 'connection.broken':
      console.log('[SnapTrade Webhook] Connection broken - marking authorization as disabled');
      if (webhookEvent.authorizationId) {
        await db
          .update(snaptradeConnections)
          .set({
            status: 'broken',
            disabled: true,
            updatedAt: new Date()
          })
          .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
        
        console.log('[SnapTrade Webhook] Authorization disabled:', webhookEvent.authorizationId);
      }
      break;
      
    case 'connection.fixed':
      console.log('[SnapTrade Webhook] Connection fixed - marking authorization as enabled');
      if (webhookEvent.authorizationId) {
        await db
          .update(snaptradeConnections)
          .set({
            status: 'active',
            disabled: false,
            updatedAt: new Date()
          })
          .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
        
        console.log('[SnapTrade Webhook] Authorization enabled:', webhookEvent.authorizationId);
      }
      break;
      
    case 'connection.deleted':
      console.log('[SnapTrade Webhook] Connection deleted - removing authorization');
      if (webhookEvent.authorizationId) {
        await db
          .delete(snaptradeConnections)
          .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
        
        console.log('[SnapTrade Webhook] Authorization removed:', webhookEvent.authorizationId);
      }
      break;
      
    case 'connection.added':
      console.log('[SnapTrade Webhook] Connection added - marking authorization as active');
      if (webhookEvent.authorizationId) {
        await db
          .update(snaptradeConnections)
          .set({
            status: 'active',
            disabled: false,
            updatedAt: new Date()
          })
          .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
        
        console.log('[SnapTrade Webhook] Authorization activated:', webhookEvent.authorizationId);
      }
      break;
      
    case 'connection.updated':
      console.log('[SnapTrade Webhook] Connection updated - refreshing sync timestamp');
      if (webhookEvent.authorizationId) {
        await db
          .update(snaptradeConnections)
          .set({
            lastRefreshedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(snaptradeConnections.brokerageAuthorizationId, webhookEvent.authorizationId));
        
        console.log('[SnapTrade Webhook] Authorization refreshed:', webhookEvent.authorizationId);
      }
      break;
      
    default:
      console.log('[SnapTrade Webhook] Handling webhook type:', webhookEvent.type);
  }
  
  // TODO: Store webhook event in database for audit trail
  // TODO: Emit real-time event to frontend via WebSocket
  
  // Acknowledge webhook with exact interface
  const ack: WebhookAck = { ok: true };
  res.json(ack);
}

export { router as snaptradeWebhooksRouter };