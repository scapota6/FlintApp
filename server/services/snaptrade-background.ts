/**
 * Background services for SnapTrade data synchronization
 * Handles nightly data refresh and market data caching
 */

import { CronJob } from 'cron';
import { db } from '../db';
import { snaptradeUsers, connectedAccounts, marketData } from '../../shared/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';
import { 
  listAccounts, 
  getPositions, 
  getAccountBalances,
  searchSymbols 
} from '../lib/snaptrade';
import { normalizeSnapTradeError } from '../lib/normalize-snaptrade-error';

interface BackgroundServiceOptions {
  enableScheduledJobs?: boolean;
  enableDataRefresh?: boolean;
  enableMarketDataCache?: boolean;
  refreshInterval?: string; // Cron pattern
}

export class SnapTradeBackgroundService {
  private refreshJob?: CronJob;
  private marketDataJob?: CronJob;
  private isRunning = false;
  
  constructor(private options: BackgroundServiceOptions = {}) {
    this.options = {
      enableScheduledJobs: true,
      enableDataRefresh: true,
      enableMarketDataCache: true,
      refreshInterval: '0 2 * * *', // 2 AM daily
      ...options
    };
  }

  /**
   * Start background services
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[SnapTrade Background] Services already running');
      return;
    }

    console.log('[SnapTrade Background] Starting background services...');
    this.isRunning = true;

    if (this.options.enableScheduledJobs) {
      this.startScheduledJobs();
    }

    console.log('[SnapTrade Background] Background services started');
  }

  /**
   * Stop background services
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[SnapTrade Background] Stopping background services...');
    
    if (this.refreshJob) {
      this.refreshJob.stop();
      this.refreshJob = undefined;
    }
    
    if (this.marketDataJob) {
      this.marketDataJob.stop();
      this.marketDataJob = undefined;
    }

    this.isRunning = false;
    console.log('[SnapTrade Background] Background services stopped');
  }

  /**
   * Start scheduled jobs
   */
  private startScheduledJobs(): void {
    // Nightly data refresh job
    if (this.options.enableDataRefresh) {
      this.refreshJob = new CronJob(
        this.options.refreshInterval!,
        () => this.performNightlyDataRefresh(),
        null,
        true,
        'America/New_York'
      );
      console.log(`[SnapTrade Background] Scheduled nightly refresh at: ${this.options.refreshInterval}`);
    }

    // Market data caching job (every 4 hours during market hours)
    if (this.options.enableMarketDataCache) {
      this.marketDataJob = new CronJob(
        '0 */4 * * 1-5', // Every 4 hours on weekdays
        () => this.cacheMarketData(),
        null,
        true,
        'America/New_York'
      );
      console.log('[SnapTrade Background] Scheduled market data caching every 4 hours on weekdays');
    }
  }

