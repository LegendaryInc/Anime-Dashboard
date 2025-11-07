// =====================================================================
// --- WATCH QUEUE VIEW MODULE (watch-queue-view.js) ---
// =====================================================================
// Handles rendering the watch queue UI
// =====================================================================

import {
  loadWatchQueue,
  getWatchQueue,
  addToQueue,
  removeFromQueue,
  reorderQueue,
  clearQueue
} from './watch-queue.js';
import { showButtonLoading } from './loading.js';
import { handleError } from './error-handler.js';
import { showToast, showConfirm } from './toast.js';
import { escapeHtml } from './utils.js';

let animeDataCache = null;

/**
 * Initialize the watch queue view
 */
export function initWatchQueueView() {
  const queueTab = document.getElementById('queue-tab');
  if (!queueTab) return;

  // Add to queue button
  document.addEventListener('click', (e) => {
    if (e.target.matches('#add-to-queue-btn') || e.target.closest('#add-to-queue-btn')) {
      e.preventDefault();
      e.stopPropagation();
      showAddToQueueModal();
    }

    if (e.target.matches('#clear-queue-btn') || e.target.closest('#clear-queue-btn')) {
      e.preventDefault();
      e.stopPropagation();
      handleClearQueue();
    }

    if (e.target.matches('[data-remove-from-queue]')) {
      const animeId = parseInt(e.target.dataset.removeFromQueue);
      handleRemoveFromQueue(animeId);
    }
  });
}

/**
 * Render the watch queue
 */
