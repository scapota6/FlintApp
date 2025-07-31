import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockIcon } from '@/components/ui/stock-icon';
import { BankAccountModal } from '@/components/banking/bank-account-modal';
import { BrokerageAccountModal } from '@/components/brokerage/brokerage-account-modal';
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

// Check if account is a brokerage account
const isBrokerageAccount = (account: any) => {
  return account && (
    account.provider === 'snaptrade' ||
    account.type === 'brokerage' ||
    account.type === 'investment' ||
    account.institution_name ||
    (account.provider && account.provider !== 'teller')
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

  // If it's a brokerage account, use the specialized brokerage account modal
  if (isBrokerageAccount(account)) {
    return (
      <BrokerageAccountModal
        account={account}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  // No mock data - real holdings and transactions only

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
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="text-center text-gray-400">
                      No holdings data available. Connect your brokerage account to view holdings.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="mt-4">
              <div className="space-y-3">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="text-center text-gray-400">
                      No transaction data available. Real transaction history will appear here when connected.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}