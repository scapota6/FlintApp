import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialAPI } from "@/lib/financial-api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { PageTransition } from "@/components/auth/page-transition";
import { ActivitySkeleton } from "@/components/ui/skeleton-placeholder";
import { ErrorRetryCard } from "@/components/ui/error-retry-card";
import { 
  Search, 
  TrendingUp, 
  ArrowLeftRight, 
  Plus, 
  LogIn, 
  UserPlus, 
  Star, 
  Trash2,
  Building,
  Calendar,
  Filter
} from "lucide-react";

export default function Activity() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Fetch activity log
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ["/api/activity"],
    queryFn: FinancialAPI.getActivityLog,
    refetchInterval: 30000,
  });

  // Handle unauthorized errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Session Expired",
        description: "Please log in again to continue",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 2000);
    }
  }, [error, toast]);

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'trade_executed':
        return { icon: TrendingUp, color: 'bg-green-500' };
      case 'transfer_completed':
        return { icon: ArrowLeftRight, color: 'bg-blue-500' };
      case 'watchlist_add':
        return { icon: Star, color: 'bg-yellow-500' };
      case 'watchlist_remove':
        return { icon: Trash2, color: 'bg-red-500' };
      case 'account_connected':
        return { icon: Building, color: 'bg-purple-500' };
      case 'login':
        return { icon: LogIn, color: 'bg-gray-500' };
      case 'user_created':
        return { icon: UserPlus, color: 'bg-blue-600' };
      default:
        return { icon: Plus, color: 'bg-gray-500' };
    }
  };

  const getActivityBadge = (action: string) => {
    switch (action) {
      case 'trade_executed':
        return { text: 'Trade', variant: 'default' as const };
      case 'transfer_completed':
        return { text: 'Transfer', variant: 'secondary' as const };
      case 'watchlist_add':
      case 'watchlist_remove':
        return { text: 'Watchlist', variant: 'outline' as const };
      case 'account_connected':
        return { text: 'Account', variant: 'secondary' as const };
      case 'login':
        return { text: 'Login', variant: 'outline' as const };
      default:
        return { text: 'System', variant: 'outline' as const };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes > 0) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Safe array handling to prevent runtime errors
  const activitiesList = Array.isArray(activities) ? activities : [];
  const filteredActivities = activitiesList.filter((activity: any) => {
    const matchesSearch = activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.action?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || activity.action === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const groupedActivities = filteredActivities.reduce((groups: any, activity: any) => {
    const date = new Date(activity.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {});

  const activityStats = {
    total: Array.isArray(activities) ? activities.length : 0,
    trades: Array.isArray(activities) ? activities.filter((a: any) => a.action === 'trade_executed').length : 0,
    transfers: Array.isArray(activities) ? activities.filter((a: any) => a.action === 'transfer_completed').length : 0,
    logins: Array.isArray(activities) ? activities.filter((a: any) => a.action === 'login').length : 0,
  };

  if (isLoading) {
    return (
      <PageTransition className="min-h-screen bg-[#121212] text-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-800 rounded-xl"></div>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-[#121212] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 pt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 font-mono">
            <span className="sparkle-title">Activity</span>
          </h1>
          <p className="text-gray-400">Track all your account activities</p>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="trade-card">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{activityStats.total}</p>
                <p className="text-gray-400 text-sm">Total Activities</p>
              </div>
            </CardContent>
          </Card>
          <Card className="trade-card">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{activityStats.trades}</p>
                <p className="text-gray-400 text-sm">Trades</p>
              </div>
            </CardContent>
          </Card>
          <Card className="trade-card">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{activityStats.transfers}</p>
                <p className="text-gray-400 text-sm">Transfers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="trade-card">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{activityStats.logins}</p>
                <p className="text-gray-400 text-sm">Logins</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-600 text-white"
            />
          </div>
        </div>

        {/* Activity List */}
        <Card className="trade-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-5 bg-gray-800">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="trade">Trades</TabsTrigger>
                <TabsTrigger value="transfer">Transfers</TabsTrigger>
                <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
                <TabsTrigger value="account">Accounts</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-4">
                {Object.keys(groupedActivities).length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(groupedActivities).map(([date, dayActivities]) => (
                      <div key={date}>
                        <div className="flex items-center space-x-2 mb-3">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <h3 className="text-sm font-medium text-gray-400">
                            {new Date(date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {(dayActivities as any[]).map((activity: any, index: number) => {
                            const { icon: Icon, color } = getActivityIcon(activity.action);
                            const badge = getActivityBadge(activity.action);
                            
                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                                    <Icon className="h-4 w-4 text-white" />
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <p className="text-white font-medium text-sm">{activity.description}</p>
                                      <Badge variant={badge.variant} className="text-xs">
                                        {badge.text}
                                      </Badge>
                                    </div>
                                    <p className="text-gray-400 text-xs">
                                      {formatTimeAgo(activity.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-gray-400 text-xs">
                                    {formatDate(activity.createdAt)}
                                  </p>
                                  {activity.ipAddress && (
                                    <p className="text-gray-500 text-xs">
                                      {activity.ipAddress}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No activities found</p>
                    <p className="text-gray-500 text-sm">
                      {searchTerm ? 'Try a different search term' : 'Start using Flint to see your activity'}
                    </p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="trade" className="mt-4">
                <div className="space-y-2">
                  {activitiesList.filter((a: any) => a.action === 'trade_executed').map((activity: any, index: number) => {
                    const { icon: Icon, color } = getActivityIcon(activity.action);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{activity.description}</p>
                            <p className="text-gray-400 text-xs">{formatTimeAgo(activity.createdAt)}</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs">{formatDate(activity.createdAt)}</p>
                      </div>
                    );
                  }) || <p className="text-gray-400 text-center py-8">No trade activities</p>}
                </div>
              </TabsContent>
              
              <TabsContent value="transfer" className="mt-4">
                <div className="space-y-2">
                  {activitiesList.filter((a: any) => a.action === 'transfer_completed').map((activity: any, index: number) => {
                    const { icon: Icon, color } = getActivityIcon(activity.action);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{activity.description}</p>
                            <p className="text-gray-400 text-xs">{formatTimeAgo(activity.createdAt)}</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs">{formatDate(activity.createdAt)}</p>
                      </div>
                    );
                  }) || <p className="text-gray-400 text-center py-8">No transfer activities</p>}
                </div>
              </TabsContent>
              
              <TabsContent value="watchlist" className="mt-4">
                <div className="space-y-2">
                  {activitiesList.filter((a: any) => a.action.includes('watchlist')).map((activity: any, index: number) => {
                    const { icon: Icon, color } = getActivityIcon(activity.action);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{activity.description}</p>
                            <p className="text-gray-400 text-xs">{formatTimeAgo(activity.createdAt)}</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs">{formatDate(activity.createdAt)}</p>
                      </div>
                    );
                  }) || <p className="text-gray-400 text-center py-8">No watchlist activities</p>}
                </div>
              </TabsContent>
              
              <TabsContent value="account" className="mt-4">
                <div className="space-y-2">
                  {activitiesList.filter((a: any) => a.action === 'account_connected' || a.action === 'login').map((activity: any, index: number) => {
                    const { icon: Icon, color } = getActivityIcon(activity.action);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{activity.description}</p>
                            <p className="text-gray-400 text-xs">{formatTimeAgo(activity.createdAt)}</p>
                          </div>
                        </div>
                        <p className="text-gray-400 text-xs">{formatDate(activity.createdAt)}</p>
                      </div>
                    );
                  }) || <p className="text-gray-400 text-center py-8">No account activities</p>}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </PageTransition>
  );
}
