import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FinancialAPI } from "@/lib/financial-api";
import { isUnauthorizedError } from "@/lib/authUtils";

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
}

export default function TradeModal({ isOpen, onClose, asset }: TradeModalProps) {
  const [side, setSide] = useState('buy');
  const [quantity, setQuantity] = useState('');
  const [orderType, setOrderType] = useState('market');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tradeMutation = useMutation({
    mutationFn: async (tradeData: any) => {
      return FinancialAPI.executeTrade(tradeData);
    },
    onSuccess: () => {
      toast({
        title: "Trade Executed",
        description: `${side === 'buy' ? 'Bought' : 'Sold'} ${quantity} ${asset?.symbol}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      onClose();
      setQuantity('');
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }
      toast({
        title: "Trade Failed",
        description: "Unable to execute trade. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quantity || parseFloat(quantity) <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    tradeMutation.mutate({
      accountId: 1, // Default account - in real app, user would select
      symbol: asset.symbol,
      assetType: asset.symbol.length <= 4 ? 'stock' : 'crypto',
      side,
      quantity: parseFloat(quantity),
      price: asset.price,
      totalAmount: parseFloat(quantity) * asset.price,
      orderType,
    });
  };

  const estimatedCost = quantity ? parseFloat(quantity) * (asset?.price || 0) : 0;

  if (!asset) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Trade {asset.symbol}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`w-12 h-12 ${asset.color} rounded-full flex items-center justify-center`}>
              <span className="text-white text-lg font-bold">{asset.letter}</span>
            </div>
            <div>
              <p className="text-white font-medium text-lg">{asset.symbol}</p>
              <p className="text-gray-400">{asset.name}</p>
              <p className="text-white font-semibold">
                ${asset.price.toFixed(2)}{' '}
                <span className={`text-sm ${asset.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {asset.change >= 0 ? '+' : ''}{asset.change}%
                </span>
              </p>
            </div>
          </div>
          
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                side === 'buy' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                side === 'sell' 
                  ? 'bg-red-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sell
            </button>
          </div>
          
          <div>
            <Label htmlFor="quantity" className="text-gray-300 text-sm font-medium">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              placeholder="Number of shares"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="orderType" className="text-gray-300 text-sm font-medium">
              Order Type
            </Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="market">Market Order</SelectItem>
                <SelectItem value="limit">Limit Order</SelectItem>
                <SelectItem value="stop">Stop Loss</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Estimated Cost</span>
              <span className="text-white font-medium">
                ${estimatedCost.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Available Cash</span>
              <span className="text-white font-medium">$12,847.32</span>
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={tradeMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
          >
            {tradeMutation.isPending ? 'Processing...' : `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
