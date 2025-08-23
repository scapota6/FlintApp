import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import csrf from "csurf";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initSentry, sentryErrorHandler } from "./lib/sentry";
import { logger } from "@shared/logger";
import snaptradeRouter from "./routes/snaptrade";
import ordersRouter from "./routes/orders";
import orderPreviewRouter from "./routes/order-preview";
import watchlistRouter from "./routes/watchlist";
import quotesRouter from "./routes/quotes";

// Initialize Sentry for error tracking
initSentry();

const app = express();

(async () => {
  try {
  // 1) Security + parsers
  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // 2) CORS — allow credentials from your client origin
  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'https://28036d48-949d-4fd5-9e63-54ed8b7fd662-00-1i1qwnyczdy9x.kirk.replit.dev';
  app.use(cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-csrf-token'],
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  }));

  // 3) Trust proxy so Secure cookies work behind Replit's TLS
  app.set('trust proxy', 1);

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
  
  // Mount SnapTrade API router BEFORE auth setup (no auth required)
  app.use("/api/snaptrade", snaptradeRouter);

  // Initialize authentication and base routes
  const server = await registerRoutes(app);
  
  // Mount routes that REQUIRE authentication AFTER passport is initialized
  // Mount SnapTrade connections router
  const connectionsSnaptradeRouter = (await import("./routes/connections.snaptrade")).default;
  app.use("/api", connectionsSnaptradeRouter);
  
  // Mount disconnect routes
  const disconnectRouter = (await import("./routes/connections/disconnect")).default;
  app.use("/api/connections/disconnect", disconnectRouter);
  
  // Mount account details route
  const accountDetailsRouter = (await import("./routes/account-details")).default;
  app.use("/api", accountDetailsRouter);
  
  // Mount payment capability route
  const paymentCapabilityRouter = (await import("./routes/payment-capability")).default;
  app.use("/api", paymentCapabilityRouter);
  
  // Mount accounts route
  const accountsRouter = (await import("./routes/accounts")).default;
  app.use("/api/accounts", accountsRouter);

  // 4) CSRF (double-submit cookie)
  const isProd = process.env.NODE_ENV === 'production';
  app.use(csrf({
    cookie: {
      key: 'flint_csrf',
      path: '/',                 // must cover /api/*
      sameSite: isProd ? 'none' : 'lax', // 'none' for cross-subdomain; 'lax' for same-origin dev
      secure: isProd,            // Secure=true in prod (https)
      httpOnly: false,           // double-submit pattern: JS must read the token to send in header
    }
  }));

  // 5) Issue CSRF tokens for the client to read
  app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // 6) CSRF error -> JSON (not HTML)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).json({
        message: 'Invalid CSRF token',
        code: 'CSRF_INVALID',
      });
    }
    return res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
  });
  
  // Mount Orders API router
  app.use("/api", ordersRouter);
  
  // Mount Order Preview API router (SnapTrade two-step process)
  app.use("/api/order-preview", orderPreviewRouter);
  
  // Mount Accounts Brokerage API router
  const accountsBrokerageRouter = (await import("./routes/accounts-brokerage")).default;
  app.use("/api", accountsBrokerageRouter);
  

  
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
  
  // Mount Teller API router
  const tellerRouter = (await import("./routes/teller")).default;
  app.use("/api/teller", tellerRouter);
  
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
  
  // Mount Trading API router
  const tradingRouter = (await import("./routes/trading")).default;
  app.use("/api/trade", tradingRouter);

  // ========================================
  // IMPORTANT: All API routes must be mounted BEFORE static files
  // ========================================
  
  // JSON error handler for API routes (ensures even crashes return JSON)
  app.use("/api/*", (err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const body = {
      message: err.message || 'Internal Server Error',
      code: err.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    };
    res.status(status).type('application/json').send(body);
  });
  
  // 404 handler for API routes (must be before static files)
  app.use("/api/*", (req: Request, res: Response) => {
    res.status(404).json({ message: "Not found", path: req.originalUrl });
  });

  // ========================================
  // Static files and catch-all route LAST
  // ========================================
  
  // Setup Vite (dev) or serve static files (prod)
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  
  // Global error handler (ensures API routes always return JSON)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // For API routes, always return JSON
    if (req.path.startsWith("/api")) {
      const body = {
        message: err.message || 'Internal Server Error',
        code: err.code,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      };
      res.status(status).type('application/json').send(body);
    } else {
      // For non-API routes, let the default error handler manage it
      const message = err.message || "Internal Server Error";
      if (process.env.NODE_ENV === 'development') {
        console.error(err);
      }
      res.status(status).send(message);
    }
  });

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
  
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
