// =====================================================================
// --- STREAMING LINKS MODULE (utils/streaming.js) ---
// =====================================================================
// Fetches streaming links from Jikan API with caching and rate limiting
// =====================================================================

const axios = require('axios');

// Cache for streaming data (MAL ID -> streaming info)
const streamingCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 days

// Cache for Consumet API responses (title -> consumet data)
const consumetCache = new Map();
const CONSUMET_CACHE_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 days

// Consumet API base URL (local instance)
const CONSUMET_API_URL = process.env.CONSUMET_API_URL || 'http://localhost:3002';

// Rate limiting (Jikan allows 3 requests/second, 60/minute)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 350; // 350ms between requests (safe margin)

/**
 * Sleep function for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch anime data from Jikan API with rate limiting
 */
async function fetchJikanAnime(malId) {
  // Check cache first
  const cached = streamingCache.get(malId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`✅ Cache hit for MAL ID ${malId}`);
    return cached.data;
  }

  // Rate limiting
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  try {
    lastRequestTime = Date.now();
    const response = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/full`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Anime-Dashboard/1.0' }
    });

    const data = response.data?.data;
    if (!data) throw new Error('Invalid Jikan response');

    // Cache the result
    streamingCache.set(malId, {
      data,
      timestamp: Date.now()
    });

    console.log(`✅ Fetched Jikan data for MAL ID ${malId}`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch Jikan data for MAL ID ${malId}:`, error.message);
    
    // If we have stale cache, use it
    if (cached) {
      console.log(`⚠️ Using stale cache for MAL ID ${malId}`);
      return cached.data;
    }
    
    throw error;
  }
}

/**
 * Generate free streaming site URLs (always available, no API needed)
 */
