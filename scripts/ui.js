// =====================================================================
// ui.js — UI helpers & render utilities
// =====================================================================

import { showToast, showConfirm } from './toast.js';
import { showButtonLoading } from './loading.js';
import { convertToLazyLoad, observeNewImages } from './lazy-loading.js';
import { escapeHtml, escapeAttr } from './utils.js';

// Lazy import for custom lists (to avoid circular dependencies)
let renderAddToListButton = null;
async function getAddToListButton(animeId) {
  if (!renderAddToListButton) {
    const module = await import('./custom-lists-view.js');
    renderAddToListButton = module.renderAddToListButton;
  }
  if (renderAddToListButton) {
    return renderAddToListButton(animeId);
  }
  return ''; // Return empty if not available
}

/* ------------------------------------------------------------------ *
 * 0) Small utilities
 * ------------------------------------------------------------------ */
const $  = (id) => document.getElementById(id);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// escapeHtml and escapeAttr are now imported from utils.js

/* ------------------------------------------------------------------ *
 * 1) Basic UI helpers
 * ------------------------------------------------------------------ */

/**
 * Display an error message in the specified element
 * @param {HTMLElement|null} errorMessageElement - Element to display error in
 * @param {string} message - Error message to display
 */
export function showError(errorMessageElement, message) {
  if (errorMessageElement) {
    errorMessageElement.textContent = message || '';
    errorMessageElement.classList.toggle('hidden', !message);
  }
}

/**
 * Show or hide the loading spinner and manage screen visibility
 * @param {boolean} isLoading - Whether to show loading state
 * @param {string} text - Loading text to display (default: 'Syncing with AniList...')
 */
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

/**
 * Set the active tab and update UI accordingly
 * Handles tab visibility, ARIA attributes, and nested tab detection
 * @param {string} activeTab - ID of the tab to activate (e.g., 'watching', 'charts')
 */
