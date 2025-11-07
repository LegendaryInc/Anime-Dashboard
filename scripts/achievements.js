// =====================================================================
// --- ACHIEVEMENTS MODULE (achievements.js) ---
// =====================================================================
// Handles achievement tracking, unlocking, and display
// =====================================================================

let achievementsData = null;
let unlockedAchievements = new Set();

/**
 * Load achievements definitions
 */
async function loadAchievements() {
  try {
    const response = await fetch('/data/achievements.json');
    achievementsData = await response.json();
    return achievementsData;
  } catch (error) {
    console.error('Failed to load achievements:', error);
    return null;
  }
}

/**
 * Load unlocked achievements from localStorage
 */
export function loadUnlockedAchievements() {
  try {
    const stored = localStorage.getItem('unlocked_achievements');
    if (stored) {
      unlockedAchievements = new Set(JSON.parse(stored));
    }
    return unlockedAchievements;
  } catch (error) {
    console.error('Failed to load unlocked achievements:', error);
    return new Set();
  }
}

/**
 * Save unlocked achievements to localStorage
 */
function saveUnlockedAchievements() {
  try {
    localStorage.setItem('unlocked_achievements', JSON.stringify(Array.from(unlockedAchievements)));
  } catch (error) {
    console.error('Failed to save unlocked achievements:', error);
  }
}

/**
 * Check if an achievement is unlocked
 */
export function isAchievementUnlocked(achievementId) {
  return unlockedAchievements.has(achievementId);
}

/**
 * Unlock an achievement
 */
function unlockAchievement(achievementId) {
  if (!unlockedAchievements.has(achievementId)) {
    unlockedAchievements.add(achievementId);
    saveUnlockedAchievements();
    return true; // Newly unlocked
  }
  return false; // Already unlocked
}

/**
 * Calculate statistics from anime data for achievement checking
 */
function calculateStats(animeData) {
  if (!Array.isArray(animeData)) return null;

  const watchedAnime = animeData.filter(a => a.status && 
    (a.status.toLowerCase() === 'completed' || a.status.toLowerCase() === 'current'));
  const completedAnime = animeData.filter(a => a.status && 
    a.status.toLowerCase() === 'completed');
  const scoredAnime = completedAnime.filter(a => a.score > 0);

  const totalAnime = watchedAnime.length;
  const totalCompleted = completedAnime.length;
  const totalEpisodes = watchedAnime.reduce((sum, a) => sum + (Number(a.episodesWatched) || 0), 0);
  
  const meanScore = scoredAnime.length > 0
    ? scoredAnime.reduce((sum, a) => sum + a.score, 0) / scoredAnime.length
    : 0;

  // Genre counts
  const genreCounts = {};
  completedAnime.forEach(a => {
    if (a.genres && Array.isArray(a.genres)) {
      a.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    }
  });

  // Studio counts
  const studioCounts = {};
  completedAnime.forEach(a => {
    if (a.studios && Array.isArray(a.studios)) {
      a.studios.forEach(studio => {
        studioCounts[studio] = (studioCounts[studio] || 0) + 1;
      });
    } else if (a.studio) {
      studioCounts[a.studio] = (studioCounts[a.studio] || 0) + 1;
    }
  });

  // Format counts
  const formatCounts = {};
  completedAnime.forEach(a => {
    if (a.format) {
      formatCounts[a.format] = (formatCounts[a.format] || 0) + 1;
    }
  });

  // Perfect scores (10/10)
  const perfectScores = scoredAnime.filter(a => a.score === 10).length;

  // Unique genres
  const uniqueGenres = new Set();
  completedAnime.forEach(a => {
    if (a.genres && Array.isArray(a.genres)) {
      a.genres.forEach(genre => uniqueGenres.add(genre));
    }
  });

  // Long anime (100+ episodes)
  const longAnime = completedAnime.filter(a => {
    const episodes = Number(a.totalEpisodes) || 0;
    return episodes >= 100;
  }).length;

  // Current anime
  const currentAnime = animeData.filter(a => a.status && 
    a.status.toLowerCase() === 'current').length;

  return {
    totalAnime,
    totalCompleted,
    totalEpisodes,
    meanScore,
    genreCounts,
    studioCounts,
    formatCounts,
    perfectScores,
    uniqueGenres: uniqueGenres.size,
    longAnime,
    currentAnime
  };
}

