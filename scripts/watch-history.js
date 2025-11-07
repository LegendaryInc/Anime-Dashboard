// =====================================================================
// --- WATCH HISTORY MODULE (watch-history.js) ---
// =====================================================================
// Handles watch history tracking, streak calculation, timeline generation,
// and monthly/yearly summaries.
// =====================================================================

/**
 * Convert AniList date format {year, month, day} to JavaScript Date
 * @param {Object|null} dateObj - Date object from AniList
 * @returns {Date|null} JavaScript Date object or null
 */
function parseAniListDate(dateObj) {
  if (!dateObj || !dateObj.year) return null;
  const year = dateObj.year;
  const month = (dateObj.month || 1) - 1; // JS months are 0-indexed
  const day = dateObj.day || 1;
  return new Date(year, month, day);
}

/**
 * Get all anime with watch dates
 * @param {Array} animeData - Full anime data array
 * @returns {Array} Array of anime with at least one date
 */
export function getAnimeWithDates(animeData) {
  if (!Array.isArray(animeData)) return [];
  
  return animeData.filter(anime => {
    const hasStarted = anime.startedAt && anime.startedAt.year;
    const hasCompleted = anime.completedAt && anime.completedAt.year;
    return hasStarted || hasCompleted;
  });
}

/**
 * Calculate watching streak (consecutive days with completed anime)
 * @param {Array} animeData - Full anime data array
 * @returns {Object} Streak information {current, longest, lastDate}
 */
