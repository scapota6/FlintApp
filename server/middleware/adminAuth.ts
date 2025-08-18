import type { RequestHandler } from "express";
import { storage } from "../storage";
import { logger } from "@shared/logger";

// Middleware to check if user is authenticated and is an admin
export const isAdmin: RequestHandler = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ 
        message: "Unauthorized. Please log in." 
      });
    }

    const userId = (req.user as any).claims.sub;
    
    // Fetch user from database to check admin status
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ 
        message: "User not found." 
      });
    }

    if (!user.isAdmin) {
      logger.warn(`Non-admin user ${userId} attempted to access admin route`);
      return res.status(403).json({ 
        message: "Forbidden. Admin access required." 
      });
    }

    // Add user to request for downstream use
    (req as any).adminUser = user;
    
    next();
  } catch (error) {
    logger.error("Admin authentication error:", error);
    res.status(500).json({ 
      message: "Internal server error during admin authentication." 
    });
  }
};