/**
 * Check if an achievement condition is met
 */
function checkCondition(condition, stats) {
  if (!stats) return false;

  switch (condition.type) {
    case 'total_anime':
      return stats.totalAnime >= condition.value;
    
    case 'total_completed':
      return stats.totalCompleted >= condition.value;
    
    case 'total_episodes':
      return stats.totalEpisodes >= condition.value;
    
    case 'genre_completed':
      return Object.values(stats.genreCounts).some(count => count >= condition.value);
    
    case 'studio_completed':
      return Object.values(stats.studioCounts).some(count => count >= condition.value);
    
    case 'perfect_scores':
      return stats.perfectScores >= condition.value;
    
    case 'average_score':
      if (condition.min_anime && stats.totalCompleted < condition.min_anime) {
        return false;
      }
      return stats.meanScore >= condition.value;
    
    case 'unique_genres':
      return stats.uniqueGenres >= condition.value;
    
    case 'long_anime':
      return stats.longAnime >= condition.value;
    
    case 'format_completed':
      return (stats.formatCounts[condition.format] || 0) >= condition.value;
    
    case 'current_anime':
      return stats.currentAnime >= condition.value;
    
    default:
      return false;
  }
}

/**
 * Check all achievements and unlock new ones
 */
export async function checkAchievements(animeData) {
  if (!achievementsData) {
    await loadAchievements();
  }
  
  if (!achievementsData || !animeData) return [];

  const stats = calculateStats(animeData);
  if (!stats) return [];

  const newlyUnlocked = [];

  achievementsData.achievements.forEach(achievement => {
    // Skip if already unlocked
    if (unlockedAchievements.has(achievement.id)) return;

    // Check condition
    if (checkCondition(achievement.condition, stats)) {
      if (unlockAchievement(achievement.id)) {
        newlyUnlocked.push(achievement);
      }
    }
  });

  return newlyUnlocked;
}

/**
 * Get all achievements with unlock status
 */
export function getAllAchievements() {
  if (!achievementsData) return [];
  
  return achievementsData.achievements.map(achievement => ({
    ...achievement,
    unlocked: unlockedAchievements.has(achievement.id)
  }));
}

/**
 * Get unlocked achievements
 */
export function getUnlockedAchievements() {
  if (!achievementsData) return [];
  
  return achievementsData.achievements
    .filter(a => unlockedAchievements.has(a.id))
    .map(achievement => ({
      ...achievement,
      unlocked: true
    }));
}

/**
 * Get achievement progress (for locked achievements)
 */
export function getAchievementProgress(achievement, animeData) {
  const stats = calculateStats(animeData);
  if (!stats) return { current: 0, target: 0, percentage: 0 };

  const condition = achievement.condition;
  let current = 0;

  switch (condition.type) {
    case 'total_anime':
      current = stats.totalAnime;
      break;
    case 'total_completed':
      current = stats.totalCompleted;
      break;
    case 'total_episodes':
      current = stats.totalEpisodes;
      break;
    case 'genre_completed':
      current = Math.max(...Object.values(stats.genreCounts), 0);
      break;
    case 'studio_completed':
      current = Math.max(...Object.values(stats.studioCounts), 0);
      break;
    case 'perfect_scores':
      current = stats.perfectScores;
      break;
    case 'average_score':
      current = stats.meanScore;
      break;
    case 'unique_genres':
      current = stats.uniqueGenres;
      break;
    case 'long_anime':
      current = stats.longAnime;
      break;
    case 'format_completed':
      current = stats.formatCounts[condition.format] || 0;
      break;
    case 'current_anime':
      current = stats.currentAnime;
      break;
    default:
      current = 0;
  }

  const target = condition.value;
  const percentage = Math.min(100, Math.round((current / target) * 100));

  return { current, target, percentage };
}

/**
 * Initialize achievements system
 */
export async function initAchievements() {
  await loadAchievements();
  loadUnlockedAchievements();
}

/**
 * Show achievement unlock notification
 */
export function showAchievementNotification(achievement) {
  // This will be called from the UI module
  if (typeof window.showAchievementToast === 'function') {
    window.showAchievementToast(achievement);
  }
}

