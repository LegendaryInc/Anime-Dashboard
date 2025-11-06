// =====================================================================
// --- MAIN APPLICATION SCRIPT (main.js) - AniList Only ---
// =====================================================================

// CSS is loaded via <link> tag in index.html (no bundler needed)

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
  renderAnimeGrid,
  populateFilters,
  incrementEpisode,
  updateAnimeScore,
  updateAnimeStatus,
} from './ui.js';

// ⭐ Import enhanced list module
import { 
  initListTab, 
  triggerFilterUpdate,
  clearAllFilters,
  populateAdvancedFilters
} from './list.js';

// ⭐ MODIFIED: Removed duplicate import
import { renderEnhancedWatchingTab, initAiringSchedule, exportToCalendar } from './airing.js';
import { loadTheme, setTheme, previewTheme, removeThemePreview } from './themes.js';
import { saveDataToLocalStorage, checkForSavedData } from './storage.js';
import { calculateStatistics, downloadEnrichedJSON } from './data.js';
import { renderCharts } from './charts.js';
// ⭐ MODIFIED: Added generatePersonalInsights
import { getSimilarAnime, getGeminiRecommendations, generatePersonalInsights } from './ai.js';
import { fetchSeasonalAnime, initCalendar } from './calendar.js';
// Gacha system removed - backed up to gacha-backup/
// ⭐ MODIFIED: Removed duplicate import
// import {
//   renderEnhancedWatchingTab, initAiringSchedule, exportToCalendar
// } from './airing.js';
import { 
	openAnimeDetailsModal, closeAnimeDetailsModal, initAnimeDetailsModal 
	} from './anime-modal.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { initLazyLoading, observeNewImages } from './lazy-loading.js';

// --- 2. State Variables ---
let GEMINI_API_KEY = window.CONFIG.GEMINI_API_KEY || '';
let ITEMS_PER_PAGE = window.CONFIG.EPISODES_PER_PAGE || 25;

let seasonalAnimeData = null;
let animeData = [];
window.animeData = []; // ⭐ Make available globally for list.js
let genreChartInstance, scoreChartInstance;
let lastStats = null;

window.episodesWatchedTotal = 0;

let insightsInitialized = false; // ⭐ NEW: Insights tab tracker


// --- 3. Core Application Flow ---
// Gacha system removed - backed up to gacha-backup/

/**
 * Fetches data from the backend /api/get-anilist-data endpoint.
 */
