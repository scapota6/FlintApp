import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeftRight, 
  ArrowDown, 
  ArrowUp,
  Filter,
  Calendar
} from 'lucide-react';

interface TransactionHistoryProps {
  transactions: any[];
  isLoading?: boolean;
}

export function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const getTransactionIcon = (action: string) => {
    switch (action) {
      case 'BUY':
      case 'trade_executed':
        return { icon: TrendingUp, color: 'bg-green-500', textColor: 'text-green-400' };
      case 'SELL':
        return { icon: TrendingDown, color: 'bg-red-500', textColor: 'text-red-400' };
      case 'DEPOSIT':
        return { icon: ArrowDown, color: 'bg-green-600', textColor: 'text-green-400' };
      case 'WITHDRAWAL':
        return { icon: ArrowUp, color: 'bg-red-600', textColor: 'text-red-400' };
      case 'TRANSFER':
      case 'transfer_completed':
        return { icon: ArrowLeftRight, color: 'bg-blue-500', textColor: 'text-blue-400' };
      default:
        return { icon: Calendar, color: 'bg-gray-500', textColor: 'text-gray-400' };
    }
  };

  const getTransactionBadge = (action: string) => {
    switch (action) {
      case 'BUY':
        return { text: 'Buy', variant: 'default' as const, class: 'bg-green-900/20 text-green-400 border-green-600' };
      case 'SELL':
        return { text: 'Sell', variant: 'destructive' as const, class: 'bg-red-900/20 text-red-400 border-red-600' };
      case 'DEPOSIT':
        return { text: 'Deposit', variant: 'default' as const, class: 'bg-green-900/20 text-green-400 border-green-600' };
      case 'WITHDRAWAL':
        return { text: 'Withdrawal', variant: 'destructive' as const, class: 'bg-red-900/20 text-red-400 border-red-600' };
      case 'TRANSFER':
      case 'transfer_completed':
        return { text: 'Transfer', variant: 'secondary' as const, class: 'bg-blue-900/20 text-blue-400 border-blue-600' };
      default:
        return { text: action, variant: 'outline' as const, class: 'bg-gray-900/20 text-gray-400 border-gray-600' };
    }
  };

  // Safe array handling - prevent crashes
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  
  // No mock transaction data - real data only

  // Use only real transactions - no mock data
  const displayTransactions = safeTransactions;

  // Filter transactions based on search and type
  const filteredTransactions = displayTransactions.filter((transaction: any) => {
    const matchesSearch = transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || transaction.action.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <Card className="trade-card shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="trade-card shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">
            Transaction History ({filteredTransactions.length})
          </CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="buy">Buy Orders</option>
              <option value="sell">Sell Orders</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="transfer">Transfers</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {filteredTransactions.map((transaction: any, index: number) => {
            const { icon: Icon, color, textColor } = getTransactionIcon(transaction.action);
            const badge = getTransactionBadge(transaction.action);
            const amount = transaction.metadata?.amount || 0;
            const isTradeTransaction = ['BUY', 'SELL', 'trade_executed'].includes(transaction.action);
            
            return (
              <div
                key={transaction.id || index}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-all duration-200 border border-gray-700/50"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <p className="text-white font-semibold text-sm">{transaction.description}</p>
                        <Badge className={badge.class}>
                          {badge.text}
                        </Badge>
                      </div>
                      <span className={`text-lg font-bold ${
                        amount >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(amount))}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <div className="flex items-center space-x-4">
                        {isTradeTransaction && transaction.symbol && (
                          <span className="text-blue-400 font-medium">{transaction.symbol}</span>
                        )}
                        {isTradeTransaction && transaction.quantity && (
                          <span>{transaction.quantity} shares</span>
                        )}
                        {isTradeTransaction && transaction.price && (
                          <span>@ {formatCurrency(transaction.price)}</span>
                        )}
                        {transaction.metadata?.account && (
                          <span className="text-gray-500">via {transaction.metadata.account}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        {transaction.metadata?.fees && (
                          <span className="text-gray-500">Fee: {formatCurrency(transaction.metadata.fees)}</span>
                        )}
                        <span>
                          {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No transactions found</p>
            <p className="text-gray-500 text-sm mt-1">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Connect your accounts to see transaction history'
              }
            </p>
          </div>
        )}
        
        {safeTransactions.length === 0 && filteredTransactions.length > 0 && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
            <p className="text-blue-400 text-sm">
              <Filter className="h-4 w-4 inline mr-2" />
              Showing demo transaction history. Connect your brokerage account to see real trades.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}