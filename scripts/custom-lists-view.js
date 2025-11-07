// =====================================================================
// --- CUSTOM LISTS VIEW MODULE (custom-lists-view.js) ---
// =====================================================================
// Handles rendering the custom lists UI
// =====================================================================

import {
  loadCustomLists,
  getCustomLists,
  createCustomList,
  updateCustomList,
  deleteCustomList,
  addAnimeToList,
  removeAnimeFromList,
  getAnimeDataForList,
  setCurrentList,
  getCurrentList,
  isAnimeInList,
  getListsContainingAnime
} from './custom-lists.js';
import { showButtonLoading } from './loading.js';
import { handleError } from './error-handler.js';
import { escapeHtml, showInputError, clearInputValidation } from './utils.js';

let currentView = 'lists'; // 'lists' or 'list-detail'

/**
 * Initialize the custom lists view
 */
export function initCustomListsView() {
  const listsTab = document.getElementById('custom-lists-tab');
  if (!listsTab) return;

  // Use event delegation for create list buttons (handles both static and dynamic buttons)
  document.addEventListener('click', (e) => {
    if (e.target.matches('#create-list-btn') || 
        e.target.matches('#create-list-btn-center') ||
        e.target.closest('#create-list-btn') ||
        e.target.closest('#create-list-btn-center')) {
      e.preventDefault();
      e.stopPropagation();
      showCreateListModal();
    }
  });

  // List management buttons
  setupListManagementHandlers();
  
  // Initialize "Add to List" dropdowns
  initAddToListDropdowns();
}

/**
 * Setup handlers for list management actions
 */
function setupListManagementHandlers() {
  // Edit list button
  document.addEventListener('click', async (e) => {
    if (e.target.matches('[data-edit-list]')) {
      const listId = parseInt(e.target.dataset.editList);
      await showEditListModal(listId);
    }

    if (e.target.matches('[data-delete-list]')) {
      const listId = parseInt(e.target.dataset.deleteList);
      await handleDeleteList(listId);
    }

    if (e.target.matches('[data-view-list]')) {
      const listId = parseInt(e.target.dataset.viewList);
      await viewList(listId);
    }

    if (e.target.matches('[data-remove-from-list]')) {
      const listId = parseInt(e.target.dataset.removeFromList);
      const animeId = parseInt(e.target.dataset.animeId);
      await handleRemoveAnimeFromList(listId, animeId);
    }
  });
}

/**
 * Render all custom lists
 */
