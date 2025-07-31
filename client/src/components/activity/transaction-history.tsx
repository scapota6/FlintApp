import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Building,
  Wallet,
  Calendar,
  Filter
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  accountId: string;
  accountName: string;
  accountType: 'bank' | 'brokerage';
  provider: string;
  date: string;
  type: string;
  description: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  amount: number;
  fee?: number;
  currency: string;
  status: string;
  category?: string;
  merchant?: string;
}

export default function TransactionHistory() {
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterAccount !== 'all') queryParams.append('accountId', filterAccount);
  if (filterType !== 'all') queryParams.append('type', filterType);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/transactions', queryParams.toString()],
    queryFn: async () => {
      const url = queryParams.toString() 
        ? `/api/transactions?${queryParams.toString()}`
        : '/api/transactions';
      const response = await apiRequest('GET', url);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const transactions: Transaction[] = data?.transactions || [];
  const uniqueAccounts = Array.from(new Set(transactions.map(t => `${t.accountId}:${t.accountName}`)));

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = format(new Date(transaction.date), 'MMMM d, yyyy');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 bg-gray-800" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">Failed to load transactions. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.accountType === 'bank') {
      return transaction.amount > 0 ? <ArrowDownRight className="h-4 w-4 text-green-400" /> : <ArrowUpRight className="h-4 w-4 text-red-400" />;
    } else {
      const isBuy = transaction.type?.toLowerCase().includes('buy') || transaction.amount < 0;
      return isBuy ? <TrendingDown className="h-4 w-4 text-red-400" /> : <TrendingUp className="h-4 w-4 text-green-400" />;
    }
  };

  const getTransactionColor = (transaction: Transaction) => {
    if (transaction.accountType === 'bank') {
      return transaction.amount > 0 ? 'text-green-400' : 'text-red-400';
    } else {
      const isBuy = transaction.type?.toLowerCase().includes('buy') || transaction.amount < 0;
      return isBuy ? 'text-red-400' : 'text-green-400';
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <Badge variant="secondary" className="bg-purple-600/20 text-purple-400">
            {transactions.length} Transactions
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label className="text-xs text-gray-400">Account</Label>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Accounts</SelectItem>
                {uniqueAccounts.map((account) => {
                  const [id, name] = account.split(':');
                  return (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-400">Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bank">Bank Transactions</SelectItem>
                <SelectItem value="trade">Trades</SelectItem>
                <SelectItem value="dividend">Dividends</SelectItem>
                <SelectItem value="fee">Fees</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-400">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div>
            <Label className="text-xs text-gray-400">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>
        </div>

        {/* Transactions List */}
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No transactions found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or connect an account</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-gray-400 mb-3">{date}</h3>
                <div className="space-y-2">
                  {dayTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getTransactionIcon(transaction)}
                          </div>
                          <div>
                            <div className="font-medium">
                              {transaction.description}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {transaction.accountType === 'bank' ? (
                                  <Building className="h-3 w-3 mr-1" />
                                ) : (
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                )}
                                {transaction.accountName}
                              </Badge>
                              {transaction.symbol && (
                                <Badge variant="secondary" className="text-xs">
                                  {transaction.symbol}
                                </Badge>
                              )}
                              {transaction.quantity && (
                                <span className="text-xs text-gray-400">
                                  {transaction.quantity} shares @ ${transaction.price?.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {transaction.merchant && (
                              <p className="text-sm text-gray-400 mt-1">{transaction.merchant}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${getTransactionColor(transaction)}`}>
                            {transaction.accountType === 'bank' ? (
                              <>
                                {transaction.amount > 0 ? '+' : ''}
                                ${Math.abs(transaction.amount).toFixed(2)}
                              </>
                            ) : (
                              `$${Math.abs(transaction.amount).toFixed(2)}`
                            )}
                          </p>
                          {transaction.fee && (
                            <p className="text-xs text-gray-400">Fee: ${transaction.fee.toFixed(2)}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(transaction.date), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}