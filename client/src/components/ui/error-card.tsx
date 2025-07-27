import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorCardProps {
  onRetry: () => void;
  message?: string;
}

export default function ErrorCard({ onRetry, message = "Failed to load account" }: ErrorCardProps) {
  return (
    <div className="account-card error-card border-red-500/50 bg-red-900/10">
      <div className="flex items-center justify-center flex-col space-y-4 py-8">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center">
          <h3 className="text-white font-semibold mb-2">{message}</h3>
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="text-red-400 border-red-500/50 hover:bg-red-500/20 hover:text-red-300"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}