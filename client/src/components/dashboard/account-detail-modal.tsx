import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  PieChart,
  Clock,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface AccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: {
    id: string;
    provider: 'teller' | 'snaptrade';
    accountName: string;
    balance: number;
    type: 'bank' | 'investment' | 'crypto';
    institution: string;
  };
}

interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  change: number;
  changePct: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit' | 'buy' | 'sell' | 'dividend';
  status: string;
  symbol?: string;
  quantity?: number;
  price?: number;
}

export default function AccountDetailModal({ isOpen, onClose, account }: AccountDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch account details based on provider
  const { data: accountDetails, isLoading: detailsLoading } = useQuery({
    queryKey: [`/api/accounts/${account.provider}/${account.id}/details`],
    enabled: isOpen,
  });

  // Fetch holdings for investment accounts
  const { data: holdings, isLoading: holdingsLoading } = useQuery<Holding[]>({
    queryKey: [`/api/accounts/${account.provider}/${account.id}/holdings`],
    enabled: isOpen && account.type === 'investment',
  });

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: [`/api/accounts/${account.provider}/${account.id}/transactions`],
    enabled: isOpen,
  });

  const handleRefresh = async () => {
    // Trigger account sync
    await apiRequest('POST', `/api/accounts/${account.provider}/${account.id}/sync`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{account.accountName}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Building2 className="h-4 w-4" />
                {account.institution}
                <Badge variant="outline" className="ml-2">
                  {account.provider.toUpperCase()}
                </Badge>
              </DialogDescription>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Sync
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {account.type === 'investment' && (
              <TabsTrigger value="holdings">Holdings</TabsTrigger>
            )}
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Account Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatCurrency(account.balance)}</p>
                </CardContent>
              </Card>

              {account.type === 'investment' && accountDetails && (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Buying Power</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(accountDetails.buyingPower || 0)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Positions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{holdings?.length || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Today's Change</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${accountDetails.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(accountDetails.dayChange || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent>
                {detailsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Type</span>
                      <span className="capitalize">{account.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Number</span>
                      <span>****{accountDetails?.accountNumber?.slice(-4) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline" className="text-green-400">Active</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Synced</span>
                      <span>{new Date().toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Holdings Tab (Investment accounts only) */}
          {account.type === 'investment' && (
            <TabsContent value="holdings" className="space-y-4">
              {holdingsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : holdings && holdings.length > 0 ? (
                <div className="space-y-3">
                  {holdings.map((holding) => (
                    <Card key={holding.symbol} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{holding.symbol}</h4>
                              <Badge variant="outline" className="text-xs">
                                {holding.quantity} shares
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{holding.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(holding.value)}</p>
                            <p className={`text-sm ${holding.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {holding.change >= 0 ? '+' : ''}{formatCurrency(holding.change)} ({holding.changePct.toFixed(2)}%)
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <PieChart className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No holdings found</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            transaction.type === 'credit' || transaction.type === 'sell' 
                              ? 'bg-green-500/20' 
                              : 'bg-red-500/20'
                          }`}>
                            {transaction.type === 'credit' || transaction.type === 'sell' ? (
                              <ArrowDownLeft className="h-4 w-4 text-green-400" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(transaction.date).toLocaleDateString()}
                              {transaction.symbol && (
                                <>
                                  <span>•</span>
                                  <span>{transaction.symbol}</span>
                                  {transaction.quantity && (
                                    <span>({transaction.quantity} shares)</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            transaction.type === 'credit' || transaction.type === 'sell'
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}>
                            {transaction.type === 'credit' || transaction.type === 'sell' ? '+' : '-'}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </p>
                          {transaction.price && (
                            <p className="text-sm text-muted-foreground">
                              @ {formatCurrency(transaction.price)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No transactions found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}