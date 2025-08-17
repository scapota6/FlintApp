/**
 * CSRF Protection Middleware
 * Protects state-changing routes from Cross-Site Request Forgery attacks
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "@shared/logger";

// Store CSRF tokens in session
declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
  }
}

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Middleware to generate and attach CSRF token to session
 */
export function attachCSRFToken(req: Request, res: Response, next: NextFunction) {
  // Skip if session doesn't exist yet
  if (!req.session) {
    return next();
  }
  
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  
  // Make token available to views
  res.locals.csrfToken = req.session.csrfToken;
  
  // Add token to response header for API clients
  res.setHeader("X-CSRF-Token", req.session.csrfToken);
  
  next();
}

/**
 * Middleware to validate CSRF token on state-changing requests
 */
export function validateCSRFToken(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip for API routes that are read-only or public endpoints
  const skipCSRFRoutes = [
    "/api/auth/user",
    "/api/me",
    "/api/dashboard",
    "/api/feature-flags",
    "/api/snaptrade/register", // Public SnapTrade registration endpoint
    "/api/snaptrade/reset-user", // DEV ONLY - reset endpoint
  ];
  
  if (skipCSRFRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  const sessionToken = req.session.csrfToken;
  const clientToken = req.headers["x-csrf-token"] || 
                     req.body?._csrf || 
                     req.query?._csrf;

  if (!sessionToken || !clientToken || sessionToken !== clientToken) {
    logger.warn("CSRF token validation failed", {
      userId: (req as any).user?.claims?.sub,
      metadata: {
        path: req.path,
        method: req.method,
      }
    });
    
    return res.status(403).json({ 
      message: "Invalid CSRF token",
      error: "CSRF_VALIDATION_FAILED"
    });
  }

  next();
}

/**
 * Get CSRF token endpoint
 */
export function getCSRFToken(req: Request, res: Response) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  
  res.json({ 
    csrfToken: req.session.csrfToken,
    message: "Include this token in X-CSRF-Token header for state-changing requests"
  });
}