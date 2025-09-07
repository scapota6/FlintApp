import { logger } from '@shared/logger';

export interface IntelligentError {
  code: string;
  userMessage: string;
  technicalMessage: string;
  category: 'authentication' | 'network' | 'configuration' | 'api_limits' | 'account_status';
  severity: 'critical' | 'warning' | 'info';
  affectedProvider: 'teller' | 'snaptrade' | 'both';
  solutions: ErrorSolution[];
  preventionTips?: string[];
}

export interface ErrorSolution {
  title: string;
  description: string;
  actionType: 'automatic' | 'guided' | 'manual' | 'contact_support';
  actionId?: string;
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  steps?: string[];
  riskLevel: 'safe' | 'moderate' | 'high';
}

class IntelligentErrorService {
  private static instance: IntelligentErrorService;
  
  static getInstance(): IntelligentErrorService {
    if (!IntelligentErrorService.instance) {
      IntelligentErrorService.instance = new IntelligentErrorService();
    }
    return IntelligentErrorService.instance;
  }

  /**
   * Convert a raw error into an intelligent error with user-friendly solutions
   */
  createIntelligentError(error: any, context: string, provider: 'teller' | 'snaptrade'): IntelligentError {
    const errorCode = this.extractErrorCode(error, provider);
    const errorPattern = this.identifyErrorPattern(error, errorCode, provider);
    
    logger.debug('Creating intelligent error', {
      error: error?.message,
      errorCode,
      pattern: errorPattern,
      provider,
      context
    });

    return this.generateErrorResponse(errorPattern, error, provider, context);
  }

  private extractErrorCode(error: any, provider: string): string {
    if (provider === 'teller') {
      return this.extractTellerErrorCode(error);
    } else if (provider === 'snaptrade') {
      return this.extractSnapTradeErrorCode(error);
    }
    return 'UNKNOWN_ERROR';
  }

  private extractTellerErrorCode(error: any): string {
    const status = error?.response?.status || error?.status;
    const errorBody = error?.responseBody || error?.error;
    
    // Teller-specific error codes from their documentation
    if (errorBody?.code) {
      return errorBody.code;
    }
    
    // Map HTTP status to error patterns
    switch (status) {
      case 401:
        return 'TELLER_UNAUTHORIZED';
      case 403:
        return 'TELLER_FORBIDDEN';
      case 404:
        if (errorBody?.code?.startsWith('enrollment.disconnected')) {
          return 'TELLER_ENROLLMENT_DISCONNECTED';
        }
        if (errorBody?.code === 'account.closed') {
          return 'TELLER_ACCOUNT_CLOSED';
        }
        return 'TELLER_NOT_FOUND';
      case 410:
        return 'TELLER_ACCOUNT_CLOSED';
      case 422:
        return 'TELLER_INVALID_REQUEST';
      case 429:
        return 'TELLER_RATE_LIMITED';
      case 502:
        return 'TELLER_BANK_UNAVAILABLE';
      default:
        return 'TELLER_API_ERROR';
    }
  }

  private extractSnapTradeErrorCode(error: any): string {
    const message = error?.message?.toLowerCase() || '';
    const response = error?.response;
    
    // SnapTrade-specific patterns
    if (message.includes('user not found')) {
      return 'SNAPTRADE_USER_NOT_FOUND';
    }
    if (message.includes('invalid user')) {
      return 'SNAPTRADE_INVALID_USER';
    }
    if (message.includes('unauthorized')) {
      return 'SNAPTRADE_UNAUTHORIZED';
    }
    if (message.includes('rate limit')) {
      return 'SNAPTRADE_RATE_LIMITED';
    }
    if (message.includes('account not found')) {
      return 'SNAPTRADE_ACCOUNT_NOT_FOUND';
    }
    if (message.includes('connection') || message.includes('network')) {
      return 'SNAPTRADE_CONNECTION_ERROR';
    }
    
    return 'SNAPTRADE_API_ERROR';
  }

