import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeftRight, ArrowDown, Bitcoin } from "lucide-react";

interface ActivityFeedProps {
  activities: any[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'trade_executed':
        return { icon: Plus, color: 'bg-green-500' };
      case 'transfer_completed':
        return { icon: ArrowLeftRight, color: 'bg-blue-500' };
      case 'login':
        return { icon: ArrowDown, color: 'bg-purple-500' };
      default:
        return { icon: Bitcoin, color: 'bg-orange-500' };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  // Default activities if no data
  const displayActivities = activities?.length > 0 ? activities : [
    {
      action: 'trade_executed',
      description: 'Bought 5 shares of AAPL',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: -879.20 },
    },
    {
      action: 'transfer_completed',
      description: 'Transfer to Savings',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: -2500.00 },
    },
    {
      action: 'login',
      description: 'Salary Deposit',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: 5200.00 },
    },
  ];

  return (
    <Card className="trade-card shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">Recent Activity</CardTitle>
          <Button variant="ghost" className="text-blue-500 text-sm font-medium">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {displayActivities.slice(0, 4).map((activity, index) => {
            const { icon: Icon, color } = getActivityIcon(activity.action);
            const amount = activity.metadata?.amount || 0;
            
            return (
              <div
                key={index}
                className="activity-item flex items-center justify-between py-3"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{activity.description}</p>
                    <p className="text-gray-400 text-xs">
                      {formatTimeAgo(activity.createdAt)}
                    </p>
                  </div>
                </div>
                {amount !== 0 && (
                  <span className={`text-sm font-medium ${
                    amount >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(amount))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        {activities?.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
