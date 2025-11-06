// routes/api.js
// Simplified for AniList Only

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Import utilities
const { fetchEnglishFromJikan, jikanLimiter } = require('../utils/jikan.js');

/* ------------------------- Helpers ------------------------- */
// Light-weight concurrency limiter
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
const limit = pLimit(10);

// Export limiter for potential use elsewhere
router.jikanLimiter = jikanLimiter;

/* ---------------- API: Get AniList Data ---------------- */
router.get('/get-anilist-data', async (req, res) => {
  try {
    const accessToken = req.session.auth?.accessToken;
    if (!accessToken || req.session.auth?.service !== 'anilist') {
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
              startedAt {
                year
                month
                day
              }
              completedAt {
                year
                month
                day
              }
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
                studios(isMain: true) {
                  nodes {
                    name
                  }
                }
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
        id: m.id || null,
        malId: m.idMal || null,
        _english: m.title?.english?.trim() || null,
        _romaji: m.title?.romaji?.trim() || null,
        title: null,
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
        startedAt: entry.startedAt ? {
          year: entry.startedAt.year,
          month: entry.startedAt.month,
          day: entry.startedAt.day
        } : null,
        completedAt: entry.completedAt ? {
          year: entry.completedAt.year,
          month: entry.completedAt.month,
          day: entry.completedAt.day
        } : null,
        genres: Array.isArray(m.genres) ? m.genres : [],
        duration: (typeof m.duration === 'number' && m.duration > 0)
          ? `${m.duration} min per ep` : null,
        // ✅ FIX: Store format for charts
        format: m.format || null,
        type: m.format || null, // Keep for backwards compatibility
        // ✅ FIX: Store studios as array for charts
        studios: m.studios?.nodes?.map(s => s.name) || [],
        studio: m.studios?.nodes?.[0]?.name || null, // Keep first studio for display
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

/* ---------------- API: Update AniList Progress ---------------- */
router.post('/anilist/update-progress', async (req, res) => {
  const { mediaId, progress } = req.body;

  if (!mediaId || typeof progress !== 'number') {
    return res.status(400).json({ error: 'Invalid mediaId or progress' });
  }

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

/* ---------------- API: Update AniList Score ---------------- */
router.post('/anilist/update-score', async (req, res) => {
  console.log('🔔 [update-score] Route handler called!', req.method, req.path);
  console.log('🔔 [update-score] Request body:', JSON.stringify(req.body));
  console.log('🔔 [update-score] mediaId:', req.body?.mediaId);
  console.log('🔔 [update-score] score:', req.body?.score);
  console.log('🔔 [update-score] notes:', req.body?.notes);
  console.log('🔔 [update-score] score type:', typeof req.body?.score);
  console.log('🔔 [update-score] notes type:', typeof req.body?.notes);
  console.log('🔔 [update-score] score === undefined:', req.body?.score === undefined);
  console.log('🔔 [update-score] notes === undefined:', req.body?.notes === undefined);
  
  const { mediaId, score, notes } = req.body; // Also accept notes

  if (!req.session?.auth?.service || req.session.auth.service !== 'anilist') {
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }

  // Allow notes-only updates (no score required)
  if (!mediaId) {
    console.log('🔔 [update-score] ERROR: Missing mediaId');
    return res.status(400).json({ error: 'Missing mediaId' });
  }
  
  if (score === undefined && notes === undefined) {
    console.log('🔔 [update-score] ERROR: Both score and notes are undefined');
    return res.status(400).json({ error: 'Must provide at least one of score or notes' });
  }
  
  console.log('🔔 [update-score] Validation passed!');

  // Validate score if provided
  let numScore = null;
  if (score !== undefined && score !== null) {
    numScore = Number(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      return res.status(400).json({ error: 'Score must be between 0 and 10' });
    }
  }

  const accessToken = req.session.auth?.accessToken;
  if (!accessToken) {
    return res.status(401).json({ error: 'No valid access token' });
  }

  // Build mutation - AniList allows optional parameters
  const mutation = `
    mutation ($mediaId: Int, $score: Float, $notes: String) {
      SaveMediaListEntry(mediaId: $mediaId, score: $score, notes: $notes) {
        id
        mediaId
        score
        status
        progress
        notes
      }
    }
  `;

  try {
    const variables = {
      mediaId: parseInt(mediaId)
    };
    // Only include score if provided (AniList will keep existing if null)
    if (numScore !== null) {
      variables.score = numScore;
    } else {
      variables.score = null; // Keep existing score
    }
    // Only include notes if provided
    if (notes !== undefined) {
      variables.notes = notes || '';
    } else {
      variables.notes = null; // Keep existing notes
    }
    
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: mutation,
        variables
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.data.errors) {
      console.error('AniList GraphQL errors:', response.data.errors);
      return res.status(400).json({ 
        error: response.data.errors[0]?.message || 'GraphQL error updating score' 
      });
    }

    console.log(`✅ AniList User: Updated score for media ${mediaId} to ${numScore}`);
    res.json({
      success: true,
      entry: response.data.data.SaveMediaListEntry
    });

  } catch (err) {
    console.error('Score update error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Internal server error updating score' });
  }
});

/* ---------------- API: Update AniList Status ---------------- */
router.post('/anilist/update-status', async (req, res) => {
  const { mediaId, status } = req.body;

  if (!req.session?.auth?.service || req.session.auth.service !== 'anilist') {
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }

  if (!mediaId || !status) {
    return res.status(400).json({ error: 'Missing mediaId or status' });
  }

  // Map frontend status to AniList status
  const statusMap = {
    'Current': 'CURRENT',
    'Watching': 'CURRENT',
    'Completed': 'COMPLETED',
    'Planning': 'PLANNING',
    'Plan to Watch': 'PLANNING',
    'Paused': 'PAUSED',
    'Dropped': 'DROPPED',
    'Rewatching': 'REPEATING',
    'Repeating': 'REPEATING'
  };

  const anilistStatus = statusMap[status] || status.toUpperCase();

  const accessToken = req.session.auth?.accessToken;
  if (!accessToken) {
    return res.status(401).json({ error: 'No valid access token' });
  }

  const mutation = `
    mutation ($mediaId: Int, $status: MediaListStatus) {
      SaveMediaListEntry(mediaId: $mediaId, status: $status) {
        id
        mediaId
        status
        progress
        score
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: mutation,
        variables: { mediaId: parseInt(mediaId), status: anilistStatus }
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.data.errors) {
      console.error('AniList GraphQL errors:', response.data.errors);
      return res.status(400).json({ 
        error: response.data.errors[0]?.message || 'GraphQL error updating status' 
      });
    }

    console.log(`✅ AniList User: Updated status for media ${mediaId} to ${anilistStatus}`);
    
    // Map back to frontend status
    const newStatus = ({
      'CURRENT': 'Current',
      'COMPLETED': 'Completed',
      'PLANNING': 'Planning',
      'PAUSED': 'Paused',
      'DROPPED': 'Dropped',
      'REPEATING': 'Repeating'
    })[response.data.data.SaveMediaListEntry.status] || response.data.data.SaveMediaListEntry.status;

    res.json({
      success: true,
      entry: {
        ...response.data.data.SaveMediaListEntry,
        status: newStatus
      }
    });

  } catch (err) {
    console.error('Status update error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Internal server error updating status' });
  }
});

/* ---------------- API: Update AniList Notes ---------------- */
router.post('/anilist/update-notes', async (req, res) => {
  // EXTENSIVE LOGGING - matching the working update-score pattern exactly
  console.log('🔔 [update-notes] Route handler called!', req.method, req.path);
  console.error('🔔 [update-notes] Route handler called!', req.method, req.path);
  console.log('🔔 [update-notes] Request body:', req.body);
  console.log('🔔 [update-notes] Session:', req.session ? 'exists' : 'missing');
  console.log('🔔 [update-notes] Auth service:', req.session?.auth?.service);
  
  const { mediaId, notes } = req.body;

  if (!req.session?.auth?.service || req.session.auth.service !== 'anilist') {
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }

  if (!mediaId) {
    return res.status(400).json({ error: 'Missing mediaId' });
  }

  const accessToken = req.session.auth?.accessToken;
  if (!accessToken) {
    return res.status(401).json({ error: 'No valid access token' });
  }

  const mutation = `
    mutation ($mediaId: Int, $notes: String) {
      SaveMediaListEntry(mediaId: $mediaId, notes: $notes) {
        id
        mediaId
        status
        progress
        notes
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: mutation,
        variables: {
          mediaId: parseInt(mediaId),
          notes: notes || ''
        }
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.data.errors) {
      console.error('AniList GraphQL errors:', response.data.errors);
      return res.status(400).json({ 
        error: response.data.errors[0]?.message || 'GraphQL error updating notes' 
      });
    }

    const entry = response.data.data.SaveMediaListEntry;
    console.log(`✅ AniList User: Updated notes for media ${mediaId}`);

    res.json({
      success: true,
      entry: entry
    });

  } catch (err) {
    console.error('Notes update error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Internal server error updating notes' });
  }
});

/* ---------------- API: Update AniList Watch Dates ---------------- */
router.post('/anilist/update-dates', async (req, res) => {
  console.error('🚨 [ROUTER] update-dates handler called!', req.method, req.path);
  console.log('🔔 [ROUTER] update-dates handler called!', req.method, req.path);
  const { mediaId, startedAt, completedAt } = req.body;

  if (!req.session?.auth?.service || req.session.auth.service !== 'anilist') {
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }

  if (!mediaId) {
    return res.status(400).json({ error: 'Missing mediaId' });
  }

  const accessToken = req.session.auth?.accessToken;
  if (!accessToken) {
    return res.status(401).json({ error: 'No valid access token' });
  }

  // Convert date objects to AniList FuzzyDateInt format (YYYYMMDD)
  const formatDate = (date) => {
    if (!date || !date.year) return null;
    const year = date.year || 0;
    const month = date.month || 0;
    const day = date.day || 0;
    return year * 10000 + month * 100 + day;
  };

  const startedAtInt = startedAt ? formatDate(startedAt) : null;
  const completedAtInt = completedAt ? formatDate(completedAt) : null;

  const mutation = `
    mutation ($mediaId: Int, $startedAt: FuzzyDateInt, $completedAt: FuzzyDateInt) {
      SaveMediaListEntry(mediaId: $mediaId, startedAt: $startedAt, completedAt: $completedAt) {
        id
        mediaId
        status
        progress
        startedAt {
          year
          month
          day
        }
        completedAt {
          year
          month
          day
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: mutation,
        variables: {
          mediaId: parseInt(mediaId),
          startedAt: startedAtInt,
          completedAt: completedAtInt
        }
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.data.errors) {
      console.error('AniList GraphQL errors:', response.data.errors);
      return res.status(400).json({ 
        error: response.data.errors[0]?.message || 'GraphQL error updating dates' 
      });
    }

    const entry = response.data.data.SaveMediaListEntry;
    console.log(`✅ AniList User: Updated dates for media ${mediaId}`);

    // Format dates for response
    const formattedEntry = {
      ...entry,
      startedAt: entry.startedAt ? {
        year: entry.startedAt.year,
        month: entry.startedAt.month,
        day: entry.startedAt.day
      } : null,
      completedAt: entry.completedAt ? {
        year: entry.completedAt.year,
        month: entry.completedAt.month,
        day: entry.completedAt.day
      } : null
    };

    res.json({
      success: true,
      entry: formattedEntry
    });

  } catch (err) {
    console.error('Date update error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Internal server error updating dates' });
  }
});

/* ---------------- API: Add to Planning List ---------------- */
router.post('/anilist/add-planning', async (req, res) => {
  const { malId, title } = req.body;

  if (!malId) {
    return res.status(400).json({ error: 'Invalid malId' });
  }

  const accessToken = req.session.auth?.accessToken;
  if (!accessToken || req.session.auth?.service !== 'anilist') {
      return res.status(401).json({ error: 'Unauthorized or invalid session for this action' });
  }

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
          studios(isMain: true) {
            nodes {
              name
            }
          }
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
      // ✅ FIX: Store format for charts
      format: m.format || null,
      type: m.format || null, // Keep for backwards compatibility
      // ✅ FIX: Store studios as array for charts
      studios: m.studios?.nodes?.map(s => s.name) || [],
      studio: m.studios?.nodes?.[0]?.name || null, // Keep first studio for display
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

// Catch-all for debugging - log any unmatched routes
router.use((req, res, next) => {
  console.error('🔍 [API Router] Unmatched route:', req.method, req.path);
  console.log('🔍 [API Router] Unmatched route:', req.method, req.path);
  console.error('🔍 [API Router] Original URL:', req.originalUrl);
  console.error('🔍 [API Router] Base URL:', req.baseUrl);
  console.error('🔍 [API Router] Router stack:', router.stack.map(r => r.route ? `${Object.keys(r.route.methods).join(', ').toUpperCase()} ${r.route.path}` : r.name || 'middleware'));
  console.error('🔍 [API Router] Checking if route matches...');
  // Check each route manually
  router.stack.forEach((r, i) => {
    if (r.route) {
      const methods = Object.keys(r.route.methods);
      const path = r.route.path;
      console.error(`   [${i}] ${methods.join(', ').toUpperCase()} ${path} - matches? ${methods.includes(req.method.toLowerCase()) && path === req.path}`);
    }
  });
  res.status(404).json({ error: 'Route not found in API router', path: req.path, method: req.method });
});

module.exports = router;