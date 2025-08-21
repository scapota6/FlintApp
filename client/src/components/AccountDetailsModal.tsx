import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PaymentDialog } from "./PaymentDialog";
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
  FileText,
  Repeat,
  Shield,
  Download,
  RefreshCw,
  Clock,
  MapPin,
  DollarSign,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

interface TellerTransaction {
  id: string;
  account_id: string;
  amount: number;
  date: string;
  description: string;
  details?: {
    category?: string;
    counterparty?: {
      name?: string;
      type?: string;
    };
    processing_status?: string;
  };
  status: 'pending' | 'posted';
  running_balance?: number;
}

interface TellerStatement {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  balance: number;
  due_date?: string;
  url?: string;
}

interface RecurringTransaction {
  merchant: string;
  amount: number;
  cadence: string;
  last_seen: string;
  category?: string;
}

interface AccountDetailsResponse {
  account: TellerAccount;
  balances: TellerBalances | CreditCardBalances;
  transactions?: TellerTransaction[];
  statements?: TellerStatement[];
  recurring?: RecurringTransaction[];
  success: boolean;
}

export function AccountDetailsModal({
  isOpen,
  onClose,
  accountId,
  accountName,
  accountType,
}: AccountDetailsModalProps) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/teller/account', accountId, 'details'],
    queryFn: () => apiRequest(`/api/teller/account/${accountId}/details`),
    enabled: isOpen && !!accountId,
  });

  const accountData = data as AccountDetailsResponse;
  const account = accountData?.account;
  const balances = accountData?.balances;
  const transactions = accountData?.transactions || [];
  const statements = accountData?.statements || [];
  const recurring = accountData?.recurring || [];

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
          <div>
            <span className="text-gray-600 dark:text-gray-400">Late Fee:</span>
            <p className="font-medium">N/A</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Over Limit Fee:</span>
            <p className="font-medium">N/A</p>
          </div>
        </div>
      </div>
    );
  };

  const renderTransactions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
        </div>
        <Badge variant="secondary">{transactions.length} transactions</Badge>
      </div>
      
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No recent transactions available</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 10).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.status === 'posted' ? 'default' : 'secondary'}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.details?.counterparty?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={transaction.description}>
                      {transaction.description}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(Math.abs(transaction.amount), account?.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {transaction.details?.category || 'Other'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {transactions.length > 10 && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setLoadingMore(true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  'Load More Transactions'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStatements = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold">Statements</h3>
      </div>
      
      {statements.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No statements available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {statements.map((statement) => (
            <div key={statement.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">
                  {formatDate(statement.period_start)} - {formatDate(statement.period_end)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Balance: {formatCurrency(statement.balance, account?.currency)}
                  {statement.due_date && ` • Due: ${formatDate(statement.due_date)}`}
                </p>
              </div>
              {statement.url && (
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRecurringTransactions = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Repeat className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Recurring & Subscriptions</h3>
      </div>
      
      {recurring.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Repeat className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recurring transactions detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recurring.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Repeat className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{item.merchant}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.cadence} • Last seen: {formatDate(item.last_seen)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(item.amount, account?.currency)}</p>
                {item.category && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {item.category}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPayments = () => {
    if (!isCreditCard) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Payments</h3>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Last Payment Date:</span>
              <p className="font-medium">{formatDate(undefined)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Last Payment Amount:</span>
              <p className="font-medium">{formatCurrency(undefined, account?.currency)}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Payment Method:</span>
              <p className="font-medium">N/A</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Next Due Date:</span>
              <p className="font-medium">{formatDate(undefined)}</p>
            </div>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Make a Payment</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Pay your credit card bill securely</p>
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowPaymentDialog(true)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pay Card
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSecurity = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-5 w-5 text-green-600" />
        <h3 className="text-lg font-semibold">Security & Connection</h3>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Connection Status:</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="font-medium text-green-600">Active</p>
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Last Sync:</span>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-4 w-4 text-gray-500" />
              <p className="font-medium">{formatDate(new Date().toISOString())}</p>
            </div>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Data Encryption:</span>
            <p className="font-medium text-green-600">AES-256 Enabled</p>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Access Level:</span>
            <p className="font-medium">Read Only</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Now
          </Button>
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-2" />
            Re-connect
          </Button>
        </div>
      </div>
    </div>
  );

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
              <Separator />
              {renderTransactions()}
              <Separator />
              {renderStatements()}
              <Separator />
              {renderRecurringTransactions()}
              {isCreditCard && (
                <>
                  <Separator />
                  {renderPayments()}
                </>
              )}
              <Separator />
              {renderSecurity()}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
      
      {/* Payment Dialog */}
      {showPaymentDialog && data?.account && (
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          creditCardAccount={{
            id: data.account.id,
            name: data.account.name || accountName,
            institution: data.account.institution?.name,
            externalAccountId: accountId,
          }}
        />
      )}
    </Dialog>
  );
}