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
    loadingSpinnerEl?.classList.add('hidden');
    loginBoxEl?.classList.remove('hidden');
    loginScreenEl?.classList.add('hidden');
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

  if (activeTab === 'gacha' && typeof window.renderGachaState === 'function') {
    window.renderGachaState();
  }
}

/* Optional theming hook */
export function pushThemeToBody(theme) {
  document.body.classList.remove('theme-sakura','theme-sky','theme-neon');
  if (theme) document.body.classList.add(`theme-${theme}`);
}

/* ------------------------------------------------------------------ *
 * 2) Config / Settings display
 * ------------------------------------------------------------------ */
export function applyConfigToUI(cfg = window.CONFIG || {}) {
  const headerH1 = document.querySelector('header h1');
  const headerP  = document.querySelector('header p');

  if (headerH1) headerH1.textContent = cfg.DASHBOARD_TITLE ?? 'My Anime Dashboard';
  if (headerP)  headerP.textContent  = cfg.DASHBOARD_SUBTITLE ?? '';

  const setVal = (id, val) => {
    const el = $(id);
    if (el != null && val != null) el.value = val;
  };

  setVal('config-title',            cfg.DASHBOARD_TITLE ?? 'My Anime Dashboard');
  setVal('config-subtitle',         cfg.DASHBOARD_SUBTITLE ?? '');
  setVal('config-api-key',          cfg.GEMINI_API_KEY ?? '');
  setVal('config-items-per-page',   cfg.EPISODES_PER_PAGE ?? 25);
  setVal('config-tracker-limit',    cfg.ACTIVE_TRACKER_LIMIT ?? 3);
  setVal('config-genre-limit',      cfg.CHART_GENRE_LIMIT ?? 10);
  setVal('config-gacha-ept',        cfg.GACHA_EPISODES_PER_TOKEN ?? 50);
  setVal('config-api-base',         cfg.API_BASE ?? '');
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
  genreFilterEl.innerHTML  = '<option value="all">All Genres</option>';

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

/* ------------------------------------------------------------------ *
 * 4) Core table filter/sort - FIXED VERSION
 * ------------------------------------------------------------------ */
export function applyTableFiltersAndSort(data = [], currentSort = { column: 'title', direction: 'asc' }) {
  const searchInput = $('search-bar');
  const statusSelect = $('status-filter');
  const genreSelect = $('genre-filter');

  const q = (searchInput?.value || '').trim().toLowerCase();
  const chosenStatus = (statusSelect?.value || 'all').toLowerCase();
  const chosenGenre = (genreSelect?.value || 'all').toLowerCase();

  let out = Array.isArray(data) ? [...data] : [];

  // Apply filters
  if (q) {
    out = out.filter(row => {
      const title = (row.title || '').toLowerCase();
      const alt = (row.alternativeTitle || '').toLowerCase();
      const genres = (row.genres || []).map(g => (g || '').toLowerCase()).join(' ');
      return title.includes(q) || alt.includes(q) || genres.includes(q);
    });
  }
  
  if (chosenStatus !== 'all') {
    out = out.filter(row => (row.status || '').toLowerCase() === chosenStatus);
  }
  
  if (chosenGenre !== 'all') {
    out = out.filter(row => (row.genres || []).some(g => (g || '').toLowerCase() === chosenGenre));
  }

  // Update count display
  const listCount = $('list-count');
  if (listCount) {
    listCount.textContent = out.length;
  }

  // ✅ Actually render the filtered results
  renderAnimeTable(out, currentSort);
}

/* ------------------------------------------------------------------ *
 * 5) Enhanced table renderer - THEME-AWARE VERSION
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
      
      // Remove existing classes
      header.classList.remove('sort-asc', 'sort-desc');
      
      // Add new class if this is the active column
      if (column === currentSort.column) {
        header.classList.add(`sort-${currentSort.direction}`);
      }
    });
  }

  // Sort the data
  const sorted = sortAnimeData(data, currentSort);

  // Render rows
  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center">
          <div class="py-8">
            <p class="text-lg font-semibold mb-2">No anime found</p>
            <p class="text-sm">Try adjusting your search or filters</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const rows = sorted.map(a => {
    const title = a.title || 'Unknown';
    const score = a.score ?? '—';
    const watched = a.episodesWatched ?? a.progress ?? 0;
    const total = a.totalEpisodes ? `${watched}/${a.totalEpisodes}` : watched;
    const genres = Array.isArray(a.genres) ? a.genres.slice(0, 3).join(', ') : (a.genres || '—');
    const moreGenres = Array.isArray(a.genres) && a.genres.length > 3 
      ? `<span class="text-xs ml-1">+${a.genres.length - 3}</span>` 
      : '';
    
    // Score color coding - removed hardcoded Tailwind classes
    const scoreClass = score === '—' ? 'score-none' :
      score >= 8 ? 'score-high' :
      score >= 6 ? 'score-good' :
      score >= 4 ? 'score-mid' : 'score-low';

    // Status badge
    const statusBadge = getStatusBadge(a.status);

    return `
      <tr class="table-row" data-anime-title="${escapeAttr(title)}">
        <td class="p-3 title">
          <div class="flex flex-col gap-1">
            <span class="main-title font-medium">${escapeHtml(title)}</span>
            ${statusBadge}
          </div>
        </td>
        <td class="p-3 score text-center ${scoreClass}">${score}</td>
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
        aVal = Number(a.score) || 0;
        bVal = Number(b.score) || 0;
        return direction === 'asc' ? aVal - bVal : bVal - aVal;

      case 'episodesWatched':
        aVal = Number(a.episodesWatched || a.progress) || 0;
        bVal = Number(b.episodesWatched || b.progress) || 0;
        return direction === 'asc' ? aVal - bVal : bVal - aVal;

      default:
        return 0;
    }
  });

  return sorted;
}

/**
 * Generate status badge HTML - THEME-AWARE VERSION
 */
function getStatusBadge(status) {
  if (!status) return '';
  
  const statusMap = {
    'current': { class: 'status-watching', text: 'Watching' },
    'watching': { class: 'status-watching', text: 'Watching' },
    'completed': { class: 'status-completed', text: 'Completed' },
    'planning': { class: 'status-planning', text: 'Plan to Watch' },
    'paused': { class: 'status-paused', text: 'Paused' },
    'dropped': { class: 'status-dropped', text: 'Dropped' },
    'repeating': { class: 'status-repeating', text: 'Rewatching' }
  };

  const normalized = status.toLowerCase();
  const badge = statusMap[normalized] || { class: 'status-badge', text: status };

  return `<span class="status-badge ${badge.class}">${badge.text}</span>`;
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
  setText($('mean-score'), meanScore);
}

/* ------------------------------------------------------------------ *
 * 7) Watching tab – thumbnails, links, and NEXT EPISODE info
 * ------------------------------------------------------------------ */
function getNextAiring(a) {
  const ts1 = a?.airingSchedule?.airingAt;
  const ep1 = a?.airingSchedule?.episode;

  const epAlt = a?.nextAiringEpisode?.episode ?? a?.nextEpisode?.number ?? a?.nextEpisodeNumber ?? null;
  const tsAlt =
    a?.nextAiringEpisode?.airingAt ??
    a?.nextEpisode?.airingAt ??
    a?.nextEpisodeAt ??
    a?.airingAt ??
    (Array.isArray(a?.airingSchedule?.nodes) && a.airingSchedule.nodes.length
      ? a.airingSchedule.nodes[0]?.airingAt
      : null) ??
    a?.broadcast?.nextEpisodeAt ??
    a?.broadcast?.time ??
    null;

  const ts = ts1 ?? tsAlt ?? null;
  const ep = ep1 ?? epAlt ?? null;
  if (!ts && !ep) return null;
  return { ts, episode: ep };
}

function describeNextEp(a) {
  const info = getNextAiring(a);
  if (!info) return null;
  const { episode, ts } = info;
  if (!ts) return episode ? `Next: Ep ${episode}` : null;
  return episode
    ? `Next: Ep ${episode} • ${formatAbsolute(ts)} (${formatRelative(ts)})`
    : `Next: ${formatAbsolute(ts)} (${formatRelative(ts)})`;
}

export function renderWatchingTab(data = [], /* onIncrement optional */) {
  const container = $('watching-content');
  if (!container) return;

  const pickThumb = (a) => first(
    a?.coverImage,
    a?.coverImage?.extraLarge, a?.coverImage?.large, a?.coverImage?.medium,
    a?.media?.coverImage?.extraLarge, a?.media?.coverImage?.large, a?.media?.coverImage?.medium,
    a?.posterImage?.original, a?.posterImage?.large, a?.posterImage?.small,
    a?.images?.jpg?.large_image_url, a?.images?.jpg?.image_url,
    a?.images?.webp?.large_image_url, a?.images?.webp?.image_url,
    a?.image_url, a?.imageUrl, a?.image, a?.thumbnail, a?.thumb, a?.poster, a?.picture,
    null
  ) || 'https://placehold.co/96x144/1f2937/94a3b8?text=No+Image';

  const pickLink = (a) => first(
    a?.watchUrl,
    a?.streamingEpisodeUrl,
    (() => {
      const arr = a?.externalLinks || a?.media?.externalLinks;
      if (!Array.isArray(arr)) return null;
      const pref = arr.find(x => (x?.site || '').toLowerCase().match(/crunchyroll|hidive|netflix|hulu|amazon|youtube|watch/));
      return pref?.url || arr[0]?.url || null;
    })(),
    a?.siteUrl,
    a?.url,
    `https://anilist.co/search/anime?search=${encodeURIComponent(a?.title || '')}`
  );

  const watching = (data || []).filter(a =>
    (a.status || '').toLowerCase() === 'current' ||
    (a.status || '').toLowerCase() === 'watching'
  );

  container.innerHTML = watching.map(a => {
    const img = pickThumb(a);
    const link = pickLink(a);
    const title = a.title || '';
    const progress = a.episodesWatched ?? a.progress ?? 0;
    const nextText = describeNextEp(a);

    return `
      <div class="watch-card" data-anime-title="${escapeAttr(title)}">
        <a class="watch-thumb" href="${link}" target="_blank" rel="noopener">
          <img src="${img}" alt="${escapeAttr(title)}" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='https://placehold.co/96x144/1f2937/94a3b8?text=No+Image';">
        </a>

        <div class="watch-info">
          <a class="watch-title" href="${link}" target="_blank" rel="noopener">${escapeHtml(title)}</a>
          <div class="watch-meta">Progress: ${progress}</div>
          ${nextText ? `<div class="watch-next">${nextText}</div>` : ''}
        </div>

        <div class="watch-actions">
          <button class="btn-primary px-3 py-1 rounded add-episode-btn" data-title="${escapeAttr(title)}">+1 Episode</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ------------------------------------------------------------------ *
 * 8) Data mutators expected by main.js
 * ------------------------------------------------------------------ */
export function incrementEpisode(title, list = []) {
  const out = (list || []).map(a => ({ ...a }));
  const i = out.findIndex(x => x.title === title);
  if (i === -1) return out;

  if (typeof out[i].episodesWatched === 'number') {
    out[i].episodesWatched = Math.max(0, out[i].episodesWatched + 1);
  } else if (typeof out[i].progress === 'number') {
    out[i].progress = Math.max(0, out[i].progress + 1);
  } else {
    out[i].episodesWatched = 1;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 9) Settings → config.js helpers (used by main.js)
 * ------------------------------------------------------------------ */
function readConfigFromUI() {
  const get = (id) => $(id);

  return {
    DASHBOARD_TITLE: get('config-title')?.value || window.CONFIG?.DASHBOARD_TITLE || 'My Anime Dashboard',
    DASHBOARD_SUBTITLE: get('config-subtitle')?.value || window.CONFIG?.DASHBOARD_SUBTITLE || '',
    GEMINI_API_KEY: get('config-api-key')?.value || window.CONFIG?.GEMINI_API_KEY || '',
    EPISODES_PER_PAGE: Number(get('config-items-per-page')?.value ?? window.CONFIG?.EPISODES_PER_PAGE ?? 25),
    ACTIVE_TRACKER_LIMIT: Number(window.CONFIG?.ACTIVE_TRACKER_LIMIT ?? 3),
    CHART_GENRE_LIMIT: Number(get('config-genre-limit')?.value ?? window.CONFIG?.CHART_GENRE_LIMIT ?? 10),
    GACHA_EPISODES_PER_TOKEN: Number(get('config-gacha-ept')?.value ?? window.CONFIG?.GACHA_EPISODES_PER_TOKEN ?? 50),
    GACHA_INITIAL_TOKENS: Number(window.CONFIG?.GACHA_INITIAL_TOKENS ?? 5),
    GEMINI_MODEL: window.CONFIG?.GEMINI_MODEL || 'gemini-2.5-flash',
    API_BASE: get('config-api-base')?.value || window.CONFIG?.API_BASE || '',
    ...(window.CONFIG?.GACHA_TOKEN ? { GACHA_TOKEN: window.CONFIG.GACHA_TOKEN } : {}),
  };
}

export function buildConfigFileFromUI() {
  const cfg = readConfigFromUI();
  return `window.CONFIG = ${JSON.stringify(cfg, null, 2)};`;
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
  const fileText = `window.CONFIG = ${JSON.stringify(cfg, null, 2)};`;
  downloadConfigFile(fileText);
  return {
    CONFIG: cfg,
    GEMINI_API_KEY: cfg.GEMINI_API_KEY || '',
    ITEMS_PER_PAGE: cfg.EPISODES_PER_PAGE || 25,
  };
}