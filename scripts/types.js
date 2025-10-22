// =====================================================================
// --- TYPES MODULE (types.js) ---
// =====================================================================
// This file contains JSDoc type definitions for the entire application.
// It is imported by other modules to provide type-checking
// and intellisense.
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
 */

/**
 * Represents the complete gacha state saved in localStorage.
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


// This empty export makes it a module that other files can import
// without polluting the global scope.
export {};