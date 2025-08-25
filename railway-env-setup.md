# Railway Environment Variables Setup

The backend needs these environment variables to be set in Railway:

## Required Variables:

```
SUPABASE_URL=https://pkllfcbrrrvtteawvedg.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbGxmY2JycnJ2dHRlYXd2ZWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjEwNTcyNCwiZXhwIjoyMDcxNjgxNzI0fQ.UERyd6tUBur_x2e2dolbi-7HxHvGYCDXaeHAAdradQ0
SUPABASE_BUCKET_NAME=disguisedrive-files
UNSPLASH_ACCESS_KEY=Twy3n21LMwwSl536iRo45ZZfcs1eqrCE3KbcM29RAx8
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=production
```

## How to add them in Railway:

1. Go to your Railway project dashboard
2. Click on your backend service
3. Go to "Variables" tab
4. Add each variable above
5. Redeploy the service

The 500 error is happening because Railway doesn't have the Supabase credentials configured.
