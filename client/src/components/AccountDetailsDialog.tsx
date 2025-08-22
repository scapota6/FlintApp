import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [customPaymentAmount, setCustomPaymentAmount] = useState('');
  const { toast } = useToast();

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async ({ amount, paymentType }: { amount: number; paymentType: string }) => {
      return await apiRequest(`/api/accounts/${accountId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount, paymentType })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Initiated",
        description: `Your ${data.payment.method} payment of ${formatCurrency(data.payment.amount)} has been initiated successfully.`,
      });
    },
    onError: (error: any) => {
      const fallback = error?.fallback || "Payment failed. Please try again.";
      toast({
        title: "Payment Failed",
        description: fallback,
        variant: "destructive",
      });
    }
  });

  const handlePayment = (amount: number, paymentType: string) => {
    paymentMutation.mutate({ amount, paymentType });
  };

  const handleCustomPayment = () => {
    const amount = parseFloat(customPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }
    handlePayment(amount, 'custom');
    setShowPaymentDialog(false);
    setCustomPaymentAmount('');
  };
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
                <Info label="Account ID" value={data.accountInformation?.id || data.account?.id || 'N/A'} />
                <Info label="Institution" value={data.accountInformation?.brokerage || data.account?.institution?.name || 'N/A'} />
                <Info label="Account Type" value={data.accountInformation?.type || data.account?.type || 'N/A'} />
                <Info label="Account Subtype" value={data.account?.subtype || data.accountInformation?.type || 'N/A'} />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Info label="Currency" value={data.accountInformation?.currency || data.account?.currency || 'USD'} />
                <Info label="Status" value={data.account?.status || data.accountInformation?.status || 'N/A'} />
                <Info label="Last 4" value={data.account?.last4 || data.account?.mask || 'N/A'} />
              </div>
              {/* Account Details (Routing/Account Numbers) */}
              {data.accountDetails && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Info label="Routing Number" value={data.accountDetails.routingNumberMask || 'N/A'} />
                  <Info label="Account Number" value={data.accountDetails.accountNumberMask || 'N/A'} />
                </div>
              )}
            </section>

            {/* 2. Live Balances */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm mr-3">2</div>
                Live Balances
              </h3>
              {data.provider === 'teller' && data.balances ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Bank Account Balances */}
                  {data.account?.type === 'depository' && (
                    <>
                      <Info label="Available Balance" value={fmtMoney(data.balances.available)} />
                      <Info label="Ledger Balance" value={fmtMoney(data.balances.ledger)} />
                      <Info label="Current Balance" value={fmtMoney(data.balances.current)} />
                    </>
                  )}
                  {/* Credit Card Balances */}
                  {data.account?.type === 'credit' && (
                    <>
                      <Info label="Current Balance" value={fmtMoney(data.balances.current)} />
                      <Info label="Statement Balance" value={fmtMoney(data.balances.statement)} />
                      <Info label="Available Credit" value={fmtMoney(data.balances.availableCredit)} />
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Info label="Cash" value={fmtMoney(data.accountInformation?.balancesOverview?.cash || data.account?.balance?.available)} />
                  <Info label="Equity" value={fmtMoney(data.accountInformation?.balancesOverview?.equity || data.account?.balance?.current)} />
                  <Info label="Buying Power" value={fmtMoney(data.accountInformation?.balancesOverview?.buyingPower || data.account?.balance?.ledger)} />
                </div>
              )}
            </section>

            {/* 3. Credit Card Information (if applicable) */}
            {data.creditCardInfo && (
              <section>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm mr-3">💳</div>
                  Credit Card Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Info label="Credit Limit" value={fmtMoney(data.creditCardInfo.creditLimit)} />
                  <Info label="Available Credit" value={fmtMoney(data.creditCardInfo.availableCredit)} />
                  <Info label="Current Balance" value={fmtMoney(data.creditCardInfo.currentBalance)} />
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Info label="Statement Balance" value={fmtMoney(data.creditCardInfo.statementBalance)} />
                  <Info label="Minimum Due" value={fmtMoney(data.creditCardInfo.minimumDue)} />
                  <Info label="Payment Due Date" value={data.creditCardInfo.paymentDueDate || 'N/A'} />
                </div>
                
                {/* Pay Card Button */}
                {data.creditCardInfo.paymentCapabilities?.paymentsSupported ? (
                  <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-800 dark:text-green-400 mb-3">Pay Your Card</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.creditCardInfo.minimumDue && (
                        <button
                          onClick={() => handlePayment(data.creditCardInfo.minimumDue, 'minimum')}
                          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                        >
                          Pay Minimum Due ({fmtMoney(data.creditCardInfo.minimumDue)})
                        </button>
                      )}
                      {data.creditCardInfo.statementBalance && (
                        <button
                          onClick={() => handlePayment(data.creditCardInfo.statementBalance, 'statement')}
                          className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                        >
                          Pay Statement Balance ({fmtMoney(data.creditCardInfo.statementBalance)})
                        </button>
                      )}
                      <button
                        onClick={() => setShowPaymentDialog(true)}
                        className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
                      >
                        Custom Amount
                      </button>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      Payments are processed securely via Zelle
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-orange-800 dark:text-orange-400 text-sm">
                      Your issuer doesn't support in-app payments via Zelle—use the bank or card app to pay.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* 4. Statements */}
            {data.provider === 'teller' && data.statements && data.statements.length > 0 && (
              <section>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm mr-3">📄</div>
                  Statements
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Period</th>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Start Date</th>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">End Date</th>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Status</th>
                        <th className="text-center p-3 font-semibold text-gray-900 dark:text-white">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statements.map((stmt: any, index: number) => (
                        <tr key={stmt.id || index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors duration-150">
                          <td className="p-3 text-gray-900 dark:text-white font-medium">
                            {stmt.period}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-white">
                            {stmt.startDate ? new Date(stmt.startDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-white">
                            {stmt.endDate ? new Date(stmt.endDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              stmt.status === 'available' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}>
                              {stmt.status || 'Available'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {stmt.downloadUrl ? (
                              <a
                                href={stmt.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                              >
                                Download PDF
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">Not Available</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 5. Enhanced Transactions */}
            <section>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm mr-3">📊</div>
                Recent Transactions
              </h3>
              {data.transactions && data.transactions.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Date</th>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Status</th>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Description / Merchant</th>
                        <th className="text-right p-3 font-semibold text-gray-900 dark:text-white">Amount</th>
                        <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.slice(0, 10).map((txn: any, index: number) => (
                        <tr key={txn.id || index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors duration-150">
                          <td className="p-3 text-gray-900 dark:text-white">
                            {new Date(txn.date).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              txn.status === 'posted' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {txn.status || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-900 dark:text-white">
                            <div>
                              <div className="font-medium">{txn.description || 'N/A'}</div>
                              {txn.merchant && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{txn.merchant}</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-medium ${
                              (txn.amount || 0) >= 0 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {fmtMoney(txn.amount)}
                            </span>
                          </td>
                          <td className="p-3 text-gray-500 dark:text-gray-400">
                            {txn.category || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.transactions.length > 10 && (
                    <div className="mt-4 text-center">
                      <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                        Load More Transactions
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No transactions available
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
                  <List items={data.positionsAndOrders?.activePositions || []} empty="No active positions" render={(p: any) => (
                    <div className="flex justify-between">
                      <span>{p.symbol || p.ticker || p.instrument?.symbol || '—'}</span>
                      <span className="text-right">{fmtNum(p.quantity ?? p.qty)}</span>
                    </div>
                  )}/>
                </Card>
                <Card title="Pending Orders">
                  <List items={data.positionsAndOrders?.pendingOrders || []} empty="No pending orders" render={(o: any) => (
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
                  <List items={data.positionsAndOrders?.orderHistory || []} empty="No order history" render={(o: any) => (
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
                <List items={data.activityAndTransactions || data.transactions || []} empty="No recent activity" render={(a: any) => (
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
                    <span className="font-medium">Updated: {fmtTime(data.metadata?.fetched_at || new Date().toISOString())}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Created: {fmtTime(data.metadata?.account_created || 'N/A')}</span>
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
      
      {/* Custom Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Payment Amount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Payment Amount</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={customPaymentAmount}
                onChange={(e) => setCustomPaymentAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleCustomPayment}
                disabled={paymentMutation.isPending}
                className="flex-1"
              >
                {paymentMutation.isPending ? 'Processing...' : 'Pay Now'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPaymentDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}