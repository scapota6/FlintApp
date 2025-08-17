import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import OrderPreviewDialog from './OrderPreviewDialog';
import OrderStatusDialog from './OrderStatusDialog';

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

// Helper components and utilities
function Info({ label, value, className = '' }: any) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-850 p-4 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="font-semibold text-gray-900 dark:text-white mt-1">{value ?? '—'}</div>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-850 p-4 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="mb-3 font-semibold text-gray-900 dark:text-white">{title}</div>
      {children}
    </div>
  );
}

function List({ items, empty, render }: any) {
  if (!items || items.length === 0) return <div className="text-gray-500 dark:text-gray-400 text-sm p-3 italic">{empty}</div>;
  return <div className="space-y-3">{items.map((x: any, i: number) => <div key={i} className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-200">{render(x)}</div>)}</div>;
}

function Th({ children, className = '' }: any) { 
  return <th className={`text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide ${className}`}>{children}</th>; 
}

function Td({ children, className = '', ...rest }: any) { 
  return <td className={`px-4 py-3 text-gray-800 dark:text-gray-200 transition-colors duration-150 ${className}`} {...rest}>{children}</td>; 
}

function TdRight({ children, className = '', ...rest }: any) { 
  return <Td className={`text-right font-medium ${className}`} {...rest}>{children}</Td>; 
}

function fmtMoney(v: any) { 
  if (v == null || v === undefined || isNaN(Number(v))) return '—'; 
  return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`; 
}

function fmtNum(v: any) { 
  if (v == null || v === undefined || isNaN(Number(v))) return '—'; 
  return Number(v).toLocaleString(); 
}

function fmtTime(v: any) { 
  if (!v) return '—'; 
  try { 
    return new Date(v).toLocaleString(); 
  } catch { 
    return String(v); 
  } 
}

export default function AccountDetailsDialog({ accountId, open, onClose, currentUserId }: Props) {
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderStatusDialogOpen, setOrderStatusDialogOpen] = useState(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl max-h-[95vh] rounded-2xl bg-gradient-to-br from-white via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950/20 border border-purple-100 dark:border-purple-800/30 shadow-2xl shadow-purple-500/10 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-purple-100 dark:border-purple-800/30 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Account Details</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Real-time account information and holdings</p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-xl border border-purple-200 dark:border-purple-700 bg-white/80 dark:bg-gray-800/80 px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 dark:border-purple-800"></div>
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-purple-600 absolute top-0 left-0"></div>
            </div>
            <span className="ml-4 text-gray-600 dark:text-gray-400 font-medium">Loading account details...</span>
          </div>
        )}

        {isError && (
          <div className="mx-6 mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-700 rounded-xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-red-800 dark:text-red-200 font-medium">Failed to load account details</p>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">Please check your connection and try again.</p>
              </div>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-8 overflow-y-auto max-h-[75vh] p-6 bg-gradient-to-b from-transparent to-purple-50/30 dark:to-purple-950/10">
            {/* 1. Account Information */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm mr-3">1</div>
                Account Information
              </h3>
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm mr-3">2</div>
                Balances and Holdings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <Info label="Cash Available" value={fmtMoney(data.balancesAndHoldings.balances.cashAvailableToTrade)} />
                <Info label="Total Equity" value={fmtMoney(data.balancesAndHoldings.balances.totalEquityValue)} />
                <Info label="Buying Power / Margin" value={fmtMoney(data.balancesAndHoldings.balances.buyingPowerOrMargin)} />
              </div>

              {data.balancesAndHoldings.holdings && data.balancesAndHoldings.holdings.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30">
                      <tr>
                        <Th>Symbol</Th>
                        <Th className="text-right">Quantity</Th>
                        <Th className="text-right">Cost Basis</Th>
                        <Th className="text-right">Market Value</Th>
                        <Th className="text-right">P&L</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.balancesAndHoldings.holdings.map((h: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors duration-150">
                          <Td className="font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">{h.symbol}</Td>
                          <TdRight className="hover:text-gray-900 dark:hover:text-gray-100">{fmtNum(h.quantity)}</TdRight>
                          <TdRight className="hover:text-gray-900 dark:hover:text-gray-100">{fmtMoney(h.costBasis)}</TdRight>
                          <TdRight className="font-semibold hover:text-gray-900 dark:hover:text-gray-100">{fmtMoney(h.marketValue)}</TdRight>
                          <TdRight className={`font-bold ${Number(h.unrealized) < 0 ? 'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300' : 'text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300'}`}>
                            {Number(h.unrealized) < 0 ? '▼' : '▲'} {fmtMoney(h.unrealized)}
                          </TdRight>
                        </tr>
                      ))}
                      {data.balancesAndHoldings.holdings.length === 0 && (
                        <tr><Td colSpan={5} className="text-center text-gray-500 dark:text-gray-400 py-6 italic">No holdings available</Td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 3. Positions and Orders */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm mr-3">3</div>
                Positions and Orders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Active Positions">
                  <List items={data.positionsAndOrders.activePositions} empty="No active positions" render={(p: any) => (
                    <div className="flex justify-between">
                      <span>{p.symbol || p.ticker || p.instrument?.symbol || '—'}</span>
                      <span className="text-right">{fmtNum(p.quantity ?? p.qty)}</span>
                    </div>
                  )}/>
                </Card>
                <Card title="Pending Orders">
                  <List items={data.positionsAndOrders.pendingOrders} empty="No pending orders" render={(o: any) => (
                    <div className="grid grid-cols-4 gap-2">
                      <span>{o.symbol || o.ticker || '—'}</span>
                      <span className="text-right">{(o.side || o.action || '').toUpperCase()}</span>
                      <span className="text-right">{fmtNum(o.quantity || o.qty)}</span>
                      <span className="text-right">{fmtMoney(o.limitPrice ?? o.price)}</span>
                    </div>
                  )}/>
                </Card>
              </div>
              
              <div className="mt-4">
                <Card title="Order History">
                  <List items={data.positionsAndOrders.orderHistory} empty="No order history" render={(o: any) => (
                    <div className="grid grid-cols-5 gap-2">
                      <span>{o.symbol || o.ticker || '—'}</span>
                      <span className="text-right">{(o.side || o.action || '').toUpperCase()}</span>
                      <span className="text-right">{fmtNum(o.quantity || o.qty)}</span>
                      <span className="text-right">{fmtMoney(o.avgFillPrice ?? o.fillPrice ?? o.price)}</span>
                      <span className="text-right text-gray-500">{fmtTime(o.time || o.timestamp || o.date)}</span>
                    </div>
                  )}/>
                </Card>
              </div>
            </section>

            {/* 4. Trading Actions */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm mr-3">4</div>
                Trading Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setOrderDialogOpen(true)}
                  className="rounded-xl border border-purple-200 dark:border-purple-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 px-4 py-2 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-800/50 dark:hover:to-blue-800/50 text-purple-700 dark:text-purple-300 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  🛒 Place Order
                </button>
                <button 
                  onClick={() => setOrderStatusDialogOpen(true)}
                  className="rounded-xl border border-orange-200 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/30 dark:to-yellow-900/30 px-4 py-2 hover:from-orange-100 hover:to-yellow-100 dark:hover:from-orange-800/50 dark:hover:to-yellow-800/50 text-orange-700 dark:text-orange-300 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  ❌ Cancel Orders
                </button>
                <button 
                  onClick={() => setOrderStatusDialogOpen(true)}
                  className="rounded-xl border border-blue-200 dark:border-blue-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 px-4 py-2 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-800/50 dark:hover:to-cyan-800/50 text-blue-700 dark:text-blue-300 font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  📊 Manage Orders
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic bg-purple-50 dark:bg-purple-950/20 p-2 rounded-lg border border-purple-200 dark:border-purple-800">
                🚀 Complete trading system: Preview → placeForceOrder → cancelOrder with capability checking
              </p>
            </section>

            {/* 5. Activity and Transactions */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm mr-3">5</div>
                Activity and Transactions
              </h3>
              <Card title="Recent Activity">
                <List items={data.activityAndTransactions} empty="No recent activity" render={(a: any) => (
                  <div className="grid grid-cols-5 gap-2 text-gray-900 dark:text-gray-100">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{a.type}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{a.symbol || '—'}</span>
                    <span className="text-right font-medium text-gray-800 dark:text-gray-200">{fmtNum(a.quantity)}</span>
                    <span className="text-right font-medium text-gray-800 dark:text-gray-200">{fmtMoney(a.amount)}</span>
                    <span className="text-right text-gray-600 dark:text-gray-300">{fmtTime(a.timestamp)}</span>
                  </div>
                )}/>
              </Card>
            </section>



            {/* Footer with metadata */}
            <div className="mt-8 pt-6 border-t border-gradient-to-r from-purple-200 to-blue-200 dark:from-purple-800 dark:to-blue-800 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Updated: {new Date(data.metadata.fetched_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Created: {new Date(data.metadata.account_created).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                  Real-time data via SnapTrade
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Order Preview Dialog */}
      <OrderPreviewDialog
        isOpen={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        accountId={accountId}
        accountName={data?.accountInformation?.name || 'Unknown Account'}
        cashBalance={data?.balancesAndHoldings?.cash || 0}
      />
      
      {/* Order Status Dialog */}
      <OrderStatusDialog
        isOpen={orderStatusDialogOpen}
        onClose={() => setOrderStatusDialogOpen(false)}
        accountId={accountId}
        accountName={data?.accountInformation?.name || 'Unknown Account'}
      />
    </div>
  );
}