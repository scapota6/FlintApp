import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const tradeSchema = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  orderType: z.enum(['market', 'limit']),
  quantity: z.string().min(1, 'Quantity is required').refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Quantity must be a positive number'
  ),
  limitPrice: z.string().optional(),
  timeInForce: z.enum(['day', 'gtc', 'ioc', 'fok']).default('day'),
}).refine(
  (data) => {
    if (data.orderType === 'limit') {
      return data.limitPrice && !isNaN(Number(data.limitPrice)) && Number(data.limitPrice) > 0;
    }
    return true;
  },
  {
    message: 'Limit price is required for limit orders',
    path: ['limitPrice'],
  }
);

type TradeFormData = z.infer<typeof tradeSchema>;

interface EnhancedTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  action: 'buy' | 'sell';
  currentPrice?: number;
}

export default function EnhancedTradeModal({
  isOpen,
  onClose,
  symbol,
  action,
  currentPrice = 0,
}: EnhancedTradeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');

  const form = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      accountId: '',
      orderType: 'market',
      quantity: '',
      limitPrice: '',
      timeInForce: 'day',
    },
  });

  // Fetch user's brokerage accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/accounts/brokerage'],
    enabled: isOpen,
  });

  // Fetch real-time quote
  const { data: quote } = useQuery({
    queryKey: [`/api/quotes/${symbol}`],
    enabled: isOpen && !!symbol,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const executeTrade = useMutation({
    mutationFn: async (data: TradeFormData) => {
      // First get preview with tradeId workflow
      const previewData = {
        accountId: data.accountId,
        symbol,
        side: action,
        quantity: parseFloat(data.quantity),
        type: data.orderType.toUpperCase(),
        limitPrice: data.orderType === 'limit' ? parseFloat(data.limitPrice || '0') : undefined,
        timeInForce: data.timeInForce.toUpperCase()
      };

      const previewResponse = await fetch('/api/trade/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(previewData)
      });

      const previewResult = await previewResponse.json();
      if (!previewResponse.ok) {
        throw new Error(previewResult.message || 'Preview failed');
      }

      // Place order using tradeId if available
      const orderData = previewResult.tradeId ? 
        { 
          accountId: data.accountId, 
          tradeId: previewResult.tradeId 
        } : 
        {
          accountId: data.accountId,
          symbol,
          side: action,
          quantity: parseFloat(data.quantity),
          type: data.orderType.toUpperCase(),
          limitPrice: data.orderType === 'limit' ? parseFloat(data.limitPrice || '0') : undefined,
          timeInForce: data.timeInForce.toUpperCase()
        };

      const response = await fetch('/api/trade/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Place failed');
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: 'Order Placed Successfully',
        description: `Your ${action} order for ${symbol} has been submitted.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/holdings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity'] });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Order Failed',
        description: error.message || 'Failed to place order. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: TradeFormData) => {
    executeTrade.mutate(data);
  };

  const estimatedTotal = () => {
    const quantity = parseFloat(form.watch('quantity') || '0');
    const price = orderType === 'limit' 
      ? parseFloat(form.watch('limitPrice') || '0')
      : (quote as any)?.price || currentPrice;
    return quantity * price;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'buy' ? (
              <>
                <TrendingUp className="h-5 w-5 text-green-500" />
                Buy {symbol}
              </>
            ) : (
              <>
                <TrendingDown className="h-5 w-5 text-red-500" />
                Sell {symbol}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Place a {action} order for {symbol}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Real-time Quote Card */}
          <Card className="p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Price</p>
                <p className="text-2xl font-bold">
                  {formatCurrency((quote as any)?.price || currentPrice)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Daily Change</p>
                <p className={`text-lg font-semibold ${
                  ((quote as any)?.change || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {(quote as any)?.changePercent ? `${(quote as any).changePercent.toFixed(2)}%` : '0.00%'}
                </p>
              </div>
            </div>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Account Selection */}
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brokerage Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accountsLoading ? (
                          <SelectItem value="loading" disabled>Loading accounts...</SelectItem>
                        ) : (accounts as any)?.brokerageAccounts?.length > 0 ? (
                          (accounts as any).brokerageAccounts.map((account: any) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.institutionName} - {account.accountNumber}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No accounts connected</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Order Type Tabs */}
              <Tabs value={orderType} onValueChange={(value) => {
                setOrderType(value as 'market' | 'limit');
                form.setValue('orderType', value as 'market' | 'limit');
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market">Market Order</TabsTrigger>
                  <TabsTrigger value="limit">Limit Order</TabsTrigger>
                </TabsList>

                <TabsContent value="market" className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Buy at the current market price
                  </div>
                </TabsContent>

                <TabsContent value="limit" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="limitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limit Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter limit price"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Order will execute at this price or better
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="Enter quantity"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time in Force */}
              <FormField
                control={form.control}
                name="timeInForce"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time in Force</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="gtc">Good Till Canceled</SelectItem>
                        <SelectItem value="ioc">Immediate or Cancel</SelectItem>
                        <SelectItem value="fok">Fill or Kill</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How long the order remains active
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estimated Total */}
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Total</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(estimatedTotal())}
                  </span>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={executeTrade.isPending}
                  className={`flex-1 ${
                    action === 'buy' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {executeTrade.isPending ? 'Placing Order...' : `${action === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}