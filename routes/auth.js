// routes/auth.js
// Fixed to integrate with Prisma User model

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

// Log all requests to this router for debugging
router.use((req, res, next) => {
  console.log(`🔐 [Auth Router] Request received: ${req.method} ${req.path}`);
  console.log(`🔐 [Auth Router] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  next();
});

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// In development, redirect to Vite dev server (port 3001) after OAuth
// Check if NODE_ENV is explicitly set to 'production', otherwise use dev server
const isProduction = process.env.NODE_ENV === 'production';
const getFrontendUrl = () => {
  if (isProduction) {
    return BASE_URL;
  }
  // Development mode - use Vite dev server
  return process.env.VITE_DEV_URL || 'http://localhost:3001';
};

const FRONTEND_URL = getFrontendUrl();
console.log(`🔗 Frontend URL configured: ${FRONTEND_URL} (NODE_ENV: ${process.env.NODE_ENV || 'development'}, isProduction: ${isProduction})`);

/* ------------------------- Helpers / Shared ------------------------- */

function generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('hex');
    const challenge = crypto.createHash('sha256')
        .update(verifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    return { verifier, challenge };
}

async function maybeRefreshToken(sess) {
  const auth = sess?.auth;
  if (!auth?.refreshToken || !auth?.obtainedAt || !auth?.expiresIn) return;

  const ageSec = (Date.now() - auth.obtainedAt) / 1000;
  if (ageSec < Math.max(1, auth.expiresIn - 120)) return;

  console.log(`♻️ Refreshing ${auth.service} token...`);
  try {
    let data;
    if (auth.service === 'anilist') {
      const resp = await axios.post(/* ... AniList refresh unchanged ... */);
      data = resp.data;
    } else if (auth.service === 'mal') {
      const resp = await axios.post(
        'https://myanimelist.net/v1/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.MAL_CLIENT_ID,
          client_secret: process.env.MAL_CLIENT_SECRET,
          refresh_token: auth.refreshToken,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      data = resp.data;
    } else {
      throw new Error(`Unknown service: ${auth.service}`);
    }

    sess.auth.accessToken  = data.access_token;
    sess.auth.tokenType    = data.token_type;
    sess.auth.expiresIn    = data.expires_in;
    sess.auth.refreshToken = data.refresh_token || sess.auth.refreshToken;
    sess.auth.obtainedAt   = Date.now();
    console.log(`✅ ${auth.service} token refreshed`);
  } catch (e) {
    console.warn(`Refresh failed for ${auth?.service}:`, e?.response?.data || e.message);
    delete sess.auth;
  }
}

router.maybeRefreshToken = maybeRefreshToken;

/* ------------------------------- AniList ------------------------------- */

router.get('/anilist', (req, res) => {
  console.log(`🔐 [AniList Login] ===== LOGIN ROUTE HIT =====`);
  console.log(`🔐 [AniList Login] BASE_URL: ${BASE_URL}`);
  const authUrl = 'https://anilist.co/api/v2/oauth/authorize';
  const redirectUri = `${BASE_URL}/auth/anilist/callback`;
  console.log(`🔐 [AniList Login] Redirect URI: ${redirectUri}`);
  const params = new URLSearchParams({
    client_id: process.env.ANILIST_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
  });
  const fullAuthUrl = `${authUrl}?${params.toString()}`;
  console.log(`🔐 [AniList Login] Redirecting to AniList: ${fullAuthUrl}`);
  res.redirect(fullAuthUrl);
});

router.get('/anilist/callback', async (req, res) => {
  // Log immediately when route is hit
  console.log(`🔐 [AniList Callback] ===== ROUTE HIT =====`);
  console.log(`🔐 [AniList Callback] Method: ${req.method}`);
  console.log(`🔐 [AniList Callback] Path: ${req.path}`);
  console.log(`🔐 [AniList Callback] Original URL: ${req.originalUrl}`);
  console.log(`🔐 [AniList Callback] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  console.log(`🔐 [AniList Callback] Query params:`, req.query);
  
  const { code } = req.query;
  console.log(`🔐 [AniList Callback] Code present: ${code ? 'yes' : 'no'}`);
  if (!code) {
    console.log(`🔐 [AniList Callback] ERROR: Missing authorization code`);
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Exchange code for token
    const tokenResp = await axios.post(
      'https://anilist.co/api/v2/oauth/token',
      {
        grant_type: 'authorization_code',
        client_id: process.env.ANILIST_CLIENT_ID,
        client_secret: process.env.ANILIST_CLIENT_SECRET,
        redirect_uri: `${BASE_URL}/auth/anilist/callback`,
        code,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { access_token, token_type, expires_in, refresh_token } = tokenResp.data;

    // 🆕 Get AniList user info to get their AniList ID
    const userInfoResp = await axios.post(
      'https://graphql.anilist.co',
      {
        query: `
          query {
            Viewer {
              id
              name
            }
          }
        `
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const anilistUserId = userInfoResp.data.data.Viewer.id;
    const anilistUsername = userInfoResp.data.data.Viewer.name;

    console.log(`🔐 AniList user authenticated: ${anilistUsername} (ID: ${anilistUserId})`);

    // 🆕 Create or update user in database
    const user = await prisma.user.upsert({
      where: { anilistId: anilistUserId },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
      },
      create: {
        anilistId: anilistUserId,
        accessToken: access_token,
        refreshToken: refresh_token,
      },
    });

    console.log(`✅ User saved to database with ID: ${user.id}`);

    // 🆕 Store the DATABASE user ID in session (not UUID!)
    req.session.internalUserId = user.id;
    req.session.anilistId = anilistUserId; // Optional: for convenience

    // Save auth details to session
    req.session.auth = {
      service: 'anilist',
      accessToken: access_token,
      tokenType: token_type,
      expiresIn: expires_in,
      refreshToken: refresh_token,
      obtainedAt: Date.now(),
    };

    delete req.session.anilist;

    // In development, redirect to Vite dev server; in production, use BASE_URL
    // Force check at runtime to ensure correct port
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction
      ? BASE_URL
      : (process.env.VITE_DEV_URL || 'http://localhost:3001');
    
    console.log(`🔐 [AniList] Redirecting to: ${frontendUrl}/ (NODE_ENV: ${process.env.NODE_ENV || 'development'}, BASE_URL: ${BASE_URL}, isProduction: ${isProduction})`);
    console.log(`🔐 [AniList] Setting Location header: ${frontendUrl}/`);
    console.log(`🔐 [AniList] Response status will be: 302`);
    
    // Use absolute URL and ensure it's a full URL
    const redirectUrl = frontendUrl + '/';
    console.log(`🔐 [AniList] Final redirect URL: ${redirectUrl}`);
    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('AniList authentication failed:', err?.response?.data || err.message);
    res.status(500).send('AniList OAuth failed');
  }
});

/* ------------------------------- MAL (PKCE + client_secret) ------------------------------- */

router.get('/mal', (req, res) => {
  const { verifier, challenge } = generatePKCE();
  req.session.mal_code_verifier = verifier;

  const authUrl = 'https://myanimelist.net/v1/oauth2/authorize';
  const redirectUri = `${BASE_URL}/auth/mal/callback`;

  req.session.save((err) => {
    if (err) {
      console.error('Session save error (MAL auth):', err);
      return res.status(500).send('Failed to save session before MAL auth redirect');
    }

    console.log(`[DEBUG/MAL] authorize redirect_uri=${redirectUri}`);
    console.log(`[DEBUG/MAL] code_verifier: ${verifier}`);
    console.log(`[DEBUG/MAL] code_challenge: ${challenge}`);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.MAL_CLIENT_ID,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    res.redirect(`${authUrl}?${params.toString()}`);
  });
});

router.get('/mal/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');

  const verifier = req.session.mal_code_verifier;
  if (!verifier) {
    console.error('[MAL] Missing PKCE code_verifier in session');
    return res.status(400).send('Session expired or invalid. Please try signing in again.');
  }

  const redirectUri = `${BASE_URL}/auth/mal/callback`;
  console.log(`[DEBUG/MAL] token redirect_uri=${redirectUri}`);
  console.log(`[DEBUG/MAL] code_verifier from session: ${verifier}`);

  try {
    const tokenResp = await axios.post(
      'https://myanimelist.net/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MAL_CLIENT_ID,
        client_secret: process.env.MAL_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // 🆕 TODO: Get MAL user ID and save to database
    // For now, MAL is not fully integrated with the database
    // You would need to call MAL API to get user info, then save like AniList

    if (!req.session.internalUserId) {
      req.session.internalUserId = crypto.randomUUID();
      console.log(`⚠️ MAL user - using temporary UUID: ${req.session.internalUserId}`);
    }

    req.session.auth = {
      service: 'mal',
      accessToken: tokenResp.data.access_token,
      tokenType: tokenResp.data.token_type,
      expiresIn: tokenResp.data.expires_in,
      refreshToken: tokenResp.data.refresh_token,
      obtainedAt: Date.now(),
    };

    delete req.session.mal_code_verifier;
    delete req.session.anilist;

    // In development, redirect to Vite dev server; in production, use BASE_URL
    // Force check at runtime to ensure correct port
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction
      ? BASE_URL
      : (process.env.VITE_DEV_URL || 'http://localhost:3001');
    
    console.log(`🔐 [MAL] Redirecting to: ${frontendUrl}/ (NODE_ENV: ${process.env.NODE_ENV || 'development'}, BASE_URL: ${BASE_URL}, isProduction: ${isProduction})`);
    res.redirect(302, frontendUrl + '/');
  } catch (err) {
    console.error('MAL token exchange failed:', err?.response?.data || err.message);
    res.status(500).send('MAL OAuth failed');
  }
});

/* ------------------------------- Utilities ------------------------------- */

router.get('/status', (req, res) => {
  if (req.session?.auth?.service) {
    res.json({ loggedIn: true, service: req.session.auth.service });
  } else {
    res.json({ loggedIn: false });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.clearCookie('connect.sid');
    // In development, redirect to Vite dev server; in production, use BASE_URL
    // Force check at runtime to ensure correct port
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction
      ? BASE_URL
      : (process.env.VITE_DEV_URL || 'http://localhost:3001');
    
    console.log(`🔐 [Logout] Redirecting to: ${frontendUrl}/ (NODE_ENV: ${process.env.NODE_ENV || 'development'}, isProduction: ${isProduction})`);
    res.redirect(302, frontendUrl + '/');
  });
});

// Cleanup on exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = router;