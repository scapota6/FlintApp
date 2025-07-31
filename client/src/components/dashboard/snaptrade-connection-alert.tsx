import { AlertCircle, RefreshCw, Link2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface SnapTradeConnectionAlertProps {
  snapTradeStatus?: {
    error?: 'not_connected' | 'auth_failed' | 'fetch_failed';
    connected?: boolean;
  };
}

export default function SnapTradeConnectionAlert({ snapTradeStatus }: SnapTradeConnectionAlertProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  if (!snapTradeStatus?.error) {
    return null;
  }

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await apiRequest('POST', '/api/snaptrade/register');
      const data = await response.json();
      
      if (data.redirectUrl) {
        // Open SnapTrade connection portal in a popup
        const width = 800;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        window.open(
          data.redirectUrl,
          'SnapTradeConnect',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );
        
        toast({
          title: "Connection Portal Opened",
          description: "Complete the connection in the popup window"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Unable to start SnapTrade connection",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const getAlertContent = () => {
    switch (snapTradeStatus.error) {
      case 'not_connected':
        return {
          title: "Connect Your Brokerage Account",
          description: "Connect your investment accounts like Alpaca to see your holdings and enable trading.",
          action: "Connect Account",
          icon: Link2
        };
      case 'auth_failed':
        return {
          title: "Brokerage Connection Issue",
          description: "Your brokerage account connection needs to be re-authenticated. This can happen when credentials expire.",
          action: "Reconnect Account",
          icon: RefreshCw
        };
      case 'fetch_failed':
        return {
          title: "Unable to Fetch Brokerage Data",
          description: "We're having trouble accessing your brokerage accounts. Please try again.",
          action: "Retry Connection",
          icon: AlertCircle
        };
      default:
        return null;
    }
  };

  const content = getAlertContent();
  if (!content) return null;

  const Icon = content.icon;

  return (
    <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
      <Icon className="h-4 w-4 text-orange-500" />
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p>{content.description}</p>
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            size="sm"
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                {content.action}
              </>
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}