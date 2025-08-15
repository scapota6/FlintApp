import type { Express } from 'express';
import { isAuthenticated } from '../replitAuth';
import { db } from '../db';
import { users, holdings, trades, connectedAccounts, notificationPreferences } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { createObjectCsvStringifier } from 'csv-writer';

export function registerSettingsRoutes(app: Express) {
  // Get user profile
  app.get('/api/settings/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      res.json({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  // Update user profile
  app.put('/api/settings/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName } = req.body;
      
      await db.update(users)
        .set({ 
          firstName,
          lastName,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Get notification preferences
  app.get('/api/settings/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [prefs] = await db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      
      // If no preferences exist, create default ones
      if (!prefs) {
        const [newPrefs] = await db.insert(notificationPreferences)
          .values({
            userId,
            emailAlerts: true,
            pushAlerts: true,
            quietHoursStart: 22, // 10 PM
            quietHoursEnd: 8    // 8 AM
          })
          .returning();
        
        return res.json({
          emailAlerts: newPrefs.emailAlerts,
          pushAlerts: newPrefs.pushAlerts,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00'
        });
      }
      
      res.json({
        emailAlerts: prefs.emailAlerts,
        pushAlerts: prefs.pushAlerts,
        quietHoursStart: prefs.quietHoursStart ? `${prefs.quietHoursStart}:00` : '22:00',
        quietHoursEnd: prefs.quietHoursEnd ? `${prefs.quietHoursEnd}:00` : '08:00'
      });
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      res.status(500).json({ message: 'Failed to fetch notification preferences' });
    }
  });

  // Update notification preferences
  app.put('/api/settings/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { emailAlerts, pushAlerts, quietHoursStart, quietHoursEnd } = req.body;
      
      // Parse time strings to hours
      const startHour = quietHoursStart ? parseInt(quietHoursStart.split(':')[0]) : null;
      const endHour = quietHoursEnd ? parseInt(quietHoursEnd.split(':')[0]) : null;
      
      // Check if preferences exist
      const [existing] = await db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      
      if (existing) {
        await db.update(notificationPreferences)
          .set({
            emailAlerts: emailAlerts ?? existing.emailAlerts,
            pushAlerts: pushAlerts ?? existing.pushAlerts,
            quietHoursStart: startHour ?? existing.quietHoursStart,
            quietHoursEnd: endHour ?? existing.quietHoursEnd,
            updatedAt: new Date()
          })
          .where(eq(notificationPreferences.userId, userId));
      } else {
        await db.insert(notificationPreferences)
          .values({
            userId,
            emailAlerts: emailAlerts ?? true,
            pushAlerts: pushAlerts ?? true,
            quietHoursStart: startHour,
            quietHoursEnd: endHour
          });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ message: 'Failed to update notification preferences' });
    }
  });

  // Get connected accounts
  app.get('/api/settings/connected-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get bank accounts
      const banks = await db.select({
        id: bankAccounts.id,
        name: bankAccounts.institutionName,
        type: bankAccounts.accountType,
        status: bankAccounts.connectionStatus,
        connectedAt: bankAccounts.createdAt
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId));
      
      // Get brokerage accounts
      const brokerages = await db.select({
        id: brokerageAccounts.id,
        name: brokerageAccounts.brokerageName,
        type: brokerageAccounts.accountType,
        status: brokerageAccounts.connectionStatus,
        connectedAt: brokerageAccounts.createdAt
      })
      .from(brokerageAccounts)
      .where(eq(brokerageAccounts.userId, userId));
      
      const allAccounts = [
        ...banks.map(b => ({ ...b, accountType: 'bank', type: 'Bank Account' })),
        ...brokerages.map(b => ({ ...b, accountType: 'brokerage', type: 'Brokerage Account' }))
      ].sort((a, b) => new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime());
      
      res.json(allAccounts);
    } catch (error) {
      console.error('Error fetching connected accounts:', error);
      res.status(500).json({ message: 'Failed to fetch connected accounts' });
    }
  });

  // Revoke account connection
  app.post('/api/settings/connected-accounts/:accountId/revoke', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { accountId } = req.params;
      
      // Try to revoke bank account
      const bankResult = await db.update(bankAccounts)
        .set({ 
          connectionStatus: 'disconnected',
          accessToken: null,
          refreshToken: null,
          updatedAt: new Date()
        })
        .where(and(
          eq(bankAccounts.id, parseInt(accountId)),
          eq(bankAccounts.userId, userId)
        ));
      
      // If not a bank account, try brokerage
      if (!bankResult) {
        await db.update(brokerageAccounts)
          .set({ 
            connectionStatus: 'disconnected',
            accessToken: null,
            refreshToken: null,
            userSecret: null,
            updatedAt: new Date()
          })
          .where(and(
            eq(brokerageAccounts.id, parseInt(accountId)),
            eq(brokerageAccounts.userId, userId)
          ));
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error revoking account:', error);
      res.status(500).json({ message: 'Failed to revoke account connection' });
    }
  });

  // Export holdings data
  app.get('/api/settings/export/holdings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const userHoldings = await db.select({
        symbol: holdings.symbol,
        name: holdings.name,
        quantity: holdings.quantity,
        averagePrice: holdings.averagePrice,
        currentPrice: holdings.currentPrice,
        totalValue: holdings.totalValue,
        profitLoss: holdings.profitLoss,
        profitLossPercent: holdings.profitLossPercent,
        accountType: holdings.accountType,
        assetType: holdings.assetType
      })
      .from(holdings)
      .where(eq(holdings.userId, userId));
      
      // Create CSV
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'symbol', title: 'Symbol' },
          { id: 'name', title: 'Name' },
          { id: 'quantity', title: 'Quantity' },
          { id: 'averagePrice', title: 'Average Price' },
          { id: 'currentPrice', title: 'Current Price' },
          { id: 'totalValue', title: 'Total Value' },
          { id: 'profitLoss', title: 'Profit/Loss' },
          { id: 'profitLossPercent', title: 'Profit/Loss %' },
          { id: 'accountType', title: 'Account Type' },
          { id: 'assetType', title: 'Asset Type' }
        ]
      });
      
      const csvData = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(userHoldings);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="holdings_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error('Error exporting holdings:', error);
      res.status(500).json({ message: 'Failed to export holdings' });
    }
  });

  // Export transactions data
  app.get('/api/settings/export/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const userTrades = await db.select({
        date: trades.date,
        symbol: trades.symbol,
        name: trades.name,
        type: trades.type,
        quantity: trades.quantity,
        price: trades.price,
        total: trades.total,
        status: trades.status
      })
      .from(trades)
      .where(eq(trades.userId, userId));
      
      // Create CSV
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'date', title: 'Date' },
          { id: 'symbol', title: 'Symbol' },
          { id: 'name', title: 'Name' },
          { id: 'type', title: 'Type' },
          { id: 'quantity', title: 'Quantity' },
          { id: 'price', title: 'Price' },
          { id: 'total', title: 'Total' },
          { id: 'status', title: 'Status' }
        ]
      });
      
      const csvData = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(userTrades);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error('Error exporting transactions:', error);
      res.status(500).json({ message: 'Failed to export transactions' });
    }
  });

  // Delete account
  app.delete('/api/settings/delete-account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Delete all user data (cascade delete should handle related records)
      await db.delete(users).where(eq(users.id, userId));
      
      // Destroy session
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ message: 'Failed to delete account' });
    }
  });
}