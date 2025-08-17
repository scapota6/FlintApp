import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  CreditCard, 
  Activity,
  Shield,
  Search,
  Ban,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Link2,
  Unlink,
  Crown,
  Settings
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionTier: 'free' | 'pro' | 'premium';
  subscriptionStatus: 'active' | 'inactive' | 'cancelled';
  connectedAccounts: number;
  totalBalance: number;
  lastLogin: string;
  createdAt: string;
  isAdmin: boolean;
}

interface AdminStats {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  totalConnectedAccounts: number;
  activeUsers: number;
  churnRate: number;
}

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Check if user is admin
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false
  });

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    enabled: !!currentUser,
    retry: false
  });

  // Fetch all users
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserData[]>({
    queryKey: ['/api/admin/users'],
    enabled: !!currentUser,
    retry: false
  });

  // Upgrade user mutation
  const upgradeMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      const response = await fetch('/api/admin/upgrade-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, tier })
      });
      if (!response.ok) throw new Error('Failed to upgrade user');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User subscription updated successfully",
      });
      refetchUsers();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user subscription",
        variant: "destructive",
      });
    }
  });

  // Disconnect user accounts mutation
  const disconnectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/admin/disconnect-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });
      if (!response.ok) throw new Error('Failed to disconnect accounts');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User accounts disconnected successfully",
      });
      refetchUsers();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect accounts",
        variant: "destructive",
      });
    }
  });

  // Ban/Unban user mutation
  const banMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'ban' | 'unban' }) => {
      const response = await fetch(`/api/admin/${action}-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });
      if (!response.ok) throw new Error(`Failed to ${action} user`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `User ${variables.action === 'ban' ? 'banned' : 'unbanned'} successfully`,
      });
      refetchUsers();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  });

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'bg-purple-500';
      case 'pro': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  // Check if current user is admin
  if (!currentUser?.isAdmin) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card className="border-red-500">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-purple-500" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <Badge variant="outline" className="text-purple-500 border-purple-500">
          <Crown className="h-4 w-4 mr-1" />
          Admin Access
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.activeUsers || 0} active today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Monthly recurring
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalConnectedAccounts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscription Split</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 text-xs">
              <span>Free: {stats?.freeUsers || 0}</span>
              <span className="text-blue-500">Pro: {stats?.proUsers || 0}</span>
              <span className="text-purple-500">Premium: {stats?.premiumUsers || 0}</span>
            </div>
            <div className="mt-1">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                {stats && (
                  <>
                    <div 
                      className="bg-gray-500" 
                      style={{ width: `${(stats.freeUsers / stats.totalUsers) * 100}%` }}
                    />
                    <div 
                      className="bg-blue-500" 
                      style={{ width: `${(stats.proUsers / stats.totalUsers) * 100}%` }}
                    />
                    <div 
                      className="bg-purple-500" 
                      style={{ width: `${(stats.premiumUsers / stats.totalUsers) * 100}%` }}
                    />
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            All Users
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <CreditCard className="h-4 w-4 mr-2" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>

          <div className="space-y-4">
            {usersLoading ? (
              <p>Loading users...</p>
            ) : (
              filteredUsers.map(user => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              {user.firstName} {user.lastName}
                              {user.isAdmin && (
                                <Badge variant="outline" className="text-purple-500 border-purple-500">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Admin
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {user.connectedAccounts} accounts
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(user.totalBalance)}
                          </span>
                          <span className="text-muted-foreground">
                            Last login: {formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={`${getTierColor(user.subscriptionTier)} text-white`}>
                          {user.subscriptionTier}
                        </Badge>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => upgradeMutation.mutate({ 
                              userId: user.id, 
                              tier: user.subscriptionTier === 'free' ? 'pro' : 
                                    user.subscriptionTier === 'pro' ? 'premium' : 'free'
                            })}
                          >
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Upgrade
                          </Button>
                          
                          {user.connectedAccounts > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm(`Disconnect all ${user.connectedAccounts} accounts for ${user.email}?`)) {
                                  disconnectMutation.mutate(user.id);
                                }
                              }}
                            >
                              <Unlink className="h-4 w-4 mr-1" />
                              Disconnect
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              if (confirm(`Are you sure you want to ban ${user.email}?`)) {
                                banMutation.mutate({ userId: user.id, action: 'ban' });
                              }
                            }}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Free Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.freeUsers || 0}</div>
                <p className="text-sm text-muted-foreground">Basic features only</p>
              </CardContent>
            </Card>
            
            <Card className="border-blue-500">
              <CardHeader>
                <CardTitle className="text-blue-500">Pro Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">{stats?.proUsers || 0}</div>
                <p className="text-sm text-muted-foreground">$20/month each</p>
              </CardContent>
            </Card>
            
            <Card className="border-purple-500">
              <CardHeader>
                <CardTitle className="text-purple-500">Premium Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-500">{stats?.premiumUsers || 0}</div>
                <p className="text-sm text-muted-foreground">$50/month each</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Activity logging will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}