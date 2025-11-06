/**
 * Fetch Character Images from Multiple APIs
 * 
 * Automatically fetches character image URLs from multiple API sources:
 * - AniList API (anime characters with IDs)
 * - Jikan API (MyAnimeList characters)
 * - Waifu.im API (tagged anime images)
 * - Waifu.pics API (anime-style images)
 * - Nekos API (anime images and GIFs)
 * This eliminates the need to manually collect image URLs!
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const ANILIST_API = 'https://graphql.anilist.co';
const JIKAN_API = 'https://api.jikan.moe/v4';
const WAIFU_IM_API = 'https://api.waifu.im';
const WAIFU_PICS_API = 'https://api.waifu.pics';
const NEKOS_API = 'https://nekos.best/api/v2';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'character-images.json');

// Rate limiting with queue management
class RateLimiter {
  constructor(name, delayMs, maxRetries = 3) {
    this.name = name;
    this.delayMs = delayMs;
    this.maxRetries = maxRetries;
    this.lastRequestTime = 0;
    this.queue = [];
    this.processing = false;
    this.requestCount = 0;
    this.minuteStart = Date.now();
    this.rateLimitUntil = 0; // When rate limit expires
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
      // Check if we're rate limited
      const now = Date.now();
      if (now < this.rateLimitUntil) {
        const waitTime = this.rateLimitUntil - now;
        console.log(`⏳ ${this.name} rate limited, waiting ${Math.ceil(waitTime / 1000)}s...`);
        await sleep(waitTime);
        continue;
      }

      // Check per-minute limits
      if (now - this.minuteStart > 60000) {
        this.requestCount = 0;
        this.minuteStart = now;
      }

      // Wait for minimum delay between requests
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.delayMs) {
        await sleep(this.delayMs - timeSinceLastRequest);
      }

      const { fn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();
      this.requestCount++;

      // Execute with retry logic
      let lastError;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await fn();
          resolve(result);
          break;
        } catch (error) {
          lastError = error;
          
          // Check if it's a rate limit error (429)
          // Check both axios error format and string message
          const isRateLimit = error.response?.status === 429 || 
                             error.response?.statusCode === 429 ||
                             error.message?.includes('429') ||
                             error.code === 'ECONNRESET' && error.message?.includes('rate');
          
          if (isRateLimit) {
            // Parse Retry-After header if available
            const retryAfter = error.response?.headers?.['retry-after'] || 
                              error.response?.headers?.['Retry-After'];
            const waitTime = retryAfter ? 
              parseInt(retryAfter) * 1000 : 
              Math.min(2000 + (1000 * Math.pow(2, attempt)), 60000); // 2s base + exponential, max 60s
            
            this.rateLimitUntil = Date.now() + waitTime;
            console.warn(`⚠️  ${this.name} rate limited (429), waiting ${Math.ceil(waitTime / 1000)}s...`);
            
            if (attempt < this.maxRetries) {
              await sleep(waitTime);
              continue;
            } else {
              // Max retries reached, but still rate limited - wait longer
              const finalWait = Math.min(waitTime * 2, 120000); // Up to 2 minutes
              console.warn(`⚠️  ${this.name} still rate limited after ${this.maxRetries} retries, waiting ${Math.ceil(finalWait / 1000)}s...`);
              this.rateLimitUntil = Date.now() + finalWait;
              await sleep(finalWait);
              // Try one more time after long wait
              try {
                const result = await fn();
                resolve(result);
                break;
              } catch (finalError) {
                reject(finalError);
                break;
              }
            }
          }
          
          // Check if it's a server error (5xx) - retry with backoff
          if (error.response?.status >= 500 && attempt < this.maxRetries) {
            const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.warn(`⚠️  ${this.name} server error (${error.response.status}), retry ${attempt + 1}/${this.maxRetries} after ${backoffDelay}ms...`);
            await sleep(backoffDelay);
            continue;
          }
          
          // Non-retryable error or max retries reached
          if (attempt === this.maxRetries) {
            reject(error);
            break;
          }
        }
      }
      
      if (lastError && !this.queue.length) {
        reject(lastError);
      }
    }

    this.processing = false;
  }
}

// Create rate limiters for each API
const anilistLimiter = new RateLimiter('AniList', 1000, 3); // 1 req/sec
const jikanLimiter = new RateLimiter('Jikan', 500, 3); // 2 req/sec
const waifuImLimiter = new RateLimiter('Waifu.im', 300, 3); // ~3 req/sec
const waifuPicsLimiter = new RateLimiter('Waifu.pics', 500, 3); // ~2 req/sec
const nekosLimiter = new RateLimiter('Nekos', 500, 3); // ~2 req/sec

/**
 * Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch characters from AniList for a specific anime
 */
