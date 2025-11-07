// =====================================================================
// --- UTILITY FUNCTIONS (utils.js) ---
// =====================================================================
// Performance utilities: debounce, throttle, memoization
// =====================================================================

/**
 * Debounce function - delays execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function with cancel method
 */
export function debounce(func, wait = 300, immediate = false) {
  let timeout;
  const executedFunction = function(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
  
  // Add cancel method to allow clearing pending execution
  executedFunction.cancel = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return executedFunction;
}

/**
 * Throttle function - limits execution to once per wait time
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Memoization helper - caches function results
 * @param {Function} fn - Function to memoize
 * @param {Function} keyGenerator - Function to generate cache key from arguments
 * @returns {Function} Memoized function
 */
export function memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return function(...args) {
    const key = keyGenerator(...args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Batch DOM updates using requestAnimationFrame
 * @param {Function} callback - Function to execute in next frame
 * @returns {number} Request ID for cancellation
 */
export function batchDOMUpdate(callback) {
  return requestAnimationFrame(callback);
}

/**
 * Cancel a batched DOM update
 * @param {number} requestId - Request ID from batchDOMUpdate
 */
export function cancelDOMUpdate(requestId) {
  cancelAnimationFrame(requestId);
}

/**
 * Lazy load Chart.js library from CDN
 * @returns {Promise<Object>} Promise that resolves to Chart.js library
 */
export async function loadChartJS() {
  if (window.Chart) {
    return window.Chart;
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';
    script.async = true;
    script.onload = () => {
      if (window.Chart) {
        resolve(window.Chart);
      } else {
        reject(new Error('Chart.js failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(script);
  });
}

/**
 * Lazy load jsPDF library from CDN
 * @returns {Promise<Object>} Promise that resolves to jsPDF library
 */
export async function loadJsPDF() {
  if (window.jspdf) {
    return window.jspdf.jsPDF;
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error('jsPDF failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(script);
  });
}

// =====================================================================
// FOCUS MANAGEMENT (Accessibility)
// =====================================================================

let focusHistory = [];
let focusTrapHandlers = new Map();

/**
 * Trap focus within a modal element
 * @param {HTMLElement} modalElement - The modal element to trap focus in
 */
export function trapFocus(modalElement) {
  if (!modalElement) return;

  const focusableElements = modalElement.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  modalElement.addEventListener('keydown', handleTabKey);
  focusTrapHandlers.set(modalElement, handleTabKey);

  // Focus first element
  if (firstFocusable) {
    requestAnimationFrame(() => {
      firstFocusable.focus();
    });
  }
}

/**
 * Release focus trap from a modal element
 * @param {HTMLElement} modalElement - The modal element to release focus from
 */
export function releaseFocus(modalElement) {
  if (!modalElement) return;

  const handler = focusTrapHandlers.get(modalElement);
  if (handler) {
    modalElement.removeEventListener('keydown', handler);
    focusTrapHandlers.delete(modalElement);
  }
}

/**
 * Store the currently focused element before opening a modal
 */
export function saveFocus() {
  focusHistory.push(document.activeElement);
}

/**
 * Restore focus to the previously focused element
 */
export function restoreFocus() {
  const previousFocus = focusHistory.pop();
  if (previousFocus && typeof previousFocus.focus === 'function') {
    requestAnimationFrame(() => {
      previousFocus.focus();
    });
  }
}

/**
 * Update ARIA attributes for modal visibility
 * @param {HTMLElement} modalElement - The modal element
 * @param {boolean} isVisible - Whether the modal is visible
 */
export function updateModalAria(modalElement, isVisible) {
  if (!modalElement) return;
  
  modalElement.setAttribute('aria-hidden', !isVisible);
  
  if (isVisible) {
    // Set focus to modal
    const firstFocusable = modalElement.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
      requestAnimationFrame(() => {
        firstFocusable.focus();
      });
    }
  }
}

// =====================================================================
// STRING UTILITIES
// =====================================================================

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string|null|undefined} str - String to escape
 * @returns {string} Escaped string safe for HTML rendering
 */
export function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escape HTML attribute values to prevent XSS attacks
 * @param {string|null|undefined} str - String to escape
 * @returns {string} Escaped string safe for HTML attributes
 */
export function escapeAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =====================================================================
// FORM VALIDATION UTILITIES
// =====================================================================

/**
 * Show validation error on an input element
 * @param {HTMLElement} input - Input element to show error on
 * @param {string} message - Error message to display
 */
export function showInputError(input, message) {
  if (!input) return;
  
  // Remove success state
  input.classList.remove('is-valid');
  input.classList.add('is-invalid');
  
  // Find parent container for error message
  const parent = input.parentElement;
  
  // Add or update error message (after parent container)
  let errorMsg = parent.nextElementSibling;
  if (!errorMsg || !errorMsg.classList.contains('error-message')) {
    errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    parent.parentElement.insertBefore(errorMsg, parent.nextSibling);
  }
  errorMsg.textContent = message;
  errorMsg.classList.add('show');
  
  // Remove success message if exists
  const successMsg = parent.nextElementSibling;
  if (successMsg && successMsg.classList.contains('success-message')) {
    successMsg.classList.remove('show');
  }
}

/**
 * Show validation success on an input element
 * @param {HTMLElement} input - Input element to show success on
 * @param {string} message - Success message to display (optional)
 */
export function showInputSuccess(input, message = null) {
  if (!input) return;
  
  // Remove error state
  input.classList.remove('is-invalid');
  input.classList.add('is-valid');
  
  // Find parent container
  const parent = input.parentElement;
  
  // Remove error message
  const errorMsg = parent.nextElementSibling;
  if (errorMsg && errorMsg.classList.contains('error-message')) {
    errorMsg.classList.remove('show');
  }
  
  // Add or update success message if provided
  if (message) {
    let successMsg = parent.nextElementSibling;
    if (!successMsg || !successMsg.classList.contains('success-message')) {
      successMsg = document.createElement('div');
      successMsg.className = 'success-message';
      parent.parentElement.insertBefore(successMsg, parent.nextSibling);
    }
    successMsg.textContent = message;
    successMsg.classList.add('show');
  }
}

/**
 * Clear validation state from an input element
 * @param {HTMLElement} input - Input element to clear validation from
 */
export function clearInputValidation(input) {
  if (!input) return;
  
  input.classList.remove('is-invalid', 'is-valid');
  
  const parent = input.parentElement;
  if (parent) {
    // Check next sibling for error/success messages
    const nextSibling = parent.nextElementSibling;
    if (nextSibling) {
      if (nextSibling.classList.contains('error-message')) {
        nextSibling.classList.remove('show');
      }
      if (nextSibling.classList.contains('success-message')) {
        nextSibling.classList.remove('show');
      }
    }
  }
}

/**
 * Validate an input element and show appropriate feedback
 * @param {HTMLElement} input - Input element to validate
 * @param {Function} validator - Validation function that returns { valid: boolean, message?: string }
 * @returns {boolean} True if valid, false otherwise
 */
export function validateInput(input, validator) {
  if (!input || !validator) return true;
  
  const result = validator(input.value);
  
  if (result.valid) {
    showInputSuccess(input, result.message);
    return true;
  } else {
    showInputError(input, result.message || 'Invalid input');
    return false;
  }
}

