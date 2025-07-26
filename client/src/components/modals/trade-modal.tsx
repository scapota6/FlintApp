
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
}

interface Account {
  id: string;
  name: string;
  balance: { total: { amount: number; currency: string } };
}

export function TradeModal({ isOpen, onClose, symbol = "", currentPrice = 0, onTradeComplete }: TradeModalProps) {
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
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const response = await apiRequest("GET", "/api/snaptrade/accounts");
      const accountsData = await response.json();
      setAccounts(accountsData);
      if (accountsData.length > 0) {
        setSelectedAccount(accountsData[0].id);
      }
    } catch (err) {
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

  const selectedAccountData = accounts.find(acc => acc.id === selectedAccount);
  const availableBalance = selectedAccountData?.balance?.total?.amount || 0;
  const estimatedTotal = calculateEstimatedTotal();
  const canAfford = action === "BUY" ? estimatedTotal <= availableBalance : true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "BUY" ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            {action} {symbol.toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Current Price: ${currentPrice.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={action} onValueChange={(value: "BUY" | "SELL") => setAction(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">Buy</SelectItem>
                  <SelectItem value="SELL">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="orderType">Order Type</Label>
              <Select value={orderType} onValueChange={(value: "MARKET" | "LIMIT") => setOrderType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKET">Market</SelectItem>
                  <SelectItem value="LIMIT">Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="account">Account</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - ${account.balance?.total?.amount?.toFixed(2) || '0.00'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Number of shares"
                required
              />
            </div>

            {orderType === "LIMIT" && (
              <div>
                <Label htmlFor="limitPrice">Limit Price</Label>
                <Input
                  id="limitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            )}
          </div>

          {quantity && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Estimated Total:</span>
                <span className="font-medium">${estimatedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Available Balance:</span>
                <span>${availableBalance.toFixed(2)}</span>
              </div>
              {!canAfford && action === "BUY" && (
                <Badge variant="destructive" className="w-full justify-center">
                  Insufficient funds
                </Badge>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !canAfford || success !== ""}
              className={action === "BUY" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
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
