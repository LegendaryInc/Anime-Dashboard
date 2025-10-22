// =====================================================================
// --- BACKEND SERVER (server.js) - WITH GACHA API ROUTES ---
// =====================================================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

// Optional Postgres-backed sessions (recommended for production)
// Only enabled if DATABASE_URL is present.
let pgSession, Pool, pgPool;
if (process.env.DATABASE_URL) {
  pgSession = require('connect-pg-simple')(session);
  ({ Pool } = require('pg'));
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Auto-create session table if it doesn't exist
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
app.set('trust proxy', 1); // trust first proxy (Render/Fly/etc.)

// --- Config ---
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';

// --- Sessions ---
app.use(session({
  store: pgPool ? new pgSession({ pool: pgPool, tableName: 'user_sessions' }) : undefined,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true when behind HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// --- Parsers ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================================
// GACHA SYSTEM - In-Memory Storage
// =====================================================================
// NOTE: This uses in-memory storage. Data will be lost on server restart.
// For production, replace with a database (PostgreSQL, MongoDB, etc.)

const gachaStates = new Map();

// Helper: Get or initialize gacha state for user
function getUserGachaState(userId) {
  if (!gachaStates.has(userId)) {
    gachaStates.set(userId, {
      tokens: 5,              // Initial tokens
      shards: 0,
      totalPulls: 0,          // Track total rolls made
      collection: [],         // Array of card objects
      appliedCosmetics: {},   // { cardId: cosmeticName }
      ownedCosmetics: []      // Array of cosmetic IDs
    });
  }
  return gachaStates.get(userId);
}

// Helper: Calculate shards by rarity
// 🎨 CUSTOMIZE: Change these values to adjust shard rewards
function getShardsByRarity(rarity) {
  const shardMap = {
    'Common': 1,      // ⭐⭐ 2-star cards
    'Rare': 3,        // ⭐⭐⭐ 3-star cards
    'Epic': 5,        // ⭐⭐⭐⭐ 4-star cards
    'Legendary': 10   // ⭐⭐⭐⭐⭐ 5-star & Prismatic cards
  };
  return shardMap[rarity] || 1; // Default to 1 if rarity not found
}

// Middleware: Require authentication
function requireAuth(req, res, next) {
  if (!req.session || !req.session.anilist?.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // Create a userId from the session if it doesn't exist
  if (!req.session.userId) {
    req.session.userId = req.session.anilist.access_token.substring(0, 16);
  }
  next();
}

// =====================================================================
// GACHA API ROUTES
// =====================================================================

// GET /api/gacha/state - Get user's gacha state
app.get('/api/gacha/state', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const state = getUserGachaState(userId);
    
    console.log(`📊 Loading gacha state for user ${userId}`);
    
    res.json({
      tokens: state.tokens,
      shards: state.shards,
      collection: state.collection,
      appliedCosmetics: state.appliedCosmetics,
      ownedCosmetics: state.ownedCosmetics
    });
  } catch (error) {
    console.error('❌ Get state error:', error);
    res.status(500).json({ error: 'Failed to get gacha state' });
  }
});

// POST /api/gacha/calculate-tokens - Calculate tokens from episodes
app.post('/api/gacha/calculate-tokens', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const { totalEpisodes } = req.body;
    const state = getUserGachaState(userId);
    
    if (typeof totalEpisodes !== 'number' || totalEpisodes < 0) {
      return res.status(400).json({ error: 'Invalid totalEpisodes value' });
    }
    
    // Calculate tokens: 1 token per 50 episodes (configurable)
    const EPISODES_PER_TOKEN = 50;
    const earnedTokens = Math.floor(totalEpisodes / EPISODES_PER_TOKEN);
    
    // Track total pulls if not already tracked
    if (!state.totalPulls) {
      state.totalPulls = 0;
    }
    
    // Calculate available tokens: earned - already used
    const availableTokens = Math.max(0, earnedTokens - state.totalPulls);
    state.tokens = availableTokens;
    
    console.log(`🎟️  User ${userId}: ${availableTokens} tokens (earned: ${earnedTokens}, used: ${state.totalPulls})`);
    
    res.json({
      tokens: state.tokens,
      shards: state.shards
    });
  } catch (error) {
    console.error('❌ Calculate tokens error:', error);
    res.status(500).json({ error: 'Failed to calculate tokens' });
  }
});

// POST /api/gacha/roll - Perform a gacha roll
app.post('/api/gacha/roll', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const { card } = req.body;
    const state = getUserGachaState(userId);
    
    // Validate request
    if (!card || !card.id || !card.name || !card.anime || !card.rarity) {
      return res.status(400).json({ error: 'Invalid card data - missing required fields' });
    }
    
    // Check if user has enough tokens
    if (state.tokens < 1) {
      return res.status(400).json({ error: 'Not enough tokens' });
    }
    
    // Deduct token and increment pull counter
    state.tokens -= 1;
    state.totalPulls = (state.totalPulls || 0) + 1;
    
    // Check for duplicate
    const existingCard = state.collection.find(c => c.id === card.id);
    
    if (existingCard) {
      // Duplicate - award shards
      const shardsAwarded = getShardsByRarity(card.rarity);
      state.shards += shardsAwarded;
      
      // Increment count
      existingCard.count = (existingCard.count || 1) + 1;
      
      console.log(`🔁 User ${userId}: Duplicate ${card.name} (+${shardsAwarded} shards) [Pull #${state.totalPulls}]`);
      
      res.json({
        tokens: state.tokens,
        shards: state.shards,
        isDuplicate: true,
        shardsAwarded
      });
    } else {
      // New card - add to collection
      state.collection.push({
        id: card.id,
        name: card.name,
        anime: card.anime,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        count: 1
      });
      
      console.log(`✨ User ${userId}: New card ${card.name} (${card.rarity}) [Pull #${state.totalPulls}]`);
      
      res.json({
        tokens: state.tokens,
        shards: state.shards,
        isDuplicate: false
      });
    }
  } catch (error) {
    console.error('❌ Roll error:', error);
    res.status(500).json({ error: 'Failed to perform roll' });
  }
});

