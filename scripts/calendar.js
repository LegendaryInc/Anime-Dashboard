// =====================================================================
// --- ENHANCED CALENDAR MODULE (calendar.js) ---
// =====================================================================
// Fetches and displays seasonal anime with filtering, sorting, and tracking
// =====================================================================

import { showToast } from './toast.js';
import { observeNewImages } from './lazy-loading.js';

let currentSeasonalData = null;
let currentFilters = {
  search: '',         // Search query
  type: 'all',        // TV, Movie, OVA, etc.
  status: 'all',      // Airing, Upcoming, Finished
  genre: 'all',       // Genre filter
  minScore: 0,        // Minimum score filter
  inMyList: 'all',    // all, yes, no - filter by whether anime is in user's list
  quickFilter: 'all', // all, airing-this-week, in-my-list, high-score
  sort: 'popularity'  // popularity, score, title, date
};

/**
 * Check if an anime is in the user's list
 * @param {Object} anime - Anime object from Jikan API
 * @returns {Object|null} - User's anime entry if found, null otherwise
 */
function isAnimeInMyList(anime) {
  if (!window.animeData || !Array.isArray(window.animeData)) return null;
  
  const malId = anime.mal_id;
  if (!malId) return null;
  
  // Check by MAL ID
  const found = window.animeData.find(a => {
    const userMalId = a.idMal || a.malId;
    return userMalId && parseInt(userMalId) === parseInt(malId);
  });
  
  return found || null;
}

/**
 * Get English title or fallback to original
 */
function getEnglishTitle(anime) {
  return anime.title_english || anime.title || 'Unknown Title';
}

/**
 * Get day of week for airing time
 */
function getDayOfWeek(broadcast) {
  if (!broadcast?.day) return 'TBA';
  return broadcast.day;
}

/**
 * Format airing time
 */
function formatAiringTime(broadcast) {
  if (!broadcast?.time) return '';
  return broadcast.time;
}

/**
 * Renders enhanced seasonal anime cards with more info
 */
