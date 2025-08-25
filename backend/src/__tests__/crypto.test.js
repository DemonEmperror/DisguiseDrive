const cryptoService = require('../services/crypto');

describe('CryptoService', () => {
  describe('generateFileKey', () => {
    it('should generate a 32-byte file key', () => {
      const key = cryptoService.generateFileKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = cryptoService.generateFileKey();
      const key2 = cryptoService.generateFileKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('generateSalt', () => {
    it('should generate a 32-byte salt', () => {
      const salt = cryptoService.generateSalt();
      expect(salt).toBeInstanceOf(Buffer);
      expect(salt.length).toBe(32);
    });

    it('should generate unique salts', () => {
      const salt1 = cryptoService.generateSalt();
      const salt2 = cryptoService.generateSalt();
      expect(salt1.equals(salt2)).toBe(false);
    });
  });

  describe('deriveKeyFromPassword', () => {
    it('should derive consistent keys from same password and salt', async () => {
      const password = 'testpassword123';
      const salt = cryptoService.generateSalt();
      
      const key1 = await cryptoService.deriveKeyFromPassword(password, salt);
      const key2 = await cryptoService.deriveKeyFromPassword(password, salt);
      
      expect(key1.equals(key2)).toBe(true);
      expect(key1.length).toBe(32);
    });

    it('should derive different keys for different passwords', async () => {
      const salt = cryptoService.generateSalt();
      
      const key1 = await cryptoService.deriveKeyFromPassword('password1', salt);
      const key2 = await cryptoService.deriveKeyFromPassword('password2', salt);
      
      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive different keys for different salts', async () => {
      const password = 'testpassword123';
      
      const key1 = await cryptoService.deriveKeyFromPassword(password, cryptoService.generateSalt());
      const key2 = await cryptoService.deriveKeyFromPassword(password, cryptoService.generateSalt());
      
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encryptData and decryptData', () => {
    it('should encrypt and decrypt data successfully', () => {
      const originalData = Buffer.from('Hello, World! This is test data.');
      const key = cryptoService.generateFileKey();
      
      const { encryptedData, iv, authTag } = cryptoService.encryptData(originalData, key);
      const decryptedData = cryptoService.decryptData(encryptedData, key, iv, authTag);
      
      expect(decryptedData.equals(originalData)).toBe(true);
    });

    it('should fail decryption with wrong key', () => {
      const originalData = Buffer.from('Hello, World!');
      const key1 = cryptoService.generateFileKey();
      const key2 = cryptoService.generateFileKey();
      
      const { encryptedData, iv, authTag } = cryptoService.encryptData(originalData, key1);
      
      expect(() => {
        cryptoService.decryptData(encryptedData, key2, iv, authTag);
      }).toThrow();
    });

    it('should fail decryption with tampered data', () => {
      const originalData = Buffer.from('Hello, World!');
      const key = cryptoService.generateFileKey();
      
      const { encryptedData, iv, authTag } = cryptoService.encryptData(originalData, key);
      
      // Tamper with encrypted data
      encryptedData[0] = encryptedData[0] ^ 1;
      
      expect(() => {
        cryptoService.decryptData(encryptedData, key, iv, authTag);
      }).toThrow();
    });
  });

  describe('encryptFileKey and decryptFileKey', () => {
    it('should encrypt and decrypt file key with password', async () => {
      const fileKey = cryptoService.generateFileKey();
      const password = 'testpassword123';
      const salt = cryptoService.generateSalt();
      
      const { encryptedKeyBlob } = await cryptoService.encryptFileKey(fileKey, password, salt);
      const decryptedKey = await cryptoService.decryptFileKey(
        encryptedKeyBlob, 
        password, 
        salt.toString('base64')
      );
      
      expect(decryptedKey.equals(fileKey)).toBe(true);
    });

    it('should fail decryption with wrong password', async () => {
      const fileKey = cryptoService.generateFileKey();
      const salt = cryptoService.generateSalt();
      
      const { encryptedKeyBlob } = await cryptoService.encryptFileKey(fileKey, 'password1', salt);
      
      await expect(
        cryptoService.decryptFileKey(encryptedKeyBlob, 'password2', salt.toString('base64'))
      ).rejects.toThrow();
    });
  });

  describe('calculateHash', () => {
    it('should calculate consistent SHA-256 hash', () => {
      const data = Buffer.from('Hello, World!');
      
      const hash1 = cryptoService.calculateHash(data);
      const hash2 = cryptoService.calculateHash(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // 64 hex characters
    });

    it('should calculate different hashes for different data', () => {
      const data1 = Buffer.from('Hello, World!');
      const data2 = Buffer.from('Hello, Universe!');
      
      const hash1 = cryptoService.calculateHash(data1);
      const hash2 = cryptoService.calculateHash(data2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateToken', () => {
    it('should generate base64url token of specified length', () => {
      const token = cryptoService.generateToken(32);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url pattern
    });

    it('should generate unique tokens', () => {
      const token1 = cryptoService.generateToken();
      const token2 = cryptoService.generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('encryptFileForStorage', () => {
    it('should encrypt file data and return all components', () => {
      const fileData = Buffer.from('This is test file data for encryption.');
      
      const result = cryptoService.encryptFileForStorage(fileData);
      
      expect(result.encryptedData).toBeInstanceOf(Buffer);
      expect(result.fileKey).toBeInstanceOf(Buffer);
      expect(result.iv).toBeInstanceOf(Buffer);
      expect(result.authTag).toBeInstanceOf(Buffer);
      
      expect(result.fileKey.length).toBe(32);
      expect(result.iv.length).toBe(12);
      expect(result.authTag.length).toBe(16);
    });
  });

  describe('createStorageBlob and parseStorageBlob', () => {
    it('should create and parse storage blob correctly', () => {
      const encryptedData = Buffer.from('encrypted data');
      const iv = Buffer.from('123456789012'); // 12 bytes
      const authTag = Buffer.from('1234567890123456'); // 16 bytes
      
      const blob = cryptoService.createStorageBlob(encryptedData, iv, authTag);
      const parsed = cryptoService.parseStorageBlob(blob);
      
      expect(parsed.iv.equals(iv)).toBe(true);
      expect(parsed.authTag.equals(authTag)).toBe(true);
      expect(parsed.encryptedData.equals(encryptedData)).toBe(true);
    });
  });
});