export function setActiveTab(activeTab) {
  const tabNav = $('tab-nav');
  const tabContents = $$('.tab-content');

  if (tabNav) {
    tabNav.querySelectorAll('button[role="tab"]').forEach(btn => {
      const isActive = btn.dataset.tab === activeTab;
      btn.classList.toggle('active-tab', isActive);
      btn.classList.toggle('inactive-tab', !isActive);
      
      // Update ARIA attributes
      btn.setAttribute('aria-selected', isActive);
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  if (tabContents && tabContents.length > 0) {
    
    tabContents.forEach(content => {
      const isActive = content.id === `${activeTab}-tab`;
      if (isActive) {
        // Check if this tab is nested inside another tab (which shouldn't happen)
        const parentTab = content.closest('[id$="-tab"]');
        if (parentTab && parentTab !== content && parentTab.id !== `${activeTab}-tab`) {
          console.warn(`Tab ${content.id} is nested inside ${parentTab.id}, moving it out`);
          // Find the parent container that should hold all tabs (lg:col-span-3)
          const tabContainer = content.closest('.lg\\:col-span-3, [class*="col-span"]');
          if (tabContainer && tabContainer !== parentTab) {
            console.warn(`  Moving ${content.id} out of ${parentTab.id} to ${tabContainer.id || tabContainer.className}`);
            tabContainer.appendChild(content);
          }
        }
        
        // Remove hidden class and ensure visibility
        content.classList.remove('hidden');
        // Explicitly set visibility to ensure tab is shown
        content.style.display = 'block';
        content.style.visibility = 'visible';
        content.style.opacity = '';
        
        // Force a reflow to ensure styles are applied
        void content.offsetHeight;
        
        // Check if still has zero dimensions after setting visibility
        if (content.offsetHeight === 0 || content.offsetWidth === 0) {
          // Check all ancestors for hidden tabs or other hidden elements
          let ancestor = content.parentElement;
          let depth = 0;
          while (ancestor && ancestor !== document.body && depth < 5) {
            const ancestorStyle = window.getComputedStyle(ancestor);
            const isHidden = ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden' || ancestor.classList.contains('hidden');
            
            // If we find a hidden tab ancestor, move the content out of it
            if (isHidden && ancestor.id && ancestor.id.endsWith('-tab') && ancestor.id !== content.id) {
              // Find the parent container that should hold all tabs
              const tabContainer = content.closest('.lg\\:col-span-3, [class*="col-span"]');
              if (tabContainer && tabContainer !== ancestor) {
                tabContainer.appendChild(content);
                break; // Exit loop since we moved the element
              }
            } else if (isHidden && !ancestor.id?.endsWith('-tab')) {
              // Fix hidden non-tab ancestors
              ancestor.classList.remove('hidden');
              ancestor.style.display = '';
              ancestor.style.visibility = '';
              void ancestor.offsetHeight;
            }
            
            ancestor = ancestor.parentElement;
            depth++;
          }
          
          // Force a reflow after fixing ancestors
          void content.offsetHeight;
        }
      } else {
        // Add hidden class for inactive tabs and ensure they're hidden
        content.classList.add('hidden');
        // Force hide with inline style to ensure it's hidden
        content.style.display = 'none';
        content.style.visibility = 'hidden';
      }
      
      // Update ARIA attributes
      if (content.hasAttribute('role') && content.getAttribute('role') === 'tabpanel') {
        content.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      }
    });
  } else {
    console.warn('No tab content elements found!');
  }

  if (activeTab === 'gacha' && typeof window.renderGachaState === 'function' && window.isGachaInitialized) {
    window.renderGachaState();
  }

  if (activeTab === 'history' && typeof window.refreshHistoryView === 'function') {
    window.refreshHistoryView();
  }

  if (activeTab === 'achievements' && typeof window.refreshAchievementsView === 'function') {
    window.refreshAchievementsView();
  }
}

/* ------------------------------------------------------------------ *
 * 2) Config / Settings display
 * ------------------------------------------------------------------ */

/**
 * Apply configuration values to UI elements
 * @param {Object} cfg - Configuration object (defaults to window.CONFIG)
 */
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

/**
 * Show the settings modal
 * Handles modal visibility, parent detection, and accessibility
 */
export function showSettingsModal() {
  applyConfigToUI(window.CONFIG || {});
  const modal = $('settings-modal-backdrop');
  if (modal) {
    // Check if modal is in a hidden parent
    let parent = modal.parentElement;
    let parentHidden = false;
    while (parent && parent !== document.body) {
      const parentDisplay = window.getComputedStyle(parent).display;
      const parentVisibility = window.getComputedStyle(parent).visibility;
      if (parentDisplay === 'none' || parentVisibility === 'hidden' || parent.classList.contains('hidden')) {
        console.warn('Settings modal parent is hidden:', parent.id || parent.className, {
          display: parentDisplay,
          visibility: parentVisibility,
          hasHiddenClass: parent.classList.contains('hidden')
        });
        parentHidden = true;
        // Move modal to body if parent is hidden
        if (parent.classList.contains('hidden') || parentDisplay === 'none') {
          console.log('Moving settings modal to body...');
          document.body.appendChild(modal);
          break;
        }
      }
      parent = parent.parentElement;
    }
    
    // Reset scroll positions to ensure proper centering
    modal.scrollTop = 0;
    modal.scrollLeft = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Show modal immediately - force display first, then add class
    modal.style.display = 'block';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
    modal.style.visibility = 'visible';
    modal.style.zIndex = '100000'; // Higher than everything else
    modal.style.background = 'rgba(0, 0, 0, 0.5)'; // Force background color
    modal.style.position = 'fixed'; // Force position
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.classList.add('show');
    
    // Update ARIA attributes (set aria-hidden to false when showing)
    requestAnimationFrame(() => {
      modal.setAttribute('aria-hidden', 'false');
    });
    
    // Force a reflow to ensure centering is applied
    void modal.offsetHeight;
    
    // Double-check scroll position after showing
    requestAnimationFrame(() => {
      modal.scrollTop = 0;
      modal.scrollLeft = 0;
    });
    
    initSettingsTabs();
    loadSettingsFromStorage();
  }
}

/**
 * Initialize settings tab switching
 */
function initSettingsTabs() {
  const tabs = document.querySelectorAll('.settings-tab');
  const tabContents = document.querySelectorAll('.settings-tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      tabContents.forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('active');
      });
      
      const targetContent = document.getElementById(`settings-tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * Load settings from localStorage
 */
function loadSettingsFromStorage() {
  const settings = JSON.parse(localStorage.getItem('animeDashboardSettings') || '{}');
  
  // Load checkbox settings
  if (settings.autoSync !== undefined) {
    const checkbox = document.getElementById('settings-auto-sync');
    if (checkbox) checkbox.checked = settings.autoSync;
  }
  
  if (settings.saveData !== undefined) {
    const checkbox = document.getElementById('settings-save-data');
    if (checkbox) checkbox.checked = settings.saveData;
  }
  
  if (settings.enableNotifications !== undefined) {
    const checkbox = document.getElementById('settings-enable-notifications');
    if (checkbox) {
      checkbox.checked = settings.enableNotifications;
      toggleNotificationOptions(settings.enableNotifications);
    }
  }
  
  if (settings.notificationTime !== undefined) {
    const select = document.getElementById('settings-notification-time');
    if (select) select.value = settings.notificationTime;
  }
  
  if (settings.soundNotifications !== undefined) {
    const checkbox = document.getElementById('settings-sound-notifications');
    if (checkbox) checkbox.checked = settings.soundNotifications;
  }
  
  if (settings.defaultView !== undefined) {
    const select = document.getElementById('settings-default-view');
    if (select) select.value = settings.defaultView;
  }
  
  if (settings.showCoverImages !== undefined) {
    const checkbox = document.getElementById('settings-show-cover-images');
    if (checkbox) checkbox.checked = settings.showCoverImages;
  }
  
  if (settings.compactMode !== undefined) {
    const checkbox = document.getElementById('settings-compact-mode');
    if (checkbox) checkbox.checked = settings.compactMode;
  }
  
  if (settings.geminiModel !== undefined) {
    const select = document.getElementById('settings-gemini-model');
    if (select) select.value = settings.geminiModel;
  }
  
  // Setup notification toggle
  const notificationCheckbox = document.getElementById('settings-enable-notifications');
  if (notificationCheckbox) {
    notificationCheckbox.addEventListener('change', (e) => {
      toggleNotificationOptions(e.target.checked);
    });
  }
  
  // Setup API key visibility toggle
  const toggleKeyBtn = document.getElementById('toggle-api-key-visibility');
  const apiKeyInput = document.getElementById('config-api-key');
  if (toggleKeyBtn && apiKeyInput) {
    toggleKeyBtn.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleKeyBtn.textContent = isPassword ? '🙈' : '👁️';
    });
  }
}

/**
 * Toggle notification options visibility
 */
function toggleNotificationOptions(enabled) {
  const options = document.getElementById('notification-options');
  if (options) {
    options.classList.toggle('hidden', !enabled);
  }
}

/**
 * Save settings to localStorage
 */
export function saveSettingsToStorage() {
  const settings = {
    autoSync: document.getElementById('settings-auto-sync')?.checked || false,
    saveData: document.getElementById('settings-save-data')?.checked !== false,
    enableNotifications: document.getElementById('settings-enable-notifications')?.checked || false,
    notificationTime: document.getElementById('settings-notification-time')?.value || '5',
    soundNotifications: document.getElementById('settings-sound-notifications')?.checked || false,
    defaultView: document.getElementById('settings-default-view')?.value || 'table',
    showCoverImages: document.getElementById('settings-show-cover-images')?.checked !== false,
    compactMode: document.getElementById('settings-compact-mode')?.checked || false,
    geminiModel: document.getElementById('settings-gemini-model')?.value || 'gemini-1.5-flash',
  };
  
  localStorage.setItem('animeDashboardSettings', JSON.stringify(settings));
  return settings;
}

/* ------------------------------------------------------------------ *
 * 3) Filters UI helpers
 * ------------------------------------------------------------------ */

/**
 * Populate filter dropdowns with available options from anime data
 * @param {Array} data - Array of anime objects to extract filters from
 */
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
  
  // ⭐ UPDATED: Also populate genre multi-select for advanced filters
  const genreMultiSelect = document.getElementById('genre-multi-select');
  if (genreMultiSelect) {
    genreMultiSelect.innerHTML = genres.map(genre => 
      `<option value="${genre}">${genre}</option>`
    ).join('');
  }
}

/* ------------------------------------------------------------------ *
 * 4) Core table filter/sort
 * ------------------------------------------------------------------ */

/**
 * Apply filters and sorting to anime data for table view
 * @param {Array} data - Array of anime objects to filter/sort
 * @param {Object} currentSort - Sort configuration { column: string, direction: 'asc'|'desc' }
 * @returns {Array} Filtered and sorted array of anime objects
 */
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
 * 5) Enhanced table renderer with editable scores and status
 * ------------------------------------------------------------------ */

/**
 * Render anime data in table format with sorting and filtering
 * @param {Array} data - Array of anime objects to render
 * @param {Object} currentSort - Sort configuration { column: string, direction: 'asc'|'desc' }
 */
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
    
    // Genres display with tooltip for full list
    const genresArray = Array.isArray(a.genres) ? a.genres : [];
    const genresPreview = genresArray.length > 0 ? genresArray.slice(0, 3).join(', ') : '—';
    const hasMoreGenres = genresArray.length > 3;
    const moreGenresCount = hasMoreGenres ? `<span class="text-xs ml-1 theme-text-muted">+${genresArray.length - 3}</span>` : '';
    
    // Full genres tooltip
    const genresFullList = genresArray.length > 0 
      ? genresArray.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')
      : '';
    
    const genresHtml = genresArray.length > 0 && hasMoreGenres
      ? `<div class="genres-container">
           <span>${escapeHtml(genresPreview)}${moreGenresCount}</span>
           <div class="genres-tooltip">${genresFullList}</div>
         </div>`
      : `<span>${escapeHtml(genresPreview)}</span>`;

    const scoreClass = score === 0 ? 'score-none' :
      score >= 8 ? 'score-high' :
      score >= 6 ? 'score-good' :
      score >= 4 ? 'score-mid' : 'score-low';

    // Status badge for TITLE column
    const statusBadgeData = getStatusBadgeWithEditor(a.status, a.id, title);

    // Score editor HTML
    const scoreDisplay = score === 0 ? '—' : score.toFixed(1);
    const scoreHtml = `
      <div class="score-editor-container">
        <div class="score-display ${scoreClass}">
          <span>${scoreDisplay}</span>
          <button class="score-edit-btn" title="Edit score">✎</button>
        </div>
        <div class="score-editor hidden">
          <input 
            type="number" 
            class="score-input" 
            min="0" 
            max="10" 
            step="0.1" 
            value="${score}" 
            data-anime-id="${escapeAttr(a.id)}"
            data-anime-title="${escapeAttr(title)}"
          />
          <div class="score-actions">
            <button class="score-save-btn" title="Save">✓</button>
            <button class="score-cancel-btn" title="Cancel">✕</button>
          </div>
        </div>
      </div>
    `;

    // Status badge for PROGRESS column
    const progressStatusBadge = getStatusBadgeWithEditor(a.status, a.id, title);

    // Check if episode limit reached
    const canAddEpisode = !a.totalEpisodes || watched < a.totalEpisodes;
    const episodeButtonClass = canAddEpisode ? 'add-episode-btn' : 'add-episode-btn-disabled';
    const episodeButtonDisabled = canAddEpisode ? '' : 'disabled';

    return `
      <tr class="table-row" data-anime-title="${escapeAttr(title)}" data-anime-id="${escapeAttr(a.id)}" tabindex="0" role="button" aria-label="View details for ${escapeAttr(title)}">
        <td class="p-3 w-12">
          <input type="checkbox" class="bulk-select-checkbox anime-select-checkbox" data-anime-id="${a.id}" title="Select anime" aria-label="Select ${escapeAttr(title)}">
        </td>
        <td class="p-3 title">
          <div class="flex items-center gap-3">
            <div class="table-cover-thumb">
              <img 
                data-src="${escapeAttr(a.coverImage || 'https://placehold.co/60x84/1f2937/94a3b8?text=No+Image')}" 
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 84'%3E%3Crect fill='%231f2937' width='60' height='84'/%3E%3C/svg%3E"
                data-error-src="https://placehold.co/60x84/1f2937/94a3b8?text=No+Image"
                alt="${escapeAttr(title)}"
                referrerpolicy="no-referrer"
              />
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <span class="main-title font-medium">${escapeHtml(title)}</span>
              ${statusBadgeData}
            </div>
          </div>
        </td>
        <td class="p-3 score text-center">
          ${scoreHtml}
        </td>
        <td class="p-3 episodes text-center">
          <div class="flex flex-col gap-1 items-center">
            ${progressStatusBadge}
            <span class="font-medium">${total}</span>
          </div>
        </td>
        <td class="p-3 genres">
          <div class="text-sm">
            ${genresHtml}
          </div>
        </td>
        <td class="p-3 actions text-right">
          <div class="flex gap-2 justify-end items-center">
            <button
              class="${episodeButtonClass} px-3 py-1.5 text-sm rounded-lg font-medium"
              data-title="${escapeAttr(title)}"
              data-total="${a.totalEpisodes || 0}"
              data-watched="${watched}"
              ${episodeButtonDisabled}
              title="${canAddEpisode ? 'Increment episode count' : 'Cannot exceed total episodes'}">
              +1 Ep
            </button>
            <div class="add-to-list-placeholder" data-anime-id="${a.id}"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
  
  // Initialize lazy loading for new images
  if (typeof observeNewImages === 'function') {
    observeNewImages(tbody);
  }
  
  // Populate "Add to List" buttons
  populateAddToListButtons();
  
  // Initialize bulk selection
  initBulkSelection();
}

/**
 * Populate "Add to List" buttons in placeholders
 */
export async function populateAddToListButtons() {
  const placeholders = document.querySelectorAll('.add-to-list-placeholder');
  if (placeholders.length === 0) return;
  
  // Load custom lists first
  try {
    const { loadCustomLists } = await import('./custom-lists.js');
    await loadCustomLists();
  } catch (error) {
    console.warn('Could not load custom lists:', error);
  }
  
  // Populate each placeholder
  for (const placeholder of placeholders) {
    // Check if placeholder is still in the DOM
    if (!placeholder.parentNode) continue;
    
    const animeId = parseInt(placeholder.dataset.animeId);
    if (animeId) {
      try {
        const buttonHtml = await getAddToListButton(animeId);
        if (buttonHtml && placeholder.parentNode) {
          placeholder.outerHTML = buttonHtml;
        }
      } catch (error) {
        console.warn('Could not populate add to list button:', error);
      }
    }
  }
}

/**
 * Toggle between table and grid view
 */
export function setViewMode(mode, data = [], currentSort = {}) {
  const tableContainer = document.querySelector('#list-tab .overflow-y-auto');
  const gridContainer = document.getElementById('anime-grid');
  const tableBtnTable = document.querySelector('[data-view="table"]');
  const tableBtnGrid = document.querySelector('[data-view="grid"]');
  
  if (mode === 'grid') {
    if (tableContainer) tableContainer.classList.add('hidden');
    if (gridContainer) gridContainer.classList.remove('hidden');
    if (tableBtnTable) tableBtnTable.classList.remove('active');
    if (tableBtnGrid) tableBtnGrid.classList.add('active');
    
    renderAnimeGrid(data, currentSort);
    localStorage.setItem('animeViewMode', 'grid');
  } else {
    if (tableContainer) tableContainer.classList.remove('hidden');
    if (gridContainer) gridContainer.classList.add('hidden');
    if (tableBtnTable) tableBtnTable.classList.add('active');
    if (tableBtnGrid) tableBtnGrid.classList.remove('active');
    
    renderAnimeTable(data, currentSort);
    localStorage.setItem('animeViewMode', 'table');
  }
}

/**
 * Apply filters and sort to current view
 */
export function applyFiltersToCurrentView(data = [], currentSort = {}) {
  const viewMode = localStorage.getItem('animeViewMode') || 'table';
  
  const searchInput = document.getElementById('search-bar');
  const statusSelect = document.getElementById('status-filter');
  const genreSelect = document.getElementById('genre-filter');

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

  if (viewMode === 'grid') {
    renderAnimeGrid(filteredData, currentSort);
  } else {
    renderAnimeTable(filteredData, currentSort);
  }
}
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
 * Generate status badge HTML with editor
 */
function getStatusBadgeWithEditor(status, animeId, animeTitle) {
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

  // Available statuses for dropdown
  const statuses = [
    { value: 'Current', label: 'Watching' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Planning', label: 'Plan to Watch' },
    { value: 'Paused', label: 'Paused' },
    { value: 'Dropped', label: 'Dropped' },
    { value: 'Repeating', label: 'Rewatching' }
  ];

  const options = statuses.map(s => 
    `<option value="${s.value}" ${s.value === status || s.label === status ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  return `
    <div class="status-editor-container">
      <span class="status-badge ${badge.class} status-badge-clickable" 
            data-anime-id="${escapeAttr(animeId)}" 
            data-current-status="${escapeAttr(status)}">
        ${escapeHtml(badge.text)}
        <span class="status-edit-icon">✎</span>
      </span>
      <div class="status-editor hidden">
        <select class="status-select" 
                data-anime-id="${escapeAttr(animeId)}"
                data-anime-title="${escapeAttr(animeTitle)}">
          ${options}
        </select>
        <div class="status-actions">
          <button class="status-save-btn" title="Save">✓</button>
          <button class="status-cancel-btn" title="Cancel">✕</button>
        </div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ *
 * 6) Stats renderer
 * ------------------------------------------------------------------ */

/**
 * Render statistics to the UI
 * @param {Object} stats - Statistics object with anime/episode counts and scores
 * @param {number} stats.totalAnime - Total number of anime
 * @param {number} stats.totalEpisodes - Total number of episodes watched
 * @param {number} stats.timeWatchedDays - Days spent watching
 * @param {number} stats.timeWatchedHours - Hours spent watching
 * @param {number} stats.timeWatchedMinutes - Minutes spent watching
 * @param {number} stats.meanScore - Average score
 */
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
 * 7) Data mutators expected by main.js
 * ------------------------------------------------------------------ */

/**
 * Increment episode count for a specific anime
 * @param {string} title - Title of the anime to update
 * @param {Array} list - Array of anime objects
 * @returns {Array} Updated array with incremented episode count
 */
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
 * @param {number|string} animeId - ID of the anime to update
 * @param {number} newScore - New score value
 * @param {Array} list - Array of anime objects
 * @returns {Array} Updated array with new score
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

/**
 * Update anime status in the local data array
 * @param {number|string} animeId - ID of the anime to update
 * @param {string} newStatus - New status value
 * @param {Array} list - Array of anime objects
 * @returns {Array} Updated array with new status
 */
export function updateAnimeStatus(animeId, newStatus, list = []) {
  return (list || []).map(anime => {
    if (anime.id === animeId) {
      return {
        ...anime,
        status: newStatus
      };
    }
    return anime;
  });
}

/* ------------------------------------------------------------------ *
 * 8) Settings → config.js helpers
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

/**
 * Render anime in grid view with cover art and inline editing
 */
export function renderAnimeGrid(data = [], currentSort = { column: 'title', direction: 'asc' }) {
  const container = document.getElementById('anime-grid');
  if (!container) return;
  
  const sorted = sortAnimeData(data, currentSort);
  
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="grid-empty">
        <svg class="mx-auto h-16 w-16 opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <p class="text-lg font-semibold mt-4">No anime found</p>
        <p class="text-sm mt-2">Try adjusting your search or filters</p>
      </div>
    `;
    return;
  }
  
  const cards = sorted.map(a => {
    const title = a.title || 'Unknown';
    const score = a.score ?? 0;
    const watched = a.episodesWatched ?? a.progress ?? 0;
    const total = a.totalEpisodes || '?';
    const coverImage = a.coverImage || 'https://placehold.co/300x450/1f2937/94a3b8?text=No+Image';
    const genres = Array.isArray(a.genres) ? a.genres.slice(0, 3).join(', ') : '';
    
    const scoreClass = score === 0 ? 'score-none' :
      score >= 8 ? 'score-high' :
      score >= 6 ? 'score-good' :
      score >= 4 ? 'score-mid' : 'score-low';
    
    const statusBadge = getStatusBadgeClass(a.status);
    
    const canAddEpisode = !a.totalEpisodes || watched < a.totalEpisodes;
    const episodeButtonClass = canAddEpisode ? 'add-episode-btn' : 'add-episode-btn-disabled';
    const episodeButtonDisabled = canAddEpisode ? '' : 'disabled';
    
    // Score editor HTML
    const scoreEditorHtml = `
      <div class="grid-card-score score-editor-container ${scoreClass}">
        <div class="score-display ${scoreClass}">
          <span>${score > 0 ? score.toFixed(1) : 'N/A'}</span>
          <button class="score-edit-btn" title="Edit score">✏️</button>
        </div>
        <div class="score-editor hidden">
          <input 
            type="number" 
            class="score-input" 
            min="0" 
            max="10" 
            step="0.1" 
            value="${score}" 
            data-anime-id="${escapeAttr(a.id)}"
            data-anime-title="${escapeAttr(title)}"
          />
          <div class="score-actions">
            <button class="score-save-btn" title="Save score">✓</button>
            <button class="score-cancel-btn" title="Cancel">✕</button>
          </div>
        </div>
      </div>
    `;
    
    // Status editor HTML
    const statusEditorHtml = statusBadge ? `
      <div class="grid-card-status status-editor-container">
        <div class="status-badge-clickable ${statusBadge.class}" title="Click to edit status">
          <span>${statusBadge.text}</span>
          <span class="status-edit-icon">✏️</span>
        </div>
        <div class="status-editor hidden">
          <select 
            class="status-select" 
            data-anime-id="${escapeAttr(a.id)}"
            data-anime-title="${escapeAttr(title)}">
            <option value="Watching" ${a.status === 'Watching' ? 'selected' : ''}>Watching</option>
            <option value="Completed" ${a.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Planning" ${a.status === 'Planning' ? 'selected' : ''}>Planning</option>
            <option value="Paused" ${a.status === 'Paused' ? 'selected' : ''}>Paused</option>
            <option value="Dropped" ${a.status === 'Dropped' ? 'selected' : ''}>Dropped</option>
            <option value="Repeating" ${a.status === 'Repeating' ? 'selected' : ''}>Repeating</option>
          </select>
          <div class="status-actions">
            <button class="status-save-btn" title="Save status">✓</button>
            <button class="status-cancel-btn" title="Cancel">✕</button>
          </div>
        </div>
      </div>
    ` : '';
    
    return `
      <div class="grid-card" data-anime-id="${escapeAttr(a.id)}" tabindex="0" role="button" aria-label="View details for ${escapeAttr(title)}">
        <div class="grid-card-cover relative">
          <input type="checkbox" class="bulk-select-checkbox anime-select-checkbox absolute top-2 left-2 z-10 w-5 h-5" data-anime-id="${a.id}" title="Select anime" aria-label="Select ${escapeAttr(title)}" style="background: rgba(255, 255, 255, 0.9); border-radius: 0.25rem;">
          <img 
            data-src="${escapeAttr(coverImage)}" 
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'%3E%3Crect fill='%231f2937' width='300' height='450'/%3E%3C/svg%3E"
            data-error-src="https://placehold.co/300x450/1f2937/94a3b8?text=No+Image"
            alt="${escapeAttr(title)}"
            referrerpolicy="no-referrer"
          />
          ${scoreEditorHtml}
          ${statusEditorHtml}
        </div>
        <div class="grid-card-content">
          <div class="grid-card-title">${escapeHtml(title)}</div>
          <div class="grid-card-progress">${watched}/${total} episodes</div>
          ${genres ? `<div class="grid-card-genres">${escapeHtml(genres)}</div>` : ''}
          <div class="grid-card-actions">
            <button
              class="${episodeButtonClass}"
              data-title="${escapeAttr(title)}"
              data-total="${a.totalEpisodes || 0}"
              data-watched="${watched}"
              ${episodeButtonDisabled}
              title="${canAddEpisode ? 'Increment episode count' : 'Cannot exceed total episodes'}">
              +1 Ep
            </button>
            <div class="add-to-list-placeholder" data-anime-id="${a.id}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cards;
  
  // Initialize lazy loading for new images
  if (typeof observeNewImages === 'function') {
    observeNewImages(container);
  }
  
  // Populate "Add to List" buttons
  populateAddToListButtons();
  
  // Initialize bulk selection
  initBulkSelection();
}

/**
 * Initialize bulk selection functionality
 */
export function initBulkSelection() {
  // Select all checkbox
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.anime-select-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
      });
      updateBulkActionsToolbar();
    });
  }

  // Individual checkboxes
  document.addEventListener('change', (e) => {
    if (e.target.matches('.anime-select-checkbox')) {
      updateSelectAllCheckbox();
      updateBulkActionsToolbar();
    }
  });

  // Bulk actions buttons
  document.getElementById('bulk-update-status')?.addEventListener('click', () => {
    showBulkStatusModal();
  });

  document.getElementById('bulk-update-score')?.addEventListener('click', () => {
    showBulkScoreModal();
  });

  document.getElementById('bulk-add-to-list')?.addEventListener('click', () => {
    showBulkAddToListModal();
  });

  document.getElementById('bulk-clear-selection')?.addEventListener('click', () => {
    clearBulkSelection();
  });
}

