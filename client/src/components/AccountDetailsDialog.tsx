import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Calendar,
  Clock,
  X
} from 'lucide-react';

type Props = {
  accountId: string;
  open: boolean;
  onClose: () => void;
  currentUserId: string; // e.g., "45137738"
};

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

const getActivityIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'buy':
    case 'purchase':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'sell':
    case 'sale':
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    case 'dividend':
    case 'interest':
      return <DollarSign className="h-4 w-4 text-blue-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

export default function AccountDetailsDialog({ accountId, open, onClose, currentUserId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['account-details', accountId],
    enabled: open,
    queryFn: async () => {
      const resp = await fetch(`/api/accounts/${accountId}/details`, {
        headers: { 'x-user-id': currentUserId },
        credentials: 'include',
      });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    }
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Account Details</h2>
          <button 
            onClick={onClose} 
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading account details...</span>
          </div>
        )}

        {isError && (
          <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            Failed to load account details. Please try again.
          </div>
        )}

        {data && (
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
            {/* Account Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(data.accountInformation.balancesOverview.equity || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.accountInformation.brokerage} • ****{data.accountInformation.number.slice(-4)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cash Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(data.balancesAndHoldings.balances.cashAvailableToTrade || 0)}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {data.accountInformation.type}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Buying Power</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {data.balancesAndHoldings.balances.buyingPowerOrMargin 
                      ? formatCurrency(data.balancesAndHoldings.balances.buyingPowerOrMargin)
                      : '—'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status: {data.accountInformation.status}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Data Tabs */}
            <Tabs defaultValue="positions" className="space-y-4">
              <TabsList>
                <TabsTrigger value="positions">
                  Positions ({data.positionsAndOrders?.activePositions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="orders">
                  Orders ({data.positionsAndOrders?.pendingOrders?.length || 0} open)
                </TabsTrigger>
                <TabsTrigger value="activities">
                  Activities ({data.activityAndTransactions?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="positions" className="space-y-4">
                {data.positionsAndOrders?.activePositions && data.positionsAndOrders.activePositions.length > 0 ? (
                  <div className="space-y-2">
                    {data.positionsAndOrders.activePositions.map((position: any, index: number) => (
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
                {data.positionsAndOrders?.pendingOrders && data.positionsAndOrders.pendingOrders.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Pending Orders</h3>
                    {data.positionsAndOrders.pendingOrders.map((order: any) => (
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
                {data.activityAndTransactions && data.activityAndTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {data.activityAndTransactions.slice(0, 20).map((activity: any, index: number) => (
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

            {/* Footer with metadata */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Updated: {new Date(data.metadata.fetched_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Created: {new Date(data.metadata.account_created).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}