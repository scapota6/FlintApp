/**
 * Orders List Component
 * Displays open and recent orders with cancel functionality
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  X, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface Order {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  filledQuantity?: number;
  orderType: string;
  limitPrice?: number;
  status: string;
  timeInForce?: string;
  placedAt?: string;
  updatedAt?: string;
  executionPrice?: number;
}

interface OrdersListProps {
  accountId?: string;
  onOrderCancelled?: () => void;
}

export default function OrdersList({ accountId, onOrderCancelled }: OrdersListProps) {
  const [selectedTab, setSelectedTab] = useState('open');
  
  // Fetch orders
  const { data: ordersData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/trade/orders', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const response = await fetch(`/api/trade/orders?accountId=${accountId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    enabled: !!accountId,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest('/api/trade/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId, accountId })
      });
    },
    onSuccess: () => {
      toast({
        title: 'Order Cancelled',
        description: 'Your order has been cancelled successfully'
      });
      
      // Refetch orders
      refetch();
      
      if (onOrderCancelled) {
        onOrderCancelled();
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Cancel Failed',
        description: error.message || 'Failed to cancel order',
        variant: 'destructive'
      });
    }
  });

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (['filled', 'executed'].includes(statusLower)) {
      return <Badge className="bg-green-600">{status}</Badge>;
    } else if (['cancelled', 'rejected', 'expired'].includes(statusLower)) {
      return <Badge variant="destructive">{status}</Badge>;
    } else if (['new', 'accepted', 'pending'].includes(statusLower)) {
      return <Badge className="bg-blue-600">{status}</Badge>;
    } else if (statusLower === 'partially_filled') {
      return <Badge className="bg-yellow-600">{status}</Badge>;
    }
    
    return <Badge variant="outline">{status}</Badge>;
  };

  // Get side icon
  const getSideIcon = (side: string) => {
    return side?.toLowerCase() === 'buy' 
      ? <TrendingUp className="h-4 w-4 text-green-500" />
      : <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (!accountId) {
    return (
      <Card className="border-gray-800">
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Select an account to view orders
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-gray-800">
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-gray-800">
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load orders. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const openOrders = ordersData?.open || [];
  const recentOrders = ordersData?.recent || [];

  return (
    <Card className="border-gray-800">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              {ordersData?.accountName || 'Account Orders'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="open">
              Open ({openOrders.length})
            </TabsTrigger>
            <TabsTrigger value="recent">
              Recent ({recentOrders.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="open" className="space-y-3">
            {openOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No open orders
              </div>
            ) : (
              openOrders.map((order: Order) => (
                <div key={order.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getSideIcon(order.side)}
                        <span className="font-semibold">{order.symbol}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.side} {order.quantity} shares
                        {order.orderType === 'limit' && order.limitPrice && (
                          <span> @ ${order.limitPrice}</span>
                        )}
                      </div>
                      {order.filledQuantity && order.filledQuantity > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Filled: {order.filledQuantity}/{order.quantity}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {formatDate(order.placedAt)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelOrderMutation.mutate(order.id)}
                      disabled={cancelOrderMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
          
          <TabsContent value="recent" className="space-y-3">
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent orders
              </div>
            ) : (
              recentOrders.map((order: Order) => (
                <div key={order.id} className="border rounded-lg p-3 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getSideIcon(order.side)}
                      <span className="font-semibold">{order.symbol}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.side} {order.quantity} shares
                      {order.executionPrice ? (
                        <span> @ ${order.executionPrice}</span>
                      ) : order.orderType === 'limit' && order.limitPrice ? (
                        <span> @ ${order.limitPrice}</span>
                      ) : null}
                    </div>
                    {order.filledQuantity && (
                      <div className="text-sm text-muted-foreground">
                        Filled: {order.filledQuantity}/{order.quantity}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {formatDate(order.updatedAt || order.placedAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}