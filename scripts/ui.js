// =====================================================================
// --- UI MODULE (ui.js) ---
// =====================================================================
// Contains all functions that directly manipulate the DOM,
// render components, or handle UI state (like modals).
// =====================================================================

// --- 1. UI Helpers (Modals, Loaders, Errors) ---

/**
 * Displays or hides an error message.
 * @param {HTMLElement} errorMessageElement - The DOM element for the error.
 * @param {string | null} message - The message to display, or null to hide.
 */
import { showToast, showConfirm } from './toast.js';
export function showError(errorMessageElement, message) {
  if (errorMessageElement) {
    errorMessageElement.textContent = message || '';
    errorMessageElement.classList.toggle('hidden', !message);
  }
}

/**
 * Shows or hides the main loading overlay.
 * @param {boolean} isLoading - Whether to show the loading spinner.
 * @param {string} [text='Syncing with AniList...'] - Optional text for the loader.
 */
export function showLoading(isLoading, text = 'Syncing with AniList...') {
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

/**
 * Sets the active navigation tab and content.
 * @param {string} activeTab - The data-tab value of the tab to activate.
 */
export function setActiveTab(activeTab) {
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

  // If the gacha tab is selected, call its render function
  // (assuming gacha.js has made it globally available or it's imported)
  if (activeTab === 'gacha' && typeof window.renderGachaState === 'function') {
    window.renderGachaState();
  }
  if (activeTab === 'watching' && typeof window.renderWatchingTab === 'function') {
    // This function might not exist yet, this is a placeholder
    // renderWatchingTab(); 
  }
}

// --- 2. Config & Settings Modal ---

/**
 * Applies values from window.CONFIG to the DOM.
 */
export function applyConfigToUI() {
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

  if (configTitleInput) configTitleInput.value = window.CONFIG.DASHBOARD_TITLE;
  if (configSubtitleInput) configSubtitleInput.value = window.CONFIG.DASHBOARD_SUBTITLE;
  if (configApiKeyInput) configApiKeyInput.value = window.CONFIG.GEMINI_API_KEY;
  if (configItemsPerPageInput) configItemsPerPageInput.value = window.CONFIG.EPISODES_PER_PAGE;
  if (configTrackerLimitInput) configTrackerLimitInput.value = window.CONFIG.ACTIVE_TRACKER_LIMIT;
  if (configGenreLimitInput) configGenreLimitInput.value = window.CONFIG.CHART_GENRE_LIMIT;
}

/**
 * Shows the settings modal.
 */
export function showSettingsModal() {
  applyConfigToUI(); // Ensure modal fields are up-to-date
  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) modal.classList.add('show');
}

/**
 * Reads settings from the modal, saves them, and generates a config.js file download.
 * @returns {object} The new config object and updated state variables.
 */