function renderSeasonalAnime(season, year, data) {
  const calendarContent = document.getElementById('calendar-content');
  const calendarHeader = document.getElementById('calendar-header');
  const resultCount = document.getElementById('calendar-result-count');
  const currentSeasonBtn = document.getElementById('current-season-btn');

  if (!calendarContent) return;

  if (season && year && calendarHeader) {
    calendarHeader.textContent = `${season.charAt(0).toUpperCase() + season.slice(1)} ${year} Anime`;
  }
  
  // Update "Current" button style based on whether we're viewing the current season
  if (currentSeasonBtn) {
    const current = getSeason();
    const isCurrentSeason = season === current.name && year === current.year;
    if (isCurrentSeason) {
      // If viewing current season, make it look active/disabled
      currentSeasonBtn.classList.remove('btn-primary');
      currentSeasonBtn.classList.add('btn-secondary', 'opacity-60', 'cursor-default');
      currentSeasonBtn.disabled = true;
    } else {
      // If viewing other season, make it clickable
      currentSeasonBtn.classList.remove('btn-secondary', 'opacity-60', 'cursor-default');
      currentSeasonBtn.classList.add('btn-primary');
      currentSeasonBtn.disabled = false;
    }
  }

  calendarContent.innerHTML = '';

  if (!data || data.length === 0) {
    calendarContent.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-lg text-gray-500">No anime found matching your filters</p>
        <button onclick="window.resetCalendarFilters()" class="btn-secondary mt-4 px-4 py-2 rounded-lg">
          Reset Filters
        </button>
      </div>`;
    if (resultCount) resultCount.textContent = '0 anime';
    return;
  }

  // Update result count and stats
  if (resultCount) {
    resultCount.textContent = `${data.length} anime`;
  }
  
  // Update stats summary
  updateCalendarStats(data);

  data.forEach(anime => {
    const card = document.createElement('div');
    card.className = 'anime-card calendar-card rounded-lg flex flex-col group relative overflow-hidden';
    
    const imageUrl = anime.images?.jpg?.large_image_url || 
                     anime.images?.jpg?.image_url || 
                     'https://placehold.co/225x350/1f2937/94a3b8?text=No+Image';
    const title = getEnglishTitle(anime);
    const score = anime.score ? anime.score.toFixed(1) : 'N/A';
    const scoreBadgeClass = anime.score >= 8 ? 'score-high' : 
                            anime.score >= 7 ? 'score-good' : 
                            anime.score >= 6 ? 'score-mid' : 'score-low';
    const genres = anime.genres?.map(g => g.name).slice(0, 3).join(', ') || 'Unknown';
    const type = anime.type || 'Unknown';
    const episodes = anime.episodes ? `${anime.episodes} eps` : 'TBA';
    const status = anime.status || 'Unknown';
    const airingDay = getDayOfWeek(anime.broadcast);
    const airingTime = formatAiringTime(anime.broadcast);
    const malUrl = anime.url || `https://myanimelist.net/anime/${anime.mal_id}`;
    
    // Check if anime is in user's list
    const userAnime = isAnimeInMyList(anime);
    const isInMyList = userAnime !== null;
    const userStatus = userAnime ? (userAnime.status || '').toLowerCase() : '';
    const userProgress = userAnime ? (userAnime.episodesWatched || 0) : 0;
    const userTotalEpisodes = userAnime ? (userAnime.totalEpisodes || null) : null;
    
    // Status badge color
    let statusBadgeClass = 'bg-gray-500';
    if (status === 'Currently Airing') statusBadgeClass = 'bg-green-500';
    else if (status === 'Not yet aired') statusBadgeClass = 'bg-blue-500';
    else if (status === 'Finished Airing') statusBadgeClass = 'bg-gray-600';
    
    // In My List badge
    let inListBadge = '';
    if (isInMyList) {
      let statusText = 'In My List';
      let statusColor = 'bg-blue-500';
      
      if (userStatus === 'current' || userStatus === 'watching') {
        statusText = 'Watching';
        statusColor = 'bg-green-500';
      } else if (userStatus === 'completed') {
        statusText = 'Completed';
        statusColor = 'bg-purple-500';
      } else if (userStatus === 'planning' || userStatus === 'plan to watch') {
        statusText = 'Plan to Watch';
        statusColor = 'bg-yellow-500';
      } else if (userStatus === 'paused') {
        statusText = 'Paused';
        statusColor = 'bg-orange-500';
      } else if (userStatus === 'dropped') {
        statusText = 'Dropped';
        statusColor = 'bg-red-500';
      } else if (userStatus === 'repeating' || userStatus === 're-watching') {
        statusText = 'Rewatching';
        statusColor = 'bg-indigo-500';
      }
      
      inListBadge = `
        <div class="absolute bottom-2 left-2 right-2">
          <span class="${statusColor} text-white text-xs font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
            ✓ ${statusText}
            ${userProgress > 0 && userTotalEpisodes ? ` (${userProgress}/${userTotalEpisodes})` : userProgress > 0 ? ` (${userProgress})` : ''}
          </span>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="relative">
        <div class="w-full h-64 overflow-hidden">
          <img data-src="${imageUrl}" 
               src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 225 350'%3E%3Crect fill='%231f2937' width='225' height='350'/%3E%3C/svg%3E"
               data-error-src="https://placehold.co/225x350/1f2937/94a3b8?text=No+Image"
               alt="${title}" 
               class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
               referrerpolicy="no-referrer">
        </div>
        
        <div class="absolute top-2 left-2 flex flex-col gap-2">
          <span class="calendar-type-badge">${type}</span>
          ${anime.score ? `<span class="calendar-score-badge ${scoreBadgeClass}">⭐ ${score}</span>` : ''}
        </div>
        
        <div class="absolute top-2 right-2">
          <span class="${statusBadgeClass} text-white text-xs font-bold px-2 py-1 rounded-full">
            ${status === 'Currently Airing' ? '🔴 Airing' : 
              status === 'Not yet aired' ? '📅 Upcoming' : '✓ Finished'}
          </span>
        </div>
        ${inListBadge}
      </div>
      
      <div class="p-4 flex-1 flex flex-col">
        <h3 class="font-bold text-sm mb-2 line-clamp-2 calendar-card-title min-h-[2.5rem]">
          ${title}
        </h3>
        
        <div class="flex-1 space-y-1.5 text-xs mb-3">
          ${airingDay !== 'TBA' ? `
            <div class="flex items-center gap-1.5">
              <span class="text-gray-500">📅</span>
              <span class="font-semibold">${airingDay}${airingTime ? ` ${airingTime}` : ''}</span>
            </div>
          ` : ''}
          
          <div class="flex items-center gap-1.5">
            <span class="text-gray-500">📺</span>
            <span class="font-semibold">${episodes}</span>
          </div>
          
          <div class="calendar-genres line-clamp-1 text-xs">
            <span class="text-gray-500">🎭</span>
            <span>${genres}</span>
          </div>
        </div>
        
        <div class="mt-auto flex gap-2">
          <a href="${malUrl}" 
             target="_blank" 
             rel="noopener"
             class="btn-secondary flex-1 text-center py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
            View on MAL
          </a>
          ${!isInMyList ? `
            <button class="add-to-planning-btn btn-primary px-3 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                    data-mal-id="${anime.mal_id}"
                    data-title="${title.replace(/"/g, '&quot;')}"
                    title="Add to planning list">
              + Plan
            </button>
          ` : `
            <button class="btn-secondary px-3 py-2 rounded-lg text-xs font-medium opacity-60 cursor-not-allowed" disabled
                    title="Already in your list">
              ✓
            </button>
          `}
        </div>
      </div>
    `;
    
    calendarContent.appendChild(card);
  });
  
  // Initialize lazy loading for new images
  observeNewImages(calendarContent);
}

