// =====================================================================
// --- MAIN APPLICATION SCRIPT (main.js) ---
// =====================================================================
// This is the new entry point. It imports all other modules
// and connects them to the DOM.
// =====================================================================

// --- 1. Module Imports ---
// We will create all of these files next.
import {
  showError,
  showLoading,
  setActiveTab,
  applyConfigToUI,
  showSettingsModal,
  saveAndGenerateConfigFile,
  renderStats,
  renderAnimeTable,
  applyTableFiltersAndSort,
  populateFilters,
  renderWatchingTab,
  incrementEpisode,
} from './ui.js';

import {
  loadTheme,
  setTheme
} from './themes.js';

import {
  saveDataToLocalStorage,
  checkForSavedData
} from './storage.js';

import {
  calculateStatistics,
  downloadEnrichedJSON
} from './data.js';

import {
  renderCharts
} from './charts.js';

import {
  getSimilarAnime,
  getGeminiRecommendations
} from './ai.js';

import {
  fetchSeasonalAnime
} from './calendar.js';

// Gacha functions are imported from gacha.js
import {
  rollGacha,
  renderGachaState,
  updateGachaTokens,
  displayGachaResult, // <-- ADD THIS
  loadGachaData       // <-- ADD THIS
} from './gacha.js';


// --- 2. State Variables ---
// All top-level state for the application lives here.

// Pull from global config set in index.html
let GEMINI_API_KEY = window.CONFIG.GEMINI_API_KEY || '';
let ITEMS_PER_PAGE = window.CONFIG.EPISODES_PER_PAGE || 25;

let seasonalAnimeData = null;
let animeData = [];
let genreChartInstance, scoreChartInstance;
let lastStats = null;
let currentSort = {
  column: 'title',
  direction: 'asc'
};
window.episodesWatchedTotal = 0;


// --- 3. Core Application Flow ---

/**
 * Fetches data from the backend /api/get-anilist-data endpoint.
 * Handles auth errors and processes the successful response.
 */
