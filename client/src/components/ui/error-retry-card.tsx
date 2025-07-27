import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorRetryCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorRetryCard({ 
  title = "Failed to load data", 
  message = "Something went wrong. Please try again.",
  onRetry,
  className = ""
}: ErrorRetryCardProps) {
  return (
    <Card className={`border-red-600/20 bg-red-900/10 ${className}`}>
      <CardContent className="flex items-center justify-between p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div>
            <h3 className="text-red-400 font-medium">{title}</h3>
            <p className="text-red-300/70 text-sm">{message}</p>
          </div>
        </div>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="border-red-600/30 text-red-400 hover:bg-red-900/20 hover:border-red-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}