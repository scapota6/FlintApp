import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  CreditCard, 
  DollarSign, 
  RefreshCw, 
  TrendingUp,
  Eye,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BrokerageAccount {
  id: number;
  name: string;
  currency: string;
  balance: number;
  buyingPower: number;
  lastSync: string;
}

interface BankAccount {
  id: number;
  name: string;
  type: 'checking' | 'savings' | 'card';
  currency: string;
  balance: number;
  lastSync: string;
}

export default function Accounts() {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch brokerage accounts from SnapTrade
  const { data: brokerageData, isLoading: brokeragesLoading, refetch: refetchBrokerages } = useQuery({
    queryKey: ['/api/dashboard'],
    select: (data: any) => {
      // Extract accounts from dashboard response
      const accounts = data?.accounts || [];
      // Filter for investment/brokerage accounts (SnapTrade accounts)
      return accounts.filter((acc: any) => acc.provider === 'snaptrade' || acc.type === 'investment');
    },
    retry: false
  });

  // Fetch bank accounts
  const { data: bankData, isLoading: banksLoading, refetch: refetchBanks } = useQuery({
    queryKey: ['/api/banks'],
    retry: false
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchBrokerages(), refetchBanks()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'checking':
        return <DollarSign className="h-4 w-4" />;
      case 'savings':
        return <TrendingUp className="h-4 w-4" />;
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  const isLoading = brokeragesLoading || banksLoading;
  
  // Map SnapTrade accounts to BrokerageAccount interface
  const brokerageAccounts: BrokerageAccount[] = (brokerageData || []).map((account: any) => ({
    id: account.id,
    name: account.accountName || account.institution || 'Investment Account',
    currency: 'USD',
    balance: account.balance || 0,
    buyingPower: account.buyingPower || (account.balance * 0.5) || 0,
    lastSync: account.lastUpdated || new Date().toISOString(),
  }));
  
  const bankAccounts: BankAccount[] = bankData?.accounts || [];
  const hasNoAccounts = !isLoading && brokerageAccounts.length === 0 && bankAccounts.length === 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Accounts</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/connections">
            <Button>
              Connect Account
            </Button>
          </Link>
        </div>
      </div>

      {hasNoAccounts ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Accounts Connected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect your brokerage or bank accounts to start managing your finances
            </p>
            <Link href="/connections">
              <Button>Connect Your First Account</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="brokerages" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="brokerages">
              Brokerages ({brokerageAccounts.length})
            </TabsTrigger>
            <TabsTrigger value="banks">
              Banks & Cards ({bankAccounts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brokerages" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : brokerageAccounts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No brokerage accounts connected</p>
                  <Link href="/connections">
                    <Button variant="link" className="mt-2">Connect Brokerage</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {brokerageAccounts.map((account) => (
                  <Card key={account.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {account.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            Last synced {formatDistanceToNow(new Date(account.lastSync), { addSuffix: true })}
                          </p>
                        </div>
                        <Link href={`/accounts/brokerage/${account.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="text-xl font-semibold">
                            {formatCurrency(account.balance, account.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Buying Power</p>
                          <p className="text-xl font-semibold">
                            {formatCurrency(account.buyingPower, account.currency)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="banks" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : bankAccounts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No bank or card accounts connected</p>
                  <Link href="/connections">
                    <Button variant="link" className="mt-2">Connect Bank Account</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {bankAccounts.map((account) => (
                  <Card key={account.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getAccountTypeIcon(account.type)}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{account.name}</CardTitle>
                            <Badge variant="secondary" className="mt-1">
                              {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                            </Badge>
                          </div>
                        </div>
                        <Link href={`/accounts/bank/${account.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="text-xl font-semibold">
                            {formatCurrency(account.balance, account.currency)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Last synced {formatDistanceToNow(new Date(account.lastSync), { addSuffix: true })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}