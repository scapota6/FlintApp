import type { Express } from 'express';
import { seedDemoData } from '../scripts/seed-demo';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const DEMO_USER_ID = 'demo-user-001';

export function registerDemoRoutes(app: Express) {
  // Enable demo mode
  app.post('/api/demo/enable', async (req, res) => {
    try {
      console.log('Enabling demo mode...');
      
      // Seed demo data
      const result = await seedDemoData();
      
      // Create a demo session for the user
      req.session.demoMode = true;
      req.session.demoUserId = result.userId;
      req.session.save();
      
      res.json({
        success: true,
        message: 'Demo mode enabled successfully',
        stats: result.stats,
        userId: result.userId
      });
    } catch (error) {
      console.error('Failed to enable demo mode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enable demo mode'
      });
    }
  });

  // Disable demo mode
  app.post('/api/demo/disable', async (req, res) => {
    try {
      // Clear demo session
      req.session.demoMode = false;
      req.session.demoUserId = null;
      req.session.save();
      
      res.json({
        success: true,
        message: 'Demo mode disabled'
      });
    } catch (error) {
      console.error('Failed to disable demo mode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disable demo mode'
      });
    }
  });

  // Check demo mode status
  app.get('/api/demo/status', (req, res) => {
    res.json({
      enabled: req.session.demoMode || false,
      userId: req.session.demoUserId || null
    });
  });

  // Get demo user data (for testing)
  app.get('/api/demo/user', async (req, res) => {
    try {
      if (!req.session.demoMode) {
        return res.status(403).json({
          message: 'Demo mode not enabled'
        });
      }
      
      const [demoUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, DEMO_USER_ID));
      
      if (!demoUser) {
        return res.status(404).json({
          message: 'Demo user not found'
        });
      }
      
      res.json(demoUser);
    } catch (error) {
      console.error('Failed to get demo user:', error);
      res.status(500).json({
        message: 'Failed to retrieve demo user data'
      });
    }
  });

  // Reset demo data
  app.post('/api/demo/reset', async (req, res) => {
    try {
      if (!req.session.demoMode) {
        return res.status(403).json({
          message: 'Demo mode not enabled'
        });
      }
      
      console.log('Resetting demo data...');
      
      // Re-seed demo data
      const result = await seedDemoData();
      
      res.json({
        success: true,
        message: 'Demo data reset successfully',
        stats: result.stats
      });
    } catch (error) {
      console.error('Failed to reset demo data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset demo data'
      });
    }
  });
}