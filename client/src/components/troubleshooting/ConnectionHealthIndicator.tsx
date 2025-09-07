import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Settings,
  Wifi
} from 'lucide-react';
import ConnectionTroubleshootingGuide from './ConnectionTroubleshootingGuide';
import { apiRequest } from '@/lib/queryClient';

interface ConnectionHealthProps {
  className?: string;
  showDetails?: boolean;
}

interface QuickStatus {
  overallHealth: 'healthy' | 'degraded' | 'critical';
  criticalIssues: number;
  warningIssues: number;
  hasAutoRepairs: boolean;
  accountStatus: {
    teller: {
      totalAccounts: number;
      connectedAccounts: number;
      failedAccounts: number;
      lastSuccessfulSync?: string;
    };
    snaptrade: {
      totalAccounts: number;
      connectedAccounts: number;
      failedAccounts: number;
      lastSuccessfulSync?: string;
    };
  };
  lastChecked: string;
}

export function ConnectionHealthIndicator({ className = '', showDetails = true }: ConnectionHealthProps) {
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  
  const { data: status, isLoading, refetch } = useQuery<{ success: boolean; status: QuickStatus }>({
    queryKey: ['/api/diagnostics/quick-check'],
    queryFn: () => apiRequest('/api/diagnostics/quick-check').then(r => r.json()),
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    refetchIntervalInBackground: true
  });

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getHealthIcon = (health: string) => {
    const iconClass = `h-4 w-4 ${getHealthColor(health)}`;
    
    switch (health) {
      case 'healthy':
        return <CheckCircle className={iconClass} />;
      case 'degraded':
        return <AlertTriangle className={iconClass} />;
      case 'critical':
        return <XCircle className={iconClass} />;
      default:
        return <Clock className={iconClass} />;
    }
  };

  const getHealthBadgeVariant = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'default';
      case 'degraded':
        return 'secondary';
      case 'critical':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getHealthText = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'All connections healthy';
      case 'degraded':
        return 'Some connection issues detected';
      case 'critical':
        return 'Critical connection problems';
      default:
        return 'Checking connections...';
    }
  };

  if (isLoading || !status?.success) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-600 dark:text-gray-400">Checking connections...</span>
      </div>
    );
  }

  const { status: connectionStatus } = status;
  const totalIssues = connectionStatus.criticalIssues + connectionStatus.warningIssues;
  
  // Compact view
  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getHealthIcon(connectionStatus.overallHealth)}
        <Badge variant={getHealthBadgeVariant(connectionStatus.overallHealth)} className="text-xs">
          Connection Health
        </Badge>
        {totalIssues > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTroubleshooting(true)}
            className="text-xs px-2 py-1 h-auto"
          >
            Fix Issues ({totalIssues})
          </Button>
        )}
        
        {showTroubleshooting && (
          <ConnectionTroubleshootingGuide
            isOpen={showTroubleshooting}
            onClose={() => setShowTroubleshooting(false)}
          />
        )}
      </div>
    );
  }

  // Detailed view with popover
  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center space-x-2 p-2">
            <Wifi className="h-4 w-4" />
            {getHealthIcon(connectionStatus.overallHealth)}
            <span className="text-sm font-medium">Connections</span>
            {totalIssues > 0 && (
              <Badge variant="destructive" className="text-xs ml-1">
                {totalIssues}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Connection Health</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              {getHealthIcon(connectionStatus.overallHealth)}
              <span className="text-sm">{getHealthText(connectionStatus.overallHealth)}</span>
            </div>

            {/* Account Status Summary */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Bank Accounts</span>
                  <span className="text-gray-500">
                    {connectionStatus.accountStatus.teller.connectedAccounts} of {connectionStatus.accountStatus.teller.totalAccounts}
                  </span>
                </div>
                <Progress 
                  value={connectionStatus.accountStatus.teller.totalAccounts > 0 
                    ? (connectionStatus.accountStatus.teller.connectedAccounts / connectionStatus.accountStatus.teller.totalAccounts) * 100 
                    : 0} 
                  className="h-1 mt-1" 
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Brokerage Accounts</span>
                  <span className="text-gray-500">
                    {connectionStatus.accountStatus.snaptrade.connectedAccounts} of {connectionStatus.accountStatus.snaptrade.totalAccounts}
                  </span>
                </div>
                <Progress 
                  value={connectionStatus.accountStatus.snaptrade.totalAccounts > 0 
                    ? (connectionStatus.accountStatus.snaptrade.connectedAccounts / connectionStatus.accountStatus.snaptrade.totalAccounts) * 100 
                    : 0} 
                  className="h-1 mt-1" 
                />
              </div>
            </div>

            {/* Issues Summary */}
            {totalIssues > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Issues Found:
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-4">
                    {connectionStatus.criticalIssues > 0 && (
                      <div className="flex items-center space-x-1">
                        <XCircle className="h-3 w-3 text-red-500" />
                        <span>{connectionStatus.criticalIssues} critical</span>
                      </div>
                    )}
                    {connectionStatus.warningIssues > 0 && (
                      <div className="flex items-center space-x-1">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        <span>{connectionStatus.warningIssues} warnings</span>
                      </div>
                    )}
                  </div>
                  
                  {connectionStatus.hasAutoRepairs && (
                    <Badge variant="outline" className="text-xs">
                      Auto-fix available
                    </Badge>
                  )}
                </div>
                
                <Button 
                  size="sm" 
                  onClick={() => setShowTroubleshooting(true)}
                  className="w-full text-xs"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Troubleshoot Issues
                </Button>
              </div>
            )}

            {/* Last Checked */}
            <div className="text-xs text-gray-500 text-center border-t pt-2">
              Last checked: {new Date(connectionStatus.lastChecked).toLocaleTimeString()}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {showTroubleshooting && (
        <ConnectionTroubleshootingGuide
          isOpen={showTroubleshooting}
          onClose={() => setShowTroubleshooting(false)}
        />
      )}
    </div>
  );
}

export default ConnectionHealthIndicator;