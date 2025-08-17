import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, AlertTriangle, X, RefreshCw, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface OrderStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
}

const fmtMoney = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
}).format(amount);

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'filled':
    case 'complete':
    case 'executed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    case 'pending':
    case 'open':
    case 'submitted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    case 'cancelled':
    case 'canceled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    case 'rejected':
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'filled':
    case 'complete':
    case 'executed':
      return <CheckCircle className="h-4 w-4" />;
    case 'pending':
    case 'open':
    case 'submitted':
      return <Clock className="h-4 w-4" />;
    case 'cancelled':
    case 'canceled':
      return <X className="h-4 w-4" />;
    case 'rejected':
    case 'failed':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <RefreshCw className="h-4 w-4" />;
  }
};

export default function OrderStatusDialog({ 
  isOpen, 
  onClose, 
  accountId, 
  accountName 
}: OrderStatusDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch orders for the account
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', accountId],
    queryFn: () => apiRequest(`/api/orders?accountId=${accountId}&days=7`),
    enabled: isOpen,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => 
      apiRequest(`/api/orders/${orderId}`, {
        method: 'DELETE',
        body: JSON.stringify({ accountId }),
      }),
    onSuccess: (data: any) => {
      toast({
        title: 'Order Cancelled',
        description: data.message || 'Order has been successfully cancelled',
      });
      queryClient.invalidateQueries({ queryKey: ['orders', accountId] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['account-details', accountId] });
    },
    onError: (error: any) => {
      let title = 'Cancel Failed';
      let description = 'Failed to cancel order';

      // Handle specific error cases with user-friendly messages
      if (error.status === 501) {
        title = 'Not Supported';
        description = 'This brokerage does not support order cancellation';
      } else if (error.status === 404) {
        title = 'Order Not Found';
        description = 'Order not found or already processed';
      } else if (error.status === 409) {
        title = 'Cannot Cancel';
        description = 'Order already executed and cannot be cancelled';
      } else if (error.message) {
        description = error.message;
      }

      toast({
        title,
        description,
        variant: 'destructive',
      });
    },
  });

  const handleCancelOrder = (orderId: string, symbol?: string) => {
    const confirmMessage = symbol 
      ? `Are you sure you want to cancel the ${symbol} order?`
      : 'Are you sure you want to cancel this order?';
      
    if (confirm(confirmMessage)) {
      cancelOrderMutation.mutate({ orderId });
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const recentOrders = orders.orders || [];
  const openOrders = recentOrders.filter((order: any) => 
    ['pending', 'open', 'submitted'].includes(order.status?.toLowerCase())
  );
  const closedOrders = recentOrders.filter((order: any) => 
    !['pending', 'open', 'submitted'].includes(order.status?.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Order Status & Management
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {accountName} • Last 7 days
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Refresh Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {recentOrders.length} total orders ({openOrders.length} open)
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Open Orders */}
          {openOrders.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Open Orders ({openOrders.length})
              </h3>
              <div className="space-y-3">
                {openOrders.map((order: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1">{order.status}</span>
                        </Badge>
                        <span className="font-mono font-medium">
                          {order.symbol || order.ticker}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelOrder(
                          order.id || order.brokerage_order_id,
                          order.symbol || order.ticker
                        )}
                        disabled={cancelOrderMutation.isPending}
                        className="text-red-600 hover:text-red-800"
                      >
                        {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel'}
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Action:</span>
                        <span className="ml-2 font-medium">
                          {(order.side || order.action)?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                        <span className="ml-2 font-medium">{order.quantity || order.qty}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Price:</span>
                        <span className="ml-2 font-mono">{fmtMoney(order.price || order.limitPrice || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Placed:</span>
                        <span className="ml-2 text-xs">{formatTime(order.time || order.timestamp || order.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Order History */}
          {closedOrders.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Recent Order History
              </h3>
              <div className="space-y-2">
                {closedOrders.slice(0, 10).map((order: any, index: number) => (
                  <div key={index} className="border rounded p-3 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(order.status)} variant="secondary">
                          {getStatusIcon(order.status)}
                          <span className="ml-1">{order.status}</span>
                        </Badge>
                        <span className="font-mono text-sm font-medium">
                          {order.symbol || order.ticker}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {(order.side || order.action)?.toUpperCase()} {order.quantity || order.qty}
                        </span>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-mono">{fmtMoney(order.avgFillPrice || order.fillPrice || order.price || 0)}</div>
                        <div className="text-xs text-gray-500">{formatTime(order.time || order.timestamp || order.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Orders State */}
          {recentOrders.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Recent Orders
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Orders you place will appear here
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
            </div>
          )}
        </div>

        <div className="pt-4">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}