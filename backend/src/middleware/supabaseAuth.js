const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const { fallbackAuth } = require('./fallbackAuth');

const prisma = new PrismaClient();

// Check for required environment variables
const hasSupabaseConfig = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

if (!hasSupabaseConfig) {
  console.warn('⚠️ Supabase environment variables missing - using fallback auth');
}

const supabase = hasSupabaseConfig ? createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
) : null;

/**
 * Middleware to authenticate Supabase JWT tokens
 */
const authenticateSupabaseToken = async (req, res, next) => {
  try {
    // If Supabase is not configured, use fallback auth
    if (!hasSupabaseConfig) {
      console.log('🔄 Supabase not configured, using fallback auth');
      return fallbackAuth(req, res, next);
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('❌ No auth token provided, using fallback auth');
      return fallbackAuth(req, res, next);
    }

    // Verify token with Supabase
    console.log('🔍 Verifying Supabase token...');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('❌ Supabase auth error:', error?.message || 'No user returned');
      console.log('🔄 Falling back to fallback auth');
      return fallbackAuth(req, res, next);
    }
    
    console.log('✅ Supabase user verified:', user.email);

    // Create or find user in our database
    let dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true, email: true, username: true }
    });

    if (!dbUser) {
      console.log('👤 Creating new user in database:', user.email);
      dbUser = await prisma.user.create({
        data: {
          email: user.email,
          username: user.user_metadata?.username || user.email.split('@')[0],
          password: null
        },
        select: { id: true, email: true, username: true }
      });
    }

    req.user = dbUser;
    req.supabaseUser = user;
    console.log('✅ Authentication successful for user:', dbUser.email);
    next();
  } catch (error) {
    console.error('❌ Supabase auth middleware error:', error);
    console.log('🔄 Falling back to fallback auth due to error');
    return fallbackAuth(req, res, next);
  }
};

module.exports = {
  authenticateSupabaseToken
};
