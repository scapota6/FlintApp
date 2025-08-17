import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, Activity, Clock } from 'lucide-react';

interface AccountDetailsModalProps {
  accountId: string | null;
  accountName?: string;
  onClose: () => void;
}

interface AccountDetails {
  accountInformation: {
    id: string;
    name: string;
    number: string;
    brokerage: string;
    type: string;
    status: string;
    currency: string;
    balancesOverview: {
      cash: number | null;
      equity: number | null;
      buyingPower: number | null;
    };
  };
  balancesAndHoldings: {
    balances: {
      cashAvailableToTrade: number | null;
      totalEquityValue: number | null;
      buyingPowerOrMargin: number | null;
    };
    holdings: Array<{
      symbol: string;
      name: string;
      quantity: number;
      costBasis: number | null;
      marketValue: number | null;
      currentPrice: number | null;
      unrealized: number | null;
    }>;
  };
  positionsAndOrders: {
    activePositions: Array<any>;
    pendingOrders: Array<any>;
    orderHistory: Array<any>;
  };
  tradingActions: {
    canPlaceOrders: boolean;
    canCancelOrders: boolean;
    canGetConfirmations: boolean;
  };
  activityAndTransactions: Array<{
    type: string;
    symbol?: string;
    amount?: number;
    quantity?: number;
    timestamp: string | null;
    description: string;
  }>;
  metadata: {
    fetched_at: string;
    last_sync: any;
    cash_restrictions: string[];
    account_created: string;
  };
}

export function AccountDetailsModal({ accountId, accountName, onClose }: AccountDetailsModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/accounts', accountId, 'details'],
    enabled: !!accountId,
  });

  const details = data as AccountDetails | undefined;

  if (!accountId) return null;

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    const percentage = (value * 100).toFixed(2);
    return `${value >= 0 ? '+' : ''}${percentage}%`;
  };

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'buy':
      case 'sell':
        return <TrendingUp className="h-4 w-4" />;
      case 'dividend':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={!!accountId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {accountName || 'Account Details'}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading account details...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-red-600 dark:text-red-400">
              Failed to load account details. Please try again.
            </p>
          </div>
        )}

        {details && (
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
            {/* Account Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(details.accountInformation.balancesOverview.equity || 0, details.accountInformation.currency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {details.accountInformation.brokerage} • ****{details.accountInformation.number.slice(-4)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cash Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(details.balancesAndHoldings.balances.cashAvailableToTrade || 0, details.accountInformation.currency)}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {details.accountInformation.type}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Buying Power</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {details.balancesAndHoldings.balances.buyingPowerOrMargin 
                      ? formatCurrency(details.balancesAndHoldings.balances.buyingPowerOrMargin, details.accountInformation.currency)
                      : '—'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status: {details.accountInformation.status}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Data Tabs */}
            <Tabs defaultValue="positions" className="space-y-4">
              <TabsList>
                <TabsTrigger value="positions">
                  Positions ({details.positionsAndOrders?.activePositions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="orders">
                  Orders ({details.positionsAndOrders?.pendingOrders?.length || 0} open)
                </TabsTrigger>
                <TabsTrigger value="activities">
                  Activities ({details.activityAndTransactions?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="positions" className="space-y-4">
                {details.positionsAndOrders?.activePositions && details.positionsAndOrders.activePositions.length > 0 ? (
                  <div className="space-y-2">
                    {details.positionsAndOrders.activePositions.map((position: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{position.symbol?.symbol || position.symbol || '—'}</h4>
                              <p className="text-sm text-muted-foreground">
                                {position.symbol?.name || position.name || '—'}
                              </p>
                              <p className="text-xs">
                                {position.quantity} shares {position.average_purchase_price ? `@ ${formatCurrency(position.average_purchase_price)}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {position.market_value ? formatCurrency(position.market_value) : '—'}
                              </div>
                              {position.unrealized_pl !== null && position.unrealized_pl !== undefined && (
                                <div className={`text-sm ${
                                  position.unrealized_pl >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(position.unrealized_pl)}
                                </div>
                              )}
                              {position.current_price && (
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(position.current_price)} per share
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No active positions found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="space-y-4">
                {details.positionsAndOrders?.pendingOrders && details.positionsAndOrders.pendingOrders.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Pending Orders</h3>
                    {details.positionsAndOrders.pendingOrders.map((order: any) => (
                      <Card key={order.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{order.symbol?.symbol || order.symbol || '—'}</h4>
                              <p className="text-sm text-muted-foreground">
                                {order.action || order.side} {order.quantity} shares
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {order.order_type || order.type}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {order.price ? formatCurrency(order.price) : '—'}
                              </div>
                              <Badge variant={order.status === 'PENDING' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                              {order.created_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(order.created_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No pending orders
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                {details.activityAndTransactions && details.activityAndTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {details.activityAndTransactions.slice(0, 20).map((activity, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {getActivityIcon(activity.type)}
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium">{activity.description || activity.type}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {activity.symbol && `${activity.symbol} • `}
                                    {activity.timestamp && new Date(activity.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline">{activity.type}</Badge>
                                  {activity.amount && (
                                    <p className="text-sm mt-1 font-medium">
                                      {formatCurrency(activity.amount)}
                                    </p>
                                  )}
                                  {activity.quantity && (
                                    <p className="text-xs text-muted-foreground">
                                      Qty: {activity.quantity}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    No recent activities
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex justify-end">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}