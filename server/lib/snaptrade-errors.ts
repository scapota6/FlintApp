/**
 * SnapTrade Error Handling Utilities
 * Maps SnapTrade API errors to clear UI states and recovery actions
 */

export interface SnapTradeError {
  code: string;
  message: string;
  action: 'reconnect' | 'register' | 'retry' | 'backoff';
  userMessage: string;
  httpStatus: number;
}

/**
 * Maps SnapTrade error codes to structured error responses
 */
export function mapSnapTradeError(error: any, requestId?: string): SnapTradeError {
  const logContext = requestId ? `[X-Request-ID: ${requestId}]` : '';
  
  // Extract error code from response body or error object
  const errorCode = error.responseBody?.code || error.code || error.status?.toString();
  const errorMessage = error.responseBody?.message || error.message || 'Unknown error';
  
  console.error(`${logContext} SnapTrade API Error:`, {
    code: errorCode,
    message: errorMessage,
    status: error.status,
    body: error.responseBody
  });

  switch (errorCode) {
    case '1076':
    case 401:
      if (errorMessage.includes('Unable to verify signature')) {
        return {
          code: 'SIGNATURE_INVALID',
          message: 'Authentication signature verification failed',
          action: 'register',
          userMessage: 'Connection expired. Please reconnect your brokerage account.',
          httpStatus: 401
        };
      }
      return {
        code: 'SIGNATURE_INVALID',
        message: 'Authentication failed',
        action: 'register',
        userMessage: 'Authentication expired. Please reconnect your account.',
        httpStatus: 401
      };

    case '428':
    case 'SNAPTRADE_NOT_REGISTERED':
      return {
        code: 'SNAPTRADE_NOT_REGISTERED',
        message: 'User not registered with SnapTrade',
        action: 'register',
        userMessage: 'Account setup required. Please connect your brokerage account.',
        httpStatus: 428
      };

    case '409':
    case 'SNAPTRADE_USER_MISMATCH':
      return {
        code: 'SNAPTRADE_USER_MISMATCH',
        message: 'User credentials mismatch',
        action: 'register',
        userMessage: 'Account mismatch detected. Please reconnect your brokerage account.',
        httpStatus: 409
      };

    case '429':
      return {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        action: 'backoff',
        userMessage: 'Please try again in a moment',
        httpStatus: 429
      };

    case '403':
      if (errorMessage.includes('disabled') || errorMessage.includes('connection')) {
        return {
          code: 'CONNECTION_DISABLED',
          message: 'Connection disabled',
          action: 'reconnect',
          userMessage: 'Connection disabled. Please reconnect your brokerage account.',
          httpStatus: 409
        };
      }
      return {
        code: 'UNKNOWN',
        message: 'Insufficient permissions',
        action: 'reconnect',
        userMessage: 'Account permissions changed. Please reconnect your brokerage account.',
        httpStatus: 403
      };

    case '404':
      return {
        code: 'UNKNOWN',
        message: 'Resource not found',
        action: 'retry',
        userMessage: 'Account or data not found. Please try again or reconnect.',
        httpStatus: 404
      };

    case '500':
    case '502':
    case '503':
      return {
        code: 'UNKNOWN',
        message: 'SnapTrade service unavailable',
        action: 'retry',
        userMessage: 'Service temporarily unavailable. Please try again in a moment.',
        httpStatus: parseInt(errorCode) || 500
      };

    default:
      return {
        code: 'UNKNOWN',
        message: errorMessage,
        action: 'retry',
        userMessage: 'Something went wrong. Please try again or contact support.',
        httpStatus: error.status || 500
      };
  }
}

/**
 * Implements exponential backoff with jitter for rate limiting
 */
export class RateLimitHandler {
  private static retryCount = new Map<string, number>();
  private static lastRetry = new Map<string, number>();

