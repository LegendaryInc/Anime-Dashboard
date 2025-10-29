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
  const ms = ts < 2e12 ? ts * 1000 : ts;
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
    loadingSpinnerEl?.classList.add('hidden');
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

  if (activeTab === 'gacha' && typeof window.renderGachaState === 'function' && window.isGachaInitialized) {
    window.renderGachaState();
  }
}

export function pushThemeToBody(theme) {
  // themes.js already handles this with setTheme
}

/* ------------------------------------------------------------------ *
 * 2) Config / Settings display (Updated)
 * ------------------------------------------------------------------ */
export function applyConfigToUI(cfg = window.CONFIG || {}) {
  const headerH1 = document.querySelector('header h1');
  const headerP  = document.querySelector('header p');

  if (headerH1) headerH1.textContent = cfg.DASHBOARD_TITLE ?? 'My Anime Dashboard';
  if (headerP)  headerP.textContent  = cfg.DASHBOARD_SUBTITLE ?? 'Visualize your anime watching journey.';

  const setVal = (id, val) => {
    const el = $(id);
    if (el != null && val != null) el.value = val;
  };

  setVal('config-title',            cfg.DASHBOARD_TITLE ?? 'My Anime Dashboard');
  setVal('config-subtitle',         cfg.DASHBOARD_SUBTITLE ?? '');
  setVal('config-api-key',          cfg.GEMINI_API_KEY ?? '');
  setVal('config-items-per-page',   cfg.EPISODES_PER_PAGE ?? 25);
  setVal('config-genre-limit',      cfg.CHART_GENRE_LIMIT ?? 10);
  setVal('config-gacha-ept',        cfg.GACHA_EPISODES_PER_TOKEN ?? 50);
}

export function showSettingsModal() {
  applyConfigToUI(window.CONFIG || {});
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

  const statuses = [...new Set((data || []).map(a => a.status).filter(Boolean))].sort();
  const genres   = [...new Set((data || []).flatMap(a => a.genres || []).filter(Boolean))].sort();

  statusFilterEl.innerHTML = '<option value="all">All Statuses</option>';
  statuses.forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    statusFilterEl.appendChild(option);
  });

  genreFilterEl.innerHTML  = '<option value="all">All Genres</option>';
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

  const q = (searchInput?.value || '').trim().toLowerCase();
  const chosenStatus = (statusSelect?.value || 'all');
  const chosenGenre = (genreSelect?.value || 'all');

  let filteredData = Array.isArray(data) ? [...data] : [];

  if (q) {
    filteredData = filteredData.filter(row => {
      const title = (row.title || '').toLowerCase();
      const genresString = (row.genres || []).map(g => (g || '').toLowerCase()).join(' ');
      return title.includes(q) || genresString.includes(q);
    });
  }

  if (chosenStatus !== 'all') {
    filteredData = filteredData.filter(row => (row.status || '') === chosenStatus);
  }

  if (chosenGenre !== 'all') {
    filteredData = filteredData.filter(row => (row.genres || []).includes(chosenGenre));
  }

  renderAnimeTable(filteredData, currentSort);
}

/* ------------------------------------------------------------------ *
 * 5) Enhanced table renderer with editable scores
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
      header.classList.remove('sort-asc', 'sort-desc');
      if (column === currentSort.column) {
        header.classList.add(`sort-${currentSort.direction}`);
      }
    });
  }

  const sorted = sortAnimeData(data, currentSort);

  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center theme-text-secondary">
          <div class="py-8">
            <p class="text-lg font-semibold mb-2 theme-text-primary">No anime found</p>
            <p class="text-sm">Try adjusting your search or filters</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const rows = sorted.map(a => {
    const title = a.title || 'Unknown';
    const score = a.score ?? 0;
    const watched = a.episodesWatched ?? a.progress ?? 0;
    const total = a.totalEpisodes ? `${watched}/${a.totalEpisodes}` : watched;
    const genres = Array.isArray(a.genres) ? a.genres.slice(0, 3).join(', ') : (a.genres || '—');
    const moreGenres = Array.isArray(a.genres) && a.genres.length > 3
      ? `<span class="text-xs ml-1 theme-text-muted">+${a.genres.length - 3}</span>`
      : '';

    const scoreClass = score === 0 ? 'score-none' :
      score >= 8 ? 'score-high' :
      score >= 6 ? 'score-good' :
      score >= 4 ? 'score-mid' : 'score-low';

    const statusBadge = getStatusBadge(a.status);

    // Score display with edit functionality
    const scoreDisplay = score === 0 ? '—' : score.toFixed(1);
    const scoreHtml = `
      <div class="score-editor-container">
        <div class="score-display ${scoreClass}" data-anime-id="${escapeAttr(a.id)}" data-current-score="${score}">
          <span class="score-value">${scoreDisplay}</span>
          <button class="score-edit-btn" title="Edit score">✎</button>
        </div>
        <div class="score-editor hidden">
          <input 
            type="number" 
            class="score-input" 
            min="0" 
            max="10" 
            step="0.5" 
            value="${score}"
            data-anime-id="${escapeAttr(a.id)}"
            data-anime-title="${escapeAttr(title)}">
          <div class="score-actions">
            <button class="score-save-btn" title="Save">✓</button>
            <button class="score-cancel-btn" title="Cancel">✕</button>
          </div>
        </div>
      </div>
    `;

    return `
      <tr class="table-row" data-anime-title="${escapeAttr(title)}" data-anime-id="${escapeAttr(a.id)}">
        <td class="p-3 title">
          <div class="flex flex-col gap-1">
            <span class="main-title font-medium">${escapeHtml(title)}</span>
            ${statusBadge}
          </div>
        </td>
        <td class="p-3 score text-center">
          ${scoreHtml}
        </td>
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
 * Sort anime data by column
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
        aVal = Number(a.score ?? 0);
        bVal = Number(b.score ?? 0);
        return direction === 'asc' ? aVal - bVal : bVal - aVal;

      case 'episodesWatched':
        aVal = Number(a.episodesWatched || a.progress || 0);
        bVal = Number(b.episodesWatched || b.progress || 0);
        return direction === 'asc' ? aVal - bVal : bVal - aVal;

      default:
        return 0;
    }
  });

  return sorted;
}

/**
 * Generate status badge HTML
 */