async function fetchAniListCharacters(animeId) {
  const query = `
    query ($id: Int) {
      Media(id: $id) {
        title {
          romaji
          english
        }
        characters(perPage: 50) {
          nodes {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
            description
            gender
          }
        }
      }
    }
  `;

  try {
    return await anilistLimiter.add(async () => {
      const response = await axios.post(ANILIST_API, {
        query: query,
        variables: { id: animeId }
      }, {
        timeout: 20000, // Longer timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          // Don't throw on 429 - let rate limiter handle it
          return status < 500;
        }
      });

      // Check for 429 in response
      if (response.status === 429) {
        const error = new Error('Rate limited (429)');
        error.response = response;
        throw error;
      }

      const media = response.data?.data?.Media;
      if (!media) return null;

      return {
        anime: {
          id: animeId,
          title: media.title.english || media.title.romaji,
          romaji: media.title.romaji
        },
        characters: media.characters.nodes.map(char => ({
          id: char.id,
          name: char.name.full,
          nativeName: char.name.native,
          imageUrl: char.image.large || char.image.medium,
          description: char.description,
          gender: char.gender || null
        }))
      };
    });
  } catch (error) {
    // Rate limiter will handle retries
    // If we still get an error after all retries, it's persistent
    if (error.response?.status !== 429 && !error.message?.includes('429')) {
      console.error(`❌ AniList error for anime ${animeId}:`, error.response?.status || error.message);
    }
    // Return null if all retries failed
    return null;
  }
}

/**
 * Search anime on AniList by name
 */
async function searchAniListAnime(animeName) {
  const query = `
    query ($search: String) {
      Page(perPage: 5) {
        media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
          }
        }
      }
    }
  `;

  try {
    return await anilistLimiter.add(async () => {
      const response = await axios.post(ANILIST_API, {
        query: query,
        variables: { search: animeName }
      }, {
        timeout: 20000, // Longer timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          // Don't throw on 429 - let rate limiter handle it
          return status < 500;
        }
      });

      // Check for 429 in response
      if (response.status === 429) {
        const error = new Error('Rate limited (429)');
        error.response = response;
        throw error;
      }

      return response.data?.data?.Page?.media || [];
    });
  } catch (error) {
    // Rate limiter will handle retries
    // If we still get an error after all retries, it's persistent
    if (error.response?.status !== 429 && error.message?.includes('429')) {
      console.error(`❌ AniList search error for "${animeName}":`, error.response?.status || error.message);
    }
    // Return empty array if all retries failed
    return [];
  }
}

/**
 * Fetch characters from Jikan (MyAnimeList) for a specific anime
 */
async function fetchJikanCharacters(malId) {
  try {
    return await jikanLimiter.add(async () => {
      const response = await axios.get(`${JIKAN_API}/anime/${malId}/characters`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Anime-Dashboard/1.0' }
      });

      const characters = response.data?.data || [];
      
      return characters.map(char => ({
        malId: char.character.mal_id,
        name: char.character.name,
        imageUrl: char.character.images?.jpg?.image_url || char.character.images?.webp?.image_url,
        role: char.role,
        voiceActors: char.voice_actors?.map(va => ({
          name: va.person.name,
          language: va.language
        })) || []
      }));
    });
  } catch (error) {
    console.error(`❌ Jikan error for MAL ${malId}:`, error.response?.status || error.message);
    return null;
  }
}

