import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

class MemoryCache {
  private store: CacheStore = {};
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  get(key: string): any | null {
    const entry = this.store[key];
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      delete this.store[key];
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any, ttl: number): void {
    // If cache is full, remove oldest entries
    if (Object.keys(this.store).length >= this.maxSize) {
      this.evictOldest();
    }
    
    this.store[key] = {
      data,
      timestamp: Date.now(),
      ttl
    };
  }

  delete(key: string): void {
    delete this.store[key];
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of Object.entries(this.store)) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      delete this.store[oldestKey];
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Object.entries(this.store)) {
      if (now > entry.timestamp + entry.ttl) {
        delete this.store[key];
      }
    }
  }

  clear(): void {
    this.store = {};
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Global cache instance
const cache = new MemoryCache();

export interface CacheConfig {
  ttl: number; // time to live in milliseconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
}

export function createCacheMiddleware(config: CacheConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Check condition if provided
    if (config.condition && !config.condition(req, res)) {
      return next();
    }
    
    // Generate cache key
    const key = config.keyGenerator 
      ? config.keyGenerator(req)
      : `${req.path}:${JSON.stringify(req.query)}`;
    
    // Try to get from cache
    const cached = cache.get(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }
    
    // Capture response
    const originalJson = res.json;
    res.json = function(data: any) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(key, data, config.ttl);
        res.setHeader('X-Cache', 'MISS');
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Predefined cache configurations
export const cacheConfigs = {
  // Short-term cache for frequently changing data
  short: createCacheMiddleware({
    ttl: 30 * 1000, // 30 seconds
    keyGenerator: (req) => `short:${req.path}:${JSON.stringify(req.query)}:${req.user?.claims?.sub || 'anonymous'}`
  }),
  
  // Medium-term cache for semi-static data
  medium: createCacheMiddleware({
    ttl: 5 * 60 * 1000, // 5 minutes
    keyGenerator: (req) => `medium:${req.path}:${JSON.stringify(req.query)}:${req.user?.claims?.sub || 'anonymous'}`
  }),
  
  // Long-term cache for static data
  long: createCacheMiddleware({
    ttl: 30 * 60 * 1000, // 30 minutes
    keyGenerator: (req) => `long:${req.path}:${JSON.stringify(req.query)}`
  }),
  
  // Market data cache (short-lived due to volatility)
  marketData: createCacheMiddleware({
    ttl: 15 * 1000, // 15 seconds
    keyGenerator: (req) => `market:${req.path}:${JSON.stringify(req.query)}`,
    condition: (req) => req.path.includes('/api/quotes') || req.path.includes('/api/market')
  }),
  
  // User-specific data cache
  userData: createCacheMiddleware({
    ttl: 2 * 60 * 1000, // 2 minutes
    keyGenerator: (req) => `user:${req.user?.claims?.sub}:${req.path}:${JSON.stringify(req.query)}`,
    condition: (req) => !!req.user?.claims?.sub
  })
};

// Cache management functions
export const cacheManager = {
  clear: () => cache.clear(),
  delete: (key: string) => cache.delete(key),
  
  // Clear user-specific cache
  clearUser: (userId: string) => {
    const userPrefix = `user:${userId}:`;
    Object.keys(cache['store']).forEach(key => {
      if (key.startsWith(userPrefix)) {
        cache.delete(key);
      }
    });
  },
  
  // Clear market data cache
  clearMarketData: () => {
    const marketPrefix = 'market:';
    Object.keys(cache['store']).forEach(key => {
      if (key.startsWith(marketPrefix)) {
        cache.delete(key);
      }
    });
  }
};

export { cache };