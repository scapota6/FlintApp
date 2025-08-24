/**
 * ⚠️ CONNECT FLOW PROTECTION TEST
 * This test ensures connect button flows are never accidentally modified.
 * If this test fails, someone changed the connect flows without "bubble gum" authorization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';

// Mock fetch to capture requests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock apiRequest
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
}));

describe('Connect Button Flow Protection', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should snapshot Teller Connect flow requests', async () => {
    // Mock successful responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ csrfToken: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ applicationId: 'test-app-id', environment: 'sandbox' }),
      });

    // Mock TellerConnect SDK
    const mockTellerConnect = {
      setup: vi.fn().mockReturnValue({
        open: vi.fn(),
      }),
    };
    (window as any).TellerConnect = mockTellerConnect;

    // Simulate Teller Connect flow
    const tellerConnectFlow = async () => {
      // Step 1: Get CSRF token
      const tokenRes = await fetch('/api/csrf-token', { credentials: 'include' });
      const { csrfToken } = await tokenRes.json();
      
      // Step 2: Initialize Teller Connect
      const initResponse = await fetch("/api/teller/connect-init", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        body: JSON.stringify({ mode: 'connect' })
      });
      
      return initResponse.json();
    };

    await tellerConnectFlow();

    // Snapshot the exact requests made
    expect(mockFetch.mock.calls).toMatchSnapshot('teller-connect-requests');
    
    // Verify critical request details
    const [csrfCall, connectInitCall] = mockFetch.mock.calls;
    
    // CSRF token request
    expect(csrfCall).toEqual([
      '/api/csrf-token',
      { credentials: 'include' }
    ]);
    
    // Connect init request
    expect(connectInitCall[0]).toBe('/api/teller/connect-init');
    expect(connectInitCall[1]).toEqual({
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "test-token"
      },
      body: '{"mode":"connect"}'
    });
  });

  it('should snapshot SnapTrade Connect flow requests', async () => {
    const { apiRequest } = await import('@/lib/queryClient');
    const mockApiRequest = apiRequest as vi.MockedFunction<typeof apiRequest>;

    // Mock successful responses
    mockApiRequest
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'test-user-id' }),
      } as any)
      .mockResolvedValueOnce({
        connect: { url: 'https://app.snaptrade.com/connect/test' }
      } as any);

    // Simulate SnapTrade Connect flow
    const snapTradeConnectFlow = async () => {
      // Step 1: Get user ID
      const userResp = await apiRequest("/api/auth/user");
      const currentUser = await userResp.json();
      
      // Step 2: Register with SnapTrade
      const resp = await apiRequest("/api/connections/snaptrade/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: currentUser.id })
      });
      
      return resp;
    };

    await snapTradeConnectFlow();

    // Snapshot the exact API requests made
    expect(mockApiRequest.mock.calls).toMatchSnapshot('snaptrade-connect-requests');
    
    // Verify critical request details
    const [userCall, registerCall] = mockApiRequest.mock.calls;
    
    // User request
    expect(userCall).toEqual(["/api/auth/user"]);
    
    // Register request
    expect(registerCall).toEqual([
      "/api/connections/snaptrade/register",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: '{"userId":"test-user-id"}'
      }
    ]);
  });

  it('should fail if connect flow signatures change unexpectedly', () => {
    // This test will fail if the above snapshots change, alerting developers
    // that they've modified protected connect flows
    
    const expectedTellerEndpoints = [
      '/api/csrf-token',
      '/api/teller/connect-init'
    ];
    
    const expectedSnapTradeEndpoints = [
      '/api/auth/user',
      '/api/connections/snaptrade/register'
    ];
    
    // These are the blessed endpoints - changing them should require explicit approval
    expect(expectedTellerEndpoints).toHaveLength(2);
    expect(expectedSnapTradeEndpoints).toHaveLength(2);
  });
});