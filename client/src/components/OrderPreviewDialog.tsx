import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, DollarSign, Info, Clock, TrendingUp } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface OrderPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  cashBalance?: number;
}

interface OrderPreview {
  symbol: string;
  symbolName: string;
  action: 'BUY' | 'SELL';
  orderType: 'Market' | 'Limit';
  quantity: number;
  limitPrice?: number;
  timeInForce: 'Day' | 'GTC' | 'IOC' | 'FOK';
  currentPrice: number;
  executionPrice: number;
  estimatedCost: number;
  estimatedFees: number;
  estimatedTotal: number;
  currency: string;
  buyingPowerRequired?: number;
  buyingPowerAfter?: number;
  universalSymbolId: string;
  previewId: string;
  warnings: string[];
  canProceed: boolean;
}

const fmtMoney = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
}).format(amount);

const fmtNum = (num: number, decimals = 2) => num.toFixed(decimals);

export default function OrderPreviewDialog({ 
  isOpen, 
  onClose, 
  accountId, 
  accountName, 
  cashBalance = 0 
}: OrderPreviewDialogProps) {
  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');
  const [symbol, setSymbol] = useState('');
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'Market' | 'Limit'>('Market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [timeInForce, setTimeInForce] = useState<'Day' | 'GTC' | 'IOC' | 'FOK'>('Day');
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate order preview
  const previewMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest('/api/order-preview', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),
    onSuccess: (data: any) => {
      if (data.success && data.preview) {
        setPreview(data.preview);
        setStep('preview');
      } else {
        toast({
          title: 'Preview Failed',
          description: data.message || 'Unable to generate order preview',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Preview Error',
        description: error.message || 'Failed to generate order preview',
        variant: 'destructive',
      });
    },
  });

  // Confirm and place order
  const confirmMutation = useMutation({
    mutationFn: (confirmData: any) => apiRequest('/api/order-preview/confirm', {
      method: 'POST',
      body: JSON.stringify(confirmData),
    }),
    onSuccess: (data: any) => {
      if (data.success) {
        setPlacedOrder(data);
        setStep('success');
        queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
        toast({
          title: 'Order Placed',
          description: `${data.action} order for ${data.quantity} shares of ${data.symbol} placed successfully`,
        });
      } else {
        toast({
          title: 'Order Failed',
          description: data.message || 'Failed to place order',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Order Error',
        description: error.message || 'Failed to place order',
        variant: 'destructive',
      });
    },
  });

  const handlePreview = () => {
    if (!symbol || !quantity) {
      toast({
        title: 'Missing Information',
        description: 'Please enter symbol and quantity',
        variant: 'destructive',
      });
      return;
    }

    const orderData = {
      accountId,
      symbol: symbol.toUpperCase(),
      action,
      orderType,
      quantity: parseFloat(quantity),
      limitPrice: orderType === 'Limit' ? parseFloat(limitPrice) : undefined,
      timeInForce,
    };

    previewMutation.mutate(orderData);
  };

  const handleConfirm = () => {
    if (!preview) return;

    const confirmData = {
      accountId,
      symbol: preview.symbol,
      action: preview.action,
      orderType: preview.orderType,
      quantity: preview.quantity,
      limitPrice: preview.limitPrice,
      timeInForce: preview.timeInForce,
      universalSymbolId: preview.universalSymbolId,
      previewData: {
        estimatedCost: preview.estimatedCost,
        estimatedFees: preview.estimatedFees,
        estimatedTotal: preview.estimatedTotal,
        impactPrice: preview.currentPrice,
        previewId: preview.previewId,
      },
    };

    confirmMutation.mutate(confirmData);
  };

  const handleClose = () => {
    setStep('form');
    setSymbol('');
    setQuantity('');
    setLimitPrice('');
    setPreview(null);
    setPlacedOrder(null);
    onClose();
  };

  const renderForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="symbol">Symbol</Label>
          <Input
            id="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="action">Action</Label>
          <Select value={action} onValueChange={(value: 'BUY' | 'SELL') => setAction(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUY">Buy</SelectItem>
              <SelectItem value="SELL">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="orderType">Order Type</Label>
          <Select value={orderType} onValueChange={(value: 'Market' | 'Limit') => setOrderType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Market">Market</SelectItem>
              <SelectItem value="Limit">Limit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="100"
            min="1"
            step="1"
          />
        </div>
      </div>

      {orderType === 'Limit' && (
        <div className="space-y-2">
          <Label htmlFor="limitPrice">Limit Price</Label>
          <Input
            id="limitPrice"
            type="number"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder="0.00"
            min="0.01"
            step="0.01"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="timeInForce">Time in Force</Label>
        <Select value={timeInForce} onValueChange={(value: any) => setTimeInForce(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Day">Day</SelectItem>
            <SelectItem value="GTC">Good Till Canceled</SelectItem>
            <SelectItem value="IOC">Immediate or Cancel</SelectItem>
            <SelectItem value="FOK">Fill or Kill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pt-4">
        <Button 
          onClick={handlePreview} 
          className="w-full"
          disabled={previewMutation.isPending || !symbol || !quantity}
        >
          {previewMutation.isPending ? 'Generating Preview...' : 'Preview Order'}
        </Button>
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!preview) return null;

    return (
      <div className="space-y-6">
        {/* Order Summary */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Order Summary</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Symbol:</span>
              <span className="ml-2 font-mono font-medium">{preview.symbol}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Action:</span>
              <Badge variant={preview.action === 'BUY' ? 'default' : 'secondary'} className="ml-2">
                {preview.action}
              </Badge>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="ml-2 font-medium">{preview.orderType}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
              <span className="ml-2 font-medium">{fmtNum(preview.quantity, 0)}</span>
            </div>
          </div>
        </div>

        {/* Price Information */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Price Information</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Current Price:</span>
              <span className="ml-2 font-mono font-medium">{fmtMoney(preview.currentPrice)}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Execution Price:</span>
              <span className="ml-2 font-mono font-medium">{fmtMoney(preview.executionPrice)}</span>
            </div>
            {preview.limitPrice && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Limit Price:</span>
                <span className="ml-2 font-mono font-medium">{fmtMoney(preview.limitPrice)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cost Breakdown</h3>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Estimated Cost:</span>
              <span className="font-mono font-medium">{fmtMoney(preview.estimatedCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Estimated Fees:</span>
              <span className="font-mono font-medium">{fmtMoney(preview.estimatedFees)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total {preview.action === 'BUY' ? 'Required' : 'Proceeds'}:</span>
              <span className="font-mono">{fmtMoney(preview.estimatedTotal)}</span>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {preview.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Cash Balance Check */}
        {preview.action === 'BUY' && cashBalance > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Available Cash:</span>
              <span className="font-mono font-medium">{fmtMoney(cashBalance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">After Order:</span>
              <span className={`font-mono font-medium ${
                cashBalance - preview.estimatedTotal >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {fmtMoney(cashBalance - preview.estimatedTotal)}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={() => setStep('form')}
            className="flex-1"
          >
            Back to Edit
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!preview.canProceed || confirmMutation.isPending}
            className="flex-1"
          >
            {confirmMutation.isPending ? 'Placing Order...' : 'Confirm & Place Order'}
          </Button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    if (!placedOrder) return null;

    return (
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Order Placed Successfully!
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {placedOrder.message}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border text-left">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Order ID:</span>
              <span className="font-mono font-medium">{placedOrder.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <Badge variant="default">{placedOrder.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Estimated Total:</span>
              <span className="font-mono font-medium">{fmtMoney(placedOrder.estimatedTotal)}</span>
            </div>
            {placedOrder.idempotencyKey && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Idempotency Key:</span>
                <span className="font-mono text-xs text-gray-500">{placedOrder.idempotencyKey.slice(-8)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Placed At:</span>
              <span className="text-xs">{new Date(placedOrder.placedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <Button onClick={handleClose} className="w-full">
          Close
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {step === 'form' && 'Place Order'}
            {step === 'preview' && 'Order Preview'}
            {step === 'success' && 'Order Confirmation'}
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {accountName} • Account {String(accountId).slice(-6)}
          </p>
        </DialogHeader>

        {step === 'form' && renderForm()}
        {step === 'preview' && renderPreview()}
        {step === 'success' && renderSuccess()}
      </DialogContent>
    </Dialog>
  );
}