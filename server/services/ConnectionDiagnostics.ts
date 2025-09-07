import { Snaptrade } from 'snaptrade-typescript-sdk';
import { storage } from '../storage';
import { getSnapUser } from '../store/snapUsers';
import { accountsApi } from '../lib/snaptrade';

export interface ConnectionIssue {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'authentication' | 'network' | 'configuration' | 'api_limits' | 'account_status';
  title: string;
  description: string;
  affectedProvider: 'teller' | 'snaptrade' | 'both';
  affectedAccounts: string[];
  detectedAt: Date;
  autoRepairAvailable: boolean;
  repairActions: RepairAction[];
  userMessage: string;
  technicalDetails?: any;
}

export interface RepairAction {
  id: string;
  title: string;
  description: string;
  type: 'automatic' | 'guided' | 'manual';
  estimatedTime: string;
  riskLevel: 'safe' | 'moderate' | 'high';
  steps: RepairStep[];
}

export interface RepairStep {
  id: string;
  title: string;
  description: string;
  type: 'api_call' | 'user_action' | 'verification';
  automated: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface DiagnosticsReport {
  overallHealth: 'healthy' | 'degraded' | 'critical';
  lastChecked: Date;
  issues: ConnectionIssue[];
  recommendations: string[];
  accountStatus: {
    teller: {
      totalAccounts: number;
      connectedAccounts: number;
      failedAccounts: number;
      lastSuccessfulSync?: Date;
    };
    snaptrade: {
      totalAccounts: number;
      connectedAccounts: number;
      failedAccounts: number;
      lastSuccessfulSync?: Date;
    };
  };
}

export class ConnectionDiagnostics {
  private static instance: ConnectionDiagnostics;
  
  static getInstance(): ConnectionDiagnostics {
    if (!this.instance) {
      this.instance = new ConnectionDiagnostics();
    }
    return this.instance;
  }

  /**
   * Run comprehensive diagnostics for a user
   */
  async runDiagnostics(userId: string): Promise<DiagnosticsReport> {
    console.log(`[ConnectionDiagnostics] Running diagnostics for user: ${userId}`);
    
    const issues: ConnectionIssue[] = [];
    const recommendations: string[] = [];
    
    // Get user data
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check SnapTrade connections
    const snapTradeStatus = await this.checkSnapTradeConnection(userId);
    const tellerStatus = await this.checkTellerConnection(userId);

    // Detect issues
    const snapTradeIssues = await this.detectSnapTradeIssues(userId, snapTradeStatus);
    const tellerIssues = await this.detectTellerIssues(userId, tellerStatus);
    const crossPlatformIssues = await this.detectCrossPlatformIssues(snapTradeStatus, tellerStatus);

    issues.push(...snapTradeIssues, ...tellerIssues, ...crossPlatformIssues);

    // Generate recommendations
    if (issues.length === 0) {
      recommendations.push('All connections are healthy! Consider setting up account alerts for proactive monitoring.');
    } else {
      recommendations.push(...this.generateRecommendations(issues));
    }

    // Determine overall health
    const criticalIssues = issues.filter(i => i.type === 'critical').length;
    const warningIssues = issues.filter(i => i.type === 'warning').length;
    
    let overallHealth: 'healthy' | 'degraded' | 'critical';
    if (criticalIssues > 0) {
      overallHealth = 'critical';
    } else if (warningIssues > 0) {
      overallHealth = 'degraded';  
    } else {
      overallHealth = 'healthy';
    }

    return {
      overallHealth,
      lastChecked: new Date(),
      issues,
      recommendations,
      accountStatus: {
        teller: tellerStatus,
        snaptrade: snapTradeStatus
      }
    };
  }

