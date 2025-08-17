import React from 'react';
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
    <div className={`rounded-xl border p-3 ${className}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value ?? '—'}</div>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 font-medium">{title}</div>
      {children}
    </div>
  );
}

function List({ items, empty, render }: any) {
  if (!items || items.length === 0) return <div className="text-gray-500 text-sm">{empty}</div>;
  return <div className="space-y-2">{items.map((x: any, i: number) => <div key={i}>{render(x)}</div>)}</div>;
}

function Th({ children, className = '' }: any) { 
  return <th className={`text-left px-3 py-2 text-xs font-semibold ${className}`}>{children}</th>; 
}

function Td({ children, className = '', ...rest }: any) { 
  return <td className={`px-3 py-2 ${className}`} {...rest}>{children}</td>; 
}

function TdRight({ children, className = '', ...rest }: any) { 
  return <Td className={`text-right ${className}`} {...rest}>{children}</Td>; 
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
                      {data.balancesAndHoldings.holdings.length === 0 && (
                        <tr><Td colSpan={5} className="text-center text-gray-500 py-3">No holdings</Td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 3. Positions and Orders */}
            <section>
              <h3 className="text-lg font-medium mb-2">3. Positions and Orders</h3>
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
              <h3 className="text-lg font-medium mb-2">4. Trading Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  Buy
                </button>
                <button className="rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  Sell
                </button>
                <button className="rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  Cancel Open Orders
                </button>
                <button className="rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  Get Confirmations
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Wire these to your trade endpoints when ready.</p>
            </section>

            {/* 6. Activity / Transactions */}
            <section>
              <h3 className="text-lg font-medium mb-2">6. Activity / Transactions</h3>
              <Card title="Recent Activity">
                <List items={data.activityAndTransactions} empty="No recent activity" render={(a: any) => (
                  <div className="grid grid-cols-5 gap-2">
                    <span>{a.type}</span>
                    <span>{a.symbol || '—'}</span>
                    <span className="text-right">{fmtNum(a.quantity)}</span>
                    <span className="text-right">{fmtMoney(a.amount)}</span>
                    <span className="text-right text-gray-500">{fmtTime(a.timestamp)}</span>
                  </div>
                )}/>
              </Card>
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