/**
 * Price Alerts Component
 * Manages price alerts for symbols
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  BellOff, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

interface PriceAlert {
  id: number;
  symbol: string;
  abovePrice?: string;
  belowPrice?: string;
  active: boolean;
  lastTriggered?: string;
  createdAt: string;
}

interface NotificationPreferences {
  emailAlerts: boolean;
  pushAlerts: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

export default function PriceAlerts() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    abovePrice: '',
    belowPrice: ''
  });
  const { toast } = useToast();

  // Fetch price alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery<PriceAlert[]>({
    queryKey: ['/api/alerts/price'],
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch notification preferences
  const { data: preferences } = useQuery<NotificationPreferences>({
    queryKey: ['/api/alerts/preferences']
  });

  // Fetch alert history
  const { data: history } = useQuery<any[]>({
    queryKey: ['/api/alerts/history']
  });

  // Create price alert
  const createAlertMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/alerts/price', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/price'] });
      setIsCreateOpen(false);
      setNewAlert({ symbol: '', abovePrice: '', belowPrice: '' });
      toast({
        title: 'Alert created',
        description: 'You will be notified when the price condition is met'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create alert',
        variant: 'destructive'
      });
    }
  });

  // Toggle alert active status
  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      return await apiRequest(`/api/alerts/price/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/price'] });
    }
  });

  // Delete alert
  const deleteAlertMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/alerts/price/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/price'] });
      toast({
        title: 'Alert deleted',
        description: 'Price alert has been removed'
      });
    }
  });

  // Update preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPreferences>) => {
      return await apiRequest('/api/alerts/preferences', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts/preferences'] });
      toast({
        title: 'Preferences updated',
        description: 'Your notification preferences have been saved'
      });
    }
  });

  const handleCreateAlert = () => {
    const data: any = {
      symbol: newAlert.symbol.toUpperCase()
    };
    
    if (newAlert.abovePrice) {
      data.abovePrice = parseFloat(newAlert.abovePrice);
    }
    if (newAlert.belowPrice) {
      data.belowPrice = parseFloat(newAlert.belowPrice);
    }
    
    createAlertMutation.mutate(data);
  };

  const formatPrice = (price?: string) => {
    if (!price) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parseFloat(price));
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold text-white">
            Price Alerts
          </CardTitle>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-purple-600/10 border-purple-500 hover:bg-purple-600/20"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle className="text-white">Create Price Alert</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="symbol" className="text-gray-300">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="e.g., AAPL"
                    value={newAlert.symbol}
                    onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="above" className="text-gray-300">Alert when price goes above</Label>
                  <Input
                    id="above"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 150.00"
                    value={newAlert.abovePrice}
                    onChange={(e) => setNewAlert({ ...newAlert, abovePrice: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="below" className="text-gray-300">Alert when price goes below</Label>
                  <Input
                    id="below"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 140.00"
                    value={newAlert.belowPrice}
                    onChange={(e) => setNewAlert({ ...newAlert, belowPrice: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <Button
                  onClick={handleCreateAlert}
                  disabled={!newAlert.symbol || (!newAlert.abovePrice && !newAlert.belowPrice)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  Create Alert
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="active">Active Alerts</TabsTrigger>
              <TabsTrigger value="history">Alert History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-2 mt-4">
              {alertsLoading ? (
                <div className="text-center py-8 text-gray-400">
                  Loading alerts...
                </div>
              ) : alerts && alerts.length > 0 ? (
                alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold">
                          {alert.symbol}
                        </span>
                        <Badge 
                          variant={alert.active ? "default" : "secondary"}
                          className={alert.active ? "bg-green-600" : ""}
                        >
                          {alert.active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-400">
                        {alert.abovePrice && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span>Alert above {formatPrice(alert.abovePrice)}</span>
                          </div>
                        )}
                        {alert.belowPrice && (
                          <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            <span>Alert below {formatPrice(alert.belowPrice)}</span>
                          </div>
                        )}
                        {alert.lastTriggered && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Last triggered: {formatDate(alert.lastTriggered)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.active}
                        onCheckedChange={(active) => 
                          toggleAlertMutation.mutate({ id: alert.id, active })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAlertMutation.mutate(alert.id)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active alerts</p>
                  <p className="text-sm mt-1">Create alerts to get notified of price changes</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="history" className="space-y-2 mt-4">
              {history && history.length > 0 ? (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <div className="text-white">
                          {item.symbol} {item.triggerType === 'above' ? 'went above' : 'went below'} {formatPrice(item.triggerPrice)}
                        </div>
                        <div className="text-sm text-gray-400">
                          {formatDate(item.triggeredAt)}
                        </div>
                      </div>
                    </div>
                    {item.notificationSent && (
                      <Badge variant="outline" className="text-xs">
                        Notified
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No alert history yet
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-alerts" className="text-gray-300">
              Email Alerts
            </Label>
            <Switch
              id="email-alerts"
              checked={preferences?.emailAlerts ?? true}
              onCheckedChange={(checked) =>
                updatePreferencesMutation.mutate({ emailAlerts: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="push-alerts" className="text-gray-300">
              Push Notifications
            </Label>
            <Switch
              id="push-alerts"
              checked={preferences?.pushAlerts ?? true}
              onCheckedChange={(checked) =>
                updatePreferencesMutation.mutate({ pushAlerts: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}