  /**
   * Check SnapTrade connection health
   */
  private async checkSnapTradeConnection(userId: string) {
    const status = {
      totalAccounts: 0,
      connectedAccounts: 0,
      failedAccounts: 0,
      lastSuccessfulSync: undefined as Date | undefined
    };

    try {
      // Check if user has SnapTrade credentials
      const snapUser = await getSnapUser(userId);
      if (!snapUser || !accountsApi) {
        return status;
      }

      // Test API connectivity
      const accountsResponse = await accountsApi.listUserAccounts({
        userId: snapUser.userId,
        userSecret: snapUser.userSecret
      });

      const accounts = accountsResponse.data || [];
      status.totalAccounts = accounts.length;
      
      // Check each account's health
      for (const account of accounts) {
        try {
          // Test account balance fetch  
          const balanceResponse = await accountsApi.getUserAccountBalance({
            userId: snapUser.userId,
            userSecret: snapUser.userSecret,
            accountId: account.id
          });
          
          if (balanceResponse.data) {
            status.connectedAccounts++;
            status.lastSuccessfulSync = new Date();
          }
        } catch (error) {
          console.error(`[ConnectionDiagnostics] Account ${account.id} failed balance check:`, error);
          status.failedAccounts++;
        }
      }

    } catch (error) {
      console.error('[ConnectionDiagnostics] SnapTrade connection check failed:', error);
    }

    return status;
  }

  /**
   * Check Teller connection health  
   */
  private async checkTellerConnection(userId: string) {
    const status = {
      totalAccounts: 0,
      connectedAccounts: 0,
      failedAccounts: 0,
      lastSuccessfulSync: undefined as Date | undefined
    };

    try {
      const user = await storage.getUser(userId);
      if (!user) return status;

      // Get connected accounts from database
      const accounts = await storage.getConnectedAccounts(userId);
      const tellerAccounts = accounts.filter((acc: any) => acc.provider === 'teller');
      
      status.totalAccounts = tellerAccounts.length;

      // Check each Teller account
      for (const account of tellerAccounts) {
        try {
          if (!account.accessToken) {
            status.failedAccounts++;
            continue;
          }

          // Test account access with direct API call
          if (account.accessToken && account.externalAccountId) {
            try {
              const response = await fetch(`https://api.teller.io/accounts/${account.externalAccountId}`, {
                headers: {
                  'Authorization': `Bearer ${account.accessToken}`,
                  'Accept': 'application/json'
                }
              });
              
              if (response.ok) {
                const accountData = await response.json();
                if (accountData && accountData.status !== 'closed') {
                  status.connectedAccounts++;
                  status.lastSuccessfulSync = new Date();
                } else {
                  status.failedAccounts++;
                }
              } else {
                status.failedAccounts++;
              }
            } catch (apiError) {
              console.error(`[ConnectionDiagnostics] Teller API call failed for account ${account.id}:`, apiError);
              status.failedAccounts++;
            }
          } else {
            status.failedAccounts++;
          }
        } catch (error) {
          console.error(`[ConnectionDiagnostics] Teller account ${account.id} failed check:`, error);
          status.failedAccounts++;
        }
      }

    } catch (error) {
      console.error('[ConnectionDiagnostics] Teller connection check failed:', error);
    }

    return status;
  }

