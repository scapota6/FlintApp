import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2,
  CreditCard,
  Banknote,
  Calendar,
  Percent,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  accountType: 'bank' | 'card';
}

interface TellerAccount {
  id: string;
  name: string;
  subtype: string;
  type: string;
  currency: string;
  status: string;
  last_four: string;
  routing_numbers?: {
    ach?: string;
  };
  institution: {
    name: string;
    id: string;
  };
  links?: {
    transactions?: string;
    statements?: string;
  };
}

interface TellerBalances {
  account_id: string;
  available: number;
  ledger: number;
  links?: {
    self: string;
    account: string;
  };
}

interface CreditCardBalances {
  current: number;
  available: number;
  limit: number;
}

interface AccountDetailsResponse {
  account: TellerAccount;
  balances: TellerBalances | CreditCardBalances;
  success: boolean;
}

export function AccountDetailsModal({
  isOpen,
  onClose,
  accountId,
  accountName,
  accountType,
}: AccountDetailsModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/teller/account', accountId, 'details'],
    queryFn: () => apiRequest(`/api/teller/account/${accountId}/details`),
    enabled: isOpen && !!accountId,
  });

  const accountData = data as AccountDetailsResponse;
  const account = accountData?.account;
  const balances = accountData?.balances;

  const isCreditCard = accountType === 'card' || account?.type === 'credit';

  const formatCurrency = (amount: number | undefined, currency = 'USD') => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const renderAccountOverview = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Account Overview</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Institution:</span>
          <p className="font-medium">{account?.institution?.name || 'N/A'}</p>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Account Name:</span>
          <p className="font-medium">{account?.name || accountName}</p>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Account Type:</span>
          <Badge variant="secondary">{account?.subtype || account?.type || 'N/A'}</Badge>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Status:</span>
          <Badge variant={account?.status === 'open' ? 'default' : 'destructive'}>
            {account?.status || 'N/A'}
          </Badge>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Currency:</span>
          <p className="font-medium">{account?.currency || 'USD'}</p>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-400">Teller Account ID:</span>
          <p className="font-mono text-xs">{account?.id || 'N/A'}</p>
        </div>
      </div>
    </div>
  );

  const renderIdentifiers = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Identifiers</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {!isCreditCard && (
          <>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Routing Number (ABA):</span>
              <p className="font-mono">****{account?.routing_numbers?.ach?.slice(-4) || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Account Last 4:</span>
              <p className="font-mono">****{account?.last_four || 'N/A'}</p>
            </div>
          </>
        )}
        
        {isCreditCard && (
          <>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Card Network:</span>
              <p className="font-medium">Visa</p> {/* This would come from Teller data */}
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Card Last 4:</span>
              <p className="font-mono">****{account?.last_four || 'N/A'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderCapabilities = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold">Capabilities</h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Badge variant={account?.links?.transactions ? 'default' : 'secondary'}>
          {account?.links?.transactions ? '✓' : '✗'} Transactions
        </Badge>
        <Badge variant={account?.links?.statements ? 'default' : 'secondary'}>
          {account?.links?.statements ? '✓' : '✗'} Statements
        </Badge>
        <Badge variant="secondary">
          ✓ Payments Supported
        </Badge>
      </div>
    </div>
  );

  const renderBalances = () => {
    if (!balances) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold">Balances</h3>
        </div>
        
        {!isCreditCard && 'available' in balances && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Current Balance:</span>
              <p className="font-semibold text-lg">{formatCurrency(balances.ledger, account?.currency)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Available Balance:</span>
              <p className="font-semibold text-lg">{formatCurrency(balances.available, account?.currency)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Ledger Balance:</span>
              <p className="font-medium">{formatCurrency(balances.ledger, account?.currency)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Pending:</span>
              <p className="font-medium">{formatCurrency((balances.ledger || 0) - (balances.available || 0), account?.currency)}</p>
            </div>
          </div>
        )}

        {isCreditCard && 'current' in balances && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Current Balance:</span>
              <p className="font-semibold text-lg">{formatCurrency(balances.current, account?.currency)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Available Credit:</span>
              <p className="font-semibold text-lg text-green-600">{formatCurrency(balances.available, account?.currency)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Credit Limit:</span>
              <p className="font-medium">{formatCurrency(balances.limit, account?.currency)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Statement Balance:</span>
              <p className="font-medium">{formatCurrency(balances.current, account?.currency)}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCreditCardDates = () => {
    if (!isCreditCard) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Important Dates</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Next Statement Close:</span>
            <p className="font-medium">{formatDate(undefined)}</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Payment Due Date:</span>
            <p className="font-medium">{formatDate(undefined)}</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Last Payment Date:</span>
            <p className="font-medium">{formatDate(undefined)}</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Minimum Payment Due:</span>
            <p className="font-medium">{formatCurrency(undefined, account?.currency)}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderAPRAndFees = () => {
    if (!isCreditCard) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-semibold">APR & Fees</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Purchase APR:</span>
            <p className="font-medium">N/A</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Cash Advance APR:</span>
            <p className="font-medium">N/A</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Balance Transfer APR:</span>
            <p className="font-medium">N/A</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Annual Fee:</span>
            <p className="font-medium">N/A</p>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Error Loading Account Details
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Failed to load account details. Please try again.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreditCard ? <CreditCard className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
            Account Details - {accountName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading account details...</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {renderAccountOverview()}
              <Separator />
              {renderIdentifiers()}
              <Separator />
              {renderCapabilities()}
              <Separator />
              {renderBalances()}
              {isCreditCard && (
                <>
                  <Separator />
                  {renderCreditCardDates()}
                  <Separator />
                  {renderAPRAndFees()}
                </>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}