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
  handleError,
  withErrorHandling,
  isRetryableError,
  isSessionExpired
} from './error-handler.js';
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
  initBulkSelection,
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
// Charts module will be lazy loaded when Visualizations tab is opened
// ⭐ MODIFIED: Added generatePersonalInsights
import { getSimilarAnime, getGeminiRecommendations, generatePersonalInsights } from './ai.js';
// ⭐ Import API helper for cross-domain requests (works in both dev and production)
import { apiFetch } from './api-config.js';
// Calendar module will be lazy loaded when Calendar tab is opened
// History module will be lazy loaded when History tab is opened
// Achievements modules will be lazy loaded when Achievements tab is opened
// Custom lists modules will be lazy loaded when Custom Lists tab is opened
// Goals module will be lazy loaded when Goals tab is opened
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
import { initContextMenu } from './context-menu.js';
import { initTooltips } from './tooltips.js';

// --- 2. State Variables ---
let GEMINI_API_KEY = window.CONFIG.GEMINI_API_KEY || '';
let ITEMS_PER_PAGE = window.CONFIG.EPISODES_PER_PAGE || 25;

let seasonalAnimeData = null;
let animeData = [];
window.animeData = []; // ⭐ Make available globally for list.js
let scoreChartInstance;
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
    const response = await apiFetch('/api/get-anilist-data');

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
    const errorInfo = handleError(err, 'syncing with AniList', {
      showToast: true,
      showError: errorMessageElement
    });
    
    showLoading(false);

    // Handle session expiry
    if (errorInfo.sessionExpired || !localStorage.getItem('animeDashboardData')) {
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (welcomeScreen) welcomeScreen.classList.add('hidden');
      if (dashboardScreen) dashboardScreen.classList.add('hidden');
      const loginBox = document.getElementById('login-box');
      if(loginBox) loginBox.classList.remove('hidden');
    } else if (errorInfo.canRetry && errorMessageElement) {
      // Add retry button for retryable errors
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn-primary mt-2';
      retryBtn.textContent = 'Retry Sync';
      retryBtn.onclick = () => {
        retryBtn.remove();
        syncWithAnilist();
      };
      errorMessageElement.parentElement?.appendChild(retryBtn);
    }
  }
}

/**
 * Logs the user out by clearing session and local data.
 */
