import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, TrendingUp, ExternalLink, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TellerAPI } from "@/lib/teller-api";
import { SnapTradeAPI } from "@/lib/snaptrade-api";
import { ConnectionStoryTeller } from "@/components/ui/connection-storyteller";
import { apiRequest } from "@/lib/queryClient";

interface SimpleConnectButtonsProps {
  accounts: any[];
  userTier: string;
}

export default function SimpleConnectButtons({ accounts, userTier }: SimpleConnectButtonsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showBankStoryTeller, setShowBankStoryTeller] = useState(false);
  const [showBrokerageStoryTeller, setShowBrokerageStoryTeller] = useState(false);

  // Check account limits based on user tier
  const getAccountLimit = (tier: string) => {
    switch (tier) {
      case 'free': return 2;
      case 'basic': return 3;
      case 'pro': return 10;
      case 'premium': return Infinity;
      default: return 2;
    }
  };

  const accountLimit = getAccountLimit(userTier);
  const connectedAccounts = accounts.length;
  const canConnectMore = connectedAccounts < accountLimit;

  // Check if specific account types are connected
  const hasBankAccount = accounts.some(acc => acc.accountType === 'bank');
  const hasBrokerageAccount = accounts.some(acc => acc.accountType === 'brokerage' || acc.accountType === 'crypto');

  // Teller Connect mutation
  const tellerConnectMutation = useMutation({
    mutationFn: async () => {
      // Show storyteller
      setShowBankStoryTeller(true);
      
      // Open Teller Connect
      const { applicationId } = await TellerAPI.initiateTellerConnect();
      
      return new Promise((resolve, reject) => {
        // @ts-ignore - TellerConnect is loaded via CDN
        if (typeof TellerConnect === 'undefined') {
          reject(new Error('Teller Connect SDK not loaded'));
          return;
        }
        
        const tellerConnect = TellerConnect.setup({
          applicationId,
          environment: 'sandbox',
          onSuccess: (enrollment: any) => {
            resolve(enrollment);
          },
          onExit: () => {
            reject(new Error('User cancelled connection'));
          }
        });
        
        tellerConnect.open();
      });
    },
    onSuccess: async (enrollment: any) => {
      try {
        await TellerAPI.exchangeToken(enrollment.accessToken);
        toast({
          title: "Bank Account Connected",
          description: "Your bank account has been successfully connected!",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      } catch (error) {
        toast({
          title: "Connection Error",
          description: "Failed to complete bank account connection.",
          variant: "destructive",
        });
      } finally {
        setShowBankStoryTeller(false);
      }
    },
    onError: (error: any) => {
      setShowBankStoryTeller(false);
      if (error.message !== 'User cancelled connection') {
        toast({
          title: "Connection Failed",
          description: error.message || "Unable to connect bank account.",
          variant: "destructive",
        });
      }
    },
  });

  // SnapTrade Connect mutation
  const snapTradeConnectMutation = useMutation({
    mutationFn: async () => {
      // Show storyteller
      setShowBrokerageStoryTeller(true);
      
      const { url } = await SnapTradeAPI.getConnectionUrl();
      
      // Give some time for the storyteller to animate before redirecting
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Redirect to SnapTrade OAuth in same window
      window.location.href = url;
      
      return new Promise((resolve) => {
        // This will resolve when user returns to dashboard
        resolve(true);
      });
    },
    onSuccess: () => {
      toast({
        title: "Brokerage Account Connected",
        description: "Your brokerage account has been successfully connected!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Unable to connect brokerage account.",
        variant: "destructive",
      });
    },
  });

  const handleUpgradeNeeded = () => {
    toast({
      title: "Account Limit Reached",
      description: `Free users can only connect ${accountLimit} accounts. Upgrade to connect more.`,
      variant: "destructive",
    });
    // Redirect to subscription page
    window.location.href = '/subscribe';
  };

  return (
    <div className="mb-8">
      <Card className="trade-card shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">Quick Connect</CardTitle>
            <Badge variant="outline" className="border-gray-600 text-gray-300">
              {connectedAccounts} / {accountLimit === Infinity ? '∞' : accountLimit} connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bank/Credit Connection */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <Building className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium">Bank & Credit</h3>
                  <p className="text-gray-400 text-sm">Connect via Teller.io</p>
                </div>
              </div>
              
              {hasBankAccount ? (
                <div className="flex items-center space-x-2">
                  <Badge className="bg-green-600 text-white">Connected</Badge>
                  <span className="text-gray-400 text-sm">Bank account linked</span>
                </div>
              ) : (
                <Button
                  onClick={() => {
                    if (!canConnectMore) {
                      handleUpgradeNeeded();
                      return;
                    }
                    tellerConnectMutation.mutate();
                  }}
                  disabled={tellerConnectMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {tellerConnectMutation.isPending ? (
                    "Connecting..."
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connect Bank Account
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Brokerage/Crypto Connection */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-medium">Brokerage & Crypto</h3>
                  <p className="text-gray-400 text-sm">Connect via SnapTrade</p>
                </div>
              </div>
              
              {hasBrokerageAccount ? (
                <div className="flex items-center space-x-2">
                  <Badge className="bg-green-600 text-white">Connected</Badge>
                  <span className="text-gray-400 text-sm">Brokerage account linked</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={() => {
                      if (!canConnectMore) {
                        handleUpgradeNeeded();
                        return;
                      }
                      snapTradeConnectMutation.mutate();
                    }}
                    disabled={snapTradeConnectMutation.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {snapTradeConnectMutation.isPending ? (
                      "Connecting..."
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Connect Brokerage
                      </>
                    )}
                  </Button>
                  <div className="grid grid-cols-3 gap-1">
                    <Button
                      onClick={async () => {
                        try {
                          const response = await apiRequest('GET', '/api/snaptrade/status');
                          const data = await response.json();
                          toast({
                            title: "Success",
                            description: `SnapTrade API working! Version: ${data.status?.version}`,
                          });
                        } catch (error: any) {
                          console.error('API status error:', error);
                          toast({
                            title: "Error", 
                            description: error.message || "SnapTrade API connection failed.",
                            variant: "destructive",
                          });
                        }
                      }}
                      variant="outline"
                      className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Test API
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await apiRequest('POST', '/api/snaptrade/create-fresh-account');
                          const data = await response.json();
                          toast({
                            title: "Success",
                            description: `Fresh SnapTrade account created! ID: ${data.uniqueUserId || 'Created'}`,
                          });
                          await queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
                        } catch (error: any) {
                          console.error('Fresh account error:', error);
                          toast({
                            title: "Error", 
                            description: error.message || "Failed to create fresh account. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                      variant="outline"
                      className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Fresh Account
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await apiRequest('GET', '/api/snaptrade/sync-accounts');
                          const data = await response.json();
                          toast({
                            title: "Success",
                            description: `Synced ${data.accountCount || 0} account(s) from SnapTrade`,
                          });
                          await queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
                        } catch (error: any) {
                          console.error('Sync accounts error:', error);
                          toast({
                            title: "Error", 
                            description: error.message || "Failed to sync accounts. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                      variant="outline"
                      className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Sync Accounts
                    </Button>

                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Limit Warning */}
          {!canConnectMore && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <span className="text-yellow-400 text-sm">
                  Account limit reached. 
                  <button
                    onClick={handleUpgradeNeeded}
                    className="underline ml-1 hover:text-yellow-300"
                  >
                    Upgrade to connect more
                  </button>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Storytellers */}
      {showBankStoryTeller && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <ConnectionStoryTeller
            isActive={showBankStoryTeller}
            connectionType="bank"
            onComplete={() => setShowBankStoryTeller(false)}
            onError={() => setShowBankStoryTeller(false)}
          />
        </div>
      )}

      {showBrokerageStoryTeller && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <ConnectionStoryTeller
            isActive={showBrokerageStoryTeller}
            connectionType="brokerage"
            onComplete={() => setShowBrokerageStoryTeller(false)}
            onError={() => setShowBrokerageStoryTeller(false)}
          />
        </div>
      )}
    </div>
  );
}