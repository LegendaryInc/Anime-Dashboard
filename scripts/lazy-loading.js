// =====================================================================
// --- LAZY LOADING MODULE (lazy-loading.js) ---
// =====================================================================
// Enhanced lazy loading for images with Intersection Observer
// =====================================================================

// =====================================================================
// CONFIGURATION
// =====================================================================

const LAZY_LOAD_CONFIG = {
  rootMargin: '50px', // Start loading 50px before image enters viewport
  threshold: 0.01, // Trigger when 1% of image is visible
  placeholder: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450"%3E%3Crect fill="%231f2937" width="300" height="450"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%2394a3b8" font-family="monospace" font-size="14"%3ELoading...%3C/text%3E%3C/svg%3E'
};

// =====================================================================
// INTERSECTION OBSERVER
// =====================================================================

let observer = null;

/**
 * Initialize lazy loading observer
 */
function initLazyLoadingObserver() {
  // Check if Intersection Observer is supported
  if (!('IntersectionObserver' in window)) {
    console.warn('⚠️ Intersection Observer not supported, using native lazy loading');
    return;
  }

  // Create observer with configuration
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: LAZY_LOAD_CONFIG.rootMargin,
    threshold: LAZY_LOAD_CONFIG.threshold
  });

  console.log('🖼️ Lazy loading observer initialized');
}

/**
 * Load an image with error handling
 */
function loadImage(img) {
  const src = img.dataset.src || img.dataset.lazySrc;
  if (!src) {
    console.warn('Lazy loading: No data-src found for image', img);
    return;
  }

  // Skip if already loading or loaded
  if (img.dataset.loading === 'true' || img.classList.contains('lazy-loaded')) {
    return;
  }

  // Mark as loading
  img.dataset.loading = 'true';
  img.classList.add('lazy-loading');
  
  // Create new image to preload
  const tempImg = new Image();
  
  tempImg.onload = () => {
    img.src = src;
    img.classList.remove('lazy-loading');
    img.classList.add('lazy-loaded');
    img.dataset.loading = 'false';
    
    // Remove data attributes after successful load
    delete img.dataset.src;
    delete img.dataset.lazySrc;
  };
  
  tempImg.onerror = () => {
    const errorSrc = img.dataset.errorSrc || 'https://placehold.co/300x450/1f2937/94a3b8?text=No+Image';
    img.src = errorSrc;
    img.classList.remove('lazy-loading');
    img.classList.add('lazy-error');
    img.dataset.loading = 'false';
    
    // Remove data attributes even on error to prevent retry loops
    delete img.dataset.src;
    delete img.dataset.lazySrc;
  };
  
  tempImg.src = src;
}

// =====================================================================
// PUBLIC API
// =====================================================================

/**
 * Initialize lazy loading for all images on the page
 */
export function initLazyLoading() {
  initLazyLoadingObserver();
  
  if (observer) {
    // Find all images with data-src or data-lazy-src
    const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src]');
    lazyImages.forEach(img => {
      // Set placeholder
      if (!img.src || img.src === '') {
        img.src = LAZY_LOAD_CONFIG.placeholder;
      }
      observer.observe(img);
    });
  }
}

/**
 * Process new images added to the DOM (for dynamic content)
 */
export function observeNewImages(container = document) {
  if (!observer) {
    // If observer not initialized, try to initialize it
    initLazyLoadingObserver();
    if (!observer) return;
  }

  // Use requestAnimationFrame to ensure DOM is laid out before checking viewport
  requestAnimationFrame(() => {
    const lazyImages = container.querySelectorAll('img[data-src], img[data-lazy-src]');
    lazyImages.forEach(img => {
      // Skip if already observed, already loaded, or no data-src
      if (img.dataset.observed || !img.dataset.src || img.classList.contains('lazy-loaded')) {
        return;
      }
      
      img.dataset.observed = 'true';
      
      // Ensure placeholder is set if needed
      if (!img.src || img.src === '' || img.src.startsWith('data:image/svg+xml')) {
        // Keep existing placeholder if it's already a valid SVG
        if (!img.src || img.src === '') {
          img.src = LAZY_LOAD_CONFIG.placeholder;
        }
      }
      
      // Always observe the image - let Intersection Observer handle when to load
      // This ensures consistent behavior regardless of timing
      observer.observe(img);
      
      // Also check if already in viewport and trigger load immediately
      // Use a small delay to ensure layout is complete
      setTimeout(() => {
        const rect = img.getBoundingClientRect();
        const isInViewport = rect.top < window.innerHeight + 100 && 
                             rect.bottom > -100 && 
                             rect.left < window.innerWidth + 100 && 
                             rect.right > -100;
        
        // If in viewport and still has data-src, load immediately
        if (isInViewport && img.dataset.src && !img.classList.contains('lazy-loaded')) {
          loadImage(img);
        }
      }, 50);
    });
  });
}

/**
 * Convert regular img tags to lazy-loading format
 * @param {string} html - HTML string with img tags
 * @returns {string} - HTML with lazy-loading attributes
 */
export function convertToLazyLoad(html) {
  if (!html) return html;

  return html
    // Match img tags with src attribute
    .replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, before, src, after) => {
      // Skip if already has lazy-loading attributes
      if (match.includes('data-src') || match.includes('data-lazy-src')) {
        return match;
      }
      
      // Skip if already has loading="lazy" (native lazy loading)
      if (match.includes('loading="lazy"')) {
        // Convert to data-src for better control
        return match
          .replace(/src=["']([^"']+)["']/, 'data-src="$1"')
          .replace(/loading="lazy"/, '')
          .replace(/>$/, ' src="' + LAZY_LOAD_CONFIG.placeholder + '">');
      }
      
      // Convert src to data-src and add placeholder
      return match
        .replace(/src=["']([^"']+)["']/, `data-src="$1"`)
        .replace(/>$/, ` src="${LAZY_LOAD_CONFIG.placeholder}">`);
    })
    // Ensure loading="lazy" is removed (we handle it with Intersection Observer)
    .replace(/\s+loading=["']lazy["']/gi, '');
}

/**
 * Force load an image immediately (for above-the-fold content)
 */
export function loadImageImmediately(img) {
  if (img.dataset.src || img.dataset.lazySrc) {
    loadImage(img);
    if (observer) {
      observer.unobserve(img);
    }
  }
}

/**
 * Clean up observer
 */
export function cleanupLazyLoading() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Initialize on module load
if (typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyLoading);
  } else {
    initLazyLoading();
  }
}

