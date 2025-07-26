import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trash2, Users, DollarSign, Database, RefreshCw, Bug, Shield } from 'lucide-react';
import FunctionTester from '@/components/debug/function-tester';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  subscriptionTier: string;
  snaptradeUserId?: string;
  snaptradeUserSecret?: string;
  createdAt: string;
}

interface SnapTradeUser {
  userId: string;
  userSecret: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Restrict access to admin users only
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const { data: snaptradeUsers, isLoading: snaptradeLoading, refetch: refetchSnapTrade } = useQuery({
    queryKey: ['/api/admin/snaptrade-users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/snaptrade-users');
      if (!response.ok) throw new Error('Failed to fetch SnapTrade users');
      return response.json();
    },
  });

  const deleteSnapTradeUser = async (userId: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/admin/snaptrade-user/${userId}`);
      if (!response.ok) throw new Error('Failed to delete SnapTrade user');
      
      toast({
        title: "Success",
        description: "SnapTrade user deleted successfully",
      });
      
      refetchSnapTrade();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete SnapTrade user",
        variant: "destructive",
      });
    }
  };

  const cleanupOrphanedSnapTradeUsers = async () => {
    try {
      const response = await apiRequest('POST', '/api/admin/cleanup-snaptrade');
      if (!response.ok) throw new Error('Failed to cleanup users');
      
      const result = await response.json();
      toast({
        title: "Cleanup Complete",
        description: `Deleted ${result.deletedCount} orphaned SnapTrade users`,
      });
      
      refetchSnapTrade();
    } catch (error: any) {
      toast({
        title: "Error", 
        description: error.message || "Failed to cleanup users",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users?.filter((user: User) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.includes(searchTerm)
  );

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'bg-yellow-500';
      case 'pro': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'overview' ? 'default' : 'outline'}
              onClick={() => setActiveTab('overview')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Database className="h-4 w-4 mr-2" />
              Overview
            </Button>
            <Button 
              variant={activeTab === 'debug' ? 'default' : 'outline'}
              onClick={() => setActiveTab('debug')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Bug className="h-4 w-4 mr-2" />
              Debug Functions
            </Button>
            <Button onClick={() => refetchUsers()} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {activeTab === 'debug' && <FunctionTester />}
        
        {activeTab === 'overview' && (
          <div className="space-y-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SnapTrade Users</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{snaptradeUsers?.users?.length || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter((u: User) => u.subscriptionTier === 'premium').length || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pro Users</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter((u: User) => u.subscriptionTier === 'pro').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SnapTrade Management */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle>SnapTrade Management</CardTitle>
            <CardDescription>Manage SnapTrade user accounts and cleanup orphaned users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button onClick={cleanupOrphanedSnapTradeUsers} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Cleanup Orphaned Users
              </Button>
            </div>
            
            {snaptradeLoading ? (
              <div>Loading SnapTrade users...</div>
            ) : (
              <div className="space-y-2">
                {snaptradeUsers?.users?.map((user: SnapTradeUser) => (
                  <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div>
                      <div className="font-mono text-sm">{user.userId}</div>
                      <div className="text-xs text-gray-400">Secret: {user.userSecret.substring(0, 20)}...</div>
                    </div>
                    <Button
                      onClick={() => deleteSnapTradeUser(user.userId)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and manage all registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search users by email or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-800 border-gray-600"
              />
            </div>
            
            {usersLoading ? (
              <div>Loading users...</div>
            ) : (
              <div className="space-y-2">
                {filteredUsers?.map((user: User) => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.email}</span>
                        <Badge className={getTierColor(user.subscriptionTier)}>
                          {user.subscriptionTier}
                        </Badge>
                        {user.snaptradeUserId && (
                          <Badge variant="outline">SnapTrade Connected</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        ID: {user.id} | Joined: {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                      {user.snaptradeUserId && (
                        <div className="text-xs text-gray-500 font-mono">
                          SnapTrade ID: {user.snaptradeUserId}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        )}
      </div>
    </div>
  );
}