import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/utils/money';
import AccountDetailsDialog from './AccountDetailsDialog';
import type { ComputedAccount } from '@/hooks/useAccounts';

interface AccountCardProps {
  account: ComputedAccount;
  currentUserId: string;
}

export default function AccountCard({ account, currentUserId }: AccountCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Extract last 4 digits from account name or use account ID
  const getLastFour = () => {
    const match = account.name.match(/\*+(\d{4})\)/);
    return match ? match[1] : account.id.slice(-4);
  };

  const lastFour = getLastFour();

  return (
    <>
      <Card className="flint-card hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex flex-col space-y-4">
            {/* Title line: {institution} — {name} (••••{last4}) */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">
                  {account.institution} — {account.name.replace(/\s*\([^)]*\)/, '')} (••••{lastFour})
                </h3>
                <div className="text-gray-400 text-sm capitalize mt-1">
                  {account.type} • {account.subtype}
                </div>
              </div>
              
              {(account as any).needsReconnection ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-400 hover:text-red-300 border-red-400 hover:border-red-300 flex-shrink-0"
                  onClick={async () => {
                    // Trigger SnapTrade reconnection
                    try {
                      const response = await fetch('/api/snaptrade/register', {
                        method: 'POST',
                        credentials: 'include'
                      });
                      const data = await response.json();
                      
                      if (data.redirectUrl) {
                        // Open SnapTrade connection portal in a popup
                        const width = 800;
                        const height = 700;
                        const left = (window.innerWidth - width) / 2;
                        const top = (window.innerHeight - height) / 2;
                        
                        window.open(
                          data.redirectUrl,
                          'SnapTradeConnect',
                          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
                        );
                      }
                    } catch (error) {
                      console.error('Failed to start SnapTrade connection:', error);
                    }
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Resync
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-purple-400 hover:text-purple-300 flex-shrink-0"
                  onClick={() => setShowDetails(true)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Details
                </Button>
              )}
            </div>

            {/* Big number: display_value with currency format */}
            <div className="text-right">
              <div className={`text-2xl font-bold flex items-center justify-end gap-2 ${
                account.display_color === 'green' ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(account.display_value)}
                {/* If available_balance is negative (overdraft), add badge */}
                {account.display_color === 'green' && account.available_balance !== null && 
                 account.available_balance !== undefined && account.available_balance < 0 && (
                  <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full font-normal">
                    Overdraft
                  </span>
                )}
              </div>
              
              {/* Small line: percent for assets, credit available for credit cards */}
              <div className="text-gray-400 text-sm mt-1">
                {account.display_color === 'green' && account.percent_of_total ? (
                  `${account.percent_of_total}% of total`
                ) : account.display_color === 'red' ? (
                  // If credit_limit is missing, hide "Credit available" line and show just "Amount spent"
                  account.credit_limit !== null && account.credit_limit !== undefined && 
                  account.available_credit !== null && account.available_credit !== undefined ? (
                    `Credit available — ${formatCurrency(account.available_credit)}`
                  ) : (
                    'Amount spent'
                  )
                ) : account.available_balance === null || account.available_balance === undefined ? (
                  '—'
                ) : (
                  account.display_label
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AccountDetailsDialog
        accountId={account.id}
        open={showDetails}
        onClose={() => setShowDetails(false)}
        currentUserId={currentUserId}
      />
    </>
  );
}