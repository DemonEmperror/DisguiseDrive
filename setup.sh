#!/bin/bash

# DisguiseDrive Setup Script
echo "🚀 Setting up DisguiseDrive..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

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

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.sample .env
    echo "✅ Created .env file from .env.sample"
    echo "⚠️  Please review and update the .env file with your settings"
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker-compose exec -T postgres pg_isready -U postgres; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Check if MinIO is ready
echo "🔍 Checking MinIO connection..."
until curl -f http://localhost:9000/minio/health/live &>/dev/null; do
    echo "Waiting for MinIO..."
    sleep 2
done
echo "✅ MinIO is ready"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

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
echo "🎉 DisguiseDrive setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Review and update .env file if needed"
echo "2. Start the backend: cd backend && npm run dev"
echo "3. Start the frontend: cd frontend && npm run dev"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo "   MinIO Console: http://localhost:9001 (admin/minioadmin)"
echo ""
echo "👤 Demo credentials:"
echo "   Email: demo@example.com"
echo "   Password: password123"
echo "   Folder Password: folder123"
echo ""
echo "🔒 Security reminder: Change default passwords in production!"
