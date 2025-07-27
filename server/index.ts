import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import snaptradeRouter from "./routes/snaptrade";
import ordersRouter from "./routes/orders";
import watchlistRouter from "./routes/watchlist";
import quotesRouter from "./routes/quotes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Import SnapTrade SDK for proper connection flow
import { Snaptrade } from 'snaptrade-typescript-sdk';

let snapTradeClient: Snaptrade | null = null;

// Initialize SnapTrade SDK
if (process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CLIENT_SECRET) {
  snapTradeClient = new Snaptrade({
    clientId: process.env.SNAPTRADE_CLIENT_ID,
    consumerKey: process.env.SNAPTRADE_CLIENT_SECRET,
  });
}

// SnapTrade connection URL generation (proper implementation)
app.get('/api/snaptrade/connect-url', async (req, res) => {
  try {
    if (!snapTradeClient) {
      return res.status(500).json({ message: 'SnapTrade client not initialized' });
    }

    const userId = 'scapota@flint-investing.com'; // For testing
    let userSecret: string;

    try {
      // Try to register user first
      const registerResponse = await snapTradeClient.authentication.registerSnapTradeUser({
        userId: userId,
      });
      userSecret = registerResponse.data?.userSecret || '';
    } catch (error: any) {
      // User might already exist, try to login
      if (error.message?.includes('already exist')) {
        // For now, use a test secret - in production this would come from database
        userSecret = 'test_secret_' + Date.now();
      } else {
        throw error;
      }
    }

    // Get proper connection URL using SnapTrade connections API
    const connectResponse = await snapTradeClient.connections.getConnectBrokerageURL({
      userId: userId,
      userSecret: userSecret,
      returnUrl: `${req.protocol}://${req.get('host')}/api/snaptrade/connection-portal`
    });

    res.json({
      success: true,
      url: connectResponse.data?.redirectURI || connectResponse.data?.url,
      userId: userId,
    });

  } catch (error: any) {
    console.error('SnapTrade connection URL error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate SnapTrade connection URL',
    });
  }
});

// SnapTrade connection portal callback handler
app.post('/api/snaptrade/connection-portal', async (req, res) => {
  try {
    const { state, token } = req.query;
    
    // Validate state and token parameters
    if (!state || !token) {
      return res.status(400).send(`
        <script>
          window.opener?.postMessage({ success: false, error: 'Invalid connection parameters' }, '*');
          window.close();
        </script>
      `);
    }

    // Send success message to parent window and close popup
    res.send(`
      <script>
        window.opener?.postMessage({ success: true, message: 'Brokerage connected successfully' }, '*');
        window.close();
      </script>
    `);

  } catch (error: any) {
    console.error('SnapTrade connection portal error:', error);
    res.status(500).send(`
      <script>
        window.opener?.postMessage({ success: false, error: 'Connection failed' }, '*');
        window.close();
      </script>
    `);
  }
});

// Legacy register endpoint (redirect to connect-url)
app.post('/api/snaptrade/register', async (req, res) => {
  try {
    // Redirect to proper connect-url endpoint
    const connectUrlResponse = await fetch(`${req.protocol}://${req.get('host')}/api/snaptrade/connect-url`);
    const data = await connectUrlResponse.json();
    res.json(data);
  } catch (error: any) {
    console.error('SnapTrade registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register SnapTrade user',
    });
  }
});

app.post('/api/teller/connect-init', async (req, res) => {
  try {
    res.json({
      applicationId: 'app_o1id4a9b5m5o3po',
      environment: 'sandbox',
    });
  } catch (error: any) {
    console.error('Teller connection error:', error);
    res.status(500).json({ message: 'Failed to initialize Teller connection' });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Mount SnapTrade API router (unified routes only)
  app.use("/api/snaptrade", snaptradeRouter);
  
  // Mount Orders API router
  app.use("/api/orders", ordersRouter);
  
  // Mount Watchlist API router
  app.use("/api/watchlist", watchlistRouter);
  
  // Mount Quotes API router
  app.use("/api/quotes", quotesRouter);
  
  // Mount enhanced SnapTrade order management
  const snaptradeOrderRouter = (await import("./routes/snaptrade-order-management")).default;
  app.use("/api/snaptrade", snaptradeOrderRouter);
  
  // Unified market data endpoint
  const { unifiedMarketDataService } = await import("./services/market-data-unified");
  
  app.get('/api/market-data', async (req, res) => {
    try {
      const { symbol } = req.query;
      
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ error: 'Symbol parameter required' });
      }

      const quote = await unifiedMarketDataService.getMarketData(symbol.toUpperCase());
      
      if (!quote) {
        return res.status(404).json({ error: `Quote not found for symbol ${symbol}` });
      }

      res.json(quote);
    } catch (error: any) {
      console.error('Market data error:', error);
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });

  app.post('/api/market-data/bulk', async (req, res) => {
    try {
      const { symbols } = req.body;
      
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'Symbols array required' });
      }

      if (symbols.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 symbols allowed' });
      }

      const quotes = await unifiedMarketDataService.getMultipleQuotes(symbols);
      res.json(quotes);
    } catch (error: any) {
      console.error('Bulk market data error:', error);
      res.status(500).json({ error: 'Failed to fetch bulk market data' });
    }
  });

  // Mount original Market Data API router (for compatibility)
  const marketDataRouter = (await import("./routes/market-data")).default;
  app.use("/api/market-data-legacy", marketDataRouter);

  // Debug routers disabled - using unified flow only
  // app.use("/api/snaptrade-debug", snaptradeDebugRouter);
  // app.use("/api/snaptrade-debug-secret", snaptradeDebugSecretRouter);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
