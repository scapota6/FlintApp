import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateTradeId } from "@/lib/uuid";
import { useMarketData } from "@/hooks/useMarketData";
import { Loader2, AlertCircle, CheckCircle, DollarSign, Hash } from "lucide-react";

interface EnhancedTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
  defaultAction?: 'BUY' | 'SELL';
  accounts?: any[];
  currentPrice?: number;
}

export function EnhancedTradeModal({ 
  isOpen, 
  onClose, 
  symbol = '',
  defaultAction = 'BUY',
  accounts = [],
  currentPrice
}: EnhancedTradeModalProps) {
  const [formData, setFormData] = useState({
    symbol: symbol.toUpperCase(),
    action: defaultAction,
    quantity: '',
    dollarAmount: '',
    price: '',
    orderType: 'MARKET',
    accountId: '',
    isDollarMode: false, // Toggle between shares and dollar amount
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get real-time market data for the symbol
  const { data: marketData } = useMarketData(formData.symbol, !!formData.symbol);
  const livePrice = marketData?.price || currentPrice || 0;

  // Calculate shares from dollar amount
  const calculateShares = () => {
    if (formData.isDollarMode && formData.dollarAmount && livePrice > 0) {
      const shares = parseFloat(formData.dollarAmount) / livePrice;
      return Math.floor(shares * 100) / 100; // Round to 2 decimal places
    }
    return parseFloat(formData.quantity) || 0;
  };

  // Place order mutation with UUID tradeId generation
  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const tradeId = generateTradeId();
      
      console.log(`Placing order with tradeId: ${tradeId}`, orderData);
      
      return apiRequest("/api/orders", {
        method: "POST",
        body: {
          ...orderData,
          tradeId,
          quantity: calculateShares().toString(), // Always send calculated shares
        },
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Order Placed Successfully",
        description: `${variables.action} order for ${calculateShares()} shares of ${variables.symbol} has been placed.`,
        duration: 5000,
      });
      
      // Reset form
      setFormData({
        symbol: '',
        action: 'BUY',
        quantity: '',
        dollarAmount: '',
        price: '',
        orderType: 'MARKET',
        accountId: '',
        isDollarMode: false,
      });
      
      // Refresh related data
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      onClose();
    },
    onError: (error: any) => {
      console.error("Order placement failed:", error);
      
      let errorTitle = "Order Failed";
      let errorDescription = "Unable to place order. Please try again.";
      
      if (error.message?.includes('403')) {
        errorTitle = "Authentication Required";
        errorDescription = "Please reconnect your brokerage account and try again.";
      } else if (error.message?.includes('Insufficient funds')) {
        errorTitle = "Insufficient Funds";
        errorDescription = "You don't have enough buying power for this order.";
      } else if (error.message?.includes('Invalid symbol')) {
        errorTitle = "Invalid Symbol";
        errorDescription = "The stock symbol you entered is not valid.";
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 7000,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const shares = calculateShares();
    
    // Validation
    if (!formData.symbol || !formData.accountId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    if (formData.isDollarMode && (!formData.dollarAmount || parseFloat(formData.dollarAmount) <= 0)) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid dollar amount greater than 0.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.isDollarMode && (!formData.quantity || shares <= 0)) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }
    
    if (formData.orderType === 'LIMIT' && !formData.price) {
      toast({
        title: "Price Required",
        description: "Please enter a price for limit orders.",
        variant: "destructive",
      });
      return;
    }
    
    // Place the order
    placeOrderMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleInputMode = () => {
    setFormData(prev => ({
      ...prev,
      isDollarMode: !prev.isDollarMode,
      quantity: '',
      dollarAmount: '',
    }));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold flex items-center space-x-2">
            <span>{formData.action} {formData.symbol}</span>
            {livePrice > 0 && (
              <span className="text-green-400 text-lg">
                {formatPrice(livePrice)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol Input */}
          <div className="space-y-2">
            <Label htmlFor="symbol" className="text-white">Symbol</Label>
            <Input
              id="symbol"
              value={formData.symbol}
              onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="bg-gray-800 border-gray-600 text-white"
              required
            />
          </div>

          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account" className="text-white">Account</Label>
            <Select value={formData.accountId} onValueChange={(value) => handleInputChange('accountId', value)}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {Array.isArray(accounts) && accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id} className="text-white">
                    {account.accountName || account.institution_name} - {formatPrice(account.balance || 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Selection */}
          <div className="space-y-2">
            <Label htmlFor="action" className="text-white">Action</Label>
            <Select value={formData.action} onValueChange={(value) => handleInputChange('action', value)}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="BUY" className="text-white">Buy</SelectItem>
                <SelectItem value="SELL" className="text-white">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity/Dollar Amount Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-white">Order Size</Label>
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-gray-400" />
                <Switch
                  checked={formData.isDollarMode}
                  onCheckedChange={toggleInputMode}
                  className="data-[state=checked]:bg-green-600"
                />
                <DollarSign className="h-4 w-4 text-gray-400" />
              </div>
            </div>

            {formData.isDollarMode ? (
              <div className="space-y-2">
                <Label htmlFor="dollarAmount" className="text-white">Dollar Amount</Label>
                <Input
                  id="dollarAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.dollarAmount}
                  onChange={(e) => handleInputChange('dollarAmount', e.target.value)}
                  placeholder="1000.00"
                  className="bg-gray-800 border-gray-600 text-white"
                  required
                />
                {formData.dollarAmount && livePrice > 0 && (
                  <p className="text-sm text-gray-400">
                    ≈ {calculateShares()} shares at {formatPrice(livePrice)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-white">Quantity (Shares)</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  placeholder="10"
                  className="bg-gray-800 border-gray-600 text-white"
                  required
                />
                {formData.quantity && livePrice > 0 && (
                  <p className="text-sm text-gray-400">
                    ≈ {formatPrice(parseFloat(formData.quantity) * livePrice)} total
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Order Type */}
          <div className="space-y-2">
            <Label htmlFor="orderType" className="text-white">Order Type</Label>
            <Select value={formData.orderType} onValueChange={(value) => handleInputChange('orderType', value)}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="MARKET" className="text-white">Market</SelectItem>
                <SelectItem value="LIMIT" className="text-white">Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price Input (only for LIMIT orders) */}
          {formData.orderType === 'LIMIT' && (
            <div className="space-y-2">
              <Label htmlFor="price" className="text-white">Limit Price ($)</Label>
              <Input
                id="price"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder={livePrice > 0 ? livePrice.toFixed(2) : "215.00"}
                className="bg-gray-800 border-gray-600 text-white"
                required
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-600 text-white hover:bg-gray-800"
              disabled={placeOrderMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={`flex-1 ${
                formData.action === 'BUY' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              } text-white`}
              disabled={placeOrderMutation.isPending}
            >
              {placeOrderMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                <>
                  {formData.action === 'BUY' ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mr-2" />
                  )}
                  {formData.action} {formData.symbol}
                </>
              )}
            </Button>
          </div>
        </form>
        
        {/* Order Summary */}
        {formData.symbol && (formData.quantity || formData.dollarAmount) && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
            <h4 className="text-white font-medium mb-2">Order Summary</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <div>{formData.action} {calculateShares()} shares of {formData.symbol}</div>
              <div>Order Type: {formData.orderType}</div>
              {formData.orderType === 'LIMIT' && formData.price && (
                <div>Limit Price: {formatPrice(parseFloat(formData.price))}</div>
              )}
              {livePrice > 0 && (
                <div>
                  Current Price: {formatPrice(livePrice)} • 
                  Estimated Total: {formatPrice(calculateShares() * livePrice)}
                </div>
              )}
              <div className="pt-2 text-xs text-gray-400">
                Trade ID will be generated upon order placement
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}