// POST /api/gacha/buy-pack - Buy a cosmetic pack
app.post('/api/gacha/buy-pack', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const { packCost, cosmetics } = req.body;
    const state = getUserGachaState(userId);
    
    // Validate
    if (typeof packCost !== 'number' || !Array.isArray(cosmetics)) {
      return res.status(400).json({ error: 'Invalid pack data' });
    }
    
    // Check if user has enough shards
    if (state.shards < packCost) {
      return res.status(400).json({ error: 'Not enough shards' });
    }
    
    // Deduct shards
    state.shards -= packCost;
    
    // Add cosmetics to owned (avoid duplicates)
    cosmetics.forEach(cosmeticId => {
      if (!state.ownedCosmetics.includes(cosmeticId)) {
        state.ownedCosmetics.push(cosmeticId);
      }
    });
    
    console.log(`🎨 User ${userId}: Bought pack for ${packCost} shards`);
    
    res.json({
      shards: state.shards,
      cosmetics: state.ownedCosmetics
    });
  } catch (error) {
    console.error('❌ Buy pack error:', error);
    res.status(500).json({ error: 'Failed to buy pack' });
  }
});

// POST /api/gacha/apply-cosmetic - Apply a cosmetic to a card
app.post('/api/gacha/apply-cosmetic', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    const { cardId, cosmeticName } = req.body;
    const state = getUserGachaState(userId);
    
    // Validate
    if (!cardId || !cosmeticName) {
      return res.status(400).json({ error: 'Invalid cosmetic data' });
    }
    
    // Apply or remove cosmetic
    if (cosmeticName === 'Default') {
      delete state.appliedCosmetics[cardId];
      console.log(`🖌️  User ${userId}: Removed cosmetic from card`);
    } else {
      // Check if user owns this cosmetic
      if (!state.ownedCosmetics.includes(cosmeticName)) {
        return res.status(400).json({ error: 'Cosmetic not owned' });
      }
      state.appliedCosmetics[cardId] = cosmeticName;
      console.log(`🖌️  User ${userId}: Applied ${cosmeticName} to card`);
    }
    
    res.json({
      appliedCosmetics: state.appliedCosmetics
    });
  } catch (error) {
    console.error('❌ Apply cosmetic error:', error);
    res.status(500).json({ error: 'Failed to apply cosmetic' });
  }
});

