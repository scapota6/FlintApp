import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    failedAttempts?: number;
    lastFailedAttempt?: number;
  };
}

const store: RateLimitStore = {};

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

/**
 * Enhanced rate limiter with different limits for different endpoint types
 */
export function createRateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = config.keyGenerator ? config.keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    
    // Clean expired entries
    if (store[key] && now > store[key].resetTime) {
      delete store[key];
    }
    
    // Initialize or increment counter
    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + config.windowMs
      };
    } else {
      store[key].count++;
    }
    
    // Check limit
    if (store[key].count > config.maxRequests) {
      if (config.onLimitReached) {
        config.onLimitReached(req, res);
      } else {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((store[key].resetTime - now) / 1000)
        });
      }
      return;
    }
    
    // Add headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', config.maxRequests - store[key].count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(store[key].resetTime / 1000));
    
    next();
  };
}

// Predefined rate limits for different endpoint types
export const rateLimits = {
  // Strict limits for authentication endpoints with brute-force protection
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (req) => `auth:${req.ip}:${(req as any).user?.claims?.sub || 'anonymous'}`,
    onLimitReached: (req, res) => {
      const userId = (req as any).user?.claims?.sub || 'anonymous';
      logger.warn('Authentication rate limit exceeded', {
        userId,
        metadata: {
          ip: req.ip,
          path: req.path,
          userAgent: req.headers['user-agent'],
          method: req.method,
        }
      });
      res.status(429).json({
        error: 'Too many authentication attempts',
        message: 'You have exceeded the maximum number of login attempts. Please wait 15 minutes before trying again.',
        retryAfter: 900 // 15 minutes in seconds
      });
    }
  }),
  
  // Moderate limits for trading operations
  trading: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req) => `trading:${(req as any).user?.claims?.sub || req.ip}`
  }),
  
  // Generous limits for data retrieval
  data: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (req) => `data:${(req as any).user?.claims?.sub || req.ip}`
  }),
  
  // Very strict limits for external API calls
  external: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (req) => `external:${(req as any).user?.claims?.sub || req.ip}`
  })
};