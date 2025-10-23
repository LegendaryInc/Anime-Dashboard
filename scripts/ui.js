// =====================================================================
// ui.js — UI helpers & render utilities (aligned with your HTML & data)
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
 * 4) Core table filter/sort used by main.js
 * ------------------------------------------------------------------ */
export function applyTableFiltersAndSort(data = []) {
  const searchInput = $('search-bar');
  const statusSelect = $('status-filter');
  const genreSelect  = $('genre-filter');
  const tableEl      = $('anime-table');

  const q            = (searchInput?.value || '').trim().toLowerCase();
  const chosenStatus = (statusSelect?.value || 'all').toLowerCase();
  const chosenGenre  = (genreSelect?.value || 'all').toLowerCase();

  let out = Array.isArray(data) ? [...data] : [];

  if (q) {
    out = out.filter(row => {
      const title  = (row.title || '').toLowerCase();
      const alt    = (row.alternativeTitle || '').toLowerCase();
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

  const sortKey = tableEl?.dataset?.sortKey || 'title';
  const sortDir = (tableEl?.dataset?.sortDir || 'asc').toLowerCase();

  const cmp = (a, b, key, numeric = false) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (numeric) {
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return an - bn;
    }
    const as = (av ?? '').toString().toLowerCase();
    const bs = (bv ?? '').toString().toLowerCase();
    return as.localeCompare(bs, undefined, { numeric: true });
  };

  const sorters = {
    title:     (a,b) => cmp(a,b,'title',false),
    score:     (a,b) => cmp(a,b,'score',true),
    episodes:  (a,b) => cmp(a,b,'episodesWatched',true),
    progress:  (a,b) => cmp(a,b,'progress',true),
  };

  const sorter = sorters[sortKey] || sorters.title;
  out.sort(sorter);
  if (sortDir === 'desc') out.reverse();

  return out;
}

/* ------------------------------------------------------------------ *
 * 5) Renderers expected by main.js
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

export function renderAnimeTable(data = [], currentSort = { column: 'title', direction: 'asc' }) {
  const tbody = $('anime-list-body');
  const table = $('anime-table');
  if (!tbody) return;

  const rows = data.map(a => {
    const title    = a.title || '';
    const score    = a.score ?? '';
    const episodes = a.episodesWatched ?? a.episodes ?? '';
    const progress = a.progress ?? '';
    const genres   = Array.isArray(a.genres) ? a.genres.join(', ') : (a.genres || '');

    return `
      <tr data-anime-title="${title}">
        <td class="title"><span class="main-title">${title}</span></td>
        <td class="score text-right">${score}</td>
        <td class="episodes text-right">${episodes}</td>
        <td class="progress text-right">${progress}</td>
        <td class="genres">${genres}</td>
        <td class="actions text-right">
          <button class="btn-secondary px-2 py-1 rounded add-episode-btn" data-title="${title}">+1 Episode</button>
          <button class="btn-primary px-2 py-1 rounded similar-btn" data-title="${title}">Find Similar</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;

  if (table) {
    table.dataset.sortKey = currentSort.column || 'title';
    table.dataset.sortDir = currentSort.direction || 'asc';
  }
}

/* ------------------------------------------------------------------ *
 * 6) Watching tab — thumbnails, links, and NEXT EPISODE info
 *    (aligned to backend shapes: coverImage string & airingSchedule{airingAt,episode})
 * ------------------------------------------------------------------ */
function getNextAiring(a) {
  // Primary: server’s normalized shape
  const ts1 = a?.airingSchedule?.airingAt;
  const ep1 = a?.airingSchedule?.episode;

  // Fallbacks for raw AniList / other shapes
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
    a?.coverImage,                                      // ✅ server’s normalized field
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
      <div class="watch-card" data-anime-title="${title}">
        <a class="watch-thumb" href="${link}" target="_blank" rel="noopener">
          <img src="${img}" alt="${title}" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='https://placehold.co/96x144/1f2937/94a3b8?text=No+Image';">
        </a>

        <div class="watch-info">
          <a class="watch-title" href="${link}" target="_blank" rel="noopener">${title}</a>
          <div class="watch-meta">Progress: ${progress}</div>
          ${nextText ? `<div class="watch-next">${nextText}</div>` : ''}
        </div>

        <div class="watch-actions">
          <!-- Let main.js's global handler catch this (expects data-title) -->
          <button class="btn-primary px-3 py-1 rounded add-episode-btn" data-title="${title}">+1 Episode</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ------------------------------------------------------------------ *
 * 7) Data mutators expected by main.js
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
 * 8) Settings → config.js helpers (used by main.js)
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
