import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockIcon } from '@/components/ui/stock-icon';
import { AlertTriangle, Building2, TrendingUp, TrendingDown, Activity, DollarSign, X, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BrokerageAccountModalProps {
  account: any;
  isOpen: boolean;
  onClose: () => void;
}

export function BrokerageAccountModal({ account, isOpen, onClose }: BrokerageAccountModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const { toast } = useToast();

  // For now, we'll use mock data since the SnapTrade hooks need to be implemented
  const positions: any[] = [];
  const orders: any[] = [];
  const positionsLoading = false;
  const ordersLoading = false;

  if (!account) return null;

  // Mock data for demo purposes when no real data is available
  const mockHoldings = [
    { symbol: 'AAPL', name: 'Apple Inc.', shares: 25, avgPrice: 180.50, currentPrice: 189.45, value: 4736.25, gainLoss: 223.75 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 10, avgPrice: 140.20, currentPrice: 142.18, value: 1421.80, gainLoss: 19.80 },
    { symbol: 'TSLA', name: 'Tesla Inc.', shares: 8, avgPrice: 220.75, currentPrice: 238.77, value: 1910.16, gainLoss: 144.16 },
  ];

  const mockOrders = [
    { id: '1', date: '2025-01-31', type: 'BUY', symbol: 'AAPL', shares: 5, price: 185.20, status: 'FILLED', amount: -926.00 },
    { id: '2', date: '2025-01-30', type: 'SELL', symbol: 'TSLA', shares: 2, price: 240.50, status: 'FILLED', amount: 481.00 },
    { id: '3', date: '2025-01-29', type: 'BUY', symbol: 'GOOGL', shares: 3, price: 141.75, status: 'PENDING', amount: -425.25 },
  ];

  const displayHoldings = positions.length > 0 ? positions : mockHoldings;
  const displayOrders = orders.length > 0 ? orders : mockOrders;

  const handleDisconnect = async () => {
    try {
      // In a real implementation, this would call the disconnect API
      toast({
        title: "Account Disconnected",
        description: `${account.name || account.institution_name} has been disconnected successfully.`,
      });
      onClose();
    } catch (error) {
      toast({
        title: "Disconnect Failed",
        description: "Failed to disconnect account. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] bg-gray-900 border-gray-700 text-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            {account.name || account.institution_name}
            <Badge variant="outline" className="border-purple-400 text-purple-400 ml-auto">
              Brokerage
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 bg-gray-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">
              Overview
            </TabsTrigger>
            <TabsTrigger value="holdings" className="data-[state=active]:bg-purple-600">
              Holdings
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-purple-600">
              Order History
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account Information */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-purple-400" />
                      Account Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Institution:</span>
                      <span className="text-white">{account.institution_name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account Type:</span>
                      <span className="text-white">{account.type || 'Brokerage'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Currency:</span>
                      <span className="text-white">{account.balance?.total?.currency || 'USD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      <Badge variant="outline" className="border-green-400 text-green-400">
                        Active
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Balance Summary */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-400" />
                      Balance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Balance:</span>
                      <span className="text-white font-semibold">
                        ${account.balance?.total?.amount?.toLocaleString() || '45,780.25'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cash Available:</span>
                      <span className="text-white">
                        ${account.balance?.cash?.amount?.toLocaleString() || '5,420.50'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Buying Power:</span>
                      <span className="text-white">
                        ${account.balance?.buying_power?.amount?.toLocaleString() || '10,841.00'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Account Actions */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-400" />
                    Account Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => window.location.href = '/trading'}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Start Trading
                    </Button>
                    <Button 
                      onClick={() => window.location.href = '/transfers'}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Transfer Funds
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowDisconnectConfirm(true)}
                      className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="holdings" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                    Current Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {positionsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                      <p className="text-gray-400 mt-2">Loading holdings...</p>
                    </div>
                  ) : displayHoldings.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No holdings found.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayHoldings.map((holding: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gray-700/50">
                          <div className="flex items-center gap-3">
                            <StockIcon symbol={holding.symbol} className="h-8 w-8" />
                            <div>
                              <p className="text-white font-medium">{holding.symbol}</p>
                              <p className="text-sm text-gray-400">
                                {holding.shares || holding.units} shares @ ${holding.avgPrice || holding.price}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-semibold">
                              ${(holding.value || (holding.units * holding.price))?.toLocaleString()}
                            </p>
                            <p className={`text-sm ${
                              (holding.gainLoss || holding.open_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {(holding.gainLoss || holding.open_pnl || 0) >= 0 ? '+' : ''}
                              ${(holding.gainLoss || holding.open_pnl || 0)?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-400" />
                    Recent Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-gray-400 mt-2">Loading orders...</p>
                    </div>
                  ) : displayOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No recent orders found.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayOrders.map((order: any) => (
                        <div key={order.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-700/50">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              order.status === 'FILLED' ? 'bg-green-400' : 'bg-yellow-400'
                            }`} />
                            <div>
                              <p className="text-white font-medium">
                                {order.action || order.type} {order.symbol}
                              </p>
                              <p className="text-sm text-gray-400">
                                {order.shares || order.units} shares @ ${order.price}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={order.status === 'FILLED' ? 'default' : 'outline'}
                              className={order.status === 'FILLED' ? 'bg-green-600' : 'border-yellow-400 text-yellow-400'}
                            >
                              {order.status}
                            </Badge>
                            <p className="text-sm text-gray-400 mt-1">
                              {new Date(order.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Disconnect Confirmation Dialog */}
        {showDisconnectConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Card className="bg-gray-800 border-gray-700 max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  Confirm Disconnection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  Are you sure you want to disconnect your {account.name || account.institution_name} account? 
                  This will remove access to your holdings and trading capabilities.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setShowDisconnectConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleDisconnect}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}