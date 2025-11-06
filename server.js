// server.js
// Production-ready with PostgreSQL and secure static file serving

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

// --- Import Routers ---
const authRoutes = require('./routes/auth.js');
const apiRoutes = require('./routes/api.js');

// --- Import Helpers ---
const axios = require('axios');
const { jikanCache } = require('./utils/jikan.js');
const { maybeRefreshToken } = require('./routes/auth.js');
const streamingUtils = require('./utils/streaming.js');

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

// --- VERY EARLY Request Logging (before everything) ---
app.use((req, res, next) => {
  // Log ALL requests to see if Express is receiving anything
  console.log(`🚨 [VERY EARLY] ${req.method} ${req.path}`);
  console.error(`🚨 [VERY EARLY] ${req.method} ${req.path}`);
  if (req.path.startsWith('/api')) {
    console.log(`   📡 API Request: ${req.method} ${req.path}`);
    console.error(`   📡 API Request: ${req.method} ${req.path}`);
    console.log(`   URL: ${req.url}, Original: ${req.originalUrl}, Base: ${req.baseUrl}`);
    console.error(`   URL: ${req.url}, Original: ${req.originalUrl}, Base: ${req.baseUrl}`);
  }
  next();
});

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

// Log all API requests for debugging (VERY EARLY - before everything)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`📡 [EARLY REQUEST] ${req.method} ${req.path}`, {
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      headers: req.headers['content-type']
    });
  }
  next();
});

// =====================================================================
// Auth Middleware
// =====================================================================
const requireAuth = async (req, res, next) => {
  // Use both console.log and console.error to ensure logs appear
  console.error('🔐 [requireAuth] ===== AUTH CHECK STARTING =====');
  console.error('🔐 [requireAuth] Path:', req.path);
  console.error('🔐 [requireAuth] Session exists:', !!req.session);
  console.error('🔐 [requireAuth] Auth service:', req.session?.auth?.service);
  console.error('🔐 [requireAuth] Internal user ID:', req.session?.internalUserId);
  console.log('🔐 [requireAuth] ===== AUTH CHECK STARTING =====');
  console.log('🔐 [requireAuth] Path:', req.path);
  console.log('🔐 [requireAuth] Session exists:', !!req.session);
  console.log('🔐 [requireAuth] Auth service:', req.session?.auth?.service);
  console.log('🔐 [requireAuth] Internal user ID:', req.session?.internalUserId);
  
  if (req.session?.auth?.service !== 'anilist') {
    console.error('❌ [requireAuth] ERROR: Not authenticated with AniList');
    console.log('❌ [requireAuth] ERROR: Not authenticated with AniList');
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }

  await maybeRefreshToken(req.session);

  if (!req.session?.auth?.service || req.session.auth.service !== 'anilist') {
    console.error('❌ [requireAuth] ERROR: Session expired');
    console.log('❌ [requireAuth] ERROR: Session expired');
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }

  if (!req.session.internalUserId) {
    console.error('❌ [requireAuth] ERROR: Missing internal user ID');
    console.log('❌ [requireAuth] ERROR: Missing internal user ID');
    return res.status(401).json({ error: 'User session is missing internal ID.' });
  }

  console.error('✅ [requireAuth] Auth check passed, calling next()');
  console.log('✅ [requireAuth] Auth check passed, calling next()');
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

// Gacha routes removed - backed up to gacha-backup/

// Direct routes removed - using router routes instead

// Main data API routes (requires auth)
// Note: requireAuth middleware runs BEFORE routes are matched
// IMPORTANT: When using app.use('/api', ...), Express strips '/api' from req.path before passing to router
// So router.post('/anilist/update-notes', ...) matches '/api/anilist/update-notes' requests
app.use('/api', (req, res, next) => {
  console.error(`🚨 [API Middleware] ${req.method} ${req.path} - BEFORE requireAuth`);
  console.log(`🚨 [API Middleware] ${req.method} ${req.path} - BEFORE requireAuth`);
  console.error(`   req.path: ${req.path}, req.baseUrl: ${req.baseUrl}, req.originalUrl: ${req.originalUrl}`);
  console.error(`   Router will see: ${req.path} (Express strips /api prefix)`);
  next();
}, requireAuth, apiRoutes);

// Test endpoints to verify routes are working
// MUST be after app.use('/api') to override the auth middleware
app.post('/api/test-route', (req, res) => {
  console.log('✅ Test route hit!', req.method, req.path);
  res.json({ success: true, message: 'Test route is working', path: req.path });
});

// Simple test endpoints - NO AUTH to test if routes work at all
app.post('/api/test-simple', (req, res) => {
  console.log('✅ [TEST SIMPLE] Route hit!', req.method, req.path);
  res.json({ success: true, message: 'Simple test works!' });
});

app.post('/api/anilist/test-no-auth', (req, res) => {
  console.log('✅ [TEST NO AUTH] Route hit!', req.method, req.path);
  res.json({ success: true, message: 'No-auth test works!' });
});

// Simple test endpoint that matches the exact path pattern
app.post('/api/anilist/update-notes-test', requireAuth, (req, res) => {
  console.log('✅ [TEST] update-notes-test route hit!', req.method, req.path);
  console.log('✅ [TEST] Request body:', req.body);
  res.json({ success: true, message: 'Test endpoint works!', path: req.path, body: req.body });
});

// Debug: Log router routes (development only)
if (process.env.NODE_ENV !== 'production') {
  console.log('🔍 Router routes (apiRoutes):');
  let routeCount = 0;
  apiRoutes.stack.forEach((r, index) => {
    if (r.route) {
      const methods = Object.keys(r.route.methods).join(', ').toUpperCase();
      console.log(`   [${index}] ${methods} /api${r.route.path}`);
      routeCount++;
    } else if (r.name === 'router') {
      console.log(`   [${index}] [Nested Router: ${r.regexp.source}]`);
    } else {
      console.log(`   [${index}] Middleware: ${r.name || 'unnamed'}`);
    }
  });
  console.log(`   Total router routes: ${routeCount}`);
}

// =====================================================================
// STREAMING LINKS API (requires auth)
// =====================================================================

/**
 * Get streaming links for a single anime by MAL ID
 * GET /api/streaming/:malId
 */
app.get('/api/streaming/:malId', requireAuth, async (req, res) => {
  try {
    const malId = parseInt(req.params.malId);
    const animeTitle = req.query.title || 'Unknown';
    
    if (!malId || isNaN(malId)) {
      return res.status(400).json({ error: 'Invalid MAL ID' });
    }
    
    const streamingInfo = await streamingUtils.getStreamingInfo(malId, animeTitle);
    res.json(streamingInfo);
  } catch (error) {
    console.error('Error fetching streaming info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch streaming information',
      details: error.message 
    });
  }
});

