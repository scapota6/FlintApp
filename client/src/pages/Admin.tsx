import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Shield, 
  CreditCard, 
  Activity, 
  Search,
  Ban,
  UserCheck,
  Settings,
  TrendingUp,
  Link,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Crown,
  UserX,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  subscriptionStats: {
    free: number;
    basic: number;
    pro: number;
    premium: number;
  };
  accountStats: Array<{
    provider: string;
    accountType: string;
    count: number;
  }>;
  recentActivity: Array<{
    id: number;
    userId: string;
    action: string;
    description: string;
    createdAt: string;
    metadata?: any;
  }>;
  snaptrade?: {
    totalUsers: number;
    connectedUsers: number;
    activeConnections: number;
  };
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  isAdmin: boolean;
  isBanned: boolean;
  lastLogin?: string;
  createdAt?: string;
  connectedAccountsCount?: number;
}

export default function Admin() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState({ tier: "", status: "" });
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user?.isAdmin)) {
      toast({
        title: "Access Denied",
        description: "Admin privileges required",
        variant: "destructive"
      });
      window.location.href = "/";
    }
  }, [isAuthenticated, user, authLoading, toast]);

  // Fetch admin statistics
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: isAuthenticated && user?.isAdmin
  });

  // Fetch users with pagination
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users", page, userSearch, userFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(userSearch && { search: userSearch }),
        ...(userFilter.tier && userFilter.tier !== 'all' && { tier: userFilter.tier }),
        ...(userFilter.status && userFilter.status !== 'all' && { status: userFilter.status })
      });
      return apiRequest(`/api/admin/users?${params}`);
    },
    enabled: isAuthenticated && user?.isAdmin
  });

  // Fetch user details
  const { data: userDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["/api/admin/users", selectedUser?.id],
    queryFn: async () => apiRequest(`/api/admin/users/${selectedUser?.id}`),
    enabled: !!selectedUser?.id
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      return apiRequest(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ subscriptionTier: tier })
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Subscription updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Ban/Unban user mutation
  const toggleBanMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      return apiRequest(`/api/admin/users/${userId}/ban`, {
        method: "PATCH",
        body: JSON.stringify({ ban })
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `User ${variables.ban ? "banned" : "unbanned"} successfully`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Toggle admin status mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return apiRequest(`/api/admin/users/${userId}/admin`, {
        method: "PATCH",
        body: JSON.stringify({ isAdmin })
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `Admin privileges ${variables.isAdmin ? "granted" : "revoked"} successfully`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Disconnect account mutation
  const disconnectAccountMutation = useMutation({
    mutationFn: async ({ userId, accountId }: { userId: string; accountId: string }) => {
      return apiRequest(`/api/admin/users/${userId}/accounts/${accountId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Account disconnected successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Reset SnapTrade connections mutation
  const resetSnapTradeMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return apiRequest(`/api/admin/users/${userId}/reset-snaptrade`, {
        method: "POST"
      });
    },
    onSuccess: (data) => {
      toast({ 
        title: "Success", 
        description: `SnapTrade connections reset successfully. ${data.accountsReset} accounts cleared.` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Cleanup SnapTrade duplicates mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/admin/snaptrade-cleanup`, {
        method: "POST"
      });
    },
    onSuccess: (data) => {
      toast({ 
        title: "Cleanup Completed", 
        description: `Successfully cleaned up ${data.deletedCount} duplicate users. ${data.remainingUsers} users remaining.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCleanupSnapTrade = () => {
    if (confirm("This will permanently delete duplicate SnapTrade users. Only the newest user for each email will be kept. This action cannot be undone. Continue?")) {
      cleanupMutation.mutate();
    }
  };

  if (authLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading admin dashboard...</div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-purple-600" />
          Admin Dashboard
        </h1>
        <Badge variant="secondary" className="px-3 py-1">
          Admin: {user.email}
        </Badge>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                <p className="text-sm text-muted-foreground">
                  {stats?.bannedUsers || 0} banned
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Active Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
                <p className="text-sm text-muted-foreground">Not banned</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Pro Subscribers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats?.subscriptionStats?.pro || 0) + (stats?.subscriptionStats?.premium || 0)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Pro & Premium
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  Connected Accounts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.accountStats?.reduce((sum, stat) => sum + stat.count, 0) || 0}
                </div>
                <p className="text-sm text-muted-foreground">All providers</p>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats?.subscriptionStats || {}).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={tier === 'premium' ? 'default' : tier === 'pro' ? 'secondary' : 'outline'}>
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{count} users</span>
                    </div>
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${(count / (stats?.totalUsers || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SnapTrade Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                SnapTrade User Management
              </CardTitle>
              <CardDescription>
                Monitor and manage SnapTrade connections to optimize costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {stats?.snaptrade?.totalUsers || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Total SnapTrade Users</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {stats?.snaptrade?.connectedUsers || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Connected Users</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats?.snaptrade?.activeConnections || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Active Connections</p>
                </div>
              </div>
              
              {stats?.snaptrade && stats.snaptrade.totalUsers > stats.snaptrade.connectedUsers && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                        Duplicate Users Detected
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        You have {stats.snaptrade.totalUsers - stats.snaptrade.connectedUsers} unused SnapTrade users that are increasing your costs.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
                  }}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh Stats
                </Button>
                
                <Button
                  onClick={handleCleanupSnapTrade}
                  disabled={cleanupMutation.isPending || !stats?.snaptrade?.totalUsers}
                  variant="destructive"
                  size="sm"
                >
                  {cleanupMutation.isPending ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                      Cleaning up...
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Clean Up Duplicates
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Platform Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.recentActivity?.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.action} • {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user accounts, subscriptions, and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={userFilter.tier} onValueChange={(value) => setUserFilter(prev => ({ ...prev, tier: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={userFilter.status} onValueChange={(value) => setUserFilter(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Users List */}
              <div className="space-y-2">
                {usersLoading ? (
                  <div className="text-center py-8">Loading users...</div>
                ) : (
                  <>
                    {usersData?.users?.map((user: User) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => setSelectedUser(user)}
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium flex items-center gap-2">
                              {user.email}
                              {user.isAdmin && <Crown className="h-4 w-4 text-yellow-500" />}
                              {user.isBanned && <Ban className="h-4 w-4 text-red-500" />}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {user.firstName} {user.lastName} • {user.connectedAccountsCount || 0} accounts
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.subscriptionTier === 'premium' ? 'default' : user.subscriptionTier === 'pro' ? 'secondary' : 'outline'}>
                            {user.subscriptionTier || 'Free'}
                          </Badge>
                          {user.isBanned && <Badge variant="destructive">Banned</Badge>}
                        </div>
                      </div>
                    ))}

                    {/* Pagination */}
                    {usersData?.pagination && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-sm text-muted-foreground">
                          Page {usersData.pagination.page} of {usersData.pagination.totalPages} • {usersData.pagination.total} users
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= usersData.pagination.totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Details Modal */}
          {selectedUser && userDetails && (
            <Card>
              <CardHeader>
                <CardTitle>User Details: {selectedUser.email}</CardTitle>
                <CardDescription>
                  User ID: {selectedUser.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* User Actions */}
                <div className="flex gap-2">
                  <Select
                    value={userDetails.user.subscriptionTier || 'free'}
                    onValueChange={(value) => updateSubscriptionMutation.mutate({ 
                      userId: selectedUser.id, 
                      tier: value 
                    })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant={userDetails.user.isBanned ? "default" : "destructive"}
                    onClick={() => toggleBanMutation.mutate({
                      userId: selectedUser.id,
                      ban: !userDetails.user.isBanned
                    })}
                  >
                    {userDetails.user.isBanned ? <UserCheck className="h-4 w-4 mr-2" /> : <UserX className="h-4 w-4 mr-2" />}
                    {userDetails.user.isBanned ? "Unban User" : "Ban User"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => toggleAdminMutation.mutate({
                      userId: selectedUser.id,
                      isAdmin: !userDetails.user.isAdmin
                    })}
                    disabled={selectedUser.id === user.id}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    {userDetails.user.isAdmin ? "Revoke Admin" : "Grant Admin"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Are you sure you want to reset all SnapTrade connections for ${selectedUser.email}? This will clear all connected brokerage accounts and cannot be undone.`)) {
                        resetSnapTradeMutation.mutate({ userId: selectedUser.id });
                      }
                    }}
                    disabled={resetSnapTradeMutation.isPending}
                    data-testid="button-reset-snaptrade"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {resetSnapTradeMutation.isPending ? "Resetting..." : "Reset SnapTrade"}
                  </Button>
                </div>

                {/* Connected Accounts */}
                <div>
                  <h3 className="font-medium mb-2">Connected Accounts</h3>
                  <div className="space-y-2">
                    {userDetails.connectedAccounts?.length > 0 ? (
                      userDetails.connectedAccounts.map((account: any) => (
                        <div key={account.id} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{account.accountName}</p>
                            <p className="text-sm text-muted-foreground">
                              {account.provider} • {account.accountType} • ${account.balance}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => disconnectAccountMutation.mutate({
                              userId: selectedUser.id,
                              accountId: account.id.toString()
                            })}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No connected accounts</p>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h3 className="font-medium mb-2">Recent Activity</h3>
                  <div className="space-y-1">
                    {userDetails.recentActivity?.slice(0, 10).map((activity: any) => (
                      <div key={activity.id} className="text-sm py-1">
                        <span className="text-muted-foreground">
                          {format(new Date(activity.createdAt), 'MMM d, h:mm a')}:
                        </span>{" "}
                        {activity.description}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts Overview</CardTitle>
              <CardDescription>Monitor all connected financial accounts across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.accountStats?.map((stat) => (
                  <div key={`${stat.provider}-${stat.accountType}`} className="flex items-center justify-between p-4 border rounded">
                    <div className="flex items-center gap-3">
                      <Link className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-medium capitalize">{stat.provider}</p>
                        <p className="text-sm text-muted-foreground capitalize">{stat.accountType} Accounts</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{stat.count}</p>
                      <p className="text-sm text-muted-foreground">Connected</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Activity Log</CardTitle>
              <CardDescription>Monitor all platform activity and admin actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{activity.description}</p>
                      <p className="text-sm text-muted-foreground">
                        User: {activity.userId} • Action: {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}