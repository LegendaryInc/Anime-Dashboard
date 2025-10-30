// =====================================================================
// --- VALIDATION UTILITIES (validation.js) ---
// =====================================================================
// Centralized validation and error handling for API responses.
// =====================================================================

import { 
  validateGachaStateResponse, 
  validateGachaRollResponse,
  validateTokenCalculationResponse,
  validatePackPurchaseResponse,
  validateStateBounds,
  sanitizeNumeric
} from './types.js';

/**
 * Validates an API response and throws descriptive errors.
 * @template T
 * @param {Response} response - Fetch response object.
 * @param {Function} validator - Validation function from types.js.
 * @returns {Promise<T>} Validated data.
 * @throws {ValidationError} If validation fails.
 */
export async function validateApiResponse(response, validator) {
  // Check HTTP status
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ValidationError(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      'HTTP_ERROR'
    );
  }
  
  // Parse JSON
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new ValidationError(
      'Invalid JSON response from server',
      500,
      'PARSE_ERROR',
      error
    );
  }
  
  // Validate structure
  const validation = validator(data);
  if (!validation.valid) {
    throw new ValidationError(
      `Invalid response structure: ${validation.errors.join(', ')}`,
      500,
      'VALIDATION_ERROR',
      null,
      validation.errors
    );
  }
  
  // Check bounds
  if (validation.data.tokens !== undefined) {
    const boundsCheck = validateStateBounds(validation.data);
    if (!boundsCheck.valid) {
      console.warn('⚠️ State bounds warning:', boundsCheck.warnings);
    }
  }
  
  return validation.data;
}

/**
 * Custom validation error class.
 */
export class ValidationError extends Error {
  constructor(message, statusCode = 500, code = 'VALIDATION_ERROR', originalError = null, validationErrors = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
    this.code = code;
    this.originalError = originalError;
    this.validationErrors = validationErrors;
    this.timestamp = new Date().toISOString();
  }
  
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      validationErrors: this.validationErrors,
      timestamp: this.timestamp
    };
  }
}

/**
 * Wraps an API call with retry logic and exponential backoff.
 * @template T
 * @param {Function} apiFn - Async function that makes the API call.
 * @param {Object} options - Retry options.
 * @returns {Promise<T>}
 */
export async function withRetry(
  apiFn, 
  options = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error) => error.statusCode >= 500 || error.code === 'NETWORK_ERROR'
  }
) {
  const { maxRetries, baseDelay, maxDelay, shouldRetry } = options;
  
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's not a retryable error
      if (!shouldRetry(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      console.warn(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Detects if error is due to session expiry.
 * @param {Error} error - The error to check.
 * @returns {boolean}
 */
export function isSessionExpired(error) {
  if (error.statusCode === 401) return true;
  if (error.message?.includes('session') || error.message?.includes('unauthorized')) return true;
  if (error.message?.includes('<!DOCTYPE')) return true; // HTML response instead of JSON
  return false;
}
/**
 * Sanitizes gacha state from potentially corrupted data.
 * @param {any} state - The state object to sanitize.
 * @returns {Object} Sanitized state.
 */
export function sanitizeGachaState(state) {
  return {
    tokens: sanitizeNumeric(state?.tokens, 0, 10000, 0),
    shards: sanitizeNumeric(state?.shards, 0, 100000, 0),
    collection: Array.isArray(state?.collection) ? state.collection.filter(card => 
      card && typeof card === 'object' && card.id && card.name
    ) : [],
    appliedCosmetics: typeof state?.appliedCosmetics === 'object' && state.appliedCosmetics !== null 
      ? state.appliedCosmetics 
      : {},
    ownedCosmetics: Array.isArray(state?.ownedCosmetics) 
      ? state.ownedCosmetics.filter(c => typeof c === 'string') 
      : []
  };
}

/**
 * Creates a standardized API error object.
 * @param {Error} error - The caught error.
 * @param {string} context - Context description (e.g., "rolling gacha").
 * @returns {Object} Standardized error object.
 */
export function createErrorResponse(error, context) {
  return {
    success: false,
    error: error.message || 'An unknown error occurred',
    context,
    code: error.code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
    shouldRetry: error.statusCode >= 500,
    isSessionExpired: isSessionExpired(error)
  };
}

/**
 * Logs detailed error information for debugging.
 * @param {Error} error - The error to log.
 * @param {string} operation - Operation that failed.
 * @param {Object} metadata - Additional metadata.
 */
export function logError(error, operation, metadata = {}) {
  console.error(`❌ Error in ${operation}:`, {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    validationErrors: error.validationErrors,
    timestamp: error.timestamp,
    metadata
  });
}

export default {
  validateApiResponse,
  ValidationError,
  withRetry,
  isSessionExpired,
  sanitizeGachaState,
  createErrorResponse,
  logError
};