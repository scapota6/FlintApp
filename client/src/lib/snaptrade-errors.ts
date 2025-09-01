/**
 * Frontend error handling for SnapTrade API responses
 * Provides user-friendly error messages and recovery actions
 */

import type { KnownErrorCode, ErrorResponse } from '@shared/types';

export interface ErrorHandlingResult {
  shouldRetry: boolean;
  shouldReconnect: boolean;
  shouldRegister: boolean;
  userMessage: string;
  retryDelay?: number;
}

/**
 * Handles SnapTrade API errors and provides recovery guidance
 */
export function handleSnapTradeError(error: ErrorResponse | Error): ErrorHandlingResult {
  // Handle network/fetch errors
  if (error instanceof Error) {
    return {
      shouldRetry: true,
      shouldReconnect: false,
      shouldRegister: false,
      userMessage: 'Network error. Please check your connection and try again.',
      retryDelay: 3000
    };
  }

  const errorCode = error.error.code as KnownErrorCode;

  switch (errorCode) {
    case 'SNAPTRADE_NOT_REGISTERED':
      return {
        shouldRetry: false,
        shouldReconnect: false,
        shouldRegister: true,
        userMessage: 'Account setup required. Please connect your brokerage account.'
      };

    case 'SNAPTRADE_USER_MISMATCH':
      return {
        shouldRetry: false,
        shouldReconnect: false,
        shouldRegister: true,
        userMessage: 'Account mismatch detected. Please reconnect your brokerage account.'
      };

    case 'SIGNATURE_INVALID':
      return {
        shouldRetry: false,
        shouldReconnect: true,
        shouldRegister: false,
        userMessage: 'Authentication expired. Please reconnect your brokerage account.'
      };

    case 'RATE_LIMITED':
      return {
        shouldRetry: true,
        shouldReconnect: false,
        shouldRegister: false,
        userMessage: 'Please try again in a moment',
        retryDelay: 5000
      };

    case 'CONNECTION_DISABLED':
      return {
        shouldRetry: false,
        shouldReconnect: true,
        shouldRegister: false,
        userMessage: 'Connection disabled. Please reconnect your brokerage account.'
      };

    case 'UNKNOWN':
    default:
      return {
        shouldRetry: true,
        shouldReconnect: false,
        shouldRegister: false,
        userMessage: error.error.message || 'Something went wrong. Please try again.',
        retryDelay: 3000
      };
  }
}

/**
 * Creates user-friendly error messages for toasts
 */
export function getErrorToastMessage(error: ErrorResponse | Error): {
  title: string;
  description: string;
  variant: 'destructive' | 'default';
} {
  const result = handleSnapTradeError(error);
  
  if (result.shouldRegister) {
    return {
      title: 'Account Setup Required',
      description: result.userMessage,
      variant: 'default'
    };
  }
  
  if (result.shouldReconnect) {
    return {
      title: 'Reconnection Required',
      description: result.userMessage,
      variant: 'default'
    };
  }
  
  if (result.shouldRetry) {
    return {
      title: 'Temporary Issue',
      description: result.userMessage,
      variant: 'destructive'
    };
  }
  
  return {
    title: 'Error',
    description: result.userMessage,
    variant: 'destructive'
  };
}

/**
 * Auto-retry logic for rate limited requests
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if this is a rate limit error
      const errorResponse = error as ErrorResponse;
      if (errorResponse?.error?.code === 'RATE_LIMITED') {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`[SnapTrade] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry non-rate-limit errors
      break;
    }
  }
  
  throw lastError;
}