function getFreeStreamingSites(anime) {
  const title = anime.title || anime.title_english || 'Unknown';
  const malId = anime.mal_id || anime.idMal || anime.malId;
  const searchQuery = encodeURIComponent(title);
  
  // Create URL-safe slug (improved)
  let slug = title
    .toLowerCase()
    .replace(/['"]/g, '')  // Remove quotes
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars except hyphens
    .replace(/\s+/g, '-')  // Replace spaces with hyphens
    .replace(/-+/g, '-')  // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')  // Remove leading/trailing hyphens
    .trim();

  // Create alternative slug (without common words that might not be in URLs)
  const altSlug = slug
    .replace(/\b(season|s|part|p|vol|volume|episode|ep)\b/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();

  // Use alternative slug if it's significantly shorter (more likely to match)
  const finalSlug = altSlug.length < slug.length * 0.7 ? altSlug : slug;

  return {
    // HiAnime: Use search (most reliable - can't get site-specific IDs from Jikan)
    hianime: `https://hianime.to/search?keyword=${searchQuery}`,
    // Gogoanime: Use search (most reliable)
    gogoanime: `https://gogoanime3.co/search.html?keyword=${searchQuery}`,
    // AnimePahe: Use search (most reliable)
    animepahe: `https://animepahe.ru/search?q=${searchQuery}`,
    // AniWave: Use search (most reliable)
    aniwave: `https://aniwave.to/search?q=${searchQuery}`,
    // AnimixPlay: Uses search (most reliable)
    animixplay: `https://animixplay.to/?q=${searchQuery}`,
  };
}

/**
 * Fetch streaming links from Consumet API (with caching)
 */
async function fetchFromConsumet(animeTitle, provider = 'zoro') {
  // Create cache key (title + provider)
  const cacheKey = `${provider}:${animeTitle.toLowerCase().trim()}`;
  
  // Check cache first
  const cached = consumetCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CONSUMET_CACHE_DURATION) {
    console.log(`✅ Consumet cache hit for ${animeTitle} (provider: ${provider})`);
    return cached.data;
  }

  try {
    // Search Consumet API
    const searchQuery = encodeURIComponent(animeTitle);
    const response = await axios.get(`${CONSUMET_API_URL}/anime/${provider}/${searchQuery}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Anime-Dashboard/1.0' }
    });

    const data = response.data;
    if (!data || !data.results || data.results.length === 0) {
      console.log(`⚠️ No results from Consumet for ${animeTitle} (provider: ${provider})`);
      return null;
    }

    // Cache the result
    consumetCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });

    console.log(`✅ Fetched Consumet data for ${animeTitle} (provider: ${provider})`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch Consumet data for ${animeTitle} (provider: ${provider}):`, error.message);
    
    // If we have stale cache, use it
    if (cached) {
      console.log(`⚠️ Using stale Consumet cache for ${animeTitle} (provider: ${provider})`);
      return cached.data;
    }
    
    return null;
  }
}

/**
 * Extract free site links from Consumet search results (handles different provider formats)
 */
function extractFreeSitesFromConsumet(consumetData, provider) {
  const freeSites = {
    hianime: null,
    gogoanime: null,
    animepahe: null,
    aniwave: null,
    animixplay: null
  };

  if (!consumetData || !consumetData.results || consumetData.results.length === 0) {
    return freeSites;
  }

  // Get first result (most relevant)
  const firstResult = consumetData.results[0];
  
  // Handle different provider formats
  if (provider === 'zoro') {
    // Zoro provider returns HiAnime URLs directly
    if (firstResult.url) {
      const url = firstResult.url.replace('?ref=search', ''); // Remove ref parameter
      if (url.includes('hianime.to')) {
        freeSites.hianime = url;
        console.log(`  ✅ Found HiAnime link from Consumet (Zoro): ${freeSites.hianime}`);
      }
    }
  } else if (provider === 'animepahe') {
    // AnimePahe provider returns IDs, need to build URL
    if (firstResult.id) {
      const animepaheId = firstResult.id;
      freeSites.animepahe = `https://animepahe.ru/anime/${animepaheId}`;
      console.log(`  ✅ Found AnimePahe link from Consumet (AnimePahe): ${freeSites.animepahe}`);
    }
  } else if (provider === 'gogoanime') {
    // GogoAnime provider might return URLs or IDs
    if (firstResult.url) {
      const url = firstResult.url;
      if (url.includes('gogoanime') || url.includes('gogo')) {
        freeSites.gogoanime = url;
        console.log(`  ✅ Found GogoAnime link from Consumet (GogoAnime): ${freeSites.gogoanime}`);
      }
    } else if (firstResult.id) {
      // If it returns ID, might need to build URL (format depends on Consumet implementation)
      freeSites.gogoanime = `https://gogoanime3.co/category/${firstResult.id}`;
      console.log(`  ✅ Built GogoAnime link from Consumet ID: ${freeSites.gogoanime}`);
    }
  }

  return freeSites;
}

/**
 * Try multiple Consumet providers in parallel and merge results
 */
async function fetchFromMultipleConsumetProviders(animeTitle) {
  const providers = [
    { name: 'zoro', priority: 1 },      // HiAnime links
    { name: 'animepahe', priority: 2 }, // AnimePahe links
    { name: 'gogoanime', priority: 3 }   // GogoAnime links
  ];

  const allFreeSites = {
    hianime: null,
    gogoanime: null,
    animepahe: null,
    aniwave: null,
    animixplay: null
  };

  // Try all providers in parallel (much faster!)
  const providerPromises = providers.map(async (provider) => {
    try {
      const consumetData = await fetchFromConsumet(animeTitle, provider.name);
      
      if (consumetData && consumetData.results && consumetData.results.length > 0) {
        const providerFreeSites = extractFreeSitesFromConsumet(consumetData, provider.name);
        console.log(`✅ Processed Consumet provider ${provider.name} for ${animeTitle}`);
        return { provider: provider.name, freeSites: providerFreeSites };
      }
      return { provider: provider.name, freeSites: null };
    } catch (error) {
      console.log(`⚠️ Consumet provider ${provider.name} failed for ${animeTitle}:`, error.message);
      return { provider: provider.name, freeSites: null };
    }
  });

  // Wait for all providers to complete (parallel execution)
  const results = await Promise.allSettled(providerPromises);
  
  // Merge results from all successful providers
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value && result.value.freeSites) {
      const { freeSites } = result.value;
      
      // Merge results (only overwrite if we don't have a link yet)
      Object.keys(allFreeSites).forEach(site => {
        if (!allFreeSites[site] && freeSites[site]) {
          allFreeSites[site] = freeSites[site];
        }
      });
    }
  });

  return allFreeSites;
}

