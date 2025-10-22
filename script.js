// =====================================================================
// --- MAIN APPLICATION SCRIPT (script.js) ---
// =====================================================================
// This file contains the core logic for the dashboard, stats,
// and UI management. It works alongside `gacha.js` and `config.js`.
// =====================================================================


// --- 1. State Variables and External Configuration ---

window.CONFIG = window.CONFIG || {
    DASHBOARD_TITLE: "My Anime Dashboard",
    DASHBOARD_SUBTITLE: "Visualize your anime watching journey.",
    GEMINI_API_KEY: "",
    EPISODES_PER_PAGE: 25, // Kept for config consistency, but not used for list tab
    ACTIVE_TRACKER_LIMIT: 3,
    CHART_GENRE_LIMIT: 10,
    GACHA_EPISODES_PER_TOKEN: 50,
    GACHA_INITIAL_TOKENS: 5
};

let GEMINI_API_KEY = window.CONFIG.GEMINI_API_KEY || "";
let seasonalAnimeData = null;
let animeData = [];
let genreChartInstance, scoreChartInstance;
let lastStats = null;
let currentSort = { column: 'title', direction: 'asc' };
// let currentPage = 1; // Removed for scrolling list
let ITEMS_PER_PAGE = window.CONFIG.EPISODES_PER_PAGE || 25; // Kept for potential future use
window.episodesWatchedTotal = 0;


// ************************************************************
// --- SECTION A: CORE UI/THEME/UTILITY FUNCTIONS ---
// ************************************************************

function showError(errorMessageElement, message) {
    if (errorMessageElement) {
        errorMessageElement.textContent = message || '';
        errorMessageElement.classList.toggle('hidden', !message);
    }
}

function showLoading(isLoading, text = 'Syncing with AniList...') {
    const loadingSpinnerEl = document.getElementById('loading-spinner');
    const loginScreenEl = document.getElementById('login-screen');
    const loginBoxEl = document.getElementById('login-box');
    const welcomeBackScreen = document.getElementById('welcome-back-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const loadingTextEl = document.getElementById('loading-text');

    if (isLoading) {
        if (loginScreenEl) loginScreenEl.classList.remove('hidden');
        if (welcomeBackScreen) welcomeBackScreen.classList.add('hidden');
        if (dashboardScreen) dashboardScreen.classList.add('hidden');

        if (loadingSpinnerEl) loadingSpinnerEl.classList.remove('hidden');
        if (loginBoxEl) loginBoxEl.classList.add('hidden');
        if (loadingTextEl) loadingTextEl.textContent = text;
    } else {
        if (loadingSpinnerEl) loadingSpinnerEl.classList.add('hidden');
        if (loginBoxEl) loginBoxEl.classList.remove('hidden');
        if (loginScreenEl) loginScreenEl.classList.add('hidden');
    }
}

function setActiveTab(activeTab) {
    const tabNav = document.getElementById('tab-nav');
    const tabContents = document.querySelectorAll('.tab-content');

    if (tabNav) {
        tabNav.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active-tab', btn.dataset.tab === activeTab);
            btn.classList.toggle('inactive-tab', btn.dataset.tab !== activeTab);
        });
    }
    if (tabContents) {
        tabContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== `${activeTab}-tab`);
        });
    }

    if (activeTab === 'gacha' && typeof renderGachaState === 'function') {
        renderGachaState();
    }
    if(activeTab === 'watching'){
        renderWatchingTab();
    }
}

function saveDataToLocalStorage(data) {
    try {
        localStorage.setItem('animeDashboardData', JSON.stringify(data));

        // Ensure gacha variables exist before saving
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

    } catch (e) { console.error("Failed to save data to local storage", e); }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('animeDashboardTheme') || 'default';
    setTheme(savedTheme);
}