function getStatusBadge(status) {
  if (!status) return '';

  const statusMap = {
    'current': { class: 'status-watching', text: 'Watching' },
    'watching': { class: 'status-watching', text: 'Watching' },
    'completed': { class: 'status-completed', text: 'Completed' },
    'planning': { class: 'status-planning', text: 'Plan to Watch' },
    'paused': { class: 'status-paused', text: 'Paused' },
    'on_hold': { class: 'status-paused', text: 'Paused' },
    'dropped': { class: 'status-dropped', text: 'Dropped' },
    'repeating': { class: 'status-repeating', text: 'Rewatching' },
    're-watching': { class: 'status-repeating', text: 'Rewatching' },
  };

  const normalized = String(status).toLowerCase();
  const badge = statusMap[normalized] || { class: 'status-planning', text: status };

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
  meanScore = 0
} = {}) {
  const setText = (el, val) => { if (el) el.textContent = val; };

  setText($('total-anime'), totalAnime);
  setText($('total-episodes'), Number(totalEpisodes).toLocaleString());
  setText($('time-watched'), `${timeWatchedDays}d ${timeWatchedHours}h ${timeWatchedMinutes}m`);
  setText($('mean-score'), typeof meanScore === 'number' ? meanScore.toFixed(2) : meanScore);
}

/* ------------------------------------------------------------------ *
 * 8) Data mutators expected by main.js
 * ------------------------------------------------------------------ */
export function incrementEpisode(title, list = []) {
  return (list || []).map(anime => {
    if (anime.title === title) {
      const currentProgress = anime.episodesWatched ?? anime.progress ?? 0;
      return {
        ...anime,
        episodesWatched: currentProgress + 1,
        progress: currentProgress + 1
      };
    }
    return anime;
  });
}

/**
 * Update anime score in the local data array
 */
export function updateAnimeScore(animeId, newScore, list = []) {
  return (list || []).map(anime => {
    if (anime.id === animeId) {
      return {
        ...anime,
        score: newScore
      };
    }
    return anime;
  });
}

/* ------------------------------------------------------------------ *
 * 9) Settings → config.js helpers
 * ------------------------------------------------------------------ */
function readConfigFromUI() {
  const get = (id) => $(id);

  return {
    DASHBOARD_TITLE: get('config-title')?.value || window.CONFIG?.DASHBOARD_TITLE || 'My Anime Dashboard',
    DASHBOARD_SUBTITLE: get('config-subtitle')?.value || window.CONFIG?.DASHBOARD_SUBTITLE || '',
    GEMINI_API_KEY: get('config-api-key')?.value || window.CONFIG?.GEMINI_API_KEY || '',
    EPISODES_PER_PAGE: Number(get('config-items-per-page')?.value ?? window.CONFIG?.EPISODES_PER_PAGE ?? 25),
    CHART_GENRE_LIMIT: Number(get('config-genre-limit')?.value ?? window.CONFIG?.CHART_GENRE_LIMIT ?? 10),
    GACHA_EPISODES_PER_TOKEN: Number(get('config-gacha-ept')?.value ?? window.CONFIG?.GACHA_EPISODES_PER_TOKEN ?? 50),
    GACHA_INITIAL_TOKENS: Number(window.CONFIG?.GACHA_INITIAL_TOKENS ?? 5),
    GEMINI_MODEL: window.CONFIG?.GEMINI_MODEL || 'gemini-1.5-flash',
  };
}

export function buildConfigFileFromUI() {
  const cfg = readConfigFromUI();
  return `// Anime Dashboard Configuration
// Generated on ${new Date().toISOString()}

window.CONFIG = ${JSON.stringify(cfg, null, 2)};
`;
}

export function downloadConfigFile(fileText) {
  const blob = new Blob([fileText], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.js';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function saveAndGenerateConfigFile() {
  const cfg = readConfigFromUI();
  const fileText = buildConfigFileFromUI();
  downloadConfigFile(fileText);

  return {
    CONFIG: cfg,
    GEMINI_API_KEY: cfg.GEMINI_API_KEY || '',
    ITEMS_PER_PAGE: cfg.EPISODES_PER_PAGE || 25,
  };
}