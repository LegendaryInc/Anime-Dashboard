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
  applyTableFiltersAndSort,
  populateFilters,
  incrementEpisode,
} from './ui.js';
// ... (other imports remain the same) ...
import { loadTheme, setTheme } from './themes.js';
import { saveDataToLocalStorage, checkForSavedData } from './storage.js';
import { calculateStatistics, downloadEnrichedJSON } from './data.js';
import { renderCharts } from './charts.js';
import { getSimilarAnime, getGeminiRecommendations } from './ai.js';
import { fetchSeasonalAnime, initCalendar } from './calendar.js'; // Added initCalendar here
import {
  rollGacha, renderGachaState, updateGachaTokens, displayGachaResult,
  loadGachaData, loadGachaState, buyCosmeticPack, openCosmeticModal, resetGachaCollection
} from './gacha.js';
import {
  renderEnhancedWatchingTab, initAiringSchedule, exportToCalendar
} from './airing.js';


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
window.episodesWatchedTotal = 0; // Assuming this is used elsewhere

let isGachaInitialized = false;
// Removed loggedInService


// --- 3. Core Application Flow ---

async function initializeGacha() {
  if (isGachaInitialized) return;
  // ... (initializeGacha function remains unchanged) ...
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
 * (Reverted from generic syncData)
 */
async function syncWithAnilist() {
  const loginScreen = document.getElementById('login-screen');
  const welcomeScreen = document.getElementById('welcome-back-screen');
  const errorMessageElement = document.getElementById('error-message');
  const dashboardScreen = document.getElementById('dashboard-screen'); // Get dashboard screen

  showLoading(true, 'Syncing with AniList...');
  if (welcomeScreen) welcomeScreen.classList.add('hidden');
  if (errorMessageElement) showError(errorMessageElement, null);

  try {
    const response = await fetch('/api/get-anilist-data');

    if (response.status === 401) {
      // If unauthorized, clear local data and show login
      localStorage.removeItem('animeDashboardData');
      animeData = [];
      isGachaInitialized = false; // Reset gacha state

      showLoading(false); // Hide loading spinner
      if (loginScreen) loginScreen.classList.remove('hidden'); // Show login
      if (welcomeScreen) welcomeScreen.classList.add('hidden'); // Hide welcome
      if (dashboardScreen) dashboardScreen.classList.add('hidden'); // Hide dashboard

      // Manually ensure login box is visible after 401
      const loginBox = document.getElementById('login-box');
      if(loginBox) loginBox.classList.remove('hidden');

      return; // Stop further processing
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
    await initializeGacha(); // Initialize Gacha after successful sync
    processAndRenderDashboard(animeData);
    // Removed configureUIForService call

  } catch (err) {
    console.error("Sync Error:", err);
    showError(errorMessageElement, `Sync failed: ${err.message}. Please try logging in again.`);
    showLoading(false); // Hide loading spinner

    // Decide whether to show login or keep dashboard based on local data
    if (!localStorage.getItem('animeDashboardData')) {
        // No local data, definitely show login
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        if (dashboardScreen) dashboardScreen.classList.add('hidden');
         // Manually ensure login box is visible
        const loginBox = document.getElementById('login-box');
        if(loginBox) loginBox.classList.remove('hidden');
    }
    // If there IS local data, the dashboard might still be visible from previous state
    // but the error message will be shown.
  }
}

// Removed checkLoginStatus function (logic moved to DOMContentLoaded)
// Removed configureUIForService function

/**
 * Logs the user out by clearing session and local data.
 */
async function logout() {
  try {
    // Call backend logout to destroy session
    await fetch('/auth/logout');
  } catch (error) {
    console.error("Failed to communicate with logout endpoint:", error);
  } finally {
    // Clear all local data and reload
    localStorage.removeItem('animeDashboardData');
    animeData = [];
    lastStats = null;
    seasonalAnimeData = null;
    isGachaInitialized = false;
    // Removed loggedInService = null;
    window.location.href = '/'; // Reload the page
  }
}

/**
 * Main callback function after data is loaded.
 */
function processAndRenderDashboard(data) {
    // ... (This function remains largely the same, just ensure it's called correctly) ...
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const welcomeScreen = document.getElementById('welcome-back-screen');

    if (!Array.isArray(data)) {
        console.error("Invalid data provided:", data);
        showError(document.getElementById('error-message'), "Failed to process data.");
        logout(); // Or handle error appropriately
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
    renderEnhancedWatchingTab(data); // Assuming this renders the 'watching' tab content

    if (isGachaInitialized) {
        // Update tokens potentially needed if stats changed significantly
        // Fetch latest gacha state to get totalPulls reliably
        loadGachaState().then(state => {
            updateGachaTokens(lastStats.totalEpisodes, state.totalPulls || 0);
            renderGachaState();
        }).catch(err => {
            console.warn("Could not update gacha tokens during render:", err);
            // Still render with potentially stale token count from initialization
            renderGachaState();
        });
    } else {
        // If gacha wasn't initialized yet (e.g., viewing dashboard from cache),
        // try initializing it now.
        initializeGacha();
    }


    setActiveTab('watching'); // Default to 'watching' tab
    if (document.getElementById('gemini-response')) {
        document.getElementById('gemini-response').innerHTML = ''; // Clear AI insights
    }
    showLoading(false); // Hide loading spinner
    if (dashboardScreen) dashboardScreen.classList.remove('hidden'); // Show dashboard
    setTimeout(() => {
        if (dashboardScreen) dashboardScreen.classList.add('loaded'); // For animations
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
  const loginScreen = document.getElementById('login-screen'); // Get login screen element
  const welcomeScreen = document.getElementById('welcome-back-screen'); // Get welcome screen
  const dashboardScreen = document.getElementById('dashboard-screen'); // Get dashboard screen

  // --- Initial Setup ---
  applyConfigToUI();
  loadTheme();
  initAiringSchedule();
  initCalendar();

  // =====================================================================
  // ⭐ UPDATED: Auth Flow - Check server status first
  // =====================================================================
  try {
    const statusResponse = await fetch('/auth/status');
    if (!statusResponse.ok) throw new Error('Auth status check failed');
    const authStatus = await statusResponse.json();

    if (authStatus.loggedIn) {
      // User IS logged in according to the server session
      const loadedData = checkForSavedData(); // Check local storage
      animeData = loadedData.animeData;

      if (animeData && animeData.length > 0) {
        // Local data exists, show Welcome Back screen
        if (loginScreen) loginScreen.classList.add('hidden');
        if (dashboardScreen) dashboardScreen.classList.add('hidden');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        if (resyncBtn) resyncBtn.textContent = `🔄 Re-sync with AniList`;
      } else {
        // No local data, but user IS logged in -> Perform initial sync
        // This handles the case right after login redirect
        if (loginScreen) loginScreen.classList.add('hidden'); // Hide login screen explicitly
        if (welcomeScreen) welcomeScreen.classList.add('hidden');
        syncWithAnilist(); // Now this call should have a valid session
      }
    } else {
      // User is NOT logged in according to the server
      localStorage.removeItem('animeDashboardData'); // Clear any potentially stale local data
      animeData = [];
      isGachaInitialized = false;
      // Show login screen
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');
      // Ensure loading spinner is hidden if it was somehow shown
      showLoading(false); // Call showLoading(false) only AFTER setting screen visibility
       // Manually show the login box elements if needed (like previous fix)
       const loginBox = document.getElementById('login-box');
       const loadingSpinner = document.getElementById('loading-spinner');
       if(loginBox) loginBox.classList.remove('hidden');
       if(loadingSpinner) loadingSpinner.classList.add('hidden');

    }
  } catch (err) {
      console.error("Initial Auth Check Error:", err);
      showError(document.getElementById('error-message'), `Failed to check login status: ${err.message}. Please refresh.`);
      // Show login screen on error as a fallback
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');
      showLoading(false); // Call showLoading(false) only AFTER setting screen visibility
      const loginBox = document.getElementById('login-box');
       const loadingSpinner = document.getElementById('loading-spinner');
      if(loginBox) loginBox.classList.remove('hidden');
       if(loadingSpinner) loadingSpinner.classList.add('hidden');
  }
  // =====================================================================

  // --- Attach Listeners ---

  // ... (animeAdded listener remains unchanged) ...
  document.addEventListener('animeAdded', (e) => {
    const newEntry = e.detail;
    // Check if entry exists and has an ID (AniList ID)
    if (newEntry && newEntry.id && !animeData.find(a => a.id === newEntry.id)) {
      console.log('Adding new anime to local state:', newEntry.title);
      animeData.push(newEntry);
      lastStats = calculateStatistics(animeData);
      saveDataToLocalStorage(animeData); // Save updated list
      // Re-render relevant parts
      renderStats(lastStats);
      populateFilters(animeData); // Update filters if new genres/statuses added
      renderAnimeTable(animeData, currentSort); // Update the main table
      renderEnhancedWatchingTab(animeData); // Update watching tab
    }
  });


  // Main Auth/Data Buttons
  if (viewDashboardBtn) {
    viewDashboardBtn.addEventListener('click', async () => {
      // This button assumes local data exists from the initial check
      const storedData = localStorage.getItem('animeDashboardData');
      if (storedData) {
        try {
            animeData = JSON.parse(storedData);
            document.getElementById('welcome-back-screen').classList.add('hidden');
            // Initialize Gacha when viewing dashboard from cache
            await initializeGacha();
            processAndRenderDashboard(animeData);
            // No need for configureUIForService, it's AniList only now
        } catch (error) {
            console.error("Failed to parse local data:", error);
            showToast("Failed to load saved data. Please re-sync.", "error");
            syncWithAnilist(); // Attempt re-sync if local data is corrupted
        }
      } else {
        // If somehow local data disappeared, sync again
        syncWithAnilist();
      }
    });
  }

  // Resync button now explicitly calls syncWithAnilist
  if (resyncBtn) resyncBtn.addEventListener('click', syncWithAnilist);

  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // ... (rest of listeners: download, export, tabs, theme, settings, filters, AI, gacha roll, modals remain unchanged) ...
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

        if (tab === 'calendar' && !seasonalAnimeData) {
          seasonalAnimeData = await fetchSeasonalAnime(); // Fetch if not already loaded
        }
        if (tab === 'gacha' && !isGachaInitialized) {
          await initializeGacha(); // Initialize gacha if tab is opened
        }
      }
    });
   }
   if (themeSwitcher) {
       themeSwitcher.addEventListener('click', (e) => {
           if (e.target.tagName === 'BUTTON') {
               const newTheme = e.target.dataset.theme;
               setTheme(newTheme);
               // Re-render charts if they exist and data is available
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
           window.CONFIG = CONFIG; // Update global config
           GEMINI_API_KEY = newApiKey; // Update local state variable
           ITEMS_PER_PAGE = newItemsPerPage; // Update local state variable
           applyConfigToUI(); // Update UI elements in settings modal
           // Re-render charts with potentially new genre limit
           if (lastStats && genreChartInstance && scoreChartInstance) {
                const chartInstances = renderCharts(lastStats, genreChartInstance, scoreChartInstance);
                genreChartInstance = chartInstances.genreChartInstance;
                scoreChartInstance = chartInstances.scoreChartInstance;
           }
            showToast("Settings saved and config.js generated!", "success");
            document.getElementById('settings-modal-backdrop').classList.remove('show'); // Close modal
       });
   }
   if (settingsCancelButton) {
        settingsCancelButton.addEventListener('click', () => {
            document.getElementById('settings-modal-backdrop').classList.remove('show');
        });
   }

   // List Tab Filtering and Sorting
   if (searchBar) searchBar.addEventListener('input', () => applyTableFiltersAndSort(animeData, currentSort));
   if (statusFilter) statusFilter.addEventListener('change', () => applyTableFiltersAndSort(animeData, currentSort));
   if (genreFilter) genreFilter.addEventListener('change', () => applyTableFiltersAndSort(animeData, currentSort));
   if (animeTableHead) {
       animeTableHead.addEventListener('click', (e) => {
           const header = e.target.closest('.sortable-header');
           if (header) {
               const column = header.dataset.sort;
               if (currentSort.column === column) {
                   currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
               } else {
                   currentSort.column = column;
                   currentSort.direction = 'asc'; // Default to ascending on new column
               }
               // Re-render table with new sort, using existing filtered data if applicable
               // applyTableFiltersAndSort handles both filtering and sorting now
               applyTableFiltersAndSort(animeData, currentSort);
           }
       });
   }

    // AI Insights Tab
    if (geminiButton) {
        geminiButton.addEventListener('click', () => getGeminiRecommendations(lastStats, GEMINI_API_KEY));
    }

    // Gacha Tab
    if (gachaRollButton) {
        gachaRollButton.addEventListener('click', async () => {
            const button = gachaRollButton;
            button.disabled = true; // Disable during roll

            try {
                const result = await rollGacha(); // Perform the roll via API

                if (result.status === 'error') {
                    showToast(`Gacha roll failed: ${result.message}`, 'error');
                    console.error('Roll failed:', result.message);
                    // Re-enable button even on error, after checking tokens
                    button.disabled = window.gachaTokens < 1;
                    return; // Stop if roll failed
                }

                displayGachaResult(result); // Show the card/duplicate message

                // Reload state from backend to get updated tokens/shards/collection
                try {
                    await loadGachaState();
                    renderGachaState(); // Update token/shard counts and collection display
                } catch (loadError) {
                     showToast('Failed to update gacha state after roll.', 'error');
                }

            } catch (error) {
                console.error('❌ Gacha roll UI error:', error);
                showToast(`An error occurred during the roll: ${error.message}`, 'error');
                // Ensure button is re-enabled even if unexpected errors occur
            } finally {
                 // Check token count again before enabling, might be 0 now
                 button.disabled = window.gachaTokens < 1;
            }
        });
    }

   // Gacha Reset Button
   if (gachaResetButton) {
    gachaResetButton.addEventListener('click', async () => {
      const success = await resetGachaCollection();
      // If reset is successful, reload state and re-render
      if (success) {
        try {
            await loadGachaState(); // Reload state from backend
            renderGachaState(); // Update UI
        } catch(error){
            showToast('Failed to reload gacha state after reset.', 'error');
        }
      }
    });
  }


    // Global Modal Closing
    if (similarModalClose) similarModalClose.addEventListener('click', () => document.getElementById('similar-modal-backdrop').classList.remove('show'));
    if (cosmeticModalClose) cosmeticModalClose.addEventListener('click', () => document.getElementById('cosmetic-modal-backdrop').classList.remove('show'));

    // Click outside modal to close
    document.addEventListener('click', (e) => {
        if (e.target.matches('.modal-backdrop')) {
            e.target.classList.remove('show');
        }
    });

  // Event delegation for dynamically created buttons
  document.body.addEventListener('click', async (e) => {

    // Watching Tab & List Tab: "+1 Episode" button
    if (e.target.classList.contains('add-episode-btn')) {
      const button = e.target;
      const title = button.dataset.title;
      const anime = animeData.find(a => a.title === title);

      if (!anime || !anime.id) { // Ensure anime and its AniList ID exist
        showToast('Error: Cannot update progress. Anime data missing or invalid.', 'error');
        return;
      }

      // No need to check loggedInService, it's always AniList now

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

        // Success - Update UI and State
        showToast(`Updated '${title}' to Ep ${newProgress} on AniList!`, 'success');
        animeData = incrementEpisode(title, animeData); // Update local array
        lastStats = calculateStatistics(animeData); // Recalculate stats

        // Update Gacha tokens if initialized
        if (isGachaInitialized) {
            try {
                // Fetch latest gacha state to get potentially updated totalPulls
                const currentState = await loadGachaState();
                // Ensure totalPulls exists before updating
                await updateGachaTokens(lastStats.totalEpisodes, currentState?.totalPulls || 0);
                renderGachaState(); // Update token display
            } catch (gachaError){
                 console.warn("Failed to update gacha tokens after progress update:", gachaError);
                 // Non-critical, maybe show a silent warning or just log
            }
        }

        saveDataToLocalStorage(animeData); // Save updated data
        renderStats(lastStats); // Update stats display
        renderEnhancedWatchingTab(animeData); // Update watching tab cards
        renderAnimeTable(animeData, currentSort); // Update main list table
        // if(isGachaInitialized) renderGachaState(); // Already called after updateGachaTokens

      } catch (error) {
        console.error('Failed to update progress:', error);
        showToast(`Error: ${error.message}`, 'error');
      } finally {
        button.disabled = false;
        button.textContent = '+1 Ep';
      }
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
        // Reload state to get updated shards and owned cosmetics
        try {
            await loadGachaState();
            renderGachaState(); // Re-render gacha UI
        } catch(loadError) {
             showToast('Failed to update gacha state after purchase.', 'error');
        }
      }
    }

     // Calendar Tab: "Add to Planning" button (still uses MAL ID)
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

            // Success
            showToast(`Added '${title}' to your planning list!`, 'success');
            button.textContent = 'Added ✓';
            button.classList.remove('btn-primary');
            button.classList.add('btn-secondary', 'cursor-not-allowed'); // Make it look inactive

            // Dispatch event for main.js to update the main list
            document.dispatchEvent(new CustomEvent('animeAdded', { detail: newEntry }));

        } catch (error) {
            console.error('Failed to add to planning:', error);
            showToast(`Error: ${error.message}`, 'error');
            button.disabled = false; // Re-enable on failure
            button.textContent = '+ Plan to Watch';
        }
    }

  });
});