/**
 * Get streaming links for multiple anime (batch)
 * POST /api/streaming/batch
 * Body: { animeList: [{ idMal: 123, title: "..." }, ...] }
 */
app.post('/api/streaming/batch', requireAuth, async (req, res) => {
  try {
    const { animeList } = req.body;
    
    if (!Array.isArray(animeList)) {
      return res.status(400).json({ error: 'animeList must be an array' });
    }
    
    // Limit batch size to avoid overwhelming Jikan API
    const limitedList = animeList.slice(0, 50);
    
    const streamingInfo = await streamingUtils.batchGetStreamingInfo(limitedList);
    res.json({ results: streamingInfo });
  } catch (error) {
    console.error('Error fetching batch streaming info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch streaming information',
      details: error.message 
    });
  }
});

/**
 * Get free streaming site links (no Jikan API call needed)
 * POST /api/streaming/free
 * Body: { title: "...", malId: 123 }
 */
app.post('/api/streaming/free', requireAuth, async (req, res) => {
  try {
    const { title, malId } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    
    const freeLinks = streamingUtils.getFreeStreamingSites({ title, mal_id: malId });
    res.json({ free: freeLinks });
  } catch (error) {
    console.error('Error generating free links:', error);
    res.status(500).json({ 
      error: 'Failed to generate streaming links',
      details: error.message 
    });
  }
});

// Cache stats endpoint (updated)
app.get('/api/cache-stats', (req, res) => {
  try {
    const jikanUtils = require('./utils/jikan.js');
    const streamingStats = streamingUtils.getCacheStats();
    
    res.json({
      jikanCacheSize: jikanUtils.jikanCache.size,
      streamingCacheSize: streamingStats.size,
      jikanQueueLength: apiRoutes.jikanLimiter?.queue?.length || 0,
      jikanRequestCount: apiRoutes.jikanLimiter?.requestCount || 0
    });
  } catch (error) {
    console.error("Error fetching cache stats:", error);
    res.status(500).json({ error: "Could not retrieve cache statistics" });
  }
});

