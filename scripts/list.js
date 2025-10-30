// =====================================================================
// --- ENHANCED LIST MODULE (list.js) ---
// =====================================================================
// Advanced filtering, sorting, and preset management
// =====================================================================

import { renderAnimeTable, renderAnimeGrid } from './ui.js';
import { showToast } from './toast.js';

// =====================================================================
// STATE MANAGEMENT
// =====================================================================

let filterState = {
  search: '',
  statuses: [], // Multi-select
  genres: [],   // Multi-select
  formats: [],  // Multi-select: TV, Movie, OVA, etc.
  studios: [],  // Multi-select
  yearRange: { min: null, max: null },
  scoreRange: { min: 0, max: 10 },
  episodeRange: { min: null, max: null },
  showUnscored: true // Include unscored anime
};

let sortState = {
  column: 'title',
  direction: 'asc'
};

// Available sort options
const SORT_OPTIONS = [
  { value: 'title-asc', label: 'Title (A-Z)', column: 'title', direction: 'asc' },
  { value: 'title-desc', label: 'Title (Z-A)', column: 'title', direction: 'desc' },
  { value: 'score-desc', label: 'Score (High to Low)', column: 'score', direction: 'desc' },
  { value: 'score-asc', label: 'Score (Low to High)', column: 'score', direction: 'asc' },
  { value: 'progress-desc', label: 'Progress (Most Complete)', column: 'progress', direction: 'desc' },
  { value: 'progress-asc', label: 'Progress (Least Complete)', column: 'progress', direction: 'asc' },
  { value: 'episodes-desc', label: 'Episodes Watched (Most)', column: 'episodesWatched', direction: 'desc' },
  { value: 'episodes-asc', label: 'Episodes Watched (Least)', column: 'episodesWatched', direction: 'asc' },
  { value: 'year-desc', label: 'Year (Newest First)', column: 'year', direction: 'desc' },
  { value: 'year-asc', label: 'Year (Oldest First)', column: 'year', direction: 'asc' },
  { value: 'popularity-desc', label: 'Popularity (Most Popular)', column: 'averageScore', direction: 'desc' },
  { value: 'random', label: 'Random Shuffle', column: 'random', direction: 'asc' }
];

// Filter presets
const FILTER_PRESETS = {
  'my-favorites': {
    name: 'My Favorites',
    filters: { scoreRange: { min: 9, max: 10 }, showUnscored: false }
  },
  'to-finish': {
    name: 'To Finish',
    filters: { statuses: ['Current', 'Paused'] }
  },
  'rewatchable': {
    name: 'Rewatchable',
    filters: { scoreRange: { min: 10, max: 10 }, showUnscored: false }
  },
  'short-series': {
    name: 'Short Series',
    filters: { episodeRange: { min: 1, max: 13 } }
  },
  'movies': {
    name: 'Movies',
    filters: { formats: ['Movie'] }
  },
  'recent-anime': {
    name: 'Recent Anime',
    filters: { yearRange: { min: 2020, max: new Date().getFullYear() } }
  }
};

// =====================================================================
// INITIALIZATION
// =====================================================================

export function initListTab() {
  initSearchBar();
  initBasicFilters();
  initAdvancedFilters();
  initSortControls();
  initViewToggle();
  initPresetControls();
  loadSavedFilters();
  
  // Restore saved view mode
  const savedViewMode = localStorage.getItem('animeViewMode') || 'table';
  setTimeout(() => {
    setViewMode(savedViewMode);
  }, 100);
}

// =====================================================================
// SEARCH BAR
// =====================================================================

function initSearchBar() {
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    // Debounce search input
    let searchTimeout;
    searchBar.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterState.search = e.target.value.toLowerCase();
        applyFilters();
      }, 300);
    });
  }
}

// =====================================================================
// BASIC FILTERS (Legacy Support)
// =====================================================================