async function syncWithAnilist() {
  const loginScreen = document.getElementById('login-screen');
  const welcomeScreen = document.getElementById('welcome-back-screen');
  const errorMessageElement = document.getElementById('error-message');
  const dashboardScreen = document.getElementById('dashboard-screen');

  showLoading(true, 'Syncing with AniList...');
  if (welcomeScreen) welcomeScreen.classList.add('hidden');
  if (errorMessageElement) showError(errorMessageElement, null);

  try {
    const response = await fetch('/api/get-anilist-data');

    if (response.status === 401) {
      localStorage.removeItem('animeDashboardData');
      animeData = [];
      window.animeData = []; // ⭐ Update global ref

      showLoading(false);
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');

      const loginBox = document.getElementById('login-box');
      if(loginBox) loginBox.classList.remove('hidden');

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
    // Gacha system removed
    await processAndRenderDashboard(animeData); // ⭐ ADDED await

  } catch (err) {
    console.error("Sync Error:", err);
    showError(errorMessageElement, `Sync failed: ${err.message}. Please try logging in again.`);
    showLoading(false);

    if (!localStorage.getItem('animeDashboardData')) {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (dashboardScreen) dashboardScreen.classList.add('hidden');
        const loginBox = document.getElementById('login-box');
        if(loginBox) loginBox.classList.remove('hidden');
    }
  }
}

/**
 * Logs the user out by clearing session and local data.
 */
async function logout() {
  try {
    await fetch('/auth/logout');
  } catch (error) {
    console.error("Failed to communicate with logout endpoint:", error);
  } finally {
    localStorage.removeItem('animeDashboardData');
    animeData = [];
    window.animeData = []; // ⭐ Update global ref
    lastStats = null;
    seasonalAnimeData = null;
    window.location.href = '/';
  }
}

/**
 * Main callback function after data is loaded.
 */
// ⭐ MODIFIED: Added async
async function processAndRenderDashboard(data) {
    console.log('🎨 processAndRenderDashboard called with', data.length, 'anime');
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const welcomeScreen = document.getElementById('welcome-back-screen');

    if (!Array.isArray(data)) {
        console.error("❌ Invalid data provided:", data);
        showError(document.getElementById('error-message'), "Failed to process data.");
        logout();
        return;
    }

    console.log('📊 Hiding login and welcome screens...');
    if (loginScreen) {
        loginScreen.classList.add('hidden');
        console.log('✅ Login screen hidden');
    } else {
        console.warn('⚠️ login-screen element not found');
    }
    if (welcomeScreen) {
        welcomeScreen.classList.add('hidden');
        console.log('✅ Welcome screen hidden');
    } else {
        console.warn('⚠️ welcome-back-screen element not found');
    }
    
    console.log('📊 Showing dashboard screen...');

    // ⭐ Make data globally available
    window.animeData = data;

    // ⭐ UPDATED: Populate both basic and advanced filters
    populateFilters(data);
    populateAdvancedFilters(data);
    
    lastStats = calculateStatistics(data);
    renderStats(lastStats);

    // ⭐ NEW: Update insights if tab has been initialized
    if (insightsInitialized) {
      updateInsightsData(lastStats);
    }

    const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
    genreChartInstance = chartInstances.genreChartInstance;
    scoreChartInstance = chartInstances.scoreChartInstance;

    // ⭐ Let list.js handle initial render
    triggerFilterUpdate();
    
    // ⭐ MODIFIED: Added await
    await renderEnhancedWatchingTab(data);

    // Gacha system removed

    setActiveTab('watching');
    if (document.getElementById('gemini-response')) {
        document.getElementById('gemini-response').innerHTML = '';
    }
    showLoading(false);
    
    console.log('📺 Removing hidden class from dashboard screen...');
    if (dashboardScreen) {
        dashboardScreen.classList.remove('hidden');
        console.log('✅ Dashboard screen should now be visible');
    } else {
        console.error('❌ dashboard-screen element not found!');
    }
    
    setTimeout(() => {
        if (dashboardScreen) dashboardScreen.classList.add('loaded');
    }, 10);
    
    console.log('✅ Dashboard rendering complete');
}

// =====================================================================
// ⭐ NEW: INSIGHTS TAB INTEGRATION
// =====================================================================

// Global variable to track current category
let currentInsightsCategory = 'personalized';

/**
 * Initialize Insights tab functionality
 */
export function initializeInsightsTab(stats) {
  // Generate personal insights on load
  generatePersonalInsights(stats);

  // Category tab listeners
  const tabButtons = document.querySelectorAll('.insights-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Get category and fetch recommendations
      currentInsightsCategory = btn.dataset.category;
      fetchRecommendations(currentInsightsCategory, stats);
    });
  });

  // Refresh button listener
  const refreshBtn = document.getElementById('insights-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchRecommendations(currentInsightsCategory, stats);
    });
  }

  // Make refresh function globally accessible
  window.refreshInsights = () => {
    fetchRecommendations(currentInsightsCategory, stats);
  };
}

/**
 * Fetch recommendations for a given category
 */
async function fetchRecommendations(category, stats) {
  // ⭐ Use module-level API key
  const apiKey = GEMINI_API_KEY; 
  
  if (!apiKey) {
    const contentContainer = document.getElementById('insights-content');
    if (contentContainer) {
      contentContainer.innerHTML = `
        <div class="insights-error">
          <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p class="error-title">API Key Required</p>
          <p class="error-message">Please add your Gemini API key in settings to use AI recommendations</p>
          <button class="btn-primary" onclick="document.getElementById('settings-button').click()">
            Open Settings
          </button>
        </div>
      `;
    }
    return;
  }

  await getGeminiRecommendations(stats, apiKey, category);
}

