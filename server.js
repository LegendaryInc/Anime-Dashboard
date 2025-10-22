// =====================================================================
// --- BACKEND SERVER (server.js) ---
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
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      PRIMARY KEY ("sid")
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
  `).catch(err => console.warn('Session table setup warning:', err.message));
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
// Helpers
// =====================================================================

// Light-weight concurrency limiter to avoid hammering Jikan.
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
const limit = pLimit(5);

// Fetch English title from Jikan using MAL id; returns null if not available.
async function fetchEnglishFromJikan(idMal) {
  if (!idMal) return null;
  try {
    const r = await axios.get(`https://api.jikan.moe/v4/anime/${idMal}`);
    return r?.data?.data?.title_english?.trim() || null;
  } catch {
    return null; // Swallow errors (rate limits/404s)
  }
}

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

    // Enrich missing/weak English titles with Jikan (limited concurrency)
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

    // Strip temp fields
    formatted = formatted.map(({ _english, _romaji, _idMal, ...rest }) => rest);

    res.json(formatted);
  } catch (err) {
    console.error('get-anilist-data error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch anime list' });
  }
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
});