/**
 * Cryptographic utilities for secure token generation
 */
import crypto from 'crypto';

/**
 * Generate a secure user secret for SnapTrade authentication
 * @returns A 64-character hex string suitable for SnapTrade userSecret
 */
export function generateUserSecret(): string {
  // Generate 32 random bytes and convert to hex string (64 characters)
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a secure random token
 * @param length Number of bytes (default 32)
 * @returns A hex string of length*2 characters
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data for secure storage/logging
 * @param data The data to hash
 * @returns SHA256 hash of the data
 */
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate HMAC signature for SnapTrade requests
 * @param message The message to sign
 * @param secret The secret key
 * @returns Base64 encoded HMAC-SHA256 signature
 */
export function generateHmacSignature(message: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64');
}