import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountDetailsModal } from "@/components/ui/account-details-modal";
import { Building2, CreditCard, Plus, Eye } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: 'bank' | 'brokerage' | 'crypto';
  balance: number;
  accountNumber?: string;
  status: 'active' | 'connecting' | 'error';
}

interface EnhancedConnectedAccountsProps {
  accounts: Account[];
  onConnectBank: () => void;
  onConnectBrokerage: () => void;
}

export function EnhancedConnectedAccounts({ accounts, onConnectBank, onConnectBrokerage }: EnhancedConnectedAccountsProps) {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAccountDetails = (account: Account) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  const mockAccounts: Account[] = [
    {
      id: '1',
      name: 'Chase Checking',
      type: 'bank',
      balance: 15420.50,
      accountNumber: '****1234',
      status: 'active'
    },
    {
      id: '2', 
      name: 'Schwab Brokerage',
      type: 'brokerage',
      balance: 45780.25,
      accountNumber: '****5678',
      status: 'active'
    },
    {
      id: '3',
      name: 'Coinbase Wallet',
      type: 'crypto',
      balance: 8920.75,
      accountNumber: '****9012',
      status: 'active'
    }
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Connect Account Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={onConnectBank}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="h-5 w-5 mr-2" />
            + Connect Bank/Credit Card
          </Button>
          <Button
            onClick={onConnectBrokerage}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-12 rounded-xl font-medium
              shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="h-5 w-5 mr-2" />
            + Connect Brokerage/Crypto Wallet
          </Button>
        </div>

        {/* Connected Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockAccounts.map((account) => (
            <Card
              key={account.id}
              className="group relative bg-gray-800/50 border-gray-700 hover:border-purple-500/50 
                rounded-2xl transition-all duration-300 transform hover:scale-[1.03]
                shadow-lg hover:shadow-[0_0_20px_rgba(142,68,173,0.4)]
                min-w-[240px] max-w-[300px]"
              style={{ 
                boxShadow: '0 0 8px rgba(142,68,173,0.4)',
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      {account.type === 'bank' ? (
                        <Building2 className="h-5 w-5 text-white" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{account.name}</h3>
                      <p className="text-xs text-gray-400 capitalize">{account.type}</p>
                    </div>
                  </div>
                  <Badge variant={account.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {account.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Balance</p>
                    <p className="text-lg font-bold text-white">${account.balance.toLocaleString()}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-mono">{account.accountNumber}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAccountDetails(account)}
                      className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-8 px-2"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <AccountDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        account={selectedAccount}
      />
    </>
  );
}