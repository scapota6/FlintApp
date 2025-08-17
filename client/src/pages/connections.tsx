import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";

import AccountCard from "@/components/AccountCard";
import { 
  Building2, 
  CreditCard, 
  AlertCircle,
  ChevronRight,
  Shield,
  Link2,
  ArrowLeft,
  Unlink,
  Trash2
} from "lucide-react";

// Type definitions
interface ConnectedAccount {
  id: string;
  provider: string;
  accountName: string;
  accountNumber?: string;
  balance: number;
  type: 'investment' | 'bank' | 'card';
  institution: string;
  lastUpdated: string;
  cash?: number;
  holdings?: number;
  buyingPower?: number;
}

interface HoldingsResponse {
  accounts: ConnectedAccount[];
  positions: any[];
}

export default function Connections() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] = useState<string | null>(null);


  // Fetch connected accounts
  const { data: holdingsData, isLoading: isLoadingAccounts } = useQuery<HoldingsResponse>({
    queryKey: ['/api/holdings'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch current user data for account details
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user']
  });

  // Disconnect account mutation
  const disconnectMutation = useMutation({
    mutationFn: async ({ provider, accountId }: { provider: string; accountId: string }) => {
      return apiRequest(`/api/connections/disconnect/${provider}`, {
        method: 'POST',
        body: JSON.stringify({ accountId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/holdings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      setDisconnectingAccount(null);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to disconnect account');
      setDisconnectingAccount(null);
    }
  });

  const handleDisconnect = async (provider: string, accountId: string) => {
    if (confirm('Are you sure you want to disconnect this account? This will remove access to its data.')) {
      setDisconnectingAccount(accountId);
      setError(null);
      disconnectMutation.mutate({ provider, accountId });
    }
  };

  const connectedAccounts = holdingsData?.accounts || [];

  const handleSnapTradeConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Get authenticated user data first
      const userResp = await fetch('/api/auth/user');
      if (!userResp.ok) throw new Error("Authentication required");
      const currentUser = await userResp.json();
      
      if (!currentUser.id) throw new Error("User ID not available");

      const response = await fetch('/api/connections/snaptrade/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to connect brokerage');
      }

      const data = await response.json();
      const redirectUrl = data?.connect?.url;
      
      // Open SnapTrade connection portal in popup window
      if (redirectUrl) {
        // Calculate center position for popup
        const width = 500;
        const height = 700;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        
        const popup = window.open(
          redirectUrl,
          'SnapTradeConnect',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );
        
        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          setError('Please allow popups for this site to connect your account');
          setIsConnecting(false);
          return;
        }
        
        // Monitor popup for closure
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            setIsConnecting(false);
            // Refresh the page to check if connection was successful
            window.location.reload();
          }
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnecting(false);
    }
  };

  const handleTellerConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/connections/teller/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to initialize Teller');
      }

      const { applicationId } = await response.json();
      
      // Open Teller Connect popup
      const tellerConnect = (window as any).TellerConnect?.setup({
        applicationId: applicationId,
        onSuccess: async (enrollment: any) => {
          // Exchange enrollment for access token
          const exchangeResponse = await fetch('/api/connections/teller/exchange', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enrollmentId: enrollment.accessToken })
          });

          if (exchangeResponse.ok) {
            window.location.href = '/accounts';
          } else {
            setError('Failed to complete bank connection');
          }
        },
        onExit: () => {
          setIsConnecting(false);
        }
      });

      tellerConnect?.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnecting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/accounts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Connect Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Securely connect your financial accounts to start managing your portfolio
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 mb-6 p-3 bg-muted rounded-lg">
        <Shield className="h-5 w-5 text-green-600" />
        <p className="text-sm">
          Your credentials are encrypted and never stored on our servers
        </p>
      </div>

      <Tabs defaultValue="connected" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connected">Connected Accounts</TabsTrigger>
          <TabsTrigger value="brokerages">Add Brokerage</TabsTrigger>
          <TabsTrigger value="banks">Add Bank</TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your Connected Accounts</span>
                <Badge variant="secondary">{connectedAccounts.length} account{connectedAccounts.length !== 1 ? 's' : ''}</Badge>
              </CardTitle>
              <CardDescription>
                Manage your connected financial accounts and their permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAccounts ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-muted rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : connectedAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Connected Accounts</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your first account to start tracking your portfolio
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => {
                      const tabsElement = document.querySelector('[value="brokerages"]') as HTMLButtonElement;
                      tabsElement?.click();
                    }}>
                      Add Brokerage
                    </Button>
                    <Button variant="outline" onClick={() => {
                      const tabsElement = document.querySelector('[value="banks"]') as HTMLButtonElement;
                      tabsElement?.click();
                    }}>
                      Add Bank
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {connectedAccounts.map((account, index) => (
                    <AccountCard 
                      key={account.id || index}
                      account={{
                        id: account.id,
                        brokerageName: account.accountName,
                        brokerage: account.institution,
                        type: account.type
                      }}
                      currentUser={currentUser}
                    />
                  ))}
                  
                  {connectedAccounts.some(acc => acc.provider === 'snaptrade') && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="text-sm font-medium">Disconnect All SnapTrade Accounts</span>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('This will disconnect ALL your brokerage accounts. Are you sure?')) {
                              disconnectMutation.mutate({ provider: 'snaptrade', accountId: 'all' });
                            }
                          }}
                          disabled={disconnectMutation.isPending}
                        >
                          Disconnect All
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brokerages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Connect Brokerage Account
              </CardTitle>
              <CardDescription>
                Trade stocks, ETFs, and more directly from Flint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Supported Brokerages</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Connect with 30+ major brokerages including Robinhood, E*TRADE, TD Ameritrade, and more
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Real-time portfolio tracking</li>
                    <li>• Execute trades across multiple accounts</li>
                    <li>• View transaction history</li>
                    <li>• Monitor account performance</li>
                  </ul>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSnapTradeConnect}
                  disabled={isConnecting}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect Brokerage Account'}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Connect Bank or Card
              </CardTitle>
              <CardDescription>
                Link your bank accounts and credit cards for complete financial overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Supported Institutions</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Connect with thousands of banks and credit unions across the US
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• View real-time balances</li>
                    <li>• Track spending patterns</li>
                    <li>• Monitor transactions</li>
                    <li>• Manage transfers between accounts</li>
                  </ul>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleTellerConnect}
                  disabled={isConnecting}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect Bank Account'}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Security & Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Bank-level 256-bit encryption protects your data</p>
            <p>• We never store your login credentials</p>
            <p>• Read-only access by default (upgrade for trading)</p>
            <p>• You can disconnect accounts at any time</p>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}