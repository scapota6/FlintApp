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

// Working SnapTrade & Teller endpoints (no auth)
app.post('/api/snaptrade/register', async (req, res) => {
  try {
    // For now, return a working test URL for SnapTrade
    res.json({
      success: true,
      url: 'https://connect.snaptrade.com/connect?user_id=scapota@flint-investing.com&client_id=FLINT-AGFQD',
      userId: 'scapota@flint-investing.com',
    });
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
  
  // Mount Market Data API router
  const marketDataRouter = (await import("./routes/market-data")).default;
  app.use("/api/market-data", marketDataRouter);

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
