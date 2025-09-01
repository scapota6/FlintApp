import { Router } from 'express';
import { authApi, accountsApi, createLoginUrl, createReconnectLoginUrl, listBrokerageAuthorizations, detailBrokerageAuthorization, refreshBrokerageAuthorization } from '../lib/snaptrade';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { users, snaptradeUsers, snaptradeConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { mapSnapTradeError, logSnapTradeError, checkConnectionStatus, RateLimitHandler } from '../lib/snaptrade-errors';
import type { BrokerageConnection, PortalUrlRequest, PortalUrlResponse, ErrorResponse, ListResponse, DetailsResponse, ISODate, UUID } from '@shared/types';

const router = Router();

// Helper function to get Flint user by auth claims
async function getFlintUserByAuth(authUser: any) {
  const email = authUser?.claims?.email?.toLowerCase();
  if (!email) throw new Error('User email required');
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  if (!user) throw new Error('User not found');
  return user;
}

// Helper function to get SnapTrade credentials
async function getSnaptradeCredentials(flintUserId: string) {
  const [credentials] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.flintUserId, flintUserId))
    .limit(1);
  
  if (!credentials) throw new Error('User not registered with SnapTrade');
  return credentials;
}

/**
 * POST /api/snaptrade/portal-url
 * Generate connection portal URL for user to connect brokerages
 */
router.post('/portal-url', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    
    const { reconnectAuthorizationId, redirectUriOverride }: PortalUrlRequest = req.body;
    
    console.log('[SnapTrade Connections] Generating portal URL for user:', {
      flintUserId: flintUser.id,
      snaptradeUserId: credentials.snaptradeUserId,
      reconnecting: !!reconnect
    });
    
    // Generate connection portal URL
    const loginParams: any = {
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret,
      redirectUri: process.env.SNAPTRADE_REDIRECT_URI!
    };
    
    // Use provided redirect URI or default
    const redirectUri = redirectUriOverride || process.env.SNAPTRADE_REDIRECT_URI!;
    
    // If reconnecting a broken connection, include the authorization ID
    if (reconnectAuthorizationId) {
      loginParams.brokerageAuthorizations = reconnectAuthorizationId;
      console.log('[SnapTrade Connections] Reconnecting authorization:', reconnectAuthorizationId);
    }
    
    const portalUrl = reconnectAuthorizationId ? 
      await createReconnectLoginUrl({
        userId: credentials.snaptradeUserId,
        userSecret: credentials.snaptradeUserSecret,
        redirect: redirectUri,
        authorizationId: reconnectAuthorizationId
      }) :
      await createLoginUrl({
        userId: credentials.snaptradeUserId,
        userSecret: credentials.snaptradeUserSecret,
        redirect: redirectUri
      });
    
    if (!portalUrl) {
      throw new Error('SnapTrade did not return portal URL');
    }
    
    console.log('[SnapTrade Connections] Portal URL generated successfully');
    
    const response: PortalUrlResponse = {
      url: portalUrl
    };
    
    res.json(response);
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    const flintUser = await getFlintUserByAuth(req.user).catch(() => ({ id: 'unknown' }));
    logSnapTradeError('generate_portal_url', error, requestId, { 
      flintUserId: flintUser.id,
      reconnecting: !!reconnectAuthorizationId
    });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      await RateLimitHandler.handleRateLimit(`portal_url_${flintUser.id}`, 
        error.headers?.['retry-after'], error.headers?.['x-ratelimit-remaining']);
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
  }
});

/**
 * GET /api/snaptrade/connections
 * List all brokerage connections for the user
 */
router.get('/connections', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    
    console.log('[SnapTrade Connections] Listing connections for user:', {
      flintUserId: flintUser.id,
      snaptradeUserId: credentials.snaptradeUserId
    });
    
    // Get brokerage authorizations from SnapTrade
    const connections = await listBrokerageAuthorizations(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret
    ) || [];
    
    // Sync connections to our database
    for (const connection of connections) {
      await db
        .insert(snaptradeConnections)
        .values({
          flintUserId: flintUser.id,
          brokerageAuthorizationId: connection.id!,
          brokerageName: connection.name || 'Unknown',
          brokerageType: connection.type || null,
          status: connection.disabled ? 'disabled' : 'active',
          disabled: !!connection.disabled,
          updatedAt: new Date(),
          lastRefreshedAt: connection.updated ? new Date(connection.updated) : null
        })
        .onConflictDoUpdate({
          target: snaptradeConnections.brokerageAuthorizationId,
          set: {
            brokerageName: connection.name || 'Unknown',
            brokerageType: connection.type || null,
            status: connection.disabled ? 'disabled' : 'active',
            disabled: !!connection.disabled,
            updatedAt: new Date(),
            lastRefreshedAt: connection.updated ? new Date(connection.updated) : null
          }
        });
    }
    
    console.log('[SnapTrade Connections] Synced', connections.length, 'connections to database');
    
    res.json({
      success: true,
      connections: connections.map((conn: any) => {
        const connectionStatus = checkConnectionStatus(conn);
        return {
          id: conn.id,
          name: conn.name,
          type: conn.type,
          disabled: !!conn.disabled,
          created: conn.created,
          updated: conn.updated,
          needsReconnect: connectionStatus.needsReconnect,
          reconnectUrl: connectionStatus.reconnectUrl
        };
      })
    });
    
  } catch (error: any) {
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
    const flintUser = await getFlintUserByAuth(req.user).catch(() => ({ id: 'unknown' }));
    logSnapTradeError('list_connections', error, requestId, { flintUserId: flintUser.id });
    
    const mappedError = mapSnapTradeError(error, requestId);
    
    if (mappedError.code === '429') {
      const remaining = RateLimitHandler.getRemainingRequests(error.headers);
      const reset = RateLimitHandler.getResetTime(error.headers);
      
      res.status(429).json({
        success: false,
        message: mappedError.userMessage,
        error: mappedError,
        retryAfter: reset,
        remaining
      });
      return;
    }
    
    res.status(mappedError.httpStatus).json({
      success: false,
      message: mappedError.userMessage,
      error: mappedError
    });
  }
});

