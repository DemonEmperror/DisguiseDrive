const fs = require('fs').promises;
const path = require('path');
const express = require('express');

class LocalStorageService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.encryptedDir = path.join(this.uploadsDir, 'encrypted');
    this.coversDir = path.join(this.uploadsDir, 'covers');
    this.initialized = false;
  }

  async initialize() {
    try {
      await fs.mkdir(this.encryptedDir, { recursive: true });
      await fs.mkdir(this.coversDir, { recursive: true });
      this.initialized = true;
      console.log('✅ Local storage initialized');
    } catch (error) {
      console.error('❌ Local storage initialization failed:', error);
      throw error;
    }
  }

  async uploadEncryptedFile(data, fileName, contentType = 'application/octet-stream') {
    const filePath = path.join(this.encryptedDir, `${Date.now()}-${fileName}`);
    await fs.writeFile(filePath, data);
    return path.relative(this.uploadsDir, filePath);
  }

  async uploadCoverImage(data, fileName) {
    const filePath = path.join(this.coversDir, `${Date.now()}-${fileName}`);
    await fs.writeFile(filePath, data);
    return path.relative(this.uploadsDir, filePath);
  }

  async getEncryptedFile(storagePath) {
    const filePath = path.join(this.uploadsDir, storagePath);
    return await fs.readFile(filePath);
  }

  async getCoverImageUrl(coverPath) {
    return `http://localhost:3001/uploads/${coverPath}`;
  }

  async deleteFile(storagePath) {
    try {
      const filePath = path.join(this.uploadsDir, storagePath);
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('File deletion failed:', error.message);
    }
  }

  async fileExists(storagePath) {
    try {
      const filePath = path.join(this.uploadsDir, storagePath);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getPresignedDownloadUrl(storagePath, expirySeconds = 300) {
    // For local storage, just return the direct URL
    return `http://localhost:3001/uploads/${storagePath}`;
  }

  async getFileMetadata(storagePath) {
    try {
      const filePath = path.join(this.uploadsDir, storagePath);
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        lastModified: stats.mtime,
        etag: stats.mtime.getTime().toString(),
        contentType: 'application/octet-stream'
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }
}

const localStorageService = new LocalStorageService();

const initializeStorage = async () => {
  await localStorageService.initialize();
};

module.exports = {
  storageService: localStorageService,
  initializeStorage
};
