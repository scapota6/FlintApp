/**
 * Server-side validation utilities for SnapTrade API responses
 * Ensures DTOs have proper nullable field handling and consistent validation
 */

import { z } from 'zod';

/**
 * Validates a DTO against a schema and ensures nullable fields are explicitly set to null
 * This prevents React components from exploding when fields are undefined
 */
export function validate<T>(dto: unknown, schema: z.ZodSchema<T>): T {
  const result = schema.safeParse(dto);
  
  if (!result.success) {
    console.error('[Validation] Schema validation failed:', result.error);
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  
  return ensureNullableFields(result.data);
}

/**
 * Recursively ensures all undefined values in an object are converted to null
 * This prevents React components from breaking when expecting nullable fields
 */
function ensureNullableFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(ensureNullableFields) as T;
  }
  
  if (typeof obj === 'object') {
    const result = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      (result as any)[key] = value === undefined ? null : ensureNullableFields(value);
    }
    return result;
  }
  
  return obj;
}

/**
 * Creates a standardized API error with traceability
 */
export function createApiError(
  message: string, 
  code: string = 'UNKNOWN',
  statusCode: number = 500,
  requestId?: string
): Error & { code: string; statusCode: number; requestId?: string } {
  const error = new Error(message) as Error & { 
    code: string; 
    statusCode: number; 
    requestId?: string;
  };
  
  error.code = code;
  error.statusCode = statusCode;
  if (requestId) {
    error.requestId = requestId;
  }
  
  return error;
}

/**
 * Extracts SnapTrade request ID from response headers for error traceability
 */
export function extractSnapTradeRequestId(response: any): string | undefined {
  if (response?.headers) {
    return response.headers['x-request-id'] || response.headers['X-Request-ID'];
  }
  return undefined;
}