function setTheme(theme) {
    const themeSwitcher = document.getElementById('theme-switcher');
    const backgroundAnimations = document.getElementById('background-animations');
    const blobContainer = document.getElementById('blob-container');

    document.body.className = `theme-${theme}`;
    localStorage.setItem('animeDashboardTheme', theme);
    if (themeSwitcher) {
        themeSwitcher.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    if (backgroundAnimations) backgroundAnimations.innerHTML = '';
    if (blobContainer) blobContainer.classList.remove('hidden');

    if (theme === 'sakura') {
        for (let i = 0; i < 15; i++) {
            const petal = document.createElement('div');
            petal.className = 'petal';
            petal.style.left = `${Math.random() * 100}vw`;
            petal.style.animationDuration = `${5 + Math.random() * 10}s`;
            petal.style.animationDelay = `-${Math.random() * 10}s`;
            petal.style.transform = `scale(${0.5 + Math.random() * 0.5})`;
            if (backgroundAnimations) backgroundAnimations.appendChild(petal);
        }
    } else if (theme === 'sky') {
        for (let i = 0; i < 3; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            cloud.style.left = `${-400 - Math.random() * 400}px`;
            cloud.style.top = `${20 + Math.random() * 50}vh`;
            cloud.style.animationDuration = `${20 + Math.random() * 40}s`;
            cloud.style.animationDelay = `-${Math.random() * 40}s`;
            if (backgroundAnimations) backgroundAnimations.appendChild(cloud);
        }
    } else if (theme === 'neon') {
        if (blobContainer) blobContainer.classList.add('hidden');
    }

    if (lastStats) {
        renderCharts(lastStats);
    }
    if (animeData.length > 0) {
        renderWatchingTab();
    }
    if (seasonalAnimeData) {
        renderSeasonalAnime(null, null, seasonalAnimeData);
    }
}

function applyConfigToUI() {
    const headerH1 = document.querySelector('header h1');
    const headerP = document.querySelector('header p');
    const configTitleInput = document.getElementById('config-title');
    const configSubtitleInput = document.getElementById('config-subtitle');
    const configApiKeyInput = document.getElementById('config-api-key');
    const configItemsPerPageInput = document.getElementById('config-items-per-page');
    const configTrackerLimitInput = document.getElementById('config-tracker-limit');
    const configGenreLimitInput = document.getElementById('config-genre-limit');

    if (headerH1) headerH1.textContent = window.CONFIG.DASHBOARD_TITLE;
    if (headerP) headerP.textContent = window.CONFIG.DASHBOARD_SUBTITLE;
    ITEMS_PER_PAGE = window.CONFIG.EPISODES_PER_PAGE || 25;

    if (configTitleInput) configTitleInput.value = window.CONFIG.DASHBOARD_TITLE;
    if (configSubtitleInput) configSubtitleInput.value = window.CONFIG.DASHBOARD_SUBTITLE;
    if (configApiKeyInput) configApiKeyInput.value = GEMINI_API_KEY;
    if (configItemsPerPageInput) configItemsPerPageInput.value = window.CONFIG.EPISODES_PER_PAGE;
    if (configTrackerLimitInput) configTrackerLimitInput.value = window.CONFIG.ACTIVE_TRACKER_LIMIT;
    if (configGenreLimitInput) configGenreLimitInput.value = window.CONFIG.CHART_GENRE_LIMIT;

    if (lastStats) {
        renderCharts(lastStats);
    }
    if (animeData.length > 0) {
        renderWatchingTab();
        renderAnimeTable(animeData); // Initial render without filters
    }
    if (typeof renderGachaState === 'function') {
        renderGachaState();
    }
}

function checkForSavedData() {
    try {
        const savedData = localStorage.getItem('animeDashboardData');
        const savedGachaState = localStorage.getItem('animeGachaState');

        if (savedData) {
            animeData = JSON.parse(savedData);
            lastStats = calculateStatistics(animeData);
        }

        // Initialize gacha state variables if they don't exist yet
        window.gachaTokens = window.gachaTokens || 0;
        window.gachaShards = window.gachaShards || 0;
        window.totalPulls = window.totalPulls || 0;
        window.episodesWatchedTotal = window.episodesWatchedTotal || 0;
        window.waifuCollection = window.waifuCollection || [];
        window.ownedCosmetics = window.ownedCosmetics || [];
        window.appliedCosmetics = window.appliedCosmetics || {};

        if (savedGachaState) {
            const state = JSON.parse(savedGachaState);
            window.gachaTokens = state.gachaTokens || 0;
            window.gachaShards = state.gachaShards || 0;
            window.totalPulls = state.totalPulls || 0;
            window.episodesWatchedTotal = state.episodesWatchedTotal || 0;
            window.waifuCollection = state.waifuCollection || [];
            window.ownedCosmetics = state.ownedCosmetics || [];
            window.appliedCosmetics = state.appliedCosmetics || {};
        } else {
            // If no saved gacha state, initialize based on anime data or defaults
            if (animeData.length > 0 && typeof updateGachaTokens === 'function') {
                updateGachaTokens(); // Calculate tokens based on existing list
            } else {
                window.gachaTokens = window.CONFIG.GACHA_INITIAL_TOKENS || 5;
                window.episodesWatchedTotal = 0; // Ensure it starts at 0 if no anime data
            }
        }

    } catch (e) {
        console.error("Could not load data from local storage", e);
        localStorage.removeItem('animeDashboardData');
        localStorage.removeItem('animeGachaState');
        // Reset gacha state to defaults if loading fails
        window.gachaTokens = window.CONFIG.GACHA_INITIAL_TOKENS || 5;
        window.gachaShards = 0;
        window.totalPulls = 0;
        window.episodesWatchedTotal = 0;
        window.waifuCollection = [];
        window.ownedCosmetics = [];
        window.appliedCosmetics = {};
    }
}


function downloadEnrichedJSON() {
    const errorMessage = document.getElementById('error-message');
    if (!animeData || animeData.length === 0) {
        showError(errorMessage, "No anime data to download!");
        setTimeout(() => showError(errorMessage, null), 3000);
        return;
    }
    const jsonString = JSON.stringify(animeData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enhanced_anime_list.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


// ************************************************************
// --- SECTION B: CONFIGURATION MANAGEMENT ---
// ************************************************************

function showSettingsModal() {
    applyConfigToUI();
    const modal = document.getElementById('settings-modal-backdrop');
    if(modal) modal.classList.add('show');
}

function saveAndGenerateConfigFile() {
    const configTitleInput = document.getElementById('config-title');
    const configSubtitleInput = document.getElementById('config-subtitle');
    const configApiKeyInput = document.getElementById('config-api-key');
    const configItemsPerPageInput = document.getElementById('config-items-per-page');
    const configTrackerLimitInput = document.getElementById('config-tracker-limit');
    const configGenreLimitInput = document.getElementById('config-genre-limit');
    const settingsKeyError = document.getElementById('settings-key-error');

    const newTitle = configTitleInput.value.trim();
    const newSubtitle = configSubtitleInput.value.trim();
    const newApiKey = configApiKeyInput.value.trim();
    const newItemsPerPage = parseInt(configItemsPerPageInput.value, 10);
    const newTrackerLimit = parseInt(configTrackerLimitInput.value, 10);
    const newGenreLimit = parseInt(configGenreLimitInput.value, 10);

    // Keep GACHA settings from the current config unless inputs are added for them
    const currentGachaEpisodes = window.CONFIG.GACHA_EPISODES_PER_TOKEN || 50;
    const currentGachaInitial = window.CONFIG.GACHA_INITIAL_TOKENS || 5;

    // API Key validation remains important for AI features
    if (!newApiKey && (window.CONFIG.GEMINI_API_KEY === "")) { // Only require if not already set
        if(settingsKeyError) {
            settingsKeyError.textContent = "API Key is required for AI features.";
            settingsKeyError.classList.remove('hidden');
        }
        // Don't return, allow saving other settings even without API key
    } else {
       if (settingsKeyError) settingsKeyError.classList.add('hidden');
    }


    GEMINI_API_KEY = newApiKey || window.CONFIG.GEMINI_API_KEY; // Use new key or keep old one
    window.CONFIG.DASHBOARD_TITLE = newTitle;
    window.CONFIG.DASHBOARD_SUBTITLE = newSubtitle;
    window.CONFIG.GEMINI_API_KEY = GEMINI_API_KEY;
    window.CONFIG.EPISODES_PER_PAGE = newItemsPerPage;
    window.CONFIG.ACTIVE_TRACKER_LIMIT = newTrackerLimit;
    window.CONFIG.CHART_GENRE_LIMIT = newGenreLimit;
    // Persist existing Gacha settings
    window.CONFIG.GACHA_EPISODES_PER_TOKEN = currentGachaEpisodes;
    window.CONFIG.GACHA_INITIAL_TOKENS = currentGachaInitial;


    const configContent = `// --- Auto-generated Configuration File (config.js) ---\n`+
                          `// NOTE: Save this file AS config.js in your project root.\n`+
                          `// GEMINI_API_KEY is sensitive. Do not share this file publicly if set.\n` +
                          `window.CONFIG = {\n` +
                          `    DASHBOARD_TITLE: "${newTitle}",\n` +
                          `    DASHBOARD_SUBTITLE: "${newSubtitle}",\n` +
                          `    GEMINI_API_KEY: "${GEMINI_API_KEY}",\n` + // Use the potentially updated key
                          `    EPISODES_PER_PAGE: ${newItemsPerPage},\n` +
                          `    ACTIVE_TRACKER_LIMIT: ${newTrackerLimit},\n` +
                          `    CHART_GENRE_LIMIT: ${newGenreLimit},\n` +
                          `    GACHA_EPISODES_PER_TOKEN: ${currentGachaEpisodes},\n` + // Use current value
                          `    GACHA_INITIAL_TOKENS: ${currentGachaInitial}\n` +   // Use current value
                          `};\n`;

    const blob = new Blob([configContent], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const modal = document.getElementById('settings-modal-backdrop');
    if(modal) modal.classList.remove('show');
    applyConfigToUI(); // Re-apply to reflect saved settings immediately
}


// ************************************************************
// --- SECTION C: APPLICATION FLOW & LISTENERS ---
// ************************************************************

document.addEventListener('DOMContentLoaded', () => {
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

    applyConfigToUI();
    loadTheme();
    checkForSavedData(); // Load saved data and gacha state

    // Check if user needs to login vs welcome back
    const savedDataExists = localStorage.getItem('animeDashboardData') !== null;
    if (savedDataExists && animeData.length > 0) { // Check if loaded data is actually valid
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('welcome-back-screen').classList.remove('hidden');
    } else {
        // Assume login is needed, attempt initial sync
        syncWithAnilist(); // This will handle showing login if unauthorized
    }

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
    if (settingsButton) settingsButton.addEventListener('click', showSettingsModal);
    if (settingsSaveButton) settingsSaveButton.addEventListener('click', saveAndGenerateConfigFile);
    if (settingsCancelButton) settingsCancelButton.addEventListener('click', () => {
        const modal = document.getElementById('settings-modal-backdrop');
        if (modal) modal.classList.remove('show');
    });
    if (searchBar) searchBar.addEventListener('input', applyTableFiltersAndSort);
    if (statusFilter) statusFilter.addEventListener('change', applyTableFiltersAndSort);
    if (genreFilter) genreFilter.addEventListener('change', applyTableFiltersAndSort);
    if (gachaRollButton && typeof rollGacha === 'function') {
        gachaRollButton.addEventListener('click', rollGacha);
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
                // No need to reset page for scrolling list
                renderAnimeTable(animeData, searchBar.value, statusFilter.value, genreFilter.value);
            }
        });
    }
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') setTheme(e.target.dataset.theme);
        });
    }
    if (tabNav) {
        tabNav.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const tab = e.target.dataset.tab;
                setActiveTab(tab);
                if (tab === 'calendar' && !seasonalAnimeData) fetchSeasonalAnime();
            }
        });
    }
    if (geminiButton) geminiButton.addEventListener('click', getGeminiRecommendations);
    if (downloadJsonBtn) downloadJsonBtn.addEventListener('click', downloadEnrichedJSON);
    if (similarModalClose) similarModalClose.addEventListener('click', () => {
        const modal = document.getElementById('similar-modal-backdrop');
        if (modal) modal.classList.remove('show');
    });
    const cosmeticModalClose = document.getElementById('cosmetic-modal-close');
    if (cosmeticModalClose) cosmeticModalClose.addEventListener('click', () => {
         const modal = document.getElementById('cosmetic-modal-backdrop');
         if (modal) modal.classList.remove('show');
    });
    document.addEventListener('click', (e) => {
        if (e.target.id === 'similar-modal-backdrop') {
            e.target.classList.remove('show');
        }
        if (e.target.id === 'cosmetic-modal-backdrop') {
            e.target.classList.remove('show');
        }
         if (e.target.id === 'settings-modal-backdrop') {
             e.target.classList.remove('show');
         }
    });
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-episode-btn')) {
            incrementEpisode(e.target.dataset.title);
        }
    });
});


