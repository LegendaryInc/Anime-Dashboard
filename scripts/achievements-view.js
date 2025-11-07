// =====================================================================
// --- ACHIEVEMENTS VIEW MODULE (achievements-view.js) ---
// =====================================================================
// Handles rendering the achievements UI
// =====================================================================

import {
  getAllAchievements,
  getUnlockedAchievements,
  getAchievementProgress,
  checkAchievements
} from './achievements.js';

let currentFilter = 'all';

/**
 * Initialize the achievements view
 */
export function initAchievementsView() {
  const achievementsTab = document.getElementById('achievements-tab');
  if (!achievementsTab) return;

  // Filter buttons
  const filterButtons = document.querySelectorAll('[data-achievement-filter]');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.achievementFilter;
      switchFilter(filter);
    });
  });
}

/**
 * Switch achievement filter
 */
function switchFilter(filter) {
  currentFilter = filter;
  
  // Update active button
  document.querySelectorAll('[data-achievement-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.achievementFilter === filter);
  });
  
  // Re-render
  renderAchievements();
}

/**
 * Render all achievements
 */
export function renderAchievements() {
  const container = document.getElementById('achievements-container');
  const progressEl = document.getElementById('achievements-progress');
  
  
  if (!container) {
    console.warn('Achievements container not found!');
    return;
  }
  
  if (!window.animeData) {
    console.warn('animeData not available!');
    return;
  }

  const allAchievements = getAllAchievements();
  const unlocked = getUnlockedAchievements();
  
  // Update progress
  if (progressEl) {
    progressEl.textContent = `${unlocked.length}/${allAchievements.length}`;
  }

  // Filter achievements
  let filtered = allAchievements;
  if (currentFilter === 'unlocked') {
    filtered = allAchievements.filter(a => a.unlocked);
  } else if (currentFilter !== 'all') {
    filtered = allAchievements.filter(a => a.category === currentFilter);
  }

  // Sort: unlocked first, then by rarity
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  filtered.sort((a, b) => {
    if (a.unlocked !== b.unlocked) {
      return a.unlocked ? -1 : 1;
    }
    return (rarityOrder[a.rarity] || 4) - (rarityOrder[b.rarity] || 4);
  });

  // Render
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-center py-8 theme-text-secondary col-span-full">No achievements found.</p>';
    return;
  }

  let html = '';
  filtered.forEach(achievement => {
    const progress = getAchievementProgress(achievement, window.animeData);
    const unlocked = achievement.unlocked;
    const rarityClass = `achievement-${achievement.rarity || 'common'}`;
    const opacityClass = unlocked ? '' : 'opacity-60';
    
    html += `
      <div class="achievement-card anime-card rounded-lg p-4 ${opacityClass} ${unlocked ? 'achievement-unlocked' : ''}" data-achievement-id="${achievement.id}">
        <div class="flex items-start gap-4">
          <div class="achievement-icon ${rarityClass} text-4xl flex-shrink-0">
            ${achievement.icon || '🏆'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-lg theme-text-primary mb-1">
              ${achievement.name}
              ${unlocked ? '<span class="text-green-500 ml-2">✓</span>' : ''}
            </div>
            <div class="text-sm theme-text-secondary mb-2">
              ${achievement.description}
            </div>
            ${!unlocked ? `
              <div class="achievement-progress mt-2">
                <div class="flex justify-between text-xs theme-text-muted mb-1">
                  <span>Progress</span>
                  <span>${progress.current}/${progress.target}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: ${progress.percentage}%"></div>
                </div>
              </div>
            ` : ''}
            <div class="mt-2">
              <span class="achievement-rarity-badge ${rarityClass} text-xs px-2 py-1 rounded">
                ${achievement.rarity || 'common'}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Check and unlock new achievements (called when data updates)
 */
export async function checkAndUnlockAchievements() {
  if (!window.animeData) return;

  const newlyUnlocked = await checkAchievements(window.animeData);
  
  if (newlyUnlocked.length > 0) {
    // Show notifications
    newlyUnlocked.forEach(achievement => {
      if (typeof window.showAchievementToast === 'function') {
        window.showAchievementToast(achievement);
      }
    });
    
    // Re-render if achievements tab is visible
    const achievementsTab = document.getElementById('achievements-tab');
    if (achievementsTab && !achievementsTab.classList.contains('hidden')) {
      renderAchievements();
    }
  }
}

/**
 * Refresh achievements view (called when tab is switched to)
 */
export function refreshAchievementsView() {
  // Make available globally for tab switching
  window.refreshAchievementsView = refreshAchievementsView;
  renderAchievements();
}

