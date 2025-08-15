import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Bell, Link2, Download, Trash2, Shield, Clock, Mail, Smartphone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function Settings() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/settings/profile'],
    enabled: !!user
  });

  // Fetch notification preferences
  const { data: notifications, isLoading: notifLoading } = useQuery({
    queryKey: ['/api/settings/notifications'],
    enabled: !!user
  });

  // Fetch connected accounts
  const { data: connectedAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/settings/connected-accounts'],
    enabled: !!user
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/settings/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/profile'] });
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Update notification preferences mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: 'Preferences Updated',
        description: 'Your notification preferences have been saved.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/notifications'] });
    }
  });

  // Revoke account connection mutation
  const revokeAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return apiRequest(`/api/settings/connected-accounts/${accountId}/revoke`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Account Disconnected',
        description: 'The account has been disconnected successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/connected-accounts'] });
    },
    onError: () => {
      toast({
        title: 'Disconnection Failed',
        description: 'Failed to disconnect the account. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: async (dataType: 'holdings' | 'transactions') => {
      const response = await fetch(`/api/settings/export/${dataType}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataType}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: 'Export Complete',
        description: 'Your data has been exported successfully.'
      });
    },
    onError: () => {
      toast({
        title: 'Export Failed',
        description: 'Failed to export data. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/settings/delete-account', {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      window.location.href = '/api/logout';
    },
    onError: () => {
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete account. Please contact support.',
        variant: 'destructive'
      });
    }
  });

  const isLoading = authLoading || profileLoading || notifLoading || accountsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
        Settings
      </h1>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="profile" className="text-xs sm:text-sm">
            <User className="w-4 h-4 mr-1 hidden sm:inline" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm">
            <Bell className="w-4 h-4 mr-1 hidden sm:inline" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs sm:text-sm">
            <Link2 className="w-4 h-4 mr-1 hidden sm:inline" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="data" className="text-xs sm:text-sm">
            <Download className="w-4 h-4 mr-1 hidden sm:inline" />
            Data
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm">
            <Shield className="w-4 h-4 mr-1 hidden sm:inline" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile?.firstName || ''}
                    onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile?.lastName || ''}
                    onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-50 dark:bg-gray-900"
                />
                <p className="text-sm text-gray-500">Email cannot be changed</p>
              </div>
              <Button 
                onClick={() => updateProfileMutation.mutate(profileData)}
                disabled={updateProfileMutation.isPending}
                className="w-full sm:w-auto"
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-alerts" className="text-base flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Alerts
                    </Label>
                    <p className="text-sm text-gray-500">Receive price alerts via email</p>
                  </div>
                  <Switch
                    id="email-alerts"
                    checked={notifications?.emailAlerts ?? true}
                    onCheckedChange={(checked) => 
                      updateNotificationsMutation.mutate({...notifications, emailAlerts: checked})
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-alerts" className="text-base flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Push Notifications
                    </Label>
                    <p className="text-sm text-gray-500">Receive alerts on your device</p>
                  </div>
                  <Switch
                    id="push-alerts"
                    checked={notifications?.pushAlerts ?? true}
                    onCheckedChange={(checked) => 
                      updateNotificationsMutation.mutate({...notifications, pushAlerts: checked})
                    }
                  />
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Quiet Hours
                  </Label>
                  <p className="text-sm text-gray-500">Don't send notifications during these hours</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quiet-start">Start Time</Label>
                      <Input
                        id="quiet-start"
                        type="time"
                        value={notifications?.quietHoursStart || '22:00'}
                        onChange={(e) => 
                          updateNotificationsMutation.mutate({...notifications, quietHoursStart: e.target.value})
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quiet-end">End Time</Label>
                      <Input
                        id="quiet-end"
                        type="time"
                        value={notifications?.quietHoursEnd || '08:00'}
                        onChange={(e) => 
                          updateNotificationsMutation.mutate({...notifications, quietHoursEnd: e.target.value})
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connected Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>
                Manage your connected financial accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connectedAccounts?.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No accounts connected yet. Go to Accounts page to connect.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {connectedAccounts?.map((account: any) => (
                    <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {account.status === 'connected' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-gray-500">
                            {account.type} • Connected {format(new Date(account.connectedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Revoke Access
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke Account Access?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will disconnect {account.name} from your Flint account. 
                              You can reconnect it anytime from the Accounts page.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => revokeAccountMutation.mutate(account.id)}
                            >
                              Revoke Access
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Export Tab */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Export Your Data</CardTitle>
              <CardDescription>
                Download your financial data in CSV format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg">
                  <div className="mb-3 sm:mb-0">
                    <h3 className="font-medium">Holdings Data</h3>
                    <p className="text-sm text-gray-500">Export all your current holdings and positions</p>
                  </div>
                  <Button
                    onClick={() => exportDataMutation.mutate('holdings')}
                    disabled={exportDataMutation.isPending}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Holdings
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg">
                  <div className="mb-3 sm:mb-0">
                    <h3 className="font-medium">Transaction History</h3>
                    <p className="text-sm text-gray-500">Export all your transactions and trades</p>
                  </div>
                  <Button
                    onClick={() => exportDataMutation.mutate('transactions')}
                    disabled={exportDataMutation.isPending}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Transactions
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Exports are generated in real-time and include all available data. 
                  Large exports may take a few seconds to complete.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security & Privacy</CardTitle>
              <CardDescription>
                Manage your account security and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-red-200 dark:border-red-900">
                <Trash2 className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-600 dark:text-red-400">
                  <strong>Danger Zone</strong>
                  <p className="mt-2">
                    Deleting your account is permanent and cannot be undone. 
                    All your data, connections, and settings will be permanently removed.
                  </p>
                </AlertDescription>
              </Alert>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account
                      and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => deleteAccountMutation.mutate()}
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}