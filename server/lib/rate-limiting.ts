/**
 * Rate limiting and 429 backoff handling for SnapTrade API
 */

interface RateLimitState {
  lastRequest: number;
  retryAfter: number;
  requestCount: number;
  windowStart: number;
}

class RateLimitManager {
  private states = new Map<string, RateLimitState>();
  private readonly windowMs = 60000; // 1 minute window
  private readonly maxRequests = 100; // Default limit per minute

  /**
   * Check if request should be rate limited
   */
  shouldLimit(key: string): { limited: boolean; retryAfter?: number } {
    const now = Date.now();
    const state = this.states.get(key);

    if (!state) {
      // First request for this key
      this.states.set(key, {
        lastRequest: now,
        retryAfter: 0,
        requestCount: 1,
        windowStart: now
      });
      return { limited: false };
    }

    // Check if we're in a retry-after period
    if (state.retryAfter > 0 && now < state.retryAfter) {
      return { 
        limited: true, 
        retryAfter: Math.ceil((state.retryAfter - now) / 1000) 
      };
    }

    // Reset window if needed
    if (now - state.windowStart >= this.windowMs) {
      state.windowStart = now;
      state.requestCount = 1;
      state.retryAfter = 0;
    } else {
      state.requestCount++;
    }

    // Check if we've exceeded the rate limit
    if (state.requestCount > this.maxRequests) {
      const retryAfter = state.windowStart + this.windowMs;
      state.retryAfter = retryAfter;
      return { 
        limited: true, 
        retryAfter: Math.ceil((retryAfter - now) / 1000) 
      };
    }

    state.lastRequest = now;
    return { limited: false };
  }

  /**
   * Handle 429 response from SnapTrade API
   */
  handle429(key: string, retryAfterHeader?: string, rateLimitRemaining?: string): number {
    const now = Date.now();
    let retryAfterMs: number;

    if (retryAfterHeader) {
      // Parse retry-after header (could be seconds or HTTP date)
      const retryAfterSeconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(retryAfterSeconds)) {
        retryAfterMs = retryAfterSeconds * 1000;
      } else {
        // Try parsing as HTTP date
        const retryAfterDate = new Date(retryAfterHeader);
        retryAfterMs = retryAfterDate.getTime() - now;
      }
    } else {
      // Default backoff: exponential with jitter
      const baseDelay = 1000; // 1 second base
      const maxDelay = 60000; // 1 minute max
      const state = this.states.get(key);
      const attemptCount = state?.requestCount || 1;
      
      retryAfterMs = Math.min(
        baseDelay * Math.pow(2, attemptCount) + Math.random() * 1000,
        maxDelay
      );
    }

    const retryAfter = now + retryAfterMs;
    
    // Update state
    const existingState = this.states.get(key) || {
      lastRequest: now,
      retryAfter: 0,
      requestCount: 0,
      windowStart: now
    };
    
    this.states.set(key, {
      ...existingState,
      retryAfter,
      lastRequest: now
    });

    console.warn('[Rate Limit] 429 rate limit hit:', {
      key,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      rateLimitRemaining: rateLimitRemaining || 'unknown',
      retryAfterHeader
    });

    return Math.ceil(retryAfterMs / 1000);
  }

  /**
   * Clear rate limit state for a key
   */
  clearLimit(key: string): void {
    this.states.delete(key);
  }

  /**
   * Get current rate limit state for debugging
   */
  getState(key: string): RateLimitState | undefined {
    return this.states.get(key);
  }

  /**
   * Cleanup old states (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = this.windowMs * 2; // Keep states for 2 windows

    for (const [key, state] of this.states.entries()) {
      if (now - state.lastRequest > maxAge && now > state.retryAfter) {
        this.states.delete(key);
      }
    }
  }
}

export const rateLimitManager = new RateLimitManager();

/**
 * Rate limiting middleware for SnapTrade API routes
 */
export function rateLimitMiddleware(keyExtractor: (req: any) => string) {
  return (req: any, res: any, next: any) => {
    const key = keyExtractor(req);
    const { limited, retryAfter } = rateLimitManager.shouldLimit(key);

    if (limited) {
      res.set('Retry-After', retryAfter?.toString() || '60');
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    next();
  };
}

/**
 * Enhanced fetch wrapper with automatic rate limiting and backoff
 */
export async function fetchWithRateLimit(
  key: string,
  fetchFn: () => Promise<any>,
  maxRetries: number = 3
): Promise<any> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Check rate limit before making request
      const { limited, retryAfter } = rateLimitManager.shouldLimit(key);
      
      if (limited && retryAfter) {
        console.log('[Rate Limit] Waiting for rate limit to clear:', {
          key,
          retryAfterSeconds: retryAfter,
          attempt: attempt + 1
        });
        
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      }

      // Make the request
      const result = await fetchFn();
      return result;

    } catch (error: any) {
      // Handle 429 rate limit response
      if (error.response?.status === 429) {
        const retryAfterSeconds = rateLimitManager.handle429(
          key,
          error.response.headers?.['retry-after'],
          error.response.headers?.['x-ratelimit-remaining']
        );

        attempt++;
        if (attempt >= maxRetries) {
          console.error('[Rate Limit] Max retries exceeded for 429:', {
            key,
            attempts: attempt,
            lastRetryAfter: retryAfterSeconds
          });
          throw error;
        }

        console.log('[Rate Limit] Retrying after 429:', {
          key,
          attempt: attempt + 1,
          retryAfterSeconds,
          maxRetries
        });

        // Wait for the retry-after period
        await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
        continue;
      }

      // Re-throw non-429 errors
      throw error;
    }
  }

  throw new Error(`Rate limit retries exhausted for key: ${key}`);
}

/**
 * Cleanup rate limit states periodically
 */
setInterval(() => {
  rateLimitManager.cleanup();
}, 5 * 60 * 1000); // Cleanup every 5 minutes