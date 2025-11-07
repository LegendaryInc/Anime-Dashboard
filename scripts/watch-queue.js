// =====================================================================
// --- WATCH QUEUE MODULE (watch-queue.js) ---
// =====================================================================
// Contains functions for managing the watch queue (what to watch next)
// =====================================================================

import { handleError } from './error-handler.js';

let watchQueue = [];

/**
 * Load all queue entries from the API
 */
export async function loadWatchQueue() {
  try {
    const response = await fetch('/api/queue');
    if (!response.ok) {
      throw new Error(`Failed to load queue: ${response.statusText}`);
    }
    watchQueue = await response.json();
    return watchQueue;
  } catch (error) {
    handleError(error, 'loading watch queue', {
      showToast: false // Background loading
    });
    throw error;
  }
}

/**
 * Get all queue entries
 */
export function getWatchQueue() {
  return watchQueue;
}

/**
 * Add anime to queue
 */
export async function addToQueue(animeId) {
  try {
    const response = await fetch('/api/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ animeId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 400 ? 'Invalid anime ID' :
                        response.status === 409 ? 'Anime already in queue' :
                        response.status === 401 ? 'You must be logged in to add to queue' :
                        `Failed to add to queue: ${response.statusText} (${response.status})`;
      throw new Error(errorData.error || statusText);
    }

    const newEntry = await response.json();
    watchQueue.push(newEntry);
    return newEntry;
  } catch (error) {
    handleError(error, 'adding to queue', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Remove anime from queue
 */
export async function removeFromQueue(animeId) {
  try {
    const response = await fetch(`/api/queue/${animeId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to remove from queue: ${response.statusText}`);
    }

    watchQueue = watchQueue.filter(entry => entry.animeId !== animeId);
    return true;
  } catch (error) {
    handleError(error, 'removing from queue', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Reorder queue entries
 */
export async function reorderQueue(entries) {
  try {
    const response = await fetch('/api/queue/reorder', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entries })
    });

    if (!response.ok) {
      throw new Error(`Failed to reorder queue: ${response.statusText}`);
    }

    // Update local queue order
    entries.forEach(({ animeId, order }) => {
      const entry = watchQueue.find(e => e.animeId === animeId);
      if (entry) {
        entry.order = order;
      }
    });

    watchQueue.sort((a, b) => a.order - b.order);
    return true;
  } catch (error) {
    handleError(error, 'reordering queue', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Clear entire queue
 */
export async function clearQueue() {
  try {
    const response = await fetch('/api/queue', {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to clear queue: ${response.statusText}`);
    }

    watchQueue = [];
    return true;
  } catch (error) {
    handleError(error, 'clearing queue', {
      showToast: true
    });
    throw error;
  }
}

