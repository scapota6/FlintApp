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
  account: {
    id: string;
    name: string;
    number: string;
    institution: string;
    type: string;
    status: string;
    balance: { total: { amount: number; currency: string } };
  };
  balances: any;
  positions: Array<{
    symbol: { symbol: string; name: string };
    quantity: number;
    average_purchase_price: number;
    current_price: number;
    market_value: number;
    unrealized_pl: number;
  }>;
  orders: {
    open: Array<{
      id: string;
      symbol: string;
      quantity: number;
      action: string;
      order_type: string;
      price: number;
      time_in_force: string;
      status: string;
    }>;
    history: Array<{
      id: string;
      symbol: string;
      quantity: number;
      action: string;
      order_type: string;
      price: number;
      executed_at: string;
      status: string;
    }>;
  };
  activities: Array<{
    id: string;
    type: string;
    symbol?: string;
    quantity?: number;
    price?: number;
    fee?: number;
    settlement_date: string;
    description: string;
  }>;
  metadata: {
    fetched_at: string;
    last_sync: any;
    cash_restrictions: string[];
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
                  <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(details.account.balance.total.amount)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {details.account.institution} • {details.account.number}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Account Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="mb-2">
                    {details.account.type}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Status: {details.account.status}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      {new Date(details.metadata.fetched_at).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Data Tabs */}
            <Tabs defaultValue="positions" className="space-y-4">
              <TabsList>
                <TabsTrigger value="positions">
                  Positions ({details.positions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="orders">
                  Orders ({details.orders?.open?.length || 0} open)
                </TabsTrigger>
                <TabsTrigger value="activities">
                  Activities ({details.activities?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="positions" className="space-y-4">
                {details.positions && details.positions.length > 0 ? (
                  <div className="space-y-2">
                    {details.positions.map((position, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{position.symbol?.symbol}</h4>
                              <p className="text-sm text-muted-foreground">
                                {position.symbol?.name}
                              </p>
                              <p className="text-xs">
                                {position.quantity} shares @ {formatCurrency(position.average_purchase_price)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {formatCurrency(position.market_value)}
                              </div>
                              <div className={`text-sm ${
                                position.unrealized_pl >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(position.unrealized_pl)}
                              </div>
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
                                {order.order_type}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {formatCurrency(order.price)}
                              </div>
                              <Badge variant={order.status === 'PENDING' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
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
                                    {new Date(activity.settlement_date).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline">{activity.type}</Badge>
                                  {activity.quantity && (
                                    <p className="text-sm mt-1">
                                      {activity.quantity} @ {formatCurrency(activity.price || 0)}
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