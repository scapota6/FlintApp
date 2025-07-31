import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Building, CreditCard, Wallet, X, DollarSign, Clock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: any[];
}

interface DepositFormData {
  toAccount: string;
  amount: string;
  method: 'ach' | 'wire' | 'stripe';
  description: string;
}

export function DepositModal({ isOpen, onClose, accounts = [] }: DepositModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<DepositFormData>({
    toAccount: '',
    amount: '',
    method: 'ach',
    description: 'Account deposit'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only use real accounts - no mock data
  const availableAccounts = accounts || [];

  const depositMethods = [
    {
      id: 'ach',
      name: 'ACH Transfer',
      description: 'Free • 1-3 business days',
      icon: <Building className="h-5 w-5" />,
      fee: 0,
      time: '1-3 days'
    },
    {
      id: 'wire',
      name: 'Wire Transfer',
      description: '$15 fee • Same day',
      icon: <Clock className="h-5 w-5" />,
      fee: 15,
      time: 'Same day'
    },
    {
      id: 'stripe',
      name: 'Debit/Credit Card',
      description: '2.9% + $0.30 • Instant',
      icon: <CreditCard className="h-5 w-5" />,
      fee: 'percent',
      time: 'Instant'
    }
  ];

  const getAccountIcon = (type: string, provider: string) => {
    if (provider === 'snaptrade' || type === 'investment') {
      return <Wallet className="h-4 w-4" />;
    }
    if (type === 'checking' || type === 'savings') {
      return <Building className="h-4 w-4" />;
    }
    return <DollarSign className="h-4 w-4" />;
  };

  const getAccountColor = (type: string, provider: string) => {
    if (provider === 'snaptrade' || type === 'investment') return 'bg-purple-600';
    if (type === 'checking') return 'bg-blue-600';
    if (type === 'savings') return 'bg-green-600';
    return 'bg-gray-600';
  };

  const handleInputChange = (field: keyof DepositFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateFee = () => {
    const amount = parseFloat(formData.amount || '0');
    if (formData.method === 'stripe') {
      return amount * 0.029 + 0.30;
    }
    if (formData.method === 'wire') {
      return 15;
    }
    return 0;
  };

  const getTotalAmount = () => {
    const amount = parseFloat(formData.amount || '0');
    const fee = calculateFee();
    return amount + fee;
  };

  const validateDeposit = () => {
    if (!formData.toAccount) {
      toast({
        title: "Missing Account",
        description: "Please select a deposit account",
        variant: "destructive",
      });
      return false;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return false;
    }

    if (amount < 1) {
      toast({
        title: "Minimum Amount",
        description: "Minimum deposit amount is $1.00",
        variant: "destructive",
      });
      return false;
    }

    if (amount > 50000) {
      toast({
        title: "Maximum Amount",
        description: "Maximum single deposit is $50,000",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateDeposit()) return;

    setIsSubmitting(true);
    try {
      const selectedAccount = availableAccounts.find(acc => acc.id === formData.toAccount);
      const depositData = {
        accountId: formData.toAccount,
        accountName: selectedAccount?.name,
        amount: parseFloat(formData.amount),
        method: formData.method,
        description: formData.description,
        fee: calculateFee(),
        totalAmount: getTotalAmount()
      };

      console.log('Submitting deposit:', depositData);

      if (formData.method === 'stripe') {
        // Redirect to Stripe payment processing
        const response = await apiRequest('POST', '/api/deposits/stripe', {
          body: depositData
        });

        if (response.success && response.checkoutUrl) {
          window.location.href = response.checkoutUrl;
          return;
        }
      } else {
        // Process ACH or wire transfer
        const response = await apiRequest('POST', '/api/deposits', {
          body: depositData
        });

        if (response.success) {
          toast({
            title: "Deposit Initiated",
            description: `$${formData.amount} deposit to ${selectedAccount?.name} via ${depositMethods.find(m => m.id === formData.method)?.name}`,
          });

          // Reset form and close modal
          setFormData({
            toAccount: '',
            amount: '',
            method: 'ach',
            description: 'Account deposit'
          });
          onClose();
        } else {
          throw new Error(response.message || 'Deposit failed');
        }
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      toast({
        title: "Deposit Failed",
        description: error.message || "Failed to process deposit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMethod = depositMethods.find(m => m.id === formData.method);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-gray-900 border-gray-700">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              Deposit Funds
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Deposit Account */}
          <div className="space-y-2">
            <Label className="text-white">Deposit To Account</Label>
            <Select value={formData.toAccount} onValueChange={(value) => handleInputChange('toAccount', value)}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select deposit account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {availableAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id} className="text-white hover:bg-gray-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 ${getAccountColor(account.type, account.provider)} rounded-full flex items-center justify-center`}>
                        {getAccountIcon(account.type, account.provider)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-gray-400">
                          Current: ${account.balance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-white">Deposit Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
              <Input
                type="number"
                step="0.01"
                min="1"
                max="50000"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                className="bg-gray-800 border-gray-600 text-white pl-8"
              />
            </div>
            <div className="text-sm text-gray-400">
              Minimum: $1.00 • Maximum: $50,000
            </div>
          </div>

          {/* Deposit Method */}
          <div className="space-y-3">
            <Label className="text-white">Deposit Method</Label>
            <div className="grid gap-3">
              {depositMethods.map((method) => (
                <Card 
                  key={method.id}
                  className={`cursor-pointer transition-all ${
                    formData.method === method.id 
                      ? 'border-purple-500 bg-purple-900/20' 
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                  }`}
                  onClick={() => handleInputChange('method', method.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        formData.method === method.id ? 'bg-purple-600' : 'bg-gray-600'
                      }`}>
                        {method.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{method.name}</div>
                        <div className="text-sm text-gray-400">{method.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white">{method.time}</div>
                        {formData.method === method.id && (
                          <div className="w-2 h-2 bg-purple-500 rounded-full ml-auto"></div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Fee Summary */}
          {formData.amount && selectedMethod && (
            <div className="p-4 bg-gray-800 border border-gray-600 rounded-lg">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-400" />
                Deposit Summary
              </h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Deposit Amount:</span>
                  <span className="text-white">${parseFloat(formData.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Processing Fee:</span>
                  <span className="text-white">
                    {calculateFee() === 0 ? 'Free' : `$${calculateFee().toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-600 pt-1">
                  <span className="text-gray-400 font-medium">Total Cost:</span>
                  <span className="text-white font-medium">${getTotalAmount().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Processing Time:</span>
                  <span className="text-white">{selectedMethod.time}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.toAccount || !formData.amount}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? 'Processing...' : 
               formData.method === 'stripe' ? 'Continue to Payment' : 'Initiate Deposit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

