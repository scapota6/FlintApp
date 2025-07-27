import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorRetryCard } from "@/components/ui/error-retry-card";
import { useSnapTradeAccounts, useAccountPositions, useAccountOrders, useConnectBrokerage, useSyncAccounts } from "@/hooks/useSnapTrade";
import { Building2, TrendingUp, RefreshCw, Plus, DollarSign, BarChart3 } from "lucide-react";
import { SnapTradeAccount, SnapTradePosition, SnapTradeOrder } from "@/services/snaptrade-service";

export function SnapTradeAccountManager() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  const { 
    data: accounts = [], 
    isLoading: accountsLoading, 
    error: accountsError, 
    refetch: refetchAccounts 
  } = useSnapTradeAccounts();
  
  const { 
    data: positions = [], 
    isLoading: positionsLoading 
  } = useAccountPositions(selectedAccountId);
  
  const { 
    data: orders = [], 
    isLoading: ordersLoading 
  } = useAccountOrders(selectedAccountId);
  
  const connectBrokerage = useConnectBrokerage();
  const syncAccounts = useSyncAccounts();

  const handleConnectBrokerage = async () => {
    try {
      await connectBrokerage.mutateAsync();
    } catch (error) {
      console.error('Failed to connect brokerage:', error);
    }
  };

  const handleSyncAccounts = async () => {
    try {
      await syncAccounts.mutateAsync();
    } catch (error) {
      console.error('Failed to sync accounts:', error);
    }
  };

  if (accountsError) {
    return (
      <ErrorRetryCard
        title="Failed to load SnapTrade accounts"
        description="Could not connect to your brokerage accounts"
        onRetry={() => refetchAccounts()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Brokerage Accounts</h2>
          <p className="text-gray-400">Manage your connected brokerage accounts via SnapTrade</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleSyncAccounts}
            disabled={syncAccounts.isPending}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncAccounts.isPending ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button 
            onClick={handleConnectBrokerage}
            disabled={connectBrokerage.isPending}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect Brokerage
          </Button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accountsLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flint-card">
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : accounts.length === 0 ? (
          // Empty state
          <Card className="flint-card col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Brokerage Accounts</h3>
              <p className="text-gray-400 text-center mb-4">
                Connect your brokerage account to start trading with real-time data
              </p>
              <Button onClick={handleConnectBrokerage} disabled={connectBrokerage.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Your First Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Account cards
          accounts.map((account: SnapTradeAccount) => (
            <Card 
              key={account.id} 
              className={`flint-card cursor-pointer transition-all duration-200 hover:border-purple-500/50 ${
                selectedAccountId === account.id ? 'border-purple-500 bg-purple-500/5' : ''
              }`}
              onClick={() => setSelectedAccountId(account.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm font-medium">
                    {account.name || account.institution_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {account.type}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">{account.institution_name}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Total Balance</span>
                    <span className="text-lg font-semibold text-white">
                      ${account.balance?.total?.amount?.toLocaleString() || '0.00'}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-gray-400">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {account.balance?.total?.currency || 'USD'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Account Details Section */}
      {selectedAccountId && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Positions */}
          <Card className="flint-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-400" />
                Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {positionsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : positions.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No positions found</p>
              ) : (
                <div className="space-y-3">
                  {positions.map((position: SnapTradePosition, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30">
                      <div>
                        <p className="text-white font-medium">{position.symbol}</p>
                        <p className="text-xs text-gray-400">{position.units} shares</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white">${position.price?.toFixed(2) || '0.00'}</p>
                        <p className={`text-xs ${
                          (position.open_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {(position.open_pnl || 0) >= 0 ? '+' : ''}${position.open_pnl?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orders */}
          <Card className="flint-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No recent orders</p>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map((order: SnapTradeOrder) => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30">
                      <div>
                        <p className="text-white font-medium">{order.symbol}</p>
                        <p className="text-xs text-gray-400">
                          {order.action} {order.units} @ {order.order_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={order.status === 'FILLED' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {order.status}
                        </Badge>
                        <p className="text-xs text-gray-400 mt-1">
                          ${order.price?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}