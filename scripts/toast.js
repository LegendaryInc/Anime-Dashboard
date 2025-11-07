// =====================================================================
// --- TOAST NOTIFICATION MODULE (toast.js) ---
// =====================================================================

import { escapeHtml } from './utils.js';

/**
 * Show an achievement unlock notification
 * @param {Object} achievement - The achievement object
 * @param {number} duration - Duration in milliseconds (default: 5000)
 */
export function showAchievementToast(achievement, duration = 5000) {
  const container = document.querySelector('.toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-achievement';
  
  const rarityClass = `achievement-${achievement.rarity || 'common'}`;
  
  toast.innerHTML = `
    <div class="toast-achievement-content">
      <div class="toast-achievement-icon ${rarityClass}">${achievement.icon || '🏆'}</div>
      <div class="toast-achievement-text">
        <div class="toast-achievement-title">Achievement Unlocked!</div>
        <div class="toast-achievement-name">${escapeHtml(achievement.name)}</div>
        <div class="toast-achievement-desc">${escapeHtml(achievement.description)}</div>
      </div>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Make available globally for achievements module
window.showAchievementToast = showAchievementToast;

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.querySelector('.toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = getIcon(type);
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Show a confirmation dialog
 * @param {string} message - The confirmation message
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-content">
        <div class="confirm-icon">❓</div>
        <p class="confirm-message">${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-yes">Yes</button>
          <button class="confirm-btn confirm-no">No</button>
        </div>
      </div>
    `;
    
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    
    // Trigger animation
    setTimeout(() => backdrop.classList.add('confirm-show'), 10);
    
    const cleanup = (result) => {
      backdrop.classList.remove('confirm-show');
      setTimeout(() => {
        backdrop.remove();
        resolve(result);
      }, 200);
    };
    
    dialog.querySelector('.confirm-yes').addEventListener('click', () => cleanup(true));
    dialog.querySelector('.confirm-no').addEventListener('click', () => cleanup(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}

/**
 * Get icon for toast type
 */
function getIcon(type) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || icons.info;
}

/**
 * Create toast container if it doesn't exist
 */
function createToastContainer() {
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// escapeHtml is now imported from utils.js