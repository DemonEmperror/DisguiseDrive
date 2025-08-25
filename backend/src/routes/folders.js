const express = require('express');
const Joi = require('joi');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, verifyFolderAccess } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const cryptoService = require('../services/crypto');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createFolderSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  isProtected: Joi.boolean().optional(),
  password: Joi.string().min(4).optional()
});

const lockFolderSchema = Joi.object({
  password: Joi.string().min(4).required()
});

const unlockFolderSchema = Joi.object({
  password: Joi.string().required()
});

/**
 * GET /api/folders
 * List user's folders
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const folders = await prisma.folder.findMany({
    where: {
      ownerId: req.user.id
    },
    select: {
      id: true,
      name: true,
      isProtected: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { files: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.json({
    folders: folders.map(folder => ({
      ...folder,
      fileCount: folder._count.files
    }))
  });
}));

/**
 * POST /api/folders
 * Create a new folder
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = createFolderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details[0].message 
    });
  }

  const { name, isProtected, password } = value;

  // Check if folder with same name already exists for this user
  const existingFolder = await prisma.folder.findFirst({
    where: {
      name: name,
      ownerId: req.user.id
    }
  });

  if (existingFolder) {
    return res.status(409).json({ 
      error: 'Folder with this name already exists' 
    });
  }

  // Prepare folder data
  const folderData = {
    name,
    ownerId: req.user.id,
    isProtected: isProtected || false
  };

  // If password protection is requested, add password hash
  if (isProtected && password) {
    folderData.passwordHash = password; // Store as plain text
    folderData.salt = null;
  }

  // Create folder
  const folder = await prisma.folder.create({
    data: folderData,
    select: {
      id: true,
      name: true,
      isProtected: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.status(201).json({
    message: 'Folder created successfully',
    folder
  });
}));

/**
 * POST /api/folders/:id/lock
 * Set password protection on a folder
 */
router.post('/:id/lock', authenticateToken, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = lockFolderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details[0].message 
    });
  }

  const { password } = value;
  const folderId = req.params.id;

  // Check if folder exists and is owned by user
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      ownerId: req.user.id
    }
  });

  if (!folder) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  // Store password as plain text
  const passwordHash = password;
  const salt = null;

  // Update folder with password protection
  const updatedFolder = await prisma.folder.update({
    where: { id: folderId },
    data: {
      isProtected: true,
      passwordHash: passwordHash,
      salt: null
    },
    select: {
      id: true,
      name: true,
      isProtected: true,
      updatedAt: true
    }
  });

  // Log security event
  await prisma.securityLog.create({
    data: {
      userId: req.user.id,
      action: 'folder_password_set',
      success: true,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { folderId: folderId }
    }
  });

  res.json({
    message: 'Folder password protection enabled',
    folder: updatedFolder
  });
}));

/**
 * POST /api/folders/:id/unlock
 * Unlock a password-protected folder
 */
router.post('/:id/unlock', authenticateToken, asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = unlockFolderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details[0].message 
    });
  }

  const { password } = value;
  const folderId = req.params.id;

  // Check if folder exists and is owned by user
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      ownerId: req.user.id
    }
  });

  if (!folder) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  if (!folder.isProtected) {
    return res.status(400).json({ error: 'Folder is not password protected' });
  }

  // Verify password (plain text comparison)
  try {
    const isValidPassword = folder.passwordHash === password;
    
    if (!isValidPassword) {
      // Log failed attempt
      await prisma.securityLog.create({
        data: {
          userId: req.user.id,
          action: 'folder_unlock_attempt',
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: JSON.stringify({ folderId: folderId, reason: 'invalid_password' })
        }
      });

      return res.status(401).json({ error: 'Invalid folder password' });
    }

    // Generate short-lived access token
    const accessToken = cryptoService.generateToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // Store access token
    await prisma.folderAccessToken.create({
      data: {
        token: accessToken,
        folderId: folderId,
        userId: req.user.id,
        expiresAt: expiresAt
      }
    });

    // Log successful unlock
    await prisma.securityLog.create({
      data: {
        userId: req.user.id,
        action: 'folder_unlock_attempt',
        success: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({ folderId: folderId })
      }
    });

    res.json({
      message: 'Folder unlocked successfully',
      accessToken: accessToken,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Password verification error:', error);
    
    // Log failed attempt
    await prisma.securityLog.create({
      data: {
        userId: req.user.id,
        action: 'folder_unlock_attempt',
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({ folderId: folderId, reason: 'verification_error' })
      }
    });

    return res.status(500).json({ error: 'Password verification failed' });
  }
}));

/**
 * GET /api/folders/:id
 * Get folder details and files (requires folder access if protected)
 */
router.get('/:id', authenticateToken, verifyFolderAccess, asyncHandler(async (req, res) => {
  const folderId = req.params.id;

  // Get folder with files
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: {
      files: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          coverPath: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  if (!folder) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  res.json({
    folder: {
      id: folder.id,
      name: folder.name,
      isProtected: folder.isProtected,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      files: folder.files
    }
  });
}));

/**
 * DELETE /api/folders/:id
 * Delete a folder and all its files
 */
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const folderId = req.params.id;

  // Check if folder exists and is owned by user
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      ownerId: req.user.id
    },
    include: {
      files: true
    }
  });

  if (!folder) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  // Delete all files in storage first
  const { storageService } = require('../services/localStorage');
  
  for (const file of folder.files) {
    try {
      // Delete encrypted file
      await storageService.deleteFile(file.storagePath);
      // Delete cover image
      await storageService.deleteFile(file.coverPath);
    } catch (error) {
      console.warn(`Failed to delete file ${file.id} from storage:`, error.message);
    }
  }

  // Delete folder and all related data (cascade will handle files and tokens)
  await prisma.folder.delete({
    where: { id: folderId }
  });

  res.json({
    message: 'Folder and all files deleted successfully'
  });
}));

module.exports = router;
