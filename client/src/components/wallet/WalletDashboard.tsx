import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  Unlock,
  DollarSign,
  TrendingUp,
  Clock,
  Shield,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface WalletBalance {
  availableBalance: number;
  holdBalance: number;
  totalBalance: number;
  currency: string;
}

interface AggregatedPosition {
  symbol: string;
  totalQuantity: number;
  averagePrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercentage: number;
  brokerageBreakdown: Array<{
    brokerageId: string;
    quantity: number;
    averagePrice: number;
  }>;
}

export default function WalletDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [holdAmount, setHoldAmount] = useState('');
  const [allocateAmount, setAllocateAmount] = useState('');
  const [selectedBrokerage, setSelectedBrokerage] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');

  // Fetch wallet balance
  const { data: walletBalance, isLoading: balanceLoading } = useQuery<WalletBalance>({
    queryKey: ['/api/wallet/balance'],
    queryFn: () => apiRequest('/api/wallet/balance'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch aggregated positions
  const { data: positionsData, isLoading: positionsLoading } = useQuery<{ positions: AggregatedPosition[] }>({
    queryKey: ['/api/trading/positions'],
    queryFn: () => apiRequest('/api/trading/positions'),
    refetchInterval: 30000,
  });

  // Fetch connected accounts for transfer
  const { data: dashboardData } = useQuery({
    queryKey: ['/api/dashboard'],
    queryFn: () => apiRequest('/api/dashboard'),
  });

  // Hold funds mutation
  const holdFundsMutation = useMutation({
    mutationFn: (data: { amount: number; purpose: string }) =>
      apiRequest('/api/wallet/hold', { method: 'POST', body: data }),
    onSuccess: () => {
      toast({
        title: 'Funds Held Successfully',
        description: `$${holdAmount} has been held for trading`,
      });
      setHoldAmount('');
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Hold Failed',
        description: error.message || 'Failed to hold funds',
        variant: 'destructive',
      });
    },
  });

  // Allocate funds mutation
  const allocateFundsMutation = useMutation({
    mutationFn: (data: { amount: number; brokerageId: string; purpose: string }) =>
      apiRequest('/api/wallet/allocate', { method: 'POST', body: data }),
    onSuccess: () => {
      toast({
        title: 'Funds Allocated Successfully',
        description: `$${allocateAmount} allocated to ${selectedBrokerage} for trading`,
      });
      setAllocateAmount('');
      setSelectedBrokerage('');
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Allocation Failed',
        description: error.message || 'Failed to allocate funds',
        variant: 'destructive',
      });
    },
  });

  // ACH transfer mutation
  const achTransferMutation = useMutation({
    mutationFn: (data: { fromAccountId: string; toAccountId: string; amount: number }) =>
      apiRequest('/api/transfers/ach', { method: 'POST', body: data }),
    onSuccess: () => {
      toast({
        title: 'ACH Transfer Initiated',
        description: `$${transferAmount} transfer initiated. Processing time: 1-3 business days`,
      });
      setTransferAmount('');
      setFromAccount('');
      setToAccount('');
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Transfer Failed',
        description: error.message || 'Failed to initiate transfer',
        variant: 'destructive',
      });
    },
  });

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatPercent = (percent: number) => 
    `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;

  const connectedAccounts = dashboardData?.accounts || [];
  const brokerageOptions = ['robinhood', 'fidelity', 'webull', 'alpaca', 'schwab'];

  return (
    <div className="space-y-6">
      {/* Wallet Balance Overview */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Wallet Balance</CardTitle>
          <Wallet className="h-6 w-6" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-blue-100 text-sm">Available</p>
              <p className="text-2xl font-bold">
                {balanceLoading ? '...' : formatCurrency(walletBalance?.availableBalance || 0)}
              </p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">On Hold</p>
              <p className="text-2xl font-bold">
                {balanceLoading ? '...' : formatCurrency(walletBalance?.holdBalance || 0)}
              </p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">Total Balance</p>
              <p className="text-2xl font-bold">
                {balanceLoading ? '...' : formatCurrency(walletBalance?.totalBalance || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Operations */}
      <Tabs defaultValue="operations" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hold Funds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-5 w-5" />
                  <span>Hold Funds</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="number"
                  placeholder="Amount to hold"
                  value={holdAmount}
                  onChange={(e) => setHoldAmount(e.target.value)}
                />
                <Button
                  onClick={() => holdFundsMutation.mutate({ 
                    amount: parseFloat(holdAmount), 
                    purpose: 'trading' 
                  })}
                  disabled={!holdAmount || holdFundsMutation.isPending}
                  className="w-full"
                >
                  {holdFundsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Hold Funds
                </Button>
              </CardContent>
            </Card>

            {/* Allocate to Brokerage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Allocate to Brokerage</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="number"
                  placeholder="Amount to allocate"
                  value={allocateAmount}
                  onChange={(e) => setAllocateAmount(e.target.value)}
                />
                <Select value={selectedBrokerage} onValueChange={setSelectedBrokerage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select brokerage" />
                  </SelectTrigger>
                  <SelectContent>
                    {brokerageOptions.map((brokerage) => (
                      <SelectItem key={brokerage} value={brokerage}>
                        {brokerage.charAt(0).toUpperCase() + brokerage.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => allocateFundsMutation.mutate({ 
                    amount: parseFloat(allocateAmount), 
                    brokerageId: selectedBrokerage,
                    purpose: 'trading' 
                  })}
                  disabled={!allocateAmount || !selectedBrokerage || allocateFundsMutation.isPending}
                  className="w-full"
                >
                  {allocateFundsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                  )}
                  Allocate Funds
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          {positionsLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading positions...
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {positionsData?.positions?.map((position) => (
                <Card key={position.symbol}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{position.symbol}</span>
                      <Badge variant={position.gainLoss >= 0 ? "default" : "destructive"}>
                        {formatPercent(position.gainLossPercentage)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Quantity</p>
                        <p className="font-semibold">{position.totalQuantity.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Avg Price</p>
                        <p className="font-semibold">{formatCurrency(position.averagePrice)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Current Value</p>
                        <p className="font-semibold">{formatCurrency(position.currentValue)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Gain/Loss</p>
                        <p className={`font-semibold ${position.gainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(position.gainLoss)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Brokerage Breakdown */}
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-2">Brokerage Breakdown:</p>
                      <div className="space-y-1">
                        {position.brokerageBreakdown.map((breakdown, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{breakdown.brokerageId}</span>
                            <span>{breakdown.quantity.toFixed(4)} @ {formatCurrency(breakdown.averagePrice)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) || (
                <Card>
                  <CardContent className="p-6 text-center text-gray-500">
                    No positions found. Start trading to see your portfolio here.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ArrowDownLeft className="h-5 w-5" />
                <span>ACH Transfer</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">From Account</label>
                  <Select value={fromAccount} onValueChange={setFromAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source account" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedAccounts.map((account: any) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.institutionName} - {account.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">To Account</label>
                  <Select value={toAccount} onValueChange={setToAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination account" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedAccounts.map((account: any) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.institutionName} - {account.accountName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input
                type="number"
                placeholder="Transfer amount"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
              <Button
                onClick={() => achTransferMutation.mutate({ 
                  fromAccountId: fromAccount,
                  toAccountId: toAccount,
                  amount: parseFloat(transferAmount)
                })}
                disabled={!fromAccount || !toAccount || !transferAmount || achTransferMutation.isPending}
                className="w-full"
              >
                {achTransferMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 mr-2" />
                )}
                Initiate ACH Transfer (1-3 days)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Security Notice */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
            <Shield className="h-5 w-5" />
            <div>
              <p className="font-medium">Secure Fund Management</p>
              <p className="text-sm">
                All funds are held securely with bank-grade encryption. We never act as a broker - 
                all trades are executed through your connected brokerage accounts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}