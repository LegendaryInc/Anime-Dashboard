// =====================================================================
// --- TYPES MODULE (types.js) - ENHANCED WITH VALIDATION ---
// =====================================================================
// This file contains JSDoc type definitions and validation schemas.
// =====================================================================

/**
 * Represents a single anime entry from the user's AniList.
 * @typedef {object} AnimeEntry
 * @property {string} title - The Romaji title of the anime.
 * @property {number} score - The user's score (e.g., 8.5).
 * @property {number} episodesWatched - The number of episodes the user has watched.
 * @property {number | null} totalEpisodes - The total episodes for the series (null if unknown).
 * @property {string} status - The user's watch status (e.g., "CURRENT", "COMPLETED").
 * @property {string[]} genres - An array of genre strings.
 * @property {string | null} duration - A string describing episode duration (e.g., "24 min per ep").
 * @property {string | null} coverImage - The URL for the anime's cover image.
 * @property {object | null} airingSchedule - Info on the next airing episode.
 * @property {AiringScheduleNode | null} airingSchedule.nodes
 * @property {object[]} externalLinks - An array of external link objects.
 * @property {string} externalLinks.site - The name of the external site (e.g., "Crunchyroll").
 * @property {string} externalLinks.url - The URL to the site.
 * @property {string} type - The format of the anime (e.g., "TV", "MOVIE").
 */

/**
 * @typedef {object} AiringScheduleNode
 * @property {number} airingAt - The UNIX timestamp of the next airing.
 * @property {number} episode - The episode number that is airing.
 */

/**
 * Represents a single card in the user's gacha collection.
 * @typedef {object} GachaCard
 * @property {string} name - The character's formatted name.
 * @property {string} anime - The formatted name of the anime.
 * @property {string} image_url - The unique path/URL to the card's image.
 * @property {number | string} rarity - The rarity (e.g., 1, 2, 5, "Prismatic").
 * @property {number} [count] - Number of duplicates (optional).
 */

/**
 * Represents the complete gacha state.
 * @typedef {object} GachaState
 * @property {number} gachaTokens
 * @property {number} gachaShards
 * @property {number} totalPulls
 * @property {number} episodesWatchedTotal
 * @property {GachaCard[]} waifuCollection
 * @property {string[]} ownedCosmetics - Array of cosmetic IDs (e.g., "border-sakura-solid").
 * @property {object} appliedCosmetics - A map of { [card_image_url]: cosmetic_id }.
 */

/**
 * Represents the calculated statistics object.
 * @typedef {object} DashboardStats
 * @property {number} totalAnime
 * @property {number} totalEpisodes
 * @property {number} timeWatchedDays
 * @property {number} totalMinutes
 * @property {number} timeWatchedHours
 * @property {number} timeWatchedMinutes
 * @property {number} meanScore
 * @property {object<string, number>} genreCounts - A map of { [genreName]: count }.
 * @property {object<string, number>} scoreCounts - A map of { [score]: count }.
 */

/**
 * Backend gacha card format (sent to/from API).
 * @typedef {object} BackendGachaCard
 * @property {string} id - The card's unique identifier (image URL).
 * @property {string} name - Character name.
 * @property {string} anime - Anime title.
 * @property {string} rarity - Rarity as string ("Common", "Rare", "Epic", "Legendary").
 * @property {string} imageUrl - URL to card image.
 * @property {number} [count] - Duplicate count (optional).
 */

/**
 * API Response for gacha state.
 * @typedef {object} GachaStateResponse
 * @property {number} tokens
 * @property {number} shards
 * @property {BackendGachaCard[]} collection
 * @property {object} appliedCosmetics
 * @property {string[]} ownedCosmetics
 */

/**
 * API Response for gacha roll.
 * @typedef {object} GachaRollResponse
 * @property {boolean} success
 * @property {number} tokens - Remaining tokens.
 * @property {number} shards - Updated shards.
 * @property {boolean} isDuplicate - Whether this was a duplicate pull.
 * @property {number} [shardsAwarded] - Shards awarded for duplicate (if applicable).
 * @property {BackendGachaCard} [card] - The card pulled (if not duplicate or for display).
 */

/**
 * API Response for token calculation.
 * @typedef {object} TokenCalculationResponse
 * @property {number} tokens
 * @property {number} shards
 */

/**
 * API Response for cosmetic pack purchase.
 * @typedef {object} PackPurchaseResponse
 * @property {boolean} success
 * @property {number} shards - Remaining shards.
 * @property {string[]} cosmetics - Cosmetic IDs acquired.
 */

/**
 * API Response for cosmetic application.
 * @typedef {object} CosmeticApplyResponse
 * @property {boolean} success
 * @property {string} cardId
 * @property {string} cosmetic
 */

/**
 * API Response for collection reset.
 * @typedef {object} ResetResponse
 * @property {boolean} success
 * @property {number} tokens
 * @property {number} shards
 */

// =====================================================================
// VALIDATION SCHEMAS
// =====================================================================