// ************************************************************
// --- SECTION D: APPLICATION LOGIC FUNCTIONS ---
// ************************************************************

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
        if(welcomeScreen) welcomeScreen.classList.add('hidden');
        const dashboardScreen = document.getElementById('dashboard-screen');
        if (dashboardScreen) dashboardScreen.classList.add('hidden');

        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Server error: ${response.statusText}` }));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
         throw new Error("Received invalid data format from server.");
      }
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


async function logout() {
    try {
        await fetch('/logout');
    } catch (error) {
        console.error("Failed to communicate with logout endpoint:", error);
    } finally {
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

        window.location.href = '/';
    }
}

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
    renderCharts(lastStats);
    renderAnimeTable(data);
    renderWatchingTab();

    if(typeof updateGachaTokens === 'function') {
        updateGachaTokens();
    } else {
        console.warn("updateGachaTokens function not found. Gacha state might be incorrect.");
    }
    if (typeof renderGachaState === 'function') {
        renderGachaState();
    } else {
         console.warn("renderGachaState function not found.");
    }

    setActiveTab('watching');
    if (document.getElementById('gemini-response')) document.getElementById('gemini-response').innerHTML = '';
    showLoading(false);
    if (dashboardScreen) dashboardScreen.classList.remove('hidden');
    setTimeout(() => { if (dashboardScreen) dashboardScreen.classList.add('loaded'); }, 10);
}


function applyTableFiltersAndSort() {
    const searchBar = document.getElementById('search-bar');
    const statusFilter = document.getElementById('status-filter');
    const genreFilter = document.getElementById('genre-filter');
    renderAnimeTable(animeData, searchBar ? searchBar.value : '', statusFilter ? statusFilter.value : 'all', genreFilter ? genreFilter.value : 'all');
}


// ************************************************************
// --- SECTION E: API FUNCTIONS (Jikan & Gemini) ---
// ************************************************************

async function fetchSeasonalAnime() {
    const calendarLoading = document.getElementById('calendar-loading');
    const calendarContent = document.getElementById('calendar-content');

    if (calendarLoading) calendarLoading.classList.remove('hidden');
    if (calendarContent) calendarContent.innerHTML = '';

    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        let year = today.getFullYear();
        let season;

         if (month >= 1 && month <= 3) { season = 'winter'; }
         else if (month >= 4 && month <= 6) { season = 'spring'; }
         else if (month >= 7 && month <= 9) { season = 'summer'; }
         else { season = 'fall'; } // Oct, Nov, Dec

        const apiUrl = `https://api.jikan.moe/v4/seasons/${year}/${season}`;
        const response = await fetch(apiUrl);

        if (response.status === 429) {
             await new Promise(resolve => setTimeout(resolve, 2000));
             const retryResponse = await fetch(apiUrl);
             if (!retryResponse.ok) {
                 throw new Error(`Failed to fetch season schedule (retry): ${retryResponse.statusText}`);
             }
             const result = await retryResponse.json();
             seasonalAnimeData = result.data;
        } else if (!response.ok) {
            throw new Error(`Failed to fetch season schedule: ${response.statusText}`);
        } else {
           const result = await response.json();
           seasonalAnimeData = result.data;
        }

        renderSeasonalAnime(season, year, seasonalAnimeData);

    } catch (error) {
        console.error("Calendar fetch error:", error);
        if (calendarContent) calendarContent.innerHTML = `<p class="text-center text-red-500">Failed to load schedule. API may be unavailable or rate limited.</p>`;
    } finally {
        if (calendarLoading) calendarLoading.classList.add('hidden');
    }
}


