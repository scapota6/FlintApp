/**
 * Account Details Modal with comprehensive SnapTrade data
 * Shows account information, balances, holdings, orders, and activities
 */

import React, { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Activity, CreditCard, Building2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import type { 
  AccountDetails, 
  AccountBalances, 
  Position, 
  Order, 
  Activity as ActivityType 
} from '../../schemas/snaptrade';

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName?: string;
}

export function AccountDetailsModal({ isOpen, onClose, accountId, accountName }: AccountDetailsModalProps) {
  const [activeTab, setActiveTab] = useState('information');

  // Parallel API calls when Details modal opens (per specification)
  const accountQueries = useQueries({
    queries: [
      {
        queryKey: [`/api/snaptrade/accounts/${accountId}/details`],
        enabled: isOpen && !!accountId,
        retry: 2
      },
      {
        queryKey: [`/api/snaptrade/accounts/${accountId}/balances`],
        enabled: isOpen && !!accountId,
        retry: 2
      },
      {
        queryKey: [`/api/snaptrade/accounts/${accountId}/positions`],
        enabled: isOpen && !!accountId,
        retry: 2
      },
      {
        queryKey: [`/api/snaptrade/accounts/${accountId}/orders`],
        enabled: isOpen && !!accountId,
        retry: 2
      },
      {
        queryKey: [`/api/snaptrade/accounts/${accountId}/activities`],
        enabled: isOpen && !!accountId,
        retry: 2
      }
    ]
  });

  // Extract data from parallel queries
  const [
    { data: accountDetails, isLoading: loadingDetails, error: detailsError },
    { data: balancesData, isLoading: loadingBalances, error: balancesError },
    { data: positionsData, isLoading: loadingPositions, error: positionsError },
    { data: ordersData, isLoading: loadingOrders, error: ordersError },
    { data: activitiesData, isLoading: loadingActivities, error: activitiesError }
  ] = accountQueries;

  const account = accountDetails?.account;
  const balances = balancesData?.balances;
  const positions = positionsData?.positions || [];
  const orders = ordersData?.orders || [];
  const activities = activitiesData?.activities || [];

  // Separate equity and options positions
  const equityPositions = positions.filter(p => !isOptionSymbol(p.symbol));
  const optionPositions = positions.filter(p => isOptionSymbol(p.symbol));

  function isOptionSymbol(symbol: string): boolean {
    // Basic option symbol detection (can be enhanced)
    return symbol.includes('CALL') || symbol.includes('PUT') || /\d{6}[CP]\d+/.test(symbol);
  }

  function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  function formatPercent(percent: number | null | undefined): string {
    if (percent === null || percent === undefined) return 'N/A';
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'OPEN': 'default',
      'FILLED': 'secondary',
      'CANCELLED': 'outline',
      'REJECTED': 'destructive',
      'PARTIAL': 'default'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  }

  function getActivityIcon(type: string) {
    switch (type) {
      case 'TRADE': return <Activity className="h-4 w-4" />;
      case 'DIVIDEND': return <DollarSign className="h-4 w-4" />;
      case 'DEPOSIT': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'WITHDRAWAL': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  }

  function ErrorAlert({ error, title }: { error: any; title: string }) {
    if (!error) return null;
    
    const errorData = error?.response?.data?.error;
    const code = errorData?.code;
    const message = errorData?.message || error.message;

    return (
      <Alert className="mb-4">
        <AlertDescription>
          <strong>{title} Error:</strong> {message}
          {code === 'SNAPTRADE_NOT_REGISTERED' && (
            <div className="mt-2">
              <Button variant="outline" size="sm">Finish Registration</Button>
            </div>
          )}
          {code === 'SNAPTRADE_USER_MISMATCH' && (
            <div className="mt-2">
              <Button variant="outline" size="sm">Reset SnapTrade User</Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-account-details">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {accountName || account?.name || 'Account Details'}
            {account?.institution && (
              <span className="text-sm font-normal text-muted-foreground">
                · {account.institution}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="information" data-testid="tab-information">Information</TabsTrigger>
            <TabsTrigger value="balances" data-testid="tab-balances">Balances</TabsTrigger>
            <TabsTrigger value="holdings" data-testid="tab-holdings">Holdings</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="information" className="space-y-4">
            <ErrorAlert error={detailsError} title="Account Information" />
            
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : account ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Account ID</div>
                  <div className="font-mono text-sm" data-testid="text-account-id">{account.id}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Brokerage</div>
                  <div data-testid="text-brokerage">{account.institution}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Account Type</div>
                  <div data-testid="text-account-type">{account.type || 'N/A'}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Currency</div>
                  <div data-testid="text-currency">{account.currency}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={account.status === 'open' ? 'default' : 'secondary'} data-testid="badge-status">
                    {account.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Account Number</div>
                  <div className="font-mono" data-testid="text-account-number">{account.numberMasked || 'N/A'}</div>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="balances" className="space-y-4">
            <ErrorAlert error={balancesError} title="Live Balances" />
            
            {loadingBalances ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : balances ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Cash Available</div>
                  <div className="text-2xl font-bold" data-testid="text-cash-balance">
                    {balances.cash ? formatCurrency(balances.cash.amount, balances.cash.currency) : 'N/A'}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Equity</div>
                  <div className="text-2xl font-bold" data-testid="text-total-balance">
                    {balances.total ? formatCurrency(balances.total.amount, balances.total.currency) : 'N/A'}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Buying Power</div>
                  <div className="text-xl font-semibold" data-testid="text-buying-power">
                    {balances.buyingPower ? formatCurrency(balances.buyingPower.amount, balances.buyingPower.currency) : 'N/A'}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Maintenance Excess</div>
                  <div className="text-xl font-semibold" data-testid="text-maintenance-excess">
                    {balances.maintenanceExcess ? formatCurrency(balances.maintenanceExcess.amount, balances.maintenanceExcess.currency) : 'N/A'}
                  </div>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="holdings" className="space-y-4">
            <ErrorAlert error={positionsError} title="Holdings & Positions" />
            
            {loadingPositions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Tabs defaultValue="equity" className="w-full">
                <TabsList>
                  <TabsTrigger value="equity" data-testid="tab-equity">
                    Equity/ETF ({equityPositions.length})
                  </TabsTrigger>
                  <TabsTrigger value="options" data-testid="tab-options">
                    Options ({optionPositions.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="equity">
                  {equityPositions.length > 0 ? (
                    <div className="space-y-2">
                      {equityPositions.map((position, index) => (
                        <div key={`${position.symbol}-${index}`} className="p-4 border rounded-lg" data-testid={`position-${position.symbol}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold">{position.symbol}</div>
                              <div className="text-sm text-muted-foreground">{position.description}</div>
                              <div className="text-sm">
                                {position.quantity} shares @ {formatCurrency(position.avgPrice?.amount, position.currency)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">
                                {formatCurrency(position.marketValue?.amount, position.currency)}
                              </div>
                              {position.unrealizedPnL && (
                                <div className={`text-sm ${position.unrealizedPnL.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(position.unrealizedPnL.amount, position.currency)}
                                  {position.unrealizedPnLPercent && ` (${formatPercent(position.unrealizedPnLPercent)})`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No equity positions found
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="options">
                  {optionPositions.length > 0 ? (
                    <div className="space-y-2">
                      {optionPositions.map((position, index) => (
                        <div key={`${position.symbol}-${index}`} className="p-4 border rounded-lg" data-testid={`option-${position.symbol}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-semibold font-mono">{position.symbol}</div>
                              <div className="text-sm text-muted-foreground">{position.description}</div>
                              <div className="text-sm">
                                {position.quantity} contracts @ {formatCurrency(position.avgPrice?.amount, position.currency)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">
                                {formatCurrency(position.marketValue?.amount, position.currency)}
                              </div>
                              {position.unrealizedPnL && (
                                <div className={`text-sm ${position.unrealizedPnL.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(position.unrealizedPnL.amount, position.currency)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No options positions found
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <ErrorAlert error={ordersError} title="Orders" />
            
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 border rounded-lg" data-testid={`order-${order.id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{order.symbol}</span>
                          <Badge variant={order.side === 'BUY' ? 'default' : 'secondary'}>
                            {order.side}
                          </Badge>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.type} · {order.quantity} shares
                          {order.price && ` @ ${formatCurrency(order.price)}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(order.placedAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                      <div className="text-right">
                        {order.avgFillPrice && (
                          <div className="font-semibold">
                            Filled @ {formatCurrency(order.avgFillPrice)}
                          </div>
                        )}
                        {order.filledQuantity && (
                          <div className="text-sm text-muted-foreground">
                            {order.filledQuantity} / {order.quantity} filled
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent orders found
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <ErrorAlert error={activitiesError} title="Activity" />
            
            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-4 border rounded-lg" data-testid={`activity-${activity.id}`}>
                    <div className="flex items-start gap-3">
                      {getActivityIcon(activity.type)}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{activity.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(activity.date), 'MMM d, yyyy h:mm a')}
                              {activity.symbol && (
                                <Badge variant="outline" className="ml-2">
                                  {activity.symbol}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className={`font-semibold ${activity.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {activity.amount >= 0 ? '+' : ''}{formatCurrency(activity.amount, activity.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity found
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button onClick={onClose} data-testid="button-close">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}