async function syncWithAnilist() {
  const loginScreen = document.getElementById('login-screen');
  const welcomeScreen = document.getElementById('welcome-back-screen');
  const errorMessageElement = document.getElementById('error-message');

  showLoading(true, 'Syncing with AniList...');
  if (welcomeScreen) welcomeScreen.classList.add('hidden');
  if (errorMessageElement) showError(errorMessageElement, null);

  try {
    const response = await fetch('/api/get-anilist-data');

    if (response.status === 401) {
      // Not authenticated, force a login screen
      localStorage.removeItem('animeDashboardData');
      localStorage.removeItem('animeGachaState');
      animeData = [];
      window.gachaTokens = window.CONFIG.GACHA_INITIAL_TOKENS || 5;
      window.gachaShards = 0;
      window.totalPulls = 0;
      window.episodesWatchedTotal = 0;
      window.waifuCollection = [];
      window.ownedCosmetics = [];
      window.appliedCosmetics = {};

      showLoading(false);
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      const dashboardScreen = document.getElementById('dashboard-screen');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `Server error: ${response.statusText}`
      }));
      throw new Error(errorData.error || `Server error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Received invalid data format from server.");
    }
    
    // Success! Save data and render
    animeData = data;
    saveDataToLocalStorage(animeData);
    processAndRenderDashboard(animeData);

  } catch (err) {
    console.error("Sync Error:", err);
    showError(errorMessageElement, `Sync failed: ${err.message}. Please try logging in again.`);
    showLoading(false);
    if (!localStorage.getItem('animeDashboardData')) {
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      const dashboardScreen = document.getElementById('dashboard-screen');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');
    }
  }
}

/**
 * Logs the user out by clearing session and local data.
 */
async function logout() {
  try {
    await fetch('/logout');
  } catch (error) {
    console.error("Failed to communicate with logout endpoint:", error);
  } finally {
    // Clear all local data
    localStorage.removeItem('animeDashboardData');
    localStorage.removeItem('animeGachaState');
    animeData = [];
    lastStats = null;
    seasonalAnimeData = null;
    window.gachaTokens = window.CONFIG.GACHA_INITIAL_TOKENS || 5;
    window.gachaShards = 0;
    window.totalPulls = 0;
    window.episodesWatchedTotal = 0;
    window.waifuCollection = [];
    window.ownedCosmetics = [];
    window.appliedCosmetics = {};

    // Redirect to home to force re-login
    window.location.href = '/';
  }
}

/**
 * Main callback function after data is loaded.
 * Triggers all rendering functions.
 * @param {Array} data - The user's anime data.
 */
function processAndRenderDashboard(data) {
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const welcomeScreen = document.getElementById('welcome-back-screen');

  if (!Array.isArray(data)) {
    console.error("Invalid data provided to processAndRenderDashboard:", data);
    showError(document.getElementById('error-message'), "Failed to process data.");
    logout();
    return;
  }

  // Hide login/welcome screens
  if (loginScreen) loginScreen.classList.add('hidden');
  if (welcomeScreen) welcomeScreen.classList.add('hidden');

  // --- Trigger all render functions ---
  populateFilters(data);
  lastStats = calculateStatistics(data);
  renderStats(lastStats);
  
  // Pass instances to renderCharts so it can destroy them
  const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
  genreChartInstance = chartInstances.genreChartInstance;
  scoreChartInstance = chartInstances.scoreChartInstance;

  renderAnimeTable(data, currentSort);
  renderWatchingTab(data, (title) => {
    // Pass incrementEpisode as a callback to renderWatchingTab
    animeData = incrementEpisode(title, animeData);
    lastStats = calculateStatistics(animeData);
    updateGachaTokens(lastStats.totalEpisodes, window.totalPulls);
    saveDataToLocalStorage(animeData);
    renderStats(lastStats);
    renderAnimeTable(animeData, currentSort);
  });

  // Gacha setup
  updateGachaTokens(lastStats.totalEpisodes, window.totalPulls);
  renderGachaState();

  // Show dashboard
  setActiveTab('watching');
  if (document.getElementById('gemini-response')) document.getElementById('gemini-response').innerHTML = '';
  showLoading(false);
  if (dashboardScreen) dashboardScreen.classList.remove('hidden');
  setTimeout(() => {
    if (dashboardScreen) dashboardScreen.classList.add('loaded');
  }, 10);
}


// --- 4. Event Listeners ---
// This is the main bootstrapper for the application.

document.addEventListener('DOMContentLoaded', () => {
  // --- Get Elements ---
  const settingsButton = document.getElementById('settings-button');
  const viewDashboardBtn = document.getElementById('view-dashboard-btn');
  const resyncBtn = document.getElementById('resync-btn');
  const logoutBtn = document.getElementById('logout-button');
  const downloadJsonBtn = document.getElementById('download-json-btn');
  const tabNav = document.getElementById('tab-nav');
  const themeSwitcher = document.getElementById('theme-switcher');
  const animeTableHead = document.getElementById('anime-table-head');
  const settingsSaveButton = document.getElementById('settings-save');
  const settingsCancelButton = document.getElementById('settings-cancel');
  const similarModalClose = document.getElementById('similar-modal-close');
  const searchBar = document.getElementById('search-bar');
  const statusFilter = document.getElementById('status-filter');
  const genreFilter = document.getElementById('genre-filter');
  const geminiButton = document.getElementById('gemini-button');
  const gachaRollButton = document.getElementById('gacha-roll-button');
  const cosmeticModalClose = document.getElementById('cosmetic-modal-close');

  // --- Initial Setup ---
  applyConfigToUI();
  loadTheme();
  
  // Load saved data and update gacha state
  const loadedData = checkForSavedData();
  animeData = loadedData.animeData;
  if (loadedData.gachaState) {
    window.gachaTokens = loadedData.gachaState.gachaTokens;
    window.gachaShards = loadedData.gachaState.gachaShards;
    window.totalPulls = loadedData.gachaState.totalPulls;
    window.episodesWatchedTotal = loadedData.gachaState.episodesWatchedTotal;
    window.waifuCollection = loadedData.gachaState.waifuCollection;
    window.ownedCosmetics = loadedData.gachaState.ownedCosmetics;
    window.appliedCosmetics = loadedData.gachaState.appliedCosmetics;
  }
  
  if (animeData.length > 0) {
    lastStats = calculateStatistics(animeData);
  }

  // --- Auth Flow ---
  if (animeData.length > 0) {
    // Saved data exists, show welcome screen
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('welcome-back-screen').classList.remove('hidden');
  } else {
    // No data, try to sync (which will show login if unauthorized)
    syncWithAnilist();
  }

  // --- Attach Listeners ---

  // Main Auth/Data Buttons
  if (viewDashboardBtn) {
    viewDashboardBtn.addEventListener('click', () => {
      const storedData = localStorage.getItem('animeDashboardData');
      if (storedData) {
        animeData = JSON.parse(storedData);
        document.getElementById('welcome-back-screen').classList.add('hidden');
        processAndRenderDashboard(animeData);
      } else {
        syncWithAnilist();
      }
    });
  }
  if (resyncBtn) resyncBtn.addEventListener('click', syncWithAnilist);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', () => downloadEnrichedJSON(animeData));
  }
  
  // Tab Navigation
  if (tabNav) {
    tabNav.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const tab = e.target.dataset.tab;
        setActiveTab(tab);
        if (tab === 'calendar' && !seasonalAnimeData) {
          fetchSeasonalAnime().then(data => {
            seasonalAnimeData = data;
          });
        }
      }
    });
  }
  
  // Theme Switcher
  if (themeSwitcher) {
    themeSwitcher.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const newTheme = e.target.dataset.theme;
        setTheme(newTheme);
        // Re-render charts with new theme colors
        if (lastStats) {
          const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
          genreChartInstance = chartInstances.genreChartInstance;
          scoreChartInstance = chartInstances.scoreChartInstance;
        }
      }
    });
  }

  // Settings Modal
  if (settingsButton) settingsButton.addEventListener('click', showSettingsModal);
  if (settingsSaveButton) {
    settingsSaveButton.addEventListener('click', () => {
        // Save config generates a file, but also updates the live config
        const newConfig = saveAndGenerateConfigFile();
        window.CONFIG = newConfig.CONFIG;
        GEMINI_API_KEY = newConfig.GEMINI_API_KEY;
        ITEMS_PER_PAGE = newConfig.ITEMS_PER_PAGE;
        // Re-apply UI and re-render charts
        applyConfigToUI();
        if (lastStats) {
            const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
            genreChartInstance = chartInstances.genreChartInstance;
            scoreChartInstance = chartInstances.scoreChartInstance;
        }
    });
  }
  if (settingsCancelButton) {
    settingsCancelButton.addEventListener('click', () => {
      document.getElementById('settings-modal-backdrop').classList.remove('show');
    });
  }

  // List Tab Filtering and Sorting
  if (searchBar) {
    searchBar.addEventListener('input', () => 
      applyTableFiltersAndSort(animeData, currentSort)
    );
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', () => 
      applyTableFiltersAndSort(animeData, currentSort)
    );
  }
  if (genreFilter) {
    genreFilter.addEventListener('change', () => 
      applyTableFiltersAndSort(animeData, currentSort)
    );
  }
  if (animeTableHead) {
    animeTableHead.addEventListener('click', (e) => {
      const header = e.target.closest('.sortable-header');
      if (header) {
        const column = header.dataset.sort;
        if (currentSort.column === column) {
          currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.column = column;
          currentSort.direction = 'asc';
        }
        renderAnimeTable(animeData, currentSort);
      }
    });
  }
  
  // AI Insights Tab
  if (geminiButton) {
    geminiButton.addEventListener('click', () => 
      getGeminiRecommendations(lastStats, GEMINI_API_KEY)
    );
  }

// Gacha Tab
  if (gachaRollButton) {
    // Load gacha manifests first
    loadGachaData(); 

    gachaRollButton.addEventListener('click', () => {
        // 1. Roll for the card.
        const result = rollGacha(); // No parameter needed

        if (result.status === 'error') {
            console.error(result.message);
            return; // Don't do anything if the roll failed
        }

        // 2. Display the result card/message
        displayGachaResult(result);

        // 3. Update the global state based on the result
        if (result.status === 'new') {
            window.waifuCollection.push(result.card);
        } else if (result.status === 'duplicate') {
            window.gachaShards += result.shardsAwarded;
        }

        // 4. Recalculate tokens (rollGacha increments totalPulls)
        updateGachaTokens(window.episodesWatchedTotal, window.totalPulls);

        // 5. Save and re-render
        saveDataToLocalStorage(animeData); // Save the new gacha state
        renderGachaState(); // Re-render the gacha UI
    });
  }

  // Global Modal Closing
  if (similarModalClose) {
    similarModalClose.addEventListener('click', () => {
      document.getElementById('similar-modal-backdrop').classList.remove('show');
    });
  }
  if (cosmeticModalClose) {
    cosmeticModalClose.addEventListener('click', () => {
      document.getElementById('cosmetic-modal-backdrop').classList.remove('show');
    });
  }
  document.addEventListener('click', (e) => {
    if (e.target.id === 'similar-modal-backdrop' || 
        e.target.id === 'cosmetic-modal-backdrop' || 
        e.target.id === 'settings-modal-backdrop') {
      e.target.classList.remove('show');
    }
  });

  // Event delegation for dynamically created buttons
  document.body.addEventListener('click', (e) => {
    // Watching Tab: "+1 Episode" button
    if (e.target.classList.contains('add-episode-btn')) {
      const title = e.target.dataset.title;
      animeData = incrementEpisode(title, animeData);
      lastStats = calculateStatistics(animeData);
      updateGachaTokens(lastStats.totalEpisodes, window.totalPulls);
      saveDataToLocalStorage(animeData);
      renderStats(lastStats);
      renderWatchingTab(animeData, (title) => {
          // Re-pass the callback
          animeData = incrementEpisode(title, animeData);
          lastStats = calculateStatistics(animeData);
          updateGachaTokens(lastStats.totalEpisodes, window.totalPulls);
          saveDataToLocalStorage(animeData);
          renderStats(lastStats);
          renderAnimeTable(animeData, currentSort);
      });
      renderAnimeTable(animeData, currentSort);
    }
    
    // List Tab: "Find Similar" button
    if (e.target.classList.contains('similar-btn')) {
        const title = e.target.dataset.title;
        const anime = animeData.find(a => a.title === title);
        if (anime) {
            getSimilarAnime(anime, GEMINI_API_KEY);
        }
    }
  });
});