/**
 * Extract free site links from Jikan external array
 */
function extractFreeSiteLinks(external) {
  const freeSites = {
    hianime: null,
    gogoanime: null,
    animepahe: null,
    aniwave: null,
    animixplay: null
  };
  
  // Site name patterns to match
  const sitePatterns = {
    hianime: ['hianime', 'hi anime', 'hianime.to'],
    gogoanime: ['gogoanime', 'gogo anime', 'gogoanime3', 'gogoanimehd'],
    animepahe: ['animepahe', 'anime pahe'],
    aniwave: ['aniwave', 'ani wave', 'aniwave.to'],
    animixplay: ['animixplay', 'anime mix play']
  };
  
  external.forEach(link => {
    if (!link.name || !link.url) return;
    
    const nameLower = link.name.toLowerCase();
    const urlLower = link.url.toLowerCase();
    
    // Debug: Log all external links to see what we're getting
    console.log(`  🔍 Checking external link: "${link.name}" -> ${link.url}`);
    
    // Check each free site pattern
    Object.keys(sitePatterns).forEach(site => {
      const patterns = sitePatterns[site];
      const matches = patterns.some(pattern => 
        nameLower.includes(pattern) || urlLower.includes(pattern)
      );
      
      if (matches && !freeSites[site]) {
        freeSites[site] = link.url;
        console.log(`  ✅ Found ${site} link from Jikan: ${link.url}`);
      }
    });
  });
  
  return freeSites;
}

/**
 * Extract official streaming links from Jikan data
 */
function getOfficialStreamingLinks(jikanData) {
  if (!jikanData) {
    console.warn('⚠️ getOfficialStreamingLinks: No jikanData provided');
    return [];
  }
  
  const streaming = jikanData?.streaming || [];
  const external = jikanData?.external || [];
  
  // Debug logging
  if (streaming.length > 0) {
    console.log(`📺 Found ${streaming.length} streaming service(s) for MAL ID ${jikanData.mal_id || 'unknown'}`);
  }
  if (external.length > 0) {
    console.log(`🔗 Found ${external.length} external link(s) for MAL ID ${jikanData.mal_id || 'unknown'}`);
  }
  
  const officialLinks = [];
  
  // Add streaming services
  streaming.forEach(service => {
    if (service.name && service.url) {
      officialLinks.push({
        name: service.name,
        url: service.url,
        type: 'streaming'
      });
      console.log(`  ✅ Added streaming: ${service.name} - ${service.url}`);
    } else {
      console.warn(`  ⚠️ Skipping invalid streaming service:`, service);
    }
  });
  
  // Add external links (official sites, etc.)
  external.forEach(link => {
    if (link.name && link.url) {
      // Check if it's an official site
      const isOfficial = link.name?.toLowerCase().includes('official') || 
                        link.url?.toLowerCase().includes('official') ||
                        link.name?.toLowerCase().includes('website');
      
      if (isOfficial) {
        officialLinks.push({
          name: link.name || 'Official Site',
          url: link.url,
          type: 'official'
        });
        console.log(`  ✅ Added official link: ${link.name} - ${link.url}`);
      }
    }
  });
  
  if (officialLinks.length === 0) {
    console.log(`⚠️ No official streaming links found for MAL ID ${jikanData.mal_id || 'unknown'}`);
  }
  
  return officialLinks;
}