function initBasicFilters() {
  const statusFilter = document.getElementById('status-filter');
  const genreFilter = document.getElementById('genre-filter');
  
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      if (e.target.value === 'all') {
        filterState.statuses = [];
      } else {
        filterState.statuses = [e.target.value];
      }
      applyFilters();
    });
  }

  if (genreFilter) {
    genreFilter.addEventListener('change', (e) => {
      if (e.target.value === 'all') {
        filterState.genres = [];
      } else {
        filterState.genres = [e.target.value];
      }
      applyFilters();
    });
  }
}

// =====================================================================
// ADVANCED FILTERS
// =====================================================================

function initAdvancedFilters() {
  // Multi-select status filter
  const statusMultiSelect = document.getElementById('status-multi-select');
  if (statusMultiSelect) {
    statusMultiSelect.addEventListener('change', (e) => {
      filterState.statuses = Array.from(e.target.selectedOptions).map(opt => opt.value);
      applyFilters();
    });
  }

  // Multi-select genre filter
  const genreMultiSelect = document.getElementById('genre-multi-select');
  if (genreMultiSelect) {
    genreMultiSelect.addEventListener('change', (e) => {
      filterState.genres = Array.from(e.target.selectedOptions).map(opt => opt.value);
      applyFilters();
    });
  }

  // Multi-select format filter
  const formatMultiSelect = document.getElementById('format-multi-select');
  if (formatMultiSelect) {
    formatMultiSelect.addEventListener('change', (e) => {
      filterState.formats = Array.from(e.target.selectedOptions).map(opt => opt.value);
      applyFilters();
    });
  }

  // Multi-select studio filter
  const studioMultiSelect = document.getElementById('studio-multi-select');
  if (studioMultiSelect) {
    studioMultiSelect.addEventListener('change', (e) => {
      filterState.studios = Array.from(e.target.selectedOptions).map(opt => opt.value);
      applyFilters();
    });
  }

  // Year range slider
  const yearMinInput = document.getElementById('year-min');
  const yearMaxInput = document.getElementById('year-max');
  if (yearMinInput && yearMaxInput) {
    yearMinInput.addEventListener('input', (e) => {
      filterState.yearRange.min = e.target.value ? parseInt(e.target.value) : null;
      updateRangeDisplay('year');
      applyFilters();
    });
    yearMaxInput.addEventListener('input', (e) => {
      filterState.yearRange.max = e.target.value ? parseInt(e.target.value) : null;
      updateRangeDisplay('year');
      applyFilters();
    });
  }

  // Score range slider
  const scoreMinInput = document.getElementById('score-min');
  const scoreMaxInput = document.getElementById('score-max');
  const showUnscoredCheckbox = document.getElementById('show-unscored');
  
  if (scoreMinInput && scoreMaxInput) {
    scoreMinInput.addEventListener('input', (e) => {
      filterState.scoreRange.min = parseFloat(e.target.value);
      updateRangeDisplay('score');
      applyFilters();
    });
    scoreMaxInput.addEventListener('input', (e) => {
      filterState.scoreRange.max = parseFloat(e.target.value);
      updateRangeDisplay('score');
      applyFilters();
    });
  }
  
  if (showUnscoredCheckbox) {
    showUnscoredCheckbox.addEventListener('change', (e) => {
      filterState.showUnscored = e.target.checked;
      applyFilters();
    });
  }

  // Episode range
  const episodeMinInput = document.getElementById('episode-min');
  const episodeMaxInput = document.getElementById('episode-max');
  if (episodeMinInput && episodeMaxInput) {
    episodeMinInput.addEventListener('input', (e) => {
      filterState.episodeRange.min = e.target.value ? parseInt(e.target.value) : null;
      updateRangeDisplay('episode');
      applyFilters();
    });
    episodeMaxInput.addEventListener('input', (e) => {
      filterState.episodeRange.max = e.target.value ? parseInt(e.target.value) : null;
      updateRangeDisplay('episode');
      applyFilters();
    });
  }

  // Toggle advanced filters panel
  const advancedToggleBtn = document.getElementById('toggle-advanced-filters');
  const advancedPanel = document.getElementById('advanced-filters-panel');
  if (advancedToggleBtn && advancedPanel) {
    advancedToggleBtn.addEventListener('click', () => {
      const isHidden = advancedPanel.classList.contains('hidden');
      advancedPanel.classList.toggle('hidden');
      advancedToggleBtn.textContent = isHidden ? '▼ Hide Advanced Filters' : '▶ Show Advanced Filters';
    });
  }
}

