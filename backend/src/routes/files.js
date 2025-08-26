const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { authenticateSupabaseToken } = require('../middleware/supabaseAuth');
const { verifyFolderAccess } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const cryptoService = require('../services/crypto');
const SupabaseStorageService = require('../services/supabaseStorage');
const coverGenerator = require('../services/coverGenerator');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation schemas
const secureUploadSchema = Joi.object({
  passwords: Joi.array().items(Joi.string().min(4).required()).required()
});

const normalUploadSchema = Joi.object({
  uploadMode: Joi.string().valid('normal', 'secure').required()
});

/**
 * POST /api/folders/:id/files
 * Upload files to a folder
 */
router.post('/:folderId/files', 
  authenticateSupabaseToken,
  verifyFolderAccess,
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Get upload mode
    const uploadMode = req.body.uploadMode || 'secure';
    
    // Parse passwords and cover types from request body
    let passwords = [];
    let coverTypes = [];
    
    if (uploadMode === 'secure') {
      try {
        passwords = JSON.parse(req.body.passwords || '[]');
      } catch (error) {
        return res.status(400).json({ error: 'Invalid passwords format' });
      }
    }
    
    try {
      coverTypes = JSON.parse(req.body.coverTypes || '[]');
    } catch (error) {
      return res.status(400).json({ error: 'Invalid cover types format' });
    }

    // Validate passwords for secure mode
    if (uploadMode === 'secure') {
      const { error } = secureUploadSchema.validate({ passwords });
      if (error) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: error.details[0].message 
        });
      }

      if (passwords.length !== req.files.length) {
        return res.status(400).json({ 
          error: 'Number of passwords must match number of files' 
        });
      }
    }

    const uploadedFiles = [];
    const errors = [];

    // Process each file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const password = uploadMode === 'secure' ? (passwords[i] || passwords[0]) : null;
      const coverType = coverTypes[i] || 'nature';

      try {
        // Skip image validation for non-image files
        const isImage = file.mimetype.startsWith('image/');
        if (isImage) {
          const isValidImage = await coverGenerator.validateImage(file.buffer);
          if (!isValidImage) {
            errors.push({
              filename: file.originalname,
              error: 'Invalid image format'
            });
            continue;
          }
        }

        // Calculate file hash
        const fileHash = cryptoService.calculateHash(file.buffer);

        let storagePath, encryptedKeyBlob, salt;

        if (uploadMode === 'secure') {
          // Secure upload: encrypt file for storage
          const { encryptedData, fileKey, iv, authTag } = cryptoService.encryptFileForStorage(file.buffer);
          
          // Create storage blob
          const storageBlob = cryptoService.createStorageBlob(encryptedData, iv, authTag);

          // Generate salt and encrypt file key with password
          salt = cryptoService.generateSalt();
          const encryptionResult = await cryptoService.encryptFileKey(fileKey, password, salt);
          encryptedKeyBlob = encryptionResult?.encryptedKeyBlob;
          
          if (!encryptedKeyBlob) {
            throw new Error('Failed to encrypt file key - no encrypted blob returned');
          }

          // Upload encrypted file to Supabase storage
          const storageService = new SupabaseStorageService();
          storagePath = await storageService.uploadEncryptedFile(
            storageBlob,
            `encrypted/${fileHash}-${file.originalname}`,
            'application/octet-stream'
          );
        } else {
          // Normal upload: store file directly without encryption
          const storageService = new SupabaseStorageService();
          storagePath = await storageService.uploadFile(
            file.buffer,
            `normal/${fileHash}-${file.originalname}`,
            file.mimetype
          );
        }

        // Generate cover image using Unsplash with specified type
        const coverResult = await coverGenerator.generateCover(
          file.buffer,
          fileHash,
          req.user.id,
          coverType
        );
        
        // Store the Unsplash URL directly instead of uploading a file
        const coverPath = coverResult.data;

        // Save file metadata to database  
        console.log('Creating file with uploadMode:', uploadMode);
        const savedFile = await prisma.file.create({
          data: {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            storagePath: storagePath,
            coverPath: coverPath,
            encryptedKeyBlob: encryptedKeyBlob || null,
            salt: salt ? salt.toString('base64') : null,
            uploadMode: uploadMode,
            ownerId: req.user.id,
            folderId: req.params.folderId
          },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            coverPath: true,
            createdAt: true
          }
        });

        uploadedFiles.push(savedFile);

      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        errors.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    // Log upload activity
    await prisma.securityLog.create({
      data: {
        userId: req.user.id,
        action: 'file_upload',
        success: uploadedFiles.length > 0,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({
          folderId: req.params.folderId,
          filesUploaded: uploadedFiles.length,
          filesError: errors.length
        })
      }
    });

    res.status(201).json({
      message: `${uploadedFiles.length} files uploaded successfully`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });
  })
);

/**
 * GET /api/files/:id/url
 * Get file URL for normal (unencrypted) files
 */
router.get('/:id/url', authenticateSupabaseToken, verifyFolderAccess, asyncHandler(async (req, res) => {
  const fileId = req.params.id;

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: req.user.id
    },
    select: {
      id: true,
      originalName: true,
      storagePath: true,
      uploadMode: true,
      folderId: true
    }
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (file.uploadMode !== 'normal') {
    return res.status(400).json({ error: 'This endpoint is only for normal (unencrypted) files' });
  }

  try {
    const storageService = new SupabaseStorageService();
    const signedUrl = await storageService.getFileUrl(file.storagePath);
    
    res.json({
      url: signedUrl,
      filename: file.originalName
    });
  } catch (error) {
    console.error('Error generating file URL:', error);
    res.status(500).json({ error: 'Failed to generate file URL' });
  }
}));

