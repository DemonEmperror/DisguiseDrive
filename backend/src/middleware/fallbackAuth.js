const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Fallback authentication middleware for when Supabase is not available
 * Creates a temporary user for testing purposes
 */
const fallbackAuth = async (req, res, next) => {
  try {
    console.log('🔄 Using fallback authentication');
    
    // Create or find a test user
    let testUser = await prisma.user.findUnique({
      where: { email: 'test@disguisedrive.com' },
      select: { id: true, email: true, username: true }
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@disguisedrive.com',
          username: 'testuser',
          password: null
        },
        select: { id: true, email: true, username: true }
      });
      console.log('✅ Created fallback test user');
    }

    req.user = testUser;
    console.log('✅ Fallback auth successful for user:', testUser.email);
    next();
  } catch (error) {
    console.error('❌ Fallback auth failed:', error);
    return res.status(500).json({ error: 'Authentication system unavailable' });
  }
};

module.exports = {
  fallbackAuth
};
