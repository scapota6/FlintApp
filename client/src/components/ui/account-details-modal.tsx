import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockIcon } from '@/components/ui/stock-icon';
import { BankAccountModal } from '@/components/banking/bank-account-modal';
import { Building2, CreditCard, DollarSign, TrendingUp, TrendingDown, Activity, Building } from 'lucide-react';

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: {
    id: string;
    name: string;
    type: string;
    balance: number;
    accountNumber?: string;
    status: string;
  } | null;
}

// Check if account is a bank account
const isBankAccount = (account: any) => {
  return account && (
    account.institution || 
    account.type === 'checking' || 
    account.type === 'savings' ||
    account.provider === 'teller' ||
    account.source === 'bank' ||
    account.type === 'bank'
  );
};

export function AccountDetailsModal({ isOpen, onClose, account }: AccountDetailsModalProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!account) return null;

  // If it's a bank account, use the specialized bank account modal
  if (isBankAccount(account)) {
    return (
      <BankAccountModal
        account={account}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  const mockHoldings = [
    { symbol: 'AAPL', name: 'Apple Inc.', shares: 25, avgPrice: 180.50, currentPrice: 189.45, value: 4736.25 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 10, avgPrice: 140.20, currentPrice: 142.18, value: 1421.80 },
    { symbol: 'TSLA', name: 'Tesla Inc.', shares: 8, avgPrice: 220.75, currentPrice: 238.77, value: 1910.16 },
  ];

  const mockTransactions = [
    { id: '1', date: '2025-01-25', type: 'BUY', symbol: 'AAPL', shares: 5, price: 185.20, amount: -926.00 },
    { id: '2', date: '2025-01-24', type: 'SELL', symbol: 'TSLA', shares: 2, price: 240.50, amount: 481.00 },
    { id: '3', date: '2025-01-23', type: 'BUY', symbol: 'GOOGL', shares: 3, price: 141.75, amount: -425.25 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[80vw] h-[80vh] bg-gray-900 border-gray-700 text-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              {account.type === 'bank' ? <Building2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            </div>
            {account.name}
            <Badge variant={account.status === 'active' ? 'default' : 'secondary'} className="ml-auto">
              {account.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white relative"
            >
              Overview
              {activeTab === 'overview' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="holdings" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white relative"
            >
              Holdings
              {activeTab === 'holdings' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="transactions" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white relative"
            >
              Transactions
              {activeTab === 'transactions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-400">Account Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">${account.balance.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-400">Account Number</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-mono text-white">
                      ****{account.accountNumber?.slice(-4) || '1234'}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-400">Account Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg text-white capitalize">{account.type}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="holdings" className="mt-4">
              <div className="space-y-3">
                {mockHoldings.map((holding) => {
                  const gainLoss = (holding.currentPrice - holding.avgPrice) * holding.shares;
                  const gainLossPercent = ((holding.currentPrice - holding.avgPrice) / holding.avgPrice) * 100;
                  const isPositive = gainLoss >= 0;

                  return (
                    <Card key={holding.symbol} className="bg-gray-800 border-gray-700 hover:border-purple-500/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <StockIcon symbol={holding.symbol} size={32} />
                            <div>
                              <div className="font-semibold text-white">{holding.symbol}</div>
                              <div className="text-sm text-gray-400">{holding.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">${holding.value.toLocaleString()}</div>
                            <div className={`text-sm flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              ${Math.abs(gainLoss).toFixed(2)} ({gainLossPercent.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="mt-4">
              <div className="space-y-3">
                {mockTransactions.map((transaction) => (
                  <Card key={transaction.id} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            transaction.type === 'BUY' ? 'bg-green-600' : 'bg-red-600'
                          }`}>
                            <Activity className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {transaction.type} {transaction.shares} {transaction.symbol}
                            </div>
                            <div className="text-sm text-gray-400">
                              {transaction.date} • ${transaction.price}
                            </div>
                          </div>
                        </div>
                        <div className={`font-semibold ${transaction.amount >= 0 ? 'text-green-400' : 'text-white'}`}>
                          ${Math.abs(transaction.amount).toLocaleString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}