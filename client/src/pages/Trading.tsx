/**
 * Trading Page
 * Main trading interface with charts, order ticket, and order management
 */

import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SimpleTradingChart from '@/components/charts/SimpleTradingChart';
import OrderTicket from '@/components/trading/OrderTicket';
import OrdersList from '@/components/trading/OrdersList';
import { Search, AlertCircle } from 'lucide-react';

interface BrokerageAccount {
  id: string;
  accountName: string;
  provider: string;
  balance: string;
  externalAccountId: string;
}

export default function Trading() {
  const [symbol, setSymbol] = useState('AAPL');
  const [searchInput, setSearchInput] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Fetch connected brokerage accounts from SnapTrade
  const { data: accounts, isLoading: accountsLoading } = useQuery<BrokerageAccount[]>({
    queryKey: ['/api/snaptrade/accounts'],
    select: (data: any) => {
      return data?.accounts?.map((account: any) => ({
        id: account.id,
        accountName: account.name,
        provider: 'snaptrade',
        balance: account.balance?.total?.amount?.toString() || '0',
        externalAccountId: account.id
      })) || [];
    }
  });

  // Set default account when loaded
  if (accounts && accounts.length > 0 && !selectedAccountId) {
    setSelectedAccountId(accounts[0].id);
  }

  // Handle symbol search using new SnapTrade endpoint
  const handleSearch = async () => {
    if (searchInput.length < 2) return;

    try {
      const response = await fetch(`/api/snaptrade/symbols/${searchInput.toUpperCase()}?accountId=${selectedAccountId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.symbol) {
          setSearchResults([{
            symbol: result.symbol.symbol,
            description: result.symbol.description,
            exchange: result.symbol.exchange,
            type: result.symbol.type,
            id: result.symbol.id
          }]);
          setShowSearchResults(true);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  // Handle symbol selection
  const handleSymbolSelect = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    setSearchInput('');
    setShowSearchResults(false);
  };

  // Handle price update from chart
  const handlePriceUpdate = (price: number) => {
    setCurrentPrice(price);
  };

  const hasAccounts = accounts && accounts.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
            Trading
          </h1>
          <p className="text-slate-400 mt-2">
            Execute trades across your connected brokerage accounts
          </p>
        </div>

        {/* Account Warning */}
        {!hasAccounts && (
          <Alert className="mb-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-purple-400" />
            <AlertDescription className="text-slate-300">
              Connect a brokerage account to start trading.{' '}
              <Button variant="link" className="p-0 h-auto text-purple-400 hover:text-purple-300" onClick={() => window.location.href = '/connections'}>
                Connect Account
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Symbol Search */}
        <Card className="mb-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Symbol Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 relative">
            <Input
              placeholder="Search stocks, ETFs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute z-50 mt-2 w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
              {searchResults.map((result) => (
                <div
                  key={result.symbol}
                  className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                  onClick={() => handleSymbolSelect(result.symbol)}
                >
                  <div className="flex justify-between">
                    <div>
                      <span className="font-semibold">{result.symbol}</span>
                      <span className="text-xs ml-2 text-muted-foreground">{result.type}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{result.name}</div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>

        {/* Main Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <SimpleTradingChart 
            symbol={symbol} 
            height={500}
            onPriceUpdate={handlePriceUpdate}
          />
          
          {/* Orders List */}
          {hasAccounts && (
            <OrdersList 
              accountId={selectedAccountId}
              onOrderCancelled={() => {
                // Optionally refresh data
              }}
            />
          )}
        </div>

        {/* Right Sidebar - Order Ticket */}
        <div className="space-y-6">
          {/* Account Selector */}
          {hasAccounts && (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm relative z-20">
              <CardHeader>
                <CardTitle className="text-sm text-white">Trading Account</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 z-50">
                    {accounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id} className="text-white hover:bg-slate-700">
                        <div className="flex flex-col">
                          <div className="font-medium">{account.accountName}</div>
                          <div className="text-xs text-slate-400">
                            Balance: ${parseFloat(account.balance).toLocaleString()}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}
          
          {/* Order Ticket */}
          <OrderTicket 
            symbol={symbol}
            currentPrice={currentPrice}
            selectedAccountId={selectedAccountId}
            onOrderPlaced={() => {
              // Optionally refresh orders
            }}
          />
          
          {/* Market Info */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm text-white">Market Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Symbol</span>
                <span className="font-semibold text-white">{symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Price</span>
                <span className="font-semibold text-white">
                  ${currentPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Market Status</span>
                <span className="font-semibold text-white">
                  {new Date().getHours() >= 9 && new Date().getHours() < 16 ? 'Open' : 'Closed'}
                </span>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </div>
  );
}