import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { installCsrf } from "./security/csrf";
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
  // 1) Security + parsers (improved CSP configuration)
  const SELF = "'self'";
  const UNSAFE_INLINE = "'unsafe-inline'"; // keep temporarily if you rely on inline styles/scripts
  const isProdCSP = process.env.NODE_ENV === 'production';
  
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: [SELF],
        // Scripts
        scriptSrc: [
          SELF,
          UNSAFE_INLINE,              // ideally replace with nonces/hashes later
          'https://cdn.teller.io',
          'https://js.stripe.com',
          'https://js.sentry-cdn.com',
          'https://replit.com'
        ],
        // Styles (separate style-src-elem is respected by newer browsers)
        styleSrc: [SELF, UNSAFE_INLINE, 'https://fonts.googleapis.com'],
        styleSrcElem: [SELF, UNSAFE_INLINE, 'https://fonts.googleapis.com'],
        // Fonts
        fontSrc: [SELF, 'https://fonts.gstatic.com', 'data:'],
        // Frames (Stripe elements, Teller Connect iframed)
        frameSrc: [
          SELF,
          'https://teller.io',
          'https://cdn.teller.io',
          'https://js.stripe.com',
          'https://hooks.stripe.com'
        ],
        // XHR/WebSocket endpoints
        connectSrc: [
          SELF,
          'https://api.teller.io',
          'https://cdn.teller.io',
          'https://js.stripe.com',
          'https://api.stripe.com',
          'https://hooks.stripe.com',
          'https://o0.ingest.sentry.io',
          'https://o1.ingest.sentry.io',
          'https://sentry.io',
          // add your exact Replit base (scheme+host+port) if you ever call absolute URLs
        ],
        imgSrc: [SELF, 'data:'],
        baseUri: [SELF],
        frameAncestors: [SELF], // adjust if you embed your app elsewhere
        // If you use Stripe web workers or wasm, add workerSrc/childSrc as needed.
      },
      // reportOnly: true, // optionally trial first to see console reports without blocking
    },
    crossOriginEmbedderPolicy: false, // keep false if third-party scripts require it
  }));
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
  
  // Add webhook route before CSRF to allow external calls
  app.post('/api/snaptrade/webhooks', async (req: Request, res: Response) => {
    try {
      // Import webhook handler dynamically
      const { handleSnapTradeWebhook } = await import('./routes/snaptrade-webhooks');
      await handleSnapTradeWebhook(req, res);
    } catch (error) {
      console.error('[Webhook] Error:', error);
      res.status(500).json({ 
        error: { 
          code: 'WEBHOOK_ERROR', 
          message: 'Webhook processing failed',
          requestId: req.headers['x-request-id'] as string || 'unknown'
        } 
      });
    }
  });

  // 4) CSRF setup (must come BEFORE protected routes)
  installCsrf(app);

  // Mount SnapTrade API router BEFORE auth setup (no auth required)
  app.use("/api/snaptrade", snaptradeRouter);
  
  // Mount versioned SnapTrade routes with proper error handling
  const versionedSnaptradeRouter = (await import('./routes/snaptrade')).default;
  app.use("/api/snaptrade", versionedSnaptradeRouter);

  // Initialize authentication and base routes
  const server = await registerRoutes(app);
  
  // Mount new SnapTrade management routes (require authentication)
  const { snaptradeUsersRouter } = await import('./routes/snaptrade-users');
  const { snaptradeConnectionsRouter } = await import('./routes/snaptrade-connections');
  const { snaptradeAccountsRouter } = await import('./routes/snaptrade-accounts');
  const { snaptradeTradingRouter } = await import('./routes/snaptrade-trading');
  app.use("/api/snaptrade/users", snaptradeUsersRouter);
  app.use("/api/snaptrade", snaptradeConnectionsRouter);
  app.use("/api/snaptrade", snaptradeAccountsRouter);
  app.use("/api/snaptrade", snaptradeTradingRouter);
  
  // Mount SnapTrade authentication and connections management routes
  const snaptradeAuthRouter = (await import('./routes/snaptrade-auth')).default;
  const snaptradeConnectionsManagementRouter = (await import('./routes/snaptrade-connections-management')).default;
  const snaptradeAccountInformationRouter = (await import('./routes/snaptrade-account-information')).default;
  const snaptradeOptionsRouter = (await import('./routes/snaptrade-options')).default;
  const snaptradeReferenceDataRouter = (await import('./routes/snaptrade-reference-data')).default;
  app.use("/api/snaptrade", snaptradeAuthRouter);
  app.use("/api/snaptrade", snaptradeConnectionsManagementRouter);
  app.use("/api/snaptrade", snaptradeAccountInformationRouter);
  app.use("/api/snaptrade/options", snaptradeOptionsRouter);
  app.use("/api/snaptrade/reference", snaptradeReferenceDataRouter);
  
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
    
    // Start services after server is up
    setTimeout(async () => {
      try {
        const { healthCheckService } = await import("./services/health-check");
        healthCheckService.start();
        console.log('[Health Check] Service initialized');
      } catch (error) {
        console.error('[Health Check] Failed to start:', error);
      }
    }, 1000);
  });
  
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
