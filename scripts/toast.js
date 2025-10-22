// =====================================================================
// --- TOAST.JS - Toast Notification Utility ---
// =====================================================================
// A lightweight toast notification system to replace alert() calls.
// Usage: 
//   import { showToast } from './toast.js';
//   showToast('Your message here', 'success');
// =====================================================================

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
 * @param {number} duration - How long to show the toast in milliseconds (default: 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
  // Create container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;
  
  // Add to container
  container.appendChild(toast);
  
  // Trigger entrance animation
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/**
 * Shows a confirmation dialog with custom styling (replacement for confirm())
 * @param {string} message - The confirmation message
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `
      <div class="confirm-content">
        <div class="confirm-icon">⚠️</div>
        <div class="confirm-message">${message.replace(/\n/g, '<br>')}</div>
        <div class="confirm-buttons">
          <button class="confirm-btn confirm-btn-cancel">Cancel</button>
          <button class="confirm-btn confirm-btn-confirm">Confirm</button>
        </div>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Trigger entrance animation
    setTimeout(() => {
      overlay.classList.add('confirm-show');
    }, 10);
    
    // Handle button clicks
    const confirmBtn = dialog.querySelector('.confirm-btn-confirm');
    const cancelBtn = dialog.querySelector('.confirm-btn-cancel');
    
    const cleanup = (result) => {
      overlay.classList.remove('confirm-show');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
      resolve(result);
    };
    
    confirmBtn.addEventListener('click', () => cleanup(true));
    cancelBtn.addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}