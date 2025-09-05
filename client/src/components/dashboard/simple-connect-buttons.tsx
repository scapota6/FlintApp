/**
 * ⚠️ DO NOT CHANGE THIS CONNECT FLOW unless the product owner says "bubble gum".
 * Post-connect work = only display/data mapping. No flow/endpoint changes.
 */

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
import { getCsrfToken } from "@/lib/csrf";

import { CONNECT_LOCKED } from '@/utils/featureFlags';

// Runtime guard to warn in dev if someone edits these files without the "bubble gum" env flag
if (CONNECT_LOCKED) {
  console.warn('Connect flows are locked. Say "bubble gum" to change them.');
  // Only warn, don't block in development
}

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

  // Teller Connect mutation - Proper CSRF implementation
  const tellerConnectMutation = useMutation({
    mutationFn: async () => {
      console.log('🏦 Teller Connect: Starting bank connection with SDK');
      
      try {
        // Get fresh CSRF token
        console.log('🏦 Teller Connect: Getting CSRF token');
        const tokenRes = await fetch('/api/csrf-token', { credentials: 'include' });
        const { csrfToken } = await tokenRes.json();
        
        // Get Teller application ID with CSRF protection
        console.log('🏦 Teller Connect: Getting application ID');
        let initResponse = await fetch("/api/teller/connect-init", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken
          },
          body: JSON.stringify({ mode: 'connect' })
        });
        
        // Auto-retry once with fresh token if 403 CSRF error
        if (initResponse.status === 403) {
          console.log('🏦 Teller Connect: CSRF error, retrying with fresh token');
          const t2 = await fetch('/api/csrf-token', { credentials: 'include' }).then(r => r.json());
          initResponse = await fetch("/api/teller/connect-init", {
            method: "POST",
            credentials: "include", 
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": t2.csrfToken
            },
            body: JSON.stringify({ mode: 'connect' })
          });
        }
        
        if (!initResponse.ok) {
          const errorData = await initResponse.json();
          throw new Error(errorData.message || 'Failed to initialize Teller Connect');
        }
        
        const initData = await initResponse.json();
        console.log('🏦 Teller Connect: Init response:', initData);
        
        const { applicationId, environment } = initData;
        
        if (!applicationId) {
          throw new Error('No application ID received from server');
        }
        
        // Check if TellerConnect SDK is available
        if (typeof (window as any).TellerConnect === 'undefined') {
          throw new Error('Teller Connect SDK not loaded. Please refresh the page.');
        }
        
        console.log('🏦 Setting up Teller Connect SDK with applicationId:', applicationId);
        
        return new Promise((resolve, reject) => {
          console.log('🏦 Initializing Teller with sandbox mode and applicationId:', applicationId);
          
          // Initialize Teller Connect with SDK - Explicitly force sandbox mode
          const tellerConnect = (window as any).TellerConnect.setup({
            applicationId: applicationId,
            environment: 'sandbox', // Explicitly force sandbox mode
            products: ['verify', 'balance', 'transactions', 'identity'],
            selectAccount: 'multiple', // Allow multiple account selection
            skipPicker: false, // Show institution picker
            onInit: () => {
              console.log('🏦 Teller Connect SDK initialized in SANDBOX mode');
            },
            onSuccess: async (enrollment: any) => {
              console.log('🏦 Teller Connect: Success with enrollment:', enrollment);
              
              // Save the account using the access token
              try {
                console.log('🏦 Saving account to backend');
                
                // Get fresh CSRF token for save-account call
                const saveTokenRes = await fetch('/api/csrf-token', { credentials: 'include' });
                const { csrfToken: saveToken } = await saveTokenRes.json();
                
                const saveResponse = await fetch('/api/teller/save-account', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': saveToken
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    accessToken: enrollment.accessToken,
                    enrollmentId: enrollment.enrollment?.id,
                    institution: enrollment.enrollment?.institution?.name
                  })
                });
                
                if (!saveResponse.ok) {
                  const errorData = await saveResponse.json();
                  throw new Error(errorData.message || 'Failed to save account');
                }
                
                const saveData = await saveResponse.json();
                console.log('🏦 Account saved:', saveData);
                
                // Refresh data
                queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
                queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
                
                resolve({ success: true });
              } catch (error) {
                console.error('🏦 Error saving account:', error);
                reject(error);
              }
            },
            onExit: () => {
              console.log('🏦 Teller Connect: User exited');
              reject(new Error('Connection cancelled by user'));
            },
            onFailure: (failure: any) => {
              console.error('🏦 Teller Connect: Failure:', failure);
              reject(new Error(failure.message || 'Connection failed'));
            }
          });
          
          // Open Teller Connect modal
          tellerConnect.open();
        });
        
      } catch (error) {
        console.error('🏦 Teller Connect: Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('🏦 Teller Connect: Bank account connected successfully');
      toast({
        title: "Bank Account Connected",
        description: "Your bank account has been successfully connected.",
      });
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

  // SnapTrade Connect mutation - simplified
  const snapTradeConnectMutation = useMutation({
    mutationFn: async () => {
      console.log('📈 SnapTrade Connect: Starting brokerage connection');
      
      // Get user ID for SnapTrade registration
      const userResp = await apiRequest("/api/auth/user");
      if (!userResp.ok) throw new Error("Authentication required");
      const currentUser = await userResp.json();
      
      const resp = await apiRequest("/api/connections/snaptrade/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: currentUser.id })
      });

      // Handle both Response and plain JSON from apiRequest
      const data = (typeof resp?.json === 'function') ? await resp.json() : resp;
      if (resp?.ok === false || (resp?.status && !resp.ok)) throw new Error(data?.message || "Failed to start SnapTrade Connect");

      const url: string | undefined = data?.redirectUrl;
      if (!url) throw new Error("No SnapTrade Connect URL returned");
      
      console.log('📈 SnapTrade Connect: Redirecting to URL:', url);
      window.location.href = url;
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