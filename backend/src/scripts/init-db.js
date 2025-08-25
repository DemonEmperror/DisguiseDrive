const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  console.log('🔧 Initializing database...');
  
  try {
    // Ensure the prisma directory exists
    const prismaDir = path.join(__dirname, '../../prisma');
    if (!fs.existsSync(prismaDir)) {
      fs.mkdirSync(prismaDir, { recursive: true });
    }

    // Check if database file exists
    const dbPath = path.join(prismaDir, 'dev.db');
    const dbExists = fs.existsSync(dbPath);
    
    console.log(`Database file exists: ${dbExists}`);
    console.log(`Database path: ${dbPath}`);

    const prisma = new PrismaClient();

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Check if tables exist by trying to count users
    try {
      const userCount = await prisma.user.count();
      console.log(`✅ Database schema exists. User count: ${userCount}`);
    } catch (error) {
      console.log('❌ Database schema missing, attempting to create...');
      
      // If schema doesn't exist, we need to apply migrations
      const { execSync } = require('child_process');
      try {
        execSync('npx prisma db push', { 
          cwd: path.join(__dirname, '../..'),
          stdio: 'inherit' 
        });
        console.log('✅ Database schema created successfully');
      } catch (migrationError) {
        console.error('❌ Failed to create database schema:', migrationError.message);
        throw migrationError;
      }
    }

    await prisma.$disconnect();
    console.log('✅ Database initialization complete');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
