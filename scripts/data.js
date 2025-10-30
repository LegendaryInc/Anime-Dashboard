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
      scoreCounts: {},
      studioCounts: {},
      formatCounts: {},
      statusCounts: {},
      averageScoreByGenre: {},
      completionRate: 0,
      topStudio: null,
      highestRatedGenre: null,
      averageEpisodesPerAnime: 0
    };
  }

  // Filter for anime that are actually "watched"
  const watchedAnime = data.filter(a => a.status && (a.status.toLowerCase() === 'completed' || a.status.toLowerCase() === 'current'));
  const scoredAnime = watchedAnime.filter(a => a.score > 0);

  const totalAnime = watchedAnime.length;
  const totalEpisodes = watchedAnime.reduce((sum, a) => sum + (Number(a.episodesWatched) || 0), 0);
  
  // Set the global total for the gacha system
  window.episodesWatchedTotal = totalEpisodes; 

  const totalMinutes = watchedAnime.reduce((sum, anime) => sum + parseDurationToMinutes(anime.duration, Number(anime.episodesWatched) || 0), 0);

  const timeWatchedDays = Math.floor(totalMinutes / (60 * 24));
  const timeWatchedHours = Math.floor((totalMinutes / 60) % 24);
  const timeWatchedMinutes = totalMinutes % 60;

  const meanScore = scoredAnime.length > 0 ?
    (scoredAnime.reduce((sum, a) => sum + a.score, 0) / scoredAnime.length).toFixed(2) :
    0;

  // Genre counts
  const genreCounts = {};
  watchedAnime.forEach(a => {
    if (a.genres && Array.isArray(a.genres)) {
      a.genres.forEach(genre => genreCounts[genre] = (genreCounts[genre] || 0) + 1);
    }
  });

  // Score counts
  const scoreCounts = {
    '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0,
    '6': 0, '7': 0, '8': 0, '9': 0, '10': 0
  };
  watchedAnime.forEach(a => {
    const scoreKey = a.score !== null && a.score !== undefined ? Math.round(a.score).toString() : '0';
    if (scoreCounts[scoreKey] !== undefined) {
      scoreCounts[scoreKey]++;
    } else {
      scoreCounts['0']++;
    }
  });

  // Don't show the '0' (unscored) bar if it has no entries
  if (scoreCounts['0'] === 0) {
    delete scoreCounts['0'];
  }

  // ⭐ NEW: Studio counts
  const studioCounts = {};
  watchedAnime.forEach(a => {
    if (a.studios && Array.isArray(a.studios)) {
      a.studios.forEach(studio => {
        studioCounts[studio] = (studioCounts[studio] || 0) + 1;
      });
    }
  });

  // ⭐ NEW: Format counts (TV, Movie, OVA, etc.)
  const formatCounts = {};
  watchedAnime.forEach(a => {
    if (a.format) {
      const format = a.format;
      formatCounts[format] = (formatCounts[format] || 0) + 1;
    }
  });

  // ⭐ NEW: Status counts (for all anime, not just watched)
  const statusCounts = {};
  data.forEach(a => {
    if (a.status) {
      const status = a.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  });

  // ⭐ NEW: Average score by genre
  const genreScoreSums = {};
  const genreScoreCounts = {};
  
  scoredAnime.forEach(a => {
    if (a.genres && Array.isArray(a.genres) && a.score > 0) {
      a.genres.forEach(genre => {
        if (!genreScoreSums[genre]) {
          genreScoreSums[genre] = 0;
          genreScoreCounts[genre] = 0;
        }
        genreScoreSums[genre] += a.score;
        genreScoreCounts[genre]++;
      });
    }
  });

  const averageScoreByGenre = {};
  Object.keys(genreScoreSums).forEach(genre => {
    averageScoreByGenre[genre] = (genreScoreSums[genre] / genreScoreCounts[genre]).toFixed(2);
  });

  // ⭐ NEW: Completion rate
  const startedAnime = data.filter(a => 
    a.status && ['completed', 'current', 'dropped', 'paused'].includes(a.status.toLowerCase())
  ).length;
  const completedAnime = data.filter(a => 
    a.status && a.status.toLowerCase() === 'completed'
  ).length;
  const completionRate = startedAnime > 0 ? ((completedAnime / startedAnime) * 100).toFixed(1) : 0;

  // ⭐ NEW: Top studio
  const topStudio = Object.entries(studioCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

  // ⭐ NEW: Highest rated genre
  const highestRatedGenre = Object.entries(averageScoreByGenre)
    .filter(([, score]) => genreScoreCounts[Object.keys(averageScoreByGenre).find(k => averageScoreByGenre[k] === score)] >= 3) // At least 3 anime
    .sort(([, a], [, b]) => parseFloat(b) - parseFloat(a))[0]?.[0] || null;

  // ⭐ NEW: Average episodes per anime
  const averageEpisodesPerAnime = totalAnime > 0 ? (totalEpisodes / totalAnime).toFixed(1) : 0;

  return {
    totalAnime,
    totalEpisodes,
    timeWatchedDays,
    totalMinutes,
    timeWatchedHours,
    timeWatchedMinutes,
    meanScore,
    genreCounts,
    scoreCounts,
    studioCounts,
    formatCounts,
    statusCounts,
    averageScoreByGenre,
    completionRate,
    topStudio,
    highestRatedGenre,
    averageEpisodesPerAnime
  };
}

/**
 * Triggers a browser download of the user's anime data as a JSON file.
 * @param {Array} animeData - The user's animeData array.
 */
export function downloadEnrichedJSON(animeData) {
  const errorMessage = document.getElementById('error-message');
  if (!animeData || animeData.length === 0) {
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