function updateRangeDisplay(type) {
  const display = document.getElementById(`${type}-range-display`);
  if (!display) return;
  
  let text = '';
  switch(type) {
    case 'year':
      const minYear = filterState.yearRange.min || 'Any';
      const maxYear = filterState.yearRange.max || 'Any';
      text = `${minYear} - ${maxYear}`;
      break;
    case 'score':
      text = `${filterState.scoreRange.min} - ${filterState.scoreRange.max}`;
      break;
    case 'episode':
      const minEp = filterState.episodeRange.min || 'Any';
      const maxEp = filterState.episodeRange.max || 'Any';
      text = `${minEp} - ${maxEp}`;
      break;
  }
  display.textContent = text;
}

// =====================================================================
// SORT CONTROLS
// =====================================================================

function initSortControls() {
  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    // Populate sort options
    sortSelect.innerHTML = SORT_OPTIONS.map(opt => 
      `<option value="${opt.value}">${opt.label}</option>`
    ).join('');
    
    sortSelect.addEventListener('change', (e) => {
      const selectedOption = SORT_OPTIONS.find(opt => opt.value === e.target.value);
      if (selectedOption) {
        sortState.column = selectedOption.column;
        sortState.direction = selectedOption.direction;
        applyFilters();
      }
    });
  }

  // Sortable headers (legacy support)
  const animeTableHead = document.getElementById('anime-table-head');
  if (animeTableHead) {
    animeTableHead.addEventListener('click', (e) => {
      const header = e.target.closest('.sortable-header');
      if (header) {
        const column = header.dataset.sort;
        if (sortState.column === column) {
          sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.column = column;
          sortState.direction = 'asc';
        }
        
        // Update sort select to match
        updateSortSelectValue();
        applyFilters();
      }
    });
  }
}

function updateSortSelectValue() {
  const sortSelect = document.getElementById('sort-select');
  if (!sortSelect) return;
  
  const matchingOption = SORT_OPTIONS.find(opt => 
    opt.column === sortState.column && opt.direction === sortState.direction
  );
  
  if (matchingOption) {
    sortSelect.value = matchingOption.value;
  }
}

// =====================================================================
// VIEW TOGGLE
// =====================================================================

function initViewToggle() {
  const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
  viewToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setViewMode(view);
    });
  });
}

function setViewMode(mode) {
  localStorage.setItem('animeViewMode', mode);

  // Update button states
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });

  // Show/hide appropriate container
  const table = document.getElementById('anime-table');
  const grid = document.getElementById('anime-grid');

  if (mode === 'grid') {
    table?.parentElement?.classList.add('hidden');
    grid?.classList.remove('hidden');
  } else {
    table?.parentElement?.classList.remove('hidden');
    grid?.classList.add('hidden');
  }

  // Re-render with current filters
  applyFilters();
}

// =====================================================================
// PRESET CONTROLS
// =====================================================================

function initPresetControls() {
  // Populate preset buttons
  const presetContainer = document.getElementById('filter-presets');
  if (presetContainer) {
    const presetHTML = Object.entries(FILTER_PRESETS).map(([key, preset]) => `
      <button class="preset-btn" data-preset="${key}">
        ${preset.name}
      </button>
    `).join('');
    
    presetContainer.innerHTML = presetHTML + `
      <button class="preset-btn preset-btn-custom" id="save-preset-btn">
        💾 Save Current
      </button>
    `;
    
    // Attach preset click handlers
    presetContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.preset-btn');
      if (!btn) return;
      
      if (btn.id === 'save-preset-btn') {
        saveCustomPreset();
      } else {
        const presetKey = btn.dataset.preset;
        applyPreset(presetKey);
      }
    });
  }

  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearAllFilters);
  }
}