/**
 * Update select all checkbox state
 */
function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  if (!selectAllCheckbox) return;

  const checkboxes = document.querySelectorAll('.anime-select-checkbox:not(#select-all-checkbox)');
  const checkedCount = document.querySelectorAll('.anime-select-checkbox:not(#select-all-checkbox):checked').length;
  
  if (checkedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCount === checkboxes.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

/**
 * Update bulk actions toolbar visibility and count
 */
function updateBulkActionsToolbar() {
  const toolbar = document.getElementById('bulk-actions-toolbar');
  const countElement = document.getElementById('bulk-selection-count');
  const selectedCount = document.querySelectorAll('.anime-select-checkbox:not(#select-all-checkbox):checked').length;

  if (toolbar && countElement) {
    if (selectedCount > 0) {
      toolbar.classList.remove('hidden');
      countElement.textContent = `${selectedCount} ${selectedCount === 1 ? 'anime selected' : 'anime selected'}`;
    } else {
      toolbar.classList.add('hidden');
    }
  }
}

/**
 * Get selected anime IDs
 */
function getSelectedAnimeIds() {
  return Array.from(document.querySelectorAll('.anime-select-checkbox:not(#select-all-checkbox):checked'))
    .map(checkbox => parseInt(checkbox.dataset.animeId))
    .filter(id => !isNaN(id));
}

/**
 * Clear all selections
 */
function clearBulkSelection() {
  document.querySelectorAll('.anime-select-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateBulkActionsToolbar();
}

/**
 * Show bulk status update modal
 */
function showBulkStatusModal() {
  const selectedIds = getSelectedAnimeIds();
  if (selectedIds.length === 0) return;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 bulk-action-modal';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Update Status for ${selectedIds.length} Anime</h3>
      <form id="bulk-status-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">New Status *</label>
          <select id="bulk-status-select" required class="w-full px-3 py-2 border border-gray-300 rounded-lg" style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);">
            <option value="Watching">Watching</option>
            <option value="Completed">Completed</option>
            <option value="Planning">Planning</option>
            <option value="Paused">Paused</option>
            <option value="Dropped">Dropped</option>
            <option value="Repeating">Repeating</option>
          </select>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-bulk-status" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Update Status
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#bulk-status-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = modal.querySelector('#bulk-status-select').value;
    
    // Show confirmation before performing bulk update
    const confirmed = await showConfirm(
      `Update status to "${status}" for ${selectedIds.length} anime?`
    );
    if (!confirmed) return;
    
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
    
    await performBulkStatusUpdate(selectedIds, status);
  });

  modal.querySelector('#cancel-bulk-status').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Show bulk score update modal
 */
