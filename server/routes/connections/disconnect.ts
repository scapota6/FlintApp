/**
 * Account Disconnect Routes
 * Handles disconnecting various account types (SnapTrade, Teller, etc.)
 */

import { Router } from "express";
import { getSnapUser, deleteSnapUser } from "../../store/snapUsers";
import { storage } from "../../storage";
import { logger } from "@shared/logger";

const router = Router();

/**
 * POST /api/connections/disconnect/snaptrade
 * Disconnects a SnapTrade brokerage account
 */
router.post("/snaptrade", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    // Get SnapTrade user credentials
    const snapUser = await getSnapUser(userId);
    if (!snapUser?.userSecret) {
      return res.status(404).json({ message: "SnapTrade account not found" });
    }

    try {
      // Delete the brokerage authorization in SnapTrade
      const { authApi } = await import('../../lib/snaptrade');
      await authApi.deleteBrokerageAuth({
        userId: snapUser.userId,
        userSecret: snapUser.userSecret,
        brokerageAuthId: accountId
      });

      logger.info("SnapTrade account disconnected", { 
        userId, 
        accountId,
        snaptradeUserId: snapUser.userId 
      });

      res.json({ 
        success: true, 
        message: "Account disconnected successfully" 
      });

    } catch (snapError: any) {
      console.error('SnapTrade disconnect error:', snapError);
      
      // If the account is already deleted or not found, consider it success
      if (snapError.status === 404 || snapError.responseBody?.code === '1004') {
        logger.info("SnapTrade account already disconnected", { userId, accountId });
        return res.json({ 
          success: true, 
          message: "Account was already disconnected" 
        });
      }
      
      throw snapError;
    }

  } catch (error: any) {
    logger.error("Failed to disconnect SnapTrade account", { 
      error: error.message,
      userId: req.user?.id,
      accountId: req.body?.accountId
    });
    
    res.status(500).json({ 
      message: "Failed to disconnect account",
      error: error.message 
    });
  }
});

/**
 * POST /api/connections/disconnect/snaptrade/all
 * Disconnects all SnapTrade accounts and deletes the user
 */
router.post("/snaptrade", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Handle "disconnect all" case
    if (accountId === 'all') {
      // Get SnapTrade user credentials
      const snapUser = await getSnapUser(userId);
      if (!snapUser?.userSecret) {
        return res.status(404).json({ message: "SnapTrade account not found" });
      }

      try {
        // Delete the entire SnapTrade user (disconnects all accounts)
        const { authApi } = await import('../../lib/snaptrade');
        await authApi.deleteSnapTradeUser({
          userId: snapUser.userId,
          userSecret: snapUser.userSecret
        });

        // Remove from local storage
        await deleteSnapUser(userId);

        logger.info("All SnapTrade accounts disconnected", { 
          userId,
          snaptradeUserId: snapUser.userId 
        });

        return res.json({ 
          success: true, 
          message: "All accounts disconnected successfully" 
        });

      } catch (snapError: any) {
        console.error('SnapTrade full disconnect error:', snapError);
        
        // If the user is already deleted, consider it success
        if (snapError.status === 404 || snapError.responseBody?.code === '1004') {
          // Still remove from local storage
          await deleteSnapUser(userId);
          
          logger.info("SnapTrade user already deleted", { userId });
          return res.json({ 
            success: true, 
            message: "All accounts were already disconnected" 
          });
        }
        
        throw snapError;
      }
    }

    // Handle single account disconnect
    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    // Get SnapTrade user credentials
    const snapUser = await getSnapUser(userId);
    if (!snapUser?.userSecret) {
      return res.status(404).json({ message: "SnapTrade account not found" });
    }

    try {
      // Delete the brokerage authorization in SnapTrade
      const { authApi } = await import('../../lib/snaptrade');
      await authApi.deleteBrokerageAuth({
        userId: snapUser.userId,
        userSecret: snapUser.userSecret,
        brokerageAuthId: accountId
      });

      logger.info("SnapTrade account disconnected", { 
        userId, 
        accountId,
        snaptradeUserId: snapUser.userId 
      });

      res.json({ 
        success: true, 
        message: "Account disconnected successfully" 
      });

    } catch (snapError: any) {
      console.error('SnapTrade disconnect error:', snapError);
      
      // If the account is already deleted or not found, consider it success
      if (snapError.status === 404 || snapError.responseBody?.code === '1004') {
        logger.info("SnapTrade account already disconnected", { userId, accountId });
        return res.json({ 
          success: true, 
          message: "Account was already disconnected" 
        });
      }
      
      throw snapError;
    }

  } catch (error: any) {
    logger.error("Failed to disconnect SnapTrade account", { 
      error: error.message,
      userId: req.user?.id,
      accountId: req.body?.accountId
    });
    
    res.status(500).json({ 
      message: "Failed to disconnect account",
      error: error.message 
    });
  }
});

/**
 * POST /api/connections/disconnect/teller
 * Disconnects a Teller bank account
 */
router.post("/teller", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    // Remove from database
    await storage.deleteBankAccount(userId, accountId);

    logger.info("Teller account disconnected", { userId, accountId });

    res.json({ 
      success: true, 
      message: "Bank account disconnected successfully" 
    });

  } catch (error: any) {
    logger.error("Failed to disconnect Teller account", { 
      error: error.message,
      userId: req.user?.id,
      accountId: req.body?.accountId
    });
    
    res.status(500).json({ 
      message: "Failed to disconnect bank account",
      error: error.message 
    });
  }
});

export default router;