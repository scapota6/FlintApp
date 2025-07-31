import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft, Building, TrendingUp, CreditCard, Wallet, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: any[];
}

interface TransferFormData {
  fromAccount: string;
  toAccount: string;
  amount: string;
  description: string;
}

export function TransferModal({ isOpen, onClose, accounts = [] }: TransferModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<TransferFormData>({
    fromAccount: '',
    toAccount: '',
    amount: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only use real accounts - no mock data
  const availableAccounts = accounts || [];

  const getAccountIcon = (type: string, provider: string) => {
    if (provider === 'snaptrade' || type === 'investment') {
      return <TrendingUp className="h-4 w-4" />;
    }
    if (type === 'checking' || type === 'savings') {
      return <Building className="h-4 w-4" />;
    }
    if (type === 'credit') {
      return <CreditCard className="h-4 w-4" />;
    }
    return <Wallet className="h-4 w-4" />;
  };

  const getAccountColor = (type: string, provider: string) => {
    if (provider === 'snaptrade' || type === 'investment') return 'bg-purple-600';
    if (type === 'checking') return 'bg-blue-600';
    if (type === 'savings') return 'bg-green-600';
    if (type === 'credit') return 'bg-orange-600';
    return 'bg-gray-600';
  };

  const handleInputChange = (field: keyof TransferFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getSelectedAccount = (accountId: string) => {
    return availableAccounts.find(acc => acc.id === accountId);
  };

  const validateTransfer = () => {
    if (!formData.fromAccount || !formData.toAccount) {
      toast({
        title: "Missing Accounts",
        description: "Please select both from and to accounts",
        variant: "destructive",
      });
      return false;
    }

    if (formData.fromAccount === formData.toAccount) {
      toast({
        title: "Invalid Transfer",
        description: "Cannot transfer to the same account",
        variant: "destructive",
      });
      return false;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid transfer amount",
        variant: "destructive",
      });
      return false;
    }

    const fromAccount = getSelectedAccount(formData.fromAccount);
    if (fromAccount && amount > fromAccount.balance) {
      toast({
        title: "Insufficient Funds",
        description: `Amount exceeds available balance of $${fromAccount.balance.toLocaleString()}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateTransfer()) return;

    setIsSubmitting(true);
    try {
      const fromAccount = getSelectedAccount(formData.fromAccount);
      const toAccount = getSelectedAccount(formData.toAccount);

      const transferData = {
        fromAccountId: formData.fromAccount,
        toAccountId: formData.toAccount,
        amount: parseFloat(formData.amount),
        description: formData.description || 'Account transfer',
        fromAccountName: fromAccount?.name,
        toAccountName: toAccount?.name
      };

      console.log('Submitting transfer:', transferData);

      // Submit to transfer API
      const response = await apiRequest('POST', '/api/transfers', {
        body: transferData
      });

      if (response.success) {
        toast({
          title: "Transfer Successful",
          description: `$${formData.amount} transferred from ${fromAccount?.name} to ${toAccount?.name}`,
        });

        // Reset form and close modal
        setFormData({
          fromAccount: '',
          toAccount: '',
          amount: '',
          description: ''
        });
        onClose();
      } else {
        throw new Error(response.message || 'Transfer failed');
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to process transfer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxAmount = formData.fromAccount ? 
    getSelectedAccount(formData.fromAccount)?.balance || 0 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border-gray-700">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-purple-400" />
              Transfer Funds
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
          {/* From Account */}
          <div className="space-y-2">
            <Label className="text-white">From Account</Label>
            <Select value={formData.fromAccount} onValueChange={(value) => handleInputChange('fromAccount', value)}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select source account" />
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
                          Available: ${account.balance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Account */}
          <div className="space-y-2">
            <Label className="text-white">To Account</Label>
            <Select value={formData.toAccount} onValueChange={(value) => handleInputChange('toAccount', value)}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {availableAccounts
                  .filter(account => account.id !== formData.fromAccount)
                  .map((account) => (
                  <SelectItem key={account.id} value={account.id} className="text-white hover:bg-gray-700">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 ${getAccountColor(account.type, account.provider)} rounded-full flex items-center justify-center`}>
                        {getAccountIcon(account.type, account.provider)}
                      </div>
                      <div className="font-medium">{account.name}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-white">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAmount}
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                className="bg-gray-800 border-gray-600 text-white pl-8"
              />
            </div>
            {maxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Available: ${maxAmount.toLocaleString()}</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => handleInputChange('amount', maxAmount.toString())}
                  className="text-purple-400 hover:text-purple-300 p-0 h-auto"
                >
                  Use Max
                </Button>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-white">Description (Optional)</Label>
            <Input
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Transfer purpose..."
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>

          {/* Transfer Summary */}
          {formData.fromAccount && formData.toAccount && formData.amount && (
            <div className="p-4 bg-gray-800 border border-gray-600 rounded-lg">
              <h4 className="text-white font-medium mb-2">Transfer Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">From:</span>
                  <span className="text-white">{getSelectedAccount(formData.fromAccount)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To:</span>
                  <span className="text-white">{getSelectedAccount(formData.toAccount)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white font-medium">${parseFloat(formData.amount || '0').toLocaleString()}</span>
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
              disabled={isSubmitting || !formData.fromAccount || !formData.toAccount || !formData.amount}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting ? 'Processing...' : 'Transfer Funds'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

