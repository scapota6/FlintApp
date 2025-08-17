// Bootstrap environment loading first
import 'dotenv/config';

// sanitize whitespace/newlines in env
for (const k of ['SNAPTRADE_CLIENT_ID','SNAPTRADE_CONSUMER_KEY','SNAPTRADE_ENV','SNAPTRADE_REDIRECT_URI']) {
  if (process.env[k]) process.env[k] = process.env[k]!.trim().replace(/\r|\n/g,'');
}

console.log('[ENV CHECK]', {
  CLIENT_ID: process.env.SNAPTRADE_CLIENT_ID,
  CONSUMER_KEY_LEN: process.env.SNAPTRADE_CONSUMER_KEY?.length,
  ENV: process.env.SNAPTRADE_ENV,
  REDIRECT: process.env.SNAPTRADE_REDIRECT_URI,
});

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
  
  // Mount SnapTrade connections router
  const connectionsSnaptradeRouter = (await import("./routes/connections.snaptrade")).default;
  app.use("/api", connectionsSnaptradeRouter);
  
  // Mount disconnect routes
  const disconnectRouter = (await import("./routes/connections/disconnect")).default;
  app.use("/api/connections/disconnect", disconnectRouter);

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
  
  // Mount Account Details API router
  const accountDetailsRouter = (await import("./routes/account-details")).default;
  app.use("/api", accountDetailsRouter);
  
  // Mount Watchlist API router
  app.use("/api/watchlist", watchlistRouter);

  // Development-only repair endpoint for 409 SNAPTRADE_USER_MISMATCH
  if (process.env.NODE_ENV === 'development') {
    const { authApi } = await import("./lib/snaptrade");
    const { deleteSnapUser, saveSnapUser } = await import("./store/snapUsers");

    app.post('/api/debug/snaptrade/repair-user', async (req, res) => {
      try {
        const userId = String(req.body?.userId || '').trim();
        if (!userId) return res.status(400).json({ message: 'userId required' });

        await authApi.deleteSnapTradeUser({ userId }); // provider-side async delete
        await deleteSnapUser(userId);
        const created = await authApi.registerSnapTradeUser({ userId });
        await saveSnapUser({ userId: created.data.userId!, userSecret: created.data.userSecret! });
        res.json({ ok: true, userId, userSecretLen: created.data.userSecret?.length || 0 });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: e?.responseBody || e?.message });
      }
    });
  }
  
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