export async function renderWatchQueue() {
  const container = document.getElementById('queue-container');
  if (!container) return;

  try {
    await loadWatchQueue();
    const queue = getWatchQueue();

    if (queue.length === 0) {
      container.innerHTML = `
        <p class="text-center theme-text-muted py-8">Your queue is empty. Add anime to get started!</p>
      `;
      return;
    }

    // Get anime data from global cache
    if (!window.animeData || window.animeData.length === 0) {
      container.innerHTML = `
        <p class="text-center theme-text-muted py-8">Loading queue...</p>
      `;
      return;
    }

    animeDataCache = window.animeData;

    // Sort queue by order
    const sortedQueue = [...queue].sort((a, b) => a.order - b.order);

    let html = '<div id="queue-list" class="space-y-3">';
    
    sortedQueue.forEach((entry, index) => {
      const anime = animeDataCache.find(a => a.id === entry.animeId);
      if (!anime) return; // Skip if anime not found

      const title = anime.title || anime._romaji || anime._english || 'Unknown';
      const coverImage = anime.coverImage || '';
      
      html += `
        <div class="queue-item anime-card rounded-lg p-4 flex items-center gap-4 cursor-move hover:shadow-lg transition-shadow" 
             data-anime-id="${anime.id}" data-order="${entry.order}" draggable="true">
          <div class="flex-shrink-0 text-2xl theme-text-muted">${index + 1}</div>
          ${coverImage ? `
            <img src="${coverImage}" alt="${escapeHtml(title)}" 
                 class="w-16 h-24 object-cover rounded flex-shrink-0" />
          ` : '<div class="w-16 h-24 bg-gray-200 rounded flex-shrink-0"></div>'}
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold theme-text-primary mb-1">${escapeHtml(title)}</h4>
            <div class="text-sm theme-text-secondary">
              ${anime.status || 'Unknown'} • ${anime.score ? `⭐ ${anime.score}` : 'No score'}
            </div>
          </div>
          <button data-remove-from-queue="${anime.id}" 
                  class="text-red-600 hover:text-red-700 px-3 py-2 rounded" 
                  data-tooltip="Remove from queue">
            🗑️
          </button>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;

    // Setup drag and drop
    setupDragAndDrop();
  } catch (error) {
    const errorInfo = handleError(error, 'loading queue', {
      showToast: true
    });
    container.innerHTML = `
      <p class="text-center text-red-600 py-8">${errorInfo.message}</p>
    `;
  }
}

/**
 * Setup drag and drop for queue reordering
 */
function setupDragAndDrop() {
  const queueList = document.getElementById('queue-list');
  if (!queueList) return;

  let draggedElement = null;

  queueList.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.queue-item');
    if (item) {
      draggedElement = item;
      item.classList.add('dragging');
      item.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  queueList.addEventListener('dragend', (e) => {
    const item = e.target.closest('.queue-item');
    if (item) {
      item.classList.remove('dragging');
      item.style.opacity = '1';
      draggedElement = null;
    }
  });

  queueList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedElement) return;
    
    const afterElement = getDragAfterElement(queueList, e.clientY);
    if (afterElement == null) {
      queueList.appendChild(draggedElement);
    } else {
      queueList.insertBefore(draggedElement, afterElement);
    }
  });

  queueList.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!draggedElement) return;

    const items = Array.from(queueList.querySelectorAll('.queue-item'));
    const entries = items.map((item, index) => ({
      animeId: parseInt(item.dataset.animeId),
      order: index
    }));

    try {
      await reorderQueue(entries);
      await renderWatchQueue();
      showToast('Queue reordered successfully', 'success');
    } catch (error) {
      handleError(error, 'reordering queue', {
        showToast: true
      });
      await renderWatchQueue(); // Revert to original order
    }
  });
}

/**
 * Get the element after which to insert the dragged element
 */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.queue-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Show modal to add anime to queue
 */
function showAddToQueueModal() {
  if (!window.animeData || window.animeData.length === 0) {
    showToast('No anime data available', 'error');
    return;
  }

  // Filter to only anime that aren't already in queue
  const queue = getWatchQueue();
  const queueAnimeIds = new Set(queue.map(e => e.animeId));
  const availableAnime = window.animeData.filter(a => !queueAnimeIds.has(a.id));

  if (availableAnime.length === 0) {
    showToast('All anime are already in your queue', 'info');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Add to Queue</h3>
      <div class="mb-4">
        <input type="text" id="queue-search-input" 
               class="w-full px-3 py-2 border border-gray-300 rounded-lg"
               style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
               placeholder="Search anime...">
      </div>
      <div id="queue-anime-list" class="space-y-2 max-h-96 overflow-y-auto">
        ${availableAnime.slice(0, 50).map(anime => {
          const title = anime.title || anime._romaji || anime._english || 'Unknown';
          return `
            <div class="flex items-center gap-3 p-2 hover:bg-gray-100 rounded cursor-pointer" data-anime-id="${anime.id}">
              ${anime.coverImage ? `<img src="${anime.coverImage}" alt="${escapeHtml(title)}" class="w-12 h-16 object-cover rounded">` : ''}
              <div class="flex-1">
                <div class="font-semibold" style="color: var(--theme-text-primary, #111827);">${escapeHtml(title)}</div>
                <div class="text-sm" style="color: var(--theme-text-secondary, #6b7280);">${anime.status || 'Unknown'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="flex gap-3 justify-end mt-4">
        <button type="button" id="cancel-add-queue" class="btn-secondary py-2 px-4 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Search functionality
  const searchInput = modal.querySelector('#queue-search-input');
  const animeList = modal.querySelector('#queue-anime-list');
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const items = animeList.querySelectorAll('[data-anime-id]');
    items.forEach(item => {
      const title = item.textContent.toLowerCase();
      item.style.display = title.includes(query) ? '' : 'none';
    });
  });

  // Click handler for anime items
  animeList.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-anime-id]');
    if (!item) return;
    
    const animeId = parseInt(item.dataset.animeId);
    await handleAddToQueue(animeId);
    document.body.removeChild(modal);
  });

  // Cancel button
  modal.querySelector('#cancel-add-queue').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Handle adding anime to queue
 */
async function handleAddToQueue(animeId) {
  try {
    await addToQueue(animeId);
    await renderWatchQueue();
    showToast('Added to queue successfully', 'success');
  } catch (error) {
    handleError(error, 'adding to queue', {
      showToast: true
    });
  }
}

/**
 * Handle removing anime from queue
 */
async function handleRemoveFromQueue(animeId) {
  try {
    await removeFromQueue(animeId);
    await renderWatchQueue();
    showToast('Removed from queue', 'success');
  } catch (error) {
    handleError(error, 'removing from queue', {
      showToast: true
    });
  }
}

/**
 * Handle clearing entire queue
 */
async function handleClearQueue() {
  const confirmed = await showConfirm('Are you sure you want to clear your entire queue? This action cannot be undone.');
  if (!confirmed) return;

  try {
    await clearQueue();
    await renderWatchQueue();
    showToast('Queue cleared successfully', 'success');
  } catch (error) {
    handleError(error, 'clearing queue', {
      showToast: true
    });
  }
}

// escapeHtml is now imported from utils.js

