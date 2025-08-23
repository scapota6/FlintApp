import { useState, useRef, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface DisconnectButtonProps {
  accountId: string;
  provider: string;
  accountName: string;
  onDisconnected: () => void;
  className?: string;
}

export default function DisconnectButton({ 
  accountId, 
  provider, 
  accountName, 
  onDisconnected,
  className = '' 
}: DisconnectButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { toast } = useToast();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowConfirm(false);
      }
    };

    if (showConfirm) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConfirm]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowConfirm(false);
      }
    };

    if (showConfirm) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showConfirm]);

  const handleFirstClick = () => {
    setShowConfirm(true);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      let endpoint: string;
      let method: 'POST' = 'POST';
      let body: any = { accountId };
      
      // Use correct endpoints based on provider
      if (provider.toLowerCase() === 'teller') {
        endpoint = `/api/connections/disconnect/teller`;
      } else if (provider.toLowerCase() === 'snaptrade') {
        endpoint = `/api/connections/disconnect/snaptrade`;
      } else {
        // Default to SnapTrade endpoint
        endpoint = `/api/connections/disconnect/snaptrade`;
      }

      console.log(`Disconnecting ${provider} account ${accountId} via ${endpoint}`);
      
      const response = await apiRequest(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (response.status === 204 || response.status === 200 || response.success) {
        toast({
          title: "Account Disconnected",
          description: `${accountName} has been disconnected successfully.`,
        });
        onDisconnected();
      } else {
        throw new Error('Disconnect failed');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleFirstClick}
        className="text-gray-400 hover:text-red-400 hover:bg-red-900/20 p-2"
        title="Disconnect Account"
        disabled={isDisconnecting}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {showConfirm && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-2 z-50 w-72 p-4 rounded-lg shadow-lg border"
          style={{ 
            background: 'var(--surface)', 
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-title"
        >
          <div className="flex items-start justify-between mb-3">
            <h3 id="disconnect-title" className="text-sm font-medium text-white">
              Disconnect Account
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-gray-400 hover:text-white p-1 -mr-1 -mt-1"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <p className="text-sm text-gray-300 mb-4">
            Are you sure you want to disconnect <strong>{accountName}</strong>?
          </p>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="flex-1 bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDisconnect}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              disabled={isDisconnecting}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}