function applyPreset(presetKey) {
  const preset = FILTER_PRESETS[presetKey];
  if (!preset) {
    // Check custom presets
    const customPresets = getCustomPresets();
    if (customPresets[presetKey]) {
      filterState = { ...filterState, ...customPresets[presetKey].filters };
      updateFilterUI();
      applyFilters();
      showToast(`Applied preset: ${customPresets[presetKey].name}`, 'success');
    }
    return;
  }
  
  // Merge preset filters with default state
  filterState = {
    search: '',
    statuses: [],
    genres: [],
    formats: [],
    studios: [],
    yearRange: { min: null, max: null },
    scoreRange: { min: 0, max: 10 },
    episodeRange: { min: null, max: null },
    showUnscored: true,
    ...preset.filters
  };
  
  updateFilterUI();
  applyFilters();
  showToast(`Applied preset: ${preset.name}`, 'success');
}

function saveCustomPreset() {
  const presetName = prompt('Enter a name for this filter preset:');
  if (!presetName) return;
  
  const customPresets = getCustomPresets();
  const presetKey = `custom-${Date.now()}`;
  
  customPresets[presetKey] = {
    name: presetName,
    filters: { ...filterState }
  };
  
  localStorage.setItem('animeFilterPresets', JSON.stringify(customPresets));
  
  // Add button to UI
  const presetContainer = document.getElementById('filter-presets');
  if (presetContainer) {
    const newBtn = document.createElement('button');
    newBtn.className = 'preset-btn preset-btn-custom';
    newBtn.dataset.preset = presetKey;
    newBtn.innerHTML = `${presetName} <span class="preset-delete" data-preset="${presetKey}">✕</span>`;
    presetContainer.insertBefore(newBtn, document.getElementById('save-preset-btn'));
  }
  
  showToast(`Saved preset: ${presetName}`, 'success');
}

function getCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem('animeFilterPresets') || '{}');
  } catch {
    return {};
  }
}

function loadSavedFilters() {
  // Load custom presets
  const customPresets = getCustomPresets();
  const presetContainer = document.getElementById('filter-presets');
  
  if (presetContainer) {
    Object.entries(customPresets).forEach(([key, preset]) => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn preset-btn-custom';
      btn.dataset.preset = key;
      btn.innerHTML = `${preset.name} <span class="preset-delete" data-preset="${key}">✕</span>`;
      presetContainer.insertBefore(btn, document.getElementById('save-preset-btn'));
    });
    
    // Handle delete clicks
    presetContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('preset-delete')) {
        e.stopPropagation();
        deleteCustomPreset(e.target.dataset.preset);
      }
    });
  }
  
  // Load last used filters
  try {
    const savedFilters = localStorage.getItem('animeLastFilters');
    if (savedFilters) {
      filterState = JSON.parse(savedFilters);
      updateFilterUI();
    }
  } catch {
    // Ignore errors
  }
}

function deleteCustomPreset(presetKey) {
  if (!confirm('Delete this preset?')) return;
  
  const customPresets = getCustomPresets();
  delete customPresets[presetKey];
  localStorage.setItem('animeFilterPresets', JSON.stringify(customPresets));
  
  // Remove button
  const btn = document.querySelector(`[data-preset="${presetKey}"]`);
  if (btn) btn.remove();
  
  showToast('Preset deleted', 'info');
}