/**
 * Search anime on Jikan by name
 */
async function searchJikanAnime(animeName) {
  try {
    return await jikanLimiter.add(async () => {
      const response = await axios.get(`${JIKAN_API}/anime`, {
        params: { q: animeName, limit: 5 },
        timeout: 10000,
        headers: { 'User-Agent': 'Anime-Dashboard/1.0' }
      });

      return response.data?.data || [];
    });
  } catch (error) {
    console.error(`❌ Jikan search error for "${animeName}":`, error.response?.status || error.message);
    return [];
  }
}

/**
 * Fetch images from Waifu.im API
 */
async function fetchWaifuImImages(tags = [], count = 10) {
  try {
    return await waifuImLimiter.add(async () => {
      const params = new URLSearchParams({
        included_tags: tags.join(','),
        limit: count.toString(),
        is_nsfw: 'false' // SFW only
      });

      const response = await axios.get(`${WAIFU_IM_API}/search?${params}`, {
        timeout: 10000
      });

      const images = response.data?.images || [];
      return images.map(img => ({
        url: img.url,
        tags: img.tags || [],
        source: 'waifu.im'
      }));
    });
  } catch (error) {
    console.error(`❌ Waifu.im error:`, error.response?.status || error.message);
    return [];
  }
}

/**
 * Fetch images from Waifu.pics API
 */
async function fetchWaifuPicsImages(category = 'waifu', count = 10) {
  const results = [];
  
  try {
    for (let i = 0; i < count; i++) {
      const image = await waifuPicsLimiter.add(async () => {
        const response = await axios.get(`${WAIFU_PICS_API}/sfw/${category}`, {
          timeout: 5000
        });

        if (response.data?.url) {
          return {
            url: response.data.url,
            category: category,
            source: 'waifu.pics'
          };
        }
        return null;
      });

      if (image) {
        results.push(image);
      }
    }

    return results;
  } catch (error) {
    console.error(`❌ Waifu.pics error:`, error.response?.status || error.message);
    return results; // Return what we got so far
  }
}

/**
 * Fetch images from Nekos API
 */
async function fetchNekosImages(category = 'neko', count = 10) {
  const results = [];
  
  try {
    // Nekos API categories: neko, kitsune, waifu, hug, kiss, pat, smug, etc.
    const validCategories = ['neko', 'kitsune', 'waifu', 'hug', 'kiss', 'pat', 'smug', 'baka', 'cry', 'dance', 'happy', 'highfive', 'shinobu', 'megumin', 'bully', 'yeet', 'awoo', 'lurk', 'peck', 'nom', 'stare', 'lick', 'bite', 'slap', 'kick', 'poke', 'wave', 'handhold', 'handshake', 'cuddle', 'bonk', 'wink', 'pat', 'kiss', 'hug'];
    
    if (!validCategories.includes(category)) {
      category = 'waifu'; // Default
    }

    for (let i = 0; i < count; i++) {
      const image = await nekosLimiter.add(async () => {
        const response = await axios.get(`${NEKOS_API}/${category}`, {
          timeout: 5000
        });

        if (response.data?.results && response.data.results.length > 0) {
          const result = response.data.results[0];
          return {
            url: result.url,
            category: category,
            source: 'nekos'
          };
        }
        return null;
      });

      if (image) {
        results.push(image);
      }
    }

    return results;
  } catch (error) {
    console.error(`❌ Nekos API error:`, error.response?.status || error.message);
    return results;
  }
}

/**
 * Fetch additional images from random APIs for a character
 */
