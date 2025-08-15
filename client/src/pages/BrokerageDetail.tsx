import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Holding {
  symbol: string;
  qty: number;
  avgPrice: number;
  marketPrice: number;
  value: number;
  dayPnl: number;
  totalPnl: number;
}

interface Transaction {
  id: string;
  type: string;
  symbol?: string;
  qty?: number;
  price?: number;
  amount: number;
  date: string;
}

export default function BrokerageDetail() {
  const { id } = useParams();
  const [refreshing, setRefreshing] = useState(false);
  const [sortField, setSortField] = useState<string>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch account details
  const { data: accountData, isLoading: accountLoading, refetch: refetchAccount } = useQuery({
    queryKey: [`/api/brokerages`],
    retry: false
  });

  // Fetch holdings
  const { data: holdingsData, isLoading: holdingsLoading, refetch: refetchHoldings } = useQuery({
    queryKey: [`/api/brokerages/${id}/holdings`],
    retry: false
  });

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: [`/api/brokerages/${id}/transactions`],
    retry: false
  });

  const account = accountData?.accounts?.find((acc: any) => acc.id === parseInt(id!));
  const holdings: Holding[] = holdingsData?.holdings || [];
  const transactions: Transaction[] = transactionsData?.transactions || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAccount(), refetchHoldings(), refetchTransactions()]);
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

  const formatPercent = (value: number) => {
    const formatted = Math.abs(value).toFixed(2);
    if (value > 0) return `+${formatted}%`;
    if (value < 0) return `-${formatted}%`;
    return `${formatted}%`;
  };

  const sortHoldings = (data: Holding[]) => {
    return [...data].sort((a, b) => {
      let aValue = a[sortField as keyof Holding];
      let bValue = b[sortField as keyof Holding];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return sortOrder === 'asc' 
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
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

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.totalPnl, 0);

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
          <h1 className="text-3xl font-bold">{account.name}</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalPnl, true)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Buying Power</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(account.buyingPower)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              {holdingsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : holdings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No holdings found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('symbol')}
                        >
                          Symbol
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('qty')}
                        >
                          Quantity
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('avgPrice')}
                        >
                          Avg Price
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('marketPrice')}
                        >
                          Market Price
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('value')}
                        >
                          Value
                        </TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('totalPnl')}
                        >
                          Total P&L
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortHoldings(holdings).map((holding, index) => (
                        <TableRow key={`${holding.symbol}-${index}`}>
                          <TableCell className="font-medium">{holding.symbol}</TableCell>
                          <TableCell className="text-right">{holding.qty}</TableCell>
                          <TableCell className="text-right">
                            {holding.avgPrice ? formatCurrency(holding.avgPrice) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.marketPrice)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(holding.value)}</TableCell>
                          <TableCell className="text-right">
                            <span className={holding.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(holding.totalPnl, true)}
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

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Order history coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
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
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'buy' ? 'default' : 'secondary'}>
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.symbol || '-'}</TableCell>
                          <TableCell className="text-right">
                            {transaction.qty ? transaction.qty.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.price ? formatCurrency(transaction.price) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(transaction.amount)}
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