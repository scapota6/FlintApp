/**
 * Encryption Service for Secure Token Storage
 * Implements AES-256-GCM encryption for provider tokens and sensitive data
 */

import crypto from 'crypto';

export class EncryptionService {
  private static instance: EncryptionService;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;  // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly saltLength = 64; // 512 bits
  private encryptionKey: Buffer;

  private constructor() {
    // Derive encryption key from environment secret
    const masterKey = process.env.ENCRYPTION_MASTER_KEY || process.env.SESSION_SECRET || 'default-dev-key';
    const salt = process.env.ENCRYPTION_SALT || 'flint-security-salt';
    
    // Use PBKDF2 to derive a strong encryption key
    this.encryptionKey = crypto.pbkdf2Sync(masterKey, salt, 100000, this.keyLength, 'sha256');
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypt sensitive data
   * @param plaintext The data to encrypt
   * @returns Encrypted data with IV and auth tag
   */
  public encrypt(plaintext: string): string {
    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the data
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get the auth tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV + authTag + encrypted data
      const combined = Buffer.concat([iv, authTag, encrypted]);
      
      // Return base64 encoded string
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   * @param encryptedData Base64 encoded encrypted data
   * @returns Decrypted plaintext
   */
  public decrypt(encryptedData: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure random token
   * @param length Token length in bytes
   * @returns Hex encoded random token
   */
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data for storage (one-way)
   * @param data Data to hash
   * @returns Hashed data
   */
  public hashData(data: string): string {
    const salt = crypto.randomBytes(this.saltLength);
    const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha256');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }

  /**
   * Verify hashed data
   * @param data Plain text data
   * @param hashedData Previously hashed data
   * @returns True if data matches
   */
  public verifyHash(data: string, hashedData: string): boolean {
    try {
      const [salt, hash] = hashedData.split(':');
      const verifyHash = crypto.pbkdf2Sync(
        data, 
        Buffer.from(salt, 'hex'), 
        10000, 
        64, 
        'sha256'
      );
      return verifyHash.toString('hex') === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotate encryption keys (for secret rotation)
   * @param oldKey Previous encryption key
   * @param data Encrypted data to re-encrypt
   * @returns Re-encrypted data with new key
   */
  public rotateEncryption(oldKeyData: string, encryptedData: string): string {
    // Temporarily use old key to decrypt
    const tempKey = this.encryptionKey;
    const oldSalt = process.env.OLD_ENCRYPTION_SALT || 'old-salt';
    this.encryptionKey = crypto.pbkdf2Sync(oldKeyData, oldSalt, 100000, this.keyLength, 'sha256');
    
    // Decrypt with old key
    const decrypted = this.decrypt(encryptedData);
    
    // Restore new key and encrypt
    this.encryptionKey = tempKey;
    return this.encrypt(decrypted);
  }

  /**
   * Check if encryption keys are properly configured
   * @returns True if encryption is properly set up
   */
  public isConfigured(): boolean {
    return !!(process.env.ENCRYPTION_MASTER_KEY || process.env.SESSION_SECRET);
  }

  /**
   * Get encryption status for monitoring
   */
  public getStatus(): {
    configured: boolean;
    algorithm: string;
    keyDerivation: string;
    lastRotation?: Date;
  } {
    return {
      configured: this.isConfigured(),
      algorithm: this.algorithm,
      keyDerivation: 'PBKDF2-SHA256',
      lastRotation: process.env.LAST_KEY_ROTATION ? new Date(process.env.LAST_KEY_ROTATION) : undefined
    };
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();