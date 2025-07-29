import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useSnapTradeAccounts, usePlaceEquityOrder, usePlaceCryptoOrder, useSymbolSearch } from "@/hooks/useSnapTrade";
import { useQuery } from "@tanstack/react-query";
import { SnapTradeService, SnapTradeSymbol } from "@/services/snaptrade-service";
import { Loader2, DollarSign, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnhancedTradeModalProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  defaultAction?: 'buy' | 'sell';
}

export function EnhancedTradeModal({ symbol, isOpen, onClose, defaultAction = 'buy' }: EnhancedTradeModalProps) {
  const [action, setAction] = useState<'buy' | 'sell'>(defaultAction);
  const [orderType, setOrderType] = useState<'Market' | 'Limit'>('Market');
  const [amountType, setAmountType] = useState<'shares' | 'dollars'>('dollars');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedSymbolId, setSelectedSymbolId] = useState<string>('');
  const [isCrypto, setIsCrypto] = useState(false);
  const [orderPreview, setOrderPreview] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { toast } = useToast();
  const { data: accounts = [] } = useSnapTradeAccounts();
  const { data: marketData } = useQuery({
    queryKey: ['/api/quotes', [symbol]],
    retry: false
  });
  const { data: symbolResults = [] } = useSymbolSearch(symbol);
  const placeEquityOrder = usePlaceEquityOrder();
  const placeCryptoOrder = usePlaceCryptoOrder();

  const currentPrice = marketData?.[symbol]?.price || 0;
  const priceToUse = orderType === 'Limit' && limitPrice ? parseFloat(limitPrice) : currentPrice;

  // Auto-select first account and symbol on load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (symbolResults.length > 0 && !selectedSymbolId) {
      const exactMatch = symbolResults.find((s: SnapTradeSymbol) => 
        s.symbol.toUpperCase() === symbol.toUpperCase()
      );
      const firstResult = exactMatch || symbolResults[0];
      setSelectedSymbolId(firstResult.id);
      setIsCrypto(firstResult.type?.toLowerCase().includes('crypto') || firstResult.currency === 'BTC');
    }
  }, [symbolResults, selectedSymbolId, symbol]);

  // Calculate shares/dollars conversion
  const calculateConversion = () => {
    if (!amount || !priceToUse) return { shares: 0, dollars: 0 };
    
    if (amountType === 'dollars') {
      const dollars = parseFloat(amount);
      const shares = dollars / priceToUse;
      return { shares: Math.floor(shares * 10000) / 10000, dollars }; // Round to 4 decimals
    } else {
      const shares = parseFloat(amount);
      const dollars = shares * priceToUse;
      return { shares, dollars };
    }
  };

  const { shares, dollars } = calculateConversion();

  // Generate order preview
  useEffect(() => {
    if (shares > 0 && selectedAccountId && selectedSymbolId) {
      setIsLoadingPreview(true);
      
      const generatePreview = async () => {
        try {
          // For crypto vs equity different calculations
          const estimatedTotal = isCrypto ? dollars : shares * priceToUse;
          const estimatedFees = estimatedTotal * 0.001; // 0.1% estimated fee
          
          setOrderPreview({
            symbol,
            action: action.toUpperCase(),
            orderType,
            units: isCrypto ? dollars : shares,
            estimatedPrice: priceToUse,
            estimatedTotal,
            estimatedFees,
            netAmount: action === 'buy' ? estimatedTotal + estimatedFees : estimatedTotal - estimatedFees
          });
        } catch (error) {
          console.error('Error generating preview:', error);
        } finally {
          setIsLoadingPreview(false);
        }
      };

      const debounceTimer = setTimeout(generatePreview, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setOrderPreview(null);
    }
  }, [shares, dollars, selectedAccountId, selectedSymbolId, action, orderType, priceToUse, symbol, isCrypto]);

  const handleSubmit = async () => {
    if (!selectedAccountId || !selectedSymbolId || !amount) {
      toast({
        title: "Missing Information",
        description: "Please select an account and enter an amount",
        variant: "destructive"
      });
      return;
    }

    try {
      const orderParams = {
        accountId: selectedAccountId,
        symbolId: selectedSymbolId,
        units: isCrypto ? dollars : shares,
        orderType,
        timeInForce: 'Day' as const,
        ...(orderType === 'Limit' && { limitPrice: parseFloat(limitPrice) })
      };

      let result;
      if (isCrypto) {
        result = await placeCryptoOrder.mutateAsync(orderParams);
      } else {
        result = await placeEquityOrder.mutateAsync(orderParams);
      }

      toast({
        title: "Order Placed Successfully",
        description: `${action.toUpperCase()} order for ${symbol} placed with Trade ID: ${result.tradeId}`,
        variant: "default"
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive"
      });
    }
  };

  const isSubmitDisabled = !selectedAccountId || !selectedSymbolId || !amount || 
    placeEquityOrder.isPending || placeCryptoOrder.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-400" />
            Trade {symbol}
            {isCrypto && <Badge variant="outline" className="text-xs">CRYPTO</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Price Display */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Current Price</p>
                  <p className="text-2xl font-bold text-white">${currentPrice.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Market Data</p>
                  <Badge variant="outline" className="text-xs">
                    {marketData?.[symbol]?.source || 'Polygon.io'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Tabs */}
          <Tabs value={action} onValueChange={(value) => setAction(value as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="buy" className="data-[state=active]:bg-green-600">
                Buy {symbol}
              </TabsTrigger>
              <TabsTrigger value="sell" className="data-[state=active]:bg-red-600">
                Sell {symbol}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Account Selection */}
          <div className="space-y-2">
            <Label className="text-white">Brokerage Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name || account.institution_name} - ${account.balance?.total?.amount?.toLocaleString() || '0'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Symbol Selection (if multiple matches) */}
          {symbolResults.length > 1 && (
            <div className="space-y-2">
              <Label className="text-white">Symbol Variant</Label>
              <Select value={selectedSymbolId} onValueChange={setSelectedSymbolId}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {symbolResults.map((symbolResult: SnapTradeSymbol) => (
                    <SelectItem key={symbolResult.id} value={symbolResult.id}>
                      {symbolResult.symbol} - {symbolResult.description} ({symbolResult.exchange})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Order Type */}
            <div className="space-y-2">
              <Label className="text-white">Order Type</Label>
              <Select value={orderType} onValueChange={(value) => setOrderType(value as 'Market' | 'Limit')}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="Market">Market Order</SelectItem>
                  <SelectItem value="Limit">Limit Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Type Toggle */}
            <div className="space-y-2">
              <Label className="text-white">Amount Type</Label>
              <Select value={amountType} onValueChange={(value) => setAmountType(value as 'shares' | 'dollars')}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="dollars">Dollar Amount</SelectItem>
                  <SelectItem value="shares">{isCrypto ? 'Units' : 'Shares'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label className="text-white">
              {amountType === 'dollars' ? 'Dollar Amount' : (isCrypto ? 'Units' : 'Number of Shares')}
            </Label>
            <div className="relative">
              <Input
                type="number"
                placeholder={amountType === 'dollars' ? '1000.00' : '100'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white pl-8"
                step={amountType === 'dollars' ? '0.01' : '0.0001'}
              />
              <DollarSign className="absolute left-2 top-3 h-4 w-4 text-gray-400" />
            </div>
            {amount && (
              <p className="text-sm text-gray-400">
                ≈ {amountType === 'dollars' ? `${shares.toLocaleString()} ${isCrypto ? 'units' : 'shares'}` : `$${dollars.toLocaleString()}`}
              </p>
            )}
          </div>

          {/* Limit Price (if Limit order) */}
          {orderType === 'Limit' && (
            <div className="space-y-2">
              <Label className="text-white">Limit Price</Label>
              <Input
                type="number"
                placeholder={currentPrice.toFixed(2)}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
                step="0.01"
              />
            </div>
          )}

          {/* Order Preview */}
          {isLoadingPreview ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                <span className="ml-2 text-gray-400">Calculating order impact...</span>
              </CardContent>
            </Card>
          ) : orderPreview && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <h4 className="font-medium text-white">Order Preview</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Action:</span>
                    <span className="text-white">{orderPreview.action} {orderPreview.units.toLocaleString()} {isCrypto ? 'units' : 'shares'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimated Price:</span>
                    <span className="text-white">${orderPreview.estimatedPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimated Total:</span>
                    <span className="text-white">${orderPreview.estimatedTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimated Fees:</span>
                    <span className="text-white">${orderPreview.estimatedFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-600 pt-2">
                    <span className="text-gray-400">Net Amount:</span>
                    <span className="text-white font-medium">${orderPreview.netAmount.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Warning for Large Orders */}
          {dollars > 10000 && (
            <Card className="bg-yellow-900/20 border-yellow-700">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-400">Large Order Warning</h4>
                  <p className="text-sm text-yellow-300">
                    This is a large order (${dollars.toLocaleString()}). Please review carefully before submitting.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className={`flex-1 ${
                action === 'buy' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              } text-white`}
            >
              {(placeEquityOrder.isPending || placeCryptoOrder.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Placing Order...
                </>
              ) : (
                `${action === 'buy' ? 'Buy' : 'Sell'} ${symbol}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}