function renderSeasonalAnime(season, year, data) {
    const calendarContent = document.getElementById('calendar-content');
    const calendarHeader = document.getElementById('calendar-header');

    if (!calendarContent) return;

    if (season && year && calendarHeader) {
        calendarHeader.textContent = `${season.charAt(0).toUpperCase() + season.slice(1)} ${year} Anime`;
    }

    calendarContent.innerHTML = '';

    if (!data || data.length === 0) {
        calendarContent.innerHTML = `<p class="text-center text-gray-500 py-4">No seasonal anime found.</p>`;
        return;
    }

    const displayData = data.slice(0, 20);

    displayData.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card calendar-card p-4 rounded-lg flex flex-col group';
        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || 'https://placehold.co/225x350/cccccc/333333?text=No+Image';
        const title = anime.title || 'Unknown Title';
        const score = anime.score ? `⭐ ${anime.score.toFixed(1)}` : 'N/A';
        const genres = anime.genres?.map(g => g.name).slice(0, 3).join(', ') || 'Unknown';
        card.innerHTML = `
            <div class="w-full h-48 mb-3 overflow-hidden rounded-lg">
                <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110">
            </div>
            <h3 class="font-bold text-sm mb-2 line-clamp-2 calendar-card-title">${title}</h3>
            <div class="mt-auto text-xs space-y-1">
                <p class="calendar-card-text"><span class="font-semibold">Score:</span> ${score}</p>
                <p class="calendar-card-text line-clamp-1"><span class="font-semibold">Genres:</span> ${genres}</p>
            </div>
        `;
        calendarContent.appendChild(card);
    });
}


async function getSimilarAnime(anime) {
    const similarModalBody = document.getElementById('similar-modal-body');
    const similarModalBackdrop = document.getElementById('similar-modal-backdrop');
    const similarModalTitle = document.getElementById('similar-modal-title');
    if (!GEMINI_API_KEY) {
        if (similarModalBody) similarModalBody.innerHTML = `<p class="text-red-500">AI features disabled. Please set your key in Settings ⚙️.</p>`;
        if (similarModalBackdrop) similarModalBackdrop.classList.add('show');
        return;
    }

    if (similarModalTitle) similarModalTitle.textContent = `Anime similar to "${anime.title}"`;
    if (similarModalBody) similarModalBody.innerHTML = `<svg class="animate-spin h-8 w-8 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    if (similarModalBackdrop) similarModalBackdrop.classList.add('show');

    const genresText = anime.genres && anime.genres.length > 0 ? `which has the genres: ${anime.genres.join(', ')}` : "which has unknown genres";
    const prompt = `I enjoyed the anime "${anime.title}", ${genresText}. Please recommend three other anime series that have a similar theme, tone, or style. For each, provide a title and a one-sentence synopsis. Format the response as simple HTML with <h4> for titles and <p> for the synopsis. Do not include markdown like \`\`\`html.`;


    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
        const result = await response.json();

        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
             throw new Error("Invalid response structure from Gemini API.");
        }

        const text = result.candidates[0].content.parts[0].text;
        if (similarModalBody) {
            if (text) similarModalBody.innerHTML = text.replace(/\n/g, '<br>');
            else throw new Error("No content from API.");
        }
    } catch (error) {
        console.error("Gemini Similar Anime Error:", error);
        if (similarModalBody) similarModalBody.innerHTML = `<p class="text-red-500">Sorry, could not get recommendations. ${error.message}</p>`;
    }
}


