/**
 * Trading Ticket with symbol search, impact preview, and order placement
 * 2-step flow: impact → show preview/fees → place
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, TrendingUp, TrendingDown, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { SymbolInfo, ImpactRequest, ImpactResponse, PlaceOrderRequest } from '../../schemas/snaptrade';

interface TradingTicketProps {
  accountId?: string;
  prefilledSymbol?: string;
  onOrderPlaced?: () => void;
}

export function TradingTicket({ accountId, prefilledSymbol, onOrderPlaced }: TradingTicketProps) {
  const queryClient = useQueryClient();
  
  // Form state
  const [selectedAccount, setSelectedAccount] = useState(accountId || '');
  const [symbol, setSymbol] = useState(prefilledSymbol || '');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'>('MARKET');
  const [timeInForce, setTimeInForce] = useState<'DAY' | 'GTC' | 'FOK' | 'IOC'>('DAY');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [step, setStep] = useState<'form' | 'preview' | 'confirmation'>('form');
  const [impactData, setImpactData] = useState<ImpactResponse | null>(null);

  // Fetch accounts for selection
  const { data: accountsData } = useQuery({
    queryKey: ['/api/snaptrade/accounts']
  });

  // Symbol search
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: [`/api/snaptrade/symbols/search`, { q: searchQuery }],
    enabled: searchQuery.length >= 2
  });

  // Check order impact mutation
  const impactMutation = useMutation({
    mutationFn: async (request: ImpactRequest) => {
      return await apiRequest('/api/snaptrade/trades/impact', {
        method: 'POST',
        body: request
      });
    },
    onSuccess: (data: ImpactResponse) => {
      setImpactData(data);
      setStep('preview');
    }
  });

  // Place order mutation
  const placeMutation = useMutation({
    mutationFn: async (request: PlaceOrderRequest) => {
      return await apiRequest('/api/snaptrade/trades/place', {
        method: 'POST',
        body: request
      });
    },
    onSuccess: () => {
      setStep('confirmation');
      // Refetch orders and positions
      queryClient.invalidateQueries({ queryKey: [`/api/snaptrade/accounts/${selectedAccount}/orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/snaptrade/accounts/${selectedAccount}/positions`] });
      onOrderPlaced?.();
    }
  });

  const accounts = accountsData?.accounts || [];
  const symbols = searchResults?.results || [];

  function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  function handleSymbolSelect(symbolInfo: SymbolInfo) {
    setSymbol(symbolInfo.symbol);
    setSearchQuery('');
  }

  function handlePreviewOrder() {
    if (!selectedAccount || !symbol || !quantity) return;

    const request: ImpactRequest = {
      accountId: selectedAccount,
      symbol: symbol.toUpperCase(),
      side,
      type: orderType,
      timeInForce,
      quantity: parseFloat(quantity)
    };

    if (orderType === 'LIMIT' || orderType === 'STOP_LIMIT') {
      request.price = parseFloat(limitPrice);
    }
    if (orderType === 'STOP' || orderType === 'STOP_LIMIT') {
      request.stopPrice = parseFloat(stopPrice);
    }

    impactMutation.mutate(request);
  }

  function handlePlaceOrder() {
    if (!impactData?.impactId) return;
    
    placeMutation.mutate({ impactId: impactData.impactId });
  }

  function resetForm() {
    setStep('form');
    setImpactData(null);
    setSymbol(prefilledSymbol || '');
    setSide('BUY');
    setOrderType('MARKET');
    setQuantity('');
    setLimitPrice('');
    setStopPrice('');
  }

  function ErrorAlert({ error, title }: { error: any; title: string }) {
    if (!error) return null;
    
    const errorData = error?.response?.data?.error;
    const message = errorData?.message || error.message;

    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>{title}:</strong> {message}
        </AlertDescription>
      </Alert>
    );
  }

  if (step === 'confirmation') {
    return (
      <Card className="w-full max-w-md" data-testid="trading-confirmation">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Order Submitted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <div className="text-lg font-semibold">
              {side} {quantity} {symbol}
            </div>
            <div className="text-sm text-muted-foreground">
              Your {orderType.toLowerCase()} order has been submitted
            </div>
          </div>
          <Button onClick={resetForm} className="w-full" data-testid="button-place-another">
            Place Another Order
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'preview' && impactData) {
    return (
      <Card className="w-full max-w-md" data-testid="trading-preview">
        <CardHeader>
          <CardTitle>Order Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Symbol</span>
              <span className="font-semibold">{symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Side</span>
              <Badge variant={side === 'BUY' ? 'default' : 'secondary'}>{side}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Quantity</span>
              <span>{quantity} shares</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Order Type</span>
              <span>{orderType}</span>
            </div>
            {limitPrice && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Limit Price</span>
                <span>{formatCurrency(parseFloat(limitPrice))}</span>
              </div>
            )}
            {stopPrice && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Stop Price</span>
                <span>{formatCurrency(parseFloat(stopPrice))}</span>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Estimated Cost</span>
              <span className="font-semibold" data-testid="text-estimated-cost">
                {formatCurrency(impactData.estimatedCost?.amount, impactData.estimatedCost?.currency)}
              </span>
            </div>
            {impactData.estimatedCommissions && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Commissions</span>
                <span data-testid="text-commissions">
                  {formatCurrency(impactData.estimatedCommissions.amount, impactData.estimatedCommissions.currency)}
                </span>
              </div>
            )}
            {impactData.estimatedFees && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Fees</span>
                <span data-testid="text-fees">
                  {formatCurrency(impactData.estimatedFees.amount, impactData.estimatedFees.currency)}
                </span>
              </div>
            )}
            {impactData.buyingPowerReduction && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Buying Power Impact</span>
                <span data-testid="text-buying-power-impact">
                  {formatCurrency(impactData.buyingPowerReduction.amount, impactData.buyingPowerReduction.currency)}
                </span>
              </div>
            )}
          </div>

          {impactData.warnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Warnings:</div>
                <ul className="list-disc list-inside">
                  {impactData.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <ErrorAlert error={placeMutation.error} title="Order Placement Error" />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('form')}
              className="flex-1"
              data-testid="button-back"
            >
              Back
            </Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={!impactData.accepted || placeMutation.isPending}
              className="flex-1"
              data-testid="button-place-order"
            >
              {placeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Place Order
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md" data-testid="trading-ticket">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trading Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ErrorAlert error={impactMutation.error} title="Order Preview Error" />

        {/* Account Selection */}
        <div className="space-y-2">
          <Label htmlFor="account">Account</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger data-testid="select-account">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} · {account.institution}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Symbol Search */}
        <div className="space-y-2">
          <Label htmlFor="symbol">Symbol</Label>
          <div className="relative">
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g., AAPL)"
              data-testid="input-symbol"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchQuery(symbol)}
              data-testid="button-search-symbol"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Symbol Search Results */}
          {searchQuery && (
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbols..."
                data-testid="input-search"
              />
              {searchLoading && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {symbols.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {symbols.map((symbolInfo) => (
                    <button
                      key={symbolInfo.symbol}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50"
                      onClick={() => handleSymbolSelect(symbolInfo)}
                      data-testid={`option-symbol-${symbolInfo.symbol}`}
                    >
                      <div className="font-semibold">{symbolInfo.symbol}</div>
                      <div className="text-sm text-muted-foreground">{symbolInfo.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buy/Sell */}
        <div className="space-y-2">
          <Label>Side</Label>
          <RadioGroup value={side} onValueChange={(value: 'BUY' | 'SELL') => setSide(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="BUY" id="buy" data-testid="radio-buy" />
              <Label htmlFor="buy" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Buy
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="SELL" id="sell" data-testid="radio-sell" />
              <Label htmlFor="sell" className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Sell
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Order Type */}
        <div className="space-y-2">
          <Label htmlFor="orderType">Order Type</Label>
          <Select value={orderType} onValueChange={(value: any) => setOrderType(value)}>
            <SelectTrigger data-testid="select-order-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MARKET">Market</SelectItem>
              <SelectItem value="LIMIT">Limit</SelectItem>
              <SelectItem value="STOP">Stop</SelectItem>
              <SelectItem value="STOP_LIMIT">Stop Limit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Number of shares"
            min="1"
            step="1"
            data-testid="input-quantity"
          />
        </div>

        {/* Limit Price */}
        {(orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (
          <div className="space-y-2">
            <Label htmlFor="limitPrice">Limit Price</Label>
            <Input
              id="limitPrice"
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              data-testid="input-limit-price"
            />
          </div>
        )}

        {/* Stop Price */}
        {(orderType === 'STOP' || orderType === 'STOP_LIMIT') && (
          <div className="space-y-2">
            <Label htmlFor="stopPrice">Stop Price</Label>
            <Input
              id="stopPrice"
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              data-testid="input-stop-price"
            />
          </div>
        )}

        {/* Time in Force */}
        <div className="space-y-2">
          <Label htmlFor="timeInForce">Time in Force</Label>
          <Select value={timeInForce} onValueChange={(value: any) => setTimeInForce(value)}>
            <SelectTrigger data-testid="select-time-in-force">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAY">Day</SelectItem>
              <SelectItem value="GTC">Good Till Canceled</SelectItem>
              <SelectItem value="FOK">Fill or Kill</SelectItem>
              <SelectItem value="IOC">Immediate or Cancel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handlePreviewOrder}
          disabled={!selectedAccount || !symbol || !quantity || impactMutation.isPending}
          className="w-full"
          data-testid="button-preview-order"
        >
          {impactMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Preview Order
        </Button>
      </CardContent>
    </Card>
  );
}