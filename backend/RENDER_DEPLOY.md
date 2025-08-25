# Deploy to Render (Free Tier with Keep-Alive)

## Quick Deploy Steps:

1. **Go to [render.com](https://render.com)** and sign up/login

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repo** or upload this backend folder

4. **Use these settings:**
   - **Name**: `disguisedrive-backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

5. **Add Environment Variables:**
   ```
   NODE_ENV=production
   JWT_SECRET=your-random-secret-here-make-it-long-and-secure
   SUPABASE_URL=https://pkllfcbrrrvtteawvedg.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbGxmY2JycnJ2dHRlYXd2ZWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjEwNTcyNCwiZXhwIjoyMDcxNjgxNzI0fQ.UERyd6tUBur_x2e2dolbi-7HxHvGYCDXaeHAAdradQ0
   SUPABASE_BUCKET_NAME=disguisedrive-files
   UNSPLASH_ACCESS_KEY=Twy3n21LMwwSl536iRo45ZZfcs1eqrCE3KbcM29RAx8
   RENDER_EXTERNAL_URL=https://your-app-name.onrender.com
   ```

6. **Deploy!** - Render will build and deploy automatically

## Keep-Alive Feature ⏰

Your backend now includes an automatic keep-alive mechanism that:
- Pings itself every 14 minutes to prevent sleeping
- Only runs in production mode
- Logs ping status to console
- Uses the `/api/ping` endpoint

## After Deployment:

1. **Copy your Render URL** (e.g., `https://disguisedrive-backend.onrender.com`)
2. **Update the frontend** by setting `NEXT_PUBLIC_API_URL` to your Render URL
3. **Redeploy frontend** to Netlify

Your backend will stay awake 24/7 on Render's free tier! 🚀
