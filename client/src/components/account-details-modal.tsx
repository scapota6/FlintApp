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
  orders: {
    open: Array<{
      id: string;
      symbol: string;
      quantity: number;
      action: string;
      orderType: string;
      price: number | null;
      timeInForce: string;
      status: string;
      createdAt: string | null;
    }>;
    history: Array<{
      id: string;
      symbol: string;
      quantity: number;
      action: string;
      orderType: string;
      price: number | null;
      executedAt: string | null;
      status: string;
    }>;
  };
  activities: Array<{
    id: string;
    type: string;
    symbol: string | null;
    description: string;
    quantity: number | null;
    price: number | null;
    fee: number | null;
    netAmount: number | null;
    settlementDate: string | null;
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
                  Positions ({details.balancesAndHoldings?.holdings?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="orders">
                  Orders ({details.orders?.open?.length || 0} open)
                </TabsTrigger>
                <TabsTrigger value="activities">
                  Activities ({details.activities?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="positions" className="space-y-4">
                {details.balancesAndHoldings?.holdings && details.balancesAndHoldings.holdings.length > 0 ? (
                  <div className="space-y-2">
                    {details.balancesAndHoldings.holdings.map((position, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{position.symbol}</h4>
                              <p className="text-sm text-muted-foreground">
                                {position.name}
                              </p>
                              <p className="text-xs">
                                {position.quantity} shares {position.costBasis ? `@ ${formatCurrency(position.costBasis)}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {position.marketValue ? formatCurrency(position.marketValue) : '—'}
                              </div>
                              {position.unrealized !== null && (
                                <div className={`text-sm ${
                                  position.unrealized >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(position.unrealized)}
                                </div>
                              )}
                              {position.currentPrice && (
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(position.currentPrice)} per share
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
                    No positions found
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="space-y-4">
                {details.orders?.open && details.orders.open.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Open Orders</h3>
                    {details.orders.open.map((order) => (
                      <Card key={order.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{order.symbol}</h4>
                              <p className="text-sm text-muted-foreground">
                                {order.action} {order.quantity} shares
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {order.orderType}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {order.price ? formatCurrency(order.price) : '—'}
                              </div>
                              <Badge variant={order.status === 'PENDING' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                              {order.createdAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(order.createdAt).toLocaleDateString()}
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
                    No open orders
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                {details.activities && details.activities.length > 0 ? (
                  <div className="space-y-2">
                    {details.activities.slice(0, 20).map((activity) => (
                      <Card key={activity.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {getActivityIcon(activity.type)}
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium">{activity.description}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {activity.symbol && `${activity.symbol} • `}
                                    {activity.settlementDate && new Date(activity.settlementDate).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline">{activity.type}</Badge>
                                  {activity.netAmount && (
                                    <p className="text-sm mt-1 font-medium">
                                      {formatCurrency(activity.netAmount)}
                                    </p>
                                  )}
                                  {activity.quantity && activity.price && (
                                    <p className="text-xs text-muted-foreground">
                                      {activity.quantity} @ {formatCurrency(activity.price)}
                                    </p>
                                  )}
                                  {activity.fee && (
                                    <p className="text-xs text-muted-foreground">
                                      Fee: {formatCurrency(activity.fee)}
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