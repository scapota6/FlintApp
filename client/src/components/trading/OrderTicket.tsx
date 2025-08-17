/**
 * Order Ticket Component
 * Allows users to place buy/sell orders through connected brokerages
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Info,
  Lock,
  Calculator,
  DollarSign
} from 'lucide-react';

interface OrderTicketProps {
  symbol: string;
  currentPrice?: number;
  onOrderPlaced?: () => void;
}

interface BrokerageAccount {
  id: string;
  accountName: string;
  provider: string;
  balance: string;
  externalAccountId: string;
}

interface OrderPreview {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit';
  limitPrice?: number;
  estimatedPrice: number;
  estimatedValue: number;
  commission: number;
  totalCost: number;
  buyingPower?: number;
  account: {
    id: string;
    name: string;
    provider: string;
  };
}

export default function OrderTicket({ symbol, currentPrice = 0, onOrderPlaced }: OrderTicketProps) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [quantity, setQuantity] = useState<string>('1');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [timeInForce, setTimeInForce] = useState<'day' | 'gtc'>('day');
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Fetch connected brokerage accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery<BrokerageAccount[]>({
    queryKey: ['/api/accounts'],
    select: (data: any) => data.brokerages || []
  });

  // Set default account when loaded
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Set limit price to current price when switching to limit order
  useEffect(() => {
    if (orderType === 'limit' && currentPrice && !limitPrice) {
      setLimitPrice(currentPrice.toFixed(2));
    }
  }, [orderType, currentPrice, limitPrice]);

  // Preview order mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId || !quantity || parseFloat(quantity) <= 0) {
        throw new Error('Invalid order parameters');
      }

      const orderData = {
        accountId: selectedAccountId,
        symbol,
        side,
        quantity: parseFloat(quantity),
        orderType,
        limitPrice: orderType === 'limit' ? parseFloat(limitPrice) : undefined
      };

      return apiRequest('/api/trade/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
    },
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (error: any) => {
      toast({
        title: 'Preview Failed',
        description: error.message || 'Failed to preview order',
        variant: 'destructive'
      });
    }
  });

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId || !quantity || parseFloat(quantity) <= 0) {
        throw new Error('Invalid order parameters');
      }

      const orderData = {
        accountId: selectedAccountId,
        symbol,
        side,
        type: orderType,
        qty: parseFloat(quantity),
        limitPrice: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        timeInForce
      };

      return apiRequest('/api/trade/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Order Placed',
        description: `${side === 'buy' ? 'Buy' : 'Sell'} order for ${quantity} shares of ${symbol} placed successfully`
      });
      
      // Reset form
      setQuantity('1');
      setLimitPrice('');
      setPreview(null);
      
      // Invalidate orders query
      queryClient.invalidateQueries({ queryKey: ['/api/trade/orders'] });
      
      if (onOrderPlaced) {
        onOrderPlaced();
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Order Failed',
        description: error.message || 'Failed to place order',
        variant: 'destructive'
      });
    }
  });

  // Calculate estimated cost
  const calculateEstimatedCost = () => {
    const qty = parseFloat(quantity) || 0;
    const price = orderType === 'limit' ? parseFloat(limitPrice) : currentPrice;
    return qty * price;
  };

  // Handle preview
  const handlePreview = async () => {
    setIsPreviewLoading(true);
    await previewMutation.mutateAsync();
    setIsPreviewLoading(false);
  };

  // Handle place order
  const handlePlaceOrder = async () => {
    if (!preview) {
      await handlePreview();
    }
    placeOrderMutation.mutate();
  };

  // Check if trading is available
  const isTradingAvailable = accounts && accounts.length > 0;

  if (!isTradingAvailable) {
    return (
      <Card className="border-gray-800">
        <CardHeader>
          <CardTitle>Order Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Connect a brokerage account to start trading
            </AlertDescription>
          </Alert>
          <Button className="w-full mt-4" onClick={() => window.location.href = '/connections'}>
            Connect Brokerage
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-800">
      <CardHeader>
        <CardTitle>Order Ticket</CardTitle>
        <CardDescription>
          Place orders for {symbol}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Selector */}
        <div className="space-y-2">
          <Label>Account</Label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {accounts?.map((account) => {
                const balance = account.balance ? parseFloat(account.balance) : 0;
                const formattedBalance = !isNaN(balance) ? balance.toLocaleString() : '0';
                
                return (
                  <SelectItem 
                    key={account.id} 
                    value={account.id}
                    className="hover:bg-gray-800 focus:bg-gray-800"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-white">{account.accountName}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        ${formattedBalance}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Buy/Sell Toggle */}
        <div className="space-y-2">
          <Label>Side</Label>
          <Tabs value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" className="data-[state=active]:bg-green-600">
                <TrendingUp className="h-4 w-4 mr-2" />
                Buy
              </TabsTrigger>
              <TabsTrigger value="sell" className="data-[state=active]:bg-red-600">
                <TrendingDown className="h-4 w-4 mr-2" />
                Sell
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Order Type */}
        <div className="space-y-2">
          <Label>Order Type</Label>
          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market</TabsTrigger>
              <TabsTrigger value="limit">Limit</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <Label>Quantity</Label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="0.001"
            step="1"
            placeholder="0"
          />
        </div>

        {/* Limit Price (if limit order) */}
        {orderType === 'limit' && (
          <div className="space-y-2">
            <Label>Limit Price</Label>
            <Input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              min="0.01"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        )}

        {/* Time in Force */}
        <div className="space-y-2">
          <Label>Time in Force</Label>
          <Select value={timeInForce} onValueChange={(v) => setTimeInForce(v as 'day' | 'gtc')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="gtc">Good Till Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Estimated Cost */}
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span>Estimated {side === 'buy' ? 'Cost' : 'Proceeds'}</span>
            <span className="font-semibold">
              ${calculateEstimatedCost().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {preview && (
            <>
              <div className="flex justify-between text-sm">
                <span>Commission</span>
                <span>${preview.commission.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>${preview.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
        </div>

        {/* Warning for market orders */}
        {orderType === 'market' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Market orders execute immediately at the best available price
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            className="w-full"
            variant="outline"
            onClick={handlePreview}
            disabled={!selectedAccountId || !quantity || isPreviewLoading || previewMutation.isPending}
          >
            <Calculator className="h-4 w-4 mr-2" />
            Preview Order
          </Button>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={`w-full ${side === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                  onClick={handlePlaceOrder}
                  disabled={
                    !selectedAccountId || 
                    !quantity || 
                    (orderType === 'limit' && !limitPrice) ||
                    placeOrderMutation.isPending
                  }
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {placeOrderMutation.isPending ? 'Placing...' : `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`}
                </Button>
              </TooltipTrigger>
              {(!selectedAccountId || !quantity) && (
                <TooltipContent>
                  <p>Enter quantity and select account</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}