/**
 * Get comprehensive streaming info for an anime
 */
async function getStreamingInfo(malId, animeTitle) {
  const result = {
    malId,
    title: animeTitle,
    free: null,
    official: [],
    error: null
  };

  // Generate fallback free site links (will be overridden if Consumet/Jikan has real links)
  result.free = getFreeStreamingSites({ title: animeTitle, mal_id: malId });

  // Try to fetch free site links from Consumet first (more reliable for direct links)
  try {
    console.log(`🔍 Fetching free site links from Consumet (multiple providers) for ${animeTitle}...`);
    const consumetFreeSites = await fetchFromMultipleConsumetProviders(animeTitle);
    
    // Merge: Use Consumet links where available, keep generated links for others
    result.free = {
      hianime: consumetFreeSites.hianime || result.free.hianime,
      gogoanime: consumetFreeSites.gogoanime || result.free.gogoanime,
      animepahe: consumetFreeSites.animepahe || result.free.animepahe,
      aniwave: consumetFreeSites.aniwave || result.free.aniwave,
      animixplay: consumetFreeSites.animixplay || result.free.animixplay
    };
    
    const consumetCount = Object.values(consumetFreeSites).filter(Boolean).length;
    if (consumetCount > 0) {
      console.log(`✅ Found ${consumetCount} free site link(s) from Consumet (multiple providers) for ${animeTitle}`);
    } else {
      console.log(`⚠️ No free site links found from Consumet for ${animeTitle}, using generated URLs`);
    }
  } catch (error) {
    console.log(`⚠️ Consumet fetch failed for ${animeTitle}:`, error.message);
    // Continue with fallback links
  }

  // Try to fetch official links from Jikan
  if (malId) {
    try {
      const jikanData = await fetchJikanAnime(malId);
      
      // Extract official streaming links
      result.official = getOfficialStreamingLinks(jikanData);
      
      // Extract free site links from Jikan's external array (these have correct URLs!)
      console.log(`🔍 Extracting free site links from Jikan external array for ${animeTitle} (MAL ID: ${malId})`);
      console.log(`   External links count: ${(jikanData.external || []).length}`);
      const jikanFreeSites = extractFreeSiteLinks(jikanData.external || []);
      
      // Merge: Use Jikan links where available, fallback to generated links
      result.free = {
        hianime: jikanFreeSites.hianime || result.free.hianime,
        gogoanime: jikanFreeSites.gogoanime || result.free.gogoanime,
        animepahe: jikanFreeSites.animepahe || result.free.animepahe,
        aniwave: jikanFreeSites.aniwave || result.free.aniwave,
        animixplay: jikanFreeSites.animixplay || result.free.animixplay
      };
      
      // Log the results
      if (result.official.length > 0) {
        console.log(`✅ Successfully extracted ${result.official.length} official link(s) for ${animeTitle} (MAL ID: ${malId})`);
      } else {
        console.log(`⚠️ No official streaming links found for ${animeTitle} (MAL ID: ${malId})`);
      }
      
      // Log free sites from Jikan
      const jikanFreeCount = Object.values(jikanFreeSites).filter(Boolean).length;
      if (jikanFreeCount > 0) {
        console.log(`✅ Found ${jikanFreeCount} free site link(s) from Jikan for ${animeTitle}`);
        console.log(`   Free sites: ${JSON.stringify(jikanFreeSites, null, 2)}`);
      } else {
        console.log(`⚠️ No free site links found in Jikan data for ${animeTitle}, using generated URLs`);
        console.log(`   Generated free sites: ${JSON.stringify(result.free, null, 2)}`);
      }
      
      // Also get better title if available
      if (jikanData.title_english) {
        result.title = jikanData.title_english;
      }
    } catch (error) {
      result.error = error.message;
      
      // Check if we have cached Jikan data to extract free sites from
      const cached = streamingCache.get(malId);
      if (cached && cached.data) {
        console.log(`⚠️ Jikan fetch failed for ${animeTitle}, but using cached data to extract free site links`);
        console.log(`   Cached external links count: ${(cached.data.external || []).length}`);
        
        // Extract free site links from cached data
        const jikanFreeSites = extractFreeSiteLinks(cached.data.external || []);
        
        // Merge: Use cached Jikan links where available, fallback to generated links
        result.free = {
          hianime: jikanFreeSites.hianime || result.free.hianime,
          gogoanime: jikanFreeSites.gogoanime || result.free.gogoanime,
          animepahe: jikanFreeSites.animepahe || result.free.animepahe,
          aniwave: jikanFreeSites.aniwave || result.free.aniwave,
          animixplay: jikanFreeSites.animixplay || result.free.animixplay
        };
        
        const jikanFreeCount = Object.values(jikanFreeSites).filter(Boolean).length;
        if (jikanFreeCount > 0) {
          console.log(`✅ Extracted ${jikanFreeCount} free site link(s) from cached Jikan data for ${animeTitle}`);
          console.log(`   Free sites: ${JSON.stringify(jikanFreeSites, null, 2)}`);
        } else {
          console.log(`⚠️ No free site links in cached data for ${animeTitle}, using generated URLs (may be incorrect)`);
          console.log(`   Generated free sites: ${JSON.stringify(result.free, null, 2)}`);
        }
      } else {
        console.log(`⚠️ Could not fetch Jikan data for ${animeTitle} (no cached data available), using generated URLs (may be incorrect)`);
        console.log(`   Generated free sites: ${JSON.stringify(result.free, null, 2)}`);
      }
    }
  } else {
    console.log(`⚠️ No MAL ID provided for ${animeTitle}, using generated URLs (may be incorrect)`);
  }

  return result;
}

