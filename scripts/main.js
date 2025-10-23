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

// 🎰 UPDATED: Import backend-enabled gacha functions
import {
  rollGacha,
  renderGachaState,
  updateGachaTokens,
  displayGachaResult,
  loadGachaData,
  loadGachaState,
  buyCosmeticPack,
  openCosmeticModal,
  resetGachaCollection
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

// 🎰 ADD: Track if gacha is initialized
let isGachaInitialized = false;


// --- 3. Core Application Flow ---

/**
 * 🎰 NEW: Initialize gacha system from backend
 */
async function initializeGacha() {
  if (isGachaInitialized) return;
  
  try {
    showLoading(true, 'Loading your gacha collection...');
    
    await loadGachaData();
    await loadGachaState();
    renderGachaState();
    
    isGachaInitialized = true;
    console.log('✔️ Gacha system initialized from backend');
    
  } catch (error) {
    console.error('❌ Failed to initialize gacha:', error);
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
      localStorage.removeItem('animeDashboardData');
      animeData = [];
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
    localStorage.removeItem('animeDashboardData');
    animeData = [];
    lastStats = null;
    seasonalAnimeData = null;
    isGachaInitialized = false;
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
    await updateGachaTokens(lastStats.totalEpisodes, window.totalPulls || 0);
    saveDataToLocalStorage(animeData);
    renderStats(lastStats);
    renderAnimeTable(animeData, currentSort);
  });

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
        await loadGachaState();
        renderGachaState();
      }
    });
  }

  // --- Initial Setup ---
  applyConfigToUI();
  loadTheme();
  
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

  // Gacha Tab
  if (gachaRollButton) {
    gachaRollButton.addEventListener('click', async () => {
      const button = gachaRollButton;
      button.disabled = true;
      
      try {
        const result = await rollGacha();

        if (result.status === 'error') {
          console.error('Roll failed:', result.message);
          return;
        }

        displayGachaResult(result);
        renderGachaState();

        if (lastStats) {
          await updateGachaTokens(lastStats.totalEpisodes, window.totalPulls || 0);
        }

      } catch (error) {
        console.error('❌ Gacha roll error:', error);
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
    
    // Cosmetic pack purchase buttons
    if (e.target.classList.contains('buy-pack-btn')) {
      const packId = e.target.dataset.packId;
      const wonItem = await buyCosmeticPack(packId);
      if (wonItem) {
        renderGachaState();
      }
    }
  });
});