function updateFilterUI() {
  // Update all filter UI elements to match current state
  const searchBar = document.getElementById('search-bar');
  if (searchBar) searchBar.value = filterState.search;
  
  // Update multi-selects
  updateMultiSelect('status-multi-select', filterState.statuses);
  updateMultiSelect('genre-multi-select', filterState.genres);
  updateMultiSelect('format-multi-select', filterState.formats);
  updateMultiSelect('studio-multi-select', filterState.studios);
  
  // Update range inputs
  const yearMin = document.getElementById('year-min');
  const yearMax = document.getElementById('year-max');
  if (yearMin) yearMin.value = filterState.yearRange.min || '';
  if (yearMax) yearMax.value = filterState.yearRange.max || '';
  
  const scoreMin = document.getElementById('score-min');
  const scoreMax = document.getElementById('score-max');
  if (scoreMin) scoreMin.value = filterState.scoreRange.min;
  if (scoreMax) scoreMax.value = filterState.scoreRange.max;
  
  const episodeMin = document.getElementById('episode-min');
  const episodeMax = document.getElementById('episode-max');
  if (episodeMin) episodeMin.value = filterState.episodeRange.min || '';
  if (episodeMax) episodeMax.value = filterState.episodeRange.max || '';
  
  const showUnscored = document.getElementById('show-unscored');
  if (showUnscored) showUnscored.checked = filterState.showUnscored;
  
  // Update displays
  updateRangeDisplay('year');
  updateRangeDisplay('score');
  updateRangeDisplay('episode');
}

function updateMultiSelect(elementId, selectedValues) {
  const select = document.getElementById(elementId);
  if (!select) return;
  
  Array.from(select.options).forEach(option => {
    option.selected = selectedValues.includes(option.value);
  });
}

// =====================================================================
// FILTER APPLICATION
// =====================================================================

function applyFilters() {
  if (!window.animeData) return;
  
  let filtered = [...window.animeData];

  // Search filter
  if (filterState.search) {
    const searchLower = filterState.search.toLowerCase();
    filtered = filtered.filter(anime =>
      anime.title.toLowerCase().includes(searchLower) ||
      (anime.genres || []).some(g => g.toLowerCase().includes(searchLower))
    );
  }

  // Status filter (multi-select)
  if (filterState.statuses.length > 0) {
    filtered = filtered.filter(anime =>
      filterState.statuses.includes(anime.status)
    );
  }

  // Genre filter (must have ALL selected genres)
  if (filterState.genres.length > 0) {
    filtered = filtered.filter(anime =>
      filterState.genres.every(genre =>
        (anime.genres || []).includes(genre)
      )
    );
  }

  // Format filter
  if (filterState.formats.length > 0) {
    filtered = filtered.filter(anime =>
      filterState.formats.includes(anime.format)
    );
  }

  // Studio filter
  if (filterState.studios.length > 0) {
    filtered = filtered.filter(anime =>
      filterState.studios.some(studio =>
        (anime.studios || []).includes(studio)
      )
    );
  }

  // Year range
  if (filterState.yearRange.min || filterState.yearRange.max) {
    filtered = filtered.filter(anime => {
      const year = anime.seasonYear || anime.startDate?.year;
      if (!year) return false;
      if (filterState.yearRange.min && year < filterState.yearRange.min) return false;
      if (filterState.yearRange.max && year > filterState.yearRange.max) return false;
      return true;
    });
  }

  // Score range
  filtered = filtered.filter(anime => {
    const score = anime.score || 0;
    if (score === 0 && !filterState.showUnscored) return false;
    return score >= filterState.scoreRange.min && score <= filterState.scoreRange.max;
  });

  // Episode range
  if (filterState.episodeRange.min || filterState.episodeRange.max) {
    filtered = filtered.filter(anime => {
      const eps = anime.totalEpisodes || 0;
      if (filterState.episodeRange.min && eps < filterState.episodeRange.min) return false;
      if (filterState.episodeRange.max && eps > filterState.episodeRange.max) return false;
      return true;
    });
  }

  // Apply sorting
  filtered = sortAnime(filtered, sortState);

  // Render based on current view mode
  const currentView = localStorage.getItem('animeViewMode') || 'table';
  if (currentView === 'grid') {
    renderAnimeGrid(filtered, sortState);
  } else {
    renderAnimeTable(filtered, sortState);
  }

  // Update result count
  updateResultCount(filtered.length);
  
  // Save current filters
  saveCurrentFilters();
}