async function getGeminiRecommendations() {
    const geminiResponse = document.getElementById('gemini-response');
    const geminiLoading = document.getElementById('gemini-loading');
    const geminiButton = document.getElementById('gemini-button');

    if (!GEMINI_API_KEY) {
        if (geminiResponse) geminiResponse.innerHTML = `<p class="text-red-500"><strong>Error:</strong> AI features disabled. Please set your key in Settings ⚙️.</p>`;
        return;
    }

    if (!lastStats || !lastStats.genreCounts || Object.keys(lastStats.genreCounts).length === 0) {
        if (geminiResponse) geminiResponse.innerHTML = `<p>Please sync your anime list first to get personalized recommendations.</p>`;
        return;
    }

    const topGenres = Object.entries(lastStats.genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, window.CONFIG.CHART_GENRE_LIMIT || 10);

    if (topGenres.length === 0) {
        if (geminiResponse) geminiResponse.innerHTML = `<p>Your anime list doesn't contain enough genre information for recommendations.</p>`;
        return;
    }

    const prompt = `Based on my favorite anime genres (${topGenres.map(g => g[0]).join(', ')}), recommend three other anime series I might enjoy. For each, provide a title and a one-sentence synopsis explaining why I might like it based on my genres. Format as simple HTML with <h4> for titles and <p> for the synopsis. Do not include markdown like \`\`\`html.`;

    if (geminiLoading) geminiLoading.classList.remove('hidden');
    if (geminiButton) geminiButton.disabled = true;
    if (geminiResponse) geminiResponse.innerHTML = '';

    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
        const result = await response.json();

        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
             throw new Error("Invalid response structure from Gemini API.");
        }
        const text = result.candidates[0].content.parts[0].text;
        if (geminiResponse) {
            if (text) geminiResponse.innerHTML = text.replace(/\n/g, '<br>');
            else throw new Error("No content from API.");
        }
    } catch (error) {
        console.error("Gemini API Recommendations Error:", error);
        if (geminiResponse) geminiResponse.innerHTML = `<p class="text-red-500">Sorry, could not get recommendations. ${error.message}</p>`;
    } finally {
        if (geminiLoading) geminiLoading.classList.add('hidden');
        if (geminiButton) geminiButton.disabled = false;
    }
}


// ************************************************************
// --- SECTION G: STATISTICS & DATA HELPERS ---
// ************************************************************

function parseDurationToMinutes(durationStr, episodesWatched) {
    if (!durationStr || typeof durationStr !== 'string') return episodesWatched * 24;

    const perEpisodeMatch = durationStr.match(/(\d+)\s*min.*per ep/i);
    if (perEpisodeMatch) {
        const minutesPerEp = parseInt(perEpisodeMatch[1], 10);
        return minutesPerEp * episodesWatched;
    }

    let totalMinutes = 0;
    const hourMatch = durationStr.match(/(\d+)\s*hr/i);
    const minMatch = durationStr.match(/(\d+)\s*min/i);
    if (hourMatch) totalMinutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) totalMinutes += parseInt(minMatch[1], 10);

    if (totalMinutes === 0 && /^\d+$/.test(durationStr.trim())) {
        totalMinutes = parseInt(durationStr.trim(), 10);
        return (episodesWatched <= 1) ? totalMinutes : episodesWatched * 24;
    }

    return totalMinutes > 0 ? totalMinutes : episodesWatched * 24;
}


function calculateStatistics(data) {
    if (!Array.isArray(data)) {
      console.error("Invalid data type passed to calculateStatistics:", data);
      return { totalAnime: 0, totalEpisodes: 0, timeWatchedDays: 0, totalMinutes: 0, timeWatchedHours: 0, timeWatchedMinutes: 0, meanScore: 0, genreCounts: {}, scoreCounts: {} };
    }
    const watchedAnime = data.filter(a => a.status && (a.status.toLowerCase() === 'completed' || a.status.toLowerCase() === 'current'));
    const scoredAnime = watchedAnime.filter(a => a.score > 0);

    const totalAnime = watchedAnime.length;
    const totalEpisodes = watchedAnime.reduce((sum, a) => sum + (Number(a.episodesWatched) || 0), 0);
    window.episodesWatchedTotal = totalEpisodes;

    const totalMinutes = watchedAnime.reduce((sum, anime) => sum + parseDurationToMinutes(anime.duration, Number(anime.episodesWatched) || 0), 0);

    const timeWatchedDays = Math.floor(totalMinutes / (60 * 24));
    const timeWatchedHours = Math.floor((totalMinutes / 60) % 24);
    const timeWatchedMinutes = totalMinutes % 60;

    const meanScore = scoredAnime.length > 0
        ? (scoredAnime.reduce((sum, a) => sum + a.score, 0) / scoredAnime.length).toFixed(2)
        : 0;

    const genreCounts = {};
    watchedAnime.forEach(a => {
        if (a.genres && Array.isArray(a.genres)) {
            a.genres.forEach(genre => genreCounts[genre] = (genreCounts[genre] || 0) + 1);
        }
    });

    const scoreCounts = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 };
     watchedAnime.forEach(a => {
        const scoreKey = a.score !== null && a.score !== undefined ? Math.round(a.score).toString() : '0';
        if (scoreCounts[scoreKey] !== undefined) {
             scoreCounts[scoreKey]++;
         } else {
             scoreCounts['0']++;
         }
     });
     if (scoreCounts['0'] === 0) {
         delete scoreCounts['0'];
     }

    return { totalAnime, totalEpisodes, timeWatchedDays, totalMinutes, timeWatchedHours, timeWatchedMinutes, meanScore, genreCounts, scoreCounts };
}

