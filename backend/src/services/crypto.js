const crypto = require('crypto');
const argon2 = require('argon2');

/**
 * Crypto service for handling encryption/decryption operations
 */
class CryptoService {
  constructor() {
    // Argon2 configuration from environment or defaults
    this.argon2Config = {
      type: argon2.argon2id,
      memoryCost: parseInt(process.env.ARGON2_MEMORY) || 65536, // 64MB
      timeCost: parseInt(process.env.ARGON2_ITERATIONS) || 3,
      parallelism: parseInt(process.env.ARGON2_PARALLELISM) || 1,
      hashLength: 32 // 256 bits
    };
  }

  /**
   * Generate a random 256-bit file encryption key
   * @returns {Buffer} Random 32-byte key
   */
  generateFileKey() {
    return crypto.randomBytes(32); // 256 bits
  }

  /**
   * Generate a random salt for password derivation
   * @returns {Buffer} Random 32-byte salt
   */
  generateSalt() {
    return crypto.randomBytes(32);
  }

  /**
   * Derive a key from password using Argon2
   * @param {string} password - The password to derive from
   * @param {Buffer} salt - The salt to use
   * @returns {Promise<Buffer>} Derived key
   */
  async deriveKeyFromPassword(password, salt) {
    try {
      // Use crypto.pbkdf2 instead of argon2 for simpler key derivation
      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        });
      });
    } catch (error) {
      throw new Error(`Key derivation failed: ${error.message}`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {Buffer} data - Data to encrypt
   * @param {Buffer} key - 256-bit encryption key
   * @returns {Object} { encryptedData: Buffer, iv: Buffer, authTag: Buffer }
   */
  encryptData(data, key) {
    const iv = crypto.randomBytes(12); // 12 bytes for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('DisguiseDrive-v1'));
    
    let encryptedData = cipher.update(data);
    encryptedData = Buffer.concat([encryptedData, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return { encryptedData, iv, authTag };
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {Buffer} encryptedData - Encrypted data
   * @param {Buffer} key - 256-bit decryption key
   * @param {Buffer} iv - Initialization vector
   * @param {Buffer} authTag - Authentication tag
   * @returns {Buffer} Decrypted data
   */
  decryptData(encryptedData, key, iv, authTag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from('DisguiseDrive-v1'));
    decipher.setAuthTag(authTag);
    
    let decryptedData = decipher.update(encryptedData);
    decryptedData = Buffer.concat([decryptedData, decipher.final()]);
    
    return decryptedData;
  }

  /**
   * Encrypt file key with password-derived key
   * @param {Buffer} fileKey - The file encryption key to protect
   * @param {string} password - User's per-image password
   * @param {Buffer} salt - Salt for password derivation
   * @returns {Promise<Object>} { encryptedKeyBlob: string, salt: string }
   */
  async encryptFileKey(fileKey, password, salt) {
    try {
      console.log('encryptFileKey - inputs:', { 
        fileKey: fileKey ? fileKey.length : 'undefined', 
        password: password ? password.length : 'undefined', 
        salt: salt ? salt.length : 'undefined' 
      });
      
      if (!fileKey || !password || !salt) {
        throw new Error('Missing required parameters: fileKey, password, or salt');
      }
      
      // Derive key from password
      const passwordKey = await this.deriveKeyFromPassword(password, salt);
      console.log('passwordKey derived:', passwordKey ? passwordKey.length : 'undefined');
      
      if (!passwordKey) {
        throw new Error('Failed to derive password key');
      }
      
      // Encrypt file key with password-derived key
      const encryptResult = this.encryptData(fileKey, passwordKey);
      console.log('encryptData result:', encryptResult);
      
      if (!encryptResult || !encryptResult.encryptedData || !encryptResult.iv || !encryptResult.authTag) {
        throw new Error('Failed to encrypt file key data');
      }
      
      const { encryptedData, iv, authTag } = encryptResult;
      
      // Combine all components into a single blob: [IV (12 bytes)] [AuthTag (16 bytes)] [Encrypted Data]
      const keyBlob = Buffer.concat([
        iv,           // 12 bytes for GCM
        authTag,      // 16 bytes
        encryptedData // 32 bytes (file key)
      ]);
      
      const result = {
        encryptedKeyBlob: keyBlob.toString('base64'),
        salt: salt.toString('base64')
      };
      
      console.log('encryptFileKey result:', result);
      return result;
    } catch (error) {
      console.error('encryptFileKey error:', error);
      throw new Error(`File key encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt file key with password-derived key
   * @param {string} encryptedKeyBlob - Base64 encoded encrypted key blob
   * @param {string} password - User's per-image password
   * @param {string} saltBase64 - Base64 encoded salt
   * @returns {Promise<Buffer>} Decrypted file key
   */
  async decryptFileKey(encryptedKeyBlob, password, saltBase64) {
    try {
      const keyBlob = Buffer.from(encryptedKeyBlob, 'base64');
      const salt = Buffer.from(saltBase64, 'base64');
      
      // Extract components from blob: [IV (12 bytes)] [AuthTag (16 bytes)] [Encrypted Data]
      const iv = keyBlob.subarray(0, 12);
      const authTag = keyBlob.subarray(12, 28);
      const encryptedData = keyBlob.subarray(28);
      
      // Derive key from password
      const passwordKey = await this.deriveKeyFromPassword(password, salt);
      
      // Decrypt file key
      const fileKey = this.decryptData(encryptedData, passwordKey, iv, authTag);
      
      return fileKey;
    } catch (error) {
      throw new Error(`File key decryption failed: ${error.message}`);
    }
  }

  /**
   * Calculate SHA-256 hash of data
   * @param {Buffer} data - Data to hash
   * @returns {string} Hex-encoded hash
   */
  calculateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} Base64-encoded token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Encrypt file data for storage
   * @param {Buffer} fileData - Original file data
   * @returns {Object} { encryptedData: Buffer, fileKey: Buffer, iv: Buffer, authTag: Buffer }
   */
  encryptFileForStorage(fileData) {
    const fileKey = this.generateFileKey();
    const { encryptedData, iv, authTag } = this.encryptData(fileData, fileKey);
    
    return {
      encryptedData,
      fileKey,
      iv,
      authTag
    };
  }

  /**
   * Create storage blob with metadata for S3
   * @param {Buffer} encryptedData - Encrypted file data
   * @param {Buffer} iv - Initialization vector
   * @param {Buffer} authTag - Authentication tag
   * @returns {Buffer} Combined blob for storage
   */
  createStorageBlob(encryptedData, iv, authTag) {
    // Format: [IV (12 bytes)] [AuthTag (16 bytes)] [Encrypted Data]
    return Buffer.concat([iv, authTag, encryptedData]);
    const metadataLengthBuffer = Buffer.allocUnsafe(4);
    metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);
    
    // Combine: [metadata_length][metadata][iv][encrypted_data]
    return Buffer.concat([
      metadataLengthBuffer,
      metadataBuffer,
      iv,
      encryptedData
    ]);
  }

  /**
   * Parse storage blob from S3
   * @param {Buffer} storageBlob - Combined blob from storage
   * @returns {Object} { encryptedData: Buffer, iv: Buffer, authTag: Buffer }
   */
  parseStorageBlob(storageBlob) {
    const metadataLength = storageBlob.readUInt32BE(0);
    const metadataBuffer = storageBlob.subarray(4, 4 + metadataLength);
    const metadataJson = metadataBuffer.toString('utf8');
    const metadata = JSON.parse(metadataJson);
    
    const iv = storageBlob.subarray(4 + metadataLength, 4 + metadataLength + metadata.ivLength);
    const encryptedData = storageBlob.subarray(4 + metadataLength + metadata.ivLength);
    
    return { encryptedData, iv };
  }
}

module.exports = new CryptoService();
