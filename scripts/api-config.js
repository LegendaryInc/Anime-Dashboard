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
 * Helper function to make API calls with proper configuration
 * @param {string} path - API path (e.g., '/api/get-anilist-data')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export function apiFetch(path, options = {}) {
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
  
  return fetch(url, fetchOptions);
}

// Export API base for direct use
export const API_BASE = getApiBase();

