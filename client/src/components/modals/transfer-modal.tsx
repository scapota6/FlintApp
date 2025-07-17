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

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: any[];
}

export default function TransferModal({ isOpen, onClose, accounts }: TransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: async (transferData: any) => {
      return FinancialAPI.createTransfer(transferData);
    },
    onSuccess: () => {
      toast({
        title: "Transfer Initiated",
        description: `Transfer of $${amount} has been initiated`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transfers'] });
      onClose();
      setAmount('');
      setFromAccountId('');
      setToAccountId('');
      setDescription('');
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
        title: "Transfer Failed",
        description: "Unable to initiate transfer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fromAccountId || !toAccountId || !amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (fromAccountId === toAccountId) {
      toast({
        title: "Invalid Transfer",
        description: "Source and destination accounts cannot be the same",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid transfer amount",
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate({
      fromAccountId: parseInt(fromAccountId),
      toAccountId: parseInt(toAccountId),
      amount: parseFloat(amount),
      description,
    });
  };

  // Default accounts for demo
  const displayAccounts = accounts?.length > 0 ? accounts : [
    { id: 1, accountName: 'Chase Checking', balance: '12847.32' },
    { id: 2, accountName: 'Bank of America Savings', balance: '32779.87' },
    { id: 3, accountName: 'Robinhood', balance: '42384.12' },
  ];

  const fromAccount = displayAccounts.find(acc => acc.id === parseInt(fromAccountId));
  const availableBalance = fromAccount?.balance || '0';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Transfer Funds</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fromAccount" className="text-gray-300 text-sm font-medium">
              From Account
            </Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {displayAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.accountName} - ${account.balance}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="toAccount" className="text-gray-300 text-sm font-medium">
              To Account
            </Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger className="mt-1 bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {displayAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="amount" className="text-gray-300 text-sm font-medium">
              Transfer Amount
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description" className="text-gray-300 text-sm font-medium">
              Description (Optional)
            </Label>
            <Input
              id="description"
              type="text"
              placeholder="Transfer description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Transfer Amount</span>
              <span className="text-white font-medium">
                ${parseFloat(amount || '0').toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Available Balance</span>
              <span className="text-white font-medium">
                ${parseFloat(availableBalance.replace(/,/g, '')).toFixed(2)}
              </span>
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={transferMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
          >
            {transferMutation.isPending ? 'Processing...' : 'Initiate Transfer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
