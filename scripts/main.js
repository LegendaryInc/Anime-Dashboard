// =====================================================================
// --- MAIN APPLICATION SCRIPT (main.js) - UPDATED FOR BACKEND GACHA ---
// =====================================================================

// --- 1. Module Imports ---
import { 
  showToast, 
  showConfirm 
} from './toast.js';
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

// ðŸ†• UPDATED: Import backend-enabled gacha functions
import {
  rollGacha,
  renderGachaState,
  updateGachaTokens,
  displayGachaResult,
  loadGachaData,
  loadGachaState,      // ðŸ†• ADD: Load state from backend
  buyCosmeticPack,     // ðŸ†• ADD: For cosmetic pack purchases
  openCosmeticModal,   // ðŸ†• ADD: For cosmetic customization
  resetGachaCollection // ðŸ†• ADD: For reset functionality
} from './gacha.js';


// --- 2. State Variables ---
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

// ðŸ†• ADD: Track if gacha is initialized
let isGachaInitialized = false;


// --- 3. Core Application Flow ---

/**
 * ðŸ†• NEW: Initialize gacha system from backend
 */
async function initializeGacha() {
  if (isGachaInitialized) return;
  
  try {
    showLoading(true, 'Loading your gacha collection...');
    
    // Load manifest files
    await loadGachaData();
    
    // Load state from backend
    await loadGachaState();
    
    // Render the UI
    renderGachaState();
    
    isGachaInitialized = true;
    console.log('âœ… Gacha system initialized from backend');
    
  } catch (error) {
    console.error('âŒ Failed to initialize gacha:', error);
    const gachaResultDisplay = document.getElementById('gacha-result-display');
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `
        <p class="text-red-500 font-semibold">
          Failed to load gacha data: ${error.message}
        </p>
        <p class="text-sm text-gray-600 mt-2">
          Please try logging out and back in.
        </p>
      `;
    }
  } finally {
    showLoading(false);
  }
}

