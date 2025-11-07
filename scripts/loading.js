// =====================================================================
// --- LOADING STATES MODULE (loading.js) ---
// =====================================================================
// Provides reusable loading indicators for async operations
// =====================================================================

import { escapeHtml } from './utils.js';

/**
 * Show a loading spinner on a button
 * @param {HTMLElement|string} buttonOrSelector - Button element or selector
 * @param {string} loadingText - Text to show while loading (optional)
 * @returns {Function} - Function to call to restore the button
 */
export function showButtonLoading(buttonOrSelector, loadingText = null) {
  const button = typeof buttonOrSelector === 'string' 
    ? document.querySelector(buttonOrSelector)
    : buttonOrSelector;
  
  if (!button) return () => {};
  
  // Store original state
  const originalText = button.textContent;
  const originalDisabled = button.disabled;
  const originalHTML = button.innerHTML;
  
  // Set loading state
  button.disabled = true;
  button.setAttribute('data-loading', 'true');
  button.classList.add('loading'); // Add loading class for CSS animations
  
  if (loadingText) {
    button.textContent = loadingText;
  } else {
    // Add spinner to button
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner small';
    spinner.style.marginRight = '8px';
    spinner.style.display = 'inline-block';
    spinner.style.verticalAlign = 'middle';
    
    button.insertBefore(spinner, button.firstChild);
  }
  
  // Return restore function
  return () => {
    button.disabled = originalDisabled;
    button.removeAttribute('data-loading');
    button.classList.remove('loading'); // Remove loading class
    
    if (loadingText) {
      button.textContent = originalText;
    } else {
      button.innerHTML = originalHTML;
    }
  };
}

/**
 * Show a loading overlay on an element
 * @param {HTMLElement|string} elementOrSelector - Element or selector
 * @param {string} message - Loading message (optional)
 * @returns {Function} - Function to call to hide the overlay
 */
export function showLoadingOverlay(elementOrSelector, message = 'Loading...') {
  const element = typeof elementOrSelector === 'string' 
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
  
  if (!element) return () => {};
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-overlay-content">
      <div class="loading-spinner large"></div>
      ${message ? `<p class="loading-overlay-message">${escapeHtml(message)}</p>` : ''}
    </div>
  `;
  
  // Make parent relative if not already
  const originalPosition = window.getComputedStyle(element).position;
  if (originalPosition === 'static') {
    element.style.position = 'relative';
  }
  
  element.appendChild(overlay);
  
  // Show with animation
  requestAnimationFrame(() => {
    overlay.classList.add('loading-overlay-show');
  });
  
  // Return hide function
  return () => {
    overlay.classList.remove('loading-overlay-show');
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
      }
      // Restore original position if we changed it
      if (originalPosition === 'static') {
        element.style.position = '';
      }
    }, 200);
  };
}

/**
 * Show a loading skeleton placeholder
 * @param {HTMLElement|string} elementOrSelector - Element or selector
 * @param {string} text - Placeholder text (optional)
 * @returns {Function} - Function to call to hide the skeleton
 */
export function showLoadingSkeleton(elementOrSelector, text = '') {
  const element = typeof elementOrSelector === 'string' 
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
  
  if (!element) return () => {};
  
  // Store original content
  const originalContent = element.innerHTML;
  
  // Create skeleton
  const skeleton = document.createElement('div');
  skeleton.className = 'loading-skeleton';
  skeleton.textContent = text || 'Loading...';
  skeleton.style.width = '100%';
  skeleton.style.height = '100%';
  skeleton.style.minHeight = '40px';
  
  element.innerHTML = '';
  element.appendChild(skeleton);
  
  // Return restore function
  return () => {
    element.innerHTML = originalContent;
  };
}

/**
 * Create a loading wrapper for async functions
 * @param {Function} asyncFn - Async function to wrap
 * @param {Object} options - Options: { button, overlay, message, onError }
 * @returns {Function} - Wrapped function
 */
export function withLoading(asyncFn, options = {}) {
  return async (...args) => {
    let restoreButton = null;
    let hideOverlay = null;
    
    try {
      // Show loading states
      if (options.button) {
        restoreButton = showButtonLoading(options.button, options.buttonText);
      }
      
      if (options.overlay) {
        hideOverlay = showLoadingOverlay(options.overlay, options.message);
      }
      
      // Execute async function
      const result = await asyncFn(...args);
      return result;
    } catch (error) {
      // Handle error
      if (options.onError) {
        options.onError(error);
      } else {
        console.error('Error in async operation:', error);
        const { showToast } = await import('./toast.js');
        showToast(
          error.message || 'An error occurred',
          'error',
          5000
        );
      }
      throw error;
    } finally {
      // Restore UI
      if (restoreButton) restoreButton();
      if (hideOverlay) hideOverlay();
    }
  };
}

/**
 * Escape HTML to prevent XSS
 */
// escapeHtml is now imported from utils.js

