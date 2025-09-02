/**
 * Broken connection detection and repair actions for SnapTrade
 */

import { db } from '../db';
import { snaptradeConnections } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface BrokenConnectionInfo {
  connectionId: number;
  brokerageAuthId: string;
  brokerageName: string;
  flintUserId: string;
  errorCode?: string;
  errorMessage?: string;
  lastFailedAt: Date;
  repairAction: 'reauth' | 'reconnect' | 'contact_support';
  repairUrl?: string;
}

/**
 * HTTP status codes that indicate broken connections requiring re-auth
 */
const BROKEN_CONNECTION_CODES = [
  401, // Unauthorized - expired tokens
  403, // Forbidden - invalid credentials
  410, // Gone - account closed or deactivated
  423  // Locked - account locked/suspended
];

/**
 * SnapTrade error codes that indicate broken connections
 */
const SNAPTRADE_BROKEN_CONNECTION_ERRORS = [
  'BROKERAGE_AUTHORIZATION_DISABLED',
  'BROKERAGE_AUTHORIZATION_DELETED',
  'INVALID_CREDENTIALS',
  'EXPIRED_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'ACCOUNT_SUSPENDED',
  'REAUTH_REQUIRED',
  'CONNECTION_LOST',
  'TOKEN_EXPIRED'
];

/**
 * Check if an error indicates a broken connection
 */
export function isBrokenConnection(error: any): boolean {
  // Check HTTP status codes
  if (error.response?.status && BROKEN_CONNECTION_CODES.includes(error.response.status)) {
    return true;
  }

  // Check SnapTrade error codes
  const errorCode = error.response?.data?.code || error.code;
  if (errorCode && SNAPTRADE_BROKEN_CONNECTION_ERRORS.includes(errorCode)) {
    return true;
  }

  // Check error messages for common patterns
  const errorMessage = error.response?.data?.message || error.message || '';
  const brokenPatterns = [
    'authorization disabled',
    'authorization deleted', 
    'invalid credentials',
    'expired credentials',
    'account disabled',
    'account suspended',
    'reauth required',
    'token expired',
    'connection lost'
  ];

  return brokenPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern)
  );
}

/**
 * Mark a connection as broken in the database
 */
export async function markConnectionBroken(
  brokerageAuthId: string,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  try {
    const updated = await db
      .update(snaptradeConnections)
      .set({
        disabled: true,
        updatedAt: new Date()
        // TODO: Add error fields to schema if needed
      })
      .where(eq(snaptradeConnections.brokerageAuthorizationId, brokerageAuthId))
      .returning();

    if (updated.length > 0) {
      console.log('[Broken Connection] Marked connection as broken:', {
        connectionId: updated[0].id,
        brokerageAuthId,
        errorCode,
        errorMessage: errorMessage?.substring(0, 100) + '...' // Truncate for logging
      });
    } else {
      console.warn('[Broken Connection] Connection not found:', {
        brokerageAuthId,
        errorCode
      });
    }
  } catch (dbError: any) {
    console.error('[Broken Connection] Failed to mark connection as broken:', {
      brokerageAuthId,
      errorCode,
      dbError: dbError.message
    });
  }
}

/**
 * Get repair action for a broken connection
 */
export function getRepairAction(errorCode?: string, httpStatus?: number): BrokenConnectionInfo['repairAction'] {
  // Check specific error codes first
  if (errorCode) {
    const authErrors = ['INVALID_CREDENTIALS', 'EXPIRED_CREDENTIALS', 'TOKEN_EXPIRED', 'REAUTH_REQUIRED'];
    const disabledErrors = ['BROKERAGE_AUTHORIZATION_DISABLED', 'ACCOUNT_DISABLED', 'ACCOUNT_SUSPENDED'];
    const deletedErrors = ['BROKERAGE_AUTHORIZATION_DELETED'];

    if (authErrors.includes(errorCode)) {
      return 'reauth';
    }
    if (disabledErrors.includes(errorCode)) {
      return 'contact_support';
    }
    if (deletedErrors.includes(errorCode)) {
      return 'reconnect';
    }
  }

  // Check HTTP status codes
  if (httpStatus) {
    switch (httpStatus) {
      case 401:
      case 403:
        return 'reauth';
      case 410:
        return 'reconnect';
      case 423:
        return 'contact_support';
    }
  }

  // Default to reauth for unknown errors
  return 'reauth';
}

