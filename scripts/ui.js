// =====================================================================
// ui.js – UI helpers & render utilities (aligned with your HTML & data)
// =====================================================================

import { showToast, showConfirm } from './toast.js';

/* ------------------------------------------------------------------ *
 * 0) Small utilities
 * ------------------------------------------------------------------ */
const $  = (id) => document.getElementById(id);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const first = (...xs) => xs.find(v => typeof v === 'string' && v != null && String(v).trim().length) || null;

/* Time helpers */
function formatAbsolute(ts) {
  const ms = ts < 2e12 ? ts * 1000 : ts; // seconds → ms if needed
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}
function formatRelative(ts) {
  const ms = ts < 2e12 ? ts * 1000 : ts;
  const now = Date.now();
  let diff = Math.max(0, ms - now);
  const sec = Math.floor(diff/1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`);
  return parts.length ? `in ${parts.join(' ')}` : 'soon';
}

/* Escape HTML for safe rendering */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Escape attribute values */
function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ------------------------------------------------------------------ *
 * 1) Basic UI helpers
 * ------------------------------------------------------------------ */
export function showError(errorMessageElement, message) {
  if (errorMessageElement) {
    errorMessageElement.textContent = message || '';
    errorMessageElement.classList.toggle('hidden', !message);
  }
}

export function showLoading(isLoading, text = 'Syncing with AniList...') {
  const loadingSpinnerEl   = $('loading-spinner');
  const loginScreenEl      = $('login-screen');
  const loginBoxEl         = $('login-box');
  const welcomeBackScreen  = $('welcome-back-screen');
  const dashboardScreen    = $('dashboard-screen');
  const loadingTextEl      = $('loading-text');

  if (isLoading) {
    loginScreenEl?.classList.remove('hidden');
    welcomeBackScreen?.classList.add('hidden');
    dashboardScreen?.classList.add('hidden');
    loadingSpinnerEl?.classList.remove('hidden');
    loginBoxEl?.classList.add('hidden');
    if (loadingTextEl) loadingTextEl.textContent = text;
  } else {
    // Note: This function is primarily for showing loading *during* sync.
    // Hiding the login screen happens in other functions (processAndRenderDashboard, checkLoginStatus)
    loadingSpinnerEl?.classList.add('hidden');
    // We don't automatically show loginBoxEl here as it might conflict with other UI states
  }
}

export function setActiveTab(activeTab) {
  const tabNav = $('tab-nav');
  const tabContents = $$('.tab-content');

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

  // Trigger gacha render if that tab is activated and initialized
  if (activeTab === 'gacha' && typeof window.renderGachaState === 'function' && window.isGachaInitialized) {
    window.renderGachaState();
  }
}

/* Optional theming hook (If needed, though themes.js handles main logic) */
export function pushThemeToBody(theme) {
  // themes.js already handles this with setTheme
  // document.body.className = `theme-${theme}`;
}

/* ------------------------------------------------------------------ *
 * 2) Config / Settings display (Updated)
 * ------------------------------------------------------------------ */
export function applyConfigToUI(cfg = window.CONFIG || {}) {
  const headerH1 = document.querySelector('header h1');
  const headerP  = document.querySelector('header p');

  // Update header text based on config
  if (headerH1) headerH1.textContent = cfg.DASHBOARD_TITLE ?? 'My Anime Dashboard';
  if (headerP)  headerP.textContent  = cfg.DASHBOARD_SUBTITLE ?? 'Visualize your anime watching journey.'; // Added default subtitle

  // Helper to set input values safely
  const setVal = (id, val) => {
    const el = $(id);
    if (el != null && val != null) el.value = val;
  };

  // Set values in the settings modal
  setVal('config-title',            cfg.DASHBOARD_TITLE ?? 'My Anime Dashboard');
  setVal('config-subtitle',         cfg.DASHBOARD_SUBTITLE ?? ''); // Default empty subtitle in modal input
  setVal('config-api-key',          cfg.GEMINI_API_KEY ?? '');
  setVal('config-items-per-page',   cfg.EPISODES_PER_PAGE ?? 25);
  // Removed config-tracker-limit
  setVal('config-genre-limit',      cfg.CHART_GENRE_LIMIT ?? 10);
  setVal('config-gacha-ept',        cfg.GACHA_EPISODES_PER_TOKEN ?? 50); // Added Gacha EPT
  // Removed config-api-base as it wasn't in the provided HTML
}

export function showSettingsModal() {
  applyConfigToUI(window.CONFIG || {}); // Load current config into modal before showing
  const modal = $('settings-modal-backdrop');
  if (modal) modal.classList.add('show');
}

/* ------------------------------------------------------------------ *
 * 3) Filters UI helpers
 * ------------------------------------------------------------------ */
export function populateFilters(data) {
  const statusFilterEl = $('status-filter');
  const genreFilterEl  = $('genre-filter');
  if (!statusFilterEl || !genreFilterEl) return;

  // Extract unique statuses and genres from the data
  const statuses = [...new Set((data || []).map(a => a.status).filter(Boolean))].sort();
  const genres   = [...new Set((data || []).flatMap(a => a.genres || []).filter(Boolean))].sort();

  // Populate status dropdown
  statusFilterEl.innerHTML = '<option value="all">All Statuses</option>'; // Default option
  statuses.forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    statusFilterEl.appendChild(option);
  });

  // Populate genre dropdown
  genreFilterEl.innerHTML  = '<option value="all">All Genres</option>'; // Default option
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    genreFilterEl.appendChild(option);
  });
}

/* ------------------------------------------------------------------ *
 * 4) Core table filter/sort
 * ------------------------------------------------------------------ */
export function applyTableFiltersAndSort(data = [], currentSort = { column: 'title', direction: 'asc' }) {
  const searchInput = $('search-bar');
  const statusSelect = $('status-filter');
  const genreSelect = $('genre-filter');
  // const listCount = $('list-count'); // Assuming an element with this ID exists for count

  const q = (searchInput?.value || '').trim().toLowerCase();
  const chosenStatus = (statusSelect?.value || 'all'); // Keep case for comparison if needed
  const chosenGenre = (genreSelect?.value || 'all');

  let filteredData = Array.isArray(data) ? [...data] : [];

  // Apply search filter
  if (q) {
    filteredData = filteredData.filter(row => {
      const title = (row.title || '').toLowerCase();
      // Include alternative titles if they exist in your data structure
      // const alt = (row.alternativeTitle || '').toLowerCase();
      const genresString = (row.genres || []).map(g => (g || '').toLowerCase()).join(' ');
      return title.includes(q) /* || alt.includes(q) */ || genresString.includes(q);
    });
  }

  // Apply status filter
  if (chosenStatus !== 'all') {
    filteredData = filteredData.filter(row => (row.status || '') === chosenStatus);
  }

  // Apply genre filter
  if (chosenGenre !== 'all') {
    filteredData = filteredData.filter(row => (row.genres || []).includes(chosenGenre));
  }

  // Update count display (if element exists)
  // if (listCount) {
  //   listCount.textContent = `${filteredData.length} items`;
  // }

  // Render the table with the filtered and sorted data
  renderAnimeTable(filteredData, currentSort);
}

/* ------------------------------------------------------------------ *
 * 5) Enhanced table renderer
 * ------------------------------------------------------------------ */
export function renderAnimeTable(data = [], currentSort = { column: 'title', direction: 'asc' }) {
  const tbody = $('anime-list-body');
  const thead = $('anime-table-head');
  if (!tbody) return;

  // Update header sort indicators
  if (thead) {
    const headers = thead.querySelectorAll('.sortable-header');
    headers.forEach(header => {
      const column = header.dataset.sort;
      header.classList.remove('sort-asc', 'sort-desc'); // Clear previous sort indicators
      if (column === currentSort.column) {
        header.classList.add(`sort-${currentSort.direction}`); // Add current indicator
      }
    });
  }

  // Sort the data (using the helper function)
  const sorted = sortAnimeData(data, currentSort);

  // Handle empty state
  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center theme-text-secondary"> <div class="py-8">
            <p class="text-lg font-semibold mb-2 theme-text-primary">No anime found</p>
            <p class="text-sm">Try adjusting your search or filters</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Generate table rows
  const rows = sorted.map(a => {
    const title = a.title || 'Unknown';
    const score = a.score ?? 0; // Default score to 0 if null/undefined for class logic
    const scoreDisplay = a.score ?? '—'; // Display '—' if no score
    const watched = a.episodesWatched ?? a.progress ?? 0;
    const total = a.totalEpisodes ? `${watched}/${a.totalEpisodes}` : watched;
    const genres = Array.isArray(a.genres) ? a.genres.slice(0, 3).join(', ') : (a.genres || '—');
    const moreGenres = Array.isArray(a.genres) && a.genres.length > 3
      ? `<span class="text-xs ml-1 theme-text-muted">+${a.genres.length - 3}</span>` // Use theme variable
      : '';

    // Score color coding class
    const scoreClass = score === 0 ? 'score-none' : // Treat 0 as 'none' for styling
      score >= 8 ? 'score-high' :
      score >= 6 ? 'score-good' : // Adjusted threshold based on common scoring
      score >= 4 ? 'score-mid' : 'score-low';

    // Status badge HTML
    const statusBadge = getStatusBadge(a.status);

    return `
      <tr class="table-row" data-anime-title="${escapeAttr(title)}">
        <td class="p-3 title">
          <div class="flex flex-col gap-1">
            <span class="main-title font-medium">${escapeHtml(title)}</span>
            ${statusBadge}
          </div>
        </td>
        <td class="p-3 score text-center ${scoreClass}">${scoreDisplay}</td>
        <td class="p-3 episodes text-center font-medium">${total}</td>
        <td class="p-3 genres">
          <div class="text-sm">
            ${escapeHtml(genres)}${moreGenres}
          </div>
        </td>
        <td class="p-3 actions text-right">
          <div class="flex gap-2 justify-end">
            <button
              class="add-episode-btn px-3 py-1.5 text-sm rounded-lg font-medium"
              data-title="${escapeAttr(title)}"
              title="Increment episode count">
              +1 Ep
            </button>
            <button
              class="similar-btn px-3 py-1.5 text-sm rounded-lg font-medium"
              data-title="${escapeAttr(title)}"
              title="Find similar anime">
              Similar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

/**
 * Sort anime data by column (Helper for renderAnimeTable)
 */
function sortAnimeData(data, currentSort) {
  const sorted = [...data];
  const { column, direction } = currentSort;

  sorted.sort((a, b) => {
    let aVal, bVal;

    switch (column) {
      case 'title':
        aVal = (a.title || '').toLowerCase();
        bVal = (b.title || '').toLowerCase();
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);

      case 'score':
        // Treat null/undefined scores as 0 for sorting comparison
        aVal = Number(a.score ?? 0);
        bVal = Number(b.score ?? 0);
        return direction === 'asc' ? aVal - bVal : bVal - aVal;

      case 'episodesWatched':
        aVal = Number(a.episodesWatched || a.progress || 0);
        bVal = Number(b.episodesWatched || b.progress || 0);
        return direction === 'asc' ? aVal - bVal : bVal - aVal;

      default:
        return 0; // No sort if column is unrecognized
    }
  });

  return sorted;
}

/**
 * Generate status badge HTML (Helper for renderAnimeTable)
 */
function getStatusBadge(status) {
  if (!status) return '';

  // Map common statuses (case-insensitive) to specific classes and text
  const statusMap = {
    'current': { class: 'status-watching', text: 'Watching' },
    'watching': { class: 'status-watching', text: 'Watching' },
    'completed': { class: 'status-completed', text: 'Completed' },
    'planning': { class: 'status-planning', text: 'Plan to Watch' },
    'paused': { class: 'status-paused', text: 'Paused' },
    'on_hold': { class: 'status-paused', text: 'Paused' }, // Alias for MAL import
    'dropped': { class: 'status-dropped', text: 'Dropped' },
    'repeating': { class: 'status-repeating', text: 'Rewatching' },
    're-watching': { class: 'status-repeating', text: 'Rewatching' }, // Alias
  };

  const normalized = String(status).toLowerCase();
  // Use mapped badge or create a default one with the original status text
  const badge = statusMap[normalized] || { class: 'status-planning', text: status }; // Default to 'planning' style if unknown

  return `<span class="status-badge ${badge.class}">${escapeHtml(badge.text)}</span>`;
}

/* ------------------------------------------------------------------ *
 * 6) Stats renderer
 * ------------------------------------------------------------------ */
export function renderStats({
  totalAnime = 0,
  totalEpisodes = 0,
  timeWatchedDays = 0,
  timeWatchedHours = 0,
  timeWatchedMinutes = 0,
  meanScore = 0 // Assuming meanScore is already calculated and formatted
} = {}) {
  const setText = (el, val) => { if (el) el.textContent = val; };

  setText($('total-anime'), totalAnime);
  setText($('total-episodes'), Number(totalEpisodes).toLocaleString()); // Format with commas
  setText($('time-watched'), `${timeWatchedDays}d ${timeWatchedHours}h ${timeWatchedMinutes}m`);
  setText($('mean-score'), typeof meanScore === 'number' ? meanScore.toFixed(2) : meanScore); // Ensure 2 decimal places
}

/* ------------------------------------------------------------------ *
 * 7) Watching tab – (Removed - Now handled by airing.js)
 * ------------------------------------------------------------------ */
// The renderWatchingTab function is removed as renderEnhancedWatchingTab from airing.js is used instead.
// The helper functions (getNextAiring, describeNextEp, etc.) are also now in airing.js.

/* ------------------------------------------------------------------ *
 * 8) Data mutators expected by main.js
 * ------------------------------------------------------------------ */
// Helper function to update episode count in the animeData array
export function incrementEpisode(title, list = []) {
  // Create a new array with updated objects to avoid direct mutation
  return (list || []).map(anime => {
    if (anime.title === title) {
      const currentProgress = anime.episodesWatched ?? anime.progress ?? 0;
      return {
        ...anime,
        episodesWatched: currentProgress + 1, // Prefer episodesWatched
        progress: currentProgress + 1        // Update progress too for consistency if present
      };
    }
    return anime; // Return unchanged object if title doesn't match
  });
}

/* ------------------------------------------------------------------ *
 * 9) Settings → config.js helpers (Updated)
 * ------------------------------------------------------------------ */
function readConfigFromUI() {
  const get = (id) => $(id); // Use helper

  // Read values from the updated modal inputs
  return {
    DASHBOARD_TITLE: get('config-title')?.value || window.CONFIG?.DASHBOARD_TITLE || 'My Anime Dashboard',
    DASHBOARD_SUBTITLE: get('config-subtitle')?.value || window.CONFIG?.DASHBOARD_SUBTITLE || '',
    GEMINI_API_KEY: get('config-api-key')?.value || window.CONFIG?.GEMINI_API_KEY || '',
    EPISODES_PER_PAGE: Number(get('config-items-per-page')?.value ?? window.CONFIG?.EPISODES_PER_PAGE ?? 25),
    CHART_GENRE_LIMIT: Number(get('config-genre-limit')?.value ?? window.CONFIG?.CHART_GENRE_LIMIT ?? 10),
    GACHA_EPISODES_PER_TOKEN: Number(get('config-gacha-ept')?.value ?? window.CONFIG?.GACHA_EPISODES_PER_TOKEN ?? 50), // Added Gacha EPT
    // --- Preserve existing non-UI config values ---
    GACHA_INITIAL_TOKENS: Number(window.CONFIG?.GACHA_INITIAL_TOKENS ?? 5), // Keep if used
    GEMINI_MODEL: window.CONFIG?.GEMINI_MODEL || 'gemini-1.5-flash', // Keep
    // Removed API_BASE and ACTIVE_TRACKER_LIMIT
  };
}

// Generates the text content for the downloadable config.js file
export function buildConfigFileFromUI() {
  const cfg = readConfigFromUI();
  // Stringify the config object nicely formatted
  return `// Anime Dashboard Configuration
// Generated on ${new Date().toISOString()}

window.CONFIG = ${JSON.stringify(cfg, null, 2)};
`;
}

// Triggers the download of the generated config file
export function downloadConfigFile(fileText) {
  const blob = new Blob([fileText], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.js'; // Set filename
  document.body.appendChild(a);
  a.click(); // Programmatically click the link to trigger download
  a.remove(); // Clean up the link element
  URL.revokeObjectURL(url); // Free up browser resources
}

// Reads UI, generates config text, triggers download, and returns relevant values
export function saveAndGenerateConfigFile() {
  const cfg = readConfigFromUI(); // Read the latest values from the modal
  const fileText = buildConfigFileFromUI(); // Generate the file content
  downloadConfigFile(fileText); // Trigger the download

  // Return the relevant values that might need immediate updating in main.js state
  // (though often reloading with the new config.js is sufficient)
  return {
    CONFIG: cfg, // The full config object just read
    GEMINI_API_KEY: cfg.GEMINI_API_KEY || '',
    ITEMS_PER_PAGE: cfg.EPISODES_PER_PAGE || 25,
    // Add GACHA_EPISODES_PER_TOKEN if main.js needs it directly (unlikely)
  };
}