export function saveAndGenerateConfigFile() {
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

  const currentGachaEpisodes = window.CONFIG.GACHA_EPISODES_PER_TOKEN || 50;
  const currentGachaInitial = window.CONFIG.GACHA_INITIAL_TOKENS || 5;

  if (!newApiKey && (window.CONFIG.GEMINI_API_KEY === "")) {
    if (settingsKeyError) {
      settingsKeyError.textContent = "API Key is required for AI features.";
      settingsKeyError.classList.remove('hidden');
    }
  } else {
    if (settingsKeyError) settingsKeyError.classList.add('hidden');
  }

  // Update live config object
  const GEMINI_API_KEY = newApiKey || window.CONFIG.GEMINI_API_KEY;
  window.CONFIG.DASHBOARD_TITLE = newTitle;
  window.CONFIG.DASHBOARD_SUBTITLE = newSubtitle;
  window.CONFIG.GEMINI_API_KEY = GEMINI_API_KEY;
  window.CONFIG.EPISODES_PER_PAGE = newItemsPerPage;
  window.CONFIG.ACTIVE_TRACKER_LIMIT = newTrackerLimit;
  window.CONFIG.CHART_GENRE_LIMIT = newGenreLimit;
  window.CONFIG.GACHA_EPISODES_PER_TOKEN = currentGachaEpisodes;
  window.CONFIG.GACHA_INITIAL_TOKENS = currentGachaInitial;

  const configContent = `// --- Auto-generated Configuration File (config.js) ---\n` +
    `// NOTE: Save this file AS config.js in your project root.\n` +
    `// GEMINI_API_KEY is sensitive. Do not share this file publicly if set.\n` +
    `window.CONFIG = {\n` +
    `    DASHBOARD_TITLE: "${newTitle}",\n` +
    `    DASHBOARD_SUBTITLE: "${newSubtitle}",\n` +
    `    GEMINI_API_KEY: "${GEMINI_API_KEY}",\n` +
    `    EPISODES_PER_PAGE: ${newItemsPerPage},\n` +
    `    ACTIVE_TRACKER_LIMIT: ${newTrackerLimit},\n` +
    `    CHART_GENRE_LIMIT: ${newGenreLimit},\n` +
    `    GACHA_EPISODES_PER_TOKEN: ${currentGachaEpisodes},\n` +
    `    GACHA_INITIAL_TOKENS: ${currentGachaInitial}\n` +
    `};\n`;

  const blob = new Blob([configContent], {
    type: 'application/javascript'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const modal = document.getElementById('settings-modal-backdrop');
  if (modal) modal.classList.remove('show');

  // Return new state for main.js to use
  return {
    CONFIG: window.CONFIG,
    GEMINI_API_KEY: GEMINI_API_KEY,
    ITEMS_PER_PAGE: newItemsPerPage
  };
}


// --- 3. Dashboard Component Renderers ---

/**
 * Renders the 4 main stat cards.
 * @param {object} stats - The calculated statistics object.
 */
export function renderStats({
  totalAnime,
  totalEpisodes,
  timeWatchedDays,
  timeWatchedHours,
  timeWatchedMinutes,
  meanScore
}) {
  if (document.getElementById('total-anime')) document.getElementById('total-anime').textContent = totalAnime;
  if (document.getElementById('total-episodes')) document.getElementById('total-episodes').textContent = totalEpisodes.toLocaleString();
  if (document.getElementById('time-watched')) document.getElementById('time-watched').textContent = `${timeWatchedDays}d ${timeWatchedHours}h ${timeWatchedMinutes}m`;
  if (document.getElementById('mean-score')) document.getElementById('mean-score').textContent = meanScore;
}

/**
 * Populates the filter dropdowns for the list tab.
 * @param {Array} data - The user's anime data.
 */
export function populateFilters(data) {
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

/**
 * Handles the logic for incrementing an episode.
 * @param {string} title - The title of the anime to increment.
 * @param {Array} animeData - The *entire* anime data array.
 * @returns {Array} The *modified* anime data array.
 */
export function incrementEpisode(title, animeData) {
  const anime = animeData.find(a => a.title === title);
  if (!anime) return animeData;

  let currentProgress = Number(anime.episodesWatched) || 0;
  const totalEps = Number(anime.totalEpisodes) || 0;

  if (totalEps === 0 || currentProgress < totalEps) {
    currentProgress++;
    anime.episodesWatched = currentProgress;
  }

  if (totalEps > 0 && currentProgress >= totalEps) {
    anime.status = 'Completed';
  }
  
  // Return the modified array so main.js can update its state
  return animeData;
}

/**
 * Formats the airing time string.
 * @param {number} airingAt - The UNIX timestamp of the airing.
 * @returns {string} A human-readable string.
 */
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
  if (minutes > 0) {
    return `airs in ${minutes}m`;
  }
  return `airs very soon`;
}

/**
 * Renders the "Watching" tab with active shows.
 * @param {Array} animeData - The user's anime data.
 * @param {Function} onIncrement - Callback function to run when "+1 Episode" is clicked.
 */
export function renderWatchingTab(animeData, onIncrement) {
  const watchingContent = document.getElementById('watching-content');
  if (!watchingContent) return;

  const activeShows = animeData.filter(a => a.status === 'Current')
    .sort((a, b) => (a.title.toLowerCase() > b.title.toLowerCase()) ? 1 : -1);

  watchingContent.innerHTML = ''; // Clear old content

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
    if (anime.airingSchedule && anime.airingSchedule.airingAt) {
      const airingInfoText = `Ep ${anime.airingSchedule.episode || '?'} ${formatAiringTime(anime.airingSchedule.airingAt)}`;
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

/**
 * Applies filters and sorting to the main anime list.
 * @param {Array} animeData - The user's anime data.
 * @param {object} currentSort - The current sort state { column, direction }.
 */
export function applyTableFiltersAndSort(animeData, currentSort) {
  const searchBar = document.getElementById('search-bar');
  const statusFilter = document.getElementById('status-filter');
  const genreFilter = document.getElementById('genre-filter');
  
  renderAnimeTable(
    animeData,
    currentSort,
    searchBar ? searchBar.value : '',
    statusFilter ? statusFilter.value : 'all',
    genreFilter ? genreFilter.value : 'all'
  );
}

/**
 * Renders the full anime list table.
 * @param {Array} fullData - The user's anime data.
 * @param {object} currentSort - The current sort state { column, direction }.
 * @param {string} [titleFilter=''] - The search bar text.
 * @param {string} [statusFilter='all'] - The status dropdown value.
 * @param {string} [genreFilter='all'] - The genre dropdown value.
 */
export function renderAnimeTable(fullData, currentSort, titleFilter = '', statusFilter = 'all', genreFilter = 'all') {
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

  // Update sort arrow indicators
  animeTableHead.querySelectorAll('.sortable-header').forEach(header => {
    header.classList.remove('sort-asc', 'sort-desc');
    if (header.dataset.sort === currentSort.column) {
      header.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  animeListBody.innerHTML = filteredData.length === 0 ? `<tr><td colspan="5" class="text-center p-4 text-gray-500">No anime found matching your filters.</td></tr>` : '';

  filteredData.forEach(anime => {
    const mainRow = document.createElement('tr');
    mainRow.className = 'main-row border-b border-gray-200 hover:bg-gray-100 cursor-pointer transition duration-150 ease-in-out';
    mainRow.setAttribute('data-anime-title', anime.title);
    const displayScore = anime.score > 0 ? anime.score : 'N/A';
    const displayProgress = `${Number(anime.episodesWatched) || 0}/${Number(anime.totalEpisodes) > 0 ? anime.totalEpisodes : '?'}`;
    const displayGenres = anime.genres && anime.genres.length > 0 ?
      anime.genres.slice(0, 2).join(', ') + (anime.genres.length > 2 ? '...' : '') :
      'N/A';

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

  // Re-attach listener logic
  animeListBody.removeEventListener('click', toggleDetailsDrawer);
  animeListBody.addEventListener('click', (e) => toggleDetailsDrawer(e, fullData));
}

/**
 * (Private) Handles opening and closing the detail drawer in the anime list.
 * This function is not exported and is only called by renderAnimeTable.
 * @param {Event} e - The click event.
 * @param {Array} animeData - The user's anime data (needed to find the anime).
 */
function toggleDetailsDrawer(e, animeData) {
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

  // Close all other open drawers
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

    // Use data-attributes for the "Similar" button instead of onclick
    const similarButtonHtml = `<button class="similar-btn btn-primary text-sm font-medium py-1 px-3 rounded-lg mt-3" data-title="${anime.title}" title="Find Similar Anime">Find Similar Anime ✨</button>`;
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
    setTimeout(() => {
      drawerContent.style.maxHeight = drawerContent.scrollHeight + 'px';
    }, 10);

  } else {
    drawerContent.style.maxHeight = '0px';
    arrowIcon.classList.remove('rotate-180');
    mainRow.classList.remove('bg-gray-100');
    drawerContent.addEventListener('transitionend', e => {
      if (e.propertyName === 'max-height' && drawerContent.style.maxHeight === '0px') {
        drawerRow.classList.add('hidden');
      }
    }, {
      once: true
    });
  }
}