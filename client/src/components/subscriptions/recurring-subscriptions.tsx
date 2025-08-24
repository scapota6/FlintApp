import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Play, 
  Zap, 
  Code, 
  Dumbbell,
  Building2,
  Package
} from 'lucide-react';

interface RecurringSubscription {
  id: string;
  merchantName: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate: string;
  lastTransactionDate: string;
  confidence: number;
  category: string;
  accountName: string;
  transactions: Array<{
    id: string;
    date: string;
    amount: number;
    description: string;
  }>;
}

interface SubscriptionData {
  subscriptions: RecurringSubscription[];
  totalMonthlySpend: number;
}

export default function RecurringSubscriptions() {
  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ['/api/subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/subscriptions', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
  });

  const subscriptions = data?.subscriptions || [];
  const totalMonthlySpend = data?.totalMonthlySpend || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels = {
      weekly: 'Weekly',
      monthly: 'Monthly', 
      quarterly: 'Quarterly',
      yearly: 'Yearly'
    };
    return labels[frequency as keyof typeof labels] || frequency;
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      'Streaming': <Play className="h-4 w-4" />,
      'Utilities': <Zap className="h-4 w-4" />,
      'Software': <Code className="h-4 w-4" />,
      'Fitness': <Dumbbell className="h-4 w-4" />,
      'Financial': <Building2 className="h-4 w-4" />,
      'Other': <Package className="h-4 w-4" />
    };
    return icons[category as keyof typeof icons] || <Package className="h-4 w-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'Streaming': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Utilities': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Software': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Fitness': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Financial': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Other': 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[category as keyof typeof colors] || colors.Other;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <Card className="flint-card">
        <CardHeader>
          <CardTitle>Recurring Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                    <div>
                      <div className="h-4 bg-gray-700 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-700 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-700 rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flint-card">
        <CardHeader>
          <CardTitle>Recurring Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Unable to load subscriptions</p>
            <p className="text-sm">Connect your bank accounts to track recurring payments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flint-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recurring Subscriptions</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-600/20 text-purple-400">
              {subscriptions.length} Active
            </Badge>
            {totalMonthlySpend > 0 && (
              <Badge variant="secondary" className="bg-green-600/20 text-green-400">
                {formatCurrency(totalMonthlySpend)}/mo
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {subscriptions.length > 0 ? (
            subscriptions.map((subscription) => (
              <div 
                key={subscription.id} 
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg border ${getCategoryColor(subscription.category)}`}>
                    {getCategoryIcon(subscription.category)}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{subscription.merchantName}</div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      <span>{getFrequencyLabel(subscription.frequency)}</span>
                      <span>•</span>
                      <span>{subscription.accountName}</span>
                      <span className={`${getConfidenceColor(subscription.confidence)}`}>
                        ({Math.round(subscription.confidence * 100)}% confidence)
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {formatCurrency(subscription.amount)}
                  </div>
                  <div className="text-sm text-gray-400 flex items-center justify-end gap-1">
                    <Calendar className="h-3 w-3" />
                    Next: {formatDate(subscription.nextBillingDate)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No recurring subscriptions found</p>
              <p className="text-sm">We analyze your transactions to detect recurring payments</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => window.location.href = '/connections'}
              >
                Connect Bank Account
              </Button>
            </div>
          )}
        </div>

        {/* Summary */}
        {subscriptions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Monthly</span>
                <span className="text-white font-semibold">{formatCurrency(totalMonthlySpend)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Annual Cost</span>
                <span className="text-white font-semibold">{formatCurrency(totalMonthlySpend * 12)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Data source info */}
        <div className="text-xs text-gray-500 text-center pt-4 mt-4 border-t border-gray-800">
          Analyzed from your bank & credit card transactions • Updates every 30 minutes
        </div>
      </CardContent>
    </Card>
  );
}