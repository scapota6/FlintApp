/**
 * SnapTrade Error Handler Component
 * Displays user-friendly error messages and provides reconnection actions
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Unlink2, Clock } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { requestJSON } from '@/lib/http';
import { getCsrfToken } from '@/lib/csrf';

interface SnapTradeErrorProps {
  error: {
    code: string;
    message: string;
    action: 'reconnect' | 'register' | 'retry' | 'backoff';
    userMessage: string;
    httpStatus: number;
  };
  onRetry?: () => void;
  className?: string;
}

export default function SnapTradeErrorHandler({ error, onRetry, className }: SnapTradeErrorProps) {
  // Generate portal URL for reconnection
  const reconnectMutation = useMutation({
    mutationFn: async () => {
      const token = await getCsrfToken();
      return requestJSON('/api/snaptrade/portal-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({})
      });
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank', 'width=800,height=600');
      }
    }
  });

  const handleAction = () => {
    switch (error.action) {
      case 'reconnect':
      case 'register':
        reconnectMutation.mutate();
        break;
      case 'retry':
        if (onRetry) onRetry();
        break;
      case 'backoff':
        // Wait before allowing retry
        setTimeout(() => {
          if (onRetry) onRetry();
        }, 2000);
        break;
    }
  };

  const getIcon = () => {
    switch (error.action) {
      case 'reconnect':
      case 'register':
        return <Unlink2 className="h-4 w-4" />;
      case 'backoff':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getActionText = () => {
    switch (error.action) {
      case 'reconnect':
        return 'Reconnect Account';
      case 'register':
        return 'Connect Account';
      case 'backoff':
        return 'Wait & Retry';
      default:
        return 'Try Again';
    }
  };

  const getVariant = (): 'default' | 'destructive' => {
    return ['1076', '428', '409', '403'].includes(error.code) ? 'destructive' : 'default';
  };

  return (
    <Alert variant={getVariant()} className={className}>
      {getIcon()}
      <AlertDescription className="flex items-center justify-between">
        <span>{error.userMessage}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAction}
          disabled={reconnectMutation.isPending || error.action === 'backoff'}
          className="ml-4"
        >
          {reconnectMutation.isPending && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
          {getActionText()}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Connection Status Component
 * Shows status for individual connections with reconnect actions
 */
interface ConnectionStatusProps {
  connection: {
    id: string;
    name: string;
    disabled?: boolean;
    needsReconnect?: boolean;
    reconnectUrl?: string;
  };
  onReconnect?: () => void;
}

export function ConnectionStatus({ connection, onReconnect }: ConnectionStatusProps) {
  // Generate reconnect portal URL
  const reconnectMutation = useMutation({
    mutationFn: async () => {
      const token = await getCsrfToken();
      return requestJSON('/api/snaptrade/portal-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({
          reconnect: connection.id
        })
      });
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank', 'width=800,height=600');
        if (onReconnect) onReconnect();
      }
    }
  });

  if (connection.disabled || connection.needsReconnect) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span className="text-red-400 text-sm">Disconnected</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => reconnectMutation.mutate()}
          disabled={reconnectMutation.isPending}
          className="ml-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          {reconnectMutation.isPending && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
          Reconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      <span className="text-green-400 text-sm">Connected</span>
    </div>
  );
}