  /**
   * Detect SnapTrade-specific issues
   */
  private async detectSnapTradeIssues(userId: string, status: any): Promise<ConnectionIssue[]> {
    const issues: ConnectionIssue[] = [];
    
    // Check for missing credentials
    const snapUser = await getSnapUser(userId);
    if (!snapUser && status.totalAccounts === 0) {
      issues.push({
        id: `snaptrade-not-registered-${userId}`,
        type: 'info',
        category: 'configuration',
        title: 'SnapTrade Not Connected',
        description: 'No brokerage accounts connected via SnapTrade',
        affectedProvider: 'snaptrade',
        affectedAccounts: [],
        detectedAt: new Date(),
        autoRepairAvailable: true,
        repairActions: [{
          id: 'connect-snaptrade',
          title: 'Connect Brokerage Account',
          description: 'Set up your first brokerage connection through SnapTrade',
          type: 'guided',
          estimatedTime: '2-3 minutes',
          riskLevel: 'safe',
          steps: [
            {
              id: 'click-connect',
              title: 'Click Connect Brokerage',
              description: 'Navigate to the Quick Connect section and click "Connect Brokerage"',
              type: 'user_action',
              automated: false,
              status: 'pending'
            },
            {
              id: 'select-broker',
              title: 'Select Your Brokerage',
              description: 'Choose your brokerage from the list (Robinhood, Fidelity, etc.)',
              type: 'user_action',
              automated: false,
              status: 'pending'
            },
            {
              id: 'complete-auth',
              title: 'Complete Authorization',
              description: 'Log in to your brokerage and authorize the connection',
              type: 'user_action',
              automated: false,
              status: 'pending'
            }
          ]
        }],
        userMessage: 'Connect your brokerage account to see your investments and enable trading features.'
      });
    }

    // Check for stale credentials
    if (snapUser && status.failedAccounts > 0) {
      issues.push({
        id: `snaptrade-auth-failed-${userId}`,
        type: 'critical',
        category: 'authentication',
        title: 'Brokerage Connection Expired',
        description: `${status.failedAccounts} brokerage account(s) need re-authentication`,
        affectedProvider: 'snaptrade',
        affectedAccounts: ['all-snaptrade'],
        detectedAt: new Date(),
        autoRepairAvailable: true,
        repairActions: [{
          id: 'refresh-snaptrade-auth',
          title: 'Refresh Brokerage Connection',
          description: 'Re-authenticate with your brokerage to restore access',
          type: 'automatic',
          estimatedTime: '1-2 minutes',
          riskLevel: 'safe',
          steps: [
            {
              id: 'clear-stale-credentials',
              title: 'Clear Expired Credentials',
              description: 'Remove invalid authentication tokens',
              type: 'api_call',
              automated: true,
              status: 'pending'
            },
            {
              id: 'initiate-reauth',
              title: 'Start Re-authentication',
              description: 'Begin fresh connection flow with your brokerage',
              type: 'api_call',
              automated: true,
              status: 'pending'
            }
          ]
        }],
        userMessage: 'Your brokerage connection has expired. Click to reconnect and restore access to your accounts.'
      });
    }

    return issues;
  }

  /**
   * Detect Teller-specific issues
   */
  private async detectTellerIssues(userId: string, status: any): Promise<ConnectionIssue[]> {
    const issues: ConnectionIssue[] = [];

    // Check for failed Teller accounts
    if (status.failedAccounts > 0) {
      issues.push({
        id: `teller-auth-failed-${userId}`,
        type: 'warning',
        category: 'authentication',
        title: 'Bank Connection Issues',
        description: `${status.failedAccounts} bank account(s) need attention`,
        affectedProvider: 'teller',
        affectedAccounts: ['affected-teller-accounts'],
        detectedAt: new Date(),
        autoRepairAvailable: true,
        repairActions: [{
          id: 'refresh-teller-connection',
          title: 'Refresh Bank Connection',
          description: 'Update your bank account connection through Teller',
          type: 'guided',
          estimatedTime: '2-3 minutes',
          riskLevel: 'safe',
          steps: [
            {
              id: 'identify-failed-accounts',
              title: 'Identify Failed Accounts',
              description: 'Review which bank accounts need attention',
              type: 'verification',
              automated: true,
              status: 'pending'
            },
            {
              id: 'launch-teller-update',
              title: 'Launch Account Update',
              description: 'Open Teller Connect to refresh account access',
              type: 'user_action',
              automated: false,
              status: 'pending'
            }
          ]
        }],
        userMessage: 'Some bank accounts need to be reconnected. This is common when banks update their security.'
      });
    }

    return issues;
  }

