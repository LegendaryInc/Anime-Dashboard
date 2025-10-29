// =====================================================================
// --- MAIN APPLICATION SCRIPT (main.js) - AniList Only ---
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
  renderAnimeGrid,
  populateFilters,
  incrementEpisode,
  updateAnimeScore,
  updateAnimeStatus,
} from './ui.js';

// ⭐ NEW: Import list module
import { 
  initListTab, 
  triggerFilterUpdate,
  clearAllFilters 
} from './list.js';

import { loadTheme, setTheme } from './themes.js';
import { saveDataToLocalStorage, checkForSavedData } from './storage.js';
import { calculateStatistics, downloadEnrichedJSON } from './data.js';
import { renderCharts } from './charts.js';
import { getSimilarAnime, getGeminiRecommendations } from './ai.js';
import { fetchSeasonalAnime, initCalendar } from './calendar.js';
import {
  rollGacha, renderGachaState, updateGachaTokens, displayGachaResult,
  loadGachaData, loadGachaState, buyCosmeticPack, openCosmeticModal, resetGachaCollection
} from './gacha.js';
import {
  renderEnhancedWatchingTab, initAiringSchedule, exportToCalendar
} from './airing.js';
import { 
	openAnimeDetailsModal, closeAnimeDetailsModal, initAnimeDetailsModal 
	} from './anime-modal.js';

// --- 2. State Variables ---
let GEMINI_API_KEY = window.CONFIG.GEMINI_API_KEY || '';
let ITEMS_PER_PAGE = window.CONFIG.EPISODES_PER_PAGE || 25;

let seasonalAnimeData = null;
let animeData = [];
window.animeData = []; // ⭐ Make available globally for list.js
let genreChartInstance, scoreChartInstance;
let lastStats = null;

// ⭐ REMOVED: currentSort (now handled in list.js)

window.episodesWatchedTotal = 0;

let isGachaInitialized = false;


