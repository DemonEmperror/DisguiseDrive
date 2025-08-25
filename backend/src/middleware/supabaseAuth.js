const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables:', {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Middleware to authenticate Supabase JWT tokens
 */
const authenticateSupabaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if Supabase is configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Supabase not configured, cannot authenticate');
      return res.status(500).json({ 
        error: 'Server configuration error - Supabase credentials missing',
        details: 'Please configure SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables'
      });
    }

    // Verify token with Supabase
    console.log('Verifying Supabase token...');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Supabase auth error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    console.log('Supabase user verified:', user.email);

    // Create or find user in our database
    let dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true, email: true, username: true }
    });

    if (!dbUser) {
      // Create user if doesn't exist
      dbUser = await prisma.user.create({
        data: {
          email: user.email,
          username: user.user_metadata?.username || user.email.split('@')[0],
          // No password needed for Supabase users
        },
        select: { id: true, email: true, username: true }
      });
    }

    req.user = dbUser;
    req.supabaseUser = user;
    next();
  } catch (error) {
    console.error('Supabase auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
};

module.exports = {
  authenticateSupabaseToken
};
