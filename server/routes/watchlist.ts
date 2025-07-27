import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { watchlist } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Get user's watchlist
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    const userWatchlist = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId));

    res.json({ watchlist: userWatchlist });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

// Add symbol to watchlist
router.post("/add", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    // Check if already in watchlist
    const existing = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol.toUpperCase())));

    if (existing.length > 0) {
      return res.status(409).json({ error: "Symbol already in watchlist" });
    }

    // Add to watchlist
    const [newWatchlistItem] = await db
      .insert(watchlist)
      .values({
        userId,
        symbol: symbol.toUpperCase(),
        createdAt: new Date(),
      })
      .returning();

    res.json({ 
      success: true, 
      message: `${symbol.toUpperCase()} added to watchlist`,
      watchlistItem: newWatchlistItem 
    });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

// Remove symbol from watchlist
router.delete("/remove", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const deleted = await db
      .delete(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol.toUpperCase())))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Symbol not found in watchlist" });
    }

    res.json({ 
      success: true, 
      message: `${symbol.toUpperCase()} removed from watchlist` 
    });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    res.status(500).json({ error: "Failed to remove from watchlist" });
  }
});

// Check if symbol is in watchlist
router.post("/check", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const existing = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.symbol, symbol.toUpperCase())));

    res.json({ 
      inWatchlist: existing.length > 0,
      symbol: symbol.toUpperCase()
    });
  } catch (error) {
    console.error("Error checking watchlist:", error);
    res.status(500).json({ error: "Failed to check watchlist status" });
  }
});

export default router;