export function calculateStreak(animeData) {
  const animeWithDates = getAnimeWithDates(animeData);
  
  // Get all completion dates
  const completionDates = animeWithDates
    .filter(anime => anime.completedAt && anime.completedAt.year)
    .map(anime => parseAniListDate(anime.completedAt))
    .filter(date => date !== null)
    .map(date => {
      // Normalize to midnight for date comparison
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized.getTime();
    })
    .filter((date, index, self) => self.indexOf(date) === index) // Remove duplicates
    .sort((a, b) => b - a); // Sort descending (most recent first)
  
  if (completionDates.length === 0) {
    return { current: 0, longest: 0, lastDate: null };
  }
  
  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  
  // Check if there's activity today or yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayTime = yesterday.getTime();
  
  let checkDate = todayTime;
  let lastActivityDate = completionDates[0];
  
  // If most recent activity is today or yesterday, start counting
  if (lastActivityDate === todayTime || lastActivityDate === yesterdayTime) {
    currentStreak = 1;
    checkDate = lastActivityDate;
    
    // Count backwards for consecutive days
    for (let i = 1; i < completionDates.length; i++) {
      const expectedDate = new Date(checkDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
      const expectedTime = expectedDate.getTime();
      
      if (completionDates[i] === expectedTime) {
        currentStreak++;
        checkDate = expectedTime;
      } else {
        break;
      }
    }
  }
  
  // Calculate longest streak
  let longestStreak = 1;
  let tempStreak = 1;
  
  for (let i = 0; i < completionDates.length - 1; i++) {
    const currentDate = new Date(completionDates[i]);
    const nextDate = new Date(completionDates[i + 1]);
    const daysDiff = Math.floor((currentDate - nextDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  
  return {
    current: currentStreak,
    longest: longestStreak,
    lastDate: completionDates.length > 0 ? new Date(completionDates[0]) : null
  };
}

/**
 * Generate timeline data from watch history
 * @param {Array} animeData - Full anime data array
 * @returns {Array} Timeline entries sorted by date
 */
export function generateTimeline(animeData) {
  const animeWithDates = getAnimeWithDates(animeData);
  const timeline = [];
  
  animeWithDates.forEach(anime => {
    if (anime.startedAt && anime.startedAt.year) {
      const startDate = parseAniListDate(anime.startedAt);
      if (startDate) {
        timeline.push({
          date: startDate,
          type: 'started',
          anime: {
            id: anime.id,
            title: anime.title || anime._romaji || anime._english || 'Unknown',
            coverImage: anime.coverImage,
            status: anime.status
          }
        });
      }
    }
    
    if (anime.completedAt && anime.completedAt.year) {
      const completeDate = parseAniListDate(anime.completedAt);
      if (completeDate) {
        timeline.push({
          date: completeDate,
          type: 'completed',
          anime: {
            id: anime.id,
            title: anime.title || anime._romaji || anime._english || 'Unknown',
            coverImage: anime.coverImage,
            status: anime.status,
            score: anime.score
          }
        });
      }
    }
  });
  
  // Sort by date (most recent first)
  timeline.sort((a, b) => b.date - a.date);
  
  return timeline;
}

/**
 * Generate monthly watch summary
 * @param {Array} animeData - Full anime data array
 * @param {number} year - Year to summarize
 * @param {number} month - Month to summarize (1-12)
 * @returns {Object} Monthly summary
 */
export function generateMonthlySummary(animeData, year, month) {
  const animeWithDates = getAnimeWithDates(animeData);
  
  const started = [];
  const completed = [];
  
  animeWithDates.forEach(anime => {
    if (anime.startedAt && anime.startedAt.year === year && anime.startedAt.month === month) {
      started.push(anime);
    }
    if (anime.completedAt && anime.completedAt.year === year && anime.completedAt.month === month) {
      completed.push(anime);
    }
  });
  
  const totalEpisodes = completed.reduce((sum, a) => sum + (Number(a.episodesWatched) || 0), 0);
  const totalMinutes = completed.reduce((sum, anime) => {
    return sum + (parseInt(anime.duration?.match(/(\d+)/)?.[1] || '24', 10) * (Number(anime.episodesWatched) || 0));
  }, 0);
  
  return {
    year,
    month,
    started: started.length,
    completed: completed.length,
    totalEpisodes,
    totalMinutes,
    totalHours: Math.floor(totalMinutes / 60),
    animeStarted: started,
    animeCompleted: completed
  };
}

/**
 * Generate yearly watch summary
 * @param {Array} animeData - Full anime data array
 * @param {number} year - Year to summarize
 * @returns {Object} Yearly summary
 */
export function generateYearlySummary(animeData, year) {
  const animeWithDates = getAnimeWithDates(animeData);
  
  const started = [];
  const completed = [];
  
  animeWithDates.forEach(anime => {
    if (anime.startedAt && anime.startedAt.year === year) {
      started.push(anime);
    }
    if (anime.completedAt && anime.completedAt.year === year) {
      completed.push(anime);
    }
  });
  
  // Calculate monthly breakdown
  const monthlyBreakdown = {};
  for (let month = 1; month <= 12; month++) {
    monthlyBreakdown[month] = generateMonthlySummary(animeData, year, month);
  }
  
  const totalEpisodes = completed.reduce((sum, a) => sum + (Number(a.episodesWatched) || 0), 0);
  const totalMinutes = completed.reduce((sum, anime) => {
    return sum + (parseInt(anime.duration?.match(/(\d+)/)?.[1] || '24', 10) * (Number(anime.episodesWatched) || 0));
  }, 0);
  
  return {
    year,
    started: started.length,
    completed: completed.length,
    totalEpisodes,
    totalMinutes,
    totalHours: Math.floor(totalMinutes / 60),
    totalDays: Math.floor(totalMinutes / (60 * 24)),
    animeStarted: started,
    animeCompleted: completed,
    monthlyBreakdown
  };
}

/**
 * Get all years with watch activity
 * @param {Array} animeData - Full anime data array
 * @returns {Array} Array of years (sorted descending)
 */
export function getActiveYears(animeData) {
  const animeWithDates = getAnimeWithDates(animeData);
  const years = new Set();
  
  animeWithDates.forEach(anime => {
    if (anime.startedAt && anime.startedAt.year) {
      years.add(anime.startedAt.year);
    }
    if (anime.completedAt && anime.completedAt.year) {
      years.add(anime.completedAt.year);
    }
  });
  
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Export watch history as JSON
 * @param {Array} animeData - Full anime data array
 * @returns {string} JSON string
 */
export function exportWatchHistoryJSON(animeData) {
  const animeWithDates = getAnimeWithDates(animeData);
  const exportData = animeWithDates.map(anime => ({
    id: anime.id,
    title: anime.title || anime._romaji || anime._english || 'Unknown',
    status: anime.status,
    score: anime.score,
    episodesWatched: anime.episodesWatched,
    startedAt: anime.startedAt,
    completedAt: anime.completedAt,
    genres: anime.genres || []
  }));
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Export watch history as CSV
 * @param {Array} animeData - Full anime data array
 * @returns {string} CSV string
 */
export function exportWatchHistoryCSV(animeData) {
  const animeWithDates = getAnimeWithDates(animeData);
  
  // CSV header
  const headers = ['Title', 'Status', 'Score', 'Episodes Watched', 'Started Date', 'Completed Date', 'Genres'];
  const rows = [headers.join(',')];
  
  // CSV rows
  animeWithDates.forEach(anime => {
    const formatDate = (date) => {
      if (!date || !date.year) return '';
      const month = String(date.month || 1).padStart(2, '0');
      const day = String(date.day || 1).padStart(2, '0');
      return `${date.year}-${month}-${day}`;
    };
    
    const title = (anime.title || anime._romaji || anime._english || 'Unknown').replace(/"/g, '""');
    const status = anime.status || '';
    const score = anime.score || '';
    const episodes = anime.episodesWatched || 0;
    const started = formatDate(anime.startedAt);
    const completed = formatDate(anime.completedAt);
    const genres = (anime.genres || []).join('; ');
    
    rows.push(`"${title}",${status},${score},${episodes},"${started}","${completed}","${genres}"`);
  });
  
  return rows.join('\n');
}

/**
 * Download watch history export
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
export function downloadExport(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

