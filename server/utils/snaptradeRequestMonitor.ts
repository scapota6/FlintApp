/**
 * SnapTrade Request Monitoring
 * Based on official SnapTrade CLI axios patching for performance tracking
 */

import { logger } from "@shared/logger";

interface RequestMetadata {
  startTime: number;
  endpoint: string;
  method: string;
  userId?: string;
}

const activeRequests = new Map<string, RequestMetadata>();

/**
 * Generate request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log SnapTrade request start (like CLI verbose mode)
 */
export function logSnapTradeRequestStart(
  method: string,
  endpoint: string,
  userId?: string
): string {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  activeRequests.set(requestId, {
    startTime,
    endpoint,
    method,
    userId
  });
  
  logger.info("[SnapTrade Request]", { 
    metadata: { requestId, method, endpoint, userId, phase: "start" }
  });
  
  return requestId;
}

/**
 * Log SnapTrade request completion with performance metrics
 */
export function logSnapTradeRequestEnd(
  requestId: string,
  status: number,
  responseData?: any,
  error?: Error
): void {
  const metadata = activeRequests.get(requestId);
  if (!metadata) return;
  
  const duration = Date.now() - metadata.startTime;
  const success = status >= 200 && status < 300;
  
  if (success) {
    logger.info("[SnapTrade Request Success]", {
      metadata: { requestId, method: metadata.method, endpoint: metadata.endpoint, userId: metadata.userId, status, duration: `${duration}ms`, phase: "complete" }
    });
  } else {
    logger.error("[SnapTrade Request Error]", {
      error: error as Error,
      metadata: { requestId, method: metadata.method, endpoint: metadata.endpoint, userId: metadata.userId, status, duration: `${duration}ms`, phase: "error" }
    });
  }
  
  // Clean up
  activeRequests.delete(requestId);
}

/**
 * Wrapper for SnapTrade API calls with monitoring
 */
export async function monitoredSnapTradeCall<T>(
  operation: string,
  apiCall: () => Promise<T>,
  userId?: string
): Promise<T> {
  const requestId = logSnapTradeRequestStart("API", operation, userId);
  
  try {
    const result = await apiCall();
    logSnapTradeRequestEnd(requestId, 200, result);
    return result;
  } catch (error: any) {
    const status = error.response?.status || 500;
    logSnapTradeRequestEnd(requestId, status, null, error as Error);
    throw error;
  }
}

/**
 * Get performance statistics for admin dashboard
 */
export function getRequestStats(): {
  activeRequests: number;
  avgResponseTime: number;
  successRate: number;
  requestsInLast24h: number;
} {
  // In a real implementation, you'd track these metrics
  // For now, return basic stats
  return {
    activeRequests: activeRequests.size,
    avgResponseTime: 0, // Would calculate from stored metrics
    successRate: 0.95, // Would calculate from success/error ratio
    requestsInLast24h: 0, // Would count from stored metrics
  };
}

/**
 * Enhanced error handling for SnapTrade responses
 * Matches CLI error categorization
 */
export function categorizeSnapTradeError(error: any): {
  category: 'auth' | 'rate_limit' | 'validation' | 'network' | 'server' | 'unknown';
  message: string;
  retryable: boolean;
} {
  const status = error.response?.status;
  const errorCode = error.response?.data?.code || error.responseBody?.code;
  
  switch (status) {
    case 401:
      return {
        category: 'auth',
        message: 'Authentication failed - check your API credentials',
        retryable: false
      };
      
    case 403:
      return {
        category: 'auth',
        message: 'Access forbidden - insufficient permissions',
        retryable: false
      };
      
    case 429:
      return {
        category: 'rate_limit',
        message: 'Rate limit exceeded - please wait before retrying',
        retryable: true
      };
      
    case 400:
      return {
        category: 'validation',
        message: error.response?.data?.message || 'Invalid request parameters',
        retryable: false
      };
      
    case 500:
    case 502:
    case 503:
      return {
        category: 'server',
        message: 'SnapTrade server error - please try again later',
        retryable: true
      };
      
    default:
      // Handle specific SnapTrade error codes
      if (errorCode === '1010') {
        return {
          category: 'validation',
          message: 'User already exists',
          retryable: false
        };
      }
      
      return {
        category: 'unknown',
        message: error.message || 'Unknown error occurred',
        retryable: false
      };
  }
}

/**
 * Retry wrapper for SnapTrade calls with exponential backoff
 */
export async function retryableSnapTradeCall<T>(
  operation: string,
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  userId?: string
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await monitoredSnapTradeCall(operation, apiCall, userId);
    } catch (error) {
      lastError = error;
      const errorInfo = categorizeSnapTradeError(error);
      
      // Don't retry if error is not retryable
      if (!errorInfo.retryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt - 1) * 1000;
      
      logger.warn(`[SnapTrade] Retrying operation ${operation} (attempt ${attempt}/${maxRetries})`, {
        metadata: { userId, delay: `${delay}ms`, error: errorInfo.message }
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}