// POST /api/gacha/reset - Reset user's gacha collection
app.post('/api/gacha/reset', requireAuth, (req, res) => {
  try {
    const userId = req.session.userId;
    
    console.log(`🔄 Resetting gacha collection for user ${userId}`);
    
    // Reset to initial state
    gachaStates.set(userId, {
      tokens: 5,
      shards: 0,
      totalPulls: 0,
      collection: [],
      appliedCosmetics: {},
      ownedCosmetics: []
    });
    
    console.log(`✅ User ${userId}: Gacha collection reset`);
    
    res.json({
      success: true,
      message: 'Gacha collection reset successfully',
      tokens: 5,
      shards: 0,
      collection: [],
      appliedCosmetics: {},
      ownedCosmetics: []
    });
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reset gacha collection',
      message: error.message 
    });
  }
});

// =====================================================================
// Jikan API Rate Limiter with Caching
// =====================================================================

// In-memory cache for Jikan results (lasts for server lifetime)
const jikanCache = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Rate limiting: Jikan allows 3 req/sec, 60 req/min
// We'll be conservative: 2 req/sec with delays
class JikanRateLimiter {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minDelayMs = 500; // 2 requests per second (conservative)
    this.requestCount = 0;
    this.minuteStart = Date.now();
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      
      // Reset counter every minute
      if (now - this.minuteStart > 60000) {
        this.requestCount = 0;
        this.minuteStart = now;
      }

      // Check if we've hit per-minute limit (50 to be safe, limit is 60)
      if (this.requestCount >= 50) {
        const waitTime = 60000 - (now - this.minuteStart);
        console.log(`⏳ Jikan rate limit: waiting ${Math.ceil(waitTime / 1000)}s`);
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.minuteStart = Date.now();
      }