// =====================================================================
// Static File Serving with Proper MIME Types
// =====================================================================

const fs = require('fs');
const distPath = path.join(__dirname, 'dist');
// Only serve production build if explicitly in production mode AND dist/ exists
const isProduction = process.env.NODE_ENV === 'production';
const hasProductionBuild = isProduction && fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

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

// Serve production build if available, otherwise serve development files
if (hasProductionBuild) {
  // Production: Serve optimized assets from dist/
  app.use('/assets', express.static(path.join(distPath, 'assets'), staticOptions));
  // Still serve images and cosmetics from source (not in dist/)
  app.use('/images', express.static(path.join(__dirname, 'images'), staticOptions));
  app.use('/cosmetics', express.static(path.join(__dirname, 'cosmetics'), staticOptions));
  console.log('📦 Serving production build from dist/');
} else {
  // Development: Serve source files directly
  app.use('/scripts', express.static(path.join(__dirname, 'scripts'), staticOptions));
  app.use('/css', express.static(path.join(__dirname, 'css'), staticOptions));
  app.use('/images', express.static(path.join(__dirname, 'images'), staticOptions));
  app.use('/cosmetics', express.static(path.join(__dirname, 'cosmetics'), staticOptions));
  console.log('🔧 Serving development files from source');
}

// Serve manifest files
app.get('/cosmetics-manifest.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(__dirname, 'cosmetics-manifest.json'));
});

// Serve config.js (checks for Secret File first, then generates from env vars)
app.get('/config.js', (req, res) => {
  const configPath = path.join(__dirname, 'config.js');
  
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
  GEMINI_MODEL: "${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}",
  API_BASE: "${process.env.BASE_URL || 'http://localhost:3000'}"
};`;
    res.type('application/javascript').send(config);
  }
});

// =====================================================================
// HTML Routes
// =====================================================================

// Serve root index.html (production build if available, otherwise dev)
app.get('/', (req, res) => {
  if (hasProductionBuild) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// =====================================================================
// Fallback for Client-Side Routing (MUST be last!)
// =====================================================================
app.use((req, res, next) => {
  // If request is for static assets or API routes, skip to 404
  if (
    req.path.startsWith('/assets/') ||
    (hasProductionBuild === false && (req.path.startsWith('/scripts/') || req.path.startsWith('/css/'))) ||
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
  if (hasProductionBuild) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// =====================================================================
// 404 Handler (for unmatched routes)
// =====================================================================
app.use((req, res) => {
  console.error(`❌ [404 HANDLER] Route not found: ${req.method} ${req.path}`);
  console.log(`❌ [404 HANDLER] Route not found: ${req.method} ${req.path}`);
  console.error(`   URL: ${req.url}, Original: ${req.originalUrl}, Base: ${req.baseUrl}`);
  console.error(`   Headers: ${JSON.stringify(req.headers)}`);
  console.error(`   Was this an API route? ${req.path.startsWith('/api')}`);
  if (req.path.startsWith('/api')) {
    console.error(`   API Routes available:`);
    apiRoutes.stack.forEach((r, i) => {
      if (r.route) {
        const methods = Object.keys(r.route.methods).join(', ').toUpperCase();
        console.error(`     [${i}] ${methods} ${r.route.path}`);
      }
    });
  }
  res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
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
  console.log(`📺 Streaming links API ready (Jikan + free sites)`);
  
  // Debug: Log ALL registered routes after server starts
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n🔍 ===== ALL REGISTERED ROUTES =====');
    
    // Log all app-level routes
    console.log('\n📋 App-level routes:');
    let appRouteCount = 0;
    if (app._router && app._router.stack) {
      app._router.stack.forEach((middleware, index) => {
        if (middleware.route) {
          const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
          console.log(`   [${index}] ${methods} ${middleware.route.path}`);
          appRouteCount++;
        } else if (middleware.name === 'router') {
          console.log(`   [${index}] Router mounted at: ${middleware.regexp?.source || 'N/A'}`);
        } else {
          const name = middleware.name || 'unnamed';
          const regexp = middleware.regexp?.source || 'N/A';
          console.log(`   [${index}] ${name} (regexp: ${regexp})`);
        }
      });
    } else {
      console.log('   ⚠️ app._router not available');
    }
    console.log(`   Total app-level routes: ${appRouteCount}`);
    console.log('🔍 ===== END ROUTE REGISTRATION =====\n');
  }
});