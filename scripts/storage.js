// =====================================================================
// --- STORAGE MODULE (storage.js) ---
// =====================================================================
// Handles all interactions with localStorage.
// =====================================================================

/**
 * Saves the core anime data and the current gacha state to localStorage.
 * @param {Array} data - The user's animeData array.
 */
export function saveDataToLocalStorage(data) {
  try {
    // 1. Save the main anime list data
    localStorage.setItem('animeDashboardData', JSON.stringify(data));

    // 2. Build and save the gacha state object
    // It reads from the global 'window' variables where gacha state is managed.
    const gachaState = {
      gachaTokens: window.gachaTokens || 0,
      gachaShards: window.gachaShards || 0,
      totalPulls: window.totalPulls || 0,
      episodesWatchedTotal: window.episodesWatchedTotal || 0,
      waifuCollection: window.waifuCollection || [],
      ownedCosmetics: window.ownedCosmetics || [],
      appliedCosmetics: window.appliedCosmetics || {}
    };
    localStorage.setItem('animeGachaState', JSON.stringify(gachaState));

  } catch (e) {
    console.error("Failed to save data to local storage", e);
  }
}

/**
 * Loads and parses anime data and gacha state from localStorage.
 * @returns {object} An object containing { animeData, gachaState }.
 */
export function checkForSavedData() {
  let animeData = [];
  let gachaState = null;
  const initialGachaState = {
    gachaTokens: window.CONFIG.GACHA_INITIAL_TOKENS || 5,
    gachaShards: 0,
    totalPulls: 0,
    episodesWatchedTotal: 0,
    waifuCollection: [],
    ownedCosmetics: [],
    appliedCosmetics: {}
  };

  try {
    // 1. Load main anime data
    const savedData = localStorage.getItem('animeDashboardData');
    if (savedData) {
      animeData = JSON.parse(savedData);
    }

    // 2. Load gacha state
    const savedGachaState = localStorage.getItem('animeGachaState');
    if (savedGachaState) {
      gachaState = JSON.parse(savedGachaState);
    } else {
      // If no saved gacha state, initialize a default one
      gachaState = initialGachaState;
    }

  } catch (e) {
    console.error("Could not load data from local storage", e);
    localStorage.removeItem('animeDashboardData');
    localStorage.removeItem('animeGachaState');
    // Reset to defaults on failure
    animeData = [];
    gachaState = initialGachaState;
  }

  // Return what was loaded for main.js to handle
  return {
    animeData,
    gachaState
  };
}