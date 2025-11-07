# Complete Guide: Separating Frontend & Backend

This is a **step-by-step walkthrough** to host your frontend separately from your backend, so the frontend is always-on while the backend can spin down.

## 🎯 What We're Doing

**Before:** Everything on one server (frontend + backend together)  
**After:** 
- **Frontend** → Vercel/Netlify (always-on, static files)
- **Backend** → Render (can spin down, Express API)

**Benefits:**
- ✅ Frontend loads instantly (no cold starts)
- ✅ Backend can spin down (saves resources)
- ✅ Better user experience
- ✅ All free hosting

---

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ Your anime dashboard code in a Git repository (GitHub recommended)
- ✅ A Render account (free, no credit card needed)
- ✅ A Vercel account (free, no credit card needed)
- ✅ Your AniList OAuth app credentials

---

## ✅ Already Done!

I've already prepared your code for frontend/backend separation! Here's what's been set up:

### ✅ Created Files:
- `scripts/api-config.js` - API helper that works in both dev and production
- `vercel.json` - Vercel configuration
- `scripts/generate-config.js` - Generates config.js at build time
- `public/config.js` - Template config file

### ✅ Updated Files:
- `scripts/main.js` - Uses `apiFetch` for API calls
- `server.js` - Added CORS support
- `routes/auth.js` - Updated to use `FRONTEND_URL`
- `package.json` - Added `prebuild` script

### ✅ How It Works:

**Local Development:**
- Detects `localhost:3001` (Vite dev server)
- Uses relative paths (e.g., `/api/...`)
- Vite proxy forwards to `localhost:3000` (backend)
- Everything works as before! ✅

**Production (Separate Frontend/Backend):**
- Detects production domain (not localhost)
- Uses absolute URLs from `config.js` (e.g., `https://api.onrender.com/api/...`)
- CORS allows requests from frontend domain
- Works with separate hosting! ✅

---

## 🚀 Step 1: Verify Local Development Still Works

### Step 1.1: Test Locally

1. **Start your local servers:**
   ```bash
   npm run dev:all
   ```

2. **Open browser:** `http://localhost:3001`

3. **Check browser console:**
   - Should see: `window.CONFIG` loaded
   - Should see: API calls working
   - No CORS errors

4. **Test login:**
   - Click "Login with AniList"
   - Should redirect and work normally

**If everything works locally, you're ready to deploy!** ✅

---

## 🚀 Step 2: Deploy Backend to Render

### Step 2.1: Create Backend Service

```javascript
// API Configuration
// This file handles API calls when frontend and backend are separated

// Get API base URL from config or environment
const getApiBase = () => {
  // Check if config.js is loaded
  if (window.CONFIG && window.CONFIG.API_BASE) {
    return window.CONFIG.API_BASE;
  }
  
  // Fallback to environment variable or default
  return process.env.API_BASE || 'http://localhost:3000';
};

// Helper function to make API calls
export function apiFetch(path, options = {}) {
  const apiBase = getApiBase();
  const url = path.startsWith('/') ? `${apiBase}${path}` : `${apiBase}/${path}`;
  
  // Add credentials for cookies/sessions
  const fetchOptions = {
    ...options,
    credentials: 'include', // Important for cookies/sessions
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  return fetch(url, fetchOptions);
}

// Export API base for direct use
export const API_BASE = getApiBase();
```

---

### Step 1.2: Update Main API Calls

**Update `scripts/main.js`:**

Find this line (around line 101):
```javascript
const response = await fetch('/api/get-anilist-data');
```

Replace with:
```javascript
import { apiFetch } from './api-config.js';

// ... later in the code ...
const response = await apiFetch('/api/get-anilist-data');
```

**Update all other fetch calls:**

Find and replace:
- `fetch('/api/` → `apiFetch('/api/`
- `fetch('/auth/` → `apiFetch('/auth/`

**Common locations:**
- `scripts/main.js` - Lines 101, 170, 402, 1115, 1208, 1376, 1452, 1477, 1550
- `scripts/airing.js` - Line 226, 287
- `scripts/calendar.js` - Line 505, 509
- `scripts/ui.js` - Lines 1516, 1584
- `scripts/anime-modal.js` - Lines 783, 826
- `scripts/custom-lists.js` - Multiple lines
- `scripts/goals.js` - Multiple lines
- `scripts/watch-queue.js` - Multiple lines

**Quick find/replace:**
```javascript
// Find:
fetch('/api/
fetch('/auth/

// Replace with:
apiFetch('/api/
apiFetch('/auth/
```

