// =====================================================================
// --- BACKEND SERVER (server.js) ---
// =====================================================================
// This file handles secure authentication with the AniList API
// and serves the frontend application.
// =====================================================================

// --- 1. SETUP & IMPORTS ---
require('dotenv').config(); // Loads environment variables from a .env file
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
// FIX: Use Render's assigned port or 3000 for local dev
const PORT = process.env.PORT || 3000;
// FIX: Use an environment variable for the base URL
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// --- 2. IN-MEMORY TOKEN STORAGE (SIMPLIFIED FOR EXAMPLE) ---
// IMPORTANT: In a real-world, production application, you must securely store the
// access token in a database, associating it with a specific user.
let accessToken = null;

// --- 3. OAUTH & API ROUTES ---

// PART A: Redirects the user to AniList to grant permission
app.get('/auth/anilist', (req, res) => {
  const anilistAuthUrl = 'https://anilist.co/api/v2/oauth/authorize';
  // FIX: Construct redirect_uri using BASE_URL
  const redirectUri = `${BASE_URL}/auth/anilist/callback`;
  const params = new URLSearchParams({
    client_id: process.env.ANILIST_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
  });

  res.redirect(`${anilistAuthUrl}?${params.toString()}`);
});

// PART B: Handles the callback from AniList after user approval
app.get('/auth/anilist/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Error: Authorization code is missing. Please try again.');
  }

  // FIX: Construct redirect_uri using BASE_URL
  const redirectUri = `${BASE_URL}/auth/anilist/callback`;

  try {
    const response = await axios.post('https://anilist.co/api/v2/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.ANILIST_CLIENT_ID,
      client_secret: process.env.ANILIST_CLIENT_SECRET,
      redirect_uri: redirectUri, // Use the constructed URI
      code: code,
    });

    accessToken = response.data.access_token;
    res.redirect('/');

  } catch (error) {
    console.error('Error fetching access token:', error.response ? error.response.data : error.message);
    res.status(500).send('An error occurred while trying to authenticate with AniList.');
  }
});

// PART C: Securely fetches data for the frontend (UPDATED for Airing Info & Thumbnails)
app.get('/api/get-anilist-data', async (req, res) => {
    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }

    try {
      const viewerIdResponse = await axios.post('https://graphql.anilist.co', {
        query: `query { Viewer { id } }`
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
      const userId = viewerIdResponse.data.data.Viewer.id;

      if (!userId) {
        throw new Error("Could not retrieve viewer ID.");
      }

      const listQuery = `
        query ($userId: Int) {
          MediaListCollection(userId: $userId, type: ANIME, status_in: [CURRENT, COMPLETED], sort: SCORE_DESC) {
            lists {
              entries {
                progress
                score(format: POINT_10_DECIMAL)
                status
                media {
                  title { romaji }
                  episodes
                  duration
                  genres
                  format
                  coverImage { extraLarge }
                  airingSchedule(notYetAired: true, perPage: 1) {
                    nodes {
                      airingAt
                      episode
                    }
                  }
                  externalLinks {
                    site
                    url
                  }
                }
              }
            }
          }
        }
      `;

      const listResponse = await axios.post('https://graphql.anilist.co', {
        query: listQuery,
        variables: {
          userId: userId
        }
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      const anilistLists = listResponse.data.data.MediaListCollection.lists;
      const allEntries = anilistLists.flatMap(list => list.entries);

      // **FIXED**: Make data mapping null-safe for coverImage
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
      res.status(500).json({ error: 'Failed to fetch data from AniList.' });
    }
});

// PART D: Logout route to clear the server-side token
app.get('/logout', (req, res) => {
    accessToken = null;
    res.status(200).send('Logged out successfully.');
});


// --- 4. SERVE FRONTEND ---
app.use(express.static(path.join(__dirname, '')));


// --- 5. START SERVER ---
// FIX: Update log message
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});