// =====================================================================
// --- CUSTOM LISTS MODULE (custom-lists.js) ---
// =====================================================================
// Handles custom lists management, creation, and display
// =====================================================================

import { handleError } from './error-handler.js';
import { showButtonLoading } from './loading.js';

let customLists = [];
let currentListId = null;

/**
 * Load all custom lists from the API
 */
export async function loadCustomLists() {
  try {
    const response = await fetch('/api/lists');
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Not authenticated, cannot load custom lists');
        return [];
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to load custom lists: ${response.statusText} (${response.status})`);
    }
    customLists = await response.json();
    return customLists;
  } catch (error) {
    handleError(error, 'loading custom lists', {
      showToast: false // Don't show toast for background loading
    });
    // Don't throw - return empty array to allow app to continue
    return [];
  }
}

/**
 * Get all custom lists
 */
export function getCustomLists() {
  return customLists;
}

/**
 * Get a specific custom list by ID
 */
export function getCustomList(listId) {
  return customLists.find(list => list.id === listId);
}

/**
 * Create a new custom list
 */
export async function createCustomList(name, description = null, isPublic = false) {
  try {
    const response = await fetch('/api/lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, description, isPublic })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 400 ? 'Invalid list name or data' :
                         response.status === 409 ? 'A list with this name already exists' :
                         response.status === 401 ? 'You must be logged in to create lists' :
                         `Failed to create custom list: ${response.statusText} (${response.status})`;
      throw new Error(errorData.error || statusText);
    }

    const newList = await response.json();
    customLists.push(newList);
    return newList;
  } catch (error) {
    handleError(error, 'creating custom list', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Update a custom list
 */
export async function updateCustomList(listId, updates) {
  try {
    const response = await fetch(`/api/lists/${listId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 404 ? 'List not found' :
                         response.status === 400 ? 'Invalid update data' :
                         response.status === 401 ? 'You must be logged in to update lists' :
                         `Failed to update custom list: ${response.statusText} (${response.status})`;
      throw new Error(errorData.error || statusText);
    }

    const updatedList = await response.json();
    const index = customLists.findIndex(list => list.id === listId);
    if (index !== -1) {
      customLists[index] = updatedList;
    }
    return updatedList;
  } catch (error) {
    handleError(error, 'updating custom list', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Delete a custom list
 */
export async function deleteCustomList(listId) {
  try {
    const response = await fetch(`/api/lists/${listId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 404 ? 'List not found' :
                         response.status === 401 ? 'You must be logged in to delete lists' :
                         `Failed to delete custom list: ${response.statusText} (${response.status})`;
      throw new Error(errorData.error || statusText);
    }

    customLists = customLists.filter(list => list.id !== listId);
    return true;
  } catch (error) {
    handleError(error, 'deleting custom list', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Add anime to a custom list
 */
export async function addAnimeToList(listId, animeId) {
  try {
    const response = await fetch(`/api/lists/${listId}/anime`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ animeId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 409) {
        // Already in list
        return { success: false, alreadyInList: true };
      }
      const statusText = response.status === 404 ? 'List or anime not found' :
                         response.status === 400 ? 'Invalid anime ID' :
                         response.status === 401 ? 'You must be logged in to add anime to lists' :
                         `Failed to add anime to list: ${response.statusText} (${response.status})`;
      throw new Error(errorData.error || statusText);
    }

    const entry = await response.json();
    
    // Update local cache
    const list = customLists.find(l => l.id === listId);
    if (list) {
      if (!list.entries) {
        list.entries = [];
      }
      list.entries.push(entry);
    }

    return { success: true, entry };
  } catch (error) {
    handleError(error, 'adding anime to list', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Remove anime from a custom list
 */
export async function removeAnimeFromList(listId, animeId) {
  try {
    const response = await fetch(`/api/lists/${listId}/anime/${animeId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 404 ? 'Anime not found in list' :
                         response.status === 401 ? 'You must be logged in to remove anime from lists' :
                         `Failed to remove anime from list: ${response.statusText} (${response.status})`;
      throw new Error(errorData.error || statusText);
    }

    // Update local cache
    const list = customLists.find(l => l.id === listId);
    if (list && list.entries) {
      list.entries = list.entries.filter(entry => entry.animeId !== animeId);
    }

    return true;
  } catch (error) {
    handleError(error, 'removing anime from list', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Check if anime is in a specific list
 */
export function isAnimeInList(listId, animeId) {
  const list = customLists.find(l => l.id === listId);
  if (!list || !list.entries) return false;
  return list.entries.some(entry => entry.animeId === animeId);
}

/**
 * Get all lists containing a specific anime
 */
export function getListsContainingAnime(animeId) {
  return customLists.filter(list => 
    list.entries && list.entries.some(entry => entry.animeId === animeId)
  );
}

/**
 * Reorder entries in a custom list
 */
export async function reorderListEntries(listId, entries) {
  try {
    const response = await fetch(`/api/lists/${listId}/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entries })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reorder list entries');
    }

    // Reload the list to get updated order
    const list = await loadCustomList(listId);
    const index = customLists.findIndex(l => l.id === listId);
    if (index !== -1) {
      customLists[index] = list;
    }

    return true;
  } catch (error) {
    handleError(error, 'reordering list entries', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Load a single custom list by ID
 */
export async function loadCustomList(listId) {
  try {
    const response = await fetch(`/api/lists/${listId}`);
    if (!response.ok) {
      throw new Error(`Failed to load custom list: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    handleError(error, 'loading custom list', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Get anime data for entries in a list
 */
export function getAnimeDataForList(list, animeData) {
  if (!list || !list.entries || !animeData) return [];
  
  return list.entries
    .map(entry => {
      const anime = animeData.find(a => a.id === entry.animeId);
      if (!anime) return null;
      return {
        ...anime,
        listEntryId: entry.id,
        listOrder: entry.order,
        addedAt: entry.addedAt
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.listOrder - b.listOrder);
}

/**
 * Initialize custom lists system
 */
export async function initCustomLists() {
  await loadCustomLists();
}

/**
 * Set current list ID (for viewing/editing)
 */
export function setCurrentList(listId) {
  currentListId = listId;
}

/**
 * Get current list ID
 */
export function getCurrentList() {
  return currentListId ? customLists.find(l => l.id === currentListId) : null;
}

