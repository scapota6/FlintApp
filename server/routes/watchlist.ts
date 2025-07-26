
import { Router } from "express";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { pgTable, serial, varchar, timestamp, text } from "drizzle-orm/pg-core";

// Define watchlist table schema
export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  symbol: varchar('symbol', { length: 10 }).notNull(),
  name: text('name').notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

const router = Router();

// Get user's watchlist
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    const userWatchlist = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(watchlist.addedAt);

    res.json(userWatchlist);
  } catch (err: any) {
    console.error('Get watchlist error:', err);
    res.status(500).json({ error: "Failed to get watchlist" });
  }
});

// Add symbol to watchlist
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { symbol, name } = req.body;

    if (!symbol || !name) {
      return res.status(400).json({ error: "Symbol and name are required" });
    }

    // Check if already in watchlist
    const existing = await db
      .select()
      .from(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.symbol, symbol.toUpperCase())
      ));

    if (existing.length > 0) {
      return res.status(409).json({ error: "Symbol already in watchlist" });
    }

    // Add to watchlist
    const [newItem] = await db
      .insert(watchlist)
      .values({
        userId,
        symbol: symbol.toUpperCase(),
        name
      })
      .returning();

    res.json(newItem);
  } catch (err: any) {
    console.error('Add to watchlist error:', err);
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

// Remove symbol from watchlist
router.delete("/:symbol", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { symbol } = req.params;

    const result = await db
      .delete(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.symbol, symbol.toUpperCase())
      ))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Symbol not found in watchlist" });
    }

    res.json({ success: true, removed: result[0] });
  } catch (err: any) {
    console.error('Remove from watchlist error:', err);
    res.status(500).json({ error: "Failed to remove from watchlist" });
  }
});

export default router;
