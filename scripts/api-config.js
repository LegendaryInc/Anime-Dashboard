// API Configuration
// This file handles API calls when frontend and backend are separated
// Works in both local development (Vite proxy) and production (separate domains)

/**
 * Check if we're in local development mode
 */
const isLocalDevelopment = () => {
  // Check if we're on localhost with Vite dev server (port 3001)
  return window.location.hostname === 'localhost' && 
         (window.location.port === '3001' || window.location.port === '');
};

/**
 * Get API base URL from config or environment
 */
const getApiBase = () => {
  // In local development, use relative paths (Vite proxy handles it)
  if (isLocalDevelopment()) {
    return ''; // Empty string = relative paths, Vite proxy will handle it
  }
  
  // In production, check if config.js is loaded
  if (window.CONFIG && window.CONFIG.API_BASE) {
    return window.CONFIG.API_BASE;
  }
  
  // Fallback (shouldn't happen in production)
  return process.env.API_BASE || '';
};

/**
 * Helper function to make API calls with proper configuration and automatic retry
 * Handles Render cold starts automatically with exponential backoff
 * @param {string} path - API path (e.g., '/api/get-anilist-data')
 * @param {object} options - Fetch options
 * @param {object} retryOptions - Retry options: { maxRetries, baseDelay, maxDelay }
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}, retryOptions = {}) {
  const {
    maxRetries = 3,
    baseDelay = 2000, // Start with 2s delay for cold starts
    maxDelay = 30000 // Max 30s delay
  } = retryOptions;

  const apiBase = getApiBase();
  
  // Build URL
  let url;
  if (apiBase) {
    // Production: use absolute URL
    url = path.startsWith('/') ? `${apiBase}${path}` : `${apiBase}/${path}`;
  } else {
    // Local development: use relative path (Vite proxy handles it)
    url = path.startsWith('/') ? path : `/${path}`;
  }
  
  // Add credentials for cookies/sessions
  // In local dev, this works because Vite proxy forwards cookies
  // In production, this works because CORS is configured
  const fetchOptions = {
    ...options,
    credentials: 'include', // Important for cookies/sessions
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  // Retry logic for network errors (handles Render cold starts)
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      
      // If we get a 502/503/504 (gateway errors, often from cold starts), retry
      if (response.status >= 502 && response.status <= 504 && attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`🔄 Retrying API call (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms due to ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Check if it's a network error (cold start, connection refused, etc.)
      const isNetworkError = 
        error instanceof TypeError && 
        (error.message.includes('fetch') || 
         error.message.includes('network') || 
         error.message.includes('Failed to fetch'));
      
      // Retry network errors
      if (isNetworkError && attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`🔄 Retrying API call (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms due to network error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not retryable or out of retries, throw
      throw error;
    }
  }
  
  // Should never reach here, but just in case
  throw lastError || new Error('API call failed after retries');
}

// Export API base for direct use
export const API_BASE = getApiBase();