export async function renderCustomLists() {
  const container = document.getElementById('custom-lists-container');
  
  if (!container) {
    console.warn('Custom lists container not found!');
    return;
  }

  await loadCustomLists();
  const lists = getCustomLists();

  if (lists.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-6xl mb-4">📋</div>
        <h3 class="text-xl font-bold theme-text-primary mb-2">No Custom Lists Yet</h3>
        <p class="theme-text-secondary mb-4">Create your first custom list to organize your anime!</p>
        <button id="create-list-btn-center" class="btn-primary font-bold py-2 px-6 rounded-lg" data-tooltip="Create a new custom list to organize your anime">
          Create List
        </button>
      </div>
    `;
    // Event delegation handles this button, no need to attach listener here
    return;
  }

  let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';
  
  lists.forEach(list => {
    const entryCount = list.entries?.length || 0;
    const isPublic = list.isPublic ? '🌐 Public' : '🔒 Private';
    
    html += `
      <div class="anime-card rounded-lg p-4 hover:shadow-lg transition-shadow" data-list-id="${list.id}">
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-bold text-lg theme-text-primary flex-1">${escapeHtml(list.name)}</h3>
          <div class="flex gap-2">
            <button data-edit-list="${list.id}" class="text-sm px-2 py-1 rounded hover:bg-gray-100 theme-text-secondary" data-tooltip="Edit list" title="Edit">
              ✏️
            </button>
            <button data-delete-list="${list.id}" class="text-sm px-2 py-1 rounded hover:bg-red-100 text-red-600" data-tooltip="Delete list" title="Delete">
              🗑️
            </button>
          </div>
        </div>
        ${list.description ? `<p class="text-sm theme-text-secondary mb-2">${escapeHtml(list.description)}</p>` : ''}
        <div class="flex items-center justify-between text-sm theme-text-muted mb-3">
          <span>${entryCount} ${entryCount === 1 ? 'anime' : 'anime'}</span>
          <span>${isPublic}</span>
        </div>
        <button data-view-list="${list.id}" class="w-full btn-secondary py-2 px-4 rounded-lg text-sm font-semibold" data-tooltip="View all anime in this list">
          View List
        </button>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

/**
 * View a specific list
 */
export async function viewList(listId) {
  currentView = 'list-detail';
  setCurrentList(listId);
  
  const container = document.getElementById('custom-lists-container');
  if (!container) return;

  const list = getCurrentList();
  if (!list) {
    await loadCustomLists();
    const foundList = getCustomLists().find(l => l.id === listId);
    if (!foundList) {
      container.innerHTML = '<p class="theme-text-secondary">List not found</p>';
      return;
    }
    setCurrentList(listId);
  }

  const listData = getCurrentList();
  if (!window.animeData) {
    container.innerHTML = '<p class="theme-text-secondary">Anime data not loaded</p>';
    return;
  }

  const animeInList = getAnimeDataForList(listData, window.animeData);

  let html = `
    <div class="mb-4">
      <button id="back-to-lists-btn" class="btn-secondary py-2 px-4 rounded-lg text-sm font-semibold mb-4">
        ← Back to Lists
      </button>
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-2xl font-bold theme-text-primary mb-2">${escapeHtml(listData.name)}</h2>
          ${listData.description ? `<p class="theme-text-secondary">${escapeHtml(listData.description)}</p>` : ''}
          <div class="mt-2 text-sm theme-text-muted">
            ${animeInList.length} ${animeInList.length === 1 ? 'anime' : 'anime'} • 
            ${listData.isPublic ? '🌐 Public' : '🔒 Private'}
          </div>
        </div>
        <div class="flex gap-2">
          <button data-edit-list="${listData.id}" class="btn-secondary py-2 px-4 rounded-lg text-sm">
            Edit
          </button>
        </div>
      </div>
    </div>
  `;

  // Add "Add Anime" button
  html += `
    <div class="mb-4">
      <button id="add-anime-to-list-btn" data-list-id="${listData.id}" 
              class="btn-primary py-2 px-4 rounded-lg font-semibold">
        ➕ Add Anime to List
      </button>
    </div>
  `;

  if (animeInList.length === 0) {
    html += `
      <div class="text-center py-12 anime-card rounded-lg">
        <div class="text-6xl mb-4">📭</div>
        <h3 class="text-xl font-bold theme-text-primary mb-2">This list is empty</h3>
        <p class="theme-text-secondary mb-4">Add anime to this list to get started!</p>
        <button id="add-anime-to-list-btn-empty" data-list-id="${listData.id}" 
                class="btn-primary py-2 px-4 rounded-lg font-semibold">
          ➕ Add Anime to List
        </button>
      </div>
    `;
  } else {
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';
    
    animeInList.forEach(anime => {
      const title = anime.title || anime._romaji || anime._english || 'Unknown';
      html += `
        <div class="anime-card rounded-lg p-4">
          <div class="flex items-start gap-3">
            ${anime.coverImage ? `
              <img src="${anime.coverImage}" alt="${escapeHtml(title)}" 
                   class="w-16 h-24 object-cover rounded flex-shrink-0" />
            ` : ''}
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold theme-text-primary mb-1 truncate">${escapeHtml(title)}</h4>
              <div class="text-sm theme-text-secondary mb-2">
                ${anime.status || 'Unknown'} • ${anime.score ? `⭐ ${anime.score}` : 'No score'}
              </div>
              <button data-remove-from-list="${listData.id}" data-anime-id="${anime.id}" 
                      class="text-sm text-red-600 hover:text-red-700">
                Remove from list
              </button>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  }

  container.innerHTML = html;

  // Back button handler
  const backBtn = document.getElementById('back-to-lists-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      currentView = 'lists';
      setCurrentList(null);
      renderCustomLists();
    });
  }

  // Add anime button handlers
  const addBtns = document.querySelectorAll('[id^="add-anime-to-list-btn"]');
  addBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = parseInt(btn.dataset.listId);
      showAddAnimeModal(listId);
    });
  });
}

/**
 * Show create list modal
 */
function showCreateListModal() {
  // Check if modal already exists
  const existingModal = document.querySelector('.custom-list-create-modal');
  if (existingModal) {
    return; // Modal already open, don't create another
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 custom-list-create-modal';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Create New List</h3>
      <form id="create-list-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">List Name *</label>
          <input type="text" id="list-name-input" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 placeholder="e.g., Favorites, Rewatch Later" />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Description (optional)</label>
          <textarea id="list-description-input" rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                    placeholder="Describe what this list is for..."></textarea>
        </div>
        <div class="mb-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="list-public-input" />
            <span class="text-sm" style="color: var(--theme-text-primary, #111827);">Make this list public</span>
          </label>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-create-list" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Create List
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#create-list-form');
  const nameInput = modal.querySelector('#list-name-input');
  
  // Add real-time validation
  nameInput.addEventListener('blur', () => {
    const name = nameInput.value.trim();
    if (!name) {
      showInputError(nameInput, 'List name is required');
    } else if (name.length < 2) {
      showInputError(nameInput, 'List name must be at least 2 characters');
    } else if (name.length > 50) {
      showInputError(nameInput, 'List name must be less than 50 characters');
    } else {
      clearInputValidation(nameInput);
    }
  });
  
  nameInput.addEventListener('input', () => {
    // Clear validation on input
    clearInputValidation(nameInput);
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const description = modal.querySelector('#list-description-input').value.trim() || null;
    const isPublic = modal.querySelector('#list-public-input').checked;

    // Validate form
    let isValid = true;
    if (!name) {
      showInputError(nameInput, 'List name is required');
      isValid = false;
    } else if (name.length < 2) {
      showInputError(nameInput, 'List name must be at least 2 characters');
      isValid = false;
    } else if (name.length > 50) {
      showInputError(nameInput, 'List name must be less than 50 characters');
      isValid = false;
    }
    
    if (!isValid) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const restoreButton = showButtonLoading(submitButton, 'Creating...');
    
    try {
      await createCustomList(name, description, isPublic);
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      await renderCustomLists();
      if (typeof window.showToast === 'function') {
        window.showToast(`List "${name}" created successfully!`, 'success');
      }
    } catch (error) {
      handleError(error, 'creating list', {
        showToast: true
      });
    } finally {
      restoreButton();
    }
  });

  // Close on cancel button
  modal.querySelector('#cancel-create-list').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Show edit list modal
 */
async function showEditListModal(listId) {
  // Check if modal already exists
  const existingModal = document.querySelector('.custom-list-edit-modal');
  if (existingModal) {
    return; // Modal already open, don't create another
  }

  const list = getCustomLists().find(l => l.id === listId);
  if (!list) return;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 custom-list-edit-modal';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Edit List</h3>
      <form id="edit-list-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">List Name *</label>
          <input type="text" id="edit-list-name-input" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 value="${escapeHtml(list.name)}" />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Description (optional)</label>
          <textarea id="edit-list-description-input" rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);">${escapeHtml(list.description || '')}</textarea>
        </div>
        <div class="mb-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="edit-list-public-input" ${list.isPublic ? 'checked' : ''} />
            <span class="text-sm" style="color: var(--theme-text-primary, #111827);">Make this list public</span>
          </label>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-edit-list" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#edit-list-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = modal.querySelector('#edit-list-name-input').value.trim();
    const description = modal.querySelector('#edit-list-description-input').value.trim() || null;
    const isPublic = modal.querySelector('#edit-list-public-input').checked;

    if (!name) {
      if (typeof window.showToast === 'function') {
        window.showToast('List name is required', 'error');
      }
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const restoreButton = showButtonLoading(submitButton, 'Saving...');
    
    try {
      await updateCustomList(listId, { name, description, isPublic });
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      await renderCustomLists();
      if (currentView === 'list-detail') {
        await viewList(listId);
      }
      if (typeof window.showToast === 'function') {
        window.showToast('List updated successfully!', 'success');
      }
    } catch (error) {
      handleError(error, 'updating list', {
        showToast: true
      });
    } finally {
      restoreButton();
    }
  });

  // Close on cancel button
  modal.querySelector('#cancel-edit-list').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Handle delete list
 */
async function handleDeleteList(listId) {
  const list = getCustomLists().find(l => l.id === listId);
  if (!list) return;

  // Use showConfirm from toast.js
  const { showConfirm } = await import('./toast.js');
  const confirmed = await showConfirm(
    `Are you sure you want to delete "${list.name}"?\n\nThis action cannot be undone.`
  );
  if (!confirmed) return;

  try {
    await deleteCustomList(listId);
    await renderCustomLists();
    const { showToast } = await import('./toast.js');
    showToast('List deleted successfully', 'success');
  } catch (error) {
    handleError(error, 'deleting list', {
      showToast: true
    });
  }
}

/**
 * Handle remove anime from list
 */
async function handleRemoveAnimeFromList(listId, animeId) {
  try {
    await removeAnimeFromList(listId, animeId);
    await viewList(listId);
    if (typeof window.showToast === 'function') {
      window.showToast('Anime removed from list', 'success');
    }
  } catch (error) {
    handleError(error, 'removing anime from list', {
      showToast: true
    });
  }
}

/**
 * Refresh custom lists view
 */
export function refreshCustomListsView() {
  if (currentView === 'list-detail') {
    const currentList = getCurrentList();
    if (currentList) {
      viewList(currentList.id);
    } else {
      renderCustomLists();
    }
  } else {
    renderCustomLists();
  }
}

/**
 * Render "Add to List" dropdown button HTML
 * @param {number} animeId - The anime ID
 * @returns {string} HTML for the dropdown button
 */
export function renderAddToListButton(animeId) {
  const lists = getCustomLists();
  const listsContainingAnime = getListsContainingAnime(animeId);
  const listIdsInAnime = new Set(listsContainingAnime.map(l => l.id));
  
  if (lists.length === 0) {
    return `
      <div class="relative inline-block add-to-list-container">
        <button class="add-to-list-btn px-3 py-1.5 text-sm rounded-lg font-medium" 
                data-anime-id="${animeId}"
                title="Add to List">
          📋 Add to List
        </button>
      </div>
    `;
  }

  const listsHtml = lists.map(list => {
    const isInList = listIdsInAnime.has(list.id);
    const entryCount = list.entries?.length || 0;
    return `
      <button class="add-to-list-option w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between gap-3 ${isInList ? 'opacity-60' : ''}" 
              data-list-id="${list.id}" 
              data-anime-id="${animeId}"
              ${isInList ? 'disabled' : ''}>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm">${escapeHtml(list.name)}</div>
          <div class="text-xs theme-text-secondary">${entryCount} ${entryCount === 1 ? 'anime' : 'anime'}</div>
        </div>
        ${isInList ? '<span class="text-green-500 text-sm">✓</span>' : '<span class="text-xs theme-text-muted">+</span>'}
      </button>
    `;
  }).join('');

  return `
    <div class="relative inline-block add-to-list-container">
      <button class="add-to-list-btn px-3 py-1.5 text-sm rounded-lg font-medium" 
              data-anime-id="${animeId}"
              title="Add to List">
        📋 Add to List
        ${listsContainingAnime.length > 0 ? ` <span class="text-xs">(${listsContainingAnime.length})</span>` : ''}
      </button>
      <div class="add-to-list-dropdown hidden absolute top-full left-0 mt-1 z-50 min-w-[200px]">
        ${listsHtml}
        <div class="border-t border-gray-200 mt-1 pt-1">
          <button class="add-to-list-option create-new w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-3 font-semibold text-indigo-600" 
                  data-anime-id="${animeId}"
                  data-create-new="true">
            <span>+</span>
            <span>Create New List</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize "Add to List" dropdown functionality
 */
export function initAddToListDropdowns() {
  // Use event delegation for all add-to-list buttons
  document.addEventListener('click', async (e) => {
    // Toggle dropdown or show modal
    if (e.target.matches('.add-to-list-btn') || e.target.closest('.add-to-list-btn')) {
      e.preventDefault();
      e.stopPropagation();
      
      const btn = e.target.matches('.add-to-list-btn') ? e.target : e.target.closest('.add-to-list-btn');
      const animeId = parseInt(btn.dataset.animeId);
      
      if (animeId) {
        // Check if we're in a table (where dropdowns get cut off)
        const isInTable = btn.closest('#anime-table') !== null;
        
        if (isInTable) {
          // Use modal for table view
          showAddToListModal(animeId);
        } else {
          // Use dropdown for other views (grid, watching, etc.)
          const container = btn.closest('.add-to-list-container');
          const dropdown = container?.querySelector('.add-to-list-dropdown');
          
          if (dropdown) {
            // Close all other dropdowns
            document.querySelectorAll('.add-to-list-dropdown').forEach(d => {
              if (d !== dropdown) {
                d.classList.add('hidden');
              }
            });
            
            // Toggle this dropdown
            const isHidden = dropdown.classList.contains('hidden');
            dropdown.classList.toggle('hidden');
            
            // If opening, position it intelligently
            if (isHidden) {
              // Use setTimeout to ensure dropdown is rendered before measuring
              setTimeout(() => {
                positionDropdown(dropdown, btn);
              }, 0);
            }
          }
        }
      }
    }
    
    // Add to existing list
    if (e.target.matches('.add-to-list-option:not(.create-new)') && !e.target.disabled) {
      e.preventDefault();
      e.stopPropagation();
      
      const option = e.target.closest('.add-to-list-option');
      const listId = parseInt(option.dataset.listId);
      const animeId = parseInt(option.dataset.animeId);
      
      if (listId && animeId) {
        try {
          const result = await addAnimeToList(listId, animeId);
          if (result.success) {
            // Close dropdown
            const dropdown = option.closest('.add-to-list-dropdown');
            if (dropdown) {
              dropdown.classList.add('hidden');
            }
            
            // Update button to show it's in list
            await loadCustomLists();
            updateAddToListButton(animeId);
            
            // Also update modal button if it exists
            const modalContainer = document.getElementById('anime-details-add-to-list-container');
            if (modalContainer) {
              const modalButtonHtml = await getAddToListButton(animeId);
              if (modalButtonHtml) {
                modalContainer.innerHTML = modalButtonHtml;
              }
            }
            
            // Show toast notification
            const list = getCustomLists().find(l => l.id === listId);
            if (typeof window.showToast === 'function') {
              window.showToast(`Added to "${list?.name || 'list'}"`, 'success');
            } else if (typeof showToast === 'function') {
              showToast(`Added to "${list?.name || 'list'}"`, 'success');
            }
          } else if (result.alreadyInList) {
            if (typeof window.showToast === 'function') {
              window.showToast('Anime is already in this list', 'info');
            }
          }
        } catch (error) {
          handleError(error, 'adding anime to list', {
            showToast: true
          });
        }
      }
    }
    
    // Create new list
    if (e.target.matches('.add-to-list-option.create-new')) {
      e.preventDefault();
      e.stopPropagation();
      
      const option = e.target.closest('.add-to-list-option');
      const animeId = parseInt(option.dataset.animeId);
      
      // Close dropdown
      const dropdown = option.closest('.add-to-list-dropdown');
      if (dropdown) {
        dropdown.classList.add('hidden');
      }
      
      // Show create list modal with anime pre-selected
      showCreateListModalWithAnime(animeId);
    }
    
    // Close dropdowns when clicking outside
    if (!e.target.closest('.add-to-list-container')) {
      document.querySelectorAll('.add-to-list-dropdown').forEach(d => {
        d.classList.add('hidden');
      });
    }
  });
}

/**
 * Show "Add to List" modal (for table view where dropdowns get cut off)
 */
export function showAddToListModal(animeId) {
  // Check if modal already exists
  const existingModal = document.querySelector('.add-to-list-modal');
  if (existingModal) {
    return;
  }

  const lists = getCustomLists();
  const listsContainingAnime = getListsContainingAnime(animeId);
  const listIdsInAnime = new Set(listsContainingAnime.map(l => l.id));

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 add-to-list-modal';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Add to List</h3>
      <div class="max-h-96 overflow-y-auto">
        ${lists.length === 0 ? `
          <p class="text-sm mb-4" style="color: var(--theme-text-secondary, #6b7280);">No lists available. Create one first!</p>
        ` : `
          <div class="space-y-2 mb-4">
            ${lists.map(list => {
              const isInList = listIdsInAnime.has(list.id);
              const entryCount = list.entries?.length || 0;
              return `
                <button class="add-to-list-modal-option w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${isInList ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}" 
                        data-list-id="${list.id}" 
                        data-anime-id="${animeId}"
                        ${isInList ? 'disabled' : ''}
                        style="background: var(--theme-bg, #ffffff); border-color: var(--theme-border, #e5e7eb); color: var(--theme-text-primary, #111827);">
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm">${escapeHtml(list.name)}</div>
                    <div class="text-xs" style="color: var(--theme-text-secondary, #6b7280);">${entryCount} ${entryCount === 1 ? 'anime' : 'anime'}</div>
                  </div>
                  ${isInList ? '<span class="text-green-500 text-sm">✓</span>' : '<span class="text-xs" style="color: var(--theme-text-muted, #9ca3af);">+</span>'}
                </button>
              `;
            }).join('')}
          </div>
        `}
        <div class="border-t pt-4" style="border-color: var(--theme-border, #e5e7eb);">
          <button class="add-to-list-modal-create w-full text-left px-4 py-3 rounded-lg font-semibold flex items-center gap-3 hover:bg-indigo-50" 
                  data-anime-id="${animeId}"
                  data-create-new="true"
                  style="color: var(--theme-primary, #6366f1);">
            <span>+</span>
            <span>Create New List</span>
          </button>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-4">
        <button type="button" id="cancel-add-to-list-modal" class="btn-secondary py-2 px-4 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle adding to existing list
  modal.querySelectorAll('.add-to-list-modal-option:not([disabled])').forEach(option => {
    option.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const listId = parseInt(option.dataset.listId);
      const animeId = parseInt(option.dataset.animeId);
      
      if (listId && animeId) {
        try {
          const result = await addAnimeToList(listId, animeId);
          if (result.success) {
            if (modal.parentNode) {
              document.body.removeChild(modal);
            }
            
            // Update all add-to-list buttons
            await loadCustomLists();
            updateAddToListButton(animeId);
            updateAllAddToListButtons();
            
            // Show toast notification
            const list = getCustomLists().find(l => l.id === listId);
            const toastMessage = `Added to "${list?.name || 'list'}"`;
            if (typeof window.showToast === 'function') {
              window.showToast(toastMessage, 'success');
            } else {
              try {
                const { showToast } = await import('./toast.js');
                if (showToast) {
                  showToast(toastMessage, 'success');
                }
              } catch (error) {
                console.log('Toast notification:', toastMessage);
              }
            }
          } else if (result.alreadyInList) {
            if (typeof window.showToast === 'function') {
              window.showToast('Anime is already in this list', 'info');
            }
          }
        } catch (error) {
          handleError(error, 'adding anime to list', {
            showToast: true
          });
        }
      }
    });
  });

  // Handle create new list
  modal.querySelector('.add-to-list-modal-create')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const animeId = parseInt(e.target.closest('.add-to-list-modal-create').dataset.animeId);
    
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
    
    showCreateListModalWithAnime(animeId);
  });

  // Close on cancel button
  modal.querySelector('#cancel-add-to-list-modal')?.addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Position dropdown to avoid being cut off by container edges
 */
function positionDropdown(dropdown, button) {
  if (!dropdown || !button) return;
  
  // Reset positioning
  dropdown.style.left = '';
  dropdown.style.right = '';
  dropdown.style.top = '';
  dropdown.style.bottom = '';
  dropdown.style.marginTop = '';
  dropdown.style.marginBottom = '';
  
  // Get button position relative to viewport
  const buttonRect = button.getBoundingClientRect();
  const dropdownRect = dropdown.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Check if dropdown would overflow right edge
  const spaceOnRight = viewportWidth - buttonRect.right;
  const spaceOnLeft = buttonRect.left;
  const dropdownWidth = dropdownRect.width || 200; // fallback width
  
  if (spaceOnRight < dropdownWidth && spaceOnLeft > spaceOnRight) {
    // Position to the left of button (align right edge with button)
    dropdown.style.left = 'auto';
    dropdown.style.right = '0';
  } else {
    // Default: position to the right (align left edge with button)
    dropdown.style.left = '0';
    dropdown.style.right = 'auto';
  }
  
  // Check if dropdown would overflow bottom edge
  const spaceBelow = viewportHeight - buttonRect.bottom;
  const spaceAbove = buttonRect.top;
  const dropdownHeight = dropdownRect.height || 200; // fallback height
  
  if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
    // Position above button
    dropdown.style.top = 'auto';
    dropdown.style.bottom = '100%';
    dropdown.style.marginTop = '0';
    dropdown.style.marginBottom = '0.25rem';
  } else {
    // Default: position below button
    dropdown.style.top = '100%';
    dropdown.style.bottom = 'auto';
    dropdown.style.marginTop = '0.25rem';
    dropdown.style.marginBottom = '0';
  }
}

/**
 * Update "Add to List" button for a specific anime
 */
async function updateAddToListButton(animeId) {
  await loadCustomLists();
  const buttonContainers = document.querySelectorAll(`.add-to-list-container`);
  
  buttonContainers.forEach(container => {
    const btn = container.querySelector('.add-to-list-btn');
    if (btn && parseInt(btn.dataset.animeId) === animeId) {
      const newHtml = renderAddToListButton(animeId);
      container.outerHTML = newHtml;
    }
  });
}

/**
 * Show create list modal with anime pre-selected
 */
function showCreateListModalWithAnime(animeId) {
  // Check if modal already exists
  const existingModal = document.querySelector('.custom-list-create-modal');
  if (existingModal) {
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 custom-list-create-modal';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Create New List</h3>
      <form id="create-list-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">List Name *</label>
          <input type="text" id="list-name-input" required 
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 placeholder="e.g., Favorites, Rewatch Later" />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Description (optional)</label>
          <textarea id="list-description-input" rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                    placeholder="Describe what this list is for..."></textarea>
        </div>
        <div class="mb-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" id="list-public-input" />
            <span class="text-sm" style="color: var(--theme-text-primary, #111827);">Make this list public</span>
          </label>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-create-list" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Create List
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#create-list-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = modal.querySelector('#list-name-input').value.trim();
    const description = modal.querySelector('#list-description-input').value.trim() || null;
    const isPublic = modal.querySelector('#list-public-input').checked;

    if (!name) {
      if (typeof window.showToast === 'function') {
        window.showToast('List name is required', 'error');
      }
      return;
    }

    try {
      const newList = await createCustomList(name, description, isPublic);
      
      // Add anime to the newly created list
      if (animeId) {
        try {
          await addAnimeToList(newList.id, animeId);
        } catch (error) {
          handleError(error, 'adding anime to new list', {
            showToast: true
          });
        }
      }
      
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      
      // Update all add-to-list buttons
      await loadCustomLists();
      updateAllAddToListButtons();
      
      if (typeof window.showToast === 'function') {
        window.showToast(`List "${name}" created${animeId ? ' and anime added' : ''}!`, 'success');
      }
    } catch (error) {
      handleError(error, 'creating list', {
        showToast: true
      });
    }
  });

  modal.querySelector('#cancel-create-list').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
    }
  });
}

