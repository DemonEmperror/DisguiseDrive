const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Global error handler middleware
 */
const errorHandler = async (err, req, res, next) => {
  // Log error details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Log security-relevant errors
  if (err.name === 'UnauthorizedError' || err.status === 401 || err.status === 403) {
    try {
      await prisma.securityLog.create({
        data: {
          userId: req.user?.id || null,
          action: 'unauthorized_access_attempt',
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            url: req.url,
            method: req.method,
            error: err.message
          }
        }
      });
    } catch (logError) {
      console.error('Failed to log security event:', logError);
    }
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details || err.message
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  if (err.code === 'P2002') { // Prisma unique constraint violation
    return res.status(409).json({ error: 'Resource already exists' });
  }

  if (err.code === 'P2025') { // Prisma record not found
    return res.status(404).json({ error: 'Resource not found' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field' });
  }

  // Default error response
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  asyncHandler
};
