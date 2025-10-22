// =====================================================================
// --- BACKEND SERVER (server.js) --- V2 with Database & Sessions ---
// =====================================================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const session = require('express-session'); // <-- Import express-session
const { PrismaClient } = require('@prisma/client'); // <-- Import Prisma Client

const prisma = new PrismaClient(); // <-- Initialize Prisma Client
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// IMPORTANT: Use a real secret in production! Put it in your .env file
const SESSION_SECRET = process.env.SESSION_SECRET || 'a-bad-secret-for-dev';

// --- Session Middleware Setup ---
const pgSession = require('connect-pg-simple')(session); // <-- Import connect-pg-simple
const { Pool } = require('pg'); // <-- Import pg Pool

// Create a Pool using the DATABASE_URL from .env
// Ensure DATABASE_URL is set correctly in your environment
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // <-- Add SSL for Render connections
});

app.use(session({
    store: new pgSession({ // <-- Use pgSession store
        pool: pgPool,                // Connection pool
        tableName: 'user_sessions'   // Table name for sessions (will be created automatically)
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax' // Recommended for security
    }
}));

// --- 3. OAUTH & API ROUTES ---

// PART A: Redirects the user to AniList
app.get('/auth/anilist', (req, res) => {
    const anilistAuthUrl = 'https://anilist.co/api/v2/oauth/authorize';
    const redirectUri = `${BASE_URL}/auth/anilist/callback`;
    const params = new URLSearchParams({
        client_id: process.env.ANILIST_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
    });
    res.redirect(`${anilistAuthUrl}?${params.toString()}`);
});

// PART B: Handles the callback from AniList (UPDATED FOR DB & SESSION)
app.get('/auth/anilist/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('Error: Authorization code is missing.');
    }
    const redirectUri = `${BASE_URL}/auth/anilist/callback`;

    try {
        // --- 1. Exchange code for tokens ---
        const tokenResponse = await axios.post('https://anilist.co/api/v2/oauth/token', {
            grant_type: 'authorization_code',
            client_id: process.env.ANILIST_CLIENT_ID,
            client_secret: process.env.ANILIST_CLIENT_SECRET,
            redirect_uri: redirectUri,
            code: code,
        });
        const accessToken = tokenResponse.data.access_token;
        // const refreshToken = tokenResponse.data.refresh_token; // Store this if you plan to refresh tokens

        // --- 2. Get AniList User ID ---
        const viewerResponse = await axios.post('https://graphql.anilist.co', {
            query: `query { Viewer { id name } }` // Get name too, just for potential future use
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });
        const anilistId = viewerResponse.data.data.Viewer.id;
        if (!anilistId) {
            throw new Error("Could not retrieve AniList viewer ID.");
        }

        // --- 3. Find or Create User in DB (Upsert) ---
        const user = await prisma.user.upsert({
            where: { anilistId: anilistId }, // Find user by their unique AniList ID
            update: { accessToken: accessToken }, // If found, update their token
            create: { anilistId: anilistId, accessToken: accessToken }, // If not found, create a new user record
        });

        // --- 4. Store User ID in Session ---
        req.session.userId = user.id; // Store *our* database user ID in the session

        res.redirect('/'); // Redirect back to the main dashboard page

    } catch (error) {
        console.error('Error during AniList callback:', error.response ? error.response.data : error.message);
        res.status(500).send('An error occurred during authentication.');
    }
});

// PART C: Securely fetches data (UPDATED TO USE SESSION & DB TOKEN)
app.get('/api/get-anilist-data', async (req, res) => {
    // --- 1. Check if user is logged in (via session) ---
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }

    try {
        // --- 2. Get user's data (including token) from DB ---
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId },
        });

        if (!user || !user.accessToken) {
             console.error(`User ${req.session.userId} not found in DB or missing token.`);
             req.session.destroy(); // Clear potentially invalid session
             return res.status(401).json({ error: 'Authentication error. Please log in again.' });
        }
        const userAccessToken = user.accessToken; // Use the token specific to this user
        const userAnilistId = user.anilistId; // We already have this from the user record

        // --- 3. Fetch data from AniList using the user's token ---
        const listQuery = `
          query ($userId: Int) {
            MediaListCollection(userId: $userId, type: ANIME, status_in: [CURRENT, COMPLETED], sort: SCORE_DESC) {
              lists {
                entries {
                  progress score(format: POINT_10_DECIMAL) status
                  media {
                    title { romaji } episodes duration genres format
                    coverImage { extraLarge }
                    airingSchedule(notYetAired: true, perPage: 1) { nodes { airingAt episode } }
                    externalLinks { site url }
                  }
                }
              }
            }
          }
        `;

        const listResponse = await axios.post('https://graphql.anilist.co', {
            query: listQuery,
            variables: { userId: userAnilistId } // Use the AniList ID from the user record
        }, {
            headers: {
                'Authorization': `Bearer ${userAccessToken}`, // Use the specific user's token
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        });

        const anilistLists = listResponse.data?.data?.MediaListCollection?.lists;
        if (!anilistLists) {
           throw new Error("Invalid response structure from AniList GraphQL.");
        }
        const allEntries = anilistLists.flatMap(list => list.entries);

        const formattedData = allEntries.map(entry => ({
            title: entry.media.title.romaji,
            score: entry.score,
            episodesWatched: entry.progress,
            totalEpisodes: entry.media.episodes,
            type: entry.media.format,
            status: entry.status.charAt(0) + entry.status.slice(1).toLowerCase(),
            genres: entry.media.genres,
            duration: entry.media.duration ? `${entry.media.duration} min per ep` : null,
            coverImage: entry.media.coverImage ? entry.media.coverImage.extraLarge : null,
            airingSchedule: entry.media.airingSchedule.nodes.length > 0 ? entry.media.airingSchedule.nodes[0] : null,
            externalLinks: entry.media.externalLinks
        }));

        res.json(formattedData);

    } catch (error) {
        console.error('Error fetching data from AniList:', error.response ? error.response.data : error.message);
        // Handle potential token expiration or invalidation
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
             console.log(`Token likely invalid for user ${req.session.userId}. Logging out.`);
             req.session.destroy(); // Clear the session on token error
             return res.status(401).json({ error: 'Authentication failed with AniList. Please log in again.' });
        }
        res.status(500).json({ error: 'Failed to fetch data from AniList.' });
    }
});

// PART D: Logout route (UPDATED TO USE SESSION)
app.get('/logout', (req, res) => {
    req.session.destroy(err => { // Destroy the session
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Could not log out.");
        }
        res.clearCookie('connect.sid'); // Optional: Clear the session cookie
        res.status(200).send('Logged out successfully.');
    });
});

// --- 4. SERVE FRONTEND ---
// Serve static files (HTML, CSS, JS) from the root directory FIRST
app.use(express.static(path.join(__dirname, '')));

// Handle SPA routing: For any GET request not handled by static files or API routes, send index.html
// This MUST come AFTER your API routes (/api/*, /auth/*) and AFTER app.use(express.static(...))
// FIX: Use regex catch-all to avoid path-to-regexp error
app.get(/^(?!\/(api|auth)).*$/, (req, res) => {
  // This regex matches any path that DOES NOT start with /api or /auth
  res.sendFile(path.join(__dirname, 'index.html'));
});


// --- 5. START SERVER ---
app.listen(PORT, '0.0.0.0', () => { // Bind to 0.0.0.0 for Render/Docker
  console.log(`✅ Server is running on port ${PORT}`);
});