import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Building2, 
  CreditCard, 
  AlertCircle,
  ChevronRight,
  Shield,
  Link2,
  ArrowLeft
} from "lucide-react";

export default function Connections() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSnapTradeConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/connections/snaptrade/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionType: 'read_write',
          immediateRedirect: true
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to connect brokerage');
      }

      const { redirectUrl } = await response.json();
      
      // Redirect to SnapTrade connection portal
      if (redirectUrl) {
        window.location.href = redirectUrl;
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

      <Tabs defaultValue="brokerages" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="brokerages">Brokerages</TabsTrigger>
          <TabsTrigger value="banks">Banks & Cards</TabsTrigger>
        </TabsList>

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