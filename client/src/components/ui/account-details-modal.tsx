import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AccountDetailsModalProps {
  account: any;
  isOpen: boolean;
  onClose: () => void;
}

interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

interface Transaction {
  id: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL';
  symbol?: string;
  quantity?: number;
  price?: number;
  amount: number;
  date: string;
  description: string;
}

// Mock data for demonstration
const mockHoldings: Holding[] = [
  {
    symbol: 'AAPL',
    quantity: 50,
    avgPrice: 180.25,
    currentPrice: 195.50,
    marketValue: 9775.00,
    unrealizedPL: 762.50,
    unrealizedPLPercent: 8.45
  },
  {
    symbol: 'TSLA',
    quantity: 25,
    avgPrice: 220.80,
    currentPrice: 245.30,
    marketValue: 6132.50,
    unrealizedPL: 612.50,
    unrealizedPLPercent: 11.10
  },
  {
    symbol: 'MSFT',
    quantity: 30,
    avgPrice: 305.20,
    currentPrice: 312.75,
    marketValue: 9382.50,
    unrealizedPL: 226.50,
    unrealizedPLPercent: 2.47
  }
];

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'BUY',
    symbol: 'AAPL',
    quantity: 50,
    price: 180.25,
    amount: -9012.50,
    date: '2024-01-15T10:30:00Z',
    description: 'Bought 50 shares of AAPL at $180.25'
  },
  {
    id: '2',
    type: 'DEPOSIT',
    amount: 10000.00,
    date: '2024-01-10T09:15:00Z',
    description: 'Account funding via bank transfer'
  },
  {
    id: '3',
    type: 'SELL',
    symbol: 'NVDA',
    quantity: 10,
    price: 425.80,
    amount: 4258.00,
    date: '2024-01-08T14:20:00Z',
    description: 'Sold 10 shares of NVDA at $425.80'
  }
];

export default function AccountDetailsModal({ account, isOpen, onClose }: AccountDetailsModalProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'SELL':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'DIVIDEND':
        return <DollarSign className="h-4 w-4 text-blue-500" />;
      default:
        return <PieChart className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-[90%] max-w-4xl h-[85%] bg-[#1e1e1e] rounded-2xl shadow-2xl modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">{account?.accountName}</h2>
              <p className="text-gray-400">{account?.institutionName} • {account?.provider}</p>
            </div>
            <Badge variant="secondary" className="bg-[#8e44ad]/20 text-[#8e44ad] border-[#8e44ad]/30">
              {account?.accountType}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 mx-6 mt-4">
              <TabsTrigger 
                value="overview"
                className="data-[state=active]:bg-[#8e44ad] data-[state=active]:text-white"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="holdings"
                className="data-[state=active]:bg-[#8e44ad] data-[state=active]:text-white"
              >
                Holdings
              </TabsTrigger>
              <TabsTrigger 
                value="transactions"
                className="data-[state=active]:bg-[#8e44ad] data-[state=active]:text-white"
              >
                Transactions
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-6">
              <TabsContent value="overview" className="mt-0 space-y-6">
                {/* Balance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400">Total Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {formatCurrency(parseFloat(account?.balance || '0'))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400">Available Cash</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {formatCurrency(parseFloat(account?.balance || '0') * 0.3)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-400">Buying Power</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {formatCurrency(parseFloat(account?.balance || '0') * 1.5)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Stats */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Account Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Today's Change</span>
                      <span className="text-green-500 font-semibold">+$234.56 (+2.1%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Return</span>
                      <span className="text-green-500 font-semibold">+$1,601.50 (+12.3%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Last Synced</span>
                      <span className="text-gray-300">Just now</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="holdings" className="mt-0">
                <div className="space-y-4">
                  {mockHoldings.map((holding) => (
                    <Card key={holding.symbol} className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div>
                              <h3 className="font-semibold text-white">{holding.symbol}</h3>
                              <p className="text-sm text-gray-400">
                                {holding.quantity} shares @ {formatCurrency(holding.avgPrice)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-white">
                              {formatCurrency(holding.marketValue)}
                            </div>
                            <div className={`text-sm font-medium ${
                              holding.unrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {formatCurrency(holding.unrealizedPL)} ({formatPercent(holding.unrealizedPLPercent)})
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="transactions" className="mt-0">
                <div className="space-y-4">
                  {mockTransactions.map((transaction) => (
                    <Card key={transaction.id} className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {getTransactionIcon(transaction.type)}
                            <div>
                              <h3 className="font-semibold text-white">{transaction.description}</h3>
                              <p className="text-sm text-gray-400">
                                {new Date(transaction.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className={`text-lg font-semibold ${
                            transaction.amount >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}