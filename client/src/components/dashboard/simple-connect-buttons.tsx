import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, TrendingUp, ExternalLink, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TellerAPI } from "@/lib/teller-api";
import { SnapTradeAPI } from "@/lib/snaptrade-api";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { ensureCsrf } from "@/lib/csrf";

interface SimpleConnectButtonsProps {
  accounts: any[];
  userTier: string;
  isAdmin?: boolean;
}

export default function SimpleConnectButtons({ accounts, userTier, isAdmin }: SimpleConnectButtonsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Removed loading animations as requested by user
  
  // Listen for postMessage from SnapTrade callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin === window.location.origin && 
          (event.data.snaptradeConnected || event.data.type === 'SNAPTRADE_DONE')) {
        toast({
          title: "Connection Complete",
          description: "Syncing your accounts...",
        });
        
        // Automatically sync accounts
        try {
          const syncResponse = await apiRequest('/api/snaptrade/sync', {
            method: 'POST'
          });
          const syncData = await syncResponse.json();
          
          if (syncData.success) {
            toast({
              title: "Accounts Synced",
              description: `Successfully synced ${syncData.syncedCount} account(s)`,
            });
            // Refresh dashboard
            await queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
          }
        } catch (error) {
          console.error('Auto-sync error:', error);
          toast({
            title: "Sync Failed", 
            description: "Please try again",
            variant: "destructive",
          });
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast, queryClient]);

  // Check account limits based on user tier
  const getAccountLimit = (tier: string, isAdmin?: boolean) => {
    // Admin users get unlimited accounts
    if (isAdmin) return Infinity;
    
    switch (tier) {
      case 'free': return 2;
      case 'basic': return 3;
      case 'pro': return 10;
      case 'premium': return Infinity;
      default: return 2;
    }
  };

  const accountLimit = getAccountLimit(userTier, isAdmin);
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
        await ensureCsrf();
        const initResponse = await fetch("/api/teller/connect-init", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": localStorage.getItem('csrfToken') || ''
          }
        });
        
        if (!initResponse.ok) {
          const errorData = await initResponse.json();
          throw new Error(errorData.message || 'Failed to initialize Teller Connect');
        }
        
        const initData = await initResponse.json();
        console.log('🏦 Teller Connect: Init response:', initData);
        
        const { applicationId, environment, redirectUri } = initData;
        
        if (!applicationId) {
          throw new Error('No application ID received from server');
        }
        
        console.log('🏦 Teller Connect: Opening popup with applicationId:', applicationId);
        
        return new Promise((resolve, reject) => {
          // Use the redirect URI from the server
          const callbackUrl = redirectUri || `${window.location.origin}/teller/callback`;
          
          // Open Teller Connect in popup with callback
          const left = (window.screen.width - 500) / 2;
          const top = (window.screen.height - 700) / 2;
          const popup = window.open(
            `https://teller.io/connect/${applicationId}?redirect_uri=${encodeURIComponent(callbackUrl)}`,
            'tellerConnect',
            `width=500,height=700,top=${top},left=${left},toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,popup=yes`
          );
          
          if (!popup) {
            reject(new Error('Popup blocked. Please allow popups for this site.'));
            return;
          }
          
          // Listen for successful connection from callback page
          const messageHandler = (event: MessageEvent) => {
            console.log('🏦 Teller Connect: Received message:', event);
            
            // Listen for message from our callback page
            if (event.origin === window.location.origin && event.data.tellerConnected) {
              console.log('🏦 Teller Connect: Success message received from callback');
              window.removeEventListener('message', messageHandler);
              popup?.close();
              
              // Refresh dashboard data
              queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
              queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
              
              resolve({ success: true });
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

  // SnapTrade Connect mutation - use authenticated user ID
  const snapTradeConnectMutation = useMutation({
    mutationFn: async () => {
      // Get authenticated user data first
      const userResp = await apiRequest("/api/auth/user");
      if (!userResp.ok) throw new Error("Authentication required");
      const currentUser = await userResp.json();
      
      // Use stable userId (currentUser.id is the stable internal identifier)
      const userId = currentUser.id;
      if (!userId) throw new Error("User ID not available");

      console.log('📈 SnapTrade Connect: Using userId:', userId);
      
      const resp = await apiRequest("/api/connections/snaptrade/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({ userId: currentUser.id }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Failed to start SnapTrade Connect");

      const url: string | undefined = data?.connect?.url;
      if (!url) throw new Error("No SnapTrade Connect URL returned");
      
      console.log('📈 SnapTrade Connect: Opening popup with URL:', url);
      
      // Open SnapTrade Connect in popup window
      const left = (window.screen.width - 500) / 2;
      const top = (window.screen.height - 700) / 2;
      const popup = window.open(
        url,
        'snaptradeConnect',
        `width=500,height=700,top=${top},left=${left},toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,popup=yes`
      );
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      // Check if popup is closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          console.log('📈 SnapTrade Connect: Popup closed by user');
          // Refresh dashboard data
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
          queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
        }
      }, 1000);
      
      // Clear interval after 5 minutes
      setTimeout(() => clearInterval(checkClosed), 300000);
      
      return true;
    },
    onSuccess: () => {
      console.log('📈 SnapTrade Connect: Success callback triggered');
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
                      Connect Bank/Credit Card
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