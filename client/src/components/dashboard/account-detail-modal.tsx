import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Building, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  ExternalLink, 
  RefreshCw,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { TellerAPI } from "@/lib/teller-api";
import { SnapTradeAPI } from "@/lib/snaptrade-api";

interface AccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: any;
}

export default function AccountDetailModal({ isOpen, onClose, account }: AccountDetailModalProps) {
  const { toast } = useToast();

  // Fetch account details based on provider
  const { data: accountDetails, isLoading, error } = useQuery({
    queryKey: [`/api/account-details/${account?.id}`],
    queryFn: async () => {
      if (!account) return null;
      
      if (account.provider === 'teller') {
        return await TellerAPI.getTransactions(account.externalAccountId, account.accessToken);
      } else if (account.provider === 'snaptrade') {
        return await SnapTradeAPI.getHoldings(account.externalAccountId);
      }
      return null;
    },
    enabled: !!account && isOpen,
  });

  const { data: holdings, isLoading: holdingsLoading } = useQuery({
    queryKey: [`/api/holdings/${account?.id}`],
    queryFn: async () => {
      if (!account || account.provider !== 'snaptrade') return [];
      return await SnapTradeAPI.getHoldings(account.externalAccountId);
    },
    enabled: !!account && isOpen && account.provider === 'snaptrade',
  });

  if (!account) return null;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Building className="h-5 w-5" />;
      case 'brokerage':
      case 'crypto':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Building className="h-5 w-5" />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'teller':
        return 'Teller.io';
      case 'snaptrade':
        return 'SnapTrade';
      default:
        return provider;
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-600 text-white">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Disconnected
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              {getAccountIcon(account.accountType)}
            </div>
            <span>{account.institutionName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Account Overview */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Account Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Account Name</p>
                  <p className="text-white font-medium">{account.accountName}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Account Type</p>
                  <p className="text-white font-medium capitalize">{account.accountType}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Balance</p>
                  <p className="text-white font-bold text-lg">
                    {formatCurrency(parseFloat(account.balance), account.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Provider</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-medium">{getProviderName(account.provider)}</p>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-700" />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <p className="text-gray-400 text-sm">Connection Status</p>
                  {getStatusBadge(account.isActive)}
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Last Synced</p>
                  <p className="text-white text-sm">
                    {formatDate(account.lastSynced || account.updatedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Holdings (for brokerage/crypto accounts) */}
          {account.provider === 'snaptrade' && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">Holdings</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {holdingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : holdings && holdings.length > 0 ? (
                  <div className="space-y-3">
                    {holdings.map((holding: any) => (
                      <div key={holding.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {holding.symbol.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium">{holding.symbol}</p>
                            <p className="text-gray-400 text-sm">{holding.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">
                            {holding.quantity} shares
                          </p>
                          <p className="text-gray-400 text-sm">
                            {formatCurrency(holding.market_value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No holdings found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Transactions (for bank accounts) */}
          {account.provider === 'teller' && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">Recent Transactions</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : accountDetails && accountDetails.length > 0 ? (
                  <div className="space-y-3">
                    {accountDetails.slice(0, 10).map((transaction: any) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.amount > 0 ? 'bg-green-600' : 'bg-red-600'
                          }`}>
                            <DollarSign className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{transaction.description}</p>
                            <p className="text-gray-400 text-sm">
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {transaction.amount > 0 ? '+' : ''}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-gray-400 text-sm capitalize">
                            {transaction.type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent transactions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                toast({
                  title: "Disconnect Account",
                  description: "This feature will be available soon.",
                });
              }}
            >
              Disconnect Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}