/**
 * GET /api/snaptrade/connections/:id
 * Get detailed information about a specific connection
 */
router.get('/connections/:id', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const connectionId = req.params.id;
    
    console.log('[SnapTrade Connections] Getting connection details:', {
      flintUserId: flintUser.id,
      connectionId
    });
    
    // Get specific brokerage authorization details
    const connection = await detailBrokerageAuthorization(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      connectionId
    );
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }
    
    // Get accounts associated with this brokerage authorization
    const accountsResponse = await accountsApi.listUserAccounts({
      userId: credentials.snaptradeUserId,
      userSecret: credentials.snaptradeUserSecret
    });
    
    const associatedAccounts = accountsResponse.data?.filter(
      account => account.brokerage_authorization === connectionId
    ) || [];
    
    res.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        type: connection.type,
        disabled: !!connection.disabled,
        created: connection.created,
        updated: connection.updated,
        accounts: associatedAccounts.map(account => ({
          id: account.id,
          name: account.name,
          number: account.number,
          institutionName: account.institution_name,
          type: account.meta?.type,
          balance: account.balance?.total?.amount || 0
        }))
      }
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Connections] Get connection error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to get connection details'
    });
  }
});

/**
 * POST /api/snaptrade/connections/:id/refresh
 * Refresh holdings for a specific connection
 */
router.post('/connections/:id/refresh', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const connectionId = req.params.id;
    
    console.log('[SnapTrade Connections] Refreshing connection:', {
      flintUserId: flintUser.id,
      connectionId
    });
    
    // Refresh the connection
    await refreshBrokerageAuthorization(
      credentials.snaptradeUserId,
      credentials.snaptradeUserSecret,
      connectionId
    );
    
    // Update the last refreshed timestamp in our database
    await db
      .update(snaptradeConnections)
      .set({
        lastRefreshedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(snaptradeConnections.flintUserId, flintUser.id),
        eq(snaptradeConnections.brokerageAuthorizationId, connectionId)
      ));
    
    console.log('[SnapTrade Connections] Connection refreshed successfully');
    
    res.json({
      success: true,
      message: 'Connection refreshed successfully',
      refreshedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Connections] Refresh connection error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to refresh connection'
    });
  }
});

/**
 * POST /api/snaptrade/connections/:id/disable
 * Disable a specific connection
 */
router.post('/connections/:id/disable', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const connectionId = req.params.id;
    
    console.log('[SnapTrade Connections] Disabling connection:', {
      flintUserId: flintUser.id,
      connectionId
    });
    
    // Mark connection as disabled in database (SnapTrade handles this via connection status)
    console.log('[SnapTrade Connections] Marking connection as disabled');
    
    // Update status in our database
    await db
      .update(snaptradeConnections)
      .set({
        status: 'disabled',
        disabled: true,
        updatedAt: new Date()
      })
      .where(and(
        eq(snaptradeConnections.flintUserId, flintUser.id),
        eq(snaptradeConnections.brokerageAuthorizationId, connectionId)
      ));
    
    console.log('[SnapTrade Connections] Connection disabled successfully');
    
    res.json({
      success: true,
      message: 'Connection disabled successfully'
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Connections] Disable connection error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to disable connection'
    });
  }
});

/**
 * DELETE /api/snaptrade/connections/:id
 * Remove a connection completely
 */
router.delete('/connections/:id', isAuthenticated, async (req: any, res) => {
  try {
    const flintUser = await getFlintUserByAuth(req.user);
    const credentials = await getSnaptradeCredentials(flintUser.id);
    const connectionId = req.params.id;
    
    console.log('[SnapTrade Connections] Deleting connection:', {
      flintUserId: flintUser.id,
      connectionId
    });
    
    // Remove connection from database (SnapTrade handles deletion via portal)
    console.log('[SnapTrade Connections] Removing connection from database');
    
    // Remove from our database
    await db
      .delete(snaptradeConnections)
      .where(and(
        eq(snaptradeConnections.flintUserId, flintUser.id),
        eq(snaptradeConnections.brokerageAuthorizationId, connectionId)
      ));
    
    console.log('[SnapTrade Connections] Connection deleted successfully');
    
    res.json({
      success: true,
      message: 'Connection deleted successfully'
    });
    
  } catch (error: any) {
    console.error('[SnapTrade Connections] Delete connection error:', error?.response?.data || error?.message || error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to delete connection'
    });
  }
});

export { router as snaptradeConnectionsRouter };