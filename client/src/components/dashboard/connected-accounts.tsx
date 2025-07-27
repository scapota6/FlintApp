import { useState } from 'react';
import { ExternalLink, Plus, Building2, TrendingUp, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Account {
  id: string;
  provider: string;
  accountName: string;
  balance: string;
  lastUpdated: string;
  institutionName?: string;
  accountType?: string;
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

  const getProviderBadge = (provider: string) => {
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
        {/* Connection Buttons */}
        <div className="flex gap-4 mb-6">
          <Button 
            onClick={handleConnectBank}
            disabled={loadingConnect === 'bank'}
            className="flint-btn flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loadingConnect === 'bank' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Connect Bank
          </Button>
          <Button 
            onClick={handleConnectBrokerage}
            disabled={loadingConnect === 'brokerage'}
            className="flint-btn-primary flex-1"
          >
            {loadingConnect === 'brokerage' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Connect Brokerage
          </Button>
        </div>

        {/* Account List */}
        {accounts.length > 0 ? (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div 
                key={account.id}
                className={`account-card ${account.provider.toLowerCase()}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getProviderIcon(account.provider)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{account.accountName}</h3>
                        {getProviderBadge(account.provider)}
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
                    <Link href={`/accounts/${account.provider}/${account.id}`}>
                      <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300">
                        Details <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
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
    </Card>
  );
}