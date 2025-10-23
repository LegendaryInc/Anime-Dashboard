// routes/api.js
// Simplified for AniList Only

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Import utilities
const { fetchEnglishFromJikan, jikanLimiter } = require('../utils/jikan.js');
// Import maybeRefreshToken if needed by middleware (server.js handles it now)
// const { maybeRefreshToken } = require('./auth.js');

/* ------------------------- Helpers ------------------------- */
// Light-weight concurrency limiter
function pLimit(max) {
  // ... (pLimit function remains unchanged) ...
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
const limit = pLimit(10); // Adjust concurrency as needed

// Export limiter for potential use elsewhere (e.g., cache stats)
router.jikanLimiter = jikanLimiter;

/* ---------------- API: Get AniList Data ---------------- */
router.get('/get-anilist-data', async (req, res) => {
  try {
    // Middleware in server.js handles auth check and token refresh
    const accessToken = req.session.auth?.accessToken;
    if (!accessToken || req.session.auth?.service !== 'anilist') {
         // Added service check just to be safe
        return res.status(401).json({ error: 'Unauthorized or invalid session' });
    }


    // 1) Get Viewer (id)
    const viewerResp = await axios.post(
      'https://graphql.anilist.co',
      { query: `query { Viewer { id name } }` },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userId = viewerResp.data?.data?.Viewer?.id;
    if (!userId) return res.status(500).json({ error: 'Failed to fetch user id' });

    // 2) Fetch lists
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
                idMal # Keep idMal for Jikan lookups
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

    console.log(`📊 Processing ${allEntries.length} anime entries for AniList user...`);

    // 3) Build normalized objects
    let formatted = allEntries.map(entry => {
      const m = entry.media || {};
      return {
        id: m.id || null, // AniList Media ID
        malId: m.idMal || null, // Keep MAL ID
        _english: m.title?.english?.trim() || null,
        _romaji: m.title?.romaji?.trim() || null,
        title: null, // To be filled by enrichment
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

    // 4) Enrich titles with Jikan
    const needsJikan = formatted.filter(obj => !obj._english && obj.malId).length;
    if (needsJikan > 0) {
      console.log(`🔍 Fetching English titles from Jikan for ${needsJikan} anime...`);
    }
    const startTime = Date.now();
    await Promise.all(formatted.map(obj => limit(async () => {
      if (obj._english) {
        obj.title = obj._english;
        return;
      }
      const jikanTitle = await fetchEnglishFromJikan(obj.malId);
      obj.title = jikanTitle || obj._romaji || 'Unknown Title';
    })));
    if (needsJikan > 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Jikan lookups completed in ${duration}s`);
    }

    // 5) Strip temp fields
    formatted = formatted.map(obj => {
      const { _english, _romaji, ...rest } = obj;
      return rest;
    });

    res.json(formatted);
  } catch (err) {
    console.error('get-anilist-data error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch anime list' });
  }
});

/* ---------------- MAL Route (Removed) ---------------- */
// The /get-mal-data route has been removed.

/* ---------------- API: Update AniList Progress ---------------- */
// ... (This route remains unchanged) ...
router.post('/anilist/update-progress', async (req, res) => {
  const { mediaId, progress } = req.body;

  if (!mediaId || typeof progress !== 'number') {
    return res.status(400).json({ error: 'Invalid mediaId or progress' });
  }

  // Middleware ensures user is logged in and token is fresh
   const accessToken = req.session.auth?.accessToken;
   if (!accessToken || req.session.auth?.service !== 'anilist') {
        return res.status(401).json({ error: 'Unauthorized or invalid session for this action' });
   }

  const mutation = `
    mutation ($mediaId: Int, $progress: Int) {
      SaveMediaListEntry (mediaId: $mediaId, progress: $progress) {
        id
        mediaId
        progress
        status
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: mutation,
        variables: { mediaId, progress }
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    console.log(`✅ AniList User: Updated progress for media ${mediaId} to ${progress}`);
    res.json(response.data.data.SaveMediaListEntry);

  } catch (err) {
    console.error('AniList progress update failed:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to update progress on AniList' });
  }
});


/* ---------------- API: Add to Planning List ---------------- */
// ... (This route remains unchanged) ...
router.post('/anilist/add-planning', async (req, res) => {
  const { malId, title } = req.body;

  if (!malId) {
    return res.status(400).json({ error: 'Invalid malId' });
  }

  // Middleware ensures user is logged in and token is fresh
  const accessToken = req.session.auth?.accessToken;
  if (!accessToken || req.session.auth?.service !== 'anilist') {
      return res.status(401).json({ error: 'Unauthorized or invalid session for this action' });
  }

  // --- Step 1: Convert MAL ID to AniList ID ---
  const idQuery = `
    query ($idMal: Int) {
      Media (idMal: $idMal, type: ANIME) {
        id
        title { english romaji }
      }
    }
  `;

  const mutation = `
    mutation ($mediaId: Int, $status: MediaListStatus) {
      SaveMediaListEntry (mediaId: $mediaId, status: $status) {
        id
        mediaId
        status
        progress
        score
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
  `;

  try {
    // 1. Get AniList ID
    const idResponse = await axios.post(
      'https://graphql.anilist.co',
      { query: idQuery, variables: { idMal: parseInt(malId, 10) } },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const media = idResponse.data?.data?.Media;
    if (!media || !media.id) {
      throw new Error(`Could not find AniList ID for MAL ID ${malId}`);
    }

    const mediaId = media.id;
    const bestTitle = media.title.english || media.title.romaji || title;

    // 2. Send Mutation
    const mutationResponse = await axios.post(
      'https://graphql.anilist.co',
      {
        query: mutation,
        variables: { mediaId, status: 'PLANNING' }
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (mutationResponse.data.errors) {
      throw new Error(mutationResponse.data.errors[0].message);
    }

    const newListEntry = mutationResponse.data.data.SaveMediaListEntry;

    console.log(`✅ AniList User: Added ${bestTitle} to planning`);

    // 3. Format and return the new entry
    const m = newListEntry.media || {};
    const formattedEntry = {
      id: m.id,
      malId: m.idMal,
      title: m.title?.english?.trim() || m.title?.romaji?.trim() || 'Unknown Title',
      score: newListEntry.score || 0,
      episodesWatched: newListEntry.progress || 0,
      totalEpisodes: m.episodes ?? null,
      status: 'Planning',
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

    res.json(formattedEntry);

  } catch (err) {
    console.error('AniList add-planning failed:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to add to planning list' });
  }
});


module.exports = router;