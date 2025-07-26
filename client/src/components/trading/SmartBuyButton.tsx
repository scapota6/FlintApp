import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { BrokerageCompatibilityEngine, type Asset, type BrokerageInfo } from '@shared/brokerage-compatibility';
import { ShoppingCart, TrendingUp, AlertTriangle, CheckCircle, Building2 } from 'lucide-react';

interface SmartBuyButtonProps {
  asset: Asset;
  connectedBrokerages: string[]; // IDs of connected brokerages
  onBuy?: (asset: Asset, brokerage: BrokerageInfo, amount: number, orderType: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
}

const SmartBuyButton: React.FC<SmartBuyButtonProps> = ({
  asset,
  connectedBrokerages,
  onBuy,
  className = '',
  size = 'default',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBrokerage, setSelectedBrokerage] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [orderType, setOrderType] = useState<string>('market');
  const { toast } = useToast();

  // Get compatible brokerages for this asset
  const compatibilityResult = BrokerageCompatibilityEngine.checkAssetCompatibility(asset, connectedBrokerages);
  const compatibleBrokerages = compatibilityResult.compatibleBrokerages;
  const isCompatible = compatibilityResult.isCompatible;

  const handleBuy = () => {
    if (!selectedBrokerage || !amount) {
      toast({
        title: "Missing Information",
        description: "Please select a brokerage and enter an amount",
        variant: "destructive"
      });
      return;
    }

    const brokerage = compatibleBrokerages.find(b => b.id === selectedBrokerage);
    if (!brokerage) {
      toast({
        title: "Invalid Brokerage",
        description: "Selected brokerage not found",
        variant: "destructive"
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    onBuy?.(asset, brokerage, numAmount, orderType);
    
    toast({
      title: "Order Placed",
      description: `${orderType} order for ${amount} ${asset.symbol} placed via ${brokerage.displayName}`,
    });

    setIsOpen(false);
    setSelectedBrokerage('');
    setAmount('');
  };

  const getBuyButtonContent = () => {
    if (!isCompatible) {
      return (
        <>
          <AlertTriangle className="h-4 w-4 mr-2" />
          Connect Account
        </>
      );
    }
    return (
      <>
        <ShoppingCart className="h-4 w-4 mr-2" />
        Buy {asset.symbol}
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className={`${className} ${!isCompatible ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
          size={size}
          disabled={disabled}
        >
          {getBuyButtonContent()}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Buy {asset.name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {asset.symbol} • {asset.type.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Compatibility Status */}
          {isCompatible ? (
            <Alert className="bg-green-900/30 border-green-700">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="text-green-200">
                Compatible with {compatibleBrokerages.length} connected account{compatibleBrokerages.length !== 1 ? 's' : ''}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-orange-900/30 border-orange-700">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-orange-200">
                No connected accounts support {asset.symbol}. Connect a compatible brokerage to trade this asset.
              </AlertDescription>
            </Alert>
          )}

          {/* Compatible Brokerages List */}
          {compatibleBrokerages.length > 0 && (
            <div>
              <Label className="text-sm text-gray-400 mb-2 block">Compatible Accounts:</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {compatibleBrokerages.map(brokerage => (
                  <Badge key={brokerage.id} variant="secondary" className="bg-blue-900 text-blue-200">
                    <Building2 className="h-3 w-3 mr-1" />
                    {brokerage.displayName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Trading Form - Only show if compatible */}
          {isCompatible && (
            <>
              {/* Brokerage Selection */}
              <div>
                <Label htmlFor="brokerage" className="text-sm text-gray-400">Select Brokerage</Label>
                <Select value={selectedBrokerage} onValueChange={setSelectedBrokerage}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Choose your brokerage" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {compatibleBrokerages.map(brokerage => (
                      <SelectItem 
                        key={brokerage.id} 
                        value={brokerage.id}
                        className="text-white hover:bg-gray-700"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {brokerage.displayName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Input */}
              <div>
                <Label htmlFor="amount" className="text-sm text-gray-400">
                  Amount ({asset.type === 'crypto' ? asset.symbol : 'USD'})
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder={asset.type === 'crypto' ? "0.001" : "100"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  step={asset.type === 'crypto' ? "0.001" : "1"}
                  min="0"
                />
              </div>

              {/* Order Type */}
              <div>
                <Label htmlFor="orderType" className="text-sm text-gray-400">Order Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="market" className="text-white hover:bg-gray-700">
                      Market Order (Instant)
                    </SelectItem>
                    <SelectItem value="limit" className="text-white hover:bg-gray-700">
                      Limit Order
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Buy Button */}
              <Button 
                onClick={handleBuy}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!selectedBrokerage || !amount}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Place Order
              </Button>
            </>
          )}

          {/* No Compatible Accounts */}
          {!isCompatible && (
            <div className="text-center py-4">
              <Button 
                variant="outline" 
                className="border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                Connect Brokerage Account
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmartBuyButton;