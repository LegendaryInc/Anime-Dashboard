// server.js
// Simplified after MAL removal

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');

// --- Import Routers ---
const authRoutes = require('./routes/auth.js');
const apiRoutes = require('./routes/api.js');
const gachaRoutes = require('./routes/gacha.js');

// --- Import Helpers ---
const { jikanCache } = require('./utils/jikan.js'); // Assuming jikan.js is in utils
const { maybeRefreshToken } = require('./routes/auth.js');

// --- Optional Postgres-backed sessions ---
// ... (Database session setup remains unchanged) ...
let pgSession, Pool, pgPool;
if (process.env.DATABASE_URL) {
  pgSession = require('connect-pg-simple')(session);
  ({ Pool } = require('pg'));
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  // Auto-create session table... (unchanged)
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
      console.warn('⚠️  Session table setup warning:', err.message);
    }
  })();
}


const app = express();
app.set('trust proxy', 1);

// --- Config ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';

// --- Sessions ---
// ... (Session middleware setup remains unchanged) ...
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


// --- Parsers ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================================
// Auth Middleware (Simplified)
// =====================================================================
const requireAuth = async (req, res, next) => {
  // 1. Check if auth session exists (specifically AniList now)
  if (req.session?.auth?.service !== 'anilist') {
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }

  // 2. Try to refresh the token
  await maybeRefreshToken(req.session);

  // 3. Check auth again (in case refresh failed)
  if (!req.session || !req.session.auth || req.session.auth.service !== 'anilist') {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }

  // 4. Check for internal Gacha ID
  if (!req.session.internalUserId) {
    // This shouldn't happen if they logged in successfully, but good to check
    return res.status(401).json({ error: 'User session is missing internal ID.' });
  }

  // All checks passed
  next();
};

// =====================================================================
// Connect Routers
// =====================================================================

// Authentication routes (NO auth required)
app.use('/auth', authRoutes);

// Gacha API routes (requires auth)
app.use('/api/gacha', requireAuth, gachaRoutes);

// Main data API routes (requires auth)
app.use('/api', requireAuth, apiRoutes);


// =====================================================================
// Other Endpoints (Cache Stats - Optional)
// =====================================================================
app.get('/api/cache-stats', (req, res) => {
    try {
        const jikanUtils = require('./utils/jikan.js'); // Require inside if needed
        res.json({
            jikanCacheSize: jikanUtils.jikanCache.size,
            jikanQueueLength: apiRoutes.jikanLimiter.queue.length, // Assumes jikanLimiter is exported from apiRoutes
            jikanRequestCount: apiRoutes.jikanLimiter.requestCount,
            gachaUsers: gachaRoutes.gachaStates.size // Assumes gachaStates is exported
        });
    } catch (error) {
         console.error("Error fetching cache stats:", error);
         res.status(500).json({error: "Could not retrieve cache statistics"});
    }
});


// =====================================================================
// Serve Static Files (Secure - Only Specific Directories)
// =====================================================================

// Configure express.static with proper MIME types
const staticOptions = {
  setHeaders: (res, filepath) => {
    // Set correct MIME types for CSS files
    if (filepath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    // Set correct MIME types for JavaScript files
    if (filepath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Set correct MIME types for JSON files
    if (filepath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
};

// Serve frontend assets from specific directories only
app.use('/scripts', express.static(path.join(__dirname, 'scripts'), staticOptions));
app.use('/css', express.static(path.join(__dirname, 'css'), staticOptions));
app.use('/images', express.static(path.join(__dirname, 'images'), staticOptions));
app.use('/cosmetics', express.static(path.join(__dirname, 'cosmetics'), staticOptions));

// Serve manifest files explicitly
app.get('/gacha-manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'gacha-manifest.json'));
});

app.get('/cosmetics-manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'cosmetics-manifest.json'));
});

// Serve config.js if it exists (for local development)
app.get('/config.js', (req, res) => {
  const configPath = path.join(__dirname, 'config.js');
  if (require('fs').existsSync(configPath)) {
    res.sendFile(configPath);
  } else {
    // In production, generate config from environment variables
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

// Serve root index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for client-side routing
app.get(/^(?!\/(api|auth)).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =====================================================================
// Start
// =====================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on ${PORT}`);
  console.log(`🎮 Gacha system active (in-memory storage)`);
});