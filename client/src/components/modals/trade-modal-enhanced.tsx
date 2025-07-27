import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateTradeId } from "@/lib/uuid";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
  defaultAction?: 'BUY' | 'SELL';
  accounts?: any[];
}

export function TradeModalEnhanced({ 
  isOpen, 
  onClose, 
  symbol = '',
  defaultAction = 'BUY',
  accounts = []
}: TradeModalProps) {
  const [formData, setFormData] = useState({
    symbol: symbol.toUpperCase(),
    action: defaultAction,
    quantity: '',
    price: '',
    orderType: 'MARKET',
    accountId: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Place order mutation with comprehensive error handling
  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      // Generate UUID tradeId for this order
      const tradeId = generateTradeId();
      
      console.log(`Placing order with tradeId: ${tradeId}`, orderData);
      
      return apiRequest("/api/orders", {
        method: "POST",
        body: {
          ...orderData,
          tradeId, // Include UUID in request
        },
      });
    },
    onSuccess: (data, variables) => {
      // Success toast notification
      toast({
        title: "Order Placed Successfully",
        description: `${variables.action} order for ${variables.quantity} shares of ${variables.symbol} has been placed.`,
        duration: 5000,
      });
      
      // Clear form and close modal
      setFormData({
        symbol: '',
        action: 'BUY',
        quantity: '',
        price: '',
        orderType: 'MARKET',
        accountId: ''
      });
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      onClose();
    },
    onError: (error: any) => {
      console.error("Order placement failed:", error);
      
      // Handle specific error types
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
      
      // Error toast notification
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
    
    // Validate form data
    if (!formData.symbol || !formData.quantity || !formData.accountId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
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
    
    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity greater than 0.",
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">
            {formData.action} {formData.symbol}
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
                    {account.accountName || account.institution_name} - ${account.balance?.toFixed(2) || '0.00'}
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

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-white">Quantity</Label>
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
              <Label htmlFor="price" className="text-white">Price ($)</Label>
              <Input
                id="price"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder="215.00"
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
        {formData.symbol && formData.quantity && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
            <h4 className="text-white font-medium mb-2">Order Summary</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <div>{formData.action} {formData.quantity} shares of {formData.symbol}</div>
              <div>Order Type: {formData.orderType}</div>
              {formData.orderType === 'LIMIT' && formData.price && (
                <div>Limit Price: ${parseFloat(formData.price).toFixed(2)}</div>
              )}
              {formData.orderType === 'MARKET' && formData.quantity && (
                <div>Estimated Value: ~${(parseFloat(formData.quantity) * 215).toFixed(2)}</div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}