  static async handleRateLimit(
    requestKey: string,
    retryAfter?: string,
    remainingRequests?: string
  ): Promise<void> {
    const now = Date.now();
    const retryCount = this.retryCount.get(requestKey) || 0;
    const lastRetry = this.lastRetry.get(requestKey) || 0;

    // Calculate delay with exponential backoff + jitter
    let delay: number;
    if (retryAfter) {
      // Use server-provided retry-after if available
      delay = parseInt(retryAfter) * 1000;
    } else {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
      const baseDelay = Math.min(1000 * Math.pow(2, retryCount), 16000);
      const jitter = Math.random() * 1000; // Add up to 1s jitter
      delay = baseDelay + jitter;
    }

    // Ensure minimum delay between requests
    const timeSinceLastRetry = now - lastRetry;
    if (timeSinceLastRetry < delay) {
      const additionalDelay = delay - timeSinceLastRetry;
      console.log(`[RateLimit] Backing off for ${additionalDelay}ms (attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, additionalDelay));
    }

    // Update tracking
    this.retryCount.set(requestKey, retryCount + 1);
    this.lastRetry.set(requestKey, Date.now());

    // Reset after successful delay
    setTimeout(() => {
      this.retryCount.delete(requestKey);
      this.lastRetry.delete(requestKey);
    }, 60000); // Reset after 1 minute
  }

  static getRemainingRequests(headers: any): number | null {
    const remaining = headers?.['x-ratelimit-remaining'];
    return remaining ? parseInt(remaining) : null;
  }

  static getResetTime(headers: any): number | null {
    const reset = headers?.['x-ratelimit-reset'];
    return reset ? parseInt(reset) : null;
  }
}

/**
 * Detects disabled connections and provides reconnection guidance
 */
export function checkConnectionStatus(connection: any): {
  isDisabled: boolean;
  needsReconnect: boolean;
  reconnectUrl?: string;
} {
  const isDisabled = connection?.disabled === true;
  const needsReconnect = isDisabled || connection?.status === 'DISCONNECTED';
  
  let reconnectUrl: string | undefined;
  if (needsReconnect && connection?.id) {
    // Generate reconnect URL with reconnect parameter
    reconnectUrl = `/snaptrade/auth?reconnect=${connection.id}`;
  }

  return {
    isDisabled,
    needsReconnect,
    reconnectUrl
  };
}

/**
 * Enhanced error logging with correlation IDs
 */
export function logSnapTradeError(
  operation: string,
  error: any,
  requestId?: string,
  context?: Record<string, any>
): void {
  // Extract X-Request-ID from SnapTrade response headers per docs.snaptrade.com
  const snaptradeRequestId = error.response?.headers?.['x-request-id'] || 
                            error.headers?.['x-request-id'] ||
                            error.responseHeaders?.['x-request-id'];
  
  // Extract rate limit headers for burst detection per docs.snaptrade.com
  const rateLimitRemaining = error.response?.headers?.['x-ratelimit-remaining'] ||
                           error.headers?.['x-ratelimit-remaining'] ||
                           error.responseHeaders?.['x-ratelimit-remaining'];
  
  const rateLimitReset = error.response?.headers?.['x-ratelimit-reset'] ||
                        error.headers?.['x-ratelimit-reset'] ||
                        error.responseHeaders?.['x-ratelimit-reset'];

  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    requestId,
    snaptradeRequestId, // X-Request-ID from SnapTrade for correlation
    error: {
      code: error.responseBody?.code || error.code || error.status,
      message: error.responseBody?.message || error.message,
      status: error.status
    },
    rateLimitRemaining, // For burst detection
    rateLimitReset,
    context
  };

  console.error(`[SnapTrade] ${operation} failed:`, logEntry);
  
  // Enhanced logging for rate limit monitoring per docs.snaptrade.com
  if (rateLimitRemaining) {
    console.warn(`[SnapTrade Rate Limit] Operation: ${operation}, Remaining: ${rateLimitRemaining}, Reset: ${rateLimitReset}`);
    
    // Alert on low remaining requests to detect bursts
    if (parseInt(rateLimitRemaining) < 10) {
      console.error(`[SnapTrade Rate Limit ALERT] Operation: ${operation} - Only ${rateLimitRemaining} requests remaining!`);
    }
  }
  
  // Log SnapTrade Request ID for support correlation
  if (requestId) {
    console.error(`[SnapTrade] Correlation ID for support: ${requestId}`);
  }
}