function renderStats({ totalAnime, totalEpisodes, timeWatchedDays, timeWatchedHours, timeWatchedMinutes, meanScore }) {
    if (document.getElementById('total-anime')) document.getElementById('total-anime').textContent = totalAnime;
    if (document.getElementById('total-episodes')) document.getElementById('total-episodes').textContent = totalEpisodes.toLocaleString();
    if (document.getElementById('time-watched')) document.getElementById('time-watched').textContent = `${timeWatchedDays}d ${timeWatchedHours}h ${timeWatchedMinutes}m`;
    if (document.getElementById('mean-score')) document.getElementById('mean-score').textContent = meanScore;
}


// ************************************************************
// --- SECTION H: TRACKER & LIST RENDERING ---
// ************************************************************

function incrementEpisode(title) {
    const anime = animeData.find(a => a.title === title);
    if (!anime) return;

    let currentProgress = Number(anime.episodesWatched) || 0;
    const totalEps = Number(anime.totalEpisodes) || 0;

    if (totalEps === 0 || currentProgress < totalEps) {
        currentProgress++;
        anime.episodesWatched = currentProgress;
    }

    if (totalEps > 0 && currentProgress >= totalEps) {
        anime.status = 'Completed';
    }

    lastStats = calculateStatistics(animeData);
    if(typeof updateGachaTokens === 'function') updateGachaTokens();

    saveDataToLocalStorage(animeData);
    renderStats(lastStats);
    renderWatchingTab();

    const listTab = document.getElementById('list-tab');
    if (listTab && !listTab.classList.contains('hidden')) {
        applyTableFiltersAndSort();
    }
}


function formatAiringTime(airingAt) {
    if (!airingAt) return "Airing time unknown";
    const now = Date.now() / 1000;
    const diffInSeconds = airingAt - now;

    if (diffInSeconds <= 0) {
        return "Aired";
    }

    const days = Math.floor(diffInSeconds / 86400);
    const hours = Math.floor((diffInSeconds % 86400) / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);

    if (days > 1) {
        return `airs in ${days} days`;
    }
    if (days === 1) {
         return `airs in 1 day ${hours}h`;
    }
    if (hours > 0) {
        return `airs in ${hours}h ${minutes}m`;
    }
    if (minutes > 0){
       return `airs in ${minutes}m`;
    }
    return `airs very soon`;
}


function renderWatchingTab() {
    const watchingContent = document.getElementById('watching-content');
    if (!watchingContent) return;

    const activeShows = animeData.filter(a => a.status === 'Current')
        .sort((a, b) => (a.title.toLowerCase() > b.title.toLowerCase()) ? 1 : -1);

    watchingContent.innerHTML = '';

    if (activeShows.length === 0) {
        watchingContent.innerHTML = `<p class="col-span-full text-center text-gray-500 py-8">You are not currently watching any anime.</p>`;
        return;
    }

    activeShows.forEach(anime => {
        const total = Number(anime.totalEpisodes) || 0;
        const progress = Number(anime.episodesWatched) || 0;
        const percentage = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
        const score = anime.score > 0 ? `⭐ ${anime.score}` : 'Not Scored';
        const totalDisplay = total > 0 ? total : '?';

        const card = document.createElement('div');
        card.className = 'anime-card p-4 rounded-lg flex flex-col group';

        const imageUrl = anime.coverImage || 'https://placehold.co/300x450/cccccc/333333?text=No+Image';

        let airingInfoHtml = '';
        let airingInfoText = ''; // For the overlay
        if (anime.airingSchedule && anime.airingSchedule.airingAt) {
            airingInfoText = `Ep ${anime.airingSchedule.episode || '?'} ${formatAiringTime(anime.airingSchedule.airingAt)}`;
            airingInfoHtml = `<div class="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">${airingInfoText}</div>`;
        }

        let linksHtml = '';
        if (anime.externalLinks && Array.isArray(anime.externalLinks) && anime.externalLinks.length > 0) {
            const streamingSites = ['Crunchyroll', 'Funimation', 'Netflix', 'HIDIVE', 'Hulu', 'Amazon Prime Video', 'VRV', 'AnimeLab'];
            const streamingLinks = anime.externalLinks.filter(link =>
                link.site && streamingSites.some(site => link.site.includes(site))
            );
            if (streamingLinks.length > 0) {
                linksHtml = '<div class="flex flex-wrap gap-2 mt-2">';
                streamingLinks.slice(0, 3).forEach(link => {
                    linksHtml += `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full hover:bg-gray-300 transition-colors">${link.site}</a>`;
                });
                linksHtml += '</div>';
            }
        }

        const isCompleted = total > 0 && progress >= total;
        const buttonDisabled = isCompleted ? 'disabled' : '';
        const buttonText = isCompleted ? 'Completed' : '+1 Episode';

        card.innerHTML = `
            <div class="w-full h-64 mb-3 overflow-hidden rounded-lg relative">
                <img src="${imageUrl}" alt="${anime.title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110">
                 ${airingInfoHtml}
            </div>
            <h3 class="font-bold text-md mb-1 line-clamp-2 calendar-card-title">${anime.title}</h3>
            <div class="flex items-center justify-between text-sm text-gray-600 calendar-card-text">
                <span>${score}</span>
                <span>${progress} / ${totalDisplay}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
            </div>
            <div class="mt-auto pt-3 flex flex-col justify-between flex-grow">
                 ${linksHtml || '<div class="h-6"></div>'}
                 <button class="add-episode-btn btn-primary text-sm font-medium py-1 px-3 rounded-lg mt-3 w-full ${buttonDisabled ? 'opacity-50 cursor-not-allowed' : ''}" data-title="${anime.title}" ${buttonDisabled}>
                     ${buttonText}
                 </button>
            </div>
        `;
        watchingContent.appendChild(card);
    });
}


