import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorRetryCardProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function ErrorRetryCard({ 
  title = "Failed to load data", 
  message = "Something went wrong. Please try again.",
  onRetry,
  isRetrying = false
}: ErrorRetryCardProps) {
  return (
    <Card className="border-red-600/30 bg-red-900/10">
      <CardContent className="flex items-center gap-3 p-4">
        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-400 font-medium text-sm">{title}</p>
          <p className="text-red-300/70 text-xs">{message}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
          className="border-red-600 text-red-400 hover:bg-red-600/10"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Retry'}
        </Button>
      </CardContent>
    </Card>
  );
}