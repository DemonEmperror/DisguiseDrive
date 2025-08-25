const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to verify folder access token for protected folders
 */
const verifyFolderAccess = async (req, res, next) => {
  try {
    const folderId = req.params.id || req.params.folderId;
    
    if (!folderId) {
      return res.status(400).json({ error: 'Folder ID required' });
    }

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

    // If folder is not protected, allow access
    if (!folder.isProtected) {
      req.folder = folder;
      return next();
    }

    // For protected folders, check for valid access token
    const accessToken = req.headers['x-folder-token'];
    
    if (!accessToken) {
      return res.status(403).json({ 
        error: 'Folder access token required',
        requiresFolderPassword: true 
      });
    }

    // Verify access token
    const tokenRecord = await prisma.folderAccessToken.findFirst({
      where: {
        token: accessToken,
        folderId: folderId,
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

    req.folder = folder;
    req.folderAccessToken = tokenRecord;
    next();
  } catch (error) {
    console.error('Folder access verification error:', error);
    return res.status(500).json({ error: 'Folder access verification failed' });
  }
};

module.exports = {
  authenticateToken,
  verifyFolderAccess
};