  /**
   * Perform nightly data refresh for all active users
   */
  async performNightlyDataRefresh(): Promise<void> {
    const startTime = Date.now();
    console.log('[SnapTrade Background] Starting nightly data refresh...');

    try {
      // Get all active SnapTrade users
      const activeUsers = await db
        .select()
        .from(snaptradeUsers)
        .where(and(
          isNull(snaptradeUsers.rotatedAt), // Not rotated (still active)
          isNull(snaptradeUsers.deletedAt)  // Not deleted
        ));

      console.log(`[SnapTrade Background] Found ${activeUsers.length} active users`);

      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ userId: string; error: string }> = [];

      // Process users sequentially to avoid rate limiting
      for (const user of activeUsers) {
        try {
          await this.refreshUserData(user.flintUserId, user.userSecret);
          successCount++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ userId: user.flintUserId, error: errorMessage });
          
          console.error(`[SnapTrade Background] Error refreshing user ${user.flintUserId}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[SnapTrade Background] Nightly refresh completed in ${duration}ms:`);
      console.log(`  - Successful: ${successCount} users`);
      console.log(`  - Errors: ${errorCount} users`);

      if (errors.length > 0) {
        console.log('[SnapTrade Background] Errors encountered:');
        errors.forEach(({ userId, error }) => {
          console.log(`  - ${userId}: ${error}`);
        });
      }

    } catch (error) {
      console.error('[SnapTrade Background] Fatal error during nightly refresh:', error);
    }
  }

  /**
   * Refresh data for a specific user
   */
  private async refreshUserData(flintUserId: string, userSecret: string): Promise<void> {
    try {
      // Fetch fresh account data
      const accounts = await listAccounts(flintUserId, userSecret);
      
      if (!accounts || accounts.length === 0) {
        console.log(`[SnapTrade Background] No accounts found for user ${flintUserId}`);
        return;
      }

      // Update each account's data
      for (const account of accounts) {
        try {
          // Fetch balances and positions
          const [balances, positions] = await Promise.all([
            getAccountBalances(flintUserId, userSecret, account.id),
            getPositions(flintUserId, userSecret, account.id)
          ]);

          // Update connected account record
          await db
            .update(connectedAccounts)
            .set({
              lastSyncAt: new Date(),
              balance: balances?.total?.amount || 0,
              currency: balances?.total?.currency || 'USD',
              metadata: {
                balances: balances || {},
                positions: positions || [],
                lastRefresh: new Date().toISOString()
              }
            })
            .where(eq(connectedAccounts.externalAccountId, account.id));

        } catch (accountError) {
          console.error(`[SnapTrade Background] Error refreshing account ${account.id}:`, accountError);
        }
      }

    } catch (error) {
      // Normalize SnapTrade errors
      const normalizedError = normalizeSnapTradeError(error, 'nightly-refresh');
      
      if (normalizedError.code === 'SNAPTRADE_USER_MISMATCH') {
        console.warn(`[SnapTrade Background] User mismatch for ${flintUserId}, marking for rotation`);
        
        // Mark user for rotation
        await db
          .update(snaptradeUsers)
          .set({ rotatedAt: new Date() })
          .where(eq(snaptradeUsers.flintUserId, flintUserId));
      }
      
      throw new Error(`${normalizedError.code}: ${normalizedError.message}`);
    }
  }

  /**
   * Cache market data for commonly requested instruments
   */
  async cacheMarketData(): Promise<void> {
    console.log('[SnapTrade Background] Starting market data caching...');

    try {
      // Cache popular symbols
      const popularSymbols = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK.B',
        'SPY', 'QQQ', 'IWM', 'VTI', 'VXUS', 'BND', 'GLD', 'ARKK'
      ];

      // Search and cache each symbol
      for (const symbol of popularSymbols) {
        try {
          const results = await searchSymbols(symbol);
          
          if (results && results.length > 0) {
            const instrument = results[0];
            
            // Store in market data cache
            await db
              .insert(marketData)
              .values({
                symbol: instrument.symbol,
                name: instrument.description,
                type: 'equity',
                exchange: instrument.exchange || 'US',
                currency: instrument.currency || 'USD',
                data: {
                  ...instrument,
                  cachedAt: new Date().toISOString()
                },
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
              })
              .onConflictDoUpdate({
                target: [marketData.symbol],
                set: {
                  data: {
                    ...instrument,
                    cachedAt: new Date().toISOString()
                  },
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
              });
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`[SnapTrade Background] Error caching symbol ${symbol}:`, error);
        }
      }

      // Clean up expired market data
      await db
        .delete(marketData)
        .where(lt(marketData.expiresAt, new Date()));

      console.log('[SnapTrade Background] Market data caching completed');

    } catch (error) {
      console.error('[SnapTrade Background] Error during market data caching:', error);
    }
  }

  /**
   * Manual trigger for data refresh (admin endpoint)
   */
  async triggerDataRefresh(userId?: string): Promise<{ success: boolean; message: string }> {
    try {
      if (userId) {
        // Refresh specific user
        const user = await db
          .select()
          .from(snaptradeUsers)
          .where(eq(snaptradeUsers.flintUserId, userId))
          .limit(1);

        if (user.length === 0) {
          return { success: false, message: 'User not found' };
        }

        await this.refreshUserData(user[0].flintUserId, user[0].userSecret);
        return { success: true, message: `Data refreshed for user ${userId}` };
      } else {
        // Refresh all users
        await this.performNightlyDataRefresh();
        return { success: true, message: 'Data refresh completed for all users' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    }
  }

  /**
   * Get service status
   */
  getStatus(): { running: boolean; jobs: Record<string, boolean> } {
    return {
      running: this.isRunning,
      jobs: {
        dataRefresh: !!this.refreshJob && this.refreshJob.running,
        marketDataCache: !!this.marketDataJob && this.marketDataJob.running
      }
    };
  }
}

// Export singleton instance
export const snaptradeBackgroundService = new SnapTradeBackgroundService();

// Export types
export type { BackgroundServiceOptions };