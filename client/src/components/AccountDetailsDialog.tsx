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

// Helper component for displaying key-value information
const Info = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</div>
    <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
      {value || '—'}
    </div>
  </div>
);

// Money formatting helper
const fmtMoney = (amount: number | null | undefined, currency: string = 'USD') => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Number formatting helper
const fmtNum = (num: number | null | undefined) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  }).format(num);
};

// Table component helpers
const Th = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th className={`px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 text-sm text-gray-900 dark:text-white ${className}`}>
    {children}
  </td>
);

const TdRight = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-3 py-2 text-sm text-right text-gray-900 dark:text-white ${className}`}>
    {children}
  </td>
);

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
          <div className="space-y-8 overflow-y-auto max-h-[70vh] pr-1">
            {/* 1. Account Information */}
            <section>
              <h3 className="text-lg font-medium mb-2">1. Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Info label="Account ID" value={data.accountInformation.id} />
                <Info label="Brokerage" value={data.accountInformation.brokerage} />
                <Info label="Account Type" value={data.accountInformation.type} />
                <Info label="Currency" value={data.accountInformation.currency} />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info label="Cash" value={fmtMoney(data.accountInformation.balancesOverview.cash)} />
                <Info label="Equity" value={fmtMoney(data.accountInformation.balancesOverview.equity)} />
                <Info label="Buying Power" value={fmtMoney(data.accountInformation.balancesOverview.buyingPower)} />
              </div>
            </section>

            {/* 2. Balances and Holdings */}
            <section>
              <h3 className="text-lg font-medium mb-2">2. Balances and Holdings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <Info label="Cash Available" value={fmtMoney(data.balancesAndHoldings.balances.cashAvailableToTrade)} />
                <Info label="Total Equity" value={fmtMoney(data.balancesAndHoldings.balances.totalEquityValue)} />
                <Info label="Buying Power / Margin" value={fmtMoney(data.balancesAndHoldings.balances.buyingPowerOrMargin)} />
              </div>

              {data.balancesAndHoldings.holdings && data.balancesAndHoldings.holdings.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <Th>Symbol</Th>
                        <Th className="text-right">Qty</Th>
                        <Th className="text-right">Cost Basis</Th>
                        <Th className="text-right">Mkt Value</Th>
                        <Th className="text-right">Unrealized</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.balancesAndHoldings.holdings.map((h: any, i: number) => (
                        <tr key={i} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <Td>{h.symbol}</Td>
                          <TdRight>{fmtNum(h.quantity)}</TdRight>
                          <TdRight>{fmtMoney(h.costBasis)}</TdRight>
                          <TdRight>{fmtMoney(h.marketValue)}</TdRight>
                          <TdRight className={Number(h.unrealized) < 0 ? 'text-red-600' : 'text-green-600'}>
                            {fmtMoney(h.unrealized)}
                          </TdRight>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 3. Positions & Orders */}
            <section>
              <h3 className="text-lg font-medium mb-2">3. Positions & Orders</h3>
              
              {data.positionsAndOrders.activePositions && data.positionsAndOrders.activePositions.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Active Positions ({data.positionsAndOrders.activePositions.length})</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {data.positionsAndOrders.activePositions.map((position: any, index: number) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{position.symbol?.symbol || position.symbol}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {position.quantity} shares
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{fmtMoney(position.market_value)}</div>
                            {position.unrealized_pl !== null && (
                              <div className={`text-sm ${position.unrealized_pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {fmtMoney(position.unrealized_pl)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.positionsAndOrders.pendingOrders && data.positionsAndOrders.pendingOrders.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Pending Orders ({data.positionsAndOrders.pendingOrders.length})</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {data.positionsAndOrders.pendingOrders.map((order: any) => (
                      <div key={order.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{order.symbol?.symbol || order.symbol}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {order.action || order.side} {order.quantity} shares
                            </div>
                            <Badge variant="outline" className="text-xs mt-1">
                              {order.order_type || order.type}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{fmtMoney(order.price)}</div>
                            <Badge variant={order.status === 'PENDING' ? 'default' : 'secondary'}>
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 4. Trading Actions */}
            <section>
              <h3 className="text-lg font-medium mb-2">4. Trading Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info label="Can Place Orders" value={data.tradingActions.canPlaceOrders ? 'Yes' : 'No'} />
                <Info label="Can Cancel Orders" value={data.tradingActions.canCancelOrders ? 'Yes' : 'No'} />
                <Info label="Can Get Confirmations" value={data.tradingActions.canGetConfirmations ? 'Yes' : 'No'} />
              </div>
            </section>

            {/* 5. Activity & Transactions */}
            <section>
              <h3 className="text-lg font-medium mb-2">5. Activity & Transactions</h3>
              {data.activityAndTransactions && data.activityAndTransactions.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {data.activityAndTransactions.slice(0, 20).map((activity: any, index: number) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <div className="flex items-start gap-3">
                        {getActivityIcon(activity.type)}
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{activity.description || activity.type}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {activity.symbol && `${activity.symbol} • `}
                                {activity.timestamp && new Date(activity.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">{activity.type}</Badge>
                              {activity.amount && (
                                <div className="text-sm font-medium mt-1">
                                  {fmtMoney(activity.amount)}
                                </div>
                              )}
                              {activity.quantity && (
                                <div className="text-xs text-gray-500">
                                  Qty: {activity.quantity}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  No recent activities found
                </div>
              )}
            </section>



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