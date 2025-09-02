/**
 * Error display components with requestId for support debugging
 * Shows actionable error messages with tooltips containing requestId
 */

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface ErrorData {
  code: string;
  message: string;
  requestId: string;
  retryAfter?: number;
}

interface ErrorDisplayProps {
  error: ErrorData | Error | any;
  onRetry?: () => void;
  className?: string;
}

/**
 * Parse error data from various error formats
 */
function parseError(error: any): ErrorData {
  // Direct error data format
  if (error?.error?.code && error?.error?.message && error?.error?.requestId) {
    return error.error;
  }

  // API response error format
  if (error?.data?.error) {
    return error.data.error;
  }

  // Network error with requestId
  if (error?.requestId) {
    return {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network request failed',
      requestId: error.requestId
    };
  }

  // Generic error
  return {
    code: 'UNKNOWN_ERROR',
    message: error?.message || 'An unexpected error occurred',
    requestId: `unknown_${Date.now()}`
  };
}

/**
 * Get user-friendly error message and action based on error code
 */
function getErrorContext(code: string) {
  switch (code) {
    case 'SNAPTRADE_NOT_REGISTERED':
      return {
        title: 'Account Setup Required',
        message: 'You need to complete SnapTrade registration first.',
        action: 'Go to Connections',
        variant: 'default' as const,
        actionUrl: '/connections'
      };

    case 'SNAPTRADE_USER_MISMATCH':
      return {
        title: 'Account Mismatch',
        message: 'Your SnapTrade credentials need to be refreshed. Please reconnect your account.',
        action: 'Reconnect Account',
        variant: 'destructive' as const,
        actionUrl: '/connections'
      };

    case 'SIGNATURE_INVALID':
      return {
        title: 'Authentication Issue',
        message: 'Your SnapTrade session has expired. Please reconnect your account.',
        action: 'Reconnect Account',
        variant: 'destructive' as const,
        actionUrl: '/connections'
      };

    case 'RATE_LIMITED':
      return {
        title: 'Rate Limit Reached',
        message: 'Too many requests. Please wait a moment before trying again.',
        action: 'Retry',
        variant: 'default' as const,
        showRetry: true
      };

    case 'AUTHENTICATION_REQUIRED':
      return {
        title: 'Login Required',
        message: 'Please log in to access this feature.',
        action: 'Login',
        variant: 'default' as const,
        actionUrl: '/login'
      };

    case 'ACCOUNT_NOT_FOUND':
      return {
        title: 'Account Not Found',
        message: 'The requested account could not be found.',
        action: 'View Accounts',
        variant: 'default' as const,
        actionUrl: '/dashboard'
      };

    default:
      return {
        title: 'Error',
        message: 'An error occurred while processing your request.',
        action: 'Retry',
        variant: 'destructive' as const,
        showRetry: true
      };
  }
}

/**
 * Main error display component
 */
export function ErrorDisplay({ error, onRetry, className }: ErrorDisplayProps) {
  const errorData = parseError(error);
  const context = getErrorContext(errorData.code);

  const handleAction = () => {
    if (context.showRetry && onRetry) {
      onRetry();
    } else if (context.actionUrl) {
      window.location.href = context.actionUrl;
    }
  };

  return (
    <Alert variant={context.variant} className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{context.title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p>{errorData.message}</p>
          
          <div className="flex items-center justify-between">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help border-b border-dotted">
                    Request ID: {errorData.requestId.slice(-8)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    Full Request ID: {errorData.requestId}
                    <br />
                    <span className="text-muted-foreground">
                      Include this ID when contacting support
                    </span>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              onClick={handleAction}
              size="sm"
              variant={context.variant === 'destructive' ? 'default' : 'outline'}
              className="ml-4"
            >
              {context.showRetry && <RefreshCw className="h-3 w-3 mr-1" />}
              {context.actionUrl && <ExternalLink className="h-3 w-3 mr-1" />}
              {context.action}
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Compact error display for smaller spaces
 */
export function CompactErrorDisplay({ error, onRetry, className }: ErrorDisplayProps) {
  const errorData = parseError(error);
  const context = getErrorContext(errorData.code);

  return (
    <div className={`flex items-center justify-between p-3 border border-destructive/20 bg-destructive/5 rounded-md ${className}`}>
      <div className="flex items-center space-x-2">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">{errorData.message}</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">
                ID: {errorData.requestId.slice(-6)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Request ID: {errorData.requestId}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {(context.showRetry && onRetry) && (
          <Button onClick={onRetry} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Error boundary fallback component
 */
export function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  const errorData = {
    code: 'COMPONENT_ERROR',
    message: error.message || 'A component error occurred',
    requestId: `boundary_${Date.now()}`
  };

  return (
    <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-lg">
      <div className="flex items-center space-x-2 mb-4">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <h3 className="text-lg font-semibold text-destructive">Something went wrong</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        A component error occurred. Please try refreshing the page.
      </p>

      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help border-b border-dotted">
                Error ID: {errorData.requestId}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Error: {error.message}
                <br />
                Stack: {error.stack?.slice(0, 100)}...
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button onClick={resetErrorBoundary} size="sm">
          <RefreshCw className="h-3 w-3 mr-1" />
          Try Again
        </Button>
      </div>
    </div>
  );
}