async function logout() {
  try {
    await apiFetch('/auth/logout');
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
    
    // Use requestAnimationFrame to defer heavy calculations
    requestAnimationFrame(() => {
      lastStats = calculateStatistics(data);
      window.lastStats = lastStats; // Make stats globally available for exports
      renderStats(lastStats);
    });

    // ⭐ NEW: Update insights if tab has been initialized
    if (insightsInitialized) {
      updateInsightsData(lastStats);
    }

    // ⭐ NEW: Refresh history view with updated data (lazy loaded)
    if (window.refreshHistoryView) {
      window.refreshHistoryView();
    }

    // ⭐ NEW: Check and unlock achievements (lazy loaded)
    if (window.checkAndUnlockAchievements) {
      await window.checkAndUnlockAchievements();
    }

    // Defer chart rendering to avoid blocking (lazy loaded)
    requestAnimationFrame(async () => {
      if (window.renderCharts && lastStats) {
        const chartInstances = await window.renderCharts(lastStats, null, scoreChartInstance);
        scoreChartInstance = chartInstances?.scoreChartInstance;
      }
    });

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
  // Tab-specific modules will be lazy loaded when their tabs are opened
  initAnimeDetailsModal();
  initBulkSelection(); // ⭐ NEW: Initialize bulk selection
  initContextMenu(); // ⭐ NEW: Initialize context menu (quick actions)
  initTooltips(); // ⭐ NEW: Initialize tooltip system
  initKeyboardShortcuts(); // ⭐ NEW: Initialize keyboard shortcuts
  initLazyLoading(); // ⭐ NEW: Initialize lazy loading
  
  // ⭐ NEW: Initialize enhanced list tab
  initListTab();

  // =====================================================================
  // ⭐ UPDATED: Auth Flow - Check server status first
  // =====================================================================
  try {
    const statusResponse = await apiFetch('/auth/status');
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
      const errorInfo = handleError(err, 'checking login status', {
        showToast: true,
        showError: document.getElementById('error-message')
      });
      
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
      window.lastStats = lastStats; // Make stats globally available for exports
      
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
            handleError(error, 'loading saved data', {
              showToast: true
            });
            syncWithAnilist();
        }
      } else {
        console.log('📦 No saved data found, syncing with AniList...');
        syncWithAnilist();
      }
    });
  }

  if (resyncBtn) resyncBtn.addEventListener('click', syncWithAnilist);
  
  // Dashboard resync button (always visible in sidebar)
  const dashboardResyncBtn = document.getElementById('dashboard-resync-btn');
  if (dashboardResyncBtn) {
    dashboardResyncBtn.addEventListener('click', syncWithAnilist);
  }
  
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Export menu functionality
  const exportBtn = document.getElementById('export-btn');
  const exportMenu = document.getElementById('export-menu');
  
  if (exportBtn && exportMenu) {
    // Toggle menu
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('hidden');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
        exportMenu.classList.add('hidden');
      }
    });
    
    // Handle export option clicks
    const exportOptions = exportMenu.querySelectorAll('.export-option');
    exportOptions.forEach(option => {
      option.addEventListener('click', async () => {
        const format = option.dataset.format;
        
        // Import export functions
        const { 
          exportAsJSON, 
          exportAsCSV, 
          exportAsMALXML, 
          downloadExport,
          exportChartsAsPDF
        } = await import('./export.js');
        
        // Handle chart export separately
        if (format === 'chart-pdf') {
          // Check if charts tab is visible or charts exist
          const chartsTab = document.getElementById('charts-tab');
          if (!chartsTab || chartsTab.classList.contains('hidden')) {
            showToast('Please open the Visualizations tab first to export charts', 'error');
            exportMenu.classList.add('hidden');
            return;
          }
          
          // Lazy load Chart.js to check if charts exist
          try {
            const { loadChartJS } = await import('./utils.js');
            const Chart = await loadChartJS();
            const firstChart = Chart.getChart('score-chart');
            if (!firstChart) {
              showToast('No charts available. Please load your data first.', 'error');
              exportMenu.classList.add('hidden');
              return;
            }
          } catch (error) {
            showToast('Failed to load Chart.js. Please try again.', 'error');
            exportMenu.classList.add('hidden');
            return;
          }
          
          // Get stats - try from global, then calculate from animeData, or use module-level lastStats
          let stats = window.lastStats || lastStats || null;
          
          // If stats not available, calculate from animeData
          if (!stats && window.animeData && window.animeData.length > 0) {
            const { calculateStatistics } = await import('./data.js');
            stats = calculateStatistics(window.animeData);
          }
          
          if (!stats) {
            showToast('Statistics not available. Please load your data first.', 'error');
            exportMenu.classList.add('hidden');
            return;
          }
          
          // Export charts as PDF (async)
          try {
            showToast('Generating PDF...', 'info');
            const exportData = await exportChartsAsPDF(stats);
            if (exportData) {
              downloadExport(exportData);
              exportMenu.classList.add('hidden');
              showToast('Charts exported as PDF successfully', 'success');
            } else {
              showToast('Failed to export charts. Please ensure jsPDF is loaded.', 'error');
            }
          } catch (error) {
            handleError(error, 'exporting PDF', {
              showToast: true
            });
          }
          return;
        }
        
        // Handle data exports
        if (!animeData || animeData.length === 0) {
          showToast('No anime data to export', 'error');
          return;
        }
        
        let exportData = null;
        switch (format) {
          case 'json':
            exportData = exportAsJSON(animeData);
            break;
          case 'csv':
            exportData = exportAsCSV(animeData);
            break;
          case 'mal-xml':
            exportData = exportAsMALXML(animeData);
            break;
        }
        
        if (exportData) {
          downloadExport(exportData);
          exportMenu.classList.add('hidden');
          showToast(`Exported as ${format.toUpperCase()}`, 'success');
        } else {
          showToast('Export failed', 'error');
        }
      });
    });
  }
  
  // Keep old button for backwards compatibility if it exists
  if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', () => {
      if (!animeData || animeData.length === 0) {
        showToast('No anime data to export', 'error');
        return;
      }
      import('./export.js').then(({ exportAsJSON, downloadExport }) => {
        const exportData = exportAsJSON(animeData);
        if (exportData) {
          downloadExport(exportData);
          showToast('Exported as JSON', 'success');
        }
      });
    });
  }
  if (exportCalendarBtn) {
      exportCalendarBtn.addEventListener('click', () => exportToCalendar(animeData));
  }

  if (tabNav) {
    tabNav.addEventListener('click', async (e) => {
      if (e.target.tagName === 'BUTTON') {
        const tab = e.target.dataset.tab;
        console.log('Tab clicked:', tab);
        setActiveTab(tab);

        // Lazy load tab-specific modules only when their tabs are opened
        if (tab === 'charts') {
          // Lazy load charts module when Visualizations tab is opened
          if (!window.chartsModuleLoaded) {
            try {
              const { renderCharts } = await import('./charts.js');
              window.renderCharts = renderCharts;
              window.chartsModuleLoaded = true;
              // Render charts if stats are available
              if (lastStats) {
                const chartInstances = await renderCharts(lastStats, null, scoreChartInstance);
                scoreChartInstance = chartInstances?.scoreChartInstance;
              }
            } catch (error) {
              console.error('Failed to load charts module:', error);
            }
          } else if (lastStats) {
            // Charts module already loaded, just render
            const chartInstances = await window.renderCharts(lastStats, null, scoreChartInstance);
            scoreChartInstance = chartInstances?.scoreChartInstance;
          }
        }

        // ⭐ NEW: Initialize insights tab on first view
        if (tab === 'insights' && !insightsInitialized) {
          initializeInsightsTab(lastStats); // Use globally available stats
          insightsInitialized = true;
        }

        if (tab === 'calendar') {
          // Lazy load calendar module when Calendar tab is opened
          if (!window.calendarModuleLoaded) {
            try {
              const { fetchSeasonalAnime, initCalendar } = await import('./calendar.js');
              window.fetchSeasonalAnime = fetchSeasonalAnime;
              window.initCalendar = initCalendar;
              window.calendarModuleLoaded = true;
              initCalendar();
            } catch (error) {
              console.error('Failed to load calendar module:', error);
            }
          }
          if (!seasonalAnimeData) {
            seasonalAnimeData = await window.fetchSeasonalAnime();
          }
        }

        if (tab === 'history') {
          // Lazy load history module when History tab is opened
          if (!window.historyModuleLoaded) {
            try {
              const { initHistoryView, refreshHistoryView } = await import('./history-view.js');
              window.initHistoryView = initHistoryView;
              window.refreshHistoryView = refreshHistoryView;
              window.historyModuleLoaded = true;
              initHistoryView();
              // Refresh view after initialization to ensure data is loaded
              if (window.animeData && window.animeData.length > 0) {
                refreshHistoryView();
              }
            } catch (error) {
              console.error('Failed to load history module:', error);
            }
          } else {
            // If module already loaded, just refresh the view
            if (window.refreshHistoryView && window.animeData && window.animeData.length > 0) {
              window.refreshHistoryView();
            }
          }
        }

        if (tab === 'achievements') {
          // Lazy load achievements modules when Achievements tab is opened
          if (!window.achievementsModuleLoaded) {
            try {
              const { initAchievements } = await import('./achievements.js');
              const { initAchievementsView, renderAchievements, checkAndUnlockAchievements } = await import('./achievements-view.js');
              window.initAchievements = initAchievements;
              window.initAchievementsView = initAchievementsView;
              window.renderAchievements = renderAchievements;
              window.checkAndUnlockAchievements = checkAndUnlockAchievements;
              window.achievementsModuleLoaded = true;
              initAchievements();
              initAchievementsView();
            } catch (error) {
              console.error('Failed to load achievements modules:', error);
            }
          }
          // Render achievements after initialization or if already loaded
          // Use requestAnimationFrame to ensure tab is visible before rendering
          requestAnimationFrame(async () => {
            if (window.renderAchievements) {
              await window.renderAchievements();
            }
          });
        }

        // ⭐ NEW: Render custom lists when tab is clicked
        if (tab === 'custom-lists') {
          // Lazy load custom lists modules when Custom Lists tab is opened
          if (!window.customListsModuleLoaded) {
            try {
              const { initCustomLists, loadCustomLists } = await import('./custom-lists.js');
              const { initCustomListsView, renderCustomLists, refreshCustomListsView } = await import('./custom-lists-view.js');
              window.initCustomLists = initCustomLists;
              window.loadCustomLists = loadCustomLists;
              window.initCustomListsView = initCustomListsView;
              window.renderCustomLists = renderCustomLists;
              window.refreshCustomListsView = refreshCustomListsView;
              window.customListsModuleLoaded = true;
              initCustomLists();
              initCustomListsView();
            } catch (error) {
              console.error('Failed to load custom lists modules:', error);
            }
          }
          await window.loadCustomLists();
          // Use requestAnimationFrame to ensure tab is visible before rendering
          requestAnimationFrame(() => {
            window.renderCustomLists();
          });
        }

        // ⭐ NEW: Render goals when tab is clicked
        if (tab === 'goals') {
          // Lazy load goals module when Goals tab is opened
          if (!window.goalsModuleLoaded) {
            try {
              const { initGoalsView, renderGoals } = await import('./goals-view.js');
              window.initGoalsView = initGoalsView;
              window.renderGoals = renderGoals;
              window.goalsModuleLoaded = true;
              initGoalsView();
            } catch (error) {
              console.error('Failed to load goals module:', error);
            }
          }
          // Use requestAnimationFrame to ensure tab is visible before rendering
          requestAnimationFrame(async () => {
            await window.renderGoals();
          });
        }
        // Gacha tab removed
      }
    });
  }
  if (themeSwitcher) {
      // Click handler for theme switching
      themeSwitcher.addEventListener('click', async (e) => {
          if (e.target.tagName === 'BUTTON') {
              const newTheme = e.target.dataset.theme;
              setTheme(newTheme);
              if (lastStats && scoreChartInstance && window.renderCharts) {
                  const chartInstances = await window.renderCharts(lastStats, null, scoreChartInstance);
                  scoreChartInstance = chartInstances?.scoreChartInstance;
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
  // Settings button - use direct click handler with proper event handling
  if (settingsButton) {
    settingsButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showSettingsModal();
    }, true); // Use capture phase to ensure it runs first
  } else {
    console.warn('Settings button not found on DOMContentLoaded, will use event delegation');
  }
  
  // Also use event delegation as fallback
  document.addEventListener('click', (e) => {
    const clickedButton = e.target.closest('#settings-button');
    if (clickedButton) {
      e.preventDefault();
      e.stopPropagation();
      showSettingsModal();
    }
  }, true); // Use capture phase
  
  // Settings modal close button
  const settingsModalClose = document.getElementById('settings-modal-close');
  if (settingsModalClose) {
    settingsModalClose.addEventListener('click', () => {
      const backdrop = document.getElementById('settings-modal-backdrop');
      if (backdrop) {
        backdrop.classList.remove('show');
        
        // Remove inline styles that force display
        backdrop.style.display = '';
        backdrop.style.opacity = '';
        backdrop.style.pointerEvents = '';
        backdrop.style.visibility = '';
        backdrop.style.zIndex = '';
        backdrop.style.background = '';
        backdrop.style.position = '';
        backdrop.style.top = '';
        backdrop.style.left = '';
        backdrop.style.right = '';
        backdrop.style.bottom = '';
        backdrop.style.width = '';
        backdrop.style.height = '';
        
        // Update ARIA attributes
        backdrop.setAttribute('aria-hidden', 'true');
        
        // Restore body scroll
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    });
  }
  
  // Settings backdrop click to close
  const settingsModalBackdrop = document.getElementById('settings-modal-backdrop');
  if (settingsModalBackdrop) {
    settingsModalBackdrop.addEventListener('click', (e) => {
      if (e.target === settingsModalBackdrop) {
        settingsModalBackdrop.classList.remove('show');
        
        // Remove inline styles that force display
        settingsModalBackdrop.style.display = '';
        settingsModalBackdrop.style.opacity = '';
        settingsModalBackdrop.style.pointerEvents = '';
        settingsModalBackdrop.style.visibility = '';
        settingsModalBackdrop.style.zIndex = '';
        settingsModalBackdrop.style.background = '';
        settingsModalBackdrop.style.position = '';
        settingsModalBackdrop.style.top = '';
        settingsModalBackdrop.style.left = '';
        settingsModalBackdrop.style.right = '';
        settingsModalBackdrop.style.bottom = '';
        settingsModalBackdrop.style.width = '';
        settingsModalBackdrop.style.height = '';
        
        // Update ARIA attributes
        settingsModalBackdrop.setAttribute('aria-hidden', 'true');
        
        // Restore body scroll
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    });
  }
  
  if (settingsSaveButton) {
      settingsSaveButton.addEventListener('click', async () => {
          // Save settings to localStorage
          const { saveSettingsToStorage } = await import('./ui.js');
          saveSettingsToStorage();
          
          // Save config.js
          const { CONFIG, GEMINI_API_KEY: newApiKey, ITEMS_PER_PAGE: newItemsPerPage } = saveAndGenerateConfigFile();
          window.CONFIG = CONFIG;
          GEMINI_API_KEY = newApiKey;
          ITEMS_PER_PAGE = newItemsPerPage;
          applyConfigToUI();
          if (lastStats && scoreChartInstance && window.renderCharts) {
               const chartInstances = await window.renderCharts(lastStats, null, scoreChartInstance);
               scoreChartInstance = chartInstances?.scoreChartInstance;
          }
           showToast("Settings saved!", "success");
           const backdrop = document.getElementById('settings-modal-backdrop');
           if (backdrop) {
             backdrop.classList.remove('show');
             
             // Remove inline styles that force display
             backdrop.style.display = '';
             backdrop.style.opacity = '';
             backdrop.style.pointerEvents = '';
             backdrop.style.visibility = '';
             backdrop.style.zIndex = '';
             backdrop.style.background = '';
             backdrop.style.position = '';
             backdrop.style.top = '';
             backdrop.style.left = '';
             backdrop.style.right = '';
             backdrop.style.bottom = '';
             backdrop.style.width = '';
             backdrop.style.height = '';
             
             // Update ARIA attributes
             backdrop.setAttribute('aria-hidden', 'true');
             
             // Restore body scroll
             document.body.style.overflow = '';
             document.documentElement.style.overflow = '';
           }
      });
  }
  if (settingsCancelButton) {
       settingsCancelButton.addEventListener('click', () => {
           const backdrop = document.getElementById('settings-modal-backdrop');
           if (backdrop) {
             backdrop.classList.remove('show');
             
             // Remove inline styles that force display
             backdrop.style.display = '';
             backdrop.style.opacity = '';
             backdrop.style.pointerEvents = '';
             backdrop.style.visibility = '';
             backdrop.style.zIndex = '';
             backdrop.style.background = '';
             backdrop.style.position = '';
             backdrop.style.top = '';
             backdrop.style.left = '';
             backdrop.style.right = '';
             backdrop.style.bottom = '';
             backdrop.style.width = '';
             backdrop.style.height = '';
             
             // Update ARIA attributes
             backdrop.setAttribute('aria-hidden', 'true');
             
             // Restore body scroll
             document.body.style.overflow = '';
             document.documentElement.style.overflow = '';
           }
       });
  }
  
  // Settings export config button
  const settingsExportConfig = document.getElementById('settings-export-config');
  if (settingsExportConfig) {
    settingsExportConfig.addEventListener('click', () => {
      saveAndGenerateConfigFile();
      showToast("config.js exported!", "success");
    });
  }
  
  // Settings reset button
  const settingsReset = document.getElementById('settings-reset');
  if (settingsReset) {
    settingsReset.addEventListener('click', async () => {
      const { showConfirm } = await import('./toast.js');
      const confirmed = await showConfirm('Are you sure you want to reset all settings to defaults?');
      if (confirmed) {
        localStorage.removeItem('animeDashboardSettings');
        showToast("Settings reset to defaults", "info");
        showSettingsModal(); // Reload modal to show defaults
      }
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
    // SCORE & STATUS EDITOR HANDLERS (Check FIRST before row clicks)
    // =================================================================

    // Open score editor - check BEFORE row click handler
    if (e.target.classList.contains('score-edit-btn') || 
        (e.target.closest('.score-display') && !e.target.closest('.score-editor-container.loading'))) {
      const scoreDisplay = e.target.closest('.score-display');
      if (scoreDisplay) {
        const container = scoreDisplay.closest('.score-editor-container');
        const editor = container.querySelector('.score-editor');
        const input = editor.querySelector('.score-input');
        
        scoreDisplay.classList.add('hidden');
        editor.classList.remove('hidden');
        
        setTimeout(() => {
          input.focus();
          input.select();
        }, 10);
        return; // Stop propagation
      }
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
        window.lastStats = lastStats; // Make stats globally available for exports
        renderStats(lastStats);
        
        // ⭐ NEW: Update insights
        if (insightsInitialized) {
          updateInsightsData(lastStats);
        }
        
        saveDataToLocalStorage(animeData);
        window.animeData = animeData; // ⭐ Update global ref
        triggerFilterUpdate(); // ⭐ Refresh list view
        
      } catch (error) {
        handleError(error, 'updating score', {
          showToast: true
        });
        
        const anime = animeData.find(a => a.id === animeId);
        if (anime) {
          input.value = anime.score || 0;
        }
      } finally {
        button.disabled = false;
        container.classList.remove('loading');
      }
      return; // Stop propagation
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
      return; // Stop propagation
    }

    // Open status editor - check BEFORE row click handler
    if (e.target.classList.contains('status-badge-clickable') || e.target.closest('.status-badge-clickable')) {
      const badge = e.target.closest('.status-badge-clickable');
      if (badge) {
        const container = badge.closest('.status-editor-container');
        const editor = container.querySelector('.status-editor');
        
        badge.classList.add('hidden');
        editor.classList.remove('hidden');
        return; // Stop propagation
      }
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
        
        showToast(`Updated '${animeTitle}' status to ${newStatus}!`, 'success');
        animeData = updateAnimeStatus(animeId, newStatus, animeData);
        
        lastStats = calculateStatistics(animeData);
        window.lastStats = lastStats;
        renderStats(lastStats);
        
        if (insightsInitialized) {
          updateInsightsData(lastStats);
        }
        
        saveDataToLocalStorage(animeData);
        populateFilters(animeData);
        populateAdvancedFilters(animeData);
        window.animeData = animeData;
        triggerFilterUpdate();
        
        await renderEnhancedWatchingTab(animeData);
        
      } catch (error) {
        handleError(error, 'updating status', {
          showToast: true
        });
      } finally {
        button.disabled = false;
        container.classList.remove('loading');
      }
      return; // Stop propagation
    }

    // Cancel status edit
    if (e.target.classList.contains('status-cancel-btn')) {
      const editor = e.target.closest('.status-editor');
      const container = editor.closest('.status-editor-container');
      const badge = container.querySelector('.status-badge-clickable');
      
      editor.classList.add('hidden');
      badge.classList.remove('hidden');
      return; // Stop propagation
    }

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
      const clickedElement = e.target;
      
      // Don't open modal if clicking directly on interactive elements
      // Check for direct clicks on buttons, inputs, selects first
      if (
        clickedElement.tagName === 'BUTTON' ||
        clickedElement.tagName === 'INPUT' ||
        clickedElement.tagName === 'SELECT' ||
        clickedElement.closest('button') ||
        clickedElement.closest('input') ||
        clickedElement.closest('select')
      ) {
        // But allow if it's the title itself (shouldn't be, but just in case)
        if (!clickedElement.closest('.main-title')) {
          return;
        }
      }
      
      // Don't open modal if clicking on specific interactive elements
      if (
        clickedElement.closest('.add-episode-btn') ||
        clickedElement.closest('.similar-btn') ||
        clickedElement.closest('.score-edit-btn') ||
        clickedElement.closest('.score-save-btn') ||
        clickedElement.closest('.score-cancel-btn') ||
        clickedElement.closest('.status-badge-clickable') ||
        clickedElement.closest('.status-save-btn') ||
        clickedElement.closest('.status-cancel-btn') ||
        clickedElement.closest('.anime-select-checkbox')
      ) {
        return;
      }
      
      // Don't open if clicking inside an active (visible) editor
      const activeScoreEditor = row.querySelector('.score-editor:not(.hidden)');
      const activeStatusEditor = row.querySelector('.status-editor:not(.hidden)');
      if (activeScoreEditor && activeScoreEditor.contains(clickedElement)) {
        return;
      }
      if (activeStatusEditor && activeStatusEditor.contains(clickedElement)) {
        return;
      }
      
      // Get the title element and find the anime
      const titleElement = row.querySelector('.main-title');
      if (!titleElement) {
        console.log('No title element found in row');
        return;
      }
      
      const animeTitle = titleElement.textContent.trim();
      console.log('Looking for anime with title:', animeTitle);
      const anime = animeData.find(a => a.title === animeTitle);
      if (anime) {
        console.log('Found anime, opening modal:', anime.title);
        openAnimeDetailsModal(anime);
      } else {
        console.log('Anime not found in animeData. Total anime:', animeData.length);
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
        window.lastStats = lastStats; // Make stats globally available for exports
        
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
        handleError(error, 'updating episode progress', {
          showToast: true
        });
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
        window.lastStats = lastStats; // Make stats globally available for exports

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
    // DUPLICATE HANDLERS REMOVED - Handled above at lines 962-1142
    // =====================================================================

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
            handleError(error, 'adding to planning list', {
              showToast: true
            });
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

  // =====================================================================
  // KEYBOARD NAVIGATION FOR TABLE ROWS AND GRID CARDS (Accessibility)
  // =====================================================================
  document.body.addEventListener('keydown', (e) => {
    // Skip if typing in inputs, textareas, or contenteditable
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable ||
                    target.tagName === 'SELECT';
    
    if (isInput && e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Escape') {
      return;
    }

    // Table row keyboard navigation
    if (target.classList.contains('table-row') || target.closest('.table-row')) {
      const row = target.classList.contains('table-row') ? target : target.closest('.table-row');
      if (!row) return;

      if (e.key === 'Enter' || e.key === ' ') {
        // Don't activate if focus is on an interactive element
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT') {
          return;
        }
        
        e.preventDefault();
        const animeId = parseInt(row.dataset.animeId);
        const anime = animeData.find(a => a.id === animeId);
        if (anime) {
          openAnimeDetailsModal(anime);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextRow = row.nextElementSibling;
        if (nextRow && nextRow.classList.contains('table-row')) {
          nextRow.focus();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevRow = row.previousElementSibling;
        if (prevRow && prevRow.classList.contains('table-row')) {
          prevRow.focus();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        const firstRow = row.parentElement?.querySelector('.table-row');
        if (firstRow) firstRow.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const rows = row.parentElement?.querySelectorAll('.table-row');
        if (rows && rows.length > 0) {
          rows[rows.length - 1].focus();
        }
      }
      return;
    }

    // Grid card keyboard navigation
    if (target.classList.contains('grid-card') || target.closest('.grid-card')) {
      const card = target.classList.contains('grid-card') ? target : target.closest('.grid-card');
      if (!card) return;

      if (e.key === 'Enter' || e.key === ' ') {
        // Don't activate if focus is on an interactive element
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT') {
          return;
        }
        
        e.preventDefault();
        const animeId = parseInt(card.dataset.animeId);
        const anime = animeData.find(a => a.id === animeId);
        if (anime) {
          openAnimeDetailsModal(anime);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const cards = Array.from(document.querySelectorAll('.grid-card'));
        const currentIndex = cards.indexOf(card);
        const nextCard = cards[currentIndex + 1];
        if (nextCard) {
          nextCard.focus();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const cards = Array.from(document.querySelectorAll('.grid-card'));
        const currentIndex = cards.indexOf(card);
        const prevCard = cards[currentIndex - 1];
        if (prevCard) {
          prevCard.focus();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        const cards = document.querySelectorAll('.grid-card');
        if (cards.length > 0) cards[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        const cards = document.querySelectorAll('.grid-card');
        if (cards.length > 0) cards[cards.length - 1].focus();
      }
      return;
    }
  });
});