/**
 * Update calendar stats summary
 */
function updateCalendarStats(data) {
  if (!data || !Array.isArray(data)) return;
  
  const statsContainer = document.getElementById('calendar-stats');
  if (!statsContainer) return;
  
  const airing = data.filter(a => a.status === 'Currently Airing').length;
  const upcoming = data.filter(a => a.status === 'Not yet aired').length;
  const inMyList = data.filter(a => isAnimeInMyList(a) !== null).length;
  const highScore = data.filter(a => (a.score || 0) >= 8).length;
  
  statsContainer.innerHTML = `
    <div class="calendar-stats-grid">
      <div class="calendar-stat-item">
        <span class="calendar-stat-label">Airing:</span>
        <span class="calendar-stat-value">${airing}</span>
      </div>
      <div class="calendar-stat-item">
        <span class="calendar-stat-label">Upcoming:</span>
        <span class="calendar-stat-value">${upcoming}</span>
      </div>
      <div class="calendar-stat-item">
        <span class="calendar-stat-label">In My List:</span>
        <span class="calendar-stat-value">${inMyList}</span>
      </div>
      <div class="calendar-stat-item">
        <span class="calendar-stat-label">High Score (8.0+):</span>
        <span class="calendar-stat-value">${highScore}</span>
      </div>
    </div>
  `;
}

/**
 * Apply filters and sorting to seasonal data
 */