  private identifyErrorPattern(error: any, errorCode: string, provider: string): string {
    // Authentication errors
    if (errorCode.includes('UNAUTHORIZED') || errorCode.includes('FORBIDDEN')) {
      return 'AUTHENTICATION_FAILURE';
    }
    
    // Account connection issues
    if (errorCode.includes('DISCONNECTED') || errorCode.includes('USER_NOT_FOUND')) {
      return 'ACCOUNT_DISCONNECTED';
    }
    
    // Account status issues
    if (errorCode.includes('ACCOUNT_CLOSED')) {
      return 'ACCOUNT_CLOSED';
    }
    
    // Rate limiting
    if (errorCode.includes('RATE_LIMITED')) {
      return 'RATE_LIMITED';
    }
    
    // Network/API issues
    if (errorCode.includes('CONNECTION_ERROR') || errorCode.includes('BANK_UNAVAILABLE')) {
      return 'NETWORK_ISSUE';
    }
    
    // Configuration issues
    if (errorCode.includes('INVALID_REQUEST') || errorCode.includes('INVALID_USER')) {
      return 'CONFIGURATION_ERROR';
    }
    
    return 'GENERAL_ERROR';
  }

  private generateErrorResponse(pattern: string, originalError: any, provider: 'teller' | 'snaptrade', context: string): IntelligentError {
    switch (pattern) {
      case 'AUTHENTICATION_FAILURE':
        return this.createAuthenticationError(provider, originalError);
      
      case 'ACCOUNT_DISCONNECTED':
        return this.createDisconnectionError(provider, originalError);
      
      case 'ACCOUNT_CLOSED':
        return this.createAccountClosedError(provider, originalError);
      
      case 'RATE_LIMITED':
        return this.createRateLimitError(provider, originalError);
      
      case 'NETWORK_ISSUE':
        return this.createNetworkError(provider, originalError);
      
      case 'CONFIGURATION_ERROR':
        return this.createConfigurationError(provider, originalError);
      
      default:
        return this.createGeneralError(provider, originalError, context);
    }
  }

