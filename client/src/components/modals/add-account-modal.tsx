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
import { Building, TrendingUp, Bitcoin } from "lucide-react";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddAccountModal({ isOpen, onClose }: AddAccountModalProps) {
  const [accountType, setAccountType] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addAccountMutation = useMutation({
    mutationFn: async (accountData: any) => {
      return FinancialAPI.connectAccount(accountData);
    },
    onSuccess: () => {
      toast({
        title: "Account Connected",
        description: `${institutionName} account has been connected successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      onClose();
      resetForm();
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
        title: "Connection Failed",
        description: "Unable to connect account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setAccountType('');
    setInstitutionName('');
    setAccountName('');
    setBalance('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountType || !institutionName || !accountName || !balance) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(balance) < 0) {
      toast({
        title: "Invalid Balance",
        description: "Please enter a valid balance amount",
        variant: "destructive",
      });
      return;
    }

    addAccountMutation.mutate({
      accountType,
      institutionName,
      accountName,
      balance: parseFloat(balance),
      currency: 'USD',
      isActive: true,
    });
  };

  const institutionOptions = {
    bank: ['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', 'US Bank'],
    brokerage: ['Robinhood', 'TD Ameritrade', 'E*TRADE', 'Fidelity', 'Charles Schwab'],
    crypto: ['Coinbase', 'Binance', 'Kraken', 'Gemini', 'Crypto.com'],
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Building className="h-5 w-5" />;
      case 'brokerage':
        return <TrendingUp className="h-5 w-5" />;
      case 'crypto':
        return <Bitcoin className="h-5 w-5" />;
      default:
        return <Building className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Account</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="accountType" className="text-gray-300 text-sm font-medium">
              Account Type
            </Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="bank">
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4" />
                    <span>Bank Account</span>
                  </div>
                </SelectItem>
                <SelectItem value="brokerage">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Brokerage Account</span>
                  </div>
                </SelectItem>
                <SelectItem value="crypto">
                  <div className="flex items-center space-x-2">
                    <Bitcoin className="h-4 w-4" />
                    <span>Crypto Account</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {accountType && (
            <div>
              <Label htmlFor="institutionName" className="text-gray-300 text-sm font-medium">
                Institution
              </Label>
              <Select value={institutionName} onValueChange={setInstitutionName}>
                <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {institutionOptions[accountType as keyof typeof institutionOptions]?.map((institution) => (
                    <SelectItem key={institution} value={institution}>
                      {institution}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div>
            <Label htmlFor="accountName" className="text-gray-300 text-sm font-medium">
              Account Name
            </Label>
            <Input
              id="accountName"
              type="text"
              placeholder="e.g., Checking Account, Trading Account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="balance" className="text-gray-300 text-sm font-medium">
              Current Balance
            </Label>
            <Input
              id="balance"
              type="number"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              required
            />
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                {getIcon(accountType)}
              </div>
              <div>
                <p className="text-white font-medium">
                  {institutionName || 'Select Institution'}
                </p>
                <p className="text-gray-400 text-sm">
                  {accountName || 'Account Name'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addAccountMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addAccountMutation.isPending ? 'Connecting...' : 'Connect Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