/**
 * Fetches data from the backend /api/get-anilist-data endpoint.
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
      // Not authenticated, reset everything
      localStorage.removeItem('animeDashboardData');
      animeData = [];
      
      // ðŸ†• CHANGED: Don't initialize gacha state locally anymore
      // Backend handles initialization on first login
      isGachaInitialized = false;

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
    
    animeData = data;
    saveDataToLocalStorage(animeData);
    
    // ðŸ†• ADD: Initialize gacha after successful sync
    await initializeGacha();
    
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
    animeData = [];
    lastStats = null;
    seasonalAnimeData = null;
    
    // ðŸ†• CHANGED: Don't clear gacha state locally - backend handles it
    isGachaInitialized = false;

    // Redirect to home to force re-login
    window.location.href = '/';
  }
}

/**
 * Main callback function after data is loaded.
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

  if (loginScreen) loginScreen.classList.add('hidden');
  if (welcomeScreen) welcomeScreen.classList.add('hidden');

  populateFilters(data);
  lastStats = calculateStatistics(data);
  renderStats(lastStats);
  
  const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
  genreChartInstance = chartInstances.genreChartInstance;
  scoreChartInstance = chartInstances.scoreChartInstance;

  renderAnimeTable(data, currentSort);
  renderWatchingTab(data, async (title) => {
    animeData = incrementEpisode(title, animeData);
    lastStats = calculateStatistics(animeData);
    
    // ðŸ†• CHANGED: Made async to work with backend
    await updateGachaTokens(lastStats.totalEpisodes, window.totalPulls || 0);
    
    saveDataToLocalStorage(animeData);
    renderStats(lastStats);
    renderAnimeTable(animeData, currentSort);
  });

  // ðŸ†• CHANGED: Gacha setup is now handled by initializeGacha()
  // Just render the UI here
  if (isGachaInitialized) {
    renderGachaState();
  }

  setActiveTab('watching');
  if (document.getElementById('gemini-response')) {
    document.getElementById('gemini-response').innerHTML = '';
  }
  showLoading(false);
  if (dashboardScreen) dashboardScreen.classList.remove('hidden');
  setTimeout(() => {
    if (dashboardScreen) dashboardScreen.classList.add('loaded');
  }, 10);
}


// --- 4. Event Listeners ---

document.addEventListener('DOMContentLoaded', async () => {
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
  const gachaResetButton = document.getElementById('gacha-reset-button');
if (gachaResetButton) {
  gachaResetButton.addEventListener('click', async () => {
    const success = await resetGachaCollection();
    if (success) {
      // Optionally reload gacha state to ensure everything is fresh
      await loadGachaState();
      renderGachaState();
    }
  });
}

  // --- Initial Setup ---
  applyConfigToUI();
  loadTheme();
  
  // ðŸ†• CHANGED: Don't load gacha state from localStorage anymore
  const loadedData = checkForSavedData();
  animeData = loadedData.animeData;
  
  if (animeData.length > 0) {
    lastStats = calculateStatistics(animeData);
  }

  // --- Auth Flow ---
  if (animeData.length > 0) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('welcome-back-screen').classList.remove('hidden');
  } else {
    syncWithAnilist();
  }

  // --- Attach Listeners ---

  // Main Auth/Data Buttons
  if (viewDashboardBtn) {
    viewDashboardBtn.addEventListener('click', async () => {
      const storedData = localStorage.getItem('animeDashboardData');
      if (storedData) {
        animeData = JSON.parse(storedData);
        document.getElementById('welcome-back-screen').classList.add('hidden');
        
        // ðŸ†• ADD: Initialize gacha when returning
        await initializeGacha();
        
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
    tabNav.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        const tab = e.target.dataset.tab;
        setActiveTab(tab);
        
        if (tab === 'calendar' && !seasonalAnimeData) {
          fetchSeasonalAnime().then(data => {
            seasonalAnimeData = data;
          });
        }
        
        // ðŸ†• ADD: Initialize gacha when tab is opened
        if (tab === 'gacha' && !isGachaInitialized) {
          await initializeGacha();
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
      const newConfig = saveAndGenerateConfigFile();
      window.CONFIG = newConfig.CONFIG;
      GEMINI_API_KEY = newConfig.GEMINI_API_KEY;
      ITEMS_PER_PAGE = newConfig.ITEMS_PER_PAGE;
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

  // ðŸ†• UPDATED: Gacha Tab - Now async
  if (gachaRollButton) {
    gachaRollButton.addEventListener('click', async () => {
      const button = gachaRollButton;
      button.disabled = true; // Prevent double-clicks
      
      try {
        // 1. Roll for the card (now async!)
        const result = await rollGacha();

        if (result.status === 'error') {
          console.error('Roll failed:', result.message);
          return;
        }

        // 2. Display the result
        displayGachaResult(result);

        // 3. Re-render the UI (backend already updated state)
        renderGachaState();

        // 4. Update stats if needed
        if (lastStats) {
          await updateGachaTokens(lastStats.totalEpisodes, window.totalPulls || 0);
        }

      } catch (error) {
        console.error('âŒ Gacha roll error:', error);
        const gachaResultDisplay = document.getElementById('gacha-result-display');
        if (gachaResultDisplay) {
          gachaResultDisplay.innerHTML = `
            <p class="text-red-500 font-semibold">Roll failed: ${error.message}</p>
          `;
        }
      } finally {
        button.disabled = false;
      }
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
  document.body.addEventListener('click', async (e) => {
    // Watching Tab: "+1 Episode" button
    if (e.target.classList.contains('add-episode-btn')) {
      const title = e.target.dataset.title;
      animeData = incrementEpisode(title, animeData);
      lastStats = calculateStatistics(animeData);
      
      // ðŸ†• CHANGED: Made async
      await updateGachaTokens(lastStats.totalEpisodes, window.totalPulls || 0);
      
      saveDataToLocalStorage(animeData);
      renderStats(lastStats);
      renderWatchingTab(animeData, async (title) => {
        animeData = incrementEpisode(title, animeData);
        lastStats = calculateStatistics(animeData);
        await updateGachaTokens(lastStats.totalEpisodes, window.totalPulls || 0);
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
    
    // ðŸ†• ADD: Cosmetic pack purchase buttons
    if (e.target.classList.contains('buy-pack-btn')) {
      const packId = e.target.dataset.packId;
      const wonItem = await buyCosmeticPack(packId);
      if (wonItem) {
        renderGachaState(); // Update UI with new shard count
      }
    }
  });
});