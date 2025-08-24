import { storage } from "../storage";
import { accountsApi } from "../lib/snaptrade";
import { logger } from "@shared/logger";

export class HealthCheckService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

  start() {
    console.log('[Health Check] Starting scheduled health checks every 6 hours');
    this.intervalId = setInterval(async () => {
      await this.runHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // Also run immediately on startup
    setTimeout(() => this.runHealthCheck(), 5000); // Wait 5 seconds after server start
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Health Check] Stopped scheduled health checks');
    }
  }

  async runHealthCheck() {
    try {
      console.log('[Health Check] Starting scheduled health check...');
      const allAccounts = await storage.getAccountsForHealthCheck();
      
      let checkedCount = 0;
      let connectedCount = 0;
      let disconnectedCount = 0;

      for (const account of allAccounts) {
        try {
          let status: 'connected' | 'disconnected' | 'expired' = 'disconnected';

          if (account.provider === 'snaptrade') {
            // Check SnapTrade connection
            const snaptradeUser = await storage.getSnapTradeUser(account.userId);
            
            if (snaptradeUser?.snaptradeUserId && snaptradeUser?.userSecret) {
              try {
                const accounts = await accountsApi.listUserAccounts({
                  userId: snaptradeUser.snaptradeUserId,
                  userSecret: snaptradeUser.userSecret
                });
                
                const isAccountAccessible = accounts.data.some((acc: any) => acc.id === account.externalAccountId);
                status = isAccountAccessible ? 'connected' : 'disconnected';
              } catch (error: any) {
                console.log(`[Health Check] SnapTrade check failed for account ${account.id}:`, error.message);
                status = 'disconnected';
              }
            }
          } else if (account.provider === 'teller') {
            // Check Teller connection
            if (account.accessToken && account.externalAccountId) {
              try {
                const authHeader = `Basic ${Buffer.from(account.accessToken + ":").toString("base64")}`;
                const response = await fetch(`https://api.teller.io/accounts/${account.externalAccountId}`, {
                  headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json'
                  }
                });
                
                status = response.ok ? 'connected' : 'disconnected';
              } catch (error: any) {
                console.log(`[Health Check] Teller check failed for account ${account.id}:`, error.message);
                status = 'disconnected';
              }
            }
          }

          // Update status in database
          await storage.updateAccountConnectionStatus(account.id, status);
          
          if (status === 'connected') {
            connectedCount++;
          } else {
            disconnectedCount++;
          }
          
          checkedCount++;

        } catch (error: any) {
          console.error(`[Health Check] Error checking account ${account.id}:`, error.message);
        }
      }

      console.log(`[Health Check] Completed. Checked: ${checkedCount}, Connected: ${connectedCount}, Disconnected: ${disconnectedCount}`);
      
      logger.info(`Scheduled health check completed: Checked ${checkedCount}/${allAccounts.length} accounts: ${connectedCount} connected, ${disconnectedCount} disconnected`);

    } catch (error: any) {
      console.error('[Health Check] Health check failed:', error);
      logger.error('Scheduled health check failed', { error: error.message });
    }
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();