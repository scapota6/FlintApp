import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { 
  X, 
  CreditCard, 
  Activity, 
  Unlink, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign,
  Building,
  Calendar,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface BankAccountModalProps {
  account: any;
  isOpen: boolean;
  onClose: () => void;
}

export function BankAccountModal({ account, isOpen, onClose }: BankAccountModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Fetch account transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['/api/banking/transactions', account?.id],
    enabled: !!account?.id && isOpen,
    retry: false
  });

  // Disconnect account mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/banking/accounts/${account.id}/disconnect`);
      if (!response.ok) throw new Error('Failed to disconnect account');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account Disconnected",
        description: `${account.name} has been successfully disconnected.`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banking/accounts'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Disconnection Failed",
        description: error.message || "Unable to disconnect account. Please try again.",
        variant: "destructive",
      });
    }
  });

  if (!account) return null;

  const handleDisconnect = () => {
    setIsDisconnecting(true);
    disconnectMutation.mutate();
  };

  // Mock transactions for demo (in real app, these would come from Teller/SnapTrade)
  const mockTransactions = [
    {
      id: '1',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
      description: 'ACH Transfer to Investment Account',
      amount: -2500.00,
      type: 'transfer',
      status: 'completed'
    },
    {
      id: '2',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      description: 'Salary Deposit - Employer',
      amount: 5200.00,
      type: 'deposit',
      status: 'completed'
    },
    {
      id: '3',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
      description: 'ATM Withdrawal',
      amount: -200.00,
      type: 'withdrawal',
      status: 'completed'
    },
    {
      id: '4',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
      description: 'Online Purchase - Amazon',
      amount: -89.99,
      type: 'purchase',
      status: 'completed'
    },
    {
      id: '5',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
      description: 'Dividend Payment - AAPL',
      amount: 125.50,
      type: 'dividend',
      status: 'completed'
    }
  ];

  const displayTransactions = transactions.length > 0 ? transactions : mockTransactions;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'transfer':
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4 text-red-400" />;
      case 'deposit':
      case 'dividend':
        return <ArrowDownRight className="h-4 w-4 text-green-400" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTransactionColor = (amount: number) => {
    return amount >= 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-700 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-600/30">
                <Building className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">
                  {account.name || account.official_name || 'Bank Account'}
                </DialogTitle>
                <p className="text-sm text-gray-400">
                  {account.type || 'Checking'} • {account.mask ? `****${account.mask}` : account.account_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-red-600 text-red-400 hover:bg-red-600/10">
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-900 border-gray-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      Disconnect Bank Account
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      Are you sure you want to disconnect "{account.name}"? This will remove access to your account balance and transaction history. You can reconnect later if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isDisconnecting ? 'Disconnecting...' : 'Disconnect Account'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Account Balance */}
          <div className="flex items-center gap-6 mt-4">
            <div>
              <p className="text-sm text-gray-400">Available Balance</p>
              <p className="text-3xl font-bold text-white">
                ${(account.balance || account.current_balance || 45230.50).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Account Status</p>
              <Badge variant="outline" className="text-green-400 border-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-400">Last Updated</p>
              <p className="text-sm text-white">
                {formatDistanceToNow(new Date(), { addSuffix: true })}
              </p>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="transactions" className="mt-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
            <TabsTrigger value="details">Account Details</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-400" />
                  Recent Transactions
                  <Badge variant="outline" className="ml-auto">{displayTransactions.length} transactions</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/30 animate-pulse">
                        <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-600 rounded w-1/2"></div>
                        </div>
                        <div className="h-4 bg-gray-600 rounded w-20"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayTransactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors">
                        <div className="p-2 rounded-full bg-gray-600/50">
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">{transaction.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {transaction.date.toLocaleDateString()}
                            <Badge variant="outline" className="text-xs py-0 px-1">
                              {transaction.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${getTransactionColor(transaction.amount)}`}>
                            {transaction.amount >= 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400">{transaction.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {displayTransactions.length === 0 && !transactionsLoading && (
                  <div className="text-center py-8 text-gray-400">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent transactions.</p>
                    <p className="text-sm">Transaction history will appear here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Account Name</p>
                    <p className="text-white font-medium">{account.name || 'Primary Checking'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Account Type</p>
                    <p className="text-white font-medium">{account.type || 'Checking'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Institution</p>
                    <p className="text-white font-medium">{account.institution?.name || 'Chase Bank'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Routing Number</p>
                    <p className="text-white font-medium">{account.routing_number || '****9876'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Connected Via</p>
                    <p className="text-white font-medium">Teller Banking API</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Connection Status</p>
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30">
                  <div>
                    <p className="text-white font-medium">Auto-sync Transactions</p>
                    <p className="text-sm text-gray-400">Automatically fetch new transactions every hour</p>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">Enabled</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30">
                  <div>
                    <p className="text-white font-medium">Balance Notifications</p>
                    <p className="text-sm text-gray-400">Get notified of low balance or large transactions</p>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">Enabled</Badge>
                </div>

                <div className="border-t border-gray-600 pt-4">
                  <h4 className="text-white font-medium mb-3">Danger Zone</h4>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full border-red-600 text-red-400 hover:bg-red-600/10">
                        <Unlink className="h-4 w-4 mr-2" />
                        Disconnect This Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-gray-900 border-gray-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-400" />
                          Confirm Account Disconnection
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400">
                          This action will permanently disconnect "{account.name}" from your Flint account. All transaction history and balance information will be removed. You can reconnect this account later if needed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDisconnect}
                          disabled={isDisconnecting}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect Account'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}