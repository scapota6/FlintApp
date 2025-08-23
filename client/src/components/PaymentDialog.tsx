import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { getCsrfToken } from "@/lib/csrf";
import { 
  CreditCard, 
  Building2, 
  DollarSign, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Calendar,
  ArrowRight
} from "lucide-react";

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  creditCardAccount: {
    id: string;
    name: string;
    institution?: string;
    externalAccountId: string;
  };
}

interface BankAccount {
  id: string;
  accountName: string;
  accountType: string;
  institutionName: string;
  externalAccountId: string;
  balance?: number;
}

export function PaymentDialog({
  isOpen,
  onClose,
  creditCardAccount,
}: PaymentDialogProps) {
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<"minimum" | "statement" | "custom">("minimum");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "preparing" | "creating" | "processing" | "completed" | "failed">("idle");
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Fetch available bank accounts
  const { data: bankAccounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/dashboard'],
    enabled: isOpen,
  });

  // Check payment capability
  const { data: capability } = useQuery({
    queryKey: ['/api/teller/payments/capability', selectedBankAccount, creditCardAccount.externalAccountId],
    queryFn: () => selectedBankAccount && creditCardAccount.externalAccountId
      ? apiRequest(`/api/teller/payments/capability?fromAccountId=${selectedBankAccount}&toAccountId=${creditCardAccount.externalAccountId}`)
      : null,
    enabled: !!selectedBankAccount && !!creditCardAccount.externalAccountId,
  });

  // Prepare payment (fetch card metadata)
  const preparePaymentMutation = useMutation({
    mutationFn: async () => {
      setPaymentStatus("preparing");
      const csrfToken = await getCsrfToken();
      return apiRequest('/api/teller/payments/prepare', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          fromAccountId: selectedBankAccount,
          toAccountId: creditCardAccount.externalAccountId,
        }),
      });
    },
    onSuccess: (data) => {
      // Data includes minimumDue, statementBalance, dueDate
      setPaymentStatus("idle");
    },
    onError: () => {
      setPaymentStatus("failed");
    },
  });

  // Create payment
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      setPaymentStatus("creating");
      
      const prepData = preparePaymentMutation.data;
      let amount = 0;
      
      if (paymentAmount === "minimum") {
        amount = parseFloat(prepData?.minimumDue || "25.00");
      } else if (paymentAmount === "statement") {
        amount = parseFloat(prepData?.statementBalance || "0");
      } else {
        amount = parseFloat(customAmount);
      }

      const csrfToken = await getCsrfToken();
      return apiRequest('/api/teller/payments/create', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          fromAccountId: selectedBankAccount,
          toAccountId: creditCardAccount.externalAccountId,
          amount: amount.toFixed(2),
          memo: `Credit card payment to ${creditCardAccount.name}`,
        }),
      });
    },
    onSuccess: (data) => {
      setPaymentId(data.paymentId);
      setPaymentStatus("processing");
      // Start polling for status
      pollPaymentStatus(data.paymentId);
    },
    onError: async (error: any) => {
      // Check for MFA requirement (409 status)
      if (error.message?.includes("409") || error.step === 'mfa') {
        // Extract connectToken from error response
        const connectToken = error.connectToken || error.data?.connectToken;
        if (connectToken) {
          // Open Teller Connect for MFA
          setPaymentStatus("idle");
          const message = "Additional authentication required. Please complete MFA with your bank.";
          
          // In production, you would open Teller Connect here
          // For now, show a user-friendly message
          alert(message + "\n\nPlease complete authentication in your bank app, then try again.");
          
          // TODO: Implement Teller Connect integration for MFA
          // window.open(`https://connect.teller.io/?token=${connectToken}`, '_blank');
        }
      } else {
        setPaymentStatus("failed");
      }
    },
  });

  // Poll payment status
  const pollPaymentStatus = async (id: string) => {
    const maxAttempts = 30;
    let attempts = 0;
    
    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        setPaymentStatus("failed");
        return;
      }
      
      try {
        const status = await apiRequest(`/api/teller/payments/${id}`);
        
        if (status.status === "completed" || status.status === "success") {
          setPaymentStatus("completed");
          // Optionally refresh the card balances
          onClose(); // Close dialog on success
        } else if (status.status === "failed" || status.status === "cancelled") {
          setPaymentStatus("failed");
        } else {
          // Continue polling every 2-3 seconds as per requirements
          attempts++;
          setTimeout(checkStatus, 2500); // Check every 2.5 seconds
        }
      } catch (error) {
        setPaymentStatus("failed");
      }
    };
    
    checkStatus();
  };

  const handleSubmitPayment = async () => {
    if (!selectedBankAccount) {
      alert("Please select a funding account");
      return;
    }
    
    // Check capability first
    if (capability && !capability.canPay) {
      alert(capability.reason || "This payment combination is not supported. Please pay through your card issuer's website.");
      return;
    }
    
    // Validate amount for custom payments
    if (paymentAmount === "custom") {
      const amount = parseFloat(customAmount);
      if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid payment amount");
        return;
      }
      
      // Cap to statement balance if available
      const statementBalance = parseFloat(preparePaymentMutation.data?.statementBalance || "0");
      if (statementBalance > 0 && amount > statementBalance) {
        alert(`Payment amount cannot exceed statement balance of ${formatCurrency(statementBalance)}`);
        return;
      }
    }
    
    setIsProcessing(true);
    
    try {
      // First prepare payment to get metadata
      if (!preparePaymentMutation.data) {
        await preparePaymentMutation.mutateAsync();
      }
      
      // Then create the payment
      await createPaymentMutation.mutateAsync();
    } catch (error) {
      console.error("Payment error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredBankAccounts = (bankAccounts as any)?.bankAccounts?.filter(
    (acc: BankAccount) => acc.accountType === 'checking' || acc.accountType === 'savings'
  ) || [];

  const prepData = preparePaymentMutation.data;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pay Credit Card
          </DialogTitle>
          <DialogDescription>
            Make a payment to {creditCardAccount.name}
          </DialogDescription>
        </DialogHeader>

        {paymentStatus === "completed" ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your payment has been initiated and will be processed shortly.
            </p>
            <Button onClick={onClose} className="mt-6">Done</Button>
          </div>
        ) : paymentStatus === "failed" ? (
          <div className="py-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Payment Failed</h3>
            <p className="text-gray-600 dark:text-gray-400">
              There was an error processing your payment. Please try again.
            </p>
            <Button onClick={() => setPaymentStatus("idle")} className="mt-6">
              Try Again
            </Button>
          </div>
        ) : paymentStatus === "processing" ? (
          <div className="py-8 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Processing Payment...</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your payment is being processed. This may take a few moments.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Select funding account */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">1. Select Funding Account</Label>
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredBankAccounts.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No checking or savings accounts available. Please connect a bank account first.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBankAccounts.map((account: BankAccount) => (
                      <SelectItem key={account.externalAccountId} value={account.externalAccountId}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{account.accountName}</span>
                          <Badge variant="outline">{account.institutionName}</Badge>
                          {account.balance && (
                            <span className="ml-auto text-sm text-gray-600">
                              {formatCurrency(account.balance)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* Step 2: Select payment amount */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">2. Payment Amount</Label>
              
              {selectedBankAccount && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => preparePaymentMutation.mutate()}
                  disabled={preparePaymentMutation.isPending}
                >
                  {preparePaymentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading card details...
                    </>
                  ) : (
                    "Refresh Card Details"
                  )}
                </Button>
              )}

              {prepData && (
                <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Statement Balance:</span>
                    <p className="font-semibold">{formatCurrency(parseFloat(prepData.statementBalance))}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Minimum Due:</span>
                    <p className="font-semibold">{formatCurrency(parseFloat(prepData.minimumDue))}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Due Date:</span>
                    <p className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(prepData.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              <RadioGroup value={paymentAmount} onValueChange={(value: any) => setPaymentAmount(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="minimum" id="minimum" />
                  <Label htmlFor="minimum" className="flex-1 cursor-pointer">
                    <div className="flex justify-between">
                      <span>Minimum Due</span>
                      {prepData && (
                        <span className="font-semibold">
                          {formatCurrency(parseFloat(prepData.minimumDue))}
                        </span>
                      )}
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="statement" id="statement" />
                  <Label htmlFor="statement" className="flex-1 cursor-pointer">
                    <div className="flex justify-between">
                      <span>Statement Balance</span>
                      {prepData && (
                        <span className="font-semibold">
                          {formatCurrency(parseFloat(prepData.statementBalance))}
                        </span>
                      )}
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="cursor-pointer">Custom Amount</Label>
                </div>
              </RadioGroup>

              {paymentAmount === "custom" && (
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}
            </div>

            {capability && !capability.canPay && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {capability.reason || "Payment not available for this account combination"}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitPayment}
                disabled={
                  !selectedBankAccount ||
                  !capability?.canPay ||
                  isProcessing ||
                  (paymentAmount === "custom" && !customAmount)
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Submit Payment
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}