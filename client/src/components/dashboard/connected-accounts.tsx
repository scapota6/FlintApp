import { useState } from 'react';
import { ExternalLink, Plus, Building2, TrendingUp, Loader2, Landmark, CreditCard, Eye, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import DisconnectButton from '@/components/ui/disconnect-button';
import { AccountDetailsModal } from '@/components/ui/account-details-modal';
import SkeletonCard from '@/components/ui/skeleton-card';
import ErrorCard from '@/components/ui/error-card';
import { QuickActionsBar } from '@/components/ui/quick-actions-bar';
import { useQueryClient } from '@tanstack/react-query';

interface Account {
  id: string;
  provider: string;
  accountName: string;
  balance: string;
  lastUpdated: string;
  institutionName?: string;
  accountType?: string;
  needsReconnection?: boolean;
}

interface ConnectedAccountsProps {
  accounts: Account[];
  onConnectBank: () => void;
  onConnectBrokerage: () => void;
}

export default function ConnectedAccounts({ 
  accounts = [], 
  onConnectBank, 
  onConnectBrokerage 
}: ConnectedAccountsProps) {
  const [loadingConnect, setLoadingConnect] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleConnectBank = async () => {
    setLoadingConnect('bank');
    try {
      await onConnectBank();
    } finally {
      setLoadingConnect(null);
    }
  };

  const handleConnectBrokerage = async () => {
    setLoadingConnect('brokerage');
    try {
      await onConnectBrokerage();
    } finally {
      setLoadingConnect(null);
    }
  };

  const handleAccountDisconnected = () => {
    // Refresh dashboard data after account disconnection
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
  };

  const handleAccountDetails = (account: Account) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  const handleRetryLoad = () => {
    setError(null);
    setIsLoading(true);
    // Simulate retry logic
    setTimeout(() => {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    }, 1000);
  };

  const handleQuickBuy = () => {
    // Navigate to trading page with buy preset
    window.location.href = '/trading?action=buy';
  };

  const handleQuickSell = () => {
    // Navigate to trading page with sell preset
    window.location.href = '/trading?action=sell';
  };

  const handleTransferFunds = () => {
    // Navigate to transfers page
    window.location.href = '/transfers';
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'teller':
        return <Building2 className="h-5 w-5 text-blue-400" />;
      case 'snaptrade':
        return <TrendingUp className="h-5 w-5 text-purple-400" />;
      default:
        return <Building2 className="h-5 w-5 text-gray-400" />;
    }
  };

  const getProviderBadge = (provider: string, needsReconnection?: boolean) => {
    if (needsReconnection) {
      return <Badge variant="outline" className="border-red-400 text-red-400">Disconnected</Badge>;
    }
    switch (provider.toLowerCase()) {
      case 'teller':
        return <Badge variant="outline" className="border-blue-400 text-blue-400">Bank</Badge>;
      case 'snaptrade':
        return <Badge variant="outline" className="border-purple-400 text-purple-400">Brokerage</Badge>;
      default:
        return <Badge variant="outline">{provider}</Badge>;
    }
  };

  return (
    <Card className="flint-card">
      <CardHeader>
        <CardTitle className="text-xl text-white font-mono">Connected Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enhanced Connection Buttons with Tooltips */}
        <div className="flex gap-4 mb-6">
          <Tooltip content="Connect your bank account via Teller" position="top">
            <Button 
              onClick={handleConnectBank}
              disabled={loadingConnect === 'bank'}
              className="btn-standard flex-1 bg-blue-600 hover:bg-blue-700 text-white btn-glow-hover focus-visible:outline-blue-400"
            >
              {loadingConnect === 'bank' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Connect Bank/Credit Card
            </Button>
          </Tooltip>
          
          <Tooltip content="Connect your brokerage account via SnapTrade" position="top">
            <Button 
              onClick={handleConnectBrokerage}
              disabled={loadingConnect === 'brokerage'}
              className="btn-standard flex-1 bg-purple-600 hover:bg-purple-700 text-white btn-glow-hover focus-visible:outline-purple-400"
            >
              {loadingConnect === 'brokerage' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Connect Brokerage/Crypto Wallet
            </Button>
          </Tooltip>
        </div>

        {/* Enhanced Account Grid */}
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {accounts.map((account) => (
              <div 
                key={account.id}
                className={`account-card ${account.provider.toLowerCase()} relative purple-glow-border card-hover-lift`}
                style={{ borderRadius: '16px', minWidth: '240px' }}
              >
                {/* Disconnect Button */}
                <div className="absolute top-3 right-3">
                  <DisconnectButton
                    accountId={account.id}
                    provider={account.provider}
                    accountName={account.accountName}
                    onDisconnected={handleAccountDisconnected}
                  />
                </div>

                <div className="flex items-center justify-between pr-12">
                  <div className="flex items-center gap-3">
                    {getProviderIcon(account.provider)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {account.accountName === 'Default' && account.institutionName === 'Coinbase' 
                            ? 'Coinbase' 
                            : account.accountName}
                        </h3>
                        {getProviderBadge(account.provider, account.needsReconnection)}
                      </div>
                      <p className="text-sm text-gray-400">
                        {account.institutionName || account.provider}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">
                      ${parseFloat(account.balance).toLocaleString()}
                    </div>
                    {account.needsReconnection ? (
                      <Tooltip content="Reconnect account" position="top">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-400 hover:text-red-300 border-red-400 hover:border-red-300 interactive-glow focus-visible:outline-red-400"
                          onClick={handleConnectBrokerage}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resync
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip content="View details" position="top">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-purple-400 hover:text-purple-300 interactive-glow focus-visible:outline-purple-400"
                          onClick={() => handleAccountDetails(account)}
                        >
                          Details <Eye className="h-3 w-3 ml-1" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No accounts connected yet.</p>
            <p className="text-sm">Connect your bank and brokerage to get started.</p>
          </div>
        )}
      </CardContent>

      {/* Account Details Modal */}
      <AccountDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        account={selectedAccount}
      />
    </Card>
  );
}