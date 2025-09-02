/**
 * Error normalization for SnapTrade API responses
 * Maps SnapTrade errors to actionable UI error codes
 */

import type { KnownErrorCode, ApiError } from '@shared/types';

/**
 * Normalize SnapTrade errors to actionable error codes for UI banners
 */
export function normalizeSnapTradeError(error: any, context?: string): ApiError {
  const status = error.response?.status || error.status || 500;
  const snaptradeCode = error.response?.data?.code || error.code;
  const snaptradeMessage = error.response?.data?.message || error.message || 'Unknown error';
  const requestId = extractRequestId(error);

  console.error('[SnapTrade Error] Normalizing error:', {
    status,
    snaptradeCode,
    snaptradeMessage: snaptradeMessage.substring(0, 100),
    requestId,
    context
  });

  // Map specific error patterns to known codes
  let code: KnownErrorCode | string = 'UNKNOWN';
  let message = snaptradeMessage;

  // SNAPTRADE_NOT_REGISTERED (428) → prompt "Finish registration"
  if (status === 428 || 
      snaptradeCode === 'USER_NOT_REGISTERED' ||
      snaptradeMessage.toLowerCase().includes('user not registered') ||
      snaptradeMessage.toLowerCase().includes('register user')) {
    code = 'SNAPTRADE_NOT_REGISTERED';
    message = 'Please finish your SnapTrade registration to continue';
  }

  // SNAPTRADE_USER_MISMATCH (409) → prompt "Reset SnapTrade user"
  else if (status === 409 || 
           snaptradeCode === 'USER_MISMATCH' ||
           snaptradeCode === 'SNAPTRADE_USER_MISMATCH' ||
           snaptradeMessage.toLowerCase().includes('user mismatch') ||
           snaptradeMessage.toLowerCase().includes('different user')) {
    code = 'SNAPTRADE_USER_MISMATCH';
    message = 'Your SnapTrade connection needs to be reset. Please reconnect your account';
  }

  // SIGNATURE_INVALID (401/1076) → config/clock/secret issue; show admin alert
  else if (status === 401 || 
           snaptradeCode === '1076' ||
           snaptradeCode === 'SIGNATURE_INVALID' ||
           snaptradeCode === 'INVALID_SIGNATURE' ||
           snaptradeMessage.toLowerCase().includes('signature') ||
           snaptradeMessage.toLowerCase().includes('unable to verify')) {
    code = 'SIGNATURE_INVALID';
    message = 'Authentication configuration error. Please contact support';
  }

  // RATE_LIMITED (429) → transient retry
  else if (status === 429 || 
           snaptradeCode === 'RATE_LIMITED' ||
           snaptradeCode === 'TOO_MANY_REQUESTS' ||
           snaptradeMessage.toLowerCase().includes('rate limit') ||
           snaptradeMessage.toLowerCase().includes('too many requests')) {
    code = 'RATE_LIMITED';
    message = 'Please try again in a moment. Too many requests';
  }

  // CONNECTION_DISABLED → show Reconnect CTA
  else if (snaptradeCode === 'BROKERAGE_AUTHORIZATION_DISABLED' ||
           snaptradeCode === 'CONNECTION_DISABLED' ||
           snaptradeCode === 'AUTHORIZATION_DISABLED' ||
           snaptradeMessage.toLowerCase().includes('authorization disabled') ||
           snaptradeMessage.toLowerCase().includes('connection disabled')) {
    code = 'CONNECTION_DISABLED';
    message = 'Your brokerage connection has been disabled. Please reconnect';
  }

  // Network/timeout errors
  else if (error.code === 'ECONNREFUSED' || 
           error.code === 'ETIMEDOUT' ||
           error.code === 'ENOTFOUND') {
    code = 'NETWORK_ERROR';
    message = 'Network connection error. Please check your internet connection';
  }

  // Server errors (5xx)
  else if (status >= 500) {
    code = 'SERVER_ERROR';
    message = 'Server error occurred. Please try again later';
  }

  // Client errors (4xx) - fallback
  else if (status >= 400 && status < 500) {
    code = 'CLIENT_ERROR';
    message = snaptradeMessage || 'Request error. Please check your input';
  }

  return {
    code,
    message,
    requestId
  };
}

/**
 * Extract request ID from error for tracking
 */
function extractRequestId(error: any): string | null {
  // Check multiple possible locations for request ID
  return error.response?.headers?.['x-request-id'] ||
         error.response?.headers?.['x-snaptrade-request-id'] ||
         error.headers?.['x-request-id'] ||
         error.headers?.['x-snaptrade-request-id'] ||
         error.requestId ||
         null;
}

/**
 * Check if error indicates user needs to register
 */
export function isRegistrationRequired(error: any): boolean {
  const normalized = normalizeSnapTradeError(error);
  return normalized.code === 'SNAPTRADE_NOT_REGISTERED';
}

/**
 * Check if error indicates user mismatch/reset needed
 */
export function isUserMismatch(error: any): boolean {
  const normalized = normalizeSnapTradeError(error);
  return normalized.code === 'SNAPTRADE_USER_MISMATCH';
}

/**
 * Check if error indicates rate limiting
 */
export function isRateLimited(error: any): boolean {
  const normalized = normalizeSnapTradeError(error);
  return normalized.code === 'RATE_LIMITED';
}

/**
 * Check if error indicates connection is disabled
 */
export function isConnectionDisabled(error: any): boolean {
  const normalized = normalizeSnapTradeError(error);
  return normalized.code === 'CONNECTION_DISABLED';
}

/**
 * Check if error indicates a signature/auth config issue
 */
export function isSignatureInvalid(error: any): boolean {
  const normalized = normalizeSnapTradeError(error);
  return normalized.code === 'SIGNATURE_INVALID';
}