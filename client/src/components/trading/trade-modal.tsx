import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  assetName: string;
  currentPrice: number;
  action: 'buy' | 'sell';
  assetType: 'stock' | 'crypto';
}

interface BrokerageAccount {
  id: string;
  name: string;
  brokerageName: string;
  number: string;
  cashBalance: number;
}

export default function TradeModal({
  isOpen,
  onClose,
  symbol,
  assetName,
  currentPrice,
  action,
  assetType
}: TradeModalProps) {
  const { toast } = useToast();
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [orderMode, setOrderMode] = useState<'shares' | 'dollars'>('shares');
  const [dollarAmount, setDollarAmount] = useState('');

  // Fetch connected brokerage accounts
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<BrokerageAccount[]>({
    queryKey: ['/api/snaptrade/accounts'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/snaptrade/accounts');
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isOpen,
  });

  // Calculate values based on mode
  const calculateOrderValue = () => {
    if (orderMode === 'shares') {
      const shares = parseFloat(quantity) || 0;
      const price = orderType === 'limit' ? parseFloat(limitPrice) || currentPrice : currentPrice;
      return shares * price;
    } else {
      return parseFloat(dollarAmount) || 0;
    }
  };

  const calculateShares = () => {
    if (orderMode === 'shares') {
      return parseFloat(quantity) || 0;
    } else {
      const amount = parseFloat(dollarAmount) || 0;
      const price = orderType === 'limit' ? parseFloat(limitPrice) || currentPrice : currentPrice;
      return amount / price;
    }
  };

  const orderValue = calculateOrderValue();
  const sharesCount = calculateShares();

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const endpoint = assetType === 'crypto' 
        ? '/api/snaptrade/orders/place-crypto' 
        : '/api/snaptrade/orders/place';

      const orderData = {
        accountId: selectedAccount,
        symbol: symbol,
        action: action.toUpperCase(),
        orderType: orderType,
        quantity: sharesCount,
        limitPrice: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        timeInForce: 'DAY',
      };

      const response = await apiRequest('POST', endpoint, orderData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to place order');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Placed Successfully",
        description: (
          <div className="space-y-1">
            <p>{action === 'buy' ? 'Bought' : 'Sold'} {sharesCount.toFixed(2)} shares of {symbol}</p>
            <p className="text-sm text-gray-400">Order ID: {data.orderId || 'N/A'}</p>
          </div>
        ),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/holdings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedAccount) {
      toast({
        title: "Select Account",
        description: "Please select a brokerage account",
        variant: "destructive",
      });
      return;
    }

    if ((orderMode === 'shares' && !quantity) || (orderMode === 'dollars' && !dollarAmount)) {
      toast({
        title: "Enter Amount",
        description: `Please enter ${orderMode === 'shares' ? 'quantity' : 'dollar amount'}`,
        variant: "destructive",
      });
      return;
    }

    if (orderType === 'limit' && !limitPrice) {
      toast({
        title: "Enter Limit Price",
        description: "Please enter a limit price for limit orders",
        variant: "destructive",
      });
      return;
    }

    placeOrderMutation.mutate();
  };

  const selectedAccountData = accounts.find(acc => acc.id === selectedAccount);
  const hasInsufficientFunds = action === 'buy' && selectedAccountData && orderValue > selectedAccountData.cashBalance;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {action === 'buy' ? (
              <TrendingUp className="h-5 w-5 text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
            <span>{action === 'buy' ? 'Buy' : 'Sell'} {assetName}</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Current Price: ${currentPrice.toFixed(2)} | {symbol}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label>Brokerage Account</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {accountsLoading ? (
                  <SelectItem value="loading" disabled>Loading accounts...</SelectItem>
                ) : accounts.length === 0 ? (
                  <SelectItem value="none" disabled>No connected accounts</SelectItem>
                ) : (
                  accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex justify-between items-center w-full">
                        <span>{account.name} ({account.brokerageName})</span>
                        <span className="text-sm text-gray-400 ml-2">
                          ${account.cashBalance.toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Order Type */}
          <div className="space-y-2">
            <Label>Order Type</Label>
            <Select value={orderType} onValueChange={(value: 'market' | 'limit') => setOrderType(value)}>
              <SelectTrigger className="bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="market">Market Order</SelectItem>
                <SelectItem value="limit">Limit Order</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Order Mode Tabs */}
          <Tabs value={orderMode} onValueChange={(value: 'shares' | 'dollars') => setOrderMode(value)}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="shares" className="data-[state=active]:bg-purple-600">
                By Shares
              </TabsTrigger>
              <TabsTrigger value="dollars" className="data-[state=active]:bg-purple-600">
                By Dollar Amount
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shares" className="space-y-4">
              <div className="space-y-2">
                <Label>Number of Shares</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="bg-gray-800 border-gray-700"
                  step="0.01"
                  min="0"
                />
              </div>
            </TabsContent>

            <TabsContent value="dollars" className="space-y-4">
              <div className="space-y-2">
                <Label>Dollar Amount</Label>
                <Input
                  type="number"
                  value={dollarAmount}
                  onChange={(e) => setDollarAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-gray-800 border-gray-700"
                  step="0.01"
                  min="0"
                />
                <p className="text-sm text-gray-400">
                  ≈ {sharesCount.toFixed(4)} shares at current price
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Limit Price (if limit order) */}
          {orderType === 'limit' && (
            <div className="space-y-2">
              <Label>Limit Price</Label>
              <Input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={currentPrice.toFixed(2)}
                className="bg-gray-800 border-gray-700"
                step="0.01"
                min="0"
              />
            </div>
          )}

          {/* Order Summary */}
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Order Type</span>
                <span className="capitalize">{orderType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Shares</span>
                <span>{sharesCount.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price per Share</span>
                <span>${orderType === 'limit' ? limitPrice || currentPrice : currentPrice}</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2">
                <span className="font-semibold">Estimated Total</span>
                <span className="font-semibold">${orderValue.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {hasInsufficientFunds && (
            <Alert className="bg-red-900/20 border-red-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insufficient funds. Available: ${selectedAccountData?.cashBalance.toLocaleString()}
              </AlertDescription>
            </Alert>
          )}

          {orderValue > 10000 && (
            <Alert className="bg-yellow-900/20 border-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Large order: ${orderValue.toLocaleString()}. Please review carefully.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-600 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={placeOrderMutation.isPending || hasInsufficientFunds || accounts.length === 0}
              className={`flex-1 ${
                action === 'buy'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {placeOrderMutation.isPending ? 'Processing...' : `${action === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}