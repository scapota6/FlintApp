
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
  currentPrice?: number;
  onTradeComplete?: () => void;
  presetAction?: 'BUY' | 'SELL' | null;
}

interface Account {
  id: string;
  name: string;
  balance: { total: { amount: number; currency: string } };
}

export function TradeModal({ isOpen, onClose, symbol = "", currentPrice = 0, onTradeComplete, presetAction = null }: TradeModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load accounts when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      // Reset form
      setQuantity("");
      setLimitPrice("");
      setError("");
      setSuccess("");
      // Set preset action if provided
      if (presetAction) {
        setAction(presetAction);
      }
    }
  }, [isOpen, presetAction]);

  const loadAccounts = async () => {
    try {
      const response = await apiRequest("GET", "/api/snaptrade/accounts");
      const data = await response.json();
      
      // Handle the response structure properly
      const accountsList = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(accountsList);
      
      if (accountsList.length > 0) {
        setSelectedAccount(accountsList[0].id);
      } else if (data.needsReconnect) {
        setError("Your brokerage connection has expired. Please reconnect from the dashboard.");
      } else {
        setError("No trading accounts found. Please connect a brokerage account first.");
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
      setError("Failed to load accounts");
    }
  };

  const calculateEstimatedTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const price = orderType === "LIMIT" ? parseFloat(limitPrice) || 0 : currentPrice;
    return qty * price;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !quantity || !symbol) {
      setError("Please fill in all required fields");
      return;
    }

    if (orderType === "LIMIT" && !limitPrice) {
      setError("Limit price is required for limit orders");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const orderData = {
        accountId: selectedAccount,
        symbol: symbol.toUpperCase(),
        action,
        quantity: parseInt(quantity),
        orderType,
        ...(orderType === "LIMIT" && { price: parseFloat(limitPrice) })
      };

      const response = await apiRequest("POST", "/api/orders", orderData);
      const result = await response.json();

      if (result.success) {
        setSuccess(`${action} order for ${quantity} shares of ${symbol} placed successfully!`);
        onTradeComplete?.();
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error(result.message || "Order failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to place order");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedAccountData = Array.isArray(accounts) ? accounts.find(acc => acc.id === selectedAccount) : undefined;
  const availableBalance = selectedAccountData?.balance?.total?.amount || 0;
  const estimatedTotal = calculateEstimatedTotal();
  const canAfford = action === "BUY" ? estimatedTotal <= availableBalance : true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            {action === "BUY" ? (
              <TrendingUp className="h-5 w-5 text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
            {action} {symbol.toUpperCase()}
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Current Price: ${currentPrice.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-200">
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-900/20 border-green-800 text-green-200">
            <AlertDescription className="text-green-200">{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="action" className="text-gray-200">Action</Label>
              <Select value={action} onValueChange={(value: "BUY" | "SELL") => setAction(value)}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="BUY" className="text-white hover:bg-gray-700">Buy</SelectItem>
                  <SelectItem value="SELL" className="text-white hover:bg-gray-700">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="orderType" className="text-gray-200">Order Type</Label>
              <Select value={orderType} onValueChange={(value: "MARKET" | "LIMIT") => setOrderType(value)}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="MARKET" className="text-white hover:bg-gray-700">Market</SelectItem>
                  <SelectItem value="LIMIT" className="text-white hover:bg-gray-700">Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="account" className="text-gray-200">Account</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id} className="text-white hover:bg-gray-700">
                    {account.name} - ${account.balance?.total?.amount?.toFixed(2) || '0.00'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity" className="text-gray-200">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Number of shares"
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                required
              />
            </div>

            {orderType === "LIMIT" && (
              <div>
                <Label htmlFor="limitPrice" className="text-gray-200">Limit Price</Label>
                <Input
                  id="limitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                  required
                />
              </div>
            )}
          </div>

          {quantity && (
            <div className="space-y-2 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex justify-between text-sm text-gray-200">
                <span>Estimated Total:</span>
                <span className="font-medium text-white">${estimatedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-200">
                <span>Available Balance:</span>
                <span className="text-white">${availableBalance.toFixed(2)}</span>
              </div>
              {!canAfford && action === "BUY" && (
                <Badge variant="destructive" className="w-full justify-center bg-red-900/20 border-red-800 text-red-200">
                  Insufficient funds
                </Badge>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !canAfford || success !== ""}
              className={action === "BUY" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action} {quantity ? `${quantity} shares` : 'Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TradeModal;
