const { Client } = require('minio');
const path = require('path');

/**
 * Storage service for handling S3/MinIO operations
 */
class StorageService {
  constructor() {
    this.client = null;
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'disguisedrive';
    this.initialized = false;
  }

  /**
   * Initialize MinIO/S3 client
   */
  async initialize() {
    try {
      // Use MinIO for local development, AWS S3 for production
      if (process.env.NODE_ENV === 'production' && process.env.AWS_REGION) {
        // AWS S3 configuration
        this.client = new Client({
          endPoint: 's3.amazonaws.com',
          region: process.env.AWS_REGION,
          accessKey: process.env.AWS_ACCESS_KEY_ID,
          secretKey: process.env.AWS_SECRET_ACCESS_KEY,
          useSSL: true
        });
        this.bucketName = process.env.S3_BUCKET_NAME || this.bucketName;
      } else {
        // MinIO configuration for development
        this.client = new Client({
          endPoint: process.env.MINIO_ENDPOINT || 'localhost',
          port: parseInt(process.env.MINIO_PORT) || 9000,
          useSSL: process.env.MINIO_USE_SSL === 'true',
          accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
          secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
        });
      }

      // Ensure bucket exists
      const bucketExists = await this.client.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.client.makeBucket(this.bucketName);
        console.log(`✅ Created bucket: ${this.bucketName}`);
      }

      // Set bucket policy for covers (public read for cover images)
      const coverPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/covers/*`]
          }
        ]
      };

      try {
        await this.client.setBucketPolicy(this.bucketName, JSON.stringify(coverPolicy));
      } catch (policyError) {
        console.warn('⚠️ Could not set bucket policy (MinIO might not support it):', policyError.message);
      }

      this.initialized = true;
      console.log(`✅ Storage service initialized with bucket: ${this.bucketName}`);
    } catch (error) {
      console.error('❌ Storage initialization failed:', error);
      throw error;
    }
  }

  /**
   * Upload encrypted file blob to storage
   * @param {Buffer} data - Encrypted file data
   * @param {string} fileName - File name/path
   * @param {string} contentType - MIME type
   * @returns {Promise<string>} Storage path
   */
  async uploadEncryptedFile(data, fileName, contentType = 'application/octet-stream') {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      const storagePath = `encrypted/${Date.now()}-${fileName}`;
      
      await this.client.putObject(
        this.bucketName,
        storagePath,
        data,
        data.length,
        {
          'Content-Type': contentType,
          'Cache-Control': 'private, no-cache',
          'X-Amz-Server-Side-Encryption': 'AES256'
        }
      );

      return storagePath;
    } catch (error) {
      console.error('Upload encrypted file error:', error);
      throw new Error(`Failed to upload encrypted file: ${error.message}`);
    }
  }

  /**
   * Upload cover image to storage (public)
   * @param {Buffer} data - Cover image data
   * @param {string} fileName - File name
   * @returns {Promise<string>} Storage path
   */
  async uploadCoverImage(data, fileName) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      const storagePath = `covers/${Date.now()}-${fileName}`;
      
      await this.client.putObject(
        this.bucketName,
        storagePath,
        data,
        data.length,
        {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000' // 1 year cache
        }
      );

      return storagePath;
    } catch (error) {
      console.error('Upload cover image error:', error);
      throw new Error(`Failed to upload cover image: ${error.message}`);
    }
  }

  /**
   * Get encrypted file from storage
   * @param {string} storagePath - Path to encrypted file
   * @returns {Promise<Buffer>} Encrypted file data
   */
  async getEncryptedFile(storagePath) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      const stream = await this.client.getObject(this.bucketName, storagePath);
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Get encrypted file error:', error);
      throw new Error(`Failed to get encrypted file: ${error.message}`);
    }
  }

  /**
   * Get public URL for cover image
   * @param {string} coverPath - Path to cover image
   * @returns {Promise<string>} Public URL
   */
  async getCoverImageUrl(coverPath) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      // For MinIO in development, generate presigned URL
      if (process.env.NODE_ENV !== 'production') {
        const url = await this.client.presignedGetObject(this.bucketName, coverPath, 24 * 60 * 60); // 24 hours
        return url;
      }
      
      // For production S3, construct public URL
      const region = process.env.AWS_REGION || 'us-east-1';
      return `https://${this.bucketName}.s3.${region}.amazonaws.com/${coverPath}`;
    } catch (error) {
      console.error('Get cover image URL error:', error);
      throw new Error(`Failed to get cover image URL: ${error.message}`);
    }
  }

  /**
   * Delete file from storage
   * @param {string} storagePath - Path to file
   * @returns {Promise<void>}
   */
  async deleteFile(storagePath) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      await this.client.removeObject(this.bucketName, storagePath);
    } catch (error) {
      console.error('Delete file error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for downloading encrypted file (short-lived)
   * @param {string} storagePath - Path to encrypted file
   * @param {number} expirySeconds - URL expiry in seconds (default: 300 = 5 minutes)
   * @returns {Promise<string>} Presigned URL
   */
  async getPresignedDownloadUrl(storagePath, expirySeconds = 300) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      const url = await this.client.presignedGetObject(
        this.bucketName,
        storagePath,
        expirySeconds
      );
      return url;
    } catch (error) {
      console.error('Generate presigned URL error:', error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Check if file exists in storage
   * @param {string} storagePath - Path to file
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(storagePath) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      await this.client.statObject(this.bucketName, storagePath);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} storagePath - Path to file
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(storagePath) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      const stat = await this.client.statObject(this.bucketName, storagePath);
      return {
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
        contentType: stat.metaData['content-type']
      };
    } catch (error) {
      console.error('Get file metadata error:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }
}

// Create singleton instance
const storageService = new StorageService();

/**
 * Initialize storage service
 */
const initializeStorage = async () => {
  await storageService.initialize();
};

module.exports = {
  storageService,
  initializeStorage
};