/**
 * Update insights when data changes
 */
export function updateInsightsData(stats) {
  generatePersonalInsights(stats);
}


// --- 4. Event Listeners ---

document.addEventListener('DOMContentLoaded', async () => {
  // --- Get Elements ---
  const settingsButton = document.getElementById('settings-button');
  const viewDashboardBtn = document.getElementById('view-dashboard-btn');
  const resyncBtn = document.getElementById('resync-btn');
  const logoutBtn = document.getElementById('logout-button');
  const downloadJsonBtn = document.getElementById('download-json-btn');
  const exportCalendarBtn = document.getElementById('export-calendar-btn');
  const tabNav = document.getElementById('tab-nav');
  const themeSwitcher = document.getElementById('theme-switcher');
  const settingsSaveButton = document.getElementById('settings-save');
  const settingsCancelButton = document.getElementById('settings-cancel');
  const similarModalClose = document.getElementById('similar-modal-close');
  // ⭐ REMOVED: const geminiButton = document.getElementById('gemini-button');
  // Gacha buttons removed
  const cosmeticModalClose = document.getElementById('cosmetic-modal-close');
  const loginScreen = document.getElementById('login-screen');
  const welcomeScreen = document.getElementById('welcome-back-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');

  // --- Initial Setup ---
  applyConfigToUI();
  loadTheme();
  initAiringSchedule();
  initCalendar();
  initAnimeDetailsModal();
  initKeyboardShortcuts(); // ⭐ NEW: Initialize keyboard shortcuts
  initLazyLoading(); // ⭐ NEW: Initialize lazy loading
  
  // ⭐ NEW: Initialize enhanced list tab
  initListTab();

  // =====================================================================
  // ⭐ UPDATED: Auth Flow - Check server status first
  // =====================================================================
  try {
    const statusResponse = await fetch('/auth/status');
    if (!statusResponse.ok) throw new Error('Auth status check failed');
    const authStatus = await statusResponse.json();

    if (authStatus.loggedIn) {
      const loadedData = checkForSavedData();
      animeData = loadedData.animeData;
      window.animeData = loadedData.animeData; // ⭐ Update global ref

      if (animeData && animeData.length > 0) {
        if (loginScreen) loginScreen.classList.add('hidden');
        if (dashboardScreen) dashboardScreen.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (resyncBtn) resyncBtn.textContent = `🔄 Re-sync with AniList`;
      } else {
        if (loginScreen) loginScreen.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        syncWithAnilist();
      }
    } else {
      localStorage.removeItem('animeDashboardData');
      animeData = [];
      window.animeData = []; // ⭐ Update global ref
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');
      showLoading(false);
      const loginBox = document.getElementById('login-box');
      const loadingSpinner = document.getElementById('loading-spinner');
      if(loginBox) loginBox.classList.remove('hidden');
      if(loadingSpinner) loadingSpinner.classList.add('hidden');
    }
  } catch (err) {
      console.error("Initial Auth Check Error:", err);
      showError(document.getElementById('error-message'), `Failed to check login status: ${err.message}. Please refresh.`);
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');
      showLoading(false);
      const loginBox = document.getElementById('login-box');
      const loadingSpinner = document.getElementById('loading-spinner');
      if(loginBox) loginBox.classList.remove('hidden');
      if(loadingSpinner) loadingSpinner.classList.add('hidden');
  }

  // --- Attach Listeners ---

  // ⭐ MODIFIED: Added async
  document.addEventListener('animeAdded', async (e) => {
    const newEntry = e.detail;
    if (newEntry && newEntry.id && !animeData.find(a => a.id === newEntry.id)) {
      console.log('Adding new anime to local state:', newEntry.title);
      animeData.push(newEntry);
      window.animeData = animeData; // ⭐ Update global reference
      lastStats = calculateStatistics(animeData);
      
      // ⭐ NEW: Update insights
      if (insightsInitialized) {
        updateInsightsData(lastStats);
      }
      
      saveDataToLocalStorage(animeData);
      renderStats(lastStats);
      
      // ⭐ UPDATED: Populate both filter systems
      populateFilters(animeData);
      populateAdvancedFilters(animeData);
      triggerFilterUpdate(); // ⭐ Use list.js function
      
      // ⭐ MODIFIED: Added await
      await renderEnhancedWatchingTab(animeData);
    }
  });

  // Main Auth/Data Buttons
  if (viewDashboardBtn) {
    viewDashboardBtn.addEventListener('click', async () => {
      console.log('🖱️ View Dashboard button clicked');
      const storedData = localStorage.getItem('animeDashboardData');
      if (storedData) {
        try {
            console.log('📦 Loading saved data from localStorage...');
            animeData = JSON.parse(storedData);
            window.animeData = animeData; // ⭐ Update global ref
            console.log(`✅ Loaded ${animeData.length} anime from localStorage`);
            
            if (welcomeScreen) welcomeScreen.classList.add('hidden');
            if (loginScreen) loginScreen.classList.add('hidden');
            
            // Gacha system removed
            await processAndRenderDashboard(animeData); // ⭐ ADDED await
            console.log('✅ Dashboard rendered successfully');
        } catch (error) {
            console.error("❌ Failed to parse local data:", error);
            showToast("Failed to load saved data. Please re-sync.", "error");
            syncWithAnilist();
        }
      } else {
        console.log('📦 No saved data found, syncing with AniList...');
        syncWithAnilist();
      }
    });
  }

  if (resyncBtn) resyncBtn.addEventListener('click', syncWithAnilist);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', () => downloadEnrichedJSON(animeData));
  }
  if (exportCalendarBtn) {
      exportCalendarBtn.addEventListener('click', () => exportToCalendar(animeData));
  }

  if (tabNav) {
    tabNav.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        const tab = e.target.dataset.tab;
        setActiveTab(tab);

        // ⭐ NEW: Initialize insights tab on first view
        if (tab === 'insights' && !insightsInitialized) {
          initializeInsightsTab(lastStats); // Use globally available stats
          insightsInitialized = true;
        }

        if (tab === 'calendar' && !seasonalAnimeData) {
          seasonalAnimeData = await fetchSeasonalAnime();
        }
        // Gacha tab removed
      }
    });
  }
  if (themeSwitcher) {
      // Click handler for theme switching
      themeSwitcher.addEventListener('click', (e) => {
          if (e.target.tagName === 'BUTTON') {
              const newTheme = e.target.dataset.theme;
              setTheme(newTheme);
              if (lastStats && genreChartInstance && scoreChartInstance) {
                  const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
                  genreChartInstance = chartInstances.genreChartInstance;
                  scoreChartInstance = chartInstances.scoreChartInstance;
              }
          }
      });

      // Hover handlers for theme preview
      themeSwitcher.addEventListener('mouseover', (e) => {
          if (e.target.tagName === 'BUTTON' && e.target.dataset.theme) {
              const theme = e.target.dataset.theme;
              // Only preview if not already active
              if (!e.target.classList.contains('active')) {
                  previewTheme(theme);
              }
          }
      }, true);

      themeSwitcher.addEventListener('mouseout', (e) => {
          if (e.target.tagName === 'BUTTON') {
              removeThemePreview();
          }
      }, true);
  }
  if (settingsButton) settingsButton.addEventListener('click', showSettingsModal);
  if (settingsSaveButton) {
      settingsSaveButton.addEventListener('click', () => {
          const { CONFIG, GEMINI_API_KEY: newApiKey, ITEMS_PER_PAGE: newItemsPerPage } = saveAndGenerateConfigFile();
          window.CONFIG = CONFIG;
          GEMINI_API_KEY = newApiKey;
          ITEMS_PER_PAGE = newItemsPerPage;
          applyConfigToUI();
          if (lastStats && genreChartInstance && scoreChartInstance) {
               const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
               genreChartInstance = chartInstances.genreChartInstance;
               scoreChartInstance = chartInstances.scoreChartInstance;
          }
           showToast("Settings saved and config.js generated!", "success");
           document.getElementById('settings-modal-backdrop').classList.remove('show');
      });
  }
  if (settingsCancelButton) {
       settingsCancelButton.addEventListener('click', () => {
           document.getElementById('settings-modal-backdrop').classList.remove('show');
       });
  }

   // ⭐ REMOVED: Old AI Insights Tab button
   /*
   if (geminiButton) {
       geminiButton.addEventListener('click', () => getGeminiRecommendations(lastStats, GEMINI_API_KEY));
   }
   */

   // Gacha Tab - removed (backed up to gacha-backup/)

   // Global Modal Closing
   if (similarModalClose) similarModalClose.addEventListener('click', () => document.getElementById('similar-modal-backdrop').classList.remove('show'));
   if (cosmeticModalClose) cosmeticModalClose.addEventListener('click', () => document.getElementById('cosmetic-modal-backdrop').classList.remove('show'));
   
   // Card Details Modal
   const cardDetailsModalClose = document.getElementById('card-details-modal-close');
   const cardDetailsModalBackdrop = document.getElementById('card-details-modal-backdrop');
   if (cardDetailsModalClose) {
     cardDetailsModalClose.addEventListener('click', () => {
       if (cardDetailsModalBackdrop) {
         cardDetailsModalBackdrop.classList.remove('show');
       }
     });
   }
   if (cardDetailsModalBackdrop) {
     cardDetailsModalBackdrop.addEventListener('click', (e) => {
       if (e.target === cardDetailsModalBackdrop) {
         cardDetailsModalBackdrop.classList.remove('show');
       }
     });
   }

   document.addEventListener('click', (e) => {
       if (e.target.matches('.modal-backdrop')) {
           e.target.classList.remove('show');
       }
   });

  // Event delegation for dynamically created buttons
  document.body.addEventListener('click', async (e) => {

    // =================================================================
    // MODAL OPEN HANDLERS
    // =================================================================

    // Grid card click - open details modal
    if (e.target.closest('.grid-card')) {
      const card = e.target.closest('.grid-card');
      
      // Don't open modal if clicking on interactive elements
      if (
        e.target.closest('.grid-card-actions') ||
        e.target.closest('.score-editor-container') ||
        e.target.closest('.status-editor-container') ||
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('select')
      ) {
        return;
      }
      
      const animeId = parseInt(card.dataset.animeId);
      const anime = animeData.find(a => a.id === animeId);
      if (anime) {
        openAnimeDetailsModal(anime);
      }
      return; // Stop propagation
    }

    // Table row click - open details modal
    if (e.target.closest('#anime-table tbody tr')) {
      const row = e.target.closest('tr');
      
      // Don't open modal if clicking on interactive elements
      if (
        e.target.closest('.add-episode-btn') ||
        e.target.closest('.similar-btn') ||
        e.target.closest('.score-editor-container') ||
        e.target.closest('.status-editor-container') ||
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('select')
      ) {
        return;
      }
      
      const titleElement = row.querySelector('.main-title');
      if (!titleElement) return;
      
      const animeTitle = titleElement.textContent.trim();
      const anime = animeData.find(a => a.title === animeTitle);
      if (anime) {
        openAnimeDetailsModal(anime);
      }
      return; // Stop propagation
    }

    // =================================================================
    // MODAL INTERNAL HANDLERS
    // =================================================================

    // Episode +1 button inside modal
    if (e.target.id === 'anime-details-add-episode') {
      const button = e.target;
      const animeId = parseInt(button.dataset.animeId);
      const title = button.dataset.title;
      const watched = parseInt(button.dataset.watched) || 0;
      const total = parseInt(button.dataset.total) || 0;
      
      const anime = animeData.find(a => a.id === animeId);
      if (!anime) return;
      
      if (total > 0 && watched >= total) {
        showToast(`Cannot exceed total episodes (${total})`, 'error');
        return;
      }
      
      const newProgress = watched + 1;
      button.disabled = true;
      button.textContent = '...';
      
      try {
        const response = await fetch('/api/anilist/update-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: animeId, progress: newProgress })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update');
        
        showToast(`Updated '${title}' to Ep ${newProgress}!`, 'success');
        
        // Update local data
        animeData = incrementEpisode(title, animeData);
        lastStats = calculateStatistics(animeData);
        
        // ⭐ NEW: Update insights
        if (insightsInitialized) {
          updateInsightsData(lastStats);
        }
        
        // Update modal display
        document.getElementById('anime-details-progress').textContent = `${newProgress}/${total}`;
        button.dataset.watched = newProgress;
        
        // Check if completed
        if (total > 0 && newProgress >= total) {
          button.disabled = true;
        }
        
        // Gacha system removed
        
        saveDataToLocalStorage(animeData);
        renderStats(lastStats);
        window.animeData = animeData; // ⭐ Update global ref
        triggerFilterUpdate(); // ⭐ Refresh list view
        
        // ⭐ MODIFIED: Added await
        await renderEnhancedWatchingTab(animeData);
        
      } catch (error) {
        console.error('Failed to update progress:', error);
        showToast(`Error: ${error.message}`, 'error');
      } finally {
        if (total === 0 || newProgress < total) {
          button.disabled = false;
          button.textContent = '+1';
        }
      }
    }

    // Watching Tab & List Tab: "+1 Episode" button with validation
    if (e.target.classList.contains('add-episode-btn')) {
      const button = e.target;
      const title = button.dataset.title;
      const watched = parseInt(button.dataset.watched) || 0;
      const total = parseInt(button.dataset.total) || 0;
      const anime = animeData.find(a => a.title === title);

      if (!anime || !anime.id) {
        showToast('Error: Cannot update progress. Anime data missing or invalid.', 'error');
        return;
      }

      // Validate against total episodes
      if (total > 0 && watched >= total) {
        showToast(`Cannot exceed total episodes (${total})`, 'error');
        return;
      }

      const newProgress = (anime.episodesWatched || 0) + 1;
      button.disabled = true;
      button.textContent = '...';

      try {
        const response = await fetch('/api/anilist/update-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: anime.id, progress: newProgress })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update');

        showToast(`Updated '${title}' to Ep ${newProgress} on AniList!`, 'success');
        animeData = incrementEpisode(title, animeData);
        lastStats = calculateStatistics(animeData);

        // ⭐ NEW: Update insights
        if (insightsInitialized) {
          updateInsightsData(lastStats);
        }

        // Check if completed
        if (anime.totalEpisodes && newProgress >= anime.totalEpisodes) {
          // Auto-complete with confirmation toast
          setTimeout(async () => {
            const confirmed = await showConfirm(`You've finished '${title}'! Mark as completed?`);
            if (confirmed) {
              try {
                const statusResponse = await fetch('/api/anilist/update-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mediaId: anime.id, status: 'Completed' })
                });
                const statusResult = await statusResponse.json();
                if (!statusResponse.ok) throw new Error(statusResult.error || 'Failed to update status');

                showToast(`Marked '${title}' as Completed!`, 'success');
                animeData = updateAnimeStatus(anime.id, 'Completed', animeData);
                
                saveDataToLocalStorage(animeData);
                populateFilters(animeData);
                populateAdvancedFilters(animeData);
                window.animeData = animeData; // ⭐ Update global ref
                triggerFilterUpdate(); // ⭐ Refresh list view
                
                // ⭐ MODIFIED: Added await
                await renderEnhancedWatchingTab(animeData);
              } catch (statusError) {
                console.error('Failed to update status:', statusError);
                showToast(`Error marking as complete: ${statusError.message}`, 'error');
              }
            }
          }, 500);
        }

        // Gacha system removed

        saveDataToLocalStorage(animeData);
        renderStats(lastStats);
        
        // ⭐ MODIFIED: Added await
        await renderEnhancedWatchingTab(animeData);
        window.animeData = animeData; // ⭐ Update global ref
        triggerFilterUpdate(); // ⭐ Refresh list view

      } catch (error) {
        console.error('Failed to update progress:', error);
        showToast(`Error: ${error.message}`, 'error');
      } finally {
        button.disabled = false;
        button.textContent = '+1 Ep';
      }
    }

    // =====================================================================
    // SCORE EDITOR EVENT HANDLERS
    // =====================================================================

    // Open score editor
    if (e.target.classList.contains('score-edit-btn') || 
        (e.target.closest('.score-display') && !e.target.closest('.score-editor-container.loading'))) {
      const scoreDisplay = e.target.closest('.score-display');
      if (!scoreDisplay) return;
      
      const container = scoreDisplay.closest('.score-editor-container');
      const editor = container.querySelector('.score-editor');
      const input = editor.querySelector('.score-input');
      
      scoreDisplay.classList.add('hidden');
      editor.classList.remove('hidden');
      
      setTimeout(() => {
        input.focus();
        input.select();
      }, 10);
    }

    // Save score
    if (e.target.classList.contains('score-save-btn')) {
      const button = e.target;
      const editor = button.closest('.score-editor');
      const input = editor.querySelector('.score-input');
      const container = editor.closest('.score-editor-container');
      const animeId = parseInt(input.dataset.animeId);
      const animeTitle = input.dataset.animeTitle;
      const newScore = parseFloat(input.value);
      
      if (isNaN(newScore) || newScore < 0 || newScore > 10) {
        showToast('Score must be between 0 and 10', 'error');
        return;
      }
      
      const anime = animeData.find(a => a.id === animeId);
      if (anime && anime.score === newScore) {
        editor.classList.add('hidden');
        container.querySelector('.score-display').classList.remove('hidden');
        return;
      }
      
      button.disabled = true;
      container.classList.add('loading');
      
      try {
        const response = await fetch('/api/anilist/update-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: animeId, score: newScore })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update score');
        
        showToast(`Updated score for '${animeTitle}' to ${newScore}!`, 'success');
        animeData = updateAnimeScore(animeId, newScore, animeData);
        
        lastStats = calculateStatistics(animeData);
        renderStats(lastStats);
        
        // ⭐ NEW: Update insights
        if (insightsInitialized) {
          updateInsightsData(lastStats);
        }
        
        saveDataToLocalStorage(animeData);
        window.animeData = animeData; // ⭐ Update global ref
        triggerFilterUpdate(); // ⭐ Refresh list view
        
      } catch (error) {
        console.error('Failed to update score:', error);
        showToast(`Error: ${error.message}`, 'error');
        
        if (anime) {
          input.value = anime.score || 0;
        }
      } finally {
        button.disabled = false;
        container.classList.remove('loading');
      }
    }

    // Cancel score edit
    if (e.target.classList.contains('score-cancel-btn')) {
      const editor = e.target.closest('.score-editor');
      const container = editor.closest('.score-editor-container');
      const input = editor.querySelector('.score-input');
      const scoreDisplay = container.querySelector('.score-display');
      const animeId = parseInt(input.dataset.animeId);
      
      const anime = animeData.find(a => a.id === animeId);
      if (anime) {
        input.value = anime.score || 0;
      }
      
      editor.classList.add('hidden');
      scoreDisplay.classList.remove('hidden');
    }

    // =====================================================================
    // STATUS EDITOR EVENT HANDLERS
    // =====================================================================

    // Open status editor
    if (e.target.classList.contains('status-badge-clickable') || e.target.closest('.status-badge-clickable')) {
      const badge = e.target.closest('.status-badge-clickable');
      if (!badge) return;
      
      const container = badge.closest('.status-editor-container');
      const editor = container.querySelector('.status-editor');
      
      badge.classList.add('hidden');
      editor.classList.remove('hidden');
    }

    // Save status
    if (e.target.classList.contains('status-save-btn')) {
      const button = e.target;
      const editor = button.closest('.status-editor');
      const select = editor.querySelector('.status-select');
      const container = editor.closest('.status-editor-container');
      const animeId = parseInt(select.dataset.animeId);
      const animeTitle = select.dataset.animeTitle;
      const newStatus = select.value;
      
      const anime = animeData.find(a => a.id === animeId);
      if (anime && anime.status === newStatus) {
        editor.classList.add('hidden');
        container.querySelector('.status-badge-clickable').classList.remove('hidden');
        return;
      }
      
      button.disabled = true;
      container.classList.add('loading');
      
      try {
        const response = await fetch('/api/anilist/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: animeId, status: newStatus })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update status');
        
        showToast(`Updated status for '${animeTitle}' to ${newStatus}!`, 'success');
        animeData = updateAnimeStatus(animeId, newStatus, animeData);
        
        // Note: This action might change stats (e.g., avg score), so we recalculate
        lastStats = calculateStatistics(animeData);
        renderStats(lastStats);
        
        // ⭐ NEW: Update insights
        if (insightsInitialized) {
          updateInsightsData(lastStats);
        }
        
        saveDataToLocalStorage(animeData);
        populateFilters(animeData);
        populateAdvancedFilters(animeData);
        window.animeData = animeData; // ⭐ Update global ref
        triggerFilterUpdate(); // ⭐ Refresh list view
        
        // ⭐ MODIFIED: Added await
        await renderEnhancedWatchingTab(animeData);
        
      } catch (error) {
        console.error('Failed to update status:', error);
        showToast(`Error: ${error.message}`, 'error');
        
        if (anime) {
          select.value = anime.status;
        }
      } finally {
        button.disabled = false;
        container.classList.remove('loading');
      }
    }

    // Cancel status edit
    if (e.target.classList.contains('status-cancel-btn')) {
      const editor = e.target.closest('.status-editor');
      const container = editor.closest('.status-editor-container');
      const select = editor.querySelector('.status-select');
      const badge = container.querySelector('.status-badge-clickable');
      const animeId = parseInt(select.dataset.animeId);
      
      const anime = animeData.find(a => a.id === animeId);
      if (anime) {
        select.value = anime.status;
      }
      
      editor.classList.add('hidden');
      badge.classList.remove('hidden');
    }

    // List Tab: "Find Similar" button
    if (e.target.classList.contains('similar-btn')) {
      const title = e.target.dataset.title;
      const anime = animeData.find(a => a.title === title);
      if (anime) {
        getSimilarAnime(anime, GEMINI_API_KEY);
      }
    }

    // Cosmetic pack purchase buttons - removed (gacha system removed)

     // Calendar Tab: "Add to Planning" button
     if (e.target.classList.contains('add-to-planning-btn')) {
        const button = e.target;
        const malId = button.dataset.malId;
        const title = button.dataset.title;

        if (!malId) return;

        button.disabled = true;
        button.textContent = 'Adding...';

        try {
            const response = await fetch('/api/anilist/add-planning', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ malId, title })
            });
            const newEntry = await response.json();
            if (!response.ok) throw new Error(newEntry.error || 'Failed to add');

            showToast(`Added '${title}' to your planning list!`, 'success');
            button.textContent = 'Added ✓';
            button.classList.remove('btn-primary');
            button.classList.add('btn-secondary', 'cursor-not-allowed');

            document.dispatchEvent(new CustomEvent('animeAdded', { detail: newEntry }));

        } catch (error) {
            console.error('Failed to add to planning:', error);
            showToast(`Error: ${error.message}`, 'error');
            button.disabled = false;
            button.textContent = '+ Plan to Watch';
        }
    }

  });

  // Allow Enter key to save, Escape to cancel in score input
  document.body.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('score-input')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const saveBtn = e.target.closest('.score-editor').querySelector('.score-save-btn');
        saveBtn?.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const cancelBtn = e.target.closest('.score-editor').querySelector('.score-cancel-btn');
        cancelBtn?.click();
      }
    }
  });
});