---

### Step 1.3: Update config.js Template

**Update `public/config.js` (or create it if it doesn't exist):**

```javascript
window.CONFIG = {
  DASHBOARD_TITLE: "My Anime Dashboard",
  DASHBOARD_SUBTITLE: "Visualize your anime watching journey.",
  GEMINI_API_KEY: "",
  EPISODES_PER_PAGE: 25,
  CHART_GENRE_LIMIT: 10,
  GEMINI_MODEL: "gemini-2.5-flash",
  API_BASE: "https://your-backend-api.onrender.com" // ⚠️ UPDATE THIS!
};
```

**Important:** Replace `https://your-backend-api.onrender.com` with your actual backend URL (we'll get this in Step 2).

---

### Step 1.4: Update Backend CORS

**Update `server.js` to allow requests from your frontend:**

Find the section after imports (around line 50), and add CORS middleware:

```javascript
// Add this after: const app = express();
const app = express();
app.set('trust proxy', 1);

// =====================================================================
// CORS Configuration (for separate frontend/backend)
// =====================================================================
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow requests from frontend
  if (origin === FRONTEND_URL || origin === 'http://localhost:3001') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
```

---

### Step 1.5: Update Auth Redirect

**Update `routes/auth.js` to redirect to frontend after login:**

Find the OAuth callback section (around line 200), and update the redirect:

```javascript
// Find this line (around line 200):
res.redirect(`${FRONTEND_URL}?auth=success`);

// Make sure FRONTEND_URL is set:
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
```

---

### Step 1.6: Commit Your Changes

```bash
git add .
git commit -m "Prepare for frontend/backend separation"
git push
```

---

## 🚀 Step 2: Deploy Backend to Render

### Step 2.1: Create Backend Service

1. **Go to [Render](https://render.com/)**
2. **Sign up** (use GitHub - no credit card required)
3. **Click "New +" → "Web Service"**
4. **Connect your GitHub account** (if not already connected)
5. **Select your repository**
6. **Configure:**
   - **Name**: `anime-dashboard-api` (or any name)
   - **Region**: Choose closest to you
   - **Branch**: `main` (or your branch)
   - **Root Directory**: Leave empty
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**

7. **Click "Advanced" → "Add Environment Variable"**

   Add these environment variables:
   ```env
   NODE_ENV=production
   PORT=3000
   BASE_URL=https://anime-dashboard-api.onrender.com
   FRONTEND_URL=https://anime-dashboard.vercel.app
   DATABASE_URL=postgresql://... (we'll add this next)
   ANILIST_CLIENT_ID=your_client_id
   ANILIST_CLIENT_SECRET=your_client_secret
   SESSION_SECRET=your-random-secret-here
   CONSUMET_API_URL=https://consumet-api.onrender.com
   GEMINI_API_KEY=your_gemini_key (optional)
   ```

   **Important:** 
   - `BASE_URL` will be your Render service URL (you'll get this after deployment)
   - `FRONTEND_URL` will be your Vercel URL (we'll get this in Step 3)
   - For now, use placeholders and update them later

8. **Click "Create Web Service"**
9. **Wait for deployment** (takes 2-5 minutes)
10. **Copy your service URL** (e.g., `https://anime-dashboard-api.onrender.com`)

---

### Step 2.2: Create PostgreSQL Database

1. **In Render dashboard, click "New +" → "PostgreSQL"**
2. **Configure:**
   - **Name**: `anime-dashboard-db`
   - **Database**: `anime_dashboard`
   - **User**: `anime_user` (or leave default)
   - **Region**: Same as your backend service
   - **PostgreSQL Version**: 15 (or latest)
   - **Plan**: **Free** (90 days, then $7/month or recreate)

3. **Click "Create Database"**
4. **Copy the Internal Database URL** (starts with `postgresql://`)
5. **Go back to your backend service**
6. **Settings → Environment → Add Environment Variable:**
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL
7. **Save changes** (this will trigger a redeploy)

---

### Step 2.3: Initialize Database

1. **Go to your backend service on Render**
2. **Click "Shell" tab**
3. **Run these commands:**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

   Or add to your `package.json` scripts:
   ```json
   {
     "scripts": {
       "postinstall": "npm run prisma:generate && npm run prisma:push"
     }
   }
   ```

   This will run automatically after each deployment.

---

### Step 2.4: Update Environment Variables

1. **Go to your backend service → Settings → Environment**
2. **Update these variables:**
   - `BASE_URL`: Your Render service URL (e.g., `https://anime-dashboard-api.onrender.com`)
   - `FRONTEND_URL`: We'll update this after deploying frontend (for now, use placeholder)

3. **Save changes** (triggers redeploy)

---

## 🚀 Step 3: Deploy Frontend to Vercel

### Step 3.1: Create Vercel Project

1. **Go to [Vercel](https://vercel.com/)**
2. **Sign up** (use GitHub - no credit card required)
3. **Click "Add New Project"**
4. **Import your Git repository**
5. **Configure:**
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (or leave empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

6. **Click "Environment Variables" → "Add"**

   Add these:
   ```env
   API_BASE=https://anime-dashboard-api.onrender.com
   GEMINI_API_KEY=your_gemini_key (optional)
   ```

   **Important:** Replace `https://anime-dashboard-api.onrender.com` with your actual backend URL from Step 2.

7. **Click "Deploy"**
8. **Wait for deployment** (takes 1-2 minutes)
9. **Copy your Vercel URL** (e.g., `https://anime-dashboard.vercel.app`)

---

### Step 3.2: Create vercel.json

**Create `vercel.json` in your project root:**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev:vite",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/config.js",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

---

### Step 3.3: Update config.js for Production

**Create `public/config.js` (or update existing):**

```javascript
// This will be used in production
// For development, it's generated by the backend
window.CONFIG = window.CONFIG || {
  DASHBOARD_TITLE: "My Anime Dashboard",
  DASHBOARD_SUBTITLE: "Visualize your anime watching journey.",
  GEMINI_API_KEY: "",
  EPISODES_PER_PAGE: 25,
  CHART_GENRE_LIMIT: 10,
  GEMINI_MODEL: "gemini-2.5-flash",
  API_BASE: "https://anime-dashboard-api.onrender.com" // ⚠️ UPDATE THIS!
};
```

**Important:** Replace with your actual backend URL.

**Alternative: Generate config.js at build time**

Create `scripts/generate-config.js`:

```javascript
// Generate config.js at build time
const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const config = `window.CONFIG = {
  DASHBOARD_TITLE: "My Anime Dashboard",
  DASHBOARD_SUBTITLE: "Visualize your anime watching journey.",
  GEMINI_API_KEY: "${GEMINI_API_KEY}",
  EPISODES_PER_PAGE: 25,
  CHART_GENRE_LIMIT: 10,
  GEMINI_MODEL: "gemini-2.5-flash",
  API_BASE: "${API_BASE}"
};`;

const configPath = path.join(__dirname, '..', 'public', 'config.js');
fs.writeFileSync(configPath, config);
console.log('✅ Generated config.js with API_BASE:', API_BASE);
```

**Update `package.json`:**
```json
{
  "scripts": {
    "prebuild": "node scripts/generate-config.js",
    "build": "vite build"
  }
}
```

---

### Step 3.4: Commit and Push

```bash
git add .
git commit -m "Add Vercel configuration and API helper"
git push
```

Vercel will automatically redeploy.

---

## 🔗 Step 4: Connect Everything

### Step 4.1: Update Backend Environment Variables

1. **Go to Render → Your Backend Service → Settings → Environment**
2. **Update `FRONTEND_URL`:**
   - Set to your Vercel URL (e.g., `https://anime-dashboard.vercel.app`)
3. **Save changes** (triggers redeploy)

---

### Step 4.2: Update AniList OAuth Redirect

1. **Go to [AniList API Settings](https://anilist.co/settings/developer)**
2. **Edit your application**
3. **Add redirect URL:**
   - `https://anime-dashboard-api.onrender.com/auth/anilist/callback`
   - (This is your **backend** URL, not frontend!)
4. **Save changes**

---

### Step 4.3: Update Frontend config.js

1. **Go to Vercel → Your Project → Settings → Environment Variables**
2. **Update `API_BASE`:**
   - Set to your backend URL (e.g., `https://anime-dashboard-api.onrender.com`)
3. **Redeploy** (or it will auto-update on next push)

---

## ✅ Step 5: Test Everything

### Step 5.1: Test Frontend

1. **Visit your Vercel URL** (e.g., `https://anime-dashboard.vercel.app`)
2. **Open browser console** (F12)
3. **Check for errors:**
   - Should see: `window.CONFIG` loaded
   - Should see: `API_BASE` is set correctly
   - No CORS errors

### Step 5.2: Test Backend

1. **Visit your backend URL** (e.g., `https://anime-dashboard-api.onrender.com/health`)
2. **Should return:** `{"status":"ok",...}`

### Step 5.3: Test API Calls

1. **Open browser console on your frontend**
2. **Try logging in:**
   - Click "Login with AniList"
   - Should redirect to AniList
   - After login, should redirect back to frontend
   - Should load your dashboard

---

## 🐛 Troubleshooting

### Issue 1: CORS Errors

**Error:** `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solution:**
1. Check that `FRONTEND_URL` is set correctly in backend `.env`
2. Check that CORS middleware is added to `server.js`
3. Make sure `credentials: 'include'` is in fetch options
4. Check browser console for exact error message

**Debug:**
```javascript
// In server.js, add logging:
app.use((req, res, next) => {
  console.log('Origin:', req.headers.origin);
  console.log('FRONTEND_URL:', FRONTEND_URL);
  // ... rest of CORS code
});
```

---

### Issue 2: API Calls Return 404

**Error:** `404 Not Found` when calling API

**Solution:**
1. Check that `API_BASE` is set correctly in `config.js`
2. Check that `apiFetch` function is working:
   ```javascript
   console.log('API_BASE:', window.CONFIG.API_BASE);
   console.log('Full URL:', window.CONFIG.API_BASE + '/api/get-anilist-data');
   ```
3. Verify backend is running (check Render logs)
4. Check that backend routes are correct

---

### Issue 3: Session Not Working

**Error:** User gets logged out immediately or can't stay logged in

**Solution:**
1. Check that `credentials: 'include'` is in all fetch calls
2. Check that `sameSite: 'lax'` is set in session cookie (for cross-domain)
3. Check that `secure: true` is set in production (HTTPS only)
4. Verify cookies are being sent (check Network tab in browser)

**Update session config:**
```javascript
cookie: {
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  httpOnly: true,
  sameSite: 'lax', // Allow cross-site cookies
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
}
```

---

### Issue 4: OAuth Redirect Not Working

**Error:** After AniList login, redirect doesn't work or goes to wrong URL

**Solution:**
1. Check that `FRONTEND_URL` is set correctly in backend
2. Check that AniList redirect URL is your **backend** URL (not frontend)
3. Check backend logs for redirect URL:
   ```javascript
   console.log('Redirecting to:', FRONTEND_URL);
   res.redirect(`${FRONTEND_URL}?auth=success`);
   ```

---

### Issue 5: config.js Not Loading

**Error:** `window.CONFIG is undefined`

**Solution:**
1. Check that `config.js` is in `public/` folder
2. Check that `index.html` includes: `<script src="config.js"></script>`
3. Check that `config.js` is being served (visit `https://your-frontend.vercel.app/config.js`)
4. Check browser console for 404 errors

---

### Issue 6: Backend Spins Down

**Error:** First API call is slow (30-60 seconds)

**Solution:**
This is expected on Render free tier. Options:
1. **Accept it** - First request is slow, subsequent requests are fast
2. **Use a ping service** - Keep backend awake (UptimeRobot, etc.)
3. **Upgrade to paid plan** - $7/month for always-on

---

## 📝 Quick Checklist

Before deploying, make sure:

- [ ] Created `scripts/api-config.js` with `apiFetch` function
- [ ] Updated all `fetch('/api/` calls to use `apiFetch`
- [ ] Updated all `fetch('/auth/` calls to use `apiFetch`
- [ ] Added CORS middleware to `server.js`
- [ ] Updated `FRONTEND_URL` in backend environment variables
- [ ] Created `public/config.js` with correct `API_BASE`
- [ ] Created `vercel.json` for Vercel deployment
- [ ] Updated AniList OAuth redirect URL to backend URL
- [ ] Committed and pushed all changes

---

## 🎉 Final Architecture

```
User Browser
    │
    ├─→ Frontend (Vercel)
    │   https://anime-dashboard.vercel.app
    │   - Always-on
    │   - Static files (HTML, CSS, JS)
    │   - Loads instantly
    │
    └─→ API Calls (with credentials)
        │
        ├─→ Backend (Render)
        │   https://anime-dashboard-api.onrender.com
        │   - Can spin down (first request slow)
        │   - Express API
        │   - Authentication
        │   - Database queries
        │
        └─→ Consumet API (Render)
            https://consumet-api.onrender.com
            - Can spin down
            - Streaming links
```

---

## 🚀 You're Done!

Your frontend is now always-on, and your backend can spin down. Users get instant page loads! 🎌

**Frontend**: https://anime-dashboard.vercel.app (always-on)  
**Backend**: https://anime-dashboard-api.onrender.com (can spin down)

If you run into any issues, check the troubleshooting section above or let me know!