function renderAnimeTable(fullData, titleFilter = '', statusFilter = 'all', genreFilter = 'all') {
    const animeListBody = document.getElementById('anime-list-body');
    const animeTableHead = document.getElementById('anime-table-head');
    if (!animeListBody || !animeTableHead) return;

    const lowerCaseTitleFilter = titleFilter.toLowerCase();

    let filteredData = fullData.filter(a => {
        const titleMatch = a.title && a.title.toLowerCase().includes(lowerCaseTitleFilter);
        const statusMatch = statusFilter === 'all' || (a.status && a.status.toLowerCase() === statusFilter.toLowerCase());
        const genreMatch = genreFilter === 'all' || (a.genres && Array.isArray(a.genres) && a.genres.includes(genreFilter));
        return titleMatch && statusMatch && genreMatch;
    });

    filteredData.sort((a, b) => {
        const valA = a[currentSort.column];
        const valB = b[currentSort.column];
        let comparison = 0;
        const safeValA = (typeof valA === 'string' ? valA : (valA || ''));
        const safeValB = (typeof valB === 'string' ? valB : (valB || ''));
        if (typeof safeValA === 'string' && typeof safeValB === 'string') {
            comparison = safeValA.localeCompare(safeValB);
        } else {
            comparison = (Number(valA) || 0) - (Number(valB) || 0);
        }
        return currentSort.direction === 'desc' ? comparison * -1 : comparison;
    });

    animeTableHead.querySelectorAll('.sortable-header').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.sort === currentSort.column) {
            header.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });

    // --- RENDER ALL FILTERED DATA ---
    animeListBody.innerHTML = filteredData.length === 0 ? `<tr><td colspan="5" class="text-center p-4 text-gray-500">No anime found matching your filters.</td></tr>` : '';

    filteredData.forEach(anime => {
        const mainRow = document.createElement('tr');
        mainRow.className = 'main-row border-b border-gray-200 hover:bg-gray-100 cursor-pointer transition duration-150 ease-in-out';
        mainRow.setAttribute('data-anime-title', anime.title);
        const displayScore = anime.score > 0 ? anime.score : 'N/A';
        const displayProgress = `${Number(anime.episodesWatched) || 0}/${Number(anime.totalEpisodes) > 0 ? anime.totalEpisodes : '?'}`;
        const displayGenres = anime.genres && anime.genres.length > 0
                             ? anime.genres.slice(0, 2).join(', ') + (anime.genres.length > 2 ? '...' : '')
                             : 'N/A';

        mainRow.innerHTML = `
            <td class="p-3 font-medium">${anime.title || 'Unknown Title'}</td>
            <td class="p-3 text-center">${displayScore}</td>
            <td class="p-3 text-center">${displayProgress}</td>
            <td class="p-3 text-sm">${displayGenres}</td>
            <td class="p-3 text-center"><svg class="w-4 h-4 text-gray-500 transform transition-transform duration-200 inline-block rotate-0 drawer-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></td>
        `;
        const drawerRow = document.createElement('tr');
        drawerRow.className = 'drawer-row hidden bg-gray-50 border-b border-gray-200';
        drawerRow.innerHTML = `<td colspan="5" class="p-0"><div class="drawer-content p-4 text-sm text-gray-600 transition-all duration-300 overflow-hidden" style="max-height: 0px;"></div></td>`;

        animeListBody.appendChild(mainRow);
        animeListBody.appendChild(drawerRow);
    });
    // --- END RENDER ---

    animeListBody.removeEventListener('click', toggleDetailsDrawer);
    animeListBody.addEventListener('click', toggleDetailsDrawer);

    // --- REMOVED PAGINATION CALL ---
    // renderPaginationControls(filteredData.length);
}


