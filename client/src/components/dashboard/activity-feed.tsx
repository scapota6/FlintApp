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
      case 'BUY':
        return { icon: Plus, color: 'bg-green-500' };
      case 'SELL':
        return { icon: Plus, color: 'bg-red-500' };
      case 'transfer_completed':
      case 'TRANSFER':
        return { icon: ArrowLeftRight, color: 'bg-blue-500' };
      case 'DEPOSIT':
        return { icon: ArrowDown, color: 'bg-green-600' };
      case 'WITHDRAWAL':
        return { icon: ArrowDown, color: 'bg-red-600' };
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

  // Safely handle activities array - prevent crashes
  const safeActivities = Array.isArray(activities) ? activities : [];
  
  // Mock transaction history for demo purposes when no real data available
  const mockTransactions = [
    {
      action: 'BUY',
      description: 'Bought 10 shares of AAPL',
      symbol: 'AAPL',
      quantity: 10,
      price: 175.50,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: -1755.00, type: 'trade' },
    },
    {
      action: 'SELL',
      description: 'Sold 5 shares of TSLA',
      symbol: 'TSLA',
      quantity: 5,
      price: 245.80,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: 1229.00, type: 'trade' },
    },
    {
      action: 'DEPOSIT',
      description: 'Bank Transfer from Chase ****1234',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: 2500.00, type: 'transfer' },
    },
    {
      action: 'BUY',
      description: 'Bought 15 shares of GOOGL',
      symbol: 'GOOGL',
      quantity: 15,
      price: 142.30,
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: -2134.50, type: 'trade' },
    },
    {
      action: 'WITHDRAWAL',
      description: 'Transfer to External Account',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: -1000.00, type: 'transfer' },
    },
    {
      action: 'BUY',
      description: 'Bought 8 shares of MSFT',
      symbol: 'MSFT',
      quantity: 8,
      price: 385.20,
      createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: -3081.60, type: 'trade' },
    },
    {
      action: 'SELL',
      description: 'Sold 12 shares of NVDA',
      symbol: 'NVDA', 
      quantity: 12,
      price: 425.75,
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: 5109.00, type: 'trade' },
    },
    {
      action: 'DEPOSIT',
      description: 'Payroll Direct Deposit',
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: 3200.00, type: 'transfer' },
    },
    {
      action: 'BUY',
      description: 'Bought 25 shares of AMD',
      symbol: 'AMD',
      quantity: 25,
      price: 165.40,
      createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: -4135.00, type: 'trade' },
    },
    {
      action: 'SELL',
      description: 'Sold 6 shares of META',
      symbol: 'META',
      quantity: 6,
      price: 485.90,
      createdAt: new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString(),
      metadata: { amount: 2915.40, type: 'trade' },
    }
  ];

  // Show last 10 transactions, prioritizing real data over mock
  const displayActivities = safeActivities.length > 0 ? safeActivities.slice(0, 10) : mockTransactions;

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
        <div className="space-y-2">
          {displayActivities.slice(0, 10).map((activity, index) => {
            const { icon: Icon, color } = getActivityIcon(activity.action);
            const amount = activity.metadata?.amount || 0;
            const isTradeActivity = ['BUY', 'SELL', 'trade_executed'].includes(activity.action);
            
            return (
              <div
                key={index}
                className="activity-item flex items-center justify-between py-3 px-2 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-all duration-200"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium text-sm truncate">{activity.description}</p>
                      <span className={`text-sm font-semibold ml-2 ${
                        amount >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(amount))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-medium">
                          {activity.action}
                        </span>
                        {isTradeActivity && activity.symbol && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400 font-medium">{activity.symbol}</span>
                          </>
                        )}
                        {isTradeActivity && activity.quantity && (
                          <>
                            <span>•</span>
                            <span>{activity.quantity} shares</span>
                          </>
                        )}
                        {isTradeActivity && activity.price && (
                          <>
                            <span>•</span>
                            <span>@{formatCurrency(activity.price)}</span>
                          </>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">
                        {new Date(activity.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {safeActivities.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">Showing demo transaction history</p>
            <p className="text-gray-500 text-sm mt-1">Connect your brokerage account to see real trades</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
