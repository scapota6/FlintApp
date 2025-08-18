import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTransition } from "@/components/auth/page-transition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransferModal } from "@/components/modals/transfer-modal";
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ArrowRightLeft, Building, TrendingUp, Clock, CheckCircle, XCircle, Plus } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import { TransferSkeleton } from "@/components/ui/skeleton-placeholder";
import { ErrorRetryCard } from "@/components/ui/error-retry-card";

export default function Transfers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Fetch accounts and transfers
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["/api/accounts"],
    queryFn: FinancialAPI.getAccounts,
  });

  const { data: transfers, isLoading: transfersLoading, error, refetch } = useQuery({
    queryKey: ["/api/transfers"],
    queryFn: FinancialAPI.getTransfers,
    refetchInterval: 10000,
  });

  // Handle unauthorized errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
    }
  }, [error, toast]);

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getAccountIcon = (accountType: string) => {
    return accountType === 'bank' ? Building : TrendingUp;
  };

  const getAccountColor = (accountType: string) => {
    switch (accountType) {
      case 'bank':
        return 'bg-blue-500';
      case 'brokerage':
        return 'bg-green-500';
      case 'crypto':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Combine all accounts into a single array for transfers
  const allAccounts = [
    ...(accounts?.brokerages || []),
    ...(accounts?.banks || [])
  ];

  const quickTransferOptions = allAccounts.slice(0, 4).map((account: any) => ({
    id: account.id,
    name: account.accountName || account.name,
    balance: account.balance,
    type: account.accountType || (accounts?.brokerages?.includes(account) ? 'brokerage' : 'bank'),
    institution: account.institutionName || account.institution,
  }));

  if (accountsLoading || transfersLoading) {
    return (
      <PageTransition className="min-h-screen bg-[#121212] text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-64 bg-gray-800 rounded-xl"></div>
              ))}
            </div>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-[#121212] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 font-mono">
            <span className="sparkle-title">Transfers</span>
          </h1>
          <p className="text-gray-400">Manage your money transfers between accounts</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Quick Transfer */}
          <Card className="trade-card shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-white">Quick Transfer</CardTitle>
                <Button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Transfer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quickTransferOptions.map((option: any) => {
                  const Icon = getAccountIcon(option.type);
                  return (
                    <div
                      key={option.id}
                      className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 ${getAccountColor(option.type)} rounded-full flex items-center justify-center`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{option.name}</p>
                          <p className="text-gray-400 text-sm">{option.institution}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-medium">{formatCurrency(option.balance)}</p>
                        <p className="text-gray-400 text-sm">Available</p>
                      </div>
                    </div>
                  );
                })}
                
                {quickTransferOptions.length === 0 && (
                  <div className="text-center py-8">
                    <ArrowRightLeft className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">No accounts connected</p>
                    <p className="text-gray-500 text-sm">Connect accounts to start transferring</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transfer Summary */}
          <Card className="trade-card shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Transfer Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Transferred (30 days)</span>
                  <span className="text-white font-semibold">$12,450.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Pending Transfers</span>
                  <span className="text-yellow-500 font-semibold">
                    {Array.isArray(transfers) ? transfers.filter((t: any) => t.status === 'pending').length : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Completed Today</span>
                  <span className="text-green-500 font-semibold">
                    {Array.isArray(transfers) ? transfers.filter((t: any) => 
                      t.status === 'completed' && 
                      new Date(t.executedAt).toDateString() === new Date().toDateString()
                    ).length : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Available Balance</span>
                  <span className="text-white font-semibold">
                    {formatCurrency(accounts?.reduce((sum: number, acc: any) => sum + parseFloat(acc.balance), 0) || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transfer History */}
        <Card className="trade-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Transfer History</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-800">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="space-y-3 mt-4">
                {Array.isArray(transfers) ? transfers.map((transfer: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(transfer.status)}
                      <div>
                        <p className="text-white font-medium">
                          Account Transfer
                        </p>
                        <p className="text-gray-400 text-sm">
                          {transfer.description || 'Internal transfer'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{formatCurrency(transfer.amount)}</p>
                      <p className={`text-sm ${getStatusColor(transfer.status)}`}>
                        {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {formatDate(transfer.executedAt || transfer.createdAt)}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12">
                    <ArrowRightLeft className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No transfers yet</p>
                    <p className="text-gray-500 text-sm">Start by creating your first transfer</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="pending" className="space-y-3 mt-4">
                {Array.isArray(transfers) ? transfers.filter((transfer: any) => transfer.status === 'pending').map((transfer: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <div>
                        <p className="text-white font-medium">Account Transfer</p>
                        <p className="text-gray-400 text-sm">{transfer.description || 'Internal transfer'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{formatCurrency(transfer.amount)}</p>
                      <p className="text-yellow-500 text-sm">Pending</p>
                      <p className="text-gray-500 text-xs">{formatDate(transfer.createdAt)}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-400 text-center py-8">No pending transfers</p>
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="space-y-3 mt-4">
                {Array.isArray(transfers) ? transfers.filter((transfer: any) => transfer.status === 'completed').map((transfer: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-white font-medium">Account Transfer</p>
                        <p className="text-gray-400 text-sm">{transfer.description || 'Internal transfer'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{formatCurrency(transfer.amount)}</p>
                      <p className="text-green-500 text-sm">Completed</p>
                      <p className="text-gray-500 text-xs">{formatDate(transfer.executedAt)}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-400 text-center py-8">No completed transfers</p>
                )}
              </TabsContent>
              
              <TabsContent value="failed" className="space-y-3 mt-4">
                {Array.isArray(transfers) ? transfers.filter((transfer: any) => transfer.status === 'failed').map((transfer: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-white font-medium">Account Transfer</p>
                        <p className="text-gray-400 text-sm">{transfer.description || 'Internal transfer'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">{formatCurrency(transfer.amount)}</p>
                      <p className="text-red-500 text-sm">Failed</p>
                      <p className="text-gray-500 text-xs">{formatDate(transfer.createdAt)}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-400 text-center py-8">No failed transfers</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <TransferModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          accounts={accounts || []}
        />
      </main>
    </PageTransition>
  );
}
