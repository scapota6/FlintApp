import type { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { encryptionService } from '../services/EncryptionService';
import snaptrade from 'snaptrade-typescript-sdk';

// Version information
const APP_VERSION = process.env.npm_package_version || '1.0.0';
const NODE_VERSION = process.version;

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: {
    app: string;
    node: string;
    dependencies: Record<string, string>;
  };
  services: {
    database: ServiceStatus;
    snaptrade: ServiceStatus;
    teller: ServiceStatus;
    polygon: ServiceStatus;
    finnhub: ServiceStatus;
    stripe: ServiceStatus;
    encryption: ServiceStatus;
    alertMonitor: ServiceStatus;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

interface ServiceStatus {
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  message?: string;
  lastCheck?: string;
}

// Cache for service statuses
const serviceStatusCache = new Map<string, { status: ServiceStatus; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

async function checkDatabaseHealth(): Promise<ServiceStatus> {
  const cacheKey = 'database';
  const cached = serviceStatusCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.status;
  }

  const startTime = Date.now();
  try {
    // Simple query to check database connectivity
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - startTime;
    
    const status: ServiceStatus = {
      status: latency < 100 ? 'operational' : 'degraded',
      latency,
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  } catch (error) {
    const status: ServiceStatus = {
      status: 'down',
      message: 'Database connection failed',
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  }
}

async function checkSnapTradeHealth(): Promise<ServiceStatus> {
  const cacheKey = 'snaptrade';
  const cached = serviceStatusCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.status;
  }

  const startTime = Date.now();
  try {
    // Check if SnapTrade API is accessible
    const response = await fetch('https://api.snaptrade.com/api/v1/status');
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const status: ServiceStatus = {
        status: data.online ? 'operational' : 'degraded',
        latency,
        message: `Version: ${data.version}`,
        lastCheck: new Date().toISOString()
      };
      
      serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
      return status;
    } else {
      const status: ServiceStatus = {
        status: 'degraded',
        latency,
        message: `HTTP ${response.status}`,
        lastCheck: new Date().toISOString()
      };
      
      serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
      return status;
    }
  } catch (error) {
    const status: ServiceStatus = {
      status: 'down',
      message: 'SnapTrade API unreachable',
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  }
}

async function checkTellerHealth(): Promise<ServiceStatus> {
  const cacheKey = 'teller';
  const cached = serviceStatusCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.status;
  }

  const startTime = Date.now();
  try {
    // Check Teller API status
    const response = await fetch('https://api.teller.io/', {
      method: 'HEAD'
    });
    const latency = Date.now() - startTime;
    
    const status: ServiceStatus = {
      status: response.ok ? 'operational' : 'degraded',
      latency,
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  } catch (error) {
    const status: ServiceStatus = {
      status: 'down',
      message: 'Teller API unreachable',
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  }
}

async function checkPolygonHealth(): Promise<ServiceStatus> {
  const cacheKey = 'polygon';
  const cached = serviceStatusCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.status;
  }

  const startTime = Date.now();
  try {
    const response = await fetch('https://api.polygon.io/v1/marketstatus/now');
    const latency = Date.now() - startTime;
    
    const status: ServiceStatus = {
      status: response.ok ? 'operational' : 'degraded',
      latency,
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  } catch (error) {
    const status: ServiceStatus = {
      status: 'down',
      message: 'Polygon API unreachable',
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  }
}

async function checkFinnhubHealth(): Promise<ServiceStatus> {
  const cacheKey = 'finnhub';
  const cached = serviceStatusCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.status;
  }

  const startTime = Date.now();
  try {
    const response = await fetch('https://finnhub.io/api/v1/stock/symbol?exchange=US&token=test', {
      method: 'HEAD'
    });
    const latency = Date.now() - startTime;
    
    const status: ServiceStatus = {
      status: response.status === 401 || response.ok ? 'operational' : 'degraded',
      latency,
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  } catch (error) {
    const status: ServiceStatus = {
      status: 'down',
      message: 'Finnhub API unreachable',
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  }
}

async function checkStripeHealth(): Promise<ServiceStatus> {
  const cacheKey = 'stripe';
  const cached = serviceStatusCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.status;
  }

  const startTime = Date.now();
  try {
    const response = await fetch('https://api.stripe.com/', {
      method: 'HEAD'
    });
    const latency = Date.now() - startTime;
    
    const status: ServiceStatus = {
      status: response.ok || response.status === 401 ? 'operational' : 'degraded',
      latency,
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  } catch (error) {
    const status: ServiceStatus = {
      status: 'down',
      message: 'Stripe API unreachable',
      lastCheck: new Date().toISOString()
    };
    
    serviceStatusCache.set(cacheKey, { status, timestamp: Date.now() });
    return status;
  }
}

function checkEncryptionHealth(): ServiceStatus {
  return {
    status: encryptionService.isConfigured() ? 'operational' : 'degraded',
    message: encryptionService.isConfigured() 
      ? 'Encryption keys configured' 
      : 'Using default encryption keys',
    lastCheck: new Date().toISOString()
  };
}

function checkAlertMonitorHealth(): ServiceStatus {
  // Check if alert monitor is running based on global state
  const isRunning = global.alertMonitorRunning || false;
  
  return {
    status: isRunning ? 'operational' : 'down',
    message: isRunning ? 'Alert monitor active' : 'Alert monitor not running',
    lastCheck: new Date().toISOString()
  };
}

function calculateOverallStatus(services: Record<string, ServiceStatus>): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(services);
  const downCount = statuses.filter(s => s.status === 'down').length;
  const degradedCount = statuses.filter(s => s.status === 'degraded').length;
  
  if (downCount > 0) {
    return 'unhealthy';
  } else if (degradedCount > 2) {
    return 'degraded';
  }
  return 'healthy';
}

export function registerHealthRoutes(app: Express) {
  // Main health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      // Parallel health checks for all services
      const [
        database,
        snaptrade,
        teller,
        polygon,
        finnhub,
        stripe
      ] = await Promise.all([
        checkDatabaseHealth(),
        checkSnapTradeHealth(),
        checkTellerHealth(),
        checkPolygonHealth(),
        checkFinnhubHealth(),
        checkStripeHealth()
      ]);
      
      const services = {
        database,
        snaptrade,
        teller,
        polygon,
        finnhub,
        stripe,
        encryption: checkEncryptionHealth(),
        alertMonitor: checkAlertMonitorHealth()
      };
      
      const healthCheck: HealthCheckResult = {
        status: calculateOverallStatus(services),
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: {
          app: APP_VERSION,
          node: NODE_VERSION,
          dependencies: {
            express: '4.x',
            drizzle: '0.x',
            snaptrade: '4.x',
            stripe: '13.x',
            react: '18.x'
          }
        },
        services,
        performance: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      };
      
      // Set appropriate HTTP status based on health
      const httpStatus = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'degraded' ? 200 : 503;
      
      res.status(httpStatus).json(healthCheck);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Simple liveness probe
  app.get('/api/health/live', (req, res) => {
    res.status(200).json({ status: 'alive' });
  });

  // Readiness probe
  app.get('/api/health/ready', async (req, res) => {
    try {
      // Check if database is ready
      const dbStatus = await checkDatabaseHealth();
      
      if (dbStatus.status === 'operational') {
        res.status(200).json({ status: 'ready' });
      } else {
        res.status(503).json({ status: 'not ready', reason: 'Database not operational' });
      }
    } catch (error) {
      res.status(503).json({ status: 'not ready', reason: 'Health check failed' });
    }
  });

  // Background job queue status
  app.get('/api/health/jobs', (req, res) => {
    const jobStatus = {
      alertMonitor: {
        status: global.alertMonitorRunning ? 'running' : 'stopped',
        lastRun: global.alertMonitorLastRun || null,
        nextRun: global.alertMonitorNextRun || null,
        processedCount: global.alertMonitorProcessedCount || 0,
        errorCount: global.alertMonitorErrorCount || 0
      },
      dataSync: {
        status: 'idle',
        lastSync: global.dataSyncLastRun || null,
        nextSync: null
      }
    };
    
    res.json(jobStatus);
  });

  // Service-specific health endpoints
  app.get('/api/health/services/:service', async (req, res) => {
    const { service } = req.params;
    
    let status: ServiceStatus;
    
    switch (service) {
      case 'database':
        status = await checkDatabaseHealth();
        break;
      case 'snaptrade':
        status = await checkSnapTradeHealth();
        break;
      case 'teller':
        status = await checkTellerHealth();
        break;
      case 'polygon':
        status = await checkPolygonHealth();
        break;
      case 'finnhub':
        status = await checkFinnhubHealth();
        break;
      case 'stripe':
        status = await checkStripeHealth();
        break;
      case 'encryption':
        status = checkEncryptionHealth();
        break;
      case 'alertMonitor':
        status = checkAlertMonitorHealth();
        break;
      default:
        return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({ service, ...status });
  });
}

// Declare global variables for alert monitor tracking
declare global {
  var alertMonitorRunning: boolean;
  var alertMonitorLastRun: string | null;
  var alertMonitorNextRun: string | null;
  var alertMonitorProcessedCount: number;
  var alertMonitorErrorCount: number;
  var dataSyncLastRun: string | null;
}