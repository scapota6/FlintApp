/**
 * Alert Monitoring Service
 * Background job to check price alerts and send notifications
 */

import { db } from '../db';
import { priceAlerts, alertHistory, notificationPreferences, users } from '@shared/schema';
import { eq, and, or, isNull, lte, gte } from 'drizzle-orm';
import { marketDataService } from './market-data';

class AlertMonitorService {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_FREQUENCY = 60000; // 1 minute
  private readonly DEBOUNCE_PERIOD = 300000; // 5 minutes
  
  start() {
    if (this.checkInterval) {
      console.log('Alert monitor already running');
      return;
    }
    
    console.log('Starting alert monitoring service...');
    
    // Run immediately on start
    this.checkAlerts();
    
    // Then run every minute
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, this.CHECK_FREQUENCY);
  }
  
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Alert monitoring service stopped');
    }
  }
  
  private async checkAlerts() {
    try {
      // Get all active alerts
      const activeAlerts = await db
        .select()
        .from(priceAlerts)
        .where(eq(priceAlerts.active, true));
      
      if (activeAlerts.length === 0) {
        return;
      }
      
      // Group alerts by symbol for efficient price fetching
      const symbolAlerts = new Map<string, typeof activeAlerts>();
      for (const alert of activeAlerts) {
        if (!symbolAlerts.has(alert.symbol)) {
          symbolAlerts.set(alert.symbol, []);
        }
        symbolAlerts.get(alert.symbol)!.push(alert);
      }
      
      // Check each symbol
      for (const [symbol, alerts] of symbolAlerts.entries()) {
        try {
          const quote = await marketDataService.getQuote(symbol);
          if (!quote) continue;
          
          const currentPrice = quote.price;
          
          for (const alert of alerts) {
            await this.checkSingleAlert(alert, currentPrice);
          }
        } catch (error) {
          console.error(`Error checking alerts for ${symbol}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in alert monitor:', error);
    }
  }
  
  private async checkSingleAlert(alert: any, currentPrice: number) {
    try {
      // Check if alert should trigger
      let triggered = false;
      let triggerType: 'above' | 'below' | null = null;
      
      if (alert.abovePrice && currentPrice >= parseFloat(alert.abovePrice)) {
        triggered = true;
        triggerType = 'above';
      } else if (alert.belowPrice && currentPrice <= parseFloat(alert.belowPrice)) {
        triggered = true;
        triggerType = 'below';
      }
      
      if (!triggered || !triggerType) {
        return;
      }
      
      // Check debounce period
      if (alert.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - new Date(alert.lastTriggered).getTime();
        if (timeSinceLastTrigger < this.DEBOUNCE_PERIOD) {
          return; // Skip if within debounce period
        }
      }
      
      // Check quiet hours
      const shouldNotify = await this.checkQuietHours(alert.userId);
      if (!shouldNotify) {
        console.log(`Alert ${alert.id} triggered but in quiet hours`);
        return;
      }
      
      // Record alert trigger
      await db.insert(alertHistory).values({
        alertId: alert.id,
        triggerPrice: currentPrice.toString(),
        triggerType,
        notificationSent: true
      });
      
      // Update last triggered time
      await db
        .update(priceAlerts)
        .set({ 
          lastTriggered: new Date(),
          updatedAt: new Date()
        })
        .where(eq(priceAlerts.id, alert.id));
      
      // Send notifications
      await this.sendNotifications(alert, currentPrice, triggerType);
      
    } catch (error) {
      console.error(`Error checking alert ${alert.id}:`, error);
    }
  }
  
  private async checkQuietHours(userId: string): Promise<boolean> {
    try {
      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      
      if (!prefs || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
        return true; // No quiet hours configured
      }
      
      const now = new Date();
      const currentHour = now.getHours();
      
      const start = prefs.quietHoursStart;
      const end = prefs.quietHoursEnd;
      
      // Handle overnight quiet hours (e.g., 22:00 to 07:00)
      if (start > end) {
        return currentHour < start && currentHour >= end;
      } else {
        return currentHour < start || currentHour >= end;
      }
    } catch (error) {
      console.error('Error checking quiet hours:', error);
      return true; // Default to sending notifications on error
    }
  }
  
  private async sendNotifications(
    alert: any, 
    currentPrice: number, 
    triggerType: 'above' | 'below'
  ) {
    try {
      // Get user preferences
      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, alert.userId));
      
      // Get user info for email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, alert.userId));
      
      const message = `Price Alert: ${alert.symbol} is now $${currentPrice.toFixed(2)} ` +
        `(${triggerType} your target of $${triggerType === 'above' ? alert.abovePrice : alert.belowPrice})`;
      
      // Send email notification if enabled
      if (prefs?.emailAlerts && user?.email) {
        await this.sendEmailNotification(user.email, alert.symbol, message);
      }
      
      // Log notification for in-app display
      console.log(`Alert triggered: ${message}`);
      
      // In a real app, you would also:
      // - Send push notifications if enabled
      // - Emit WebSocket events for real-time updates
      // - Store notification in a notifications table for in-app display
      
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }
  
  private async sendEmailNotification(email: string, symbol: string, message: string) {
    // In production, integrate with an email service like SendGrid, SES, etc.
    // For now, just log the email that would be sent
    console.log(`Email would be sent to ${email}:`);
    console.log(`Subject: Flint Price Alert - ${symbol}`);
    console.log(`Body: ${message}`);
    
    // Example integration with a real email service:
    // await emailService.send({
    //   to: email,
    //   subject: `Flint Price Alert - ${symbol}`,
    //   text: message,
    //   html: `<p>${message}</p>`
    // });
  }
}

export const alertMonitor = new AlertMonitorService();