async function fetchAdditionalImagesFromRandomAPIs(characterName, animeName, count = 1, options = {}) {
  const results = [];
  const { randomAPIs = ['waifu-im', 'waifu-pics', 'nekos'] } = options;
  
  // Distribute count across APIs
  const perAPI = Math.ceil(count / randomAPIs.length);
  
  for (const api of randomAPIs) {
    try {
      let images = [];
      
      if (api === 'waifu-im') {
        images = await fetchWaifuImImages(['waifu', 'anime'], perAPI);
      } else if (api === 'waifu-pics') {
        images = await fetchWaifuPicsImages('waifu', perAPI);
      } else if (api === 'nekos') {
        images = await fetchNekosImages('waifu', perAPI);
      }
      
      images.forEach(img => {
        results.push({
          url: img.url,
          anime: animeName,
          character: characterName,
          source: img.source || api,
          isAdditional: true // Mark as additional image
        });
      });
    } catch (error) {
      console.log(`  ⚠️  Failed to fetch from ${api}: ${error.message}`);
    }
  }
  
  return results.slice(0, count); // Limit to requested count
}

/**
 * Process anime list and fetch character images
 */
async function processAnimeList(animeList, source = 'anilist', options = {}) {
  const results = [];
  const { 
    filterGender = null, // 'Female', 'Male', null for all
    selectedCharacters = null, // Array of character names/IDs to include
    imagesPerCharacter = 1, // How many images per character
    randomizeRarity = false, // Randomize rarity instead of using base rarity
    combineAPIs = false, // Combine character API with random APIs
    additionalImagesPerCharacter = 0, // How many additional images from random APIs
    randomAPIs = ['waifu-im', 'waifu-pics', 'nekos'] // Which random APIs to use
  } = options;
  
  let hitRateLimit = false;
  let consecutiveFailures = 0;
  
  console.log(`\n📥 Fetching character images from ${source.toUpperCase()}...\n`);
  if (filterGender) {
    console.log(`🔍 Filtering for: ${filterGender} characters only\n`);
  }
  if (selectedCharacters && selectedCharacters.length > 0) {
    console.log(`🎯 Selected characters: ${selectedCharacters.join(', ')}\n`);
  }
  console.log('=' .repeat(60));

  for (let i = 0; i < animeList.length; i++) {
    const item = animeList[i];
    const { animeName, animeId, malId, rarity, characters: itemCharacters } = item;
    
    // Check if specific characters are requested for this anime
    // Priority: item-specific characters > global selected characters > none
    const requestedCharacters = itemCharacters || selectedCharacters;

    console.log(`[${i + 1}/${animeList.length}] Processing: ${animeName}`);

      if (source === 'anilist' && animeId) {
      let data;
      try {
        data = await fetchAniListCharacters(animeId);
      } catch (error) {
        // Rate limiter should handle retries, but if we still get an error, it's persistent
        const isRateLimit = error.response?.status === 429 || 
                           error.message?.includes('429') ||
                           error.code === 'ECONNRESET';
        
        if (isRateLimit) {
          hitRateLimit = true;
          console.log(`  ⚠️  Rate limited after retries, waiting longer...`);
          await sleep(10000); // Wait 10 seconds
          
          // Try one more time after waiting
          try {
            data = await fetchAniListCharacters(animeId);
          } catch (retryError) {
            console.log(`  ❌ Still rate limited, skipping this anime...`);
            hitRateLimit = true;
            continue;
          }
        } else {
          console.log(`  ❌ Error: ${error.response?.status || error.message}`);
          continue;
        }
      }
      
      if (data && data.characters.length > 0) {
        consecutiveFailures = 0; // Reset on success
        // Filter characters
        let filteredChars = data.characters;
        
        // Filter by gender if specified
        if (filterGender) {
          filteredChars = filteredChars.filter(char => {
            const gender = char.gender?.toLowerCase();
            return gender === filterGender.toLowerCase() || 
                   (filterGender === 'Female' && (gender === 'female' || gender === 'f'));
          });
        }
        
        // Filter by selected characters if specified
        if (requestedCharacters && requestedCharacters.length > 0) {
          filteredChars = filteredChars.filter(char => {
            const charName = char.name.toLowerCase();
            const charId = char.id.toString();
            return requestedCharacters.some(req => {
              const reqLower = typeof req === 'string' ? req.toLowerCase() : req.toString();
              return charName.includes(reqLower) || 
                     char.nativeName?.toLowerCase().includes(reqLower) ||
                     charId === reqLower;
            });
          });
        }
        
        filteredChars.forEach((char, idx) => {
          if (char.imageUrl) {
            const baseRarity = rarity || 2;
            const imagesPerCharacter = options.imagesPerCharacter || 1;
            
            // Add main character images (from AniList)
            for (let i = 0; i < imagesPerCharacter; i++) {
              // Randomize rarity if requested
              let finalRarity = baseRarity;
              if (options.randomizeRarity) {
                // Weighted random: 2=60%, 3=30%, 4=8%, 5=1.9%, Prismatic=0.1%
                const rand = Math.random();
                if (rand < 0.6) finalRarity = 2;
                else if (rand < 0.9) finalRarity = 3;
                else if (rand < 0.98) finalRarity = 4;
                else if (rand < 0.999) finalRarity = 5;
                else finalRarity = 'Prismatic';
              }
              
              results.push({
                url: char.imageUrl,
                anime: data.anime.title,
                character: char.name,
                rarity: finalRarity,
                source: 'anilist',
                characterId: char.id,
                gender: char.gender,
                variant: i + 1 // Track variant number
              });
            }
            
          }
        });
        
        // Add additional images from random APIs if requested (after all characters processed)
        if (options.combineAPIs && options.additionalImagesPerCharacter > 0) {
          for (const char of filteredChars) {
            if (char.imageUrl) {
              const additionalImages = await fetchAdditionalImagesFromRandomAPIs(
                char.name,
                data.anime.title,
                options.additionalImagesPerCharacter,
                { randomAPIs: options.randomAPIs }
              );
              
              additionalImages.forEach((img, idx) => {
                let finalRarity = rarity || 2;
                if (options.randomizeRarity) {
                  const rand = Math.random();
                  if (rand < 0.6) finalRarity = 2;
                  else if (rand < 0.9) finalRarity = 3;
                  else if (rand < 0.98) finalRarity = 4;
                  else if (rand < 0.999) finalRarity = 5;
                  else finalRarity = 'Prismatic';
                }
                
                results.push({
                  url: img.url,
                  anime: img.anime,
                  character: img.character,
                  rarity: finalRarity,
                  source: img.source,
                  isAdditional: true,
                  variant: idx + 1
                });
              });
            }
          }
        }
        
        console.log(`  ✅ Found ${filteredChars.length} characters${filteredChars.length !== data.characters.length ? ` (filtered from ${data.characters.length})` : ''}`);
      } else {
        console.log(`  ⚠️  No characters found`);
      }
    } else if (source === 'jikan' && malId) {
      const characters = await fetchJikanCharacters(malId);
      if (characters && characters.length > 0) {
        characters.forEach((char, idx) => {
          if (char.imageUrl) {
            results.push({
              url: char.imageUrl,
              anime: animeName,
              character: char.name,
              rarity: rarity || 2,
              source: 'jikan',
              malId: char.malId,
              role: char.role
            });
          }
        });
        console.log(`  ✅ Found ${characters.length} characters`);
      } else {
        console.log(`  ⚠️  No characters found`);
      }
      } else if (animeName) {
      // Try to search for anime first
      console.log(`  🔍 Searching for anime: ${animeName}`);
      
      if (source === 'anilist') {
        let searchResults;
        try {
          searchResults = await searchAniListAnime(animeName);
        } catch (error) {
          // Rate limiter should handle retries, but if we still get an error, it's persistent
          const isRateLimit = error.response?.status === 429 || 
                             error.message?.includes('429') ||
                             error.code === 'ECONNRESET';
          
          if (isRateLimit) {
            hitRateLimit = true;
            console.log(`  ⚠️  Rate limited during search after retries, waiting longer...`);
            await sleep(10000); // Wait 10 seconds
            
            try {
              searchResults = await searchAniListAnime(animeName);
            } catch (retryError) {
              console.log(`  ❌ Still rate limited, skipping this anime...`);
              hitRateLimit = true;
              continue;
            }
          } else {
            console.log(`  ❌ Error: ${error.response?.status || error.message}`);
            continue;
          }
        }
        
        if (searchResults && searchResults.length > 0) {
          consecutiveFailures = 0; // Reset on success
          const bestMatch = searchResults[0];
          console.log(`  ✅ Found: ${bestMatch.title.english || bestMatch.title.romaji} (ID: ${bestMatch.id})`);
          
          const data = await fetchAniListCharacters(bestMatch.id);
          if (data && data.characters.length > 0) {
            // Filter characters
            let filteredChars = data.characters;
            
            if (filterGender) {
              filteredChars = filteredChars.filter(char => {
                const gender = char.gender?.toLowerCase();
                return gender === filterGender.toLowerCase() || 
                       (filterGender === 'Female' && (gender === 'female' || gender === 'f'));
              });
            }
            
            if (requestedCharacters && requestedCharacters.length > 0) {
              filteredChars = filteredChars.filter(char => {
                const charName = char.name.toLowerCase();
                const charId = char.id.toString();
                return requestedCharacters.some(req => {
                  const reqLower = typeof req === 'string' ? req.toLowerCase() : req.toString();
                  return charName.includes(reqLower) || 
                         char.nativeName?.toLowerCase().includes(reqLower) ||
                         charId === reqLower;
                });
              });
            }
            
            filteredChars.forEach(char => {
              if (char.imageUrl) {
                const baseRarity = rarity || 2;
                const imagesPerCharacter = options.imagesPerCharacter || 1;
                
                // Add main character images (from AniList)
                for (let i = 0; i < imagesPerCharacter; i++) {
                  let finalRarity = baseRarity;
                  if (options.randomizeRarity) {
                    const rand = Math.random();
                    if (rand < 0.6) finalRarity = 2;
                    else if (rand < 0.9) finalRarity = 3;
                    else if (rand < 0.98) finalRarity = 4;
                    else if (rand < 0.999) finalRarity = 5;
                    else finalRarity = 'Prismatic';
                  }
                  
                  results.push({
                    url: char.imageUrl,
                    anime: data.anime.title,
                    character: char.name,
                    rarity: finalRarity,
                    source: 'anilist',
                    characterId: char.id,
                    gender: char.gender,
                    variant: i + 1
                  });
                }
              }
            });
            
            // Add additional images from random APIs if requested (after all characters processed)
            if (options.combineAPIs && options.additionalImagesPerCharacter > 0) {
              for (const char of filteredChars) {
                if (char.imageUrl) {
                  const additionalImages = await fetchAdditionalImagesFromRandomAPIs(
                    char.name,
                    data.anime.title,
                    options.additionalImagesPerCharacter,
                    { randomAPIs: options.randomAPIs }
                  );
                  
                  additionalImages.forEach((img, idx) => {
                    let finalRarity = rarity || 2;
                    if (options.randomizeRarity) {
                      const rand = Math.random();
                      if (rand < 0.6) finalRarity = 2;
                      else if (rand < 0.9) finalRarity = 3;
                      else if (rand < 0.98) finalRarity = 4;
                      else if (rand < 0.999) finalRarity = 5;
                      else finalRarity = 'Prismatic';
                    }
                    
                    results.push({
                      url: img.url,
                      anime: img.anime,
                      character: img.character,
                      rarity: finalRarity,
                      source: img.source,
                      isAdditional: true,
                      variant: idx + 1
                    });
                  });
                }
              }
            }
            console.log(`  ✅ Found ${filteredChars.length} characters${filteredChars.length !== data.characters.length ? ` (filtered from ${data.characters.length})` : ''}`);
          }
        } else {
          console.log(`  ⚠️  Anime not found on AniList`);
        }
      } else if (source === 'jikan') {
        const searchResults = await searchJikanAnime(animeName);
        if (searchResults.length > 0) {
          const bestMatch = searchResults[0];
          console.log(`  ✅ Found: ${bestMatch.title} (MAL ID: ${bestMatch.mal_id})`);
          
          const characters = await fetchJikanCharacters(bestMatch.mal_id);
          if (characters && characters.length > 0) {
            characters.forEach(char => {
              if (char.imageUrl) {
                results.push({
                  url: char.imageUrl,
                  anime: animeName,
                  character: char.name,
                  rarity: rarity || 2,
                  source: 'jikan',
                  malId: char.malId,
                  role: char.role
                });
              }
            });
            console.log(`  ✅ Found ${characters.length} characters`);
          }
        } else {
          console.log(`  ⚠️  Anime not found on Jikan`);
        }
      }
    }

    // Delay between anime to avoid hitting rate limits
    // Base delay: 2 seconds (more conservative)
    // If rate limited: wait longer (5-10 seconds)
    // If multiple consecutive failures: wait even longer
    let delay = 2000; // Base 2 seconds between anime
    
    if (hitRateLimit) {
      consecutiveFailures++;
      // Exponential backoff: 5s, 10s, 20s, 30s...
      delay = Math.min(5000 + (consecutiveFailures * 5000), 30000);
      console.log(`  ⏸️  Rate limit detected, waiting ${Math.ceil(delay / 1000)}s before next anime...`);
    } else {
      consecutiveFailures = 0; // Reset on success
    }
    
    // If we've had multiple consecutive failures, wait even longer
    if (consecutiveFailures >= 3) {
      delay = Math.min(30000 + (consecutiveFailures * 5000), 60000); // Up to 60s
      console.log(`  ⏸️  Multiple consecutive rate limits (${consecutiveFailures}), waiting ${Math.ceil(delay / 1000)}s...`);
      console.log(`  💡 Consider waiting a few minutes before continuing, or run with fewer anime at once.\n`);
    }
    
    await sleep(delay);
    
    // Reset rate limit flag after delay
    if (hitRateLimit) {
      hitRateLimit = false;
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('🎴 Fetch Character Images from APIs\n');
    console.log('Usage:');
    console.log('  node scripts/fetch-character-images.js <anime-list.json> [--source anilist|jikan]');
    console.log('');
    console.log('Anime list JSON format:');
    console.log(JSON.stringify([
      {
        "animeName": "Demon Slayer",
        "animeId": 101348,  // AniList ID (optional)
        "malId": 38000,      // MyAnimeList ID (optional)
        "rarity": 5          // Default rarity for all characters (optional)
      }
    ], null, 2));
    console.log('');
    console.log('Examples:');
    console.log('  # Fetch from AniList (default)');
    console.log('  node scripts/fetch-character-images.js my-anime-list.json');
    console.log('');
    console.log('  # Fetch from Jikan (MyAnimeList)');
    console.log('  node scripts/fetch-character-images.js my-anime-list.json --source jikan');
    console.log('');
    console.log('💡 Tips:');
    console.log('  - If you only provide animeName, the tool will search for the anime first');
    console.log('  - AniList has better character images and more characters per anime');
    console.log('  - Jikan has broader coverage but may have fewer character images');
    console.log('');
    process.exit(0);
  }

  // Check for random mode
  if (args[0] === '--random' || args[0] === '-r') {
    const configFile = args[1];
    if (!configFile || !fs.existsSync(configFile)) {
      console.error('❌ Config file required for random mode');
      console.log('💡 Create a config JSON file (see --help for format)');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    const results = await processRandomImageAPIs(config);
    
    // Save results
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Summary:');
    console.log(`  Total images found: ${results.length}`);
    console.log(`  Output file: ${OUTPUT_FILE}`);
    console.log('');
    console.log('💡 Next steps:');
    console.log(`   1. Review ${OUTPUT_FILE}`);
    console.log(`   2. Edit anime/character names if needed`);
    console.log(`   3. Run: npm run download:images ${OUTPUT_FILE}`);
    console.log('');
    return;
  }

  const inputFile = args[0];
  const sourceArg = args.indexOf('--source');
  const source = sourceArg !== -1 && args[sourceArg + 1] ? args[sourceArg + 1] : 'anilist';
  
  // Check for gender filter
  const genderArg = args.indexOf('--gender');
  const filterGender = genderArg !== -1 && args[genderArg + 1] ? args[genderArg + 1] : null;
  
  // Check for character selection
  const charactersArg = args.indexOf('--characters');
  const selectedCharacters = charactersArg !== -1 && args[charactersArg + 1] ? 
    args[charactersArg + 1].split(',').map(c => c.trim()) : null;
  
  // Check for images per character
  const imagesPerCharArg = args.indexOf('--images-per-character');
  const imagesPerCharacter = imagesPerCharArg !== -1 && args[imagesPerCharArg + 1] ? 
    parseInt(args[imagesPerCharArg + 1]) : 1;
  
  // Check for randomized rarity
  const randomizeRarity = args.includes('--randomize-rarity') || args.includes('--random-rarity');
  
  // Check for combining APIs
  const combineAPIs = args.includes('--combine-apis') || args.includes('--multi-source');
  
  // Check for additional images from random APIs
  const additionalImagesArg = args.indexOf('--additional-images');
  const additionalImagesPerCharacter = additionalImagesArg !== -1 && args[additionalImagesArg + 1] ? 
    parseInt(args[additionalImagesArg + 1]) : 0;
  
  // Check for which random APIs to use
  const randomAPIsArg = args.indexOf('--random-apis');
  const randomAPIs = randomAPIsArg !== -1 && args[randomAPIsArg + 1] ? 
    args[randomAPIsArg + 1].split(',').map(a => a.trim()) : ['waifu-im', 'waifu-pics', 'nekos'];

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    console.log('💡 Create an anime list file first');
    process.exit(1);
  }

  const animeList = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  
  if (!Array.isArray(animeList)) {
    console.error('❌ Anime list must be an array');
    process.exit(1);
  }

  console.log('🎴 Fetch Character Images from APIs');
  console.log('=' .repeat(60));
  console.log(`\n📋 Anime list: ${animeList.length} anime`);
  console.log(`📡 Source: ${source.toUpperCase()}`);
  if (filterGender) {
    console.log(`👤 Gender filter: ${filterGender}`);
  }
  if (selectedCharacters && selectedCharacters.length > 0) {
    console.log(`🎯 Selected characters: ${selectedCharacters.join(', ')}`);
  }
  if (imagesPerCharacter > 1) {
    console.log(`🖼️  Images per character: ${imagesPerCharacter}`);
  }
  if (randomizeRarity) {
    console.log(`🎲 Rarity: Randomized (weighted)`);
  }
  if (combineAPIs) {
    console.log(`🔀 Combining APIs: ${source} + ${randomAPIs.join(', ')}`);
    if (additionalImagesPerCharacter > 0) {
      console.log(`➕ Additional images per character: ${additionalImagesPerCharacter}`);
    }
  }
  console.log('');

  const results = await processAnimeList(animeList, source, {
    filterGender: filterGender,
    selectedCharacters: selectedCharacters,
    imagesPerCharacter: imagesPerCharacter,
    randomizeRarity: randomizeRarity,
    combineAPIs: combineAPIs,
    additionalImagesPerCharacter: additionalImagesPerCharacter,
    randomAPIs: randomAPIs
  });

  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log('\n' + '=' .repeat(60));
  console.log('📊 Summary:');
  console.log(`  Total character images found: ${results.length}`);
  console.log(`  Output file: ${OUTPUT_FILE}`);
  console.log('');
  console.log('💡 Next steps:');
  console.log(`   1. Review ${OUTPUT_FILE}`);
  console.log(`   2. Edit rarity values if needed`);
  console.log(`   3. Run: npm run download:images ${OUTPUT_FILE}`);
  console.log('');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

