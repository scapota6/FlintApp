console.log('[ENV CHECK] SNAPTRADE_CLIENT_ID =', process.env.SNAPTRADE_CLIENT_ID);
console.log('[ENV CHECK] SNAPTRADE_CONSUMER_KEY length =', process.env.SNAPTRADE_CONSUMER_KEY?.length);
console.log('[ENV CHECK] SNAPTRADE_REDIRECT_URI =', process.env.SNAPTRADE_REDIRECT_URI);

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initSentry, sentryErrorHandler } from "./lib/sentry";
import { logger } from "@shared/logger";
import { attachCSRFToken, validateCSRFToken } from "./middleware/csrf";
import snaptradeRouter from "./routes/snaptrade";
import ordersRouter from "./routes/orders";
import watchlistRouter from "./routes/watchlist";
import quotesRouter from "./routes/quotes";

// Initialize Sentry for error tracking
initSentry();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  // Mount SnapTrade API router BEFORE auth setup (no auth required)
  app.use("/api/snaptrade", snaptradeRouter);

  const server = await registerRoutes(app);

  // Add CSRF protection after session middleware is initialized
  app.use(attachCSRFToken);
  
  // Apply CSRF validation to state-changing routes
  app.use("/api", validateCSRFToken);
  
  // Mount Orders API router
  app.use("/api", ordersRouter);
  
  // Mount Accounts Brokerage API router
  const accountsBrokerageRouter = (await import("./routes/accounts-brokerage")).default;
  app.use("/api", accountsBrokerageRouter);
  
  // Mount Watchlist API router
  app.use("/api/watchlist", watchlistRouter);
  
  // Mount Quotes API router
  app.use("/api/quotes", quotesRouter);
  
  // Mount Market Data API router
  const marketDataRouter = (await import("./routes/market-data")).default;
  app.use("/api/market-data", marketDataRouter);
  
  // Mount Banking API router
  const bankingRouter = (await import("./routes/banking")).default;
  app.use("/api/banking", bankingRouter);
  
  // Mount Transfers API router
  const transfersRouter = (await import("./routes/transfers")).default;
  app.use("/api/transfers", transfersRouter);
  
  // Mount Deposits API router
  const depositsRouter = (await import("./routes/deposits")).default;
  app.use("/api/deposits", depositsRouter);
  
  // Mount Search API router
  const searchRouter = (await import("./routes/search")).default;
  app.use("/api/search", searchRouter);
  
  // Mount Simple Watchlist API router
  const watchlistSimpleRouter = (await import("./routes/watchlist-simple")).default;
  app.use("/api/watchlist", watchlistSimpleRouter);
  
  // Mount Holdings API router
  const holdingsRouter = (await import("./routes/holdings")).default;
  app.use("/api/holdings", holdingsRouter);
  
  // Mount Asset Detail API router
  const assetDetailRouter = (await import("./routes/asset-detail")).default;
  app.use("/api/asset", assetDetailRouter);

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
