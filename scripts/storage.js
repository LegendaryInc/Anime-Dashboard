// =====================================================================
// --- STORAGE MODULE (storage.js) - UPDATED FOR BACKEND GACHA ---
// =====================================================================
// Handles localStorage interactions for anime data only.
// Gacha state is now managed by the backend.
// =====================================================================

/**
 * Saves the core anime data to localStorage.
 * ðŸ†• CHANGED: Gacha state is now handled by backend, not saved here.
 * @param {Array} data - The user's animeData array.
 */
export function saveDataToLocalStorage(data) {
  try {
    // Save only the main anime list data
    localStorage.setItem('animeDashboardData', JSON.stringify(data));
    
    // ðŸ†• Gacha state is now persisted on the backend via API calls
    // No need to save gacha state to localStorage anymore
    
  } catch (e) {
    console.error("Failed to save data to local storage", e);
  }
}

/**
 * Loads and parses anime data from localStorage.
 * ðŸ†• CHANGED: Only returns anime data. Gacha state loaded from backend.
 * @returns {object} An object containing { animeData }.
 */
export function checkForSavedData() {
  let animeData = [];

  try {
    // Load main anime data
    const savedData = localStorage.getItem('animeDashboardData');
    if (savedData) {
      animeData = JSON.parse(savedData);
    }

    // ðŸ†• REMOVED: Gacha state loading
    // Gacha state is now loaded from backend via loadGachaState() in gacha.js
    // This prevents conflicts between localStorage and backend state

  } catch (e) {
    console.error("Could not load data from local storage", e);
    localStorage.removeItem('animeDashboardData');
    animeData = [];
  }

  // Return only anime data - gacha state comes from backend
  return {
    animeData
  };
}

/**
 * ðŸ†• NEW: Clears old gacha data from localStorage.
 * Call this once after migration to clean up old data.
 */
export function clearOldGachaData() {
  try {
    const oldGachaState = localStorage.getItem('animeGachaState');
    if (oldGachaState) {
      console.log('ðŸ§¹ Clearing old gacha data from localStorage...');
      localStorage.removeItem('animeGachaState');
      console.log('âœ… Old gacha data cleared. Now using backend storage.');
    }
  } catch (e) {
    console.error("Failed to clear old gacha data", e);
  }
}