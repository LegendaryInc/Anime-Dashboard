// routes/api.js
// Simplified for AniList Only

const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

// Import utilities
const { fetchEnglishFromJikan, jikanLimiter } = require('../utils/jikan.js');

const prisma = new PrismaClient();

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

/* ---------------- API: Update AniList Score (with Notes Support) ---------------- */
router.post('/anilist/update-score', async (req, res) => {
  const { mediaId, score, notes } = req.body;
  
  if (!req.session?.auth?.service || req.session.auth.service !== 'anilist') {
    return res.status(401).json({ error: 'Not authenticated with AniList' });
  }
  
  // Validate mediaId (REQUIRED)
  if (!mediaId || isNaN(parseInt(mediaId))) {
    return res.status(400).json({ error: 'Missing or invalid mediaId' });
  }
  
  // Validate that AT LEAST ONE of score or notes is provided
  if (score === undefined && notes === undefined) {
    return res.status(400).json({ error: 'Must provide at least one of score or notes' });
  }
  
  // Validate score if provided (optional)
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
    mutation ($mediaId: Int!, $score: Float, $notes: String) {
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
    // Build variables object - only include fields that are being updated
    const variables = {
      mediaId: parseInt(mediaId)
    };
    
    // Include score if provided (null means keep existing in AniList)
    if (score !== undefined) {
      variables.score = numScore !== null ? numScore : null;
    }
    
    // Include notes if provided
    if (notes !== undefined) {
      variables.notes = notes || ''; // Empty string to clear notes
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
        error: response.data.errors[0]?.message || 'GraphQL error updating entry' 
      });
    }
    
    res.json({
      success: true,
      entry: response.data.data.SaveMediaListEntry
    });
    
  } catch (err) {
    console.error('Error updating AniList entry:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Internal server error updating entry' });
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

/* =============== Custom Lists API =============== */

// Get all custom lists for the authenticated user
router.get('/lists', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const lists = await prisma.customList.findMany({
      where: { userId },
      include: {
        entries: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            animeId: true,
            order: true,
            addedAt: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(lists);
  } catch (error) {
    console.error('Error fetching custom lists:', error);
    res.status(500).json({ error: 'Failed to fetch custom lists' });
  }
});

// Get a single custom list by ID
router.get('/lists/:id', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listId = parseInt(req.params.id);
    const list = await prisma.customList.findFirst({
      where: {
        id: listId,
        OR: [
          { userId }, // User's own list
          { isPublic: true } // Public list
        ]
      },
      include: {
        entries: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            animeId: true,
            order: true,
            addedAt: true
          }
        }
      }
    });

    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }

    res.json(list);
  } catch (error) {
    console.error('Error fetching custom list:', error);
    res.status(500).json({ error: 'Failed to fetch custom list' });
  }
});

// Create a new custom list
router.post('/lists', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, description, isPublic } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'List name is required' });
    }

    const list = await prisma.customList.create({
      data: {
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        isPublic: isPublic === true
      },
      include: {
        entries: true
      }
    });

    res.status(201).json(list);
  } catch (error) {
    console.error('Error creating custom list:', error);
    res.status(500).json({ error: 'Failed to create custom list' });
  }
});

