// =====================================================================
// Context Menu (Quick Actions Menu)
// =====================================================================
// Right-click context menu for quick actions on anime cards/rows
// =====================================================================

import { openAnimeDetailsModal } from './anime-modal.js';
import { showToast } from './toast.js';

// Context menu state
let contextMenuElement = null;
let currentAnime = null;

/**
 * Initialize context menu system
 */
export function initContextMenu() {
  // Create context menu element
  contextMenuElement = document.createElement('div');
  contextMenuElement.id = 'anime-context-menu';
  contextMenuElement.className = 'anime-context-menu hidden';
  document.body.appendChild(contextMenuElement);

  // Close menu on click outside
  document.addEventListener('click', (e) => {
    if (!contextMenuElement.contains(e.target)) {
      hideContextMenu();
    }
  });

  // Close menu on scroll
  document.addEventListener('scroll', hideContextMenu, true);

  // Handle keyboard shortcuts when context menu is open
  document.addEventListener('keydown', (e) => {
    if (contextMenuElement.classList.contains('hidden')) return;
    
    // Escape: close menu
    if (e.key === 'Escape') {
      e.preventDefault();
      hideContextMenu();
      return;
    }
    
    // Enter: trigger first action (View Details)
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentAnime) {
        handleMenuAction('view-details', currentAnime);
        hideContextMenu();
      }
      return;
    }
    
    // Arrow keys: navigate menu items (optional enhancement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateMenuItems(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
  });

  // Right-click handlers for table rows
  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.table-row');
    if (row) {
      e.preventDefault();
      const animeId = parseInt(row.dataset.animeId);
      if (animeId) {
        const anime = window.animeData?.find(a => a.id === animeId);
        if (anime) {
          showContextMenu(e, anime, 'table');
        }
      }
      return;
    }

    // Right-click handlers for grid cards
    const card = e.target.closest('.grid-card');
    if (card) {
      e.preventDefault();
      const animeId = parseInt(card.dataset.animeId);
      if (animeId) {
        const anime = window.animeData?.find(a => a.id === animeId);
        if (anime) {
          showContextMenu(e, anime, 'grid');
        }
      }
      return;
    }

    // Right-click handlers for watching tab cards
    const watchCard = e.target.closest('.watch-card');
    if (watchCard) {
      e.preventDefault();
      const animeId = parseInt(watchCard.dataset.animeId);
      if (animeId) {
        const anime = window.animeData?.find(a => a.idMal === animeId || a.malId === animeId);
        if (anime) {
          showContextMenu(e, anime, 'watching');
        }
      }
      return;
    }
  });
}

/**
 * Show context menu at mouse position
 */
function showContextMenu(event, anime, source) {
  if (!contextMenuElement || !anime) return;

  currentAnime = anime;

  // Build menu items
  const menuItems = buildMenuItems(anime, source);

  // Render menu
  contextMenuElement.innerHTML = menuItems;
  contextMenuElement.classList.remove('hidden');

  // Position menu
  positionContextMenu(event);

  // Attach event listeners
  attachMenuListeners(anime);
}

/**
 * Build menu items based on context
 */