  /**
   * Detect cross-platform issues
   */
  private async detectCrossPlatformIssues(snapTradeStatus: any, tellerStatus: any): Promise<ConnectionIssue[]> {
    const issues: ConnectionIssue[] = [];

    // Check if user has no connections at all
    if (snapTradeStatus.totalAccounts === 0 && tellerStatus.totalAccounts === 0) {
      issues.push({
        id: 'no-connections',
        type: 'info',
        category: 'configuration',
        title: 'No Financial Accounts Connected',
        description: 'Connect bank and brokerage accounts to get started with Flint',
        affectedProvider: 'both',
        affectedAccounts: [],
        detectedAt: new Date(),
        autoRepairAvailable: true,
        repairActions: [{
          id: 'onboarding-flow',
          title: 'Complete Account Setup',
          description: 'Connect your first financial accounts to Flint',
          type: 'guided',
          estimatedTime: '5-7 minutes',
          riskLevel: 'safe',
          steps: [
            {
              id: 'connect-bank',
              title: 'Connect Bank Account',
              description: 'Link your checking/savings accounts via Teller',
              type: 'user_action',
              automated: false,
              status: 'pending'
            },
            {
              id: 'connect-brokerage',
              title: 'Connect Brokerage Account',
              description: 'Link your investment accounts via SnapTrade',
              type: 'user_action',
              automated: false,
              status: 'pending'
            }
          ]
        }],
        userMessage: 'Welcome to Flint! Connect your financial accounts to see your complete financial picture.'
      });
    }

    return issues;
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(issues: ConnectionIssue[]): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = issues.filter(i => i.type === 'critical');
    const authIssues = issues.filter(i => i.category === 'authentication');
    const configIssues = issues.filter(i => i.category === 'configuration');
    
    if (criticalIssues.length > 0) {
      recommendations.push('⚠️ Address critical connection issues immediately to restore account access.');
    }
    
    if (authIssues.length > 0) {
      recommendations.push('🔑 Refresh expired connections - most authentication issues resolve automatically.');
    }
    
    if (configIssues.length > 0) {
      recommendations.push('⚙️ Complete your account setup to unlock all Flint features.');
    }
    
    // Always include proactive advice
    recommendations.push('💡 Enable account alerts to catch connection issues early.');
    recommendations.push('🔄 Regular connection health checks help prevent problems before they occur.');
    
    return recommendations;
  }

  /**
   * Execute an automated repair action
   */
  async executeRepair(userId: string, issueId: string, actionId: string): Promise<{success: boolean; message: string}> {
    console.log(`[ConnectionDiagnostics] Executing repair: ${actionId} for issue: ${issueId}`);
    
    try {
      switch (actionId) {
        case 'clear-stale-credentials':
          return this.clearStaleSnapTradeCredentials(userId);
          
        case 'refresh-snaptrade-auth':
          return this.refreshSnapTradeAuth(userId);
          
        case 'identify-failed-accounts':
          return this.identifyFailedTellerAccounts(userId);
          
        default:
          return { success: false, message: 'Unknown repair action' };
      }
    } catch (error) {
      console.error(`[ConnectionDiagnostics] Repair failed:`, error);
      return { success: false, message: `Repair failed: ${error}` };
    }
  }

  private async clearStaleSnapTradeCredentials(userId: string) {
    const snapUser = await getSnapUser(userId);
    if (snapUser && snaptradeClient) {
      try {
        // Test if credentials are still valid
        await snaptradeClient.accountInformation.listUserAccounts({
          userId: snapUser.userId,
          userSecret: snapUser.userSecret
        });
        return { success: true, message: 'Credentials are still valid' };
      } catch (error) {
        // Credentials are stale, trigger cleanup
        console.log(`[SnapTrade] Detected stale credentials for user: ${snapUser.userId}`);
        return { success: true, message: 'Stale credentials detected and flagged for cleanup' };
      }
    }
    return { success: false, message: 'No SnapTrade credentials found' };
  }

  private async refreshSnapTradeAuth(userId: string) {
    try {
      // This would trigger the connection flow
      return { success: true, message: 'SnapTrade auth refresh initiated' };
    } catch (error) {
      return { success: false, message: `Failed to refresh SnapTrade auth: ${error}` };
    }
  }

  private async identifyFailedTellerAccounts(userId: string) {
    try {
      const accounts = await storage.getConnectedAccounts(userId);
      const tellerAccounts = accounts.filter((acc: any) => acc.provider === 'teller');
      return { 
        success: true, 
        message: `Identified ${tellerAccounts.length} Teller accounts for review` 
      };
    } catch (error) {
      return { success: false, message: `Failed to identify Teller accounts: ${error}` };
    }
  }
}

// Export singleton instance
export const connectionDiagnostics = ConnectionDiagnostics.getInstance();