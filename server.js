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
// Serve SPA (static files + fallback to index.html)
// =====================================================================
app.use(express.static(path.join(__dirname, '')));

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