/**
 * GET /api/files/:id/meta
 * Get file metadata
 */
router.get('/:id/meta', authenticateSupabaseToken, asyncHandler(async (req, res) => {
  const fileId = req.params.id;

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: req.user.id
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      coverPath: true,
      encryptedKeyBlob: true,
      salt: true,
      uploadMode: true,
      createdAt: true,
      folder: {
        select: {
          id: true,
          name: true,
          isProtected: true
        }
      }
    }
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.json({
    file: {
      ...file
    }
  });
}));

/**
 * GET /api/files/:id/cover
 * Get cover image (public endpoint)
 */
router.get('/:id/cover', asyncHandler(async (req, res) => {
  const fileId = req.params.id;

  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: {
      coverPath: true
    }
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    // Get cover image URL and redirect
    const coverUrl = await storageService.getCoverImageUrl(file.coverPath);
    res.redirect(coverUrl);
  } catch (error) {
    console.error('Error getting cover image:', error);
    res.status(500).json({ error: 'Failed to get cover image' });
  }
}));

/**
 * GET /api/files/:id/encrypted
 * Get encrypted file blob (requires authentication and folder access)
 */
router.get('/:id/encrypted', authenticateSupabaseToken, asyncHandler(async (req, res) => {
  const fileId = req.params.id;

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: req.user.id
    },
    include: {
      folder: true
    }
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Check folder access if protected
  if (file.folder.isProtected) {
    const accessToken = req.headers['x-folder-token'];
    
    if (!accessToken) {
      return res.status(403).json({ 
        error: 'Folder access token required',
        requiresFolderPassword: true 
      });
    }

    const tokenRecord = await prisma.folderAccessToken.findFirst({
      where: {
        token: accessToken,
        folderId: file.folderId,
        userId: req.user.id,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!tokenRecord) {
      return res.status(403).json({ 
        error: 'Invalid or expired folder access token',
        requiresFolderPassword: true 
      });
    }
  }

  try {
    // Download encrypted file from Supabase storage
    const storageService = new SupabaseStorageService();
    const encryptedBuffer = await storageService.downloadEncryptedFile(file.storagePath);

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', encryptedBuffer.length);
    res.setHeader('Cache-Control', 'private, no-cache');
    
    // Send encrypted data
    res.send(encryptedBuffer);

  } catch (error) {
    console.error('Error getting encrypted file:', error);
    res.status(500).json({ error: 'Failed to get encrypted file' });
  }
}));

/**
 * POST /api/files/:id/decrypt-key
 * Decrypt file key with per-image password
 */
router.post('/:id/decrypt-key', authenticateSupabaseToken, asyncHandler(async (req, res) => {
  const fileId = req.params.id;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: req.user.id
    },
    select: {
      id: true,
      encryptedKeyBlob: true,
      salt: true,
      folder: {
        select: {
          id: true,
          isProtected: true
        }
      }
    }
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Check folder access if protected
  if (file.folder.isProtected) {
    const accessToken = req.headers['x-folder-token'];
    
    if (!accessToken) {
      return res.status(403).json({ 
        error: 'Folder access token required',
        requiresFolderPassword: true 
      });
    }

    const tokenRecord = await prisma.folderAccessToken.findFirst({
      where: {
        token: accessToken,
        folderId: file.folder.id,
        userId: req.user.id,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!tokenRecord) {
      return res.status(403).json({ 
        error: 'Invalid or expired folder access token',
        requiresFolderPassword: true 
      });
    }
  }

  try {
    console.log('Attempting to decrypt file key for file:', fileId);
    console.log('Password provided:', password ? 'Yes' : 'No');
    console.log('Salt exists:', file.salt ? 'Yes' : 'No');
    console.log('Encrypted key blob size:', file.encryptedKeyBlob ? file.encryptedKeyBlob.length : 'null');
    
    // Attempt to decrypt file key
    const fileKey = await cryptoService.decryptFileKey(
      file.encryptedKeyBlob,
      password,
      file.salt
    );
    
    console.log('File key decryption successful');

    // Log successful unlock
    await prisma.securityLog.create({
      data: {
        userId: req.user.id,
        action: 'file_unlock_attempt',
        success: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({ fileId: fileId })
      }
    });

    res.json({
      success: true,
      fileKey: fileKey.toString('base64')
    });

  } catch (error) {
    console.error('File key decryption failed:', error.message);
    console.error('Error details:', error);
    
    // Log failed unlock attempt
    await prisma.securityLog.create({
      data: {
        userId: req.user.id,
        action: 'file_unlock_attempt',
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({ 
          fileId: fileId,
          error: error.message 
        })
      }
    });

    return res.status(401).json({ 
      error: 'Invalid password',
      success: false 
    });
  }
}));

/**
 * DELETE /api/files/:id
 * Delete a file
 */
router.delete('/:id', authenticateSupabaseToken, asyncHandler(async (req, res) => {
  const fileId = req.params.id;

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      ownerId: req.user.id
    }
  });

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    // Delete file from Supabase storage
    const storageService = new SupabaseStorageService();
    await storageService.deleteFile(file.storagePath);
    await storageService.deleteFile(file.coverPath);
  } catch (error) {
    console.warn(`Failed to delete file ${fileId} from storage:`, error.message);
  }

  // Delete from database
  await prisma.file.delete({
    where: { id: fileId }
  });

  res.json({
    message: 'File deleted successfully'
  });
}));

module.exports = router;
