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
  AlertCircle,
  Unlink,
  Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AccountDetailsModal } from "@/components/AccountDetailsModal";

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
  externalAccountId: string;
}

export default function Accounts() {
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [selectedAccountDetails, setSelectedAccountDetails] = useState<{
    accountId: string;
    accountName: string;
    accountType: 'bank' | 'card';
  } | null>(null);

  // Fetch brokerage accounts from SnapTrade
  const { data: brokerageData, isLoading: brokeragesLoading, refetch: refetchBrokerages } = useQuery({
    queryKey: ['/api/dashboard'],
    select: (data: any) => {
      // Extract accounts from dashboard response
      const accountsList = data?.accounts || [];
      // Filter for investment/brokerage accounts (SnapTrade accounts) that are actually connected
      return accountsList.filter((acc: any) => 
        (acc.provider === 'snaptrade' || acc.type === 'investment') && 
        !acc.needsReconnection && 
        acc.balance > 0
      );
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

  const handleDisconnectAccount = async (accountId: string, type: 'brokerage' | 'bank') => {
    if (!confirm(`Are you sure you want to disconnect this ${type} account?`)) {
      return;
    }
    
    setDisconnecting(accountId);
    try {
      const endpoint = type === 'brokerage' ? `/api/accounts/disconnect` : `/api/banks/disconnect`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountId })
      });
      
      if (response.ok) {
        // Refresh the accounts list
        await handleRefresh();
      } else {
        const error = await response.json();
        alert(`Failed to disconnect account: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error disconnecting account:', error);
      alert('Failed to disconnect account. Please try again.');
    } finally {
      setDisconnecting(null);
    }
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
  const brokerageAccounts: BrokerageAccount[] = (brokerageData || []).map((account: any) => {
    // Fix Coinbase name display
    let displayName = account.accountName || account.institution || 'Investment Account';
    if (displayName === 'Default' && account.institution === 'Coinbase') {
      displayName = 'Coinbase';
    }
    
    return {
      id: account.id,
      name: displayName,
      currency: 'USD',
      balance: account.balance || 0,
      buyingPower: account.buyingPower || (account.balance * 0.5) || 0,
      lastSync: account.lastUpdated || new Date().toISOString(),
    };
  });
  
  const bankAccounts: BankAccount[] = bankData?.accounts || [];
  const hasNoAccounts = !isLoading && brokerageAccounts.length === 0 && bankAccounts.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                Connected Accounts
              </h1>
              <p className="text-slate-400 mt-2">
                Manage your linked brokerage and bank accounts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh All
              </Button>
              <Link href="/connections">
                <Button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
                  <Building2 className="h-4 w-4 mr-2" />
                  Connect Account
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {hasNoAccounts ? (
          <Card className="border-dashed bg-slate-800/30 border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">No Accounts Connected</h3>
              <p className="text-slate-400 text-center mb-4">
                Connect your brokerage or bank accounts to start managing your finances
              </p>
              <Link href="/connections">
                <Button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
                  Connect Your First Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="brokerages" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border-slate-700">
              <TabsTrigger 
                value="brokerages"
                className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-200 data-[state=active]:border-purple-500/50 text-slate-300"
              >
                Brokerages ({brokerageAccounts.length})
              </TabsTrigger>
              <TabsTrigger 
                value="banks"
                className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-200 data-[state=active]:border-purple-500/50 text-slate-300"
              >
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
              <Card className="border-dashed bg-slate-800/30 border-slate-700">
                <CardContent className="text-center py-8">
                  <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">No brokerage accounts connected</p>
                  <Link href="/connections">
                    <Button variant="link" className="mt-2 text-purple-400 hover:text-purple-300">Connect Brokerage</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {brokerageAccounts.map((account) => (
                  <Card key={account.id} className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
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
                        <div className="flex gap-2">
                          <Link href={`/accounts/brokerage/${account.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDisconnectAccount(account.id.toString(), 'brokerage')}
                            disabled={disconnecting === account.id.toString()}
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Disconnect
                          </Button>
                        </div>
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
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedAccountDetails({
                              accountId: account.externalAccountId,
                              accountName: account.name,
                              accountType: account.type as 'bank' | 'card'
                            })}
                          >
                            <Info className="h-4 w-4 mr-2" />
                            Details
                          </Button>
                          <Link href={`/accounts/bank/${account.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDisconnectAccount(account.id.toString(), 'bank')}
                            disabled={disconnecting === account.id.toString()}
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Disconnect
                          </Button>
                        </div>
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

      {/* Account Details Modal */}
      {selectedAccountDetails && (
        <AccountDetailsModal
          isOpen={!!selectedAccountDetails}
          onClose={() => setSelectedAccountDetails(null)}
          accountId={selectedAccountDetails.accountId}
          accountName={selectedAccountDetails.accountName}
          accountType={selectedAccountDetails.accountType}
        />
      )}
    </div>
  );
}