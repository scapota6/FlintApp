import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorRetryCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorRetryCard({ 
  title = "Failed to load", 
  message = "Something went wrong while loading data.", 
  onRetry,
  isRetrying = false 
}: ErrorRetryCardProps) {
  return (
    <Card className="border-red-500/30 bg-red-900/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-400">
          <AlertCircle className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-300 mb-4">{message}</p>
        {onRetry && (
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}