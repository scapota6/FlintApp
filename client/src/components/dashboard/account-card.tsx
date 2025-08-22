import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  ChevronRight,
  Activity,
  Wallet
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import AccountDetailsDialog from '../AccountDetailsDialog';

interface AccountCardProps {
  account: {
    id: string;
    provider: 'teller' | 'snaptrade';
    accountName: string;
    accountNumber?: string;
    balance: number;
    type: 'bank' | 'investment' | 'crypto';
    institution: string;
    lastUpdated: string;
    currency?: string;
    holdings?: number;
    cash?: number;
    buyingPower?: number;
  };
}

export default function AccountCard({ account }: AccountCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { user } = useAuth();

  const getAccountIcon = () => {
    switch (account.type) {
      case 'bank':
        return <Building2 className="h-5 w-5" />;
      case 'investment':
        return <TrendingUp className="h-5 w-5" />;
      case 'crypto':
        return <Wallet className="h-5 w-5" />;
      default:
        return <DollarSign className="h-5 w-5" />;
    }
  };

  const getProviderBadgeColor = () => {
    return account.provider === 'teller' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400';
  };

  const getAccountTypeColor = () => {
    switch (account.type) {
      case 'bank':
        return 'bg-green-600/20 text-green-400';
      case 'investment':
        return 'bg-orange-600/20 text-orange-400';
      case 'crypto':
        return 'bg-yellow-600/20 text-yellow-400';
      default:
        return 'bg-gray-600/20 text-gray-400';
    }
  };

  return (
    <>
      <Card className="flint-card hover:shadow-lg transition-all duration-300 group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                {getAccountIcon()}
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  {account.accountName}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {account.institution}
                  {account.accountNumber && ` • ****${account.accountNumber.slice(-4)}`}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary" className={getProviderBadgeColor()}>
                {account.provider.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className={getAccountTypeColor()}>
                {account.type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Main Balance */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
              <p className={`text-2xl font-bold ${account.type === 'credit' ? '!text-red-500' : '!text-green-500'}`} style={{color: account.type === 'credit' ? '#ef4444' : '#10b981'}}>
                {formatCurrency(account.balance)}
              </p>
            </div>

            {/* Additional Account Info */}
            {account.type === 'investment' && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {account.cash !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Cash</p>
                    <p className="font-medium">{formatCurrency(account.cash)}</p>
                  </div>
                )}
                {account.holdings !== undefined && (
                  <div>
                    <p className="text-muted-foreground">Holdings</p>
                    <p className="font-medium">{formatCurrency(account.holdings)}</p>
                  </div>
                )}
                {account.buyingPower !== undefined && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Buying Power</p>
                    <p className="font-medium text-green-400">{formatCurrency(account.buyingPower)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Last Updated */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span>Updated {new Date(account.lastUpdated).toLocaleTimeString()}</span>
              </div>
              
              {/* View Details Button */}
              <Button
                onClick={() => setShowDetails(true)}
                variant="ghost"
                size="sm"
                className="group-hover:bg-primary/10 group-hover:text-primary transition-colors"
              >
                View Details
                <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Account Details Dialog */}
      <AccountDetailsDialog
        accountId={account.provider === 'teller' && account.externalAccountId ? account.externalAccountId : String(account.id)}
        open={showDetails}
        onClose={() => setShowDetails(false)}
        currentUserId={String(user?.id || '')}
        provider={account.provider}
        localAccountId={String(account.id)}
      />
    </>
  );
}