/**
 * Simple concurrency limiter for parallel processing
 */
function createConcurrencyLimiter(maxConcurrent) {
  let active = 0;
  const queue = [];
  
  async function run(fn) {
    if (active >= maxConcurrent) {
      await new Promise(resolve => queue.push(resolve));
    }
    
    active++;
    try {
      return await fn();
    } finally {
      active--;
      if (queue.length > 0) {
        const next = queue.shift();
        next();
      }
    }
  }
  
  return run;
}

/**
 * Batch fetch streaming info for multiple anime (with parallel processing and rate limiting)
 */
async function batchGetStreamingInfo(animeList) {
  // Process 5 anime at a time (to avoid overwhelming APIs)
  const limiter = createConcurrencyLimiter(5);
  
  // Process all anime in parallel (with concurrency limit)
  const promises = animeList.map(anime => 
    limiter(async () => {
      const malId = anime.idMal || anime.malId || anime.mal_id;
      const title = anime.title;
      
      try {
        const streamingInfo = await getStreamingInfo(malId, title);
        return streamingInfo;
      } catch (error) {
        console.error(`Failed to get streaming info for ${title}:`, error.message);
        // Still add free links
        return {
          malId,
          title,
          free: getFreeStreamingSites({ title, mal_id: malId }),
          official: [],
          error: error.message
        };
      }
    })
  );
  
  // Wait for all to complete
  const results = await Promise.all(promises);
  
  return results;
}

/**
 * Clear cache (useful for testing)
 */
function clearCache() {
  streamingCache.clear();
  consumetCache.clear();
  console.log('🧹 Streaming cache cleared (Jikan + Consumet)');
}

/**
 * Get cache stats
 */
function getCacheStats() {
  return {
    jikanCacheSize: streamingCache.size,
    consumetCacheSize: consumetCache.size,
    jikanEntries: Array.from(streamingCache.keys()),
    consumetEntries: Array.from(consumetCache.keys())
  };
}

module.exports = {
  getStreamingInfo,
  batchGetStreamingInfo,
  getFreeStreamingSites,
  getOfficialStreamingLinks,
  clearCache,
  getCacheStats,
  streamingCache
};