// Update a custom list
router.put('/lists/:id', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listId = parseInt(req.params.id);
    const { name, description, isPublic } = req.body;

    // Verify ownership
    const existingList = await prisma.customList.findFirst({
      where: { id: listId, userId }
    });

    if (!existingList) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return res.status(400).json({ error: 'List name cannot be empty' });
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (isPublic !== undefined) {
      updateData.isPublic = isPublic === true;
    }

    const list = await prisma.customList.update({
      where: { id: listId },
      data: updateData,
      include: {
        entries: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json(list);
  } catch (error) {
    console.error('Error updating custom list:', error);
    res.status(500).json({ error: 'Failed to update custom list' });
  }
});

// Delete a custom list
router.delete('/lists/:id', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listId = parseInt(req.params.id);

    // Verify ownership
    const existingList = await prisma.customList.findFirst({
      where: { id: listId, userId }
    });

    if (!existingList) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    // Cascade delete will handle entries
    await prisma.customList.delete({
      where: { id: listId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom list:', error);
    res.status(500).json({ error: 'Failed to delete custom list' });
  }
});

// Add anime to a custom list
router.post('/lists/:id/anime', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listId = parseInt(req.params.id);
    const { animeId } = req.body;

    if (!animeId || isNaN(animeId)) {
      return res.status(400).json({ error: 'Valid animeId is required' });
    }

    // Verify ownership
    const list = await prisma.customList.findFirst({
      where: { id: listId, userId }
    });

    if (!list) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    // Get current max order
    const maxOrder = await prisma.customListEntry.findFirst({
      where: { listId },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    const newOrder = (maxOrder?.order ?? -1) + 1;

    // Try to create entry (will fail if duplicate due to unique constraint)
    try {
      const entry = await prisma.customListEntry.create({
        data: {
          listId,
          animeId: parseInt(animeId),
          order: newOrder
        }
      });

      res.status(201).json(entry);
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint violation - anime already in list
        return res.status(409).json({ error: 'Anime already in list' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error adding anime to list:', error);
    res.status(500).json({ error: 'Failed to add anime to list' });
  }
});

// Remove anime from a custom list
router.delete('/lists/:id/anime/:animeId', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listId = parseInt(req.params.id);
    const animeId = parseInt(req.params.animeId);

    // Verify ownership
    const list = await prisma.customList.findFirst({
      where: { id: listId, userId }
    });

    if (!list) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    // Delete entry
    await prisma.customListEntry.deleteMany({
      where: {
        listId,
        animeId
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing anime from list:', error);
    res.status(500).json({ error: 'Failed to remove anime from list' });
  }
});

// Reorder entries in a custom list
router.put('/lists/:id/reorder', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listId = parseInt(req.params.id);
    const { entries } = req.body; // Array of { id, order } or { animeId, order }

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    // Verify ownership
    const list = await prisma.customList.findFirst({
      where: { id: listId, userId }
    });

    if (!list) {
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    // Update all entries in a transaction
    await prisma.$transaction(
      entries.map((entry, index) =>
        prisma.customListEntry.updateMany({
          where: {
            listId,
            ...(entry.id ? { id: entry.id } : { animeId: entry.animeId })
          },
          data: { order: entry.order ?? index }
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering list entries:', error);
    res.status(500).json({ error: 'Failed to reorder list entries' });
  }
});

/* =============== Watch Queue API =============== */

// Get all queue entries for the authenticated user
router.get('/queue', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const queue = await prisma.watchQueueEntry.findMany({
      where: { userId },
      orderBy: { order: 'asc' }
    });

    res.json(queue);
  } catch (error) {
    console.error('Error fetching watch queue:', error);
    res.status(500).json({ error: 'Failed to fetch watch queue' });
  }
});

// Add anime to queue
router.post('/queue', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { animeId } = req.body;

    if (!animeId || isNaN(animeId)) {
      return res.status(400).json({ error: 'Valid animeId is required' });
    }

    // Check if already in queue
    const existing = await prisma.watchQueueEntry.findUnique({
      where: {
        userId_animeId: {
          userId,
          animeId: parseInt(animeId)
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Anime already in queue' });
    }

    // Get max order value
    const maxOrder = await prisma.watchQueueEntry.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
      select: { order: true }
    });

    const newOrder = (maxOrder?.order ?? -1) + 1;

    const entry = await prisma.watchQueueEntry.create({
      data: {
        userId,
        animeId: parseInt(animeId),
        order: newOrder
      }
    });

    res.json(entry);
  } catch (error) {
    console.error('Error adding to queue:', error);
    res.status(500).json({ error: 'Failed to add to queue' });
  }
});

// Remove anime from queue
router.delete('/queue/:animeId', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const animeId = parseInt(req.params.animeId);

    await prisma.watchQueueEntry.deleteMany({
      where: {
        userId,
        animeId
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from queue:', error);
    res.status(500).json({ error: 'Failed to remove from queue' });
  }
});

// Reorder queue entries
router.put('/queue/reorder', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { entries } = req.body; // Array of { animeId, order }

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    // Update all entries in a transaction
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.watchQueueEntry.updateMany({
          where: {
            userId,
            animeId: entry.animeId
          },
          data: { order: entry.order }
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering queue:', error);
    res.status(500).json({ error: 'Failed to reorder queue' });
  }
});

// Clear entire queue
router.delete('/queue', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await prisma.watchQueueEntry.deleteMany({
      where: { userId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing queue:', error);
    res.status(500).json({ error: 'Failed to clear queue' });
  }
});

/* =============== Personal Goals API =============== */

// Get all goals for the authenticated user
router.get('/goals', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const goals = await prisma.personalGoal.findMany({
      where: { userId },
      orderBy: [
        { period: 'asc' },
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    res.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Create a new goal
router.post('/goals', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { type, target, period, year, month } = req.body;

    if (!type || !['watch_time', 'completion'].includes(type)) {
      return res.status(400).json({ error: 'Valid type (watch_time or completion) is required' });
    }

    if (!target || isNaN(target) || target <= 0) {
      return res.status(400).json({ error: 'Valid target value is required' });
    }

    if (!period || !['yearly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Valid period (yearly or monthly) is required' });
    }

    const goalData = {
      userId,
      type,
      target: parseFloat(target),
      period
    };

    if (period === 'yearly') {
      if (!year || isNaN(year)) {
        return res.status(400).json({ error: 'Year is required for yearly goals' });
      }
      goalData.year = parseInt(year);
    } else if (period === 'monthly') {
      if (!year || isNaN(year) || !month || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'Valid year and month (1-12) are required for monthly goals' });
      }
      goalData.year = parseInt(year);
      goalData.month = parseInt(month);
    }

    const goal = await prisma.personalGoal.create({
      data: goalData
    });

    res.json(goal);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Update a goal
router.put('/goals/:id', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const goalId = parseInt(req.params.id);
    const { target } = req.body;

    // Verify ownership
    const existingGoal = await prisma.personalGoal.findFirst({
      where: { id: goalId, userId }
    });

    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found or access denied' });
    }

    if (target !== undefined) {
      if (isNaN(target) || target <= 0) {
        return res.status(400).json({ error: 'Valid target value is required' });
      }
    }

    const goal = await prisma.personalGoal.update({
      where: { id: goalId },
      data: {
        ...(target !== undefined ? { target: parseFloat(target) } : {})
      }
    });

    res.json(goal);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// Delete a goal
router.delete('/goals/:id', async (req, res) => {
  try {
    const userId = req.session?.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const goalId = parseInt(req.params.id);

    // Verify ownership
    const existingGoal = await prisma.personalGoal.findFirst({
      where: { id: goalId, userId }
    });

    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found or access denied' });
    }

    await prisma.personalGoal.delete({
      where: { id: goalId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Search anime on AniList
router.get('/search-anime', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const accessToken = req.session.auth?.accessToken;
    if (!accessToken || req.session.auth?.service !== 'anilist') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const searchQuery = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            format
            episodes
            status
            coverImage {
              extraLarge
              large
              medium
            }
            genres
            studios(isMain: true) {
              nodes {
                name
              }
            }
            averageScore
          }
        }
      }
    `;

    const response = await axios.post(
      'https://graphql.anilist.co',
      {
        query: searchQuery,
        variables: {
          search: query.trim(),
          page: 1,
          perPage: 20
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const results = response.data?.data?.Page?.media || [];
    
    // Transform results to match our anime data format
    const formattedResults = results.map(media => ({
      id: media.id,
      idMal: media.idMal,
      title: media.title.english || media.title.romaji,
      _romaji: media.title.romaji,
      _english: media.title.english,
      format: media.format,
      episodes: media.episodes,
      status: media.status,
      coverImage: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium,
      genres: media.genres || [],
      studio: media.studios?.nodes?.[0]?.name || null,
      averageScore: media.averageScore
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error searching anime:', error);
    res.status(500).json({ error: 'Failed to search anime' });
  }
});

// Catch-all for unmatched routes
router.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
});

module.exports = router;