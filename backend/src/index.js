const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
// Using built-in fetch API (Node.js 18+)
const authRoutes = require('./routes/auth');
const folderRoutes = require('./routes/folders');
const fileRoutes = require('./routes/files');
const supabaseStorage = require('./services/supabaseStorage');
const errorHandler = require('./middleware/errorHandler');
const SupabaseStorageService = require('./services/supabaseStorage');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:51835',
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true,
  exposedHeaders: ['x-folder-token'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-folder-token', 'X-Folder-Token']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Serve static files from uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Keep-alive ping endpoint
app.get('/api/ping', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.originalUrl}`);
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/folders', fileRoutes); // Mount file routes under /api/folders for folder-specific file operations
app.use('/api/files', fileRoutes);

// 404 handler with logging
app.use('*', (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize storage and start server
async function startServer() {
  try {
    // Initialize Supabase storage
    await supabaseStorage.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Keep-alive mechanism for Render free tier
      if (process.env.NODE_ENV === 'production') {
        const keepAlive = () => {
          const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
          console.log(`⏰ Keep-alive ping to ${url}/api/ping`);
          fetch(`${url}/api/ping`)
            .then(res => console.log(`✅ Keep-alive successful: ${res.status}`))
            .catch(err => console.log(`❌ Keep-alive failed: ${err.message}`));
        };
        
        // Ping every 14 minutes (840000 ms)
        setInterval(keepAlive, 14 * 60 * 1000);
        console.log('⏰ Keep-alive mechanism started (14 min intervals)');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