      // Enforce minimum delay between requests
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelayMs) {
        await this.sleep(this.minDelayMs - timeSinceLastRequest);
      }

      const { fn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();
      this.requestCount++;

      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const jikanLimiter = new JikanRateLimiter();

// Fetch English title from Jikan with rate limiting, caching, and retry logic
async function fetchEnglishFromJikan(idMal, retries = 3) {
  if (!idMal) return null;

  // Check cache first
  const cacheKey = `jikan_${idMal}`;
  const cached = jikanCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.title;
  }

  // Add to rate-limited queue
  return jikanLimiter.add(async () => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const r = await axios.get(`https://api.jikan.moe/v4/anime/${idMal}`, {
          timeout: 5000,
          headers: { 'User-Agent': 'Anime-Dashboard/1.0' }
        });
        
        const title = r?.data?.data?.title_english?.trim() || null;
        
        // Cache the result
        jikanCache.set(cacheKey, {
          title,
          timestamp: Date.now()
        });
        
        return title;
      } catch (error) {
        // Handle rate limit (429) or server errors (5xx)
        if (error.response?.status === 429 || error.response?.status >= 500) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 8000); // Exponential backoff, max 8s
          console.warn(`⚠️  Jikan error for MAL ${idMal}, retry ${attempt + 1}/${retries} after ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // 404 or other errors - cache as null to avoid repeated requests
        if (error.response?.status === 404) {
          jikanCache.set(cacheKey, { title: null, timestamp: Date.now() });
        }
        
        return null;
      }
    }
    
    // All retries failed
    console.warn(`❌ Jikan failed for MAL ${idMal} after ${retries} attempts`);
    return null;
  });
}

// =====================================================================
// Helpers
// =====================================================================

// Light-weight concurrency limiter for parallel operations
function pLimit(max) {
  const queue = [];
  let active = 0;
  const next = () => {
    active--;
    if (queue.length) queue.shift()();
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then((v) => {
            resolve(v);
            next();
          })
          .catch((e) => {
            reject(e);
            next();
          });
      };
      if (active < max) run();
      else queue.push(run);
    });
}
const limit = pLimit(10); // Can process more in parallel since Jikan has its own queue

// Refresh AniList token a bit early if we have a refresh token.
async function maybeRefreshToken(sess) {
  const tk = sess?.anilist;
  if (!tk?.refresh_token || !tk?.obtained_at || !tk?.expires_in) return;
  const age = (Date.now() - tk.obtained_at) / 1000;
  if (age < Math.max(1, tk.expires_in - 120)) return; // still fresh

  try {
    const resp = await axios.post('https://anilist.co/api/v2/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.ANILIST_CLIENT_ID,
      client_secret: process.env.ANILIST_CLIENT_SECRET,
      refresh_token: tk.refresh_token
    }, { headers: { 'Content-Type': 'application/json' } });

    sess.anilist = {
      access_token: resp.data.access_token,
      token_type: resp.data.token_type,
      expires_in: resp.data.expires_in,
      refresh_token: resp.data.refresh_token || tk.refresh_token,
      obtained_at: Date.now()
    };
  } catch (e) {
    console.warn('Token refresh failed:', e?.response?.data || e.message);
    delete sess.anilist;
  }
}

// =====================================================================
// AniList OAuth – Auth Code Flow
// =====================================================================

// 1) Send user to AniList to authorize
app.get('/auth/anilist', (req, res) => {
  const authUrl = 'https://anilist.co/api/v2/oauth/authorize';
  const redirectUri = `${BASE_URL}/auth/anilist/callback`;
  const params = new URLSearchParams({
    client_id: process.env.ANILIST_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code'
  });
  res.redirect(`${authUrl}?${params.toString()}`);
});

// 2) AniList redirects back here with ?code=...
app.get('/auth/anilist/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');

  try {
    const tokenResp = await axios.post('https://anilist.co/api/v2/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.ANILIST_CLIENT_ID,
      client_secret: process.env.ANILIST_CLIENT_SECRET,
      redirect_uri: `${BASE_URL}/auth/anilist/callback`,
      code
    }, { headers: { 'Content-Type': 'application/json' } });

    req.session.anilist = {
      access_token: tokenResp.data.access_token,
      token_type: tokenResp.data.token_type,
      expires_in: tokenResp.data.expires_in,
      refresh_token: tokenResp.data.refresh_token,
      obtained_at: Date.now()
    };

    res.redirect('/'); // back to SPA
  } catch (err) {
    console.error('AniList token exchange failed:', err?.response?.data || err.message);
    res.status(500).send('OAuth failed');
  }
});

// =====================================================================
// API: Return the user's anime list (normalized for the frontend)
// =====================================================================
app.get('/api/get-anilist-data', async (req, res) => {
  try {
    if (!req.session?.anilist?.access_token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await maybeRefreshToken(req.session);
    const accessToken = req.session.anilist?.access_token;
    if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });

    // 1) Get Viewer (id)
    const viewerResp = await axios.post(
      'https://graphql.anilist.co',
      { query: `query { Viewer { id name } }` },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userId = viewerResp.data?.data?.Viewer?.id;
    if (!userId) return res.status(500).json({ error: 'Failed to fetch user id' });

    // Store userId in session for gacha system
    req.session.userId = userId.toString();

    // 2) Fetch lists – request english + romaji + MAL id for Jikan lookup
    const listQuery = `
      query ($userId: Int) {
        MediaListCollection(userId: $userId, type: ANIME) {
          lists {
            name
            entries {
              score
              progress
              status
              media {
                id
                idMal
                title { english romaji }
                format
                episodes
                duration
                genres
                coverImage { extraLarge }
                nextAiringEpisode { airingAt episode }
                externalLinks { site url }
              }
            }
          }
        }
      }
    `;

    const listResp = await axios.post(
      'https://graphql.anilist.co',
      { query: listQuery, variables: { userId } },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const lists = listResp.data?.data?.MediaListCollection?.lists || [];
    const allEntries = lists.flatMap(l => l.entries || []);

    console.log(`📊 Processing ${allEntries.length} anime entries...`);

    // 3) Build base objects; fill title with best English (AniList → Jikan → Romaji)
    let formatted = allEntries.map(entry => {
      const m = entry.media || {};
      return {
        // temp fields for enrichment
        _english: m.title?.english?.trim() || null,
        _romaji: m.title?.romaji?.trim() || null,
        _idMal: m.idMal || null,

        // final fields consumed by frontend
        title: null, // populated below
        score: entry.score || 0,
        episodesWatched: entry.progress || 0,
        totalEpisodes: m.episodes ?? null,
        status: ({
          CURRENT: 'Current',
          COMPLETED: 'Completed',
          PLANNING: 'Planning',
          PAUSED: 'Paused',
          DROPPED: 'Dropped',
          REPEATING: 'Repeating'
        }[entry.status]) || entry.status || 'Unknown',
        genres: Array.isArray(m.genres) ? m.genres : [],
        duration: (typeof m.duration === 'number' && m.duration > 0)
          ? `${m.duration} min per ep` : null,
        type: m.format || null,
        coverImage: m.coverImage?.extraLarge || null,
        airingSchedule: m.nextAiringEpisode
          ? { airingAt: m.nextAiringEpisode.airingAt, episode: m.nextAiringEpisode.episode }
          : null,
        externalLinks: (m.externalLinks || []).map(l => ({ site: l.site, url: l.url }))
      };
    });

    // Count how many need Jikan lookup
    const needsJikan = formatted.filter(obj => !obj._english && obj._idMal).length;
    if (needsJikan > 0) {
      console.log(`🔍 Fetching English titles from Jikan for ${needsJikan} anime (this may take a moment)...`);
    }

    // Enrich missing/weak English titles with Jikan (rate-limited)
    const startTime = Date.now();
    await Promise.all(formatted.map(obj => limit(async () => {
      // If AniList English exists, prefer it
      if (obj._english) {
        obj.title = obj._english;
        return;
      }
      // Otherwise try Jikan English via MAL id
      const jikanTitle = await fetchEnglishFromJikan(obj._idMal);
      obj.title = jikanTitle || obj._romaji || 'Unknown Title';
    })));

    if (needsJikan > 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Jikan lookups completed in ${duration}s`);
    }

    // Strip temp fields
    formatted = formatted.map(({ _english, _romaji, _idMal, ...rest }) => rest);

    res.json(formatted);
  } catch (err) {
    console.error('get-anilist-data error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch anime list' });
  }
});

// =====================================================================
// Cache management endpoint (optional - for debugging)
// =====================================================================
app.get('/api/cache-stats', (req, res) => {
  res.json({
    jikanCacheSize: jikanCache.size,
    jikanQueueLength: jikanLimiter.queue.length,
    jikanRequestCount: jikanLimiter.requestCount,
    gachaUsers: gachaStates.size
  });
});

// =====================================================================
// Auth helpers
// =====================================================================
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// =====================================================================
// Serve SPA (static files + fallback to index.html)
// =====================================================================
app.use(express.static(path.join(__dirname, '')));
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