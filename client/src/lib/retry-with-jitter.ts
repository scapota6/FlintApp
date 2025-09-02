/**
 * Retry utility with exponential backoff and jitter
 * Implements retry logic for handling rate limits and transient errors
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitterMax?: number;
  retryOn?: (error: any) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  jitterMax: 1000, // 1 second jitter
  retryOn: (error: any) => {
    // Retry on 429 (rate limit), 502, 503, 504 (server errors)
    const status = error?.response?.status || error?.status;
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = options.baseDelay * Math.pow(2, attempt);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
  
  // Add jitter: random value between 0 and jitterMax
  const jitter = Math.random() * options.jitterMax;
  
  return cappedDelay + jitter;
}

export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Don't retry if the error is not retryable
      if (!opts.retryOn(error)) {
        break;
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(attempt, opts);
      
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, {
        error: error?.message || error,
        status: error?.response?.status || error?.status,
        requestId: error?.response?.headers?.['x-request-id']
      });

      await delay(delayMs);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Enhanced fetch wrapper with retry logic and request ID tracking
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID header
  const enhancedOptions = {
    ...options,
    headers: {
      ...options.headers,
      'X-Request-ID': requestId
    }
  };

  return retryWithJitter(
    async () => {
      const response = await fetch(url, enhancedOptions);
      
      // Store request ID for error tracking
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).response = response;
        (error as any).requestId = requestId;
        throw error;
      }
      
      return response;
    },
    retryOptions
  );
}

/**
 * Query client configuration with retry logic
 */
export const retryQueryOptions = {
  retry: (failureCount: number, error: any) => {
    // Don't retry beyond 3 attempts
    if (failureCount >= 3) return false;
    
    // Only retry on specific error codes
    const status = error?.response?.status || error?.status;
    return status === 429 || status === 502 || status === 503 || status === 504;
  },
  retryDelay: (attemptIndex: number) => {
    // Exponential backoff with jitter
    return calculateDelay(attemptIndex, defaultOptions);
  }
};