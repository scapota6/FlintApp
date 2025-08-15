import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle,
  CreditCard,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
}

export default function BankDetail() {
  const { id } = useParams();
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch account details
  const { data: accountData, isLoading: accountLoading, refetch: refetchAccount } = useQuery({
    queryKey: [`/api/banks`],
    retry: false
  });

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: [`/api/banks/${id}/transactions`],
    retry: false
  });

  const account = accountData?.accounts?.find((acc: any) => acc.id === parseInt(id!));
  const transactions: Transaction[] = transactionsData?.transactions || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAccount(), refetchTransactions()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, showSign: boolean = false) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
    
    if (showSign && amount !== 0) {
      return amount > 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'checking':
        return <DollarSign className="h-5 w-5" />;
      case 'savings':
        return <TrendingUp className="h-5 w-5" />;
      case 'card':
        return <CreditCard className="h-5 w-5" />;
      default:
        return <DollarSign className="h-5 w-5" />;
    }
  };

  const sortTransactions = (data: Transaction[]) => {
    return [...data].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'amount') {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      return 0;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
  const netFlow = totalIncome - totalExpenses;

  if (accountLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-10 w-64 mb-6" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Account Not Found</h3>
            <Link href="/accounts">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Accounts
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/accounts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {getAccountTypeIcon(account.type)}
            <div>
              <h1 className="text-3xl font-bold">{account.name}</h1>
              <Badge variant="secondary" className="mt-1">
                {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(account.balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-1">
                Income <ArrowUpRight className="h-4 w-4 text-green-600" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-1">
                Expenses <ArrowDownRight className="h-4 w-4 text-red-600" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netFlow, true)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Account Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                    <p className="text-3xl font-bold">{formatCurrency(account.balance)}</p>
                  </div>
                  {getAccountTypeIcon(account.type)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Account Type</p>
                    <p className="font-medium">{account.type.charAt(0).toUpperCase() + account.type.slice(1)}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Currency</p>
                    <p className="font-medium">{account.currency}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No transactions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('date')}
                        >
                          Date
                        </TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('amount')}
                        >
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortTransactions(transactions).map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="font-medium">{transaction.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{transaction.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(transaction.amount, true)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}