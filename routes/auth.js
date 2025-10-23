// routes/auth.js
// Final attempt: Simplest crypto PKCE generation

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/* ------------------------- Helpers / Shared ------------------------- */

// Regenerate PKCE using hex verifier and manual base64url challenge encoding
function generatePKCE() {
    // Verifier as hex string (simpler)
    const verifier = crypto.randomBytes(32).toString('hex');

    // Challenge using standard base64 digest then replacing chars
    const challenge = crypto.createHash('sha256')
        .update(verifier) // Hash the hex verifier directly
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, ''); // Remove padding

    return { verifier, challenge };
}


async function maybeRefreshToken(sess) {
  const auth = sess?.auth;
  if (!auth?.refreshToken || !auth?.obtainedAt || !auth?.expiresIn) return;

  const ageSec = (Date.now() - auth.obtainedAt) / 1000;
  // Refresh 2 minutes (120s) before expiry
  if (ageSec < Math.max(1, auth.expiresIn - 120)) return;

  console.log(`♻️  Refreshing ${auth.service} token...`);
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
    // Persist the refresh token (MAL provides a new one, AniList might not)
    sess.auth.refreshToken = data.refresh_token || sess.auth.refreshToken;
    sess.auth.obtainedAt   = Date.now();
    console.log(`✅ ${auth.service} token refreshed`);
  } catch (e) {
    console.warn(`Refresh failed for ${auth?.service}:`, e?.response?.data || e.message);
    // If refresh fails, the session is invalid. Log them out.
    delete sess.auth;
  }
}
// Export for use in other modules if needed (e.g., middleware)
router.maybeRefreshToken = maybeRefreshToken;

/* ------------------------------- AniList ------------------------------- */
// ... (AniList routes /anilist and /anilist/callback are unchanged) ...
router.get('/anilist', (req, res) => {
  const authUrl = 'https://anilist.co/api/v2/oauth/authorize';
  const redirectUri = `${BASE_URL}/auth/anilist/callback`;
  const params = new URLSearchParams({
    client_id: process.env.ANILIST_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
  });
  res.redirect(`${authUrl}?${params.toString()}`);
});

router.get('/anilist/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');

  try {
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

    // Create internal user ID if it doesn't exist
    if (!req.session.internalUserId) {
      req.session.internalUserId = crypto.randomUUID();
      console.log(`✨ Internal user ID created: ${req.session.internalUserId}`);
    }

    // Save auth details to session
    req.session.auth = {
      service: 'anilist',
      accessToken: tokenResp.data.access_token,
      tokenType: tokenResp.data.token_type,
      expiresIn: tokenResp.data.expires_in,
      refreshToken: tokenResp.data.refresh_token,
      obtainedAt: Date.now(),
    };

    // Clean up old session keys if they exist
    delete req.session.anilist;

    res.redirect('/'); // Redirect back to the main dashboard
  } catch (err) {
    console.error('AniList token exchange failed:', err?.response?.data || err.message);
    res.status(500).send('AniList OAuth failed');
  }
});

/* ------------------------------- MAL (PKCE + client_secret) ------------------------------- */

router.get('/mal', (req, res) => {
  // ⭐ USE SIMPLEST CRYPTO METHOD
  const { verifier, challenge } = generatePKCE();

  // Store the verifier in the session
  req.session.mal_code_verifier = verifier;

  const authUrl = 'https://myanimelist.net/v1/oauth2/authorize';
  const redirectUri = `${BASE_URL}/auth/mal/callback`;

  // Persist session before redirect
  req.session.save((err) => {
    if (err) {
      console.error('Session save error (MAL auth):', err);
      return res.status(500).send('Failed to save session before MAL auth redirect');
    }

    console.log(`[DEBUG/MAL] authorize redirect_uri=${redirectUri}`);
    console.log(`[DEBUG/MAL] code_verifier (simple crypto): ${verifier}`);
    console.log(`[DEBUG/MAL] code_challenge (simple crypto): ${challenge}`);

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

  // Retrieve the verifier from the session
  const verifier = req.session.mal_code_verifier;
  if (!verifier) {
    console.error('[MAL] Missing PKCE code_verifier in session');
    return res.status(400).send('Session expired or invalid. Please try signing in again.');
  }

  const redirectUri = `${BASE_URL}/auth/mal/callback`;
  console.log(`[DEBUG/MAL] token redirect_uri=${redirectUri}`);
  console.log(`[DEBUG/MAL] code_verifier from session: ${verifier}`);

  try {
    // Exchange authorization code for tokens
    const tokenResp = await axios.post(
      'https://myanimelist.net/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MAL_CLIENT_ID,
        client_secret: process.env.MAL_CLIENT_SECRET, // MAL requires secret even with PKCE
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier, // Send the verifier saved in the session
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Create internal user ID if it doesn't exist
    if (!req.session.internalUserId) {
      req.session.internalUserId = crypto.randomUUID();
      console.log(`✨ Internal user ID created: ${req.session.internalUserId}`);
    }

    // Save auth details to session
    req.session.auth = {
      service: 'mal',
      accessToken: tokenResp.data.access_token,
      tokenType: tokenResp.data.token_type,
      expiresIn: tokenResp.data.expires_in,
      refreshToken: tokenResp.data.refresh_token,
      obtainedAt: Date.now(),
    };

    // Clean up session artifacts
    delete req.session.mal_code_verifier;
    delete req.session.anilist; // Clean up old keys if they exist

    res.redirect('/'); // Redirect back to the main dashboard
  } catch (err) {
    // Log the detailed error from MAL
    console.error('MAL token exchange failed:', err?.response?.data || err.message);
    res.status(500).send('MAL OAuth failed');
  }
});

/* ------------------------------- Utilities ------------------------------- */
// Endpoint for frontend to check login status
router.get('/status', (req, res) => {
  if (req.session?.auth?.service) {
    res.json({ loggedIn: true, service: req.session.auth.service });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout endpoint
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
    }
    res.clearCookie('connect.sid'); // Ensure cookie is cleared
    res.redirect('/');
  });
});

module.exports = router;