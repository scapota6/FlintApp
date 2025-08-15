/**
 * Watchlist Routes
 * Handles watchlist management and price alerts
 */

import { Request, Response, Router } from 'express';
import { db } from '../db';
import { watchlist, priceAlerts, alertHistory, notificationPreferences } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';
import { z } from 'zod';
import { marketDataService } from '../services/market-data';

const router = Router();

// Get user's watchlist
router.get('/api/watchlist', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    
    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.addedAt));
    
    // Enrich with current prices
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        try {
          const quote = await marketDataService.getQuote(item.symbol);
          return {
            ...item,
            currentPrice: quote?.price,
            change: quote?.change,
            changePercent: quote?.changePercent
          };
        } catch (error) {
          console.error(`Error fetching quote for ${item.symbol}:`, error);
          return item;
        }
      })
    );
    
    res.json(enrichedItems);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add to watchlist
const addWatchlistSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase()
});

router.post('/api/watchlist', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    const { symbol } = addWatchlistSchema.parse(req.body);
    
    // Check if already exists
    const existing = await db
      .select()
      .from(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.symbol, symbol)
      ));
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Symbol already in watchlist' });
    }
    
    const [newItem] = await db
      .insert(watchlist)
      .values({
        userId,
        symbol
      })
      .returning();
    
    res.status(201).json(newItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Remove from watchlist
router.delete('/api/watchlist/:symbol', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    const symbol = req.params.symbol.toUpperCase();
    
    await db
      .delete(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.symbol, symbol)
      ));
    
    res.status(204).send();
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// Get price alerts
router.get('/api/alerts/price', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    
    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt));
    
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching price alerts:', error);
    res.status(500).json({ error: 'Failed to fetch price alerts' });
  }
});

// Create price alert
const createAlertSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  abovePrice: z.number().positive().optional(),
  belowPrice: z.number().positive().optional()
}).refine(data => data.abovePrice || data.belowPrice, {
  message: 'At least one of abovePrice or belowPrice must be provided'
});

router.post('/api/alerts/price', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    const data = createAlertSchema.parse(req.body);
    
    // Check for existing similar alert
    const existing = await db
      .select()
      .from(priceAlerts)
      .where(and(
        eq(priceAlerts.userId, userId),
        eq(priceAlerts.symbol, data.symbol),
        eq(priceAlerts.active, true)
      ));
    
    if (existing.length >= 5) {
      return res.status(400).json({ 
        error: 'Maximum 5 active alerts per symbol allowed' 
      });
    }
    
    const [newAlert] = await db
      .insert(priceAlerts)
      .values({
        userId,
        symbol: data.symbol,
        abovePrice: data.abovePrice?.toString(),
        belowPrice: data.belowPrice?.toString(),
        active: true
      })
      .returning();
    
    res.status(201).json(newAlert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating price alert:', error);
    res.status(500).json({ error: 'Failed to create price alert' });
  }
});

// Update alert status
router.patch('/api/alerts/price/:id', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    const alertId = parseInt(req.params.id);
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    
    const [updated] = await db
      .update(priceAlerts)
      .set({ 
        active,
        updatedAt: new Date()
      })
      .where(and(
        eq(priceAlerts.id, alertId),
        eq(priceAlerts.userId, userId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Delete price alert
router.delete('/api/alerts/price/:id', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    const alertId = parseInt(req.params.id);
    
    await db
      .delete(priceAlerts)
      .where(and(
        eq(priceAlerts.id, alertId),
        eq(priceAlerts.userId, userId)
      ));
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Get notification preferences
router.get('/api/alerts/preferences', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    
    // Return defaults if no preferences exist
    if (!prefs) {
      return res.json({
        emailAlerts: true,
        pushAlerts: true,
        quietHoursStart: null,
        quietHoursEnd: null
      });
    }
    
    res.json(prefs);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update notification preferences
const updatePreferencesSchema = z.object({
  emailAlerts: z.boolean().optional(),
  pushAlerts: z.boolean().optional(),
  quietHoursStart: z.number().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().min(0).max(23).nullable().optional()
});

router.put('/api/alerts/preferences', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    const data = updatePreferencesSchema.parse(req.body);
    
    const [updated] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        ...data,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          ...data,
          updatedAt: new Date()
        }
      })
      .returning();
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get alert history
router.get('/api/alerts/history', isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = req.user.claims.sub;
    
    const history = await db
      .select({
        id: alertHistory.id,
        alertId: alertHistory.alertId,
        symbol: priceAlerts.symbol,
        triggeredAt: alertHistory.triggeredAt,
        triggerPrice: alertHistory.triggerPrice,
        triggerType: alertHistory.triggerType,
        notificationSent: alertHistory.notificationSent
      })
      .from(alertHistory)
      .innerJoin(priceAlerts, eq(alertHistory.alertId, priceAlerts.id))
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(alertHistory.triggeredAt))
      .limit(50);
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching alert history:', error);
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

export default router;