/**
 * Validates a gacha state response from the backend.
 * @param {any} data - The data to validate.
 * @returns {{valid: boolean, errors: string[], data?: GachaStateResponse}}
 */
export function validateGachaStateResponse(data) {
  const errors = [];
  
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Response is not an object'] };
  }
  
  // Validate tokens
  if (typeof data.tokens !== 'number' || data.tokens < 0) {
    errors.push('Invalid tokens value');
  }
  
  // Validate shards
  if (typeof data.shards !== 'number' || data.shards < 0) {
    errors.push('Invalid shards value');
  }
  
  // Validate collection
  if (!Array.isArray(data.collection)) {
    errors.push('Collection is not an array');
  } else {
    data.collection.forEach((card, index) => {
      if (!card.id || typeof card.id !== 'string') {
        errors.push(`Card ${index}: missing or invalid id`);
      }
      if (!card.name || typeof card.name !== 'string') {
        errors.push(`Card ${index}: missing or invalid name`);
      }
      if (!card.rarity || typeof card.rarity !== 'string') {
        errors.push(`Card ${index}: missing or invalid rarity`);
      }
    });
  }
  
  // Validate appliedCosmetics
  if (typeof data.appliedCosmetics !== 'object' || data.appliedCosmetics === null) {
    errors.push('appliedCosmetics is not an object');
  }
  
  // Validate ownedCosmetics
  if (!Array.isArray(data.ownedCosmetics)) {
    errors.push('ownedCosmetics is not an array');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Validates a gacha roll response from the backend.
 * @param {any} data - The data to validate.
 * @returns {{valid: boolean, errors: string[], data?: GachaRollResponse}}
 */
export function validateGachaRollResponse(data) {
  const errors = [];
  
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Response is not an object'] };
  }
  
  // Validate success flag
  if (typeof data.success !== 'boolean') {
    errors.push('Missing or invalid success flag');
  }
  
  // Validate tokens
  if (typeof data.tokens !== 'number' || data.tokens < 0) {
    errors.push('Invalid tokens value');
  }
  
  // Validate shards
  if (typeof data.shards !== 'number' || data.shards < 0) {
    errors.push('Invalid shards value');
  }
  
  // Validate isDuplicate
  if (typeof data.isDuplicate !== 'boolean') {
    errors.push('Missing or invalid isDuplicate flag');
  }
  
  // If duplicate, check shardsAwarded
  if (data.isDuplicate && (typeof data.shardsAwarded !== 'number' || data.shardsAwarded <= 0)) {
    errors.push('Duplicate pull missing valid shardsAwarded');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Validates token calculation response.
 * @param {any} data - The data to validate.
 * @returns {{valid: boolean, errors: string[], data?: TokenCalculationResponse}}
 */
export function validateTokenCalculationResponse(data) {
  const errors = [];
  
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Response is not an object'] };
  }
  
  if (typeof data.tokens !== 'number' || data.tokens < 0) {
    errors.push('Invalid tokens value');
  }
  
  if (typeof data.shards !== 'number' || data.shards < 0) {
    errors.push('Invalid shards value');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Validates pack purchase response.
 * @param {any} data - The data to validate.
 * @returns {{valid: boolean, errors: string[], data?: PackPurchaseResponse}}
 */
export function validatePackPurchaseResponse(data) {
  const errors = [];
  
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Response is not an object'] };
  }
  
  if (typeof data.success !== 'boolean') {
    errors.push('Missing or invalid success flag');
  }
  
  if (typeof data.shards !== 'number' || data.shards < 0) {
    errors.push('Invalid shards value');
  }
  
  if (!Array.isArray(data.cosmetics)) {
    errors.push('cosmetics is not an array');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : undefined
  };
}

/**
 * Sanitizes a numeric value to ensure it's within valid range.
 * @param {number} value - The value to sanitize.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @param {number} fallback - Fallback value if invalid.
 * @returns {number}
 */
export function sanitizeNumeric(value, min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0) {
  const num = Number(value);
  if (isNaN(num) || num < min || num > max) {
    return fallback;
  }
  return num;
}

/**
 * Checks if state values are within reasonable bounds.
 * @param {GachaStateResponse} state - The state to check.
 * @returns {{valid: boolean, warnings: string[]}}
 */
export function validateStateBounds(state) {
  const warnings = [];
  const MAX_TOKENS = 10000;
  const MAX_SHARDS = 100000;
  const MAX_COLLECTION_SIZE = 10000;
  
  if (state.tokens > MAX_TOKENS) {
    warnings.push(`Tokens (${state.tokens}) exceeds maximum (${MAX_TOKENS})`);
  }
  
  if (state.shards > MAX_SHARDS) {
    warnings.push(`Shards (${state.shards}) exceeds maximum (${MAX_SHARDS})`);
  }
  
  if (state.collection && state.collection.length > MAX_COLLECTION_SIZE) {
    warnings.push(`Collection size (${state.collection.length}) exceeds maximum (${MAX_COLLECTION_SIZE})`);
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  };
}

// This empty export makes it a module
export {};