function showBulkScoreModal() {
  const selectedIds = getSelectedAnimeIds();
  if (selectedIds.length === 0) return;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 bulk-action-modal';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Update Score for ${selectedIds.length} Anime</h3>
      <form id="bulk-score-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">New Score *</label>
          <input type="number" id="bulk-score-input" min="0" max="10" step="0.1" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 placeholder="0.0 - 10.0">
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-bulk-score" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Update Score
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#bulk-score-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const score = parseFloat(modal.querySelector('#bulk-score-input').value);
    if (isNaN(score) || score < 0 || score > 10) {
      if (typeof window.showToast === 'function') {
        window.showToast('Score must be between 0 and 10', 'error');
      }
      return;
    }
    
    // Show confirmation before performing bulk update
    const confirmed = await showConfirm(
      `Update score to ${score} for ${selectedIds.length} anime?`
    );
    if (!confirmed) return;
    
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
    
    await performBulkScoreUpdate(selectedIds, score);
  });

  modal.querySelector('#cancel-bulk-score').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Show bulk add to list modal
 */
function showBulkAddToListModal() {
  const selectedIds = getSelectedAnimeIds();
  if (selectedIds.length === 0) return;

  // Import and use the custom lists modal
  import('./custom-lists.js').then(async ({ loadCustomLists, getCustomLists }) => {
    await loadCustomLists();
    const lists = getCustomLists();

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 bulk-action-modal';
    
    modal.innerHTML = `
      <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
        <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Add ${selectedIds.length} Anime to List</h3>
        <div class="max-h-96 overflow-y-auto mb-4">
          ${lists.length === 0 ? `
            <p class="text-sm mb-4" style="color: var(--theme-text-secondary, #6b7280);">No lists available. Create one first!</p>
          ` : `
            <div class="space-y-2">
              ${lists.map(list => {
                const entryCount = list.entries?.length || 0;
                return `
                  <button class="bulk-list-option w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between gap-3 hover:bg-gray-100 dark:hover:bg-gray-700" 
                          data-list-id="${list.id}"
                          style="background: var(--theme-bg, #ffffff); border-color: var(--theme-border, #e5e7eb); color: var(--theme-text-primary, #111827);">
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-sm">${escapeHtml(list.name)}</div>
                      <div class="text-xs" style="color: var(--theme-text-secondary, #6b7280);">${entryCount} ${entryCount === 1 ? 'anime' : 'anime'}</div>
                    </div>
                    <span class="text-xs" style="color: var(--theme-text-muted, #9ca3af);">+</span>
                  </button>
                `;
              }).join('')}
            </div>
          `}
          <div class="border-t pt-4 mt-4" style="border-color: var(--theme-border, #e5e7eb);">
            <button class="bulk-list-create w-full text-left px-4 py-3 rounded-lg font-semibold flex items-center gap-3 hover:bg-indigo-50" 
                    style="color: var(--theme-primary, #6366f1);">
              <span>+</span>
              <span>Create New List</span>
            </button>
          </div>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-bulk-list" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle adding to existing list
    modal.querySelectorAll('.bulk-list-option').forEach(option => {
      option.addEventListener('click', async () => {
        const listId = parseInt(option.dataset.listId);
        if (listId) {
          await performBulkAddToList(selectedIds, listId);
          if (modal.parentNode) {
            document.body.removeChild(modal);
          }
        }
      });
    });

    // Handle create new list
    modal.querySelector('.bulk-list-create')?.addEventListener('click', async () => {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      // Show create list modal - we'll handle adding anime after creation
      const { showCreateListModal } = await import('./custom-lists-view.js');
      if (showCreateListModal) {
        // Store selected IDs for later
        window._bulkSelectedAnimeIds = selectedIds;
        showCreateListModal();
      }
    });

    modal.querySelector('#cancel-bulk-list')?.addEventListener('click', () => {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }
    });
  });
}

/**
 * Perform bulk status update
 */
async function performBulkStatusUpdate(animeIds, status) {
  if (animeIds.length === 0) return;

  const button = document.getElementById('bulk-update-status');
  const restoreButton = button ? showButtonLoading(button, 'Updating...') : null;

  try {
    let successCount = 0;
    let failCount = 0;

    for (const animeId of animeIds) {
      try {
        const response = await fetch('/api/anilist/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: animeId, status })
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Failed to update anime ${animeId}:`, error);
        failCount++;
      }
    }

    // Update local data
    if (window.animeData && successCount > 0) {
      animeIds.forEach(id => {
        const anime = window.animeData.find(a => a.id === id);
        if (anime) {
          anime.status = status;
        }
      });
      
      // Trigger refresh
      if (typeof window.triggerFilterUpdate === 'function') {
        window.triggerFilterUpdate();
      }
    }

    // Show result
    if (typeof window.showToast === 'function') {
      if (failCount === 0) {
        window.showToast(`Updated status for ${successCount} anime`, 'success');
      } else {
        window.showToast(`Updated ${successCount} anime, ${failCount} failed`, 'warning');
      }
    }

    // Clear selection
    clearBulkSelection();
  } catch (error) {
    console.error('Bulk status update error:', error);
    if (typeof window.showToast === 'function') {
      window.showToast('Failed to update status', 'error');
    }
  } finally {
    if (restoreButton) restoreButton();
  }
}

