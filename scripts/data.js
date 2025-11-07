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

// Cache for statistics to avoid recalculating when data hasn't changed
let statsCache = {
  dataHash: null,
  stats: null
};

/**
 * Generate a simple hash of the data array for cache comparison
 */
function hashData(data) {
  if (!Array.isArray(data) || data.length === 0) return 'empty';
  // Use length and first/last IDs as a quick hash
  return `${data.length}-${data[0]?.id || 0}-${data[data.length - 1]?.id || 0}`;
}

/**
 * Calculates all dashboard statistics from the raw anime data.
 * Uses caching to avoid unnecessary recalculations.
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

  // Check cache first
  const dataHash = hashData(data);
  if (statsCache.dataHash === dataHash && statsCache.stats) {
    return statsCache.stats;
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

  // ⭐ ADVANCED: Watch time breakdown by genre
  const watchTimeByGenre = {};
  watchedAnime.forEach(anime => {
    const minutes = parseDurationToMinutes(anime.duration, Number(anime.episodesWatched) || 0);
    if (anime.genres && Array.isArray(anime.genres)) {
      anime.genres.forEach(genre => {
        watchTimeByGenre[genre] = (watchTimeByGenre[genre] || 0) + minutes;
      });
    }
  });

  // ⭐ ADVANCED: Watch time breakdown by year
  const watchTimeByYear = {};
  watchedAnime.forEach(anime => {
    const minutes = parseDurationToMinutes(anime.duration, Number(anime.episodesWatched) || 0);
    // Try to get year from completedAt or startedAt
    let year = null;
    if (anime.completedAt && anime.completedAt.year) {
      year = anime.completedAt.year;
    } else if (anime.startedAt && anime.startedAt.year) {
      year = anime.startedAt.year;
    } else if (anime.year) {
      year = anime.year;
    }
    if (year) {
      watchTimeByYear[year] = (watchTimeByYear[year] || 0) + minutes;
    }
  });

  // ⭐ ADVANCED: Average episode length
  const episodeLengths = watchedAnime
    .map(anime => {
      const duration = anime.duration;
      if (duration && typeof duration === 'string') {
        const match = duration.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      }
      return null;
    })
    .filter(length => length !== null);
  const averageEpisodeLength = episodeLengths.length > 0
    ? (episodeLengths.reduce((sum, len) => sum + len, 0) / episodeLengths.length).toFixed(1)
    : '24'; // Default to 24 minutes if no data

  // ⭐ ADVANCED: Most watched studios (by watch time, not just count)
  const studioWatchTime = {};
  watchedAnime.forEach(anime => {
    const minutes = parseDurationToMinutes(anime.duration, Number(anime.episodesWatched) || 0);
    if (anime.studios && Array.isArray(anime.studios)) {
      anime.studios.forEach(studio => {
        studioWatchTime[studio] = (studioWatchTime[studio] || 0) + minutes;
      });
    }
  });
  const topStudioByWatchTime = Object.entries(studioWatchTime)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

  // ⭐ ADVANCED: Anime watched the longest (time between start and complete)
  const longestWatchedAnime = data
    .filter(anime => anime.startedAt && anime.completedAt && 
                     anime.startedAt.year && anime.completedAt.year)
    .map(anime => {
      const startDate = new Date(
        anime.startedAt.year,
        (anime.startedAt.month || 1) - 1,
        anime.startedAt.day || 1
      );
      const endDate = new Date(
        anime.completedAt.year,
        (anime.completedAt.month || 1) - 1,
        anime.completedAt.day || 1
      );
      const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
      return {
        ...anime,
        daysToComplete: daysDiff,
        title: anime.title || anime._romaji || anime._english || 'Unknown'
      };
    })
    .sort((a, b) => b.daysToComplete - a.daysToComplete)
    .slice(0, 10); // Top 10 longest

  // ⭐ ADVANCED: Genre evolution over time (anime completed per year by genre)
  const genreEvolutionByYear = {};
  const completedAnimeWithDates = data.filter(a => 
    a.status && a.status.toLowerCase() === 'completed' &&
    a.completedAt && a.completedAt.year
  );
  
  completedAnimeWithDates.forEach(anime => {
    const year = anime.completedAt.year;
    if (!genreEvolutionByYear[year]) {
      genreEvolutionByYear[year] = {};
    }
    if (anime.genres && Array.isArray(anime.genres)) {
      anime.genres.forEach(genre => {
        genreEvolutionByYear[year][genre] = (genreEvolutionByYear[year][genre] || 0) + 1;
      });
    }
  });

  // ⭐ NEW: Score trends over time (average score by year)
  const scoreTrendsByYear = {};
  const scoredCompletedAnime = completedAnimeWithDates.filter(a => a.score > 0);
  
  scoredCompletedAnime.forEach(anime => {
    const year = anime.completedAt.year;
    if (!scoreTrendsByYear[year]) {
      scoreTrendsByYear[year] = { total: 0, count: 0 };
    }
    scoreTrendsByYear[year].total += anime.score;
    scoreTrendsByYear[year].count += 1;
  });
  
  const averageScoreByYear = {};
  Object.keys(scoreTrendsByYear).forEach(year => {
    const data = scoreTrendsByYear[year];
    if (data.count > 0) {
      averageScoreByYear[year] = (data.total / data.count).toFixed(2);
    }
  });

  // ⭐ NEW: Completion rate by genre
  const completionRateByGenre = {};
  const genreStarted = {};
  const genreCompleted = {};
  
  data.forEach(anime => {
    const status = (anime.status || '').toLowerCase();
    const isStarted = ['completed', 'current', 'dropped', 'paused'].includes(status);
    const isCompleted = status === 'completed';
    
    if (anime.genres && Array.isArray(anime.genres)) {
      anime.genres.forEach(genre => {
        if (isStarted) {
          genreStarted[genre] = (genreStarted[genre] || 0) + 1;
        }
        if (isCompleted) {
          genreCompleted[genre] = (genreCompleted[genre] || 0) + 1;
        }
      });
    }
  });
  
  Object.keys(genreStarted).forEach(genre => {
    const started = genreStarted[genre];
    const completed = genreCompleted[genre] || 0;
    if (started > 0) {
      completionRateByGenre[genre] = ((completed / started) * 100).toFixed(1);
    }
  });

  // ⭐ NEW: Anime completed per year
  const completedPerYear = {};
  completedAnimeWithDates.forEach(anime => {
    const year = anime.completedAt.year;
    completedPerYear[year] = (completedPerYear[year] || 0) + 1;
  });

  const stats = {
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
    averageEpisodesPerAnime,
    // Advanced statistics
    watchTimeByGenre,
    watchTimeByYear,
    averageEpisodeLength,
    topStudioByWatchTime,
    longestWatchedAnime,
    genreEvolutionByYear,
    // New statistics
    averageScoreByYear,
    completionRateByGenre,
    completedPerYear
  };

  // Cache the result
  statsCache.dataHash = dataHash;
  statsCache.stats = stats;
  
  return stats;
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