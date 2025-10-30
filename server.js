// server.js
// Production-ready with PostgreSQL and secure static file serving

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

// --- Import Routers ---
const authRoutes = require('./routes/auth.js');
const apiRoutes = require('./routes/api.js');
const gachaRoutes = require('./routes/gacha.js');

// --- Import Helpers ---
const { jikanCache } = require('./utils/jikan.js');
const { maybeRefreshToken } = require('./routes/auth.js');

// --- PostgreSQL Session Store Setup ---
let pgSession, Pool, pgPool;
if (process.env.DATABASE_URL) {
  pgSession = require('connect-pg-simple')(session);
  ({ Pool } = require('pg'));
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  // Auto-create session table
  (async () => {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS "user_sessions" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          PRIMARY KEY ("sid")
        );
      `);
      await pgPool.query(`
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
      `);
      console.log('✅ Session table ready');
    } catch (err) {
      console.warn('⚠️ Session table setup warning:', err.message);
    }
  })();
}

const app = express();
app.set('trust proxy', 1);

// --- Config ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';

// --- Session Middleware ---
app.use(session({
  store: pgPool ? new pgSession({ pool: pgPool, tableName: 'user_sessions' }) : undefined,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// --- Body Parsers ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================================
// Auth Middleware
// =====================================================================
const requireAuth = async (req, res, next) => {
  if (req.session?.auth?.service !== 'anilist') {
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }

  await maybeRefreshToken(req.session);

  if (!req.session?.auth?.service || req.session.auth.service !== 'anilist') {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }

  if (!req.session.internalUserId) {
    return res.status(401).json({ error: 'User session is missing internal ID.' });
  }

  next();
};

// =====================================================================
// Health Check Endpoint (BEFORE other routes)
// =====================================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: pgPool ? 'connected' : 'not configured'
  });
});

// =====================================================================
// API Routes
// =====================================================================

// Authentication routes (NO auth required)
app.use('/auth', authRoutes);

// Gacha API routes (requires auth)
app.use('/api/gacha', requireAuth, gachaRoutes);

// Main data API routes (requires auth)
app.use('/api', requireAuth, apiRoutes);

// Cache stats endpoint
app.get('/api/cache-stats', (req, res) => {
  try {
    const jikanUtils = require('./utils/jikan.js');
    res.json({
      jikanCacheSize: jikanUtils.jikanCache.size,
      jikanQueueLength: apiRoutes.jikanLimiter?.queue?.length || 0,
      jikanRequestCount: apiRoutes.jikanLimiter?.requestCount || 0,
      gachaUsers: gachaRoutes.gachaStates?.size || 0
    });
  } catch (error) {
    console.error("Error fetching cache stats:", error);
    res.status(500).json({ error: "Could not retrieve cache statistics" });
  }
});

// =====================================================================
// Static File Serving with Proper MIME Types
// =====================================================================

const staticOptions = {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    if (filepath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filepath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
};

// Serve static directories
app.use('/scripts', express.static(path.join(__dirname, 'scripts'), staticOptions));
app.use('/css', express.static(path.join(__dirname, 'css'), staticOptions));
app.use('/images', express.static(path.join(__dirname, 'images'), staticOptions));
app.use('/cosmetics', express.static(path.join(__dirname, 'cosmetics'), staticOptions));

// Serve manifest files
app.get('/gacha-manifest.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(__dirname, 'gacha-manifest.json'));
});

app.get('/cosmetics-manifest.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(__dirname, 'cosmetics-manifest.json'));
});

// Serve config.js (checks for Secret File first, then generates from env vars)
app.get('/config.js', (req, res) => {
  const configPath = path.join(__dirname, 'config.js');
  const fs = require('fs');
  
  if (fs.existsSync(configPath)) {
    // Serve local config.js or Render Secret File
    res.type('application/javascript');
    res.sendFile(configPath);
  } else {
    // Generate config from environment variables
    const config = `window.CONFIG = {
  DASHBOARD_TITLE: "${process.env.DASHBOARD_TITLE || 'My Anime Dashboard'}",
  DASHBOARD_SUBTITLE: "${process.env.DASHBOARD_SUBTITLE || 'Visualize your anime watching journey.'}",
  GEMINI_API_KEY: "${process.env.GEMINI_API_KEY || ''}",
  EPISODES_PER_PAGE: ${process.env.EPISODES_PER_PAGE || 25},
  CHART_GENRE_LIMIT: ${process.env.CHART_GENRE_LIMIT || 10},
  GACHA_EPISODES_PER_TOKEN: ${process.env.GACHA_EPISODES_PER_TOKEN || 50},
  GACHA_INITIAL_TOKENS: ${process.env.GACHA_INITIAL_TOKENS || 5},
  GEMINI_MODEL: "${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}",
  API_BASE: "${process.env.BASE_URL || 'http://localhost:3000'}"
};`;
    res.type('application/javascript').send(config);
  }
});

// =====================================================================
// HTML Routes
// =====================================================================

// Serve root index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =====================================================================
// Fallback for Client-Side Routing (MUST be last!)
// =====================================================================
// FIXED: Changed from app.get('*', ...) to app.use() to avoid path-to-regexp error
app.use((req, res, next) => {
  // If request is for static assets or API routes, skip to 404
  if (
    req.path.startsWith('/scripts/') ||
    req.path.startsWith('/css/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/cosmetics/') ||
    req.path.startsWith('/api/') ||
    req.path.startsWith('/auth/') ||
    req.path.endsWith('.json') ||
    req.path === '/config.js' ||
    req.path === '/health'
  ) {
    return next(); // Let Express handle 404
  }
  
  // Otherwise, serve index.html for client-side routing
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =====================================================================
// 404 Handler (for unmatched routes)
// =====================================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// =====================================================================
// Error Handling
// =====================================================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// =====================================================================
// Start Server
// =====================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
  console.log(`🎮 Gacha system active (in-memory storage)`);
});