function sortAnime(data, sort) {
  let sorted = [...data];
  
  // Random shuffle
  if (sort.column === 'random') {
    for (let i = sorted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
    return sorted;
  }
  
  sorted.sort((a, b) => {
    let valA, valB;

    switch (sort.column) {
      case 'title':
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
        break;
      case 'score':
        valA = a.score || 0;
        valB = b.score || 0;
        break;
      case 'episodesWatched':
        valA = a.episodesWatched || 0;
        valB = b.episodesWatched || 0;
        break;
      case 'progress':
        // Progress percentage
        valA = a.totalEpisodes ? (a.episodesWatched || 0) / a.totalEpisodes : 0;
        valB = b.totalEpisodes ? (b.episodesWatched || 0) / b.totalEpisodes : 0;
        break;
      case 'year':
        valA = a.seasonYear || a.startDate?.year || 0;
        valB = b.seasonYear || b.startDate?.year || 0;
        break;
      case 'averageScore':
        valA = a.averageScore || 0;
        valB = b.averageScore || 0;
        break;
      case 'episodes':
        valA = a.totalEpisodes || 0;
        valB = b.totalEpisodes || 0;
        break;
      default:
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
    }

    if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

function updateResultCount(count) {
  const counter = document.getElementById('list-result-count');
  if (counter) {
    const total = window.animeData?.length || 0;
    
    // Show active filter count
    const activeFilters = getActiveFilterCount();
    const filterText = activeFilters > 0 ? ` (${activeFilters} filter${activeFilters > 1 ? 's' : ''})` : '';
    
    counter.textContent = count === total 
      ? `${count} anime${filterText}` 
      : `${count} of ${total} anime${filterText}`;
  }
}

function getActiveFilterCount() {
  let count = 0;
  if (filterState.search) count++;
  if (filterState.statuses.length > 0) count++;
  if (filterState.genres.length > 0) count++;
  if (filterState.formats.length > 0) count++;
  if (filterState.studios.length > 0) count++;
  if (filterState.yearRange.min || filterState.yearRange.max) count++;
  if (filterState.scoreRange.min > 0 || filterState.scoreRange.max < 10) count++;
  if (filterState.episodeRange.min || filterState.episodeRange.max) count++;
  if (!filterState.showUnscored) count++;
  return count;
}

function saveCurrentFilters() {
  try {
    localStorage.setItem('animeLastFilters', JSON.stringify(filterState));
  } catch {
    // Ignore errors
  }
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

export function clearAllFilters() {
  filterState = {
    search: '',
    statuses: [],
    genres: [],
    formats: [],
    studios: [],
    yearRange: { min: null, max: null },
    scoreRange: { min: 0, max: 10 },
    episodeRange: { min: null, max: null },
    showUnscored: true
  };

  updateFilterUI();
  applyFilters();
  showToast('All filters cleared', 'info');
}

export function triggerFilterUpdate() {
  applyFilters();
}

export function getFilterState() {
  return { ...filterState };
}

export function setFilterState(state) {
  filterState = { ...filterState, ...state };
  updateFilterUI();
  applyFilters();
}

export function getCurrentSort() {
  return { ...sortState };
}

export function setSort(column, direction) {
  sortState.column = column;
  sortState.direction = direction;
  updateSortSelectValue();
  applyFilters();
}

// =====================================================================
// FILTER DATA POPULATION
// =====================================================================

export function populateAdvancedFilters(data) {
  if (!data || data.length === 0) return;
  
  // Extract unique values
  const formats = [...new Set(data.map(a => a.format).filter(Boolean))].sort();
  const studios = [...new Set(data.flatMap(a => a.studios || []).filter(Boolean))].sort();
  const years = data.map(a => a.seasonYear || a.startDate?.year).filter(Boolean);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  // Populate format select
  const formatSelect = document.getElementById('format-multi-select');
  if (formatSelect) {
    formatSelect.innerHTML = formats.map(format => 
      `<option value="${format}">${format}</option>`
    ).join('');
  }
  
  // Populate studio select
  const studioSelect = document.getElementById('studio-multi-select');
  if (studioSelect) {
    studioSelect.innerHTML = studios.map(studio => 
      `<option value="${studio}">${studio}</option>`
    ).join('');
  }
} // ⭐ THIS BRACE WAS MISSING