function applyFiltersAndSort(data) {
  if (!data) return [];
  
  let filtered = [...data];
  
  // Search filter
  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filtered = filtered.filter(anime => {
      const title = getEnglishTitle(anime).toLowerCase();
      return title.includes(searchLower);
    });
  }
  
  // Quick filter
  if (currentFilters.quickFilter !== 'all') {
    if (currentFilters.quickFilter === 'airing-this-week') {
      filtered = filtered.filter(anime => isAiringThisWeek(anime));
    } else if (currentFilters.quickFilter === 'in-my-list') {
      filtered = filtered.filter(anime => isAnimeInMyList(anime) !== null);
    } else if (currentFilters.quickFilter === 'high-score') {
      filtered = filtered.filter(anime => (anime.score || 0) >= 8);
    }
  }
  
  // Type filter (TV, Movie, OVA, etc.)
  if (currentFilters.type !== 'all') {
    filtered = filtered.filter(anime => 
      (anime.type || '').toLowerCase() === currentFilters.type.toLowerCase()
    );
  }
  
  // Status filter
  if (currentFilters.status !== 'all') {
    filtered = filtered.filter(anime => 
      (anime.status || '').toLowerCase().includes(currentFilters.status.toLowerCase())
    );
  }
  
  // Genre filter
  if (currentFilters.genre !== 'all') {
    filtered = filtered.filter(anime => {
      if (!anime.genres || !Array.isArray(anime.genres)) return false;
      return anime.genres.some(g => g && g.name === currentFilters.genre);
    });
  }
  
  // Minimum score filter
  if (currentFilters.minScore > 0) {
    filtered = filtered.filter(anime => 
      (anime.score || 0) >= currentFilters.minScore
    );
  }
  
  // In My List filter
  if (currentFilters.inMyList !== 'all') {
    filtered = filtered.filter(anime => {
      const isInList = isAnimeInMyList(anime) !== null;
      if (currentFilters.inMyList === 'yes') {
        return isInList;
      } else if (currentFilters.inMyList === 'no') {
        return !isInList;
      }
      return true;
    });
  }
  
  // Sorting
  filtered.sort((a, b) => {
    switch (currentFilters.sort) {
      case 'score':
        return (b.score || 0) - (a.score || 0);
      
      case 'title':
        const titleA = getEnglishTitle(a).toLowerCase();
        const titleB = getEnglishTitle(b).toLowerCase();
        return titleA.localeCompare(titleB);
      
      case 'date':
        // Sort by air date (upcoming first)
        const dateA = new Date(a.aired?.from || 0);
        const dateB = new Date(b.aired?.from || 0);
        return dateB - dateA;
      
      case 'popularity':
      default:
        return (a.popularity || 999999) - (b.popularity || 999999);
    }
  });
  
  return filtered;
}

/**
 * Update filters and re-render
 */
export function updateCalendarFilters() {
  const searchInput = document.getElementById('calendar-search');
  const typeSelect = document.getElementById('calendar-type-filter');
  const statusSelect = document.getElementById('calendar-status-filter');
  const genreSelect = document.getElementById('calendar-genre-filter');
  const scoreSelect = document.getElementById('calendar-score-filter');
  const inMyListSelect = document.getElementById('calendar-in-mylist-filter');
  const sortSelect = document.getElementById('calendar-sort');
  
  if (searchInput) currentFilters.search = searchInput.value.trim();
  if (typeSelect) currentFilters.type = typeSelect.value;
  if (statusSelect) currentFilters.status = statusSelect.value;
  if (genreSelect) currentFilters.genre = genreSelect.value;
  if (scoreSelect) currentFilters.minScore = parseFloat(scoreSelect.value);
  if (inMyListSelect) currentFilters.inMyList = inMyListSelect.value;
  if (sortSelect) currentFilters.sort = sortSelect.value;
  
  if (currentSeasonalData) {
    const filtered = applyFiltersAndSort(currentSeasonalData);
    const season = getSeason();
    renderSeasonalAnime(season.name, season.year, filtered);
  }
}

/**
 * Reset all filters
 */
export function resetCalendarFilters() {
  currentFilters = {
    search: '',
    type: 'all',
    status: 'all',
    genre: 'all',
    minScore: 0,
    inMyList: 'all',
    quickFilter: 'all',
    sort: 'popularity'
  };
  
  // Reset UI
  const searchInput = document.getElementById('calendar-search');
  const typeSelect = document.getElementById('calendar-type-filter');
  const statusSelect = document.getElementById('calendar-status-filter');
  const genreSelect = document.getElementById('calendar-genre-filter');
  const scoreSelect = document.getElementById('calendar-score-filter');
  const inMyListSelect = document.getElementById('calendar-in-mylist-filter');
  const sortSelect = document.getElementById('calendar-sort');
  const quickFilterBtns = document.querySelectorAll('.calendar-quick-filter-btn');
  
  if (searchInput) searchInput.value = '';
  if (typeSelect) typeSelect.value = 'all';
  if (statusSelect) statusSelect.value = 'all';
  if (genreSelect) genreSelect.value = 'all';
  if (scoreSelect) scoreSelect.value = '0';
  if (inMyListSelect) inMyListSelect.value = 'all';
  if (sortSelect) sortSelect.value = 'popularity';
  
  // Reset quick filter buttons
  quickFilterBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === 'all') {
      btn.classList.add('active');
    }
  });
  
  updateCalendarFilters();
}

