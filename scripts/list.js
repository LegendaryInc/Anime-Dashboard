// =====================================================================
// --- LIST MODULE (list.js) ---
// =====================================================================
// Handles all filtering, sorting, and view management for the list tab
// =====================================================================

import { renderAnimeTable, renderAnimeGrid } from './ui.js';

// =====================================================================
// STATE MANAGEMENT
// =====================================================================

let filterState = {
  search: '',
  statuses: [], // Multi-select
  genres: [],   // Multi-select
  formats: [],  // New: TV, Movie, OVA, etc.
  yearRange: { min: null, max: null },
  scoreRange: { min: 0, max: 10 },
  episodeRange: { min: null, max: null }
};

let sortState = {
  column: 'title',
  direction: 'asc'
};

// =====================================================================
// FILTER FUNCTIONS
// =====================================================================

/**
 * Initialize list tab with event listeners
 */
export function initListTab() {
  // Search bar
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.addEventListener('input', (e) => {
      filterState.search = e.target.value.toLowerCase();
      applyFilters();
    });
  }

  // Basic filters (will be enhanced later)
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      filterState.statuses = e.target.value ? [e.target.value] : [];
      applyFilters();
    });
  }

  const genreFilter = document.getElementById('genre-filter');
  if (genreFilter) {
    genreFilter.addEventListener('change', (e) => {
      filterState.genres = e.target.value ? [e.target.value] : [];
      applyFilters();
    });
  }

  // Sortable headers
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
        applyFilters();
      }
    });
  }

  // View toggle buttons
  const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
  viewToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setViewMode(view);
    });
  });

  // Restore saved view mode
  const savedViewMode = localStorage.getItem('animeViewMode') || 'table';
  setTimeout(() => {
    setViewMode(savedViewMode);
  }, 100);
}

/**
 * Apply all active filters and sort
 */
function applyFilters() {
  if (!window.animeData) return;
  
  let filtered = [...window.animeData];

  // Apply search filter
  if (filterState.search) {
    filtered = filtered.filter(anime =>
      anime.title.toLowerCase().includes(filterState.search)
    );
  }

  // Apply status filter (multi-select)
  if (filterState.statuses.length > 0) {
    filtered = filtered.filter(anime =>
      filterState.statuses.includes(anime.status)
    );
  }

  // Apply genre filter (multi-select - anime must have ALL selected genres)
  if (filterState.genres.length > 0) {
    filtered = filtered.filter(anime =>
      filterState.genres.every(genre =>
        anime.genres?.includes(genre)
      )
    );
  }

  // Apply format filter
  if (filterState.formats.length > 0) {
    filtered = filtered.filter(anime =>
      filterState.formats.includes(anime.format)
    );
  }

  // Apply year range
  if (filterState.yearRange.min || filterState.yearRange.max) {
    filtered = filtered.filter(anime => {
      const year = anime.seasonYear || anime.startDate?.year;
      if (!year) return false;
      if (filterState.yearRange.min && year < filterState.yearRange.min) return false;
      if (filterState.yearRange.max && year > filterState.yearRange.max) return false;
      return true;
    });
  }

  // Apply score range
  filtered = filtered.filter(anime => {
    const score = anime.score || 0;
    return score >= filterState.scoreRange.min && score <= filterState.scoreRange.max;
  });

  // Apply episode range
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
}

/**
 * Sort anime array
 */
function sortAnime(data, sort) {
  return [...data].sort((a, b) => {
    let valA, valB;

    switch (sort.column) {
      case 'title':
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
        break;
      case 'score':
        valA = a.score || 0;
        valB = b.score || 0;
        break;
      case 'episodesWatched':
        valA = a.episodesWatched || 0;
        valB = b.episodesWatched || 0;
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
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
    }

    if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Set view mode (table or grid)
 */
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

/**
 * Update result count display
 */
function updateResultCount(count) {
  // You can add a result counter element to your HTML
  const counter = document.getElementById('list-result-count');
  if (counter) {
    const total = window.animeData?.length || 0;
    counter.textContent = count === total 
      ? `${count} anime` 
      : `${count} of ${total} anime`;
  }
}

/**
 * Clear all filters
 */
export function clearAllFilters() {
  filterState = {
    search: '',
    statuses: [],
    genres: [],
    formats: [],
    yearRange: { min: null, max: null },
    scoreRange: { min: 0, max: 10 },
    episodeRange: { min: null, max: null }
  };

  // Reset UI elements
  const searchBar = document.getElementById('search-bar');
  if (searchBar) searchBar.value = '';

  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) statusFilter.value = '';

  const genreFilter = document.getElementById('genre-filter');
  if (genreFilter) genreFilter.value = '';

  applyFilters();
}

/**
 * Get current filter state (for saving presets)
 */
export function getFilterState() {
  return { ...filterState };
}

/**
 * Set filter state (for loading presets)
 */
export function setFilterState(state) {
  filterState = { ...state };
  applyFilters();
}

/**
 * Export for use in main.js
 */
export function triggerFilterUpdate() {
  applyFilters();
}

export function getCurrentSort() {
  return { ...sortState };
}

export function setSort(column, direction) {
  sortState.column = column;
  sortState.direction = direction;
  applyFilters();
}