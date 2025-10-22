// =====================================================================
// --- DATA MODULE (data.js) ---
// =====================================================================
// Contains functions for processing, calculating,
// and formatting the anime data.
// =====================================================================

/**
 * (Private) Helper function to parse duration strings into minutes.
 * @param {string | null} durationStr - The duration string (e.g., "24 min per ep").
 * @param {number} episodesWatched - The number of episodes watched.
 * @returns {number} The total minutes watched for that anime.
 */
function parseDurationToMinutes(durationStr, episodesWatched) {
  // Default to 24 mins if duration is unknown
  if (!durationStr || typeof durationStr !== 'string') return episodesWatched * 24;

  const perEpisodeMatch = durationStr.match(/(\d+)\s*min.*per ep/i);
  if (perEpisodeMatch) {
    const minutesPerEp = parseInt(perEpisodeMatch[1], 10);
    return minutesPerEp * episodesWatched;
  }

  let totalMinutes = 0;
  const hourMatch = durationStr.match(/(\d+)\s*hr/i);
  const minMatch = durationStr.match(/(\d+)\s*min/i);
  if (hourMatch) totalMinutes += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) totalMinutes += parseInt(minMatch[1], 10);

  // Fallback for plain number (likely total movie duration)
  if (totalMinutes === 0 && /^\d+$/.test(durationStr.trim())) {
    totalMinutes = parseInt(durationStr.trim(), 10);
    // If it's a movie (1 episode), use total. Otherwise, default.
    return (episodesWatched <= 1) ? totalMinutes : episodesWatched * 24;
  }

  return totalMinutes > 0 ? totalMinutes : episodesWatched * 24;
}

/**
 * Calculates all dashboard statistics from the raw anime data.
 * @param {Array} data - The user's full animeData array.
 * @returns {object} A statistics object.
 */
export function calculateStatistics(data) {
  if (!Array.isArray(data)) {
    console.error("Invalid data type passed to calculateStatistics:", data);
    return {
      totalAnime: 0,
      totalEpisodes: 0,
      timeWatchedDays: 0,
      totalMinutes: 0,
      timeWatchedHours: 0,
      timeWatchedMinutes: 0,
      meanScore: 0,
      genreCounts: {},
      scoreCounts: {}
    };
  }

  // Filter for anime that are actually "watched"
  const watchedAnime = data.filter(a => a.status && (a.status.toLowerCase() === 'completed' || a.status.toLowerCase() === 'current'));
  const scoredAnime = watchedAnime.filter(a => a.score > 0);

  const totalAnime = watchedAnime.length;
  const totalEpisodes = watchedAnime.reduce((sum, a) => sum + (Number(a.episodesWatched) || 0), 0);
  
  // Set the global total for the gacha system (this is okay for now)
  window.episodesWatchedTotal = totalEpisodes; 

  const totalMinutes = watchedAnime.reduce((sum, anime) => sum + parseDurationToMinutes(anime.duration, Number(anime.episodesWatched) || 0), 0);

  const timeWatchedDays = Math.floor(totalMinutes / (60 * 24));
  const timeWatchedHours = Math.floor((totalMinutes / 60) % 24);
  const timeWatchedMinutes = totalMinutes % 60;

  const meanScore = scoredAnime.length > 0 ?
    (scoredAnime.reduce((sum, a) => sum + a.score, 0) / scoredAnime.length).toFixed(2) :
    0;

  const genreCounts = {};
  watchedAnime.forEach(a => {
    if (a.genres && Array.isArray(a.genres)) {
      a.genres.forEach(genre => genreCounts[genre] = (genreCounts[genre] || 0) + 1);
    }
  });

  const scoreCounts = {
    '0': 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    '7': 0,
    '8': 0,
    '9': 0,
    '10': 0
  };
  watchedAnime.forEach(a => {
    const scoreKey = a.score !== null && a.score !== undefined ? Math.round(a.score).toString() : '0';
    if (scoreCounts[scoreKey] !== undefined) {
      scoreCounts[scoreKey]++;
    } else {
      scoreCounts['0']++; // Count unscored as '0'
    }
  });

  // Don't show the '0' (unscored) bar if it has no entries
  if (scoreCounts['0'] === 0) {
    delete scoreCounts['0'];
  }

  return {
    totalAnime,
    totalEpisodes,
    timeWatchedDays,
    totalMinutes,
    timeWatchedHours,
    timeWatchedMinutes,
    meanScore,
    genreCounts,
    scoreCounts
  };
}

/**
 * Triggers a browser download of the user's anime data as a JSON file.
 * @param {Array} animeData - The user's animeData array.
 */
export function downloadEnrichedJSON(animeData) {
  const errorMessage = document.getElementById('error-message');
  if (!animeData || animeData.length === 0) {
    // This is a UI function, but small enough to live here for now.
    // A stricter refactor would have this call `showError` from ui.js.
    if (errorMessage) {
        errorMessage.textContent = "No anime data to download!";
        errorMessage.classList.remove('hidden');
        setTimeout(() => {
             errorMessage.textContent = '';
             errorMessage.classList.add('hidden');
        }, 3000);
    }
    return;
  }
  
  const jsonString = JSON.stringify(animeData, null, 2);
  const blob = new Blob([jsonString], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'enhanced_anime_list.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}