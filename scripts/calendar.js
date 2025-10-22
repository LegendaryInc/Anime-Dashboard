// =====================================================================
// --- CALENDAR MODULE (calendar.js) ---
// =====================================================================
// Handles fetching and rendering the seasonal anime calendar
// from the Jikan.moe API.
// =====================================================================

/**
 * Renders the seasonal anime cards to the DOM.
 * (Private helper function, not exported)
 * @param {string | null} season - The name of the season (e.g., "spring").
 * @param {number | null} year - The year.
 * @param {Array} data - The array of anime data from the Jikan API.
 */
function renderSeasonalAnime(season, year, data) {
  const calendarContent = document.getElementById('calendar-content');
  const calendarHeader = document.getElementById('calendar-header');

  if (!calendarContent) return;

  if (season && year && calendarHeader) {
    calendarHeader.textContent = `${season.charAt(0).toUpperCase() + season.slice(1)} ${year} Anime`;
  }

  calendarContent.innerHTML = ''; // Clear old content

  if (!data || data.length === 0) {
    calendarContent.innerHTML = `<p class="text-center text-gray-500 py-4">No seasonal anime found.</p>`;
    return;
  }

  // Limit to 20 to avoid overwhelming the UI
  const displayData = data.slice(0, 20);

  displayData.forEach(anime => {
    const card = document.createElement('div');
    card.className = 'anime-card calendar-card p-4 rounded-lg flex flex-col group';
    const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || 'https://placehold.co/225x350/cccccc/333333?text=No+Image';
    const title = anime.title || 'Unknown Title';
    const score = anime.score ? `⭐ ${anime.score.toFixed(1)}` : 'N/A';
    const genres = anime.genres?.map(g => g.name).slice(0, 3).join(', ') || 'Unknown';
    card.innerHTML = `
        <div class="w-full h-48 mb-3 overflow-hidden rounded-lg">
            <img src="${imageUrl}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110">
        </div>
        <h3 class="font-bold text-sm mb-2 line-clamp-2 calendar-card-title">${title}</h3>
        <div class="mt-auto text-xs space-y-1">
            <p class="calendar-card-text"><span class="font-semibold">Score:</span> ${score}</p>
            <p class="calendar-card-text line-clamp-1"><span class="font-semibold">Genres:</span> ${genres}</p>
        </div>
    `;
    calendarContent.appendChild(card);
  });
}

/**
 * Fetches the current seasonal anime schedule from the Jikan API.
 * @returns {Promise<Array | null>} A promise that resolves to the anime data array.
 */
export async function fetchSeasonalAnime() {
  const calendarLoading = document.getElementById('calendar-loading');
  const calendarContent = document.getElementById('calendar-content');

  if (calendarLoading) calendarLoading.classList.remove('hidden');
  if (calendarContent) calendarContent.innerHTML = '';

  let seasonalAnimeData = null;

  try {
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
    } // Oct, Nov, Dec

    const apiUrl = `https://api.jikan.moe/v4/seasons/${year}/${season}`;
    const response = await fetch(apiUrl);

    if (response.status === 429) {
      // Handle rate limiting with a simple delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      const retryResponse = await fetch(apiUrl);
      if (!retryResponse.ok) {
        throw new Error(`Failed to fetch season schedule (retry): ${retryResponse.statusText}`);
      }
      const result = await retryResponse.json();
      seasonalAnimeData = result.data;
    } else if (!response.ok) {
      throw new Error(`Failed to fetch season schedule: ${response.statusText}`);
    } else {
      const result = await response.json();
      seasonalAnimeData = result.data;
    }

    // Render the data
    renderSeasonalAnime(season, year, seasonalAnimeData);

  } catch (error) {
    console.error("Calendar fetch error:", error);
    if (calendarContent) calendarContent.innerHTML = `<p class="text-center text-red-500">Failed to load schedule. API may be unavailable or rate limited.</p>`;
  } finally {
    if (calendarLoading) calendarLoading.classList.add('hidden');
  }
  
  // Return the fetched data so main.js can cache it
  return seasonalAnimeData;
}