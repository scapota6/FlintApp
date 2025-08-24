import { Router } from "express";

const r = Router();

/**
 * POST /api/log-login
 * Best-effort analytics logging that never fails
 */
r.post("/api/log-login", (req, res) => {
  try {
    // Best-effort log login analytics
    console.log('[Analytics] Login event:', {
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      // Add any other analytics you want to track
    });
  } catch (error) {
    // Silently fail - analytics should never break user flows
    console.warn('[Analytics] Failed to log login:', error);
  }
  
  // Always return success regardless of analytics outcome
  res.json({ success: true });
});

export default r;