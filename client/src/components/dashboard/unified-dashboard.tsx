import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { Building2, TrendingUp, DollarSign, Wallet, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AccountDetailsDialog from '../AccountDetailsDialog';

interface AccountBalance {
  id: string;
  provider: string;
  accountName: string;
  balance: number;
  type: 'bank' | 'investment' | 'crypto' | 'credit';
  institution?: string;
  percentOfTotal?: number;
  availableCredit?: number | null;
  needsReconnection?: boolean;
}

interface DashboardData {
  totalBalance: number;
  bankBalance: number;
  investmentValue: number;
  cryptoValue: number;
  accounts: AccountBalance[];
  subscriptionTier: string;
  needsConnection?: boolean;
  connectionStatus?: {
    hasAccounts: boolean;
    snapTradeError: string | null;
    message: string | null;
  };
}

interface ProviderSummary {
  provider: string;
  institution: string;
  totalBalance: number;
  accountCount: number;
  type: 'bank' | 'investment' | 'crypto';
  color: string;
}

const COLORS = {
  bank: '#10b981', // green
  investment: '#8b5cf6', // purple
  crypto: '#f59e0b', // orange
};

const PROVIDER_COLORS = [
  '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899'
];

export default function UnifiedDashboard() {
  const [selectedView, setSelectedView] = useState<'overview' | 'accounts' | 'providers'>('overview');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const { user } = useAuth();

  // Use same query key as parent component for data consistency
  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["teller", "accounts", "balances"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    staleTime: 12 * 60 * 60 * 1000, // 12 hours - matches Teller refresh cadence
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in cache for 24 hours
    refetchInterval: false, // Don't auto-refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when connection restored
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading state for net worth header */}
        <Card className="flint-card">
          <CardHeader>
            <CardTitle className="text-center">
              <div className="animate-pulse">
                <div className="text-lg text-gray-400 mb-2">Total Net Worth</div>
                <div className="h-12 bg-gray-700 rounded mx-auto w-48 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded mx-auto w-64"></div>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
        
        {/* Loading skeleton for cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="flint-card">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/3 mt-2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <Card className="flint-card">
        <CardContent className="p-6 text-center">
          <div className="text-red-400 mb-2">Failed to load dashboard data</div>
          <div className="text-gray-400 text-sm">Please check your API connections</div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for charts
  const typeBreakdown = [
    { name: 'Banking', value: dashboardData.bankBalance, color: COLORS.bank },
    { name: 'Investments', value: dashboardData.investmentValue, color: COLORS.investment },
    { name: 'Crypto', value: dashboardData.cryptoValue, color: COLORS.crypto },
  ].filter(item => item.value > 0);

  // Group accounts by provider for provider view
  const providerSummary: ProviderSummary[] = dashboardData.accounts.reduce((acc, account) => {
    const existingProvider = acc.find(p => p.provider === account.provider);
    if (existingProvider) {
      existingProvider.totalBalance += account.balance;
      existingProvider.accountCount += 1;
    } else {
      acc.push({
        provider: account.provider,
        institution: account.institution || account.provider,
        totalBalance: account.balance,
        accountCount: 1,
        type: account.type,
        color: PROVIDER_COLORS[acc.length % PROVIDER_COLORS.length]
      });
    }
    return acc;
  }, [] as ProviderSummary[]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Building2 className="h-5 w-5" />;
      case 'investment': return <TrendingUp className="h-5 w-5" />;
      case 'crypto': return <Wallet className="h-5 w-5" />;
      default: return <DollarSign className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Total Net Worth */}
      <Card className="flint-card">
        <CardHeader>
          <CardTitle className="text-center">
            <div className="text-lg text-gray-400 mb-2">Total Net Worth</div>
            <div className="text-4xl font-bold text-white">
              {dashboardData.needsConnection ? 
                <span className="text-gray-500">Connect accounts</span> : 
                formatCurrency(dashboardData.totalBalance)
              }
            </div>
            <div className="text-sm text-gray-400 mt-2">
              {dashboardData.needsConnection 
                ? 'Connect your accounts to see your portfolio'
                : `Across ${dashboardData.accounts.length} connected accounts`
              }
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* View Toggle */}
      <div className="flex space-x-2 justify-center">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'accounts', label: 'Accounts' },
          { key: 'providers', label: 'Providers' }
        ].map(view => (
          <button
            key={view.key}
            onClick={() => setSelectedView(view.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedView === view.key
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Overview - Pie Chart */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="flint-card">
            <CardHeader>
              <CardTitle>Asset Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              {typeBreakdown.length > 0 && !dashboardData.needsConnection ? (
                <div className="chart-container chart-glow relative overflow-hidden">
                  {/* Animated background effects */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-green-500/5 to-blue-500/10 rounded-lg blur-2xl animate-pulse"></div>
                  <div className="floating-element absolute top-0 left-0 w-24 h-24 bg-purple-500/20 rounded-full blur-3xl"></div>
                  <div className="floating-element absolute bottom-0 right-0 w-20 h-20 bg-green-500/20 rounded-full blur-2xl" style={{animationDelay: '2s'}}></div>
                  <div className="floating-element absolute top-1/2 right-1/4 w-16 h-16 bg-blue-500/15 rounded-full blur-2xl" style={{animationDelay: '1s'}}></div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <defs>
                        {/* 3D Effect Gradients */}
                        <radialGradient id="bankingGradient3D" cx="30%" cy="30%">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={1}/>
                          <stop offset="50%" stopColor="#10b981" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#047857" stopOpacity={0.9}/>
                        </radialGradient>
                        <radialGradient id="investmentGradient3D" cx="30%" cy="30%">
                          <stop offset="0%" stopColor="#c084fc" stopOpacity={1}/>
                          <stop offset="50%" stopColor="#8b5cf6" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.9}/>
                        </radialGradient>
                        <radialGradient id="cryptoGradient3D" cx="30%" cy="30%">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={1}/>
                          <stop offset="50%" stopColor="#f59e0b" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.9}/>
                        </radialGradient>
                      </defs>
                      <Pie
                        data={typeBreakdown}
                        cx="50%"
                        cy="47%"
                        innerRadius={65}
                        outerRadius={120}
                        paddingAngle={6}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1200}
                        animationEasing="ease-out"
                        startAngle={90}
                        endAngle={450}
                      >
                        {typeBreakdown.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.name === 'Banking' ? 'url(#bankingGradient3D)' :
                              entry.name === 'Investments' ? 'url(#investmentGradient3D)' :
                              'url(#cryptoGradient3D)'
                            }
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth={3}
                            style={{
                              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3)) drop-shadow(0 0 20px rgba(139, 92, 246, 0.3))',
                              cursor: 'pointer'
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-400 mb-2">No account data available</p>
                    {dashboardData.needsConnection && (
                      <p className="text-sm text-gray-500">Connect a brokerage or bank to see your allocation</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flint-card">
            <CardHeader>
              <CardTitle>Account Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {typeBreakdown.length > 0 && !dashboardData.needsConnection ? (
                typeBreakdown.map((type, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: type.color }}
                      ></div>
                      <span className="text-white">{type.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">
                        {formatCurrency(type.value)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {((type.value / dashboardData.totalBalance) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-400 mb-2">No account data available</p>
                    {dashboardData.needsConnection && (
                      <p className="text-sm text-gray-500">Connect accounts to see breakdown</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accounts View */}
      {selectedView === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardData.accounts.map((account) => (
            <Card key={account.id} className="flint-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${
                      account.type === 'bank' ? 'bg-green-600/20 text-green-400' :
                      account.type === 'investment' ? 'bg-purple-600/20 text-purple-400' :
                      'bg-orange-600/20 text-orange-400'
                    }`}>
                      {getProviderIcon(account.type)}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {account.accountName === 'Default' && account.institutionName === 'Coinbase' 
                          ? 'Coinbase' 
                          : account.accountName}
                      </div>
                      <div className="text-gray-400 text-sm capitalize">{account.provider}</div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    account.type === 'credit' ? 'text-red-500' : 'text-green-500'
                  }`}>
                    {formatCurrency(account.balance)}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {account.type === 'credit' ? 
                      account.availableCredit ? `Credit available — ${formatCurrency(account.availableCredit)}` : 'Credit card' :
                      account.percentOfTotal ? `${account.percentOfTotal}% of total` : '—'
                    }
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-purple-400 hover:text-purple-300 mt-2"
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {dashboardData.accounts.length === 0 && (
            <Card className="flint-card col-span-full">
              <CardContent className="p-6 text-center">
                <div className="text-gray-400 mb-2">No accounts connected</div>
                <div className="text-gray-500 text-sm">Connect your bank and brokerage accounts to see your portfolio</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Providers View */}
      {selectedView === 'providers' && (
        <div className="space-y-6">
          <Card className="flint-card">
            <CardHeader>
              <CardTitle>Balance by Provider</CardTitle>
            </CardHeader>
            <CardContent>
              {providerSummary.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={providerSummary}>
                    <XAxis dataKey="institution" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="totalBalance" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-300 flex items-center justify-center text-gray-400">
                  No provider data available
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providerSummary.map((provider, index) => (
              <Card key={index} className="flint-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        provider.type === 'bank' ? 'bg-green-600/20 text-green-400' :
                        provider.type === 'investment' ? 'bg-purple-600/20 text-purple-400' :
                        'bg-orange-600/20 text-orange-400'
                      }`}>
                        {getProviderIcon(provider.type)}
                      </div>
                      <div>
                        <div className="text-white font-medium">{provider.institution}</div>
                        <div className="text-gray-400 text-sm">
                          {provider.accountCount} account{provider.accountCount > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-lg font-bold">
                        {formatCurrency(provider.totalBalance)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {((provider.totalBalance / dashboardData.totalBalance) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Account Details Dialog */}
      <AccountDetailsDialog
        accountId={selectedAccountId || ''}
        open={!!selectedAccountId}
        onClose={() => setSelectedAccountId(null)}
        currentUserId={String(user?.id || '')}
      />
    </div>
  );
}