/**
 * Get current season info
 */
function getSeason() {
  const today = new Date();
  const month = today.getMonth() + 1;
  let year = today.getFullYear();
  let season;

  if (month >= 1 && month <= 3) {
    season = 'winter';
  } else if (month >= 4 && month <= 6) {
    season = 'spring';
  } else if (month >= 7 && month <= 9) {
    season = 'summer';
  } else {
    season = 'fall';
  }
  
  return { name: season, year };
}

/**
 * Fetch different season
 */
export async function fetchDifferentSeason(season, year) {
  const calendarLoading = document.getElementById('calendar-loading');
  const calendarContent = document.getElementById('calendar-content');

  if (calendarLoading) calendarLoading.classList.remove('hidden');
  if (calendarContent) calendarContent.innerHTML = '';

  try {
    const apiUrl = `https://api.jikan.moe/v4/seasons/${year}/${season}`;
    const response = await fetch(apiUrl);

    if (response.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retryResponse = await fetch(apiUrl);
      if (!retryResponse.ok) {
        throw new Error(`Failed to fetch season: ${retryResponse.statusText}`);
      }
      const result = await retryResponse.json();
      currentSeasonalData = result.data;
    } else if (!response.ok) {
      throw new Error(`Failed to fetch season: ${response.statusText}`);
    } else {
      const result = await response.json();
      currentSeasonalData = result.data;
    }

    const filtered = applyFiltersAndSort(currentSeasonalData);
    renderSeasonalAnime(season, year, filtered);
    
    // Update genre filter options after data is loaded
    if (currentSeasonalData) {
      const genreSelect = document.getElementById('calendar-genre-filter');
      if (genreSelect) {
        const availableGenres = getAvailableGenres(currentSeasonalData);
        const currentValue = genreSelect.value;
        genreSelect.innerHTML = '<option value="all">All Genres</option>' +
          availableGenres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
        genreSelect.value = currentValue;
      }
    }
    
    return currentSeasonalData;

  } catch (error) {
    const { handleError, isRetryableError } = await import('./error-handler.js');
    const errorInfo = handleError(error, 'loading calendar', {
      showToast: true
    });
    
    if (calendarContent) {
      const canRetry = isRetryableError(error);
      calendarContent.innerHTML = `
        <div class="col-span-full text-center py-8">
          <p class="text-red-500 mb-4">${errorInfo.message}</p>
          ${canRetry ? `
            <button class="btn-primary retry-btn" onclick="window.loadCalendarSeason('${season}', ${year})">
              Retry
            </button>
          ` : ''}
        </div>`;
    }
    return null;
  } finally {
    if (calendarLoading) calendarLoading.classList.add('hidden');
  }
}

/**
 * Fetches the current seasonal anime schedule
 */
export async function fetchSeasonalAnime() {
  const { name, year } = getSeason();
  return await fetchDifferentSeason(name, year);
}

/**
 * Get unique genres from seasonal data
 */
function getAvailableGenres(data) {
  if (!data || !Array.isArray(data)) return [];
  const genres = new Set();
  data.forEach(anime => {
    if (anime.genres && Array.isArray(anime.genres)) {
      anime.genres.forEach(genre => {
        if (genre && genre.name) {
          genres.add(genre.name);
        }
      });
    }
  });
  return Array.from(genres).sort();
}

/**
 * Check if anime is airing this week
 */
function isAiringThisWeek(anime) {
  if (!anime.broadcast?.day || !anime.broadcast?.time) return false;
  
  const today = new Date();
  const dayOfWeek = today.getDay();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = days[dayOfWeek];
  
  return anime.broadcast.day === todayName;
}