/**
 * Generate repair URL for broken connection
 */
export function getRepairUrl(
  repairAction: BrokenConnectionInfo['repairAction'],
  brokerageAuthId: string,
  brokerageName: string
): string | undefined {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';

  switch (repairAction) {
    case 'reauth':
      // URL to re-authenticate with the brokerage
      return `${baseUrl}/accounts/reconnect?auth=${brokerageAuthId}&brokerage=${encodeURIComponent(brokerageName)}`;
    
    case 'reconnect':
      // URL to create a new connection
      return `${baseUrl}/accounts/connect?brokerage=${encodeURIComponent(brokerageName)}`;
    
    case 'contact_support':
      // URL to contact support
      return `${baseUrl}/support?issue=broken_connection&auth=${brokerageAuthId}`;
    
    default:
      return undefined;
  }
}

/**
 * Get all broken connections for a user
 */
export async function getBrokenConnections(flintUserId: string): Promise<BrokenConnectionInfo[]> {
  try {
    const brokenConnections = await db
      .select()
      .from(snaptradeConnections)
      .where(eq(snaptradeConnections.flintUserId, flintUserId))
      .where(eq(snaptradeConnections.disabled, true));

    return brokenConnections.map(connection => {
      const repairAction = getRepairAction(); // Default repair action
      
      return {
        connectionId: connection.id,
        brokerageAuthId: connection.brokerageAuthorizationId,
        brokerageName: connection.brokerageName,
        flintUserId: connection.flintUserId,
        lastFailedAt: connection.updatedAt || new Date(),
        repairAction,
        repairUrl: getRepairUrl(repairAction, connection.brokerageAuthorizationId, connection.brokerageName)
      };
    });
  } catch (error: any) {
    console.error('[Broken Connection] Failed to get broken connections:', {
      flintUserId,
      error: error.message
    });
    return [];
  }
}

/**
 * Handle broken connection when detected in API calls
 */
export async function handleBrokenConnection(
  error: any,
  brokerageAuthId: string,
  context: string
): Promise<BrokenConnectionInfo | null> {
  if (!isBrokenConnection(error)) {
    return null; // Not a broken connection error
  }

  const errorCode = error.response?.data?.code || error.code;
  const errorMessage = error.response?.data?.message || error.message;
  const httpStatus = error.response?.status;

  console.warn('[Broken Connection] Detected broken connection:', {
    context,
    brokerageAuthId,
    errorCode,
    httpStatus,
    errorMessage: errorMessage?.substring(0, 100) + '...'
  });

  // Mark connection as broken in database
  await markConnectionBroken(brokerageAuthId, errorCode, errorMessage);

  // Get connection details for repair info
  const [connection] = await db
    .select()
    .from(snaptradeConnections)
    .where(eq(snaptradeConnections.brokerageAuthorizationId, brokerageAuthId))
    .limit(1);

  if (!connection) {
    console.warn('[Broken Connection] Connection not found for repair info:', {
      brokerageAuthId
    });
    return null;
  }

  const repairAction = getRepairAction(errorCode, httpStatus);
  
  return {
    connectionId: connection.id,
    brokerageAuthId: connection.brokerageAuthorizationId,
    brokerageName: connection.brokerageName,
    flintUserId: connection.flintUserId,
    errorCode,
    errorMessage,
    lastFailedAt: new Date(),
    repairAction,
    repairUrl: getRepairUrl(repairAction, connection.brokerageAuthorizationId, connection.brokerageName)
  };
}

/**
 * Enhanced SnapTrade API wrapper with broken connection detection
 */
export async function snaptradeApiCall<T>(
  apiCall: () => Promise<T>,
  brokerageAuthId: string,
  context: string
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    const brokenInfo = await handleBrokenConnection(error, brokerageAuthId, context);
    
    if (brokenInfo) {
      // Enhance error with repair information
      const enhancedError = new Error(error.message);
      (enhancedError as any).isBrokenConnection = true;
      (enhancedError as any).repairInfo = brokenInfo;
      (enhancedError as any).originalError = error;
      throw enhancedError;
    }
    
    // Re-throw original error if not a broken connection
    throw error;
  }
}