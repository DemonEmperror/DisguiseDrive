const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Create demo user
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const user = await prisma.user.upsert({
      where: { email: 'demo@example.com' },
      update: {},
      create: {
        email: 'demo@example.com',
        username: 'demo',
        password: hashedPassword
      }
    });

    console.log('✅ Created demo user:', user.email);

    // Create sample folders
    const publicFolder = await prisma.folder.upsert({
      where: { id: 'demo-public-folder' },
      update: {},
      create: {
        id: 'demo-public-folder',
        name: 'My Photos',
        isProtected: false,
        ownerId: user.id
      }
    });

    console.log('✅ Created public folder:', publicFolder.name);

    // Create protected folder with password "folder123"
    const folderPassword = 'folder123';
    const passwordHash = folderPassword;

    const protectedFolder = await prisma.folder.upsert({
      where: { id: 'demo-protected-folder' },
      update: {},
      create: {
        id: 'demo-protected-folder',
        name: 'Private Photos',
        isProtected: true,
        passwordHash: passwordHash,
        salt: null,
        ownerId: user.id
      }
    });

    console.log('✅ Created protected folder:', protectedFolder.name);
    console.log('   Password: folder123');

    console.log('🎉 Database seeded successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('   Email: demo@example.com');
    console.log('   Password: password123');
    console.log('   Folder Password: folder123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
