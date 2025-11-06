// =====================================================================
// --- ENHANCED CALENDAR MODULE (calendar.js) ---
// =====================================================================
// Fetches and displays seasonal anime with filtering, sorting, and tracking
// =====================================================================

import { showToast } from './toast.js';
import { observeNewImages } from './lazy-loading.js';

let currentSeasonalData = null;
let currentFilters = {
  type: 'all',        // TV, Movie, OVA, etc.
  status: 'all',      // Airing, Upcoming, Finished
  minScore: 0,        // Minimum score filter
  sort: 'popularity'  // popularity, score, title, date
};

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

  if (!calendarContent) return;

  if (season && year && calendarHeader) {
    calendarHeader.textContent = `${season.charAt(0).toUpperCase() + season.slice(1)} ${year} Anime`;
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

  // Update result count
  if (resultCount) {
    resultCount.textContent = `${data.length} anime`;
  }

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
    
    // Status badge color
    let statusBadgeClass = 'bg-gray-500';
    if (status === 'Currently Airing') statusBadgeClass = 'bg-green-500';
    else if (status === 'Not yet aired') statusBadgeClass = 'bg-blue-500';
    else if (status === 'Finished Airing') statusBadgeClass = 'bg-gray-600';
    
    card.innerHTML = `
      <div class="relative">
        <div class="w-full h-64 overflow-hidden">
          <img src="${imageUrl}" 
               alt="${title}" 
               class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
               referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='https://placehold.co/225x350/1f2937/94a3b8?text=No+Image';">
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
      </div>
      
      <div class="p-4 flex-1 flex flex-col">
        <h3 class="font-bold text-sm mb-2 line-clamp-2 calendar-card-title min-h-[2.5rem]">
          ${title}
        </h3>
        
        <div class="flex-1 space-y-2 text-xs">
          <div class="flex justify-between items-center">
            <span class="text-gray-500">Episodes:</span>
            <span class="font-semibold">${episodes}</span>
          </div>
          
          ${airingDay !== 'TBA' ? `
            <div class="flex justify-between items-center">
              <span class="text-gray-500">Airs:</span>
              <span class="font-semibold">${airingDay}${airingTime ? ` ${airingTime}` : ''}</span>
            </div>
          ` : ''}
          
          <div class="calendar-genres line-clamp-2">
            <span class="text-gray-500">Genres:</span> ${genres}
          </div>
        </div>
        
        <div class="mt-4 flex gap-2">
          <a href="${malUrl}" 
             target="_blank" 
             rel="noopener"
             class="btn-secondary flex-1 text-center py-2 rounded-lg text-xs font-medium">
            View on MAL
          </a>
          <button class="add-to-planning-btn btn-primary px-3 py-2 rounded-lg text-xs font-medium"
                  data-mal-id="${anime.mal_id}"
                  data-title="${title.replace(/"/g, '&quot;')}"
                  title="Add to planning list">
            + Plan to Watch
          </button>
        </div>
      </div>
    `;
    
    calendarContent.appendChild(card);
  });
  
  // Initialize lazy loading for new images
  observeNewImages(calendarContent);
}

/**
 * Apply filters and sorting to seasonal data
 */
function applyFiltersAndSort(data) {
  if (!data) return [];
  
  let filtered = [...data];
  
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
  
  // Minimum score filter
  if (currentFilters.minScore > 0) {
    filtered = filtered.filter(anime => 
      (anime.score || 0) >= currentFilters.minScore
    );
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
  const typeSelect = document.getElementById('calendar-type-filter');
  const statusSelect = document.getElementById('calendar-status-filter');
  const scoreSelect = document.getElementById('calendar-score-filter');
  const sortSelect = document.getElementById('calendar-sort');
  
  if (typeSelect) currentFilters.type = typeSelect.value;
  if (statusSelect) currentFilters.status = statusSelect.value;
  if (scoreSelect) currentFilters.minScore = parseFloat(scoreSelect.value);
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
    type: 'all',
    status: 'all',
    minScore: 0,
    sort: 'popularity'
  };
  
  // Reset UI
  const typeSelect = document.getElementById('calendar-type-filter');
  const statusSelect = document.getElementById('calendar-status-filter');
  const scoreSelect = document.getElementById('calendar-score-filter');
  const sortSelect = document.getElementById('calendar-sort');
  
  if (typeSelect) typeSelect.value = 'all';
  if (statusSelect) statusSelect.value = 'all';
  if (scoreSelect) scoreSelect.value = '0';
  if (sortSelect) sortSelect.value = 'popularity';
  
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
    
    return currentSeasonalData;

  } catch (error) {
    console.error("Calendar fetch error:", error);
    if (calendarContent) {
      calendarContent.innerHTML = `
        <p class="col-span-full text-center text-red-500">
          Failed to load season. API may be unavailable or rate limited.
        </p>`;
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
 * Initialize calendar with event listeners
 */
export function initCalendar() {
  // Filter change listeners
  const typeSelect = document.getElementById('calendar-type-filter');
  const statusSelect = document.getElementById('calendar-status-filter');
  const scoreSelect = document.getElementById('calendar-score-filter');
  const sortSelect = document.getElementById('calendar-sort');
  
  if (typeSelect) typeSelect.addEventListener('change', updateCalendarFilters);
  if (statusSelect) statusSelect.addEventListener('change', updateCalendarFilters);
  if (scoreSelect) scoreSelect.addEventListener('change', updateCalendarFilters);
  if (sortSelect) sortSelect.addEventListener('change', updateCalendarFilters);
  
  // Season navigation
  const prevSeasonBtn = document.getElementById('prev-season-btn');
  const nextSeasonBtn = document.getElementById('next-season-btn');
  
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
        console.error('Failed to add to planning:', error);
        showToast(`Error: ${error.message}`, 'error');
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