function toggleDetailsDrawer(e) {
    const mainRow = e.target.closest('.main-row');
    if (!mainRow) return;

    const title = mainRow.getAttribute('data-anime-title');
    const anime = animeData.find(a => a.title === title);
    if (!anime) return;

    const drawerRow = mainRow.nextElementSibling;
    if (!drawerRow || !drawerRow.classList.contains('drawer-row')) return;

    const drawerContent = drawerRow.querySelector('.drawer-content');
    const arrowIcon = mainRow.querySelector('.drawer-arrow');
    if (!drawerContent || !arrowIcon) return;

    const isHidden = drawerRow.classList.contains('hidden');

    document.querySelectorAll('.drawer-row:not(.hidden)').forEach(openDrawer => {
        const openMainRow = openDrawer.previousElementSibling;
        if (openMainRow !== mainRow && openMainRow) {
            openDrawer.classList.add('hidden');
            const openContent = openDrawer.querySelector('.drawer-content');
            if (openContent) openContent.style.maxHeight = '0px';
            openMainRow.classList.remove('bg-gray-100');
            const openArrow = openMainRow.querySelector('.drawer-arrow');
            if (openArrow) openArrow.classList.remove('rotate-180');
        }
    });

    if (isHidden) {
        drawerRow.classList.remove('hidden');
        arrowIcon.classList.add('rotate-180');
        mainRow.classList.add('bg-gray-100');

        const escapedTitle = anime.title ? anime.title.replace(/'/g, "\\'") : '';
        const similarButtonHtml = `<button class="similar-btn btn-primary text-sm font-medium py-1 px-3 rounded-lg mt-3" onclick="getSimilarAnime(animeData.find(a => a.title === '${escapedTitle}'))" title="Find Similar Anime">Find Similar Anime ✨</button>`;
        const genresText = anime.genres && anime.genres.length > 0 ? anime.genres.join(', ') : 'N/A';
        const formatText = anime.type || 'N/A';
        const durationText = anime.duration || 'Approx. 24 min/ep';

        drawerContent.innerHTML = `
            <p class="text-sm">
                <span class="font-semibold">Genres:</span> ${genresText}<br>
                <span class="font-semibold">Format:</span> ${formatText}<br>
                <span class="font-semibold">Duration:</span> ${durationText}<br>
            </p>
            ${similarButtonHtml}
        `;
        setTimeout(() => { drawerContent.style.maxHeight = drawerContent.scrollHeight + 'px'; }, 10);

    } else {
        drawerContent.style.maxHeight = '0px';
        arrowIcon.classList.remove('rotate-180');
        mainRow.classList.remove('bg-gray-100');
        drawerContent.addEventListener('transitionend', e => {
            if (e.propertyName === 'max-height' && drawerContent.style.maxHeight === '0px') {
                drawerRow.classList.add('hidden');
            }
        }, { once: true });
    }
}

// --- REMOVED PAGINATION FUNCTION ---
/*
function renderPaginationControls(totalItems) {
    // ... function content deleted ...
}
*/


// ************************************************************
// --- SECTION I: CHARTS & FILTERS ---
// ************************************************************

function renderCharts({ genreCounts, scoreCounts }) {
    const genreChartCanvas = document.getElementById('genre-chart');
    const genreChartFallback = document.getElementById('genre-chart-fallback');
    const scoreChartCanvas = document.getElementById('score-chart');
    if (!genreChartCanvas || !scoreChartCanvas) return;

    if (genreChartInstance) genreChartInstance.destroy();
    if (scoreChartInstance) scoreChartInstance.destroy();

    const theme = document.body.className;
    const chartFontColor = theme.includes('neon') ? '#e2e8f0' : '#4A5568';
    const chartGridColor = theme.includes('neon') ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
    const chartBorderColor = theme.includes('neon') ? '#0f172a' : (theme.includes('sakura') ? '#fff1f2' : (theme.includes('sky') ? '#f0f9ff' : '#F0F4F8'));


    const sortedGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, window.CONFIG.CHART_GENRE_LIMIT || 10);

    if (sortedGenres.length > 0) {
        genreChartCanvas.style.display = 'block';
        if (genreChartFallback) genreChartFallback.classList.add('hidden');
        genreChartInstance = new Chart(genreChartCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: sortedGenres.map(g => g[0]),
                datasets: [{
                    data: sortedGenres.map(g => g[1]),
                    backgroundColor: ['#818cf8', '#f472b6', '#60a5fa', '#fb923c', '#a78bfa', '#f87171', '#4ade80', '#2dd4bf', '#fbbf24', '#93c5fd', '#fde047', '#d946ef'],
                    borderColor: chartBorderColor,
                    borderWidth: 3,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                           color: chartFontColor,
                           boxWidth: 12,
                           padding: 10
                        }
                    },
                     tooltip: {
                         bodyFont: { size: 12 },
                         titleFont: { size: 14 }
                     }
                }
            }
        });
    } else {
        genreChartCanvas.style.display = 'none';
        if (genreChartFallback) genreChartFallback.classList.remove('hidden');
    }

    const scoreLabels = Object.keys(scoreCounts).sort((a,b) => Number(a) - Number(b));
    const scoreData = scoreLabels.map(label => scoreCounts[label]);

    let barColor = '#6366F1';
    if (theme.includes('theme-sakura')) barColor = '#F472B6';
    else if (theme.includes('theme-sky')) barColor = '#38BDF8';
    else if (theme.includes('theme-neon')) barColor = '#e879f9';


    scoreChartInstance = new Chart(scoreChartCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: scoreLabels,
            datasets: [{
                label: 'Number of Anime',
                data: scoreData,
                backgroundColor: barColor,
                borderColor: barColor,
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: barColor
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                 tooltip: {
                      callbacks: {
                          label: function(context) {
                              let label = context.dataset.label || '';
                              if (label) { label += ': '; }
                              if (context.parsed.y !== null) {
                                  label += context.parsed.y;
                              }
                              return label;
                          }
                      }
                  }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: chartGridColor },
                    ticks: {
                       color: chartFontColor,
                       precision: 0
                    },
                    title: {
                        display: true,
                        text: 'Count',
                        color: chartFontColor,
                        font: { size: 12 }
                     }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: chartFontColor },
                     title: {
                         display: true,
                         text: 'Score',
                         color: chartFontColor,
                         font: { size: 12 }
                     }
                }
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            }
        }
    });
}


function populateFilters(data) {
    const statusFilterEl = document.getElementById('status-filter');
    const genreFilterEl = document.getElementById('genre-filter');
    if (!statusFilterEl || !genreFilterEl) return;

    const statuses = [...new Set(data.map(a => a.status).filter(Boolean))].sort();
    const genres = [...new Set(data.flatMap(a => a.genres || []).filter(Boolean))].sort();


    statusFilterEl.innerHTML = '<option value="all">All Statuses</option>';
    genreFilterEl.innerHTML = '<option value="all">All Genres</option>';

    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        statusFilterEl.appendChild(option);
    });

    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreFilterEl.appendChild(option);
    });
}