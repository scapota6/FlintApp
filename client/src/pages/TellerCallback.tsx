import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ensureCsrf } from "@/lib/csrf";

export default function TellerCallback() {
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      // Extract enrollment ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const enrollmentId = urlParams.get('enrollment_id');
      const error = urlParams.get('error');

      if (error) {
        toast({
          title: "Connection Failed",
          description: error === 'cancelled' ? "Connection was cancelled" : `Error: ${error}`,
          variant: "destructive",
        });
        
        // Close window after 2 seconds
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            window.location.href = '/dashboard';
          }
        }, 2000);
        return;
      }

      if (!enrollmentId) {
        toast({
          title: "Connection Failed",
          description: "No enrollment ID received",
          variant: "destructive",
        });
        
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            window.location.href = '/dashboard';
          }
        }, 2000);
        return;
      }

      console.log('🏦 Teller Callback: Received enrollment ID:', enrollmentId);

      try {
        // Ensure CSRF token
        await ensureCsrf();
        
        // Exchange enrollment ID for account data
        const data = await apiRequest("/api/teller/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            enrollmentId,
            tellerToken: enrollmentId // Teller uses enrollment_id as the token
          })
        });
        
        if (data.success) {
          toast({
            title: "Bank Connected!",
            description: `Successfully connected ${data.accounts} account(s)`,
          });

          // Notify parent window if opened as popup
          if (window.opener) {
            window.opener.postMessage({ tellerConnected: true }, window.location.origin);
            setTimeout(() => window.close(), 2000);
          } else {
            // Redirect to dashboard if not a popup
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 2000);
          }
        } else {
          throw new Error(data.message || 'Failed to connect account');
        }
      } catch (error: any) {
        console.error('🏦 Teller Callback: Error exchanging token:', error);
        toast({
          title: "Connection Failed",
          description: error.message || "Failed to connect bank account",
          variant: "destructive",
        });
        
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            window.location.href = '/dashboard';
          }
        }, 3000);
      }
    };

    handleCallback();
  }, [toast]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Connecting Your Bank Account...</h2>
        <p className="text-muted-foreground">Please wait while we complete the connection.</p>
      </div>
    </div>
  );
}