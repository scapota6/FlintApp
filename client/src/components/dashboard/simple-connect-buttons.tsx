import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, TrendingUp, ExternalLink, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TellerAPI } from "@/lib/teller-api";
import { SnapTradeAPI } from "@/lib/snaptrade-api";

import { apiRequest } from "@/lib/queryClient";

interface SimpleConnectButtonsProps {
  accounts: any[];
  userTier: string;
}

export default function SimpleConnectButtons({ accounts, userTier }: SimpleConnectButtonsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Removed loading animations as requested by user

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

  // Teller Connect mutation - simplified and debugged
  const tellerConnectMutation = useMutation({
    mutationFn: async () => {
      console.log('🏦 Teller Connect: Starting bank connection process');
      
      try {
        // Get Teller application ID
        console.log('🏦 Teller Connect: Calling /api/teller/connect-init');
        const initResponse = await apiRequest("POST", "/api/teller/connect-init");
        const initData = await initResponse.json();
        console.log('🏦 Teller Connect: Init response:', initData);
        
        const { applicationId, environment } = initData;
        
        if (!applicationId) {
          throw new Error('No application ID received from server');
        }
        
        console.log('🏦 Teller Connect: Opening popup with applicationId:', applicationId);
        
        return new Promise((resolve, reject) => {
          // Open Teller Connect in popup
          const popup = window.open(
            `https://teller.io/connect/${applicationId}`,
            'teller',
            'width=500,height=600,scrollbars=yes,resizable=yes'
          );
          
          if (!popup) {
            reject(new Error('Popup blocked. Please allow popups for this site.'));
            return;
          }
          
          // Listen for successful connection
          const messageHandler = (event: MessageEvent) => {
            console.log('🏦 Teller Connect: Received message:', event);
            
            if (event.origin === 'https://teller.io' && event.data.type === 'teller-connect-success') {
              const token = event.data.accessToken;
              console.log('🏦 Teller Connect: Success, exchanging token');
              
              // Exchange token with backend
              apiRequest("POST", "/api/teller/exchange-token", { token })
                .then(() => {
                  console.log('🏦 Teller Connect: Token exchange successful');
                  window.removeEventListener('message', messageHandler);
                  popup?.close();
                  resolve({ success: true });
                })
                .catch((error) => {
                  console.error('🏦 Teller Connect: Token exchange failed:', error);
                  reject(error);
                });
            }
          };
          
          window.addEventListener('message', messageHandler);
          
          // Handle popup close
          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', messageHandler);
              console.log('🏦 Teller Connect: Popup closed by user');
              reject(new Error('Connection cancelled by user'));
            }
          }, 1000);
          
          // Timeout after 5 minutes
          setTimeout(() => {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            popup?.close();
            reject(new Error('Connection timeout - please try again'));
          }, 300000);
        });
        
      } catch (error) {
        console.error('🏦 Teller Connect: Error in mutation function:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('🏦 Teller Connect: Success callback triggered');
      toast({
        title: "Bank Account Connected",
        description: "Your bank account has been successfully connected.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: any) => {
      console.error('🏦 Teller Connect Error:', error);
      toast({
        title: "Connection Failed",
        description: error?.message || "Unable to connect bank account. Please try again.",
        variant: "destructive",
      });
    }
  });

  // SnapTrade Connect mutation - simplified flow with auto-registration
  const snapTradeConnectMutation = useMutation({
    mutationFn: async () => {
      console.log('📈 SnapTrade Connect: Starting brokerage connection process');
      try {
        console.log('📈 SnapTrade Connect: Calling backend for connection URL...');
        // The backend now handles registration automatically
        const { url } = await SnapTradeAPI.getConnectionUrl();
        console.log('📈 SnapTrade Connect: Successfully got connection URL:', url);
        
        // Open SnapTrade portal in new window (user will complete connection there)
        const popup = window.open(url, '_blank', 'width=500,height=600,scrollbars=yes,resizable=yes');
        
        if (!popup) {
          throw new Error('Popup blocked. Please allow popups and try again.');
        }
        
        console.log('📈 SnapTrade Connect: Opened connection popup successfully');
        return { success: true };
      } catch (error) {
        console.error('📈 SnapTrade Connect Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('📈 SnapTrade Connect: Success callback triggered');
      toast({
        title: "Brokerage Connection Initiated",
        description: "Complete the connection in the new window, then refresh this page.",
      });
    },
    onError: (error: any) => {
      console.error('📈 SnapTrade Connect Error:', error);
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
                          // Step 1: Ensure SnapTrade user exists (one per Flint user)
                          await apiRequest('POST', '/api/snaptrade/register-user');
                          
                          // Step 2: Generate connection portal URL
                          const response = await apiRequest('POST', '/api/snaptrade/connection-portal');
                          const data = await response.json();
                          
                          if (data.success && data.portalUrl) {
                            // Open SnapTrade connection portal (official approach)
                            window.open(data.portalUrl, '_blank', 'width=800,height=600');
                            toast({
                              title: "SnapTrade Connection Portal",
                              description: "Complete the brokerage connection in the new window",
                            });
                          } else {
                            throw new Error(data.message || 'Failed to generate portal URL');
                          }
                        } catch (error: any) {
                          console.error('SnapTrade connection error:', error);
                          toast({
                            title: "Connection Error", 
                            description: error.message || "Failed to start SnapTrade connection. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                      variant="outline"
                      className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Connect Brokerage
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          const response = await apiRequest('GET', '/api/snaptrade/accounts');
                          const data = await response.json();
                          toast({
                            title: "Success",
                            description: `Found ${data.accounts?.length || 0} SnapTrade account(s)`,
                          });
                          await queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
                        } catch (error: any) {
                          console.error('List accounts error:', error);
                          toast({
                            title: "Error", 
                            description: error.message || "Failed to list accounts. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                      variant="outline"
                      className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      List Accounts
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

      {/* Loading animations removed per user request */}
    </div>
  );
}