  private createAuthenticationError(provider: 'teller' | 'snaptrade', error: any): IntelligentError {
    const isSnapTrade = provider === 'snaptrade';
    
    return {
      code: `${provider.toUpperCase()}_AUTH_FAILURE`,
      userMessage: isSnapTrade 
        ? 'Your brokerage account connection has expired and needs to be refreshed.'
        : 'Your bank account connection has expired and needs to be refreshed.',
      technicalMessage: error?.message || 'Authentication credentials are invalid or expired',
      category: 'authentication',
      severity: 'critical',
      affectedProvider: provider,
      solutions: [
        {
          title: 'Reconnect Your Account',
          description: isSnapTrade 
            ? 'Go to Account Settings and reconnect your brokerage account. This will refresh your login credentials.'
            : 'Go to Account Settings and reconnect your bank account through our secure connection process.',
          actionType: 'guided',
          actionId: 'reconnect_account',
          estimatedTime: '2-3 minutes',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Go to Settings → Connected Accounts',
            isSnapTrade ? 'Find your brokerage account' : 'Find your bank account',
            'Click "Reconnect" and follow the prompts',
            'Complete the secure authentication process'
          ]
        },
        {
          title: 'Clear Stored Credentials',
          description: 'Remove old authentication data that might be causing conflicts.',
          actionType: 'automatic',
          actionId: 'clear_stale_credentials',
          estimatedTime: '30 seconds',
          difficulty: 'easy',
          riskLevel: 'safe'
        }
      ],
      preventionTips: [
        'Enable account notifications to get alerts before connections expire',
        'Check your connection status regularly in the dashboard'
      ]
    };
  }

  private createDisconnectionError(provider: 'teller' | 'snaptrade', error: any): IntelligentError {
    const isSnapTrade = provider === 'snaptrade';
    
    return {
      code: `${provider.toUpperCase()}_DISCONNECTED`,
      userMessage: isSnapTrade
        ? 'Your brokerage account has been disconnected. This usually happens when you change your login credentials.'
        : 'Your bank account connection was disconnected. This may be due to security settings or password changes.',
      technicalMessage: error?.message || 'Account enrollment has been disconnected',
      category: 'account_status',
      severity: 'critical',
      affectedProvider: provider,
      solutions: [
        {
          title: 'Reconnect Account',
          description: 'Establish a fresh connection to restore access to your account data.',
          actionType: 'guided',
          actionId: 'reconnect_account',
          estimatedTime: '3-5 minutes',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Go to Settings → Connected Accounts',
            'Remove the disconnected account',
            'Add the account again using the "Connect Account" button',
            'Complete the authentication process'
          ]
        }
      ],
      preventionTips: [
        'Avoid changing your financial account passwords frequently',
        'If you must change passwords, remember to reconnect your accounts in Flint',
        'Enable two-factor authentication on your financial accounts for better security'
      ]
    };
  }

  private createAccountClosedError(provider: 'teller' | 'snaptrade', error: any): IntelligentError {
    return {
      code: `${provider.toUpperCase()}_ACCOUNT_CLOSED`,
      userMessage: 'This account appears to be closed or no longer accessible. You should remove it from your connections.',
      technicalMessage: error?.message || 'Account has been closed by the financial institution',
      category: 'account_status',
      severity: 'warning',
      affectedProvider: provider,
      solutions: [
        {
          title: 'Remove Closed Account',
          description: 'Clean up your account list by removing accounts that are no longer active.',
          actionType: 'guided',
          actionId: 'remove_closed_account',
          estimatedTime: '1 minute',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Go to Settings → Connected Accounts',
            'Find the closed account',
            'Click "Remove" or "Disconnect"',
            'Confirm the removal'
          ]
        }
      ]
    };
  }

  private createRateLimitError(provider: 'teller' | 'snaptrade', error: any): IntelligentError {
    return {
      code: `${provider.toUpperCase()}_RATE_LIMITED`,
      userMessage: 'We\'re making too many requests right now. Please wait a few minutes and try again.',
      technicalMessage: error?.message || 'API rate limit exceeded',
      category: 'api_limits',
      severity: 'warning',
      affectedProvider: provider,
      solutions: [
        {
          title: 'Wait and Retry',
          description: 'The rate limit will reset automatically. Wait 5-10 minutes before trying again.',
          actionType: 'manual',
          estimatedTime: '5-10 minutes',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Wait 5-10 minutes for the rate limit to reset',
            'Refresh your dashboard or retry the action',
            'If the problem persists, try again in an hour'
          ]
        },
        {
          title: 'Reduce Refresh Frequency',
          description: 'Temporarily reduce automatic data refreshing to avoid hitting limits.',
          actionType: 'guided',
          actionId: 'reduce_refresh_rate',
          estimatedTime: '1 minute',
          difficulty: 'easy',
          riskLevel: 'safe'
        }
      ],
      preventionTips: [
        'Avoid refreshing your dashboard frequently in a short period',
        'Be patient with data updates - they happen automatically'
      ]
    };
  }

  private createNetworkError(provider: 'teller' | 'snaptrade', error: any): IntelligentError {
    const isSnapTrade = provider === 'snaptrade';
    
    return {
      code: `${provider.toUpperCase()}_NETWORK_ERROR`,
      userMessage: isSnapTrade
        ? 'Unable to connect to your brokerage. This might be a temporary issue with their servers.'
        : 'Unable to connect to your bank. This could be due to maintenance or connectivity issues.',
      technicalMessage: error?.message || 'Network connectivity issue',
      category: 'network',
      severity: 'warning',
      affectedProvider: provider,
      solutions: [
        {
          title: 'Wait and Retry',
          description: 'Network issues are often temporary. Try again in a few minutes.',
          actionType: 'manual',
          estimatedTime: '5-15 minutes',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Wait 5-15 minutes for the network issue to resolve',
            'Check if other websites are working normally',
            'Refresh your dashboard to try again'
          ]
        },
        {
          title: 'Check Service Status',
          description: 'Verify if the financial institution is experiencing known issues.',
          actionType: 'manual',
          estimatedTime: '2 minutes',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Visit your financial institution\'s website',
            'Look for service status or maintenance notices',
            'Check their social media for outage reports'
          ]
        }
      ],
      preventionTips: [
        'Enable notifications to be alerted about connection issues',
        'Most network issues resolve themselves within 30 minutes'
      ]
    };
  }

  private createConfigurationError(provider: 'teller' | 'snaptrade', error: any): IntelligentError {
    return {
      code: `${provider.toUpperCase()}_CONFIG_ERROR`,
      userMessage: 'There\'s a configuration issue with your account connection. This may require reconnecting your account.',
      technicalMessage: error?.message || 'Account configuration is invalid',
      category: 'configuration',
      severity: 'warning',
      affectedProvider: provider,
      solutions: [
        {
          title: 'Reconfigure Connection',
          description: 'Reset your account configuration by reconnecting.',
          actionType: 'guided',
          actionId: 'reconfigure_connection',
          estimatedTime: '3-5 minutes',
          difficulty: 'medium',
          riskLevel: 'safe',
          steps: [
            'Go to Settings → Connected Accounts',
            'Remove the problematic account',
            'Wait 30 seconds',
            'Reconnect the account with fresh settings'
          ]
        },
        {
          title: 'Clear Configuration Cache',
          description: 'Remove cached configuration data that might be outdated.',
          actionType: 'automatic',
          actionId: 'clear_config_cache',
          estimatedTime: '30 seconds',
          difficulty: 'easy',
          riskLevel: 'safe'
        }
      ]
    };
  }

  private createGeneralError(provider: 'teller' | 'snaptrade', error: any, context: string): IntelligentError {
    return {
      code: `${provider.toUpperCase()}_GENERAL_ERROR`,
      userMessage: 'We encountered an unexpected issue with your account connection. Our support team can help resolve this.',
      technicalMessage: error?.message || 'Unknown error occurred',
      category: 'configuration',
      severity: 'warning',
      affectedProvider: provider,
      solutions: [
        {
          title: 'Try Basic Troubleshooting',
          description: 'Attempt some common fixes that resolve most connection issues.',
          actionType: 'guided',
          actionId: 'basic_troubleshooting',
          estimatedTime: '5-10 minutes',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Refresh your browser and try again',
            'Check your internet connection',
            'Sign out and back in to Flint',
            'Try reconnecting the problematic account'
          ]
        },
        {
          title: 'Contact Support',
          description: 'If the issue persists, our support team can provide personalized assistance.',
          actionType: 'contact_support',
          estimatedTime: '24 hours',
          difficulty: 'easy',
          riskLevel: 'safe',
          steps: [
            'Go to Help & Support in your account settings',
            'Describe the issue you\'re experiencing',
            'Include any error messages you\'ve seen',
            'Our team will respond within 24 hours'
          ]
        }
      ]
    };
  }

  /**
   * Generate user-friendly error messages for API responses
   */
  formatForApiResponse(intelligentError: IntelligentError): any {
    return {
      error: {
        code: intelligentError.code,
        message: intelligentError.userMessage,
        category: intelligentError.category,
        severity: intelligentError.severity,
        provider: intelligentError.affectedProvider
      },
      solutions: intelligentError.solutions.map(solution => ({
        title: solution.title,
        description: solution.description,
        actionType: solution.actionType,
        actionId: solution.actionId,
        estimatedTime: solution.estimatedTime,
        difficulty: solution.difficulty,
        riskLevel: solution.riskLevel
      })),
      preventionTips: intelligentError.preventionTips || []
    };
  }
}

export const intelligentErrorService = IntelligentErrorService.getInstance();