/**
 * Perform bulk score update
 */
async function performBulkScoreUpdate(animeIds, score) {
  if (animeIds.length === 0) return;

  const button = document.getElementById('bulk-update-score');
  const restoreButton = button ? showButtonLoading(button, 'Updating...') : null;

  try {
    let successCount = 0;
    let failCount = 0;

    for (const animeId of animeIds) {
      try {
        const response = await fetch('/api/anilist/update-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: animeId, score })
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Failed to update anime ${animeId}:`, error);
        failCount++;
      }
    }

    // Update local data
    if (window.animeData && successCount > 0) {
      animeIds.forEach(id => {
        const anime = window.animeData.find(a => a.id === id);
        if (anime) {
          anime.score = score;
        }
      });
      
      // Trigger refresh
      if (typeof window.triggerFilterUpdate === 'function') {
        window.triggerFilterUpdate();
      }
    }

    // Show result
    if (typeof window.showToast === 'function') {
      if (failCount === 0) {
        window.showToast(`Updated score for ${successCount} anime`, 'success');
      } else {
        window.showToast(`Updated ${successCount} anime, ${failCount} failed`, 'warning');
      }
    }

    // Clear selection
    clearBulkSelection();
  } catch (error) {
    console.error('Bulk score update error:', error);
    if (typeof window.showToast === 'function') {
      window.showToast('Failed to update score', 'error');
    }
  } finally {
    if (restoreButton) restoreButton();
  }
}

/**
 * Perform bulk add to list
 */
async function performBulkAddToList(animeIds, listId) {
  if (animeIds.length === 0) return;

  const button = document.getElementById('bulk-add-to-list');
  const restoreButton = button ? showButtonLoading(button, 'Adding...') : null;

  try {
    const { addAnimeToList, loadCustomLists, getCustomLists } = await import('./custom-lists.js');
    await loadCustomLists();
    const list = getCustomLists().find(l => l.id === listId);

    let successCount = 0;
    let failCount = 0;
    let alreadyInListCount = 0;

    for (const animeId of animeIds) {
      try {
        const result = await addAnimeToList(listId, animeId);
        if (result.success) {
          successCount++;
        } else if (result.alreadyInList) {
          alreadyInListCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`Failed to add anime ${animeId} to list:`, error);
        failCount++;
      }
    }

    // Show result
    if (typeof window.showToast === 'function') {
      let message = `Added ${successCount} anime to "${list?.name || 'list'}"`;
      if (alreadyInListCount > 0) {
        message += ` (${alreadyInListCount} already in list)`;
      }
      if (failCount > 0) {
        message += ` (${failCount} failed)`;
      }
      window.showToast(message, failCount > 0 ? 'warning' : 'success');
    }

    // Update buttons
    await loadCustomLists();
    updateAllAddToListButtons();

    // Clear selection
    clearBulkSelection();
  } catch (error) {
    console.error('Bulk add to list error:', error);
    if (typeof window.showToast === 'function') {
      window.showToast('Failed to add anime to list', 'error');
    }
  } finally {
    if (restoreButton) restoreButton();
  }
}

/**
 * Update all add-to-list buttons (helper function)
 */
async function updateAllAddToListButtons() {
  try {
    const { updateAllAddToListButtons } = await import('./custom-lists-view.js');
    if (updateAllAddToListButtons) {
      await updateAllAddToListButtons();
    }
  } catch (error) {
    // Function might not be exported, that's okay
  }
}

/**
 * Get status badge styling for grid cards
 */
export function getStatusBadgeClass(status) {
  if (!status) return null;

  const statusMap = {
    'current': { class: 'status-watching', text: 'Watching' },
    'watching': { class: 'status-watching', text: 'Watching' },
    'completed': { class: 'status-completed', text: 'Completed' },
    'planning': { class: 'status-planning', text: 'Planning' },
    'paused': { class: 'status-paused', text: 'Paused' },
    'on_hold': { class: 'status-paused', text: 'Paused' },
    'dropped': { class: 'status-dropped', text: 'Dropped' },
    'repeating': { class: 'status-repeating', text: 'Rewatching' },
    're-watching': { class: 'status-repeating', text: 'Rewatching' },
  };

  const normalized = String(status).toLowerCase();
  return statusMap[normalized] || { class: 'status-planning', text: status };
}