/**
 * Update all "Add to List" buttons
 */
async function updateAllAddToListButtons() {
  await loadCustomLists();
  const containers = document.querySelectorAll('.add-to-list-container');
  containers.forEach(container => {
    const btn = container.querySelector('.add-to-list-btn');
    if (btn) {
      const animeId = parseInt(btn.dataset.animeId);
      if (animeId) {
        const newHtml = renderAddToListButton(animeId);
        container.outerHTML = newHtml;
      }
    }
  });
}

/**
 * Show modal to add anime to a list (search or browse)
 */
function showAddAnimeModal(listId) {
  // Check if modal already exists
  const existingModal = document.querySelector('.add-anime-to-list-modal');
  if (existingModal) {
    return;
  }

  const list = getCustomLists().find(l => l.id === listId);
  if (!list) return;

  let searchTimeout = null;
  let currentTab = 'search'; // 'search' or 'my-list'
  let searchResults = [];
  let selectedAnimeIds = new Set();

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 add-anime-to-list-modal';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" style="background: var(--theme-bg, #ffffff);">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold" style="color: var(--theme-text-primary, #111827);">
          Add Anime to "${escapeHtml(list.name)}"
        </h3>
        <button id="close-add-anime-modal" class="text-2xl leading-none" style="color: var(--theme-text-secondary, #6b7280);">&times;</button>
      </div>
      
      <!-- Tabs -->
      <div class="flex gap-2 mb-4 border-b" style="border-color: var(--theme-border, #e5e7eb);">
        <button class="tab-btn py-2 px-4 font-semibold transition-colors ${currentTab === 'search' ? 'border-b-2' : ''}" 
                data-tab="search" 
                style="color: var(--theme-text-primary, #111827); ${currentTab === 'search' ? 'border-color: var(--theme-primary, #6366f1);' : ''}">
          🔍 Search Any Anime
        </button>
        <button class="tab-btn py-2 px-4 font-semibold transition-colors ${currentTab === 'my-list' ? 'border-b-2' : ''}" 
                data-tab="my-list"
                style="color: var(--theme-text-primary, #111827); ${currentTab === 'my-list' ? 'border-color: var(--theme-primary, #6366f1);' : ''}">
          📋 From My List
        </button>
      </div>

      <!-- Search Tab -->
      <div id="search-tab-content" class="flex-1 overflow-hidden flex flex-col ${currentTab === 'search' ? '' : 'hidden'}">
        <div class="mb-4">
          <input type="text" id="anime-search-input" 
                 class="w-full px-4 py-2 border rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827); border-color: var(--theme-border, #e5e7eb);"
                 placeholder="Search for any anime on AniList... (e.g., 'Naruto', 'Attack on Titan')" />
        </div>
        <div id="search-results-container" class="flex-1 overflow-y-auto">
          <div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">
            <p>Enter a search term to find anime</p>
          </div>
        </div>
      </div>

      <!-- My List Tab -->
      <div id="my-list-tab-content" class="flex-1 overflow-hidden flex flex-col ${currentTab === 'my-list' ? '' : 'hidden'}">
        <div class="mb-4">
          <input type="text" id="my-list-filter-input" 
                 class="w-full px-4 py-2 border rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827); border-color: var(--theme-border, #e5e7eb);"
                 placeholder="Filter your anime list..." />
        </div>
        <div id="my-list-results-container" class="flex-1 overflow-y-auto">
          <div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">
            <p>Loading your anime list...</p>
          </div>
        </div>
      </div>

      <!-- Selected count and Add button -->
      <div class="flex items-center justify-between mt-4 pt-4 border-t" style="border-color: var(--theme-border, #e5e7eb);">
        <div style="color: var(--theme-text-secondary, #6b7280);">
          <span id="selected-count">0</span> anime selected
        </div>
        <div class="flex gap-3">
          <button id="cancel-add-anime" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button id="add-selected-anime" class="btn-primary py-2 px-4 rounded-lg font-semibold" disabled>
            Add Selected
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Tab switching
  const tabButtons = modal.querySelectorAll('[data-tab]');
  const searchTabContent = modal.querySelector('#search-tab-content');
  const myListTabContent = modal.querySelector('#my-list-tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      currentTab = tab;
      
      // Update tab buttons
      tabButtons.forEach(b => {
        b.classList.toggle('border-b-2', b.dataset.tab === tab);
      });
      
      // Show/hide content
      searchTabContent.classList.toggle('hidden', tab !== 'search');
      myListTabContent.classList.toggle('hidden', tab !== 'my-list');
      
      // Load my list if switching to that tab
      if (tab === 'my-list') {
        renderMyListAnime(listId);
      }
    });
  });

  // Search functionality
  const searchInput = modal.querySelector('#anime-search-input');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
      modal.querySelector('#search-results-container').innerHTML = `
        <div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">
          <p>Enter at least 2 characters to search</p>
        </div>
      `;
      return;
    }

    searchTimeout = setTimeout(async () => {
      await performAnimeSearch(query, listId);
    }, 500);
  });

  // My list filter
  const filterInput = modal.querySelector('#my-list-filter-input');
  filterInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    filterMyListAnime(query, listId);
  });

  // Add selected button
  const addSelectedBtn = modal.querySelector('#add-selected-anime');
  addSelectedBtn.addEventListener('click', async () => {
    if (selectedAnimeIds.size === 0) return;
    
    const restoreBtn = showButtonLoading(addSelectedBtn, 'Adding...');
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const animeId of selectedAnimeIds) {
        try {
          const result = await addAnimeToList(listId, animeId);
          if (result.success) {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }
      
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      
      // Refresh the list view
      await viewList(listId);
      
      const { showToast } = await import('./toast.js');
      if (successCount > 0) {
        showToast(`Added ${successCount} anime to list!`, 'success');
      }
      if (errorCount > 0) {
        showToast(`${errorCount} anime could not be added`, 'error');
      }
    } catch (error) {
      handleError(error, 'adding anime to list', { showToast: true });
    } finally {
      restoreBtn();
    }
  });

  // Close handlers
  modal.querySelector('#close-add-anime-modal').addEventListener('click', () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  });
  
  modal.querySelector('#cancel-add-anime').addEventListener('click', () => {
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

  // Perform anime search
  async function performAnimeSearch(query, listId) {
    const container = modal.querySelector('#search-results-container');
    container.innerHTML = '<div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">Searching...</div>';
    
    try {
      const response = await fetch(`/api/search-anime?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      searchResults = await response.json();
      renderSearchResults(searchResults, listId);
    } catch (error) {
      handleError(error, 'searching anime', { showToast: false });
      container.innerHTML = `
        <div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">
          <p>Failed to search anime. Please try again.</p>
        </div>
      `;
    }
  }

  // Render search results
  function renderSearchResults(results, listId) {
    const container = modal.querySelector('#search-results-container');
    const list = getCustomLists().find(l => l.id === listId);
    const animeInList = new Set((list.entries || []).map(e => e.animeId));
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">
          <p>No anime found. Try a different search term.</p>
        </div>
      `;
      return;
    }

    let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';
    
    results.forEach(anime => {
      const title = anime.title || anime._romaji || anime._english || 'Unknown';
      const isInList = animeInList.has(anime.id);
      const isSelected = selectedAnimeIds.has(anime.id);
      
      html += `
        <div class="anime-card rounded-lg p-4 cursor-pointer border-2 transition-all ${isSelected ? 'border-indigo-500' : 'border-transparent'} ${isInList ? 'opacity-60' : ''}" 
             data-anime-id="${anime.id}"
             style="background: var(--theme-bg-secondary, #f9fafb);">
          <div class="flex items-start gap-3">
            ${anime.coverImage ? `
              <img src="${anime.coverImage}" alt="${escapeHtml(title)}" 
                   class="w-16 h-24 object-cover rounded flex-shrink-0" />
            ` : ''}
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2 mb-1">
                <h4 class="font-semibold text-sm" style="color: var(--theme-text-primary, #111827);">
                  ${escapeHtml(title)}
                </h4>
                <input type="checkbox" class="anime-select-checkbox" 
                       data-anime-id="${anime.id}"
                       ${isInList ? 'disabled' : ''}
                       ${isSelected ? 'checked' : ''} />
              </div>
              <div class="text-xs mb-2" style="color: var(--theme-text-secondary, #6b7280);">
                ${anime.format || 'Unknown'} • ${anime.episodes || '?'} eps
                ${anime.averageScore ? ` • ⭐ ${anime.averageScore / 10}` : ''}
              </div>
              ${anime.genres && anime.genres.length > 0 ? `
                <div class="text-xs mb-2" style="color: var(--theme-text-muted, #9ca3af);">
                  ${anime.genres.slice(0, 3).join(', ')}
                </div>
              ` : ''}
              ${isInList ? '<div class="text-xs text-green-600">✓ Already in list</div>' : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;

    // Add click handlers for selection
    container.querySelectorAll('[data-anime-id]').forEach(card => {
      const animeId = parseInt(card.dataset.animeId);
      const checkbox = card.querySelector('.anime-select-checkbox');
      
      if (checkbox && !checkbox.disabled) {
        card.addEventListener('click', (e) => {
          if (e.target === checkbox) return;
          checkbox.checked = !checkbox.checked;
          updateSelection(animeId, checkbox.checked);
        });
        
        checkbox.addEventListener('change', (e) => {
          updateSelection(animeId, e.target.checked);
        });
      }
    });
  }

  // Render my list anime
  async function renderMyListAnime(listId) {
    const container = modal.querySelector('#my-list-results-container');
    
    if (!window.animeData || window.animeData.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">
          <p>No anime in your list. Search for anime to add!</p>
        </div>
      `;
      return;
    }

    const list = getCustomLists().find(l => l.id === listId);
    const animeInList = new Set((list.entries || []).map(e => e.animeId));
    
    renderMyListAnimeResults(window.animeData, animeInList, listId);
  }

  // Render my list anime results
  function renderMyListAnimeResults(animeData, animeInList, listId) {
    const container = modal.querySelector('#my-list-results-container');
    const filterQuery = modal.querySelector('#my-list-filter-input')?.value.trim().toLowerCase() || '';
    
    let filteredAnime = animeData;
    if (filterQuery) {
      filteredAnime = animeData.filter(anime => {
        const title = (anime.title || anime._romaji || anime._english || '').toLowerCase();
        return title.includes(filterQuery);
      });
    }

    if (filteredAnime.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8" style="color: var(--theme-text-secondary, #6b7280);">
          <p>No anime found matching your filter.</p>
        </div>
      `;
      return;
    }

    let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';
    
    filteredAnime.forEach(anime => {
      const title = anime.title || anime._romaji || anime._english || 'Unknown';
      const isInList = animeInList.has(anime.id);
      const isSelected = selectedAnimeIds.has(anime.id);
      
      html += `
        <div class="anime-card rounded-lg p-4 cursor-pointer border-2 transition-all ${isSelected ? 'border-indigo-500' : 'border-transparent'} ${isInList ? 'opacity-60' : ''}" 
             data-anime-id="${anime.id}"
             style="background: var(--theme-bg-secondary, #f9fafb);">
          <div class="flex items-start gap-3">
            ${anime.coverImage ? `
              <img src="${anime.coverImage}" alt="${escapeHtml(title)}" 
                   class="w-16 h-24 object-cover rounded flex-shrink-0" />
            ` : ''}
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2 mb-1">
                <h4 class="font-semibold text-sm" style="color: var(--theme-text-primary, #111827);">
                  ${escapeHtml(title)}
                </h4>
                <input type="checkbox" class="anime-select-checkbox" 
                       data-anime-id="${anime.id}"
                       ${isInList ? 'disabled' : ''}
                       ${isSelected ? 'checked' : ''} />
              </div>
              <div class="text-xs mb-2" style="color: var(--theme-text-secondary, #6b7280);">
                ${anime.status || 'Unknown'} • ${anime.score ? `⭐ ${anime.score}` : 'No score'}
              </div>
              ${anime.genres && anime.genres.length > 0 ? `
                <div class="text-xs mb-2" style="color: var(--theme-text-muted, #9ca3af);">
                  ${anime.genres.slice(0, 3).join(', ')}
                </div>
              ` : ''}
              ${isInList ? '<div class="text-xs text-green-600">✓ Already in list</div>' : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;

    // Add click handlers for selection
    container.querySelectorAll('[data-anime-id]').forEach(card => {
      const animeId = parseInt(card.dataset.animeId);
      const checkbox = card.querySelector('.anime-select-checkbox');
      
      if (checkbox && !checkbox.disabled) {
        card.addEventListener('click', (e) => {
          if (e.target === checkbox) return;
          checkbox.checked = !checkbox.checked;
          updateSelection(animeId, checkbox.checked);
        });
        
        checkbox.addEventListener('change', (e) => {
          updateSelection(animeId, e.target.checked);
        });
      }
    });
  }

  // Filter my list anime
  function filterMyListAnime(query, listId) {
    if (!window.animeData) return;
    const list = getCustomLists().find(l => l.id === listId);
    const animeInList = new Set((list.entries || []).map(e => e.animeId));
    renderMyListAnimeResults(window.animeData, animeInList, listId);
  }

  // Update selection
  function updateSelection(animeId, isSelected) {
    if (isSelected) {
      selectedAnimeIds.add(animeId);
    } else {
      selectedAnimeIds.delete(animeId);
    }
    
    const countEl = modal.querySelector('#selected-count');
    const addBtn = modal.querySelector('#add-selected-anime');
    
    if (countEl) {
      countEl.textContent = selectedAnimeIds.size;
    }
    
    if (addBtn) {
      addBtn.disabled = selectedAnimeIds.size === 0;
    }
    
    // Update card borders
    modal.querySelectorAll(`[data-anime-id="${animeId}"]`).forEach(card => {
      if (isSelected) {
        card.classList.add('border-indigo-500');
        card.classList.remove('border-transparent');
      } else {
        card.classList.remove('border-indigo-500');
        card.classList.add('border-transparent');
      }
    });
  }

  // Initial load of my list if on that tab
  if (currentTab === 'my-list') {
    renderMyListAnime(listId);
  }
}

// escapeHtml is now imported from utils.js

