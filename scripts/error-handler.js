// =====================================================================
// --- ERROR HANDLING UTILITIES (error-handler.js) ---
// =====================================================================
// Centralized error handling with user-friendly messages and retry logic
// =====================================================================

import { showToast } from './toast.js';

/**
 * Get user-friendly error message from error object
 * @param {Error|Object} error - The error object
 * @param {string} context - Context of the error (e.g., "loading anime data")
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyErrorMessage(error, context = 'operation') {
  // Handle network errors (fetch failures, connection errors)
  if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
    return `Network error: Unable to connect to the server. Please check your internet connection and try again.`;
  }
  
  // Handle fetch errors that don't have status (network failures)
  if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
    return `Network error: Unable to connect to the server. Please check your internet connection and try again.`;
  }

  // Handle HTTP errors
  if (error.statusCode || error.status) {
    const status = error.statusCode || error.status;
    
    switch (status) {
      case 400:
        return error.message || `Invalid request. Please check your input and try again.`;
      case 401:
        return `Your session has expired. Please log in again.`;
      case 403:
        return `You don't have permission to perform this action.`;
      case 404:
        return `The requested resource was not found.`;
      case 409:
        return error.message || `This action conflicts with existing data. Please refresh and try again.`;
      case 429:
        return `Too many requests. Please wait a moment and try again.`;
      case 500:
      case 502:
      case 503:
      case 504:
        return `Server error: The server is temporarily unavailable. Please try again in a moment.`;
      default:
        return error.message || `An error occurred (${status}). Please try again.`;
    }
  }

  // Handle validation errors
  if (error.validationErrors && Array.isArray(error.validationErrors)) {
    return `Invalid data: ${error.validationErrors.join(', ')}`;
  }

  // Handle specific error messages
  if (error.message) {
    // Check for common error patterns
    if (error.message.includes('session') || error.message.includes('unauthorized')) {
      return `Your session has expired. Please log in again.`;
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return `Network error: Unable to connect to the server. Please check your internet connection.`;
    }
    if (error.message.includes('timeout')) {
      return `Request timed out. Please try again.`;
    }
    
    // Return the error message if it's already user-friendly
    return error.message;
  }

  // Generic fallback
  return `An error occurred while ${context}. Please try again.`;
}

/**
 * Check if error is retryable
 * @param {Error|Object} error - The error object
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(error) {
  // Network errors are retryable
  if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
    return true;
  }
  
  // Fetch failures without status
  if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
    return true;
  }

  // 5xx server errors are retryable
  const status = error.statusCode || error.status;
  if (status >= 500 && status < 600) {
    return true;
  }

  // 429 (rate limit) is retryable
  if (status === 429) {
    return true;
  }

  // Timeout errors are retryable
  if (error.message && error.message.includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Check if error indicates session expiry
 * @param {Error|Object} error - The error object
 * @returns {boolean} True if session expired
 */
export function isSessionExpired(error) {
  const status = error.statusCode || error.status;
  if (status === 401) return true;
  
  const message = error.message?.toLowerCase() || '';
  if (message.includes('session') || message.includes('unauthorized') || message.includes('login')) {
    return true;
  }
  
  return false;
}

/**
 * Handle error with user feedback
 * @param {Error|Object} error - The error object
 * @param {string} context - Context of the error
 * @param {Object} options - Options: { showToast, showError, onRetry, retryable }
 */
export function handleError(error, context = 'operation', options = {}) {
  const {
    showToast: showToastOption = true,
    showError: showErrorOption = null,
    onRetry = null,
    retryable = null
  } = options;

  const message = getUserFriendlyErrorMessage(error, context);
  const canRetry = retryable !== null ? retryable : isRetryableError(error);
  const sessionExpired = isSessionExpired(error);

  // Log error for debugging
  console.error(`[Error Handler] ${context}:`, {
    error,
    message,
    canRetry,
    sessionExpired
  });

  // Show toast notification
  if (showToastOption) {
    showToast(message, 'error', 5000);
  }

  // Show error in UI element if provided
  if (showErrorOption) {
    if (typeof showErrorOption === 'function') {
      showErrorOption(message);
    } else if (showErrorOption.textContent !== undefined) {
      showErrorOption.textContent = message;
      showErrorOption.classList.remove('hidden');
    }
  }

  // Handle session expiry
  if (sessionExpired) {
    // Redirect to login after a delay
    setTimeout(() => {
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }, 2000);
  }

  // Return error info for further handling
  return {
    message,
    canRetry,
    sessionExpired,
    error
  };
}

/**
 * Create a retry button element
 * @param {Function} retryFn - Function to call on retry
 * @returns {HTMLElement} Retry button element
 */
export function createRetryButton(retryFn) {
  const button = document.createElement('button');
  button.className = 'btn-primary retry-btn';
  button.textContent = 'Retry';
  button.onclick = () => {
    button.disabled = true;
    button.textContent = 'Retrying...';
    retryFn().finally(() => {
      button.disabled = false;
      button.textContent = 'Retry';
    });
  };
  return button;
}

/**
 * Wrap an API call with error handling and retry logic
 * @param {Function} apiCall - Async function that makes the API call
 * @param {Object} options - Options: { context, maxRetries, showToast, showError, onRetry }
 * @returns {Promise} Promise that resolves with the API response
 */
export async function withErrorHandling(apiCall, options = {}) {
  const {
    context = 'API call',
    maxRetries = 3,
    showToast: showToastOption = true,
    showError: showErrorOption = null,
    onRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's not a retryable error or we've exhausted retries
      if (!isRetryableError(error) || attempt === maxRetries) {
        const errorInfo = handleError(error, context, {
          showToast: showToastOption,
          showError: showErrorOption,
          retryable: false
        });
        
        // If retryable and onRetry callback provided, show retry button
        if (isRetryableError(error) && attempt < maxRetries && onRetry) {
          onRetry(errorInfo);
        }
        
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      
      if (showToastOption && attempt < maxRetries) {
        showToast(
          `Retrying ${context}... (attempt ${attempt + 1}/${maxRetries})`,
          'info',
          2000
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