function buildMenuItems(anime, source) {
  const items = [];

  // View Details (always available)
  items.push(`
    <button class="context-menu-item" data-action="view-details">
      <span class="context-menu-icon">👁️</span>
      <span class="context-menu-label">View Details</span>
      <span class="context-menu-shortcut">Enter</span>
    </button>
  `);

  // Divider
  items.push('<div class="context-menu-divider"></div>');

  // Update Status
  items.push(`
    <button class="context-menu-item" data-action="update-status">
      <span class="context-menu-icon">📝</span>
      <span class="context-menu-label">Update Status</span>
    </button>
  `);

  // Update Score
  items.push(`
    <button class="context-menu-item" data-action="update-score">
      <span class="context-menu-icon">⭐</span>
      <span class="context-menu-label">Update Score</span>
    </button>
  `);

  // Add Episode (if applicable)
  const watched = anime.episodesWatched ?? anime.progress ?? 0;
  const total = anime.totalEpisodes || 0;
  const canAddEpisode = !total || watched < total;
  
  if (canAddEpisode) {
    items.push(`
      <button class="context-menu-item" data-action="add-episode">
        <span class="context-menu-icon">➕</span>
        <span class="context-menu-label">Add Episode</span>
        <span class="context-menu-shortcut">+</span>
      </button>
    `);
  }

  // Divider
  items.push('<div class="context-menu-divider"></div>');

  // Add to List
  items.push(`
    <button class="context-menu-item" data-action="add-to-list">
      <span class="context-menu-icon">📋</span>
      <span class="context-menu-label">Add to List</span>
    </button>
  `);

  // Divider
  items.push('<div class="context-menu-divider"></div>');

  // Open on AniList (if available)
  if (anime.id) {
    items.push(`
      <button class="context-menu-item" data-action="open-anilist">
        <span class="context-menu-icon">🔗</span>
        <span class="context-menu-label">Open on AniList</span>
      </button>
    `);
  }

  return items.join('');
}

/**
 * Position context menu intelligently to avoid viewport edges
 */
function positionContextMenu(event) {
  if (!contextMenuElement) return;

  // Make menu visible temporarily to measure it
  contextMenuElement.classList.remove('hidden');
  const menuRect = contextMenuElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 8; // Padding from viewport edges
  
  let x = event.clientX;
  let y = event.clientY;

  // Adjust horizontal position if menu would overflow right
  if (x + menuRect.width > viewportWidth - padding) {
    x = viewportWidth - menuRect.width - padding;
  }
  // Adjust if would overflow left
  if (x < padding) {
    x = padding;
  }

  // Adjust vertical position if menu would overflow bottom
  if (y + menuRect.height > viewportHeight - padding) {
    y = viewportHeight - menuRect.height - padding;
  }
  // Adjust if would overflow top
  if (y < padding) {
    y = padding;
  }

  contextMenuElement.style.left = `${x}px`;
  contextMenuElement.style.top = `${y}px`;
}

/**
 * Attach event listeners to menu items
 */
function attachMenuListeners(anime) {
  if (!contextMenuElement) return;

  const items = contextMenuElement.querySelectorAll('.context-menu-item');
  
  items.forEach((item, index) => {
    // Set first item as focused and make it focusable
    if (index === 0) {
      item.setAttribute('tabindex', '0');
      item.classList.add('context-menu-item-focused');
      // Focus after a short delay to ensure menu is visible
      setTimeout(() => item.focus(), 0);
    } else {
      item.setAttribute('tabindex', '-1');
    }
    
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      await handleMenuAction(action, anime);
      hideContextMenu();
    });
    
    // Keyboard navigation
    item.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const action = item.dataset.action;
        await handleMenuAction(action, anime);
        hideContextMenu();
      }
    });
  });
}

/**
 * Navigate menu items with arrow keys
 */
function navigateMenuItems(direction) {
  if (!contextMenuElement) return;
  
  const items = Array.from(contextMenuElement.querySelectorAll('.context-menu-item'));
  if (items.length === 0) return;
  
  const currentFocused = contextMenuElement.querySelector('.context-menu-item-focused');
  let currentIndex = currentFocused ? items.indexOf(currentFocused) : 0;
  
  // Remove focus from current item
  if (currentFocused) {
    currentFocused.classList.remove('context-menu-item-focused');
    currentFocused.setAttribute('tabindex', '-1');
  }
  
  // Calculate new index
  currentIndex += direction;
  if (currentIndex < 0) currentIndex = items.length - 1;
  if (currentIndex >= items.length) currentIndex = 0;
  
  // Focus new item
  const newItem = items[currentIndex];
  if (newItem) {
    newItem.setAttribute('tabindex', '0');
    newItem.classList.add('context-menu-item-focused');
    newItem.focus();
  }
}

