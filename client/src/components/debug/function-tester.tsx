import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bug, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database,
  TrendingUp,
  ArrowLeftRight,
  BookmarkIcon,
  Activity,
  CreditCard,
  User,
  Newspaper,
  Building,
  Settings
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
  timestamp?: string;
}

export default function FunctionTester() {
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testData, setTestData] = useState({
    symbol: 'AAPL',
    quantity: '10',
    price: '150.00',
    transferAmount: '1000',
    fromAccountId: '1',
    toAccountId: '2',
  });

  const updateTestResult = (name: string, status: TestResult['status'], message?: string, data?: any) => {
    setTestResults(prev => {
      const updated = prev.filter(r => r.name !== name);
      return [...updated, {
        name,
        status,
        message,
        data,
        timestamp: new Date().toLocaleTimeString()
      }];
    });
  };

  const functions = [
    {
      name: 'Dashboard Data',
      icon: <Database className="h-4 w-4" />,
      description: 'Test dashboard data fetch',
      test: async () => {
        console.log('🔍 Testing Dashboard Data Fetch');
        const response = await fetch('/api/dashboard', {
          credentials: 'include'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('📊 Dashboard data:', data);
        return data;
      }
    },
    {
      name: 'User Authentication',
      icon: <User className="h-4 w-4" />,
      description: 'Test user auth status',
      test: async () => {
        console.log('🔍 Testing User Authentication');
        const response = await fetch('/api/auth/user', {
          credentials: 'include'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('👤 User data:', data);
        return data;
      }
    },
    {
      name: 'SnapTrade Registration',
      icon: <TrendingUp className="h-4 w-4" />,
      description: 'Test SnapTrade user registration',
      test: async () => {
        console.log('🔍 Testing SnapTrade Registration');
        const response = await fetch('/api/snaptrade/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log('📈 SnapTrade registration:', data);
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        return data;
      }
    },
    {
      name: 'SnapTrade Connect URL',
      icon: <Building className="h-4 w-4" />,
      description: 'Test SnapTrade connection URL generation',
      test: async () => {
        console.log('🔍 Testing SnapTrade Connect URL');
        const response = await fetch('/api/snaptrade/connect-url', {
          credentials: 'include'
        });
        const data = await response.json();
        console.log('🔗 SnapTrade connect URL:', data);
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        return data;
      }
    },
    {
      name: 'Symbol Search',
      icon: <TrendingUp className="h-4 w-4" />,
      description: 'Test stock symbol search',
      test: async () => {
        console.log('🔍 Testing Symbol Search for:', testData.symbol);
        const response = await fetch(`/api/search?q=${testData.symbol}`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('🔍 Search results:', data);
        return data;
      }
    },
    {
      name: 'Trade Execution',
      icon: <TrendingUp className="h-4 w-4" />,
      description: 'Test trade execution (simulation)',
      test: async () => {
        console.log('🔍 Testing Trade Execution');
        const tradeData = {
          symbol: testData.symbol,
          quantity: testData.quantity,
          price: testData.price,
          side: 'buy',
          orderType: 'market',
          accountId: 1
        };
        console.log('📊 Trade data:', tradeData);
        
        const response = await fetch('/api/trades', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tradeData)
        });
        const data = await response.json();
        console.log('💰 Trade result:', data);
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        return data;
      }
    },
    {
      name: 'Transfer Execution',
      icon: <ArrowLeftRight className="h-4 w-4" />,
      description: 'Test transfer execution',
      test: async () => {
        console.log('🔍 Testing Transfer Execution');
        const transferData = {
          fromAccountId: parseInt(testData.fromAccountId),
          toAccountId: parseInt(testData.toAccountId),
          amount: testData.transferAmount,
          description: 'Test transfer'
        };
        console.log('💸 Transfer data:', transferData);
        
        const response = await fetch('/api/transfers', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transferData)
        });
        const data = await response.json();
        console.log('🔄 Transfer result:', data);
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        return data;
      }
    },
    {
      name: 'Watchlist Management',
      icon: <BookmarkIcon className="h-4 w-4" />,
      description: 'Test watchlist add/remove',
      test: async () => {
        console.log('🔍 Testing Watchlist Management');
        const watchlistData = {
          symbol: testData.symbol,
          assetType: 'stock'
        };
        console.log('⭐ Watchlist data:', watchlistData);
        
        const response = await fetch('/api/watchlist', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(watchlistData)
        });
        const data = await response.json();
        console.log('📋 Watchlist result:', data);
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        return data;
      }
    },
    {
      name: 'Activity Log',
      icon: <Activity className="h-4 w-4" />,
      description: 'Test activity logging',
      test: async () => {
        console.log('🔍 Testing Activity Log');
        const response = await fetch('/api/log-login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log('📝 Activity log result:', data);
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        return data;
      }
    },
    {
      name: 'News Feed',
      icon: <Newspaper className="h-4 w-4" />,
      description: 'Test news data fetch',
      test: async () => {
        console.log('🔍 Testing News Feed');
        const response = await fetch('/api/news', {
          credentials: 'include'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        console.log('📰 News data:', data);
        return data;
      }
    },
    {
      name: 'Profile Update',
      icon: <User className="h-4 w-4" />,
      description: 'Test profile management',
      test: async () => {
        console.log('🔍 Testing Profile Update');
        const profileData = {
          firstName: 'Test',
          lastName: 'User'
        };
        console.log('👤 Profile data:', profileData);
        
        const response = await fetch('/api/users/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileData)
        });
        const data = await response.json();
        console.log('✏️ Profile update result:', data);
        if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
        return data;
      }
    }
  ];

  const runTest = async (func: typeof functions[0]) => {
    updateTestResult(func.name, 'running');
    try {
      const result = await func.test();
      updateTestResult(func.name, 'success', 'Test completed successfully', result);
      toast({
        title: `✅ ${func.name}`,
        description: 'Test completed successfully'
      });
    } catch (error: any) {
      console.error(`❌ ${func.name} failed:`, error);
      updateTestResult(func.name, 'error', error.message, error);
      toast({
        title: `❌ ${func.name}`,
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const runAllTests = async () => {
    console.log('🧪 Running all function tests...');
    for (const func of functions) {
      await runTest(func);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('🏁 All tests completed');
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running': return <Clock className="h-4 w-4 animate-spin" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Play className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Bug className="h-5 w-5" />
            Function Testing & Debugging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-white">Test Symbol</Label>
              <Input
                value={testData.symbol}
                onChange={(e) => setTestData(prev => ({ ...prev, symbol: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Quantity</Label>
              <Input
                value={testData.quantity}
                onChange={(e) => setTestData(prev => ({ ...prev, quantity: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Price</Label>
              <Input
                value={testData.price}
                onChange={(e) => setTestData(prev => ({ ...prev, price: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={runAllTests}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Run All Tests
            </Button>
            <Button 
              variant="outline"
              onClick={() => setTestResults([])}
              className="border-gray-700 text-white hover:bg-gray-800"
            >
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {functions.map((func) => {
          const result = testResults.find(r => r.name === func.name);
          return (
            <Card key={func.name} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {func.icon}
                      <span className="font-medium text-white">{func.name}</span>
                    </div>
                    {getStatusIcon(result?.status || 'idle')}
                  </div>
                  
                  <p className="text-sm text-gray-400">{func.description}</p>
                  
                  {result && (
                    <div className="space-y-2">
                      <Badge 
                        className={
                          result.status === 'success' ? 'bg-green-600' :
                          result.status === 'error' ? 'bg-red-600' :
                          result.status === 'running' ? 'bg-yellow-600' :
                          'bg-gray-600'
                        }
                      >
                        {result.status}
                      </Badge>
                      {result.message && (
                        <p className="text-xs text-gray-300">{result.message}</p>
                      )}
                      {result.timestamp && (
                        <p className="text-xs text-gray-500">{result.timestamp}</p>
                      )}
                    </div>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runTest(func)}
                    disabled={result?.status === 'running'}
                    className="w-full border-gray-700 text-white hover:bg-gray-800"
                  >
                    Test Function
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {testResults.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result) => (
                <div key={result.name} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                  <span className="text-white">{result.name}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="text-sm text-gray-400">{result.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}