// --- 3. Core Application Flow ---

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
      isGachaInitialized = false;

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
    await initializeGacha();
    processAndRenderDashboard(animeData);

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
        console.error("Invalid data provided:", data);
        showError(document.getElementById('error-message'), "Failed to process data.");
        logout();
        return;
    }

    if (loginScreen) loginScreen.classList.add('hidden');
    if (welcomeScreen) welcomeScreen.classList.add('hidden');

    // ⭐ Make data globally available
    window.animeData = data;

    populateFilters(data);
    lastStats = calculateStatistics(data);
    renderStats(lastStats);

    const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
    genreChartInstance = chartInstances.genreChartInstance;
    scoreChartInstance = chartInstances.scoreChartInstance;

    // ⭐ CHANGED: Let list.js handle initial render
    triggerFilterUpdate();
    
    renderEnhancedWatchingTab(data);

    if (isGachaInitialized) {
        loadGachaState().then(state => {
            updateGachaTokens(lastStats.totalEpisodes, state.totalPulls || 0);
            renderGachaState();
        }).catch(err => {
            console.warn("Could not update gacha tokens during render:", err);
            renderGachaState();
        });
    } else {
        initializeGacha();
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
  const exportCalendarBtn = document.getElementById('export-calendar-btn');
  const tabNav = document.getElementById('tab-nav');
  const themeSwitcher = document.getElementById('theme-switcher');
  // const animeTableHead = document.getElementById('anime-table-head'); // ⭐ No longer needed here
  const settingsSaveButton = document.getElementById('settings-save');
  const settingsCancelButton = document.getElementById('settings-cancel');
  const similarModalClose = document.getElementById('similar-modal-close');
  // const searchBar = document.getElementById('search-bar'); // ⭐ No longer needed here
  // const statusFilter = document.getElementById('status-filter'); // ⭐ No longer needed here
  // const genreFilter = document.getElementById('genre-filter'); // ⭐ No longer needed here
  const geminiButton = document.getElementById('gemini-button');
  const gachaRollButton = document.getElementById('gacha-roll-button');
  const cosmeticModalClose = document.getElementById('cosmetic-modal-close');
  const gachaResetButton = document.getElementById('gacha-reset-button');
  const loginScreen = document.getElementById('login-screen');
  const welcomeScreen = document.getElementById('welcome-back-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');

  // --- Initial Setup ---
  applyConfigToUI();
  loadTheme();
  initAiringSchedule();
  initCalendar();
  initAnimeDetailsModal();
  
  // ⭐ NEW: Initialize list tab
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
      isGachaInitialized = false;
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

  document.addEventListener('animeAdded', (e) => {
    const newEntry = e.detail;
    if (newEntry && newEntry.id && !animeData.find(a => a.id === newEntry.id)) {
      console.log('Adding new anime to local state:', newEntry.title);
      animeData.push(newEntry);
      window.animeData = animeData; // ⭐ Update global reference
      lastStats = calculateStatistics(animeData);
      saveDataToLocalStorage(animeData);
      renderStats(lastStats);
      populateFilters(animeData);
      triggerFilterUpdate(); // ⭐ Use list.js function
      renderEnhancedWatchingTab(animeData);
    }
  });

  // Main Auth/Data Buttons
  if (viewDashboardBtn) {
    viewDashboardBtn.addEventListener('click', async () => {
      const storedData = localStorage.getItem('animeDashboardData');
      if (storedData) {
        try {
            animeData = JSON.parse(storedData);
            window.animeData = animeData; // ⭐ Update global ref
            document.getElementById('welcome-back-screen').classList.add('hidden');
            await initializeGacha();
            processAndRenderDashboard(animeData);
        } catch (error) {
            console.error("Failed to parse local data:", error);
            showToast("Failed to load saved data. Please re-sync.", "error");
            syncWithAnilist();
        }
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
  if (exportCalendarBtn) {
      exportCalendarBtn.addEventListener('click', () => exportToCalendar(animeData));
  }

  // =====================================================================
  // ⭐ REMOVED: View Toggle Listeners (now in list.js)
  // =====================================================================

  if (tabNav) {
    tabNav.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        const tab = e.target.dataset.tab;
        setActiveTab(tab);

        if (tab === 'calendar' && !seasonalAnimeData) {
          seasonalAnimeData = await fetchSeasonalAnime();
        }
        if (tab === 'gacha' && !isGachaInitialized) {
          await initializeGacha();
        }
      }
    });
  }
  if (themeSwitcher) {
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

  // =====================================================================
  // ⭐ REMOVED: List Tab Filtering and Sorting (now in list.js)
  // =====================================================================

   // AI Insights Tab
   if (geminiButton) {
       geminiButton.addEventListener('click', () => getGeminiRecommendations(lastStats, GEMINI_API_KEY));
   }

   // Gacha Tab
   if (gachaRollButton) {
       gachaRollButton.addEventListener('click', async () => {
           const button = gachaRollButton;
           button.disabled = true;

           try {
               const result = await rollGacha();

               if (result.status === 'error') {
                   showToast(`Gacha roll failed: ${result.message}`, 'error');
                   console.error('Roll failed:', result.message);
                   button.disabled = window.gachaTokens < 1;
                   return;
               }

               displayGachaResult(result);

               try {
                   await loadGachaState();
                   renderGachaState();
               } catch (loadError) {
                    showToast('Failed to update gacha state after roll.', 'error');
               }

           } catch (error) {
               console.error('❌ Gacha roll UI error:', error);
               showToast(`An error occurred during the roll: ${error.message}`, 'error');
           } finally {
                button.disabled = window.gachaTokens < 1;
           }
       });
   }

  // Gacha Reset Button
  if (gachaResetButton) {
   gachaResetButton.addEventListener('click', async () => {
     const success = await resetGachaCollection();
     if (success) {
       try {
           await loadGachaState();
           renderGachaState();
       } catch(error){
           showToast('Failed to reload gacha state after reset.', 'error');
       }
     }
   });
 }

   // Global Modal Closing
   if (similarModalClose) similarModalClose.addEventListener('click', () => document.getElementById('similar-modal-backdrop').classList.remove('show'));
   if (cosmeticModalClose) cosmeticModalClose.addEventListener('click', () => document.getElementById('cosmetic-modal-backdrop').classList.remove('show'));

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
        
        // Update modal display
        document.getElementById('anime-details-progress').textContent = `${newProgress}/${total}`;
        button.dataset.watched = newProgress;
        
        // Check if completed
        if (total > 0 && newProgress >= total) {
          button.disabled = true;
        }
        
        // Update gacha tokens
        if (isGachaInitialized) {
          const currentState = await loadGachaState();
          await updateGachaTokens(lastStats.totalEpisodes, currentState?.totalPulls || 0);
          renderGachaState();
        }
        
        saveDataToLocalStorage(animeData);
        renderStats(lastStats);
        window.animeData = animeData; // ⭐ Update global ref
        triggerFilterUpdate(); // ⭐ Refresh list view
        renderEnhancedWatchingTab(animeData);
        
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
                window.animeData = animeData; // ⭐ Update global ref
                triggerFilterUpdate(); // ⭐ Refresh list view
                renderEnhancedWatchingTab(animeData);
              } catch (statusError) {
                console.error('Failed to update status:', statusError);
                showToast(`Error marking as complete: ${statusError.message}`, 'error');
              }
            }
          }, 500);
        }

        if (isGachaInitialized) {
            try {
                const currentState = await loadGachaState();
                await updateGachaTokens(lastStats.totalEpisodes, currentState?.totalPulls || 0);
                renderGachaState();
            } catch (gachaError){
                 console.warn("Failed to update gacha tokens after progress update:", gachaError);
            }
        }

        saveDataToLocalStorage(animeData);
        renderStats(lastStats);
        renderEnhancedWatchingTab(animeData);
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
        
        saveDataToLocalStorage(animeData);
        populateFilters(animeData);
        window.animeData = animeData; // ⭐ Update global ref
        triggerFilterUpdate(); // ⭐ Refresh list view
        renderEnhancedWatchingTab(animeData);
        
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

    // Cosmetic pack purchase buttons
    if (e.target.classList.contains('buy-pack-btn')) {
      const packId = e.target.dataset.packId;
      const wonItem = await buyCosmeticPack(packId);
      if (wonItem) {
        try {
            await loadGachaState();
            renderGachaState();
        } catch(loadError) {
             showToast('Failed to update gacha state after purchase.', 'error');
        }
      }
    }

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