/**
 * Handle menu action
 */
async function handleMenuAction(action, anime) {
  if (!anime) return;

  switch (action) {
    case 'view-details':
      console.log('Context menu: Opening details for', anime.title);
      await openAnimeDetailsModal(anime);
      break;

    case 'update-status':
      await showStatusUpdateModal(anime);
      break;

    case 'update-score':
      await showScoreUpdateModal(anime);
      break;

    case 'add-episode':
      await incrementEpisode(anime);
      break;

    case 'add-to-list':
      await showAddToListMenu(anime);
      break;

    case 'open-anilist':
      if (anime.id) {
        window.open(`https://anilist.co/anime/${anime.id}`, '_blank');
      }
      break;

    default:
      console.warn('Unknown context menu action:', action);
  }
}

/**
 * Show status update modal
 */
async function showStatusUpdateModal(anime) {
  const { updateAnimeStatus } = await import('./ui.js');
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Update Status</h3>
      <form id="context-status-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Status *</label>
          <select id="context-status-select" required class="w-full px-3 py-2 border border-gray-300 rounded-lg" style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);">
            <option value="Watching" ${anime.status === 'Watching' ? 'selected' : ''}>Watching</option>
            <option value="Completed" ${anime.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Planning" ${anime.status === 'Planning' ? 'selected' : ''}>Planning</option>
            <option value="Paused" ${anime.status === 'Paused' ? 'selected' : ''}>Paused</option>
            <option value="Dropped" ${anime.status === 'Dropped' ? 'selected' : ''}>Dropped</option>
            <option value="Repeating" ${anime.status === 'Repeating' ? 'selected' : ''}>Repeating</option>
          </select>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-context-status" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Update
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#context-status-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = modal.querySelector('#context-status-select').value;
    await updateAnimeStatus(anime.id, status, window.animeData || []);
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
    if (typeof window.triggerFilterUpdate === 'function') {
      window.triggerFilterUpdate();
    }
  });

  modal.querySelector('#cancel-context-status').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Show score update modal
 */
async function showScoreUpdateModal(anime) {
  const { updateAnimeScore } = await import('./ui.js');
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Update Score</h3>
      <form id="context-score-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Score *</label>
          <input type="number" id="context-score-input" min="0" max="10" step="0.1" required 
                 value="${anime.score || 0}"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 placeholder="0.0 - 10.0">
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-context-score" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Update
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#context-score-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const score = parseFloat(modal.querySelector('#context-score-input').value);
    if (isNaN(score) || score < 0 || score > 10) {
      showToast('Score must be between 0 and 10', 'error');
      return;
    }
    await updateAnimeScore(anime.id, score, window.animeData || []);
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
    if (typeof window.triggerFilterUpdate === 'function') {
      window.triggerFilterUpdate();
    }
  });

  modal.querySelector('#cancel-context-score').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Increment episode count
 */
async function incrementEpisode(anime) {
  const { incrementEpisode: incrementEp } = await import('./ui.js');
  await incrementEp(anime.title, window.animeData || []);
  if (typeof window.triggerFilterUpdate === 'function') {
    window.triggerFilterUpdate();
  }
}

/**
 * Show add to list menu
 */
async function showAddToListMenu(anime) {
  try {
    const { showAddToListModal } = await import('./custom-lists-view.js');
    if (showAddToListModal && anime.id) {
      showAddToListModal(anime.id);
    } else {
      // Fallback: open anime details modal which has add to list
      await openAnimeDetailsModal(anime);
    }
  } catch (error) {
    console.warn('Could not show add to list menu:', error);
    // Fallback: open anime details modal
    await openAnimeDetailsModal(anime);
  }
}

/**
 * Hide context menu
 */
function hideContextMenu() {
  if (contextMenuElement) {
    contextMenuElement.classList.add('hidden');
    currentAnime = null;
  }
}

/**
 * Get current anime from context menu
 */
export function getCurrentContextAnime() {
  return currentAnime;
}

