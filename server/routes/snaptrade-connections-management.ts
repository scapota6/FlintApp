/**
 * SnapTrade Connections Management endpoints
 * Handles brokerage authorization operations: list, detail, refresh, disable, remove
 */

import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { snaptradeUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { listBrokerageAuthorizations, detailBrokerageAuthorization, refreshBrokerageAuthorization, disableBrokerageAuthorization, removeBrokerageAuthorization } from '../lib/snaptrade';
import { extractSnapTradeRequestId, createApiError } from '../lib/validation';
import type { ErrorResponse, Connection, ListConnectionsResponse } from '@shared/types';

const router = Router();

// Helper to get SnapTrade credentials for authenticated user
async function getSnapTradeCredentials(email: string) {
  const flintUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email)
  });
  
  if (!flintUser) {
    throw new Error('User not found');
  }
  
  const [credentials] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.flintUserId, flintUser.id))
    .limit(1);
  
  if (!credentials) {
    throw new Error('SnapTrade account not connected');
  }
  
  return {
    userId: credentials.flintUserId,
    userSecret: credentials.userSecret
  };
}

/**
 * GET /api/snaptrade/connections
 * List all brokerage authorizations for user
 */
router.get('/connections', isAuthenticated, async (req: any, res) => {
  try {
    const email = req.user.claims.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Connections] Listing brokerage authorizations:', {
      email,
      userId: credentials.userId
    });
    
    // List brokerage authorizations from SnapTrade
    const connectionData = await listBrokerageAuthorizations(credentials.userId, credentials.userSecret);
    
    console.log('[SnapTrade Connections] Listed brokerage authorizations:', {
      count: connectionData?.length || 0
    });
    
    // Transform to normalized DTO format
    const connections: Connection[] = (connectionData || []).map((auth: any) => ({
      id: auth.id,
      brokerageName: auth.name || 'Unknown',
      disabled: !!auth.disabled,
      createdAt: auth.created || null,
      updatedAt: auth.updated || null,
      lastSyncAt: auth.updated || null // SnapTrade doesn't provide separate lastSync
    }));
    
    const connectionsResponse: ListConnectionsResponse = {
      connections
    };
    
    res.json(connectionsResponse);
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Connections] Error listing connections:', {
      email: req.user?.claims?.email,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to list connections',
      error.response?.data?.code || 'LIST_CONNECTIONS_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * GET /api/snaptrade/connections/:connectionId
 * Get detailed information about a specific brokerage authorization
 */
router.get('/connections/:connectionId', isAuthenticated, async (req: any, res) => {
  try {
    const { connectionId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Connections] Getting connection details:', {
      email,
      connectionId
    });
    
    // Get detailed brokerage authorization from SnapTrade
    const connectionDetail = await detailBrokerageAuthorization(credentials.userId, credentials.userSecret, connectionId);
    
    console.log('[SnapTrade Connections] Retrieved connection details:', {
      connectionId,
      brokerageName: connectionDetail?.name
    });
    
    // Transform to normalized DTO format
    const connection: Connection = {
      id: connectionDetail.id,
      brokerageName: connectionDetail.name || 'Unknown',
      disabled: !!connectionDetail.disabled,
      createdAt: connectionDetail.created || null,
      updatedAt: connectionDetail.updated || null,
      lastSyncAt: connectionDetail.updated || null
    };
    
    res.json({
      connection
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Connections] Error getting connection details:', {
      connectionId: req.params.connectionId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to get connection details',
      error.response?.data?.code || 'GET_CONNECTION_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * POST /api/snaptrade/connections/:connectionId/refresh
 * Refresh a brokerage authorization
 */
router.post('/connections/:connectionId/refresh', isAuthenticated, async (req: any, res) => {
  try {
    const { connectionId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Connections] Refreshing connection:', {
      email,
      connectionId
    });
    
    // Refresh the brokerage authorization
    await refreshBrokerageAuthorization(credentials.userId, credentials.userSecret, connectionId);
    
    console.log('[SnapTrade Connections] Refreshed connection:', {
      connectionId
    });
    
    res.json({
      success: true,
      message: 'Connection refreshed successfully',
      connectionId
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Connections] Error refreshing connection:', {
      connectionId: req.params.connectionId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to refresh connection',
      error.response?.data?.code || 'REFRESH_CONNECTION_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * POST /api/snaptrade/connections/:connectionId/disable
 * Disable a brokerage authorization
 */
router.post('/connections/:connectionId/disable', isAuthenticated, async (req: any, res) => {
  try {
    const { connectionId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Connections] Disabling connection:', {
      email,
      connectionId
    });
    
    // Disable the brokerage authorization
    await disableBrokerageAuthorization(credentials.userId, credentials.userSecret, connectionId);
    
    console.log('[SnapTrade Connections] Disabled connection:', {
      connectionId
    });
    
    res.json({
      success: true,
      message: 'Connection disabled successfully',
      connectionId
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Connections] Error disabling connection:', {
      connectionId: req.params.connectionId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to disable connection',
      error.response?.data?.code || 'DISABLE_CONNECTION_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

/**
 * DELETE /api/snaptrade/connections/:connectionId
 * Remove a brokerage authorization
 */
router.delete('/connections/:connectionId', isAuthenticated, async (req: any, res) => {
  try {
    const { connectionId } = req.params;
    const email = req.user.claims.email?.toLowerCase();
    
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'MISSING_EMAIL',
          message: 'User email required',
          requestId: null
        }
      });
    }
    
    const credentials = await getSnapTradeCredentials(email);
    
    console.log('[SnapTrade Connections] Removing connection:', {
      email,
      connectionId
    });
    
    // Remove the brokerage authorization
    await removeBrokerageAuthorization(credentials.userId, credentials.userSecret, connectionId);
    
    console.log('[SnapTrade Connections] Removed connection:', {
      connectionId
    });
    
    res.json({
      success: true,
      message: 'Connection removed successfully',
      connectionId
    });
    
  } catch (error: any) {
    const requestId = extractSnapTradeRequestId(error.response);
    
    console.error('[SnapTrade Connections] Error removing connection:', {
      connectionId: req.params.connectionId,
      responseData: error.response?.data,
      status: error.response?.status,
      message: error.message,
      snaptradeRequestId: requestId
    });
    
    const status = error.response?.status || 500;
    const apiError = createApiError(
      error.message || 'Failed to remove connection',
      error.response?.data?.code || 'REMOVE_CONNECTION_ERROR',
      status,
      requestId
    );
    
    const errorResponse: ErrorResponse = {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId: apiError.requestId || null
      }
    };
    
    res.status(status).json(errorResponse);
  }
});

export default router;