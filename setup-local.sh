#!/bin/bash

# DisguiseDrive Local Setup Script (without Docker)
echo "🚀 Setting up DisguiseDrive locally..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create .env file for local development
echo "📝 Creating local .env file..."
cat > .env << 'EOF'
# Database (using SQLite for local development)
DATABASE_URL="file:./dev.db"

# JWT Secret
JWT_SECRET="local-development-jwt-secret-change-in-production"

# Local file storage (instead of MinIO)
STORAGE_TYPE="local"
STORAGE_PATH="./uploads"

# Server Configuration
PORT=3001
NODE_ENV="development"

# Frontend URL
FRONTEND_URL="http://localhost:3000"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Argon2 Configuration
ARGON2_MEMORY=65536
ARGON2_ITERATIONS=3
ARGON2_PARALLELISM=1
EOF

echo "✅ Created local .env file"

# Create uploads directory
mkdir -p uploads/encrypted uploads/covers
echo "✅ Created upload directories"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Update Prisma schema for SQLite
echo "🗄️  Updating database configuration for local development..."
cat > prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  folders Folder[]
  files   File[]
  logs    SecurityLog[]

  @@map("users")
}

model Folder {
  id          String   @id @default(cuid())
  name        String
  isProtected Boolean  @default(false)
  passwordHash String?
  salt        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId String
  files   File[]

  @@map("folders")
}

model File {
  id                    String   @id @default(cuid())
  originalName          String
  mimeType              String
  size                  Int
  storagePath           String
  coverPath             String
  encryptedFileKeyBlob  String
  salt                  String
  fileHash              String
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  owner    User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  ownerId  String
  folder   Folder @relation(fields: [folderId], references: [id], onDelete: Cascade)
  folderId String

  @@map("files")
}

model FolderAccessToken {
  id        String   @id @default(cuid())
  token     String   @unique
  folderId  String
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@map("folder_access_tokens")
}

model SecurityLog {
  id        String   @id @default(cuid())
  userId    String?
  action    String
  success   Boolean
  ipAddress String?
  userAgent String?
  metadata  String?
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@map("security_logs")
}
EOF

# Generate Prisma client and run migrations
echo "🔧 Setting up database..."
npx prisma generate
npx prisma db push

# Create local storage service
echo "📁 Creating local storage service..."
cat > src/services/localStorage.js << 'EOF'
const fs = require('fs').promises;
const path = require('path');

class LocalStorageService {
  constructor() {
    this.uploadsDir = process.env.STORAGE_PATH || './uploads';
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

  async uploadEncryptedFile(data, fileName) {
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
}

const localStorageService = new LocalStorageService();

const initializeStorage = async () => {
  await localStorageService.initialize();
};

module.exports = {
  storageService: localStorageService,
  initializeStorage
};
EOF

# Update storage import in main files
sed -i '' 's/..\/services\/storage/..\/services\/localStorage/g' src/routes/files.js src/routes/folders.js src/index.js 2>/dev/null || true

# Seed database
echo "🌱 Seeding database..."
npm run seed

cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

cd ..

echo ""
echo "🎉 DisguiseDrive local setup completed successfully!"
echo ""
echo "📋 To start the application:"
echo "1. Start the backend: cd backend && npm run dev"
echo "2. Start the frontend: cd frontend && npm run dev"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo ""
echo "👤 Demo credentials:"
echo "   Email: demo@example.com"
echo "   Password: password123"
echo "   Folder Password: folder123"
echo ""
echo "📁 Files will be stored locally in the ./uploads directory"