/**
 * Create calendar filter controls
 */
function createCalendarControls() {
  const controlsContainer = document.querySelector('.calendar-controls');
  if (!controlsContainer) return;
  
  // Check if controls already exist
  if (controlsContainer.querySelector('#calendar-search')) return;
  
  // Get available genres from current data
  const availableGenres = currentSeasonalData ? getAvailableGenres(currentSeasonalData) : [];
  
  controlsContainer.innerHTML = `
    <!-- Search Bar -->
    <div class="calendar-search-container mb-4">
      <input 
        type="text" 
        id="calendar-search" 
        placeholder="🔍 Search anime by title..." 
        class="calendar-search-input"
        aria-label="Search anime by title"
      />
    </div>
    
    <!-- Quick Filter Buttons -->
    <div class="calendar-quick-filters mb-4">
      <div class="flex flex-wrap gap-2">
        <button class="calendar-quick-filter-btn active" data-filter="all">
          All
        </button>
        <button class="calendar-quick-filter-btn" data-filter="airing-this-week">
          📺 Airing This Week
        </button>
        <button class="calendar-quick-filter-btn" data-filter="in-my-list">
          ✓ In My List
        </button>
        <button class="calendar-quick-filter-btn" data-filter="high-score">
          ⭐ High Score (8.0+)
        </button>
      </div>
    </div>
    
    <!-- Advanced Filters -->
    <div class="calendar-advanced-filters">
      <div class="calendar-filters-row">
        <div class="calendar-filter-group">
          <label for="calendar-type-filter">Type</label>
          <select id="calendar-type-filter" class="calendar-filter-select filter-select">
            <option value="all">All Types</option>
            <option value="TV">TV</option>
            <option value="Movie">Movie</option>
            <option value="OVA">OVA</option>
            <option value="ONA">ONA</option>
            <option value="Special">Special</option>
          </select>
        </div>
        
        <div class="calendar-filter-group">
          <label for="calendar-status-filter">Status</label>
          <select id="calendar-status-filter" class="calendar-filter-select filter-select">
            <option value="all">All Statuses</option>
            <option value="Airing">Airing</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Finished">Finished</option>
          </select>
        </div>
        
        <div class="calendar-filter-group">
          <label for="calendar-genre-filter">Genre</label>
          <select id="calendar-genre-filter" class="calendar-filter-select filter-select">
            <option value="all">All Genres</option>
            ${availableGenres.map(genre => `<option value="${genre}">${genre}</option>`).join('')}
          </select>
        </div>
        
        <div class="calendar-filter-group">
          <label for="calendar-score-filter">Min Score</label>
          <select id="calendar-score-filter" class="calendar-filter-select filter-select">
            <option value="0">Any</option>
            <option value="7">7.0+</option>
            <option value="8">8.0+</option>
            <option value="9">9.0+</option>
          </select>
        </div>
        
        <div class="calendar-filter-group">
          <label for="calendar-in-mylist-filter">In My List</label>
          <select id="calendar-in-mylist-filter" class="calendar-filter-select filter-select">
            <option value="all">All</option>
            <option value="yes">In My List</option>
            <option value="no">Not In My List</option>
          </select>
        </div>
        
        <div class="calendar-filter-group">
          <label for="calendar-sort">Sort</label>
          <select id="calendar-sort" class="calendar-filter-select filter-select">
            <option value="popularity">Popularity</option>
            <option value="score">Score</option>
            <option value="title">Title</option>
            <option value="date">Date</option>
          </select>
        </div>
        
        <div class="calendar-nav-group">
          <button id="prev-season-btn" class="btn-secondary px-3 py-2 rounded-lg text-sm font-medium">
            ← Previous
          </button>
          <button id="current-season-btn" class="btn-primary px-3 py-2 rounded-lg text-sm font-medium">
            Current
          </button>
          <button id="next-season-btn" class="btn-secondary px-3 py-2 rounded-lg text-sm font-medium">
            Next →
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize calendar with event listeners
 */
export function initCalendar() {
  // Create calendar controls if they don't exist
  createCalendarControls();
  
  // Search input listener (debounced)
  const searchInput = document.getElementById('calendar-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        updateCalendarFilters();
      }, 300);
    });
  }
  
  // Quick filter button listeners
  const quickFilterBtns = document.querySelectorAll('.calendar-quick-filter-btn');
  quickFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      quickFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update filter
      currentFilters.quickFilter = btn.dataset.filter || 'all';
      updateCalendarFilters();
    });
  });
  
  // Filter change listeners
  const typeSelect = document.getElementById('calendar-type-filter');
  const statusSelect = document.getElementById('calendar-status-filter');
  const genreSelect = document.getElementById('calendar-genre-filter');
  const scoreSelect = document.getElementById('calendar-score-filter');
  const inMyListSelect = document.getElementById('calendar-in-mylist-filter');
  const sortSelect = document.getElementById('calendar-sort');
  
  if (typeSelect) typeSelect.addEventListener('change', updateCalendarFilters);
  if (statusSelect) statusSelect.addEventListener('change', updateCalendarFilters);
  if (genreSelect) genreSelect.addEventListener('change', updateCalendarFilters);
  if (scoreSelect) scoreSelect.addEventListener('change', updateCalendarFilters);
  if (inMyListSelect) inMyListSelect.addEventListener('change', updateCalendarFilters);
  if (sortSelect) sortSelect.addEventListener('change', updateCalendarFilters);
  
  // Season navigation
  const currentSeasonBtn = document.getElementById('current-season-btn');
  const prevSeasonBtn = document.getElementById('prev-season-btn');
  const nextSeasonBtn = document.getElementById('next-season-btn');
  
  if (currentSeasonBtn) {
    currentSeasonBtn.addEventListener('click', () => {
      const current = getSeason();
      fetchDifferentSeason(current.name, current.year);
    });
  }
  
  if (prevSeasonBtn) {
    prevSeasonBtn.addEventListener('click', () => navigateSeason(-1));
  }
  if (nextSeasonBtn) {
    nextSeasonBtn.addEventListener('click', () => navigateSeason(1));
  }
  
  // Global function for reset button in rendered content
  window.resetCalendarFilters = resetCalendarFilters;
  
  // Event delegation for "Add to Planning" buttons
  document.body.addEventListener('click', async (e) => {
    if (e.target.classList.contains('add-to-planning-btn')) {
      const button = e.target;
      const malId = button.dataset.malId;
      const title = button.dataset.title;
      
      if (!malId) return;
      
      // Disable button
      button.disabled = true;
      button.textContent = 'Adding...';

      try {
        const response = await fetch('/api/anilist/add-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ malId, title })
        });
        
        const newEntry = await response.json();

        if (!response.ok) {
          throw new Error(newEntry.error || 'Failed to add to list');
        }

        // --- Success ---
        showToast(`Added '${title}' to your planning list!`, 'success');
        button.textContent = 'Added ✓';
        button.classList.remove('btn-primary');
        button.classList.add('btn-secondary'); // Change style to show it's done

        // Dispatch a custom event to notify main.js to add this to the list
        document.dispatchEvent(new CustomEvent('animeAdded', {
          detail: newEntry
        }));

      } catch (error) {
        const { handleError } = await import('./error-handler.js');
        handleError(error, 'adding to planning list', {
          showToast: true
        });
        // Re-enable button on failure
        button.disabled = false;
        button.textContent = '+ Plan to Watch';
      }
    }
  });
}

/**
 * Navigate to previous/next season
 */
function navigateSeason(direction) {
  const seasons = ['winter', 'spring', 'summer', 'fall'];
  const { name, year } = getSeason();
  
  let seasonIndex = seasons.indexOf(name);
  let newYear = year;
  
  seasonIndex += direction;
  
  if (seasonIndex < 0) {
    seasonIndex = 3;
    newYear -= 1;
  } else if (seasonIndex > 3) {
    seasonIndex = 0;
    newYear += 1;
  }
  
  fetchDifferentSeason(seasons[seasonIndex], newYear);
}