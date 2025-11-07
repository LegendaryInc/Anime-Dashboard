// =====================================================================
// --- AIRING SCHEDULE MODULE (airing.js) ---
// =====================================================================
// Real-time countdown timers, notifications, and Jikan streaming links
// =====================================================================

import { showToast } from './toast.js';
import { observeNewImages } from './lazy-loading.js';

// Lazy import for custom lists (to avoid circular dependencies)
let renderAddToListButton = null;
async function getAddToListButton(animeId) {
  if (!renderAddToListButton) {
    const module = await import('./custom-lists-view.js');
    renderAddToListButton = module.renderAddToListButton;
  }
  if (renderAddToListButton) {
    return renderAddToListButton(animeId);
  }
  return ''; // Return empty if not available
}

/**
 * Populate "Add to List" buttons in placeholders
 */
async function populateAddToListButtons() {
  const placeholders = document.querySelectorAll('.add-to-list-placeholder');
  if (placeholders.length === 0) return;
  
  // Load custom lists first
  try {
    const { loadCustomLists } = await import('./custom-lists.js');
    await loadCustomLists();
  } catch (error) {
    console.warn('Could not load custom lists:', error);
  }
  
  // Populate each placeholder
  for (const placeholder of placeholders) {
    // Check if placeholder is still in the DOM
    if (!placeholder.parentNode) continue;
    
    const animeId = parseInt(placeholder.dataset.animeId);
    if (animeId) {
      try {
        const buttonHtml = await getAddToListButton(animeId);
        if (buttonHtml && placeholder.parentNode) {
          placeholder.outerHTML = buttonHtml;
        }
      } catch (error) {
        console.warn('Could not populate add to list button:', error);
      }
    }
  }
}

// --- State Management ---
let countdownIntervals = new Map();
let notificationInterval = null; // Store notification interval for cleanup
let notificationPermission = 'default';
let notificationSettings = {
  enabled: false,
  notifyMinutesBefore: 5,
  enabledAnime: new Set()
};

// Streaming links cache (MAL ID -> links)
const streamingLinksCache = new Map();

// Load settings from localStorage
function loadNotificationSettings() {
  try {
    const saved = localStorage.getItem('airingNotifications');
    if (saved) {
      const parsed = JSON.parse(saved);
      notificationSettings.enabled = parsed.enabled ?? false;
      notificationSettings.notifyMinutesBefore = parsed.notifyMinutesBefore ?? 5;
      notificationSettings.enabledAnime = new Set(parsed.enabledAnime || []);
    }
  } catch (e) {
    console.error('Failed to load notification settings:', e);
  }
}

// Save settings to localStorage
function saveNotificationSettings() {
  try {
    localStorage.setItem('airingNotifications', JSON.stringify({
      enabled: notificationSettings.enabled,
      notifyMinutesBefore: notificationSettings.notifyMinutesBefore,
      enabledAnime: Array.from(notificationSettings.enabledAnime)
    }));
  } catch (e) {
    console.error('Failed to save notification settings:', e);
  }
}

// --- Time Formatting Utilities ---

function formatAbsolute(ts) {
  const ms = ts < 2e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  const time = d.toLocaleTimeString(undefined, { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
  return `${date}, ${time}`;
}

function formatRelativeCountdown(ts) {
  const ms = ts < 2e12 ? ts * 1000 : ts;
  const now = Date.now();
  const diff = Math.max(0, ms - now);
  
  if (diff === 0) return { text: 'Airing now!', urgent: true, finished: true };
  
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  let urgent = false;
  
  if (days > 0) {
    parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
  } else if (hours > 0) {
    parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
    if (minutes < 60) parts.push(`${seconds}s`);
    urgent = minutes < 5;
  } else {
    parts.push(`${seconds}s`);
    urgent = true;
  }
  
  return {
    text: parts.join(' '),
    urgent,
    finished: false,
    totalSeconds
  };
}

function getNextAiring(anime) {
  const ts = anime?.airingSchedule?.airingAt ?? 
             anime?.nextAiringEpisode?.airingAt ?? 
             anime?.nextEpisode?.airingAt ?? 
             null;
  
  const episode = anime?.airingSchedule?.episode ?? 
                  anime?.nextAiringEpisode?.episode ?? 
                  anime?.nextEpisode?.number ?? 
                  null;
  
  if (!ts) return null;
  return { ts, episode };
}

// --- Streaming Links Functions ---

/**
 * Generate fallback free streaming site URLs (always available)
 */
function getFallbackStreamingUrls(anime) {
  const title = anime.title || 'Unknown';
  const searchQuery = encodeURIComponent(title);
  
  // Create URL-safe slug (improved)
  let slug = title
    .toLowerCase()
    .replace(/['"]/g, '')  // Remove quotes
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars except hyphens
    .replace(/\s+/g, '-')  // Replace spaces with hyphens
    .replace(/-+/g, '-')  // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')  // Remove leading/trailing hyphens
    .trim();

  // Create alternative slug (without common words that might not be in URLs)
  const altSlug = slug
    .replace(/\b(season|s|part|p|vol|volume|episode|ep)\b/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();

  // Use alternative slug if it's significantly shorter (more likely to match)
  const finalSlug = altSlug.length < slug.length * 0.7 ? altSlug : slug;
  
  return {
    // HiAnime: Use search (most reliable - can't get site-specific IDs from Jikan)
    hianime: `https://hianime.to/search?keyword=${searchQuery}`,
    // Gogoanime: Use search (most reliable)
    gogoanime: `https://gogoanime3.co/search.html?keyword=${searchQuery}`,
    // AnimePahe: Use search (most reliable)
    animepahe: `https://animepahe.ru/search?q=${searchQuery}`,
    // AniWave: Use search (most reliable)
    aniwave: `https://aniwave.to/search?q=${searchQuery}`,
    // AnimixPlay: Uses search (most reliable)
    animixplay: `https://animixplay.to/?q=${searchQuery}`,
  };
}

/**
 * Fetch streaming links from backend (which calls Jikan)
 */
async function fetchStreamingLinks(malId, title) {
  // Ensure malId is a number for consistent lookups
  const malIdNum = typeof malId === 'string' ? parseInt(malId, 10) : malId;
  
  // Check cache first
  if (malIdNum && !isNaN(malIdNum) && streamingLinksCache.has(malIdNum)) {
    return streamingLinksCache.get(malIdNum);
  }

  try {
    const response = await fetch(`/api/streaming/${malId}?title=${encodeURIComponent(title)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache the result (use malIdNum for consistency)
    if (malIdNum && !isNaN(malIdNum)) {
      streamingLinksCache.set(malIdNum, data);
    }
    
    return data;
  } catch (error) {
    console.warn(`⚠️ Could not fetch streaming links for ${title}:`, error.message);
    
    // Return fallback links
    return {
      malId: malIdNum || malId,
      title,
      free: getFallbackStreamingUrls({ title, idMal: malId }),
      official: [],
      error: error.message
    };
  }
}

/**
 * Get streaming links for an anime (tries Jikan, falls back to free sites)
 */
async function getStreamingLinks(anime) {
  const malId = anime.idMal || anime.malId;
  const title = anime.title || 'Unknown';
  
  // If no MAL ID, just return fallback links
  if (!malId) {
    return {
      malId: null,
      title,
      free: getFallbackStreamingUrls(anime),
      official: [],
      error: 'No MAL ID available'
    };
  }
  
  // Fetch from API (will use cache if available)
  return await fetchStreamingLinks(malId, title);
}

/**
 * Batch fetch streaming links for multiple anime (on tab load)
 */
async function batchFetchStreamingLinks(animeList) {
  const validAnime = animeList.filter(a => a.idMal || a.malId);
  
  if (validAnime.length === 0) {
    return {};
  }
  
  try {
    const response = await fetch('/api/streaming/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        animeList: validAnime.map(a => ({
          idMal: a.idMal || a.malId,
          title: a.title
        }))
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data || !Array.isArray(data.results)) {
      console.error('⚠️ Invalid batch streaming response structure:', data);
      return [];
    }
    
    // Cache all results
    console.log(`📦 Batch streaming results received:`, data.results.length);
    data.results.forEach(result => {
      if (result && result.malId) {
        // Ensure malId is a number for consistent lookups
        const malIdNum = typeof result.malId === 'string' ? parseInt(result.malId, 10) : result.malId;
        if (!isNaN(malIdNum)) {
          streamingLinksCache.set(malIdNum, result);
          console.log(`  ✅ Cached streaming links for MAL ID ${malIdNum}: ${result.official?.length || 0} official, free sites available`);
        } else {
          console.warn(`  ⚠️ Invalid malId in result:`, result);
        }
      } else {
        console.warn(`  ⚠️ Result missing malId:`, result);
      }
    });
    
    return data.results;
  } catch (error) {
    console.error('❌ Failed to batch fetch streaming links:', error);
    return [];
  }
}

// --- Notification System ---

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported in this browser', 'error');
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    
    if (permission === 'granted') {
      showToast('Notifications enabled! You\'ll be alerted when episodes air', 'success');
      return true;
    } else if (permission === 'denied') {
      showToast('Notification permission denied. Enable in browser settings.', 'error');
      return false;
    }
  } catch (e) {
    console.error('Notification permission error:', e);
    return false;
  }
  return false;
}

function showNotification(title, body, icon) {
  if (!('Notification' in window) || notificationPermission !== 'granted') return;
  
  try {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'anime-airing',
      requireInteraction: false
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    setTimeout(() => notification.close(), 10000);
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
}

function checkForNotifications(animeList) {
  if (!notificationSettings.enabled) return;
  
  const now = Date.now();
  const notifyThreshold = notificationSettings.notifyMinutesBefore * 60 * 1000;
  
  animeList.forEach(anime => {
    const airingInfo = getNextAiring(anime);
    if (!airingInfo) return;
    
    const title = anime.title || 'Unknown';
    
    if (!notificationSettings.enabledAnime.has(title)) return;
    
    const airingTime = airingInfo.ts < 2e12 ? airingInfo.ts * 1000 : airingInfo.ts;
    const timeUntil = airingTime - now;
    
    const notificationKey = `notified_${title}_${airingInfo.episode}`;
    const alreadyNotified = sessionStorage.getItem(notificationKey);
    
    if (timeUntil > 0 && timeUntil <= notifyThreshold && !alreadyNotified) {
      const minutesUntil = Math.floor(timeUntil / 60000);
      showNotification(
        `${title} - Episode ${airingInfo.episode}`,
        `Airing in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}!`,
        anime.coverImage
      );
      sessionStorage.setItem(notificationKey, 'true');
    }
    
    if (timeUntil <= 0 && timeUntil > -60000 && !alreadyNotified) {
      showNotification(
        `${title} - Episode ${airingInfo.episode}`,
        'Episode is now airing!',
        anime.coverImage
      );
      sessionStorage.setItem(notificationKey, 'true');
    }
  });
}

// --- Real-Time Countdown System ---

function startCountdown(elementId, timestamp, callback) {
  if (countdownIntervals.has(elementId)) {
    clearInterval(countdownIntervals.get(elementId));
  }
  
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const updateCountdown = () => {
    const countdown = formatRelativeCountdown(timestamp);
    element.textContent = countdown.text;
    
    if (countdown.urgent) {
      element.classList.add('countdown-urgent');
    } else {
      element.classList.remove('countdown-urgent');
    }
    
    if (callback) callback(countdown);
    
    if (countdown.finished) {
      clearInterval(countdownIntervals.get(elementId));
      countdownIntervals.delete(elementId);
      element.classList.add('countdown-finished');
    }
  };
  
  updateCountdown();
  
  const interval = setInterval(updateCountdown, 1000);
  countdownIntervals.set(elementId, interval);
}

function stopAllCountdowns() {
  countdownIntervals.forEach(interval => clearInterval(interval));
  countdownIntervals.clear();
}

// --- Render Watching Tab ---

/**
 * Render a single anime card (used for progressive updates)
 */
function renderAnimeCard(anime, index, streamingInfo = null, statusType = null) {
  const airingInfo = getNextAiring(anime);
  const title = anime.title || 'Unknown';
  const progress = anime.episodesWatched ?? anime.progress ?? 0;
  const img = anime.coverImage || 'https://placehold.co/70x140/1f2937/94a3b8?text=No+Image';
  const countdownId = `countdown-${index}`;
  const isNotifyEnabled = notificationSettings.enabledAnime.has(title);
  
  // Determine status type if not provided
  if (!statusType) {
    const status = (anime.status || '').toLowerCase();
    if (status === 'repeating' || status === 're-watching') {
      statusType = 'rewatching';
    } else if (status === 'planning' || status === 'plan to watch') {
      statusType = 'planning';
    } else {
      statusType = 'watching';
    }
  }
  
  const isRewatching = statusType === 'rewatching';
  const isPlanning = statusType === 'planning';
  
  const malId = anime.idMal || anime.malId;
  const malIdNum = malId ? (typeof malId === 'string' ? parseInt(malId, 10) : malId) : null;
  
  // Use provided streaming info or get from cache, or use fallback
  if (!streamingInfo) {
    if (malIdNum && streamingLinksCache.has(malIdNum)) {
      streamingInfo = streamingLinksCache.get(malIdNum);
    } else {
      streamingInfo = { free: getFallbackStreamingUrls(anime), official: [] };
    }
  }
  
  const freeLinks = streamingInfo.free || getFallbackStreamingUrls(anime);
  const officialLinks = streamingInfo.official || [];
  
  let airingHTML = '';
  if (airingInfo) {
    const absoluteTime = formatAbsolute(airingInfo.ts);
    airingHTML = `
      <div class="watch-airing">
        <div class="watch-airing-header">
          <span class="watch-episode-label">Next: Episode ${airingInfo.episode}</span>
          ${notificationSettings.enabled ? `
            <button 
              class="notify-toggle-btn ${isNotifyEnabled ? 'notify-enabled' : ''}" 
              data-anime-title="${title.replace(/"/g, '&quot;')}"
              title="${isNotifyEnabled ? 'Disable notifications' : 'Enable notifications'}">
              🔔
            </button>
          ` : ''}
        </div>
        <div class="countdown-timer" id="${countdownId}">Loading...</div>
        <div class="watch-absolute-time">${absoluteTime}</div>
      </div>`;
  }
  
  // Build streaming links section - different for PTW vs Watching
  const isLoading = streamingInfo === null || (malIdNum && !streamingLinksCache.has(malIdNum));
  let streamingHTML = '';
  
  if (isPlanning) {
    // PTW items: Show "Start Watching" button and basic info
    streamingHTML = `
      <div class="watch-actions">
        <button class="btn-primary start-watching-btn" data-anime-id="${anime.id}" data-anime-title="${title.replace(/"/g, '&quot;')}">
          ▶️ Start Watching
        </button>
        <div class="add-to-list-placeholder" data-anime-id="${anime.id}"></div>
      </div>
      <div class="text-xs mt-2 theme-text-muted">
        ${anime.totalEpisodes ? `${anime.totalEpisodes} episodes` : 'Episodes unknown'} • 
        ${anime.score ? `⭐ ${anime.score}` : 'No score'}
      </div>
    `;
  } else {
    // Watching/Rewatching items: Show streaming links and episode controls
    streamingHTML = `
      <div class="watch-actions">
        ${isLoading ? `
          <button class="btn-watch-now loading" disabled>
            <span class="loading-spinner"></span> Loading links...
          </button>
        ` : `
          <a href="${freeLinks.hianime}" target="_blank" rel="noopener" class="btn-watch-now">
            ▶️ Watch on HiAnime
          </a>
        `}
        <button class="btn-primary add-episode-btn" data-title="${title.replace(/"/g, '&quot;')}" data-watched="${progress}" data-total="${anime.totalEpisodes || 0}">
          +1 Episode
        </button>
        <div class="add-to-list-placeholder" data-anime-id="${anime.id}"></div>
      </div>
      
      <div class="text-xs mt-1">
        ${isLoading ? `
          <div class="opacity-60">
            <span class="loading-skeleton">Loading...</span>
          </div>
        ` : `
          <div class="opacity-60 hover:opacity-100 transition-opacity">
            <a href="${freeLinks.gogoanime}" target="_blank" rel="noopener" class="hover:underline">Gogo</a> • 
            <a href="${freeLinks.animepahe}" target="_blank" rel="noopener" class="hover:underline">Pahe</a> • 
            <a href="${freeLinks.aniwave}" target="_blank" rel="noopener" class="hover:underline">AniWave</a> •
            <a href="${freeLinks.animixplay}" target="_blank" rel="noopener" class="hover:underline">AnimixPlay</a>
          </div>
        `}`;
    
    streamingHTML += `</div>`;
  }
  
  // Check if anime is airing soon (today, tomorrow, or within 3 days)
  let priorityClass = '';
  if (airingInfo && airingInfo.ts) {
    const now = Date.now();
    const airingTime = airingInfo.ts < 2e12 ? airingInfo.ts * 1000 : airingInfo.ts;
    const timeUntilAiring = airingTime - now;
    const daysUntilAiring = timeUntilAiring / (1000 * 60 * 60 * 24);
    
    if (daysUntilAiring < 0) {
      // Already aired today or past
      priorityClass = 'airing-today';
    } else if (daysUntilAiring < 1) {
      // Airing today
      priorityClass = 'airing-today';
    } else if (daysUntilAiring < 2) {
      // Airing tomorrow
      priorityClass = 'airing-tomorrow';
    } else if (daysUntilAiring < 4) {
      // Airing within 3 days
      priorityClass = 'airing-soon';
    }
  }
  
  // Different card styling for PTW
  const cardClass = isPlanning 
    ? `watch-card planning ${isLoading ? 'loading' : ''} ${priorityClass}` 
    : `watch-card ${isRewatching ? 'rewatching' : ''} ${isLoading ? 'loading' : ''} ${priorityClass}`;
  
  // Episode progress indicator
  const totalEpisodes = anime.totalEpisodes || null;
  const progressIndicator = !isPlanning && totalEpisodes 
    ? `<div class="watch-progress-indicator">
         <span class="watch-progress-text">Episode ${progress}/${totalEpisodes}</span>
         <div class="watch-progress-bar">
           <div class="watch-progress-fill" style="width: ${(progress / totalEpisodes) * 100}%"></div>
         </div>
       </div>`
    : !isPlanning 
    ? `<div class="watch-progress-indicator">
         <span class="watch-progress-text">Episode ${progress}</span>
       </div>`
    : '';
  
  return `
    <div class="${cardClass}" data-anime-id="${anime.id}" data-index="${index}">
      <a class="watch-thumb" href="${anime.externalLinks?.[0]?.url || '#'}" target="_blank" rel="noopener">
        <img data-src="${img}" 
             src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 70 140'%3E%3Crect fill='%231f2937' width='70' height='140'/%3E%3C/svg%3E"
             data-error-src="https://placehold.co/70x140/1f2937/94a3b8?text=No+Image"
             alt="${title.replace(/"/g, '&quot;')}" 
             referrerpolicy="no-referrer">
        ${isRewatching ? '<div class="rewatch-badge">🔁 REWATCH</div>' : ''}
        ${isPlanning ? '<div class="planning-badge">📋 PLAN TO WATCH</div>' : ''}
      </a>
      
      <div class="watch-card-content">
        <a class="watch-title" href="${anime.externalLinks?.[0]?.url || '#'}" target="_blank" rel="noopener">
          ${title}
        </a>
        ${progressIndicator}
        
        ${airingHTML}
        ${streamingHTML}
      </div>
    </div>`;
}

/**
 * Get day of week from timestamp
 */
function getDayOfWeekFromTimestamp(timestamp) {
  const date = new Date(timestamp < 2e12 ? timestamp * 1000 : timestamp);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Group anime by day of week
 */
function groupAnimeByDay(animeList) {
  const grouped = {
    'Sunday': [],
    'Monday': [],
    'Tuesday': [],
    'Wednesday': [],
    'Thursday': [],
    'Friday': [],
    'Saturday': [],
    'No Schedule': []
  };
  
  animeList.forEach(anime => {
    const airingInfo = getNextAiring(anime);
    if (airingInfo && airingInfo.ts) {
      const day = getDayOfWeekFromTimestamp(airingInfo.ts);
      if (grouped[day]) {
        grouped[day].push(anime);
      } else {
        grouped['No Schedule'].push(anime);
      }
    } else {
      grouped['No Schedule'].push(anime);
    }
  });
  
  // Sort each day's anime by airing time
  Object.keys(grouped).forEach(day => {
    grouped[day].sort((a, b) => {
      const aTime = getNextAiring(a);
      const bTime = getNextAiring(b);
      if (!aTime) return 1;
      if (!bTime) return -1;
      return aTime.ts - bTime.ts;
    });
  });
  
  return grouped;
}

export async function renderEnhancedWatchingTab(data = []) {
  const container = document.getElementById('watching-content');
  if (!container) return;
  
  stopAllCountdowns();
  
  // Separate into different status groups
  const currentlyWatching = data.filter(a => {
    const status = (a.status || '').toLowerCase();
    return status === 'current' || status === 'watching';
  });
  
  const rewatching = data.filter(a => {
    const status = (a.status || '').toLowerCase();
    return status === 'repeating' || status === 're-watching';
  });
  
  const planToWatch = data.filter(a => {
    const status = (a.status || '').toLowerCase();
    return status === 'planning' || status === 'plan to watch';
  });
  
  // Combine all items into one list, prioritizing currently watching
  const allWatching = [...currentlyWatching, ...rewatching];
  const allItems = [...allWatching, ...planToWatch];
  
  if (allItems.length === 0) {
    container.innerHTML = `
      <div class="watch-empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <p class="text-lg">No anime currently watching or planned</p>
      </div>`;
    return;
  }
  
  // Sort currently watching by airing time
  currentlyWatching.sort((a, b) => {
    const aTime = getNextAiring(a);
    const bTime = getNextAiring(b);
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime.ts - bTime.ts;
  });
  
  // Sort rewatching by airing time
  rewatching.sort((a, b) => {
    const aTime = getNextAiring(a);
    const bTime = getNextAiring(b);
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime.ts - bTime.ts;
  });
  
  // Render all items in a unified grid
  let html = '<div class="watching-grid">';
  let cardIndex = 0;
  
  allItems.forEach(anime => {
    // Determine status type
    const status = (anime.status || '').toLowerCase();
    let statusType = 'watching';
    if (status === 'repeating' || status === 're-watching') {
      statusType = 'rewatching';
    } else if (status === 'planning' || status === 'plan to watch') {
      statusType = 'planning';
    }
    
    html += renderAnimeCard(anime, cardIndex++, null, statusType);
  });
  
  html += '</div>';
  
  console.log('📺 Rendering', allItems.length, 'anime cards (watching + PTW)...');
  container.innerHTML = html;
  
  // Initialize lazy loading for new images after DOM is updated
  // Use double RAF to ensure layout is complete
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      observeNewImages(container);
    });
  });
  
  // Populate "Add to List" buttons
  populateAddToListButtons();
  
  // Setup "Start Watching" buttons for PTW items
  setupStartWatchingButtons();
  
  // Start countdowns for currently watching and rewatching
  allWatching.forEach((anime, index) => {
    const airingInfo = getNextAiring(anime);
    if (airingInfo) {
      startCountdown(`countdown-${index}`, airingInfo.ts);
    }
  });
  
  checkForNotifications(allWatching);
  
  // Fetch streaming links for watching/rewatching items only
  if (allWatching.length > 0) {
    console.log('📺 Fetching streaming links for', allWatching.length, 'anime...');
    console.log('📋 Watching anime MAL IDs:', allWatching.map(a => a.idMal || a.malId).filter(Boolean));
    
    // Start batch fetch in background
    batchFetchStreamingLinks(allWatching).then(batchResults => {
    console.log(`✅ Batch fetch completed. Received ${batchResults?.length || 0} results.`);
    
      // Update each card as streaming data becomes available
      allWatching.forEach((anime, index) => {
        const malId = anime.idMal || anime.malId;
        const malIdNum = malId ? (typeof malId === 'string' ? parseInt(malId, 10) : malId) : null;
        
        if (malIdNum && streamingLinksCache.has(malIdNum)) {
          const streamingInfo = streamingLinksCache.get(malIdNum);
          const cardElement = container.querySelector(`[data-anime-id="${anime.id}"]`);
          if (cardElement) {
            // Determine status type
            const status = (anime.status || '').toLowerCase();
            const statusType = status === 'repeating' || status === 're-watching' ? 'rewatching' : 'watching';
            
            // Update the card with streaming data
            const newCardHTML = renderAnimeCard(anime, index, streamingInfo, statusType);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newCardHTML;
            const newCard = tempDiv.firstElementChild;
            
            // Preserve countdown timer if it exists
            const existingCountdown = cardElement.querySelector('.countdown-timer');
            const newCountdown = newCard.querySelector('.countdown-timer');
            let countdownId = `countdown-${index}`;
            
            if (existingCountdown && newCountdown) {
              // Preserve the existing countdown ID
              countdownId = existingCountdown.id || countdownId;
              newCountdown.id = countdownId;
              // Don't preserve text if it's "Loading..." - let it restart
              if (existingCountdown.textContent !== 'Loading...') {
                newCountdown.textContent = existingCountdown.textContent;
              }
            }
            
            // Preserve loaded image if it exists
            const existingImg = cardElement.querySelector('img');
            const newImg = newCard.querySelector('img');
            if (existingImg && newImg) {
              // If the existing image has loaded (not a placeholder), preserve it
              if (existingImg.src && 
                  !existingImg.src.startsWith('data:image/svg+xml') && 
                  !existingImg.classList.contains('lazy-loading')) {
                newImg.src = existingImg.src;
                newImg.classList.remove('lazy-loading');
                newImg.classList.add('lazy-loaded');
                // Remove data-src so it doesn't try to reload
                delete newImg.dataset.src;
              }
            }
            
            cardElement.replaceWith(newCard);
            
            // Restart countdown if needed (use preserved ID)
            const airingInfo = getNextAiring(anime);
            if (airingInfo) {
              startCountdown(countdownId, airingInfo.ts);
            } else if (newCountdown) {
              // If no airing info, show a message instead of "Loading..."
              newCountdown.textContent = 'No airing data';
            }
          }
        }
      });
    }).catch(error => {
      console.error('❌ Batch fetch failed:', error);
    });
    
    // Also fetch individual streaming links as they become available (progressive)
    allWatching.forEach((anime, index) => {
    const malId = anime.idMal || anime.malId;
    if (!malId) return;
    
    // Fetch streaming link for this anime (will update cache)
    fetchStreamingLinks(malId, anime.title).then(result => {
      if (result && malId) {
        const malIdNum = typeof malId === 'string' ? parseInt(malId, 10) : malId;
        if (malIdNum && streamingLinksCache.has(malIdNum)) {
          const streamingInfo = streamingLinksCache.get(malIdNum);
          const cardElement = container.querySelector(`[data-anime-id="${anime.id}"]`);
          if (cardElement) {
            // Determine status type
            const status = (anime.status || '').toLowerCase();
            const statusType = status === 'repeating' || status === 're-watching' ? 'rewatching' : 'watching';
            
            // Update the card with streaming data
            const newCardHTML = renderAnimeCard(anime, index, streamingInfo, statusType);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newCardHTML;
            const newCard = tempDiv.firstElementChild;
            
            // Preserve countdown timer
            const existingCountdown = cardElement.querySelector('.countdown-timer');
            const newCountdown = newCard.querySelector('.countdown-timer');
            let countdownId = `countdown-${index}`;
            
            if (existingCountdown && newCountdown) {
              // Preserve the existing countdown ID
              countdownId = existingCountdown.id || countdownId;
              newCountdown.id = countdownId;
              // Don't preserve text if it's "Loading..." - let it restart
              if (existingCountdown.textContent !== 'Loading...') {
                newCountdown.textContent = existingCountdown.textContent;
              }
            }
            
            // Preserve loaded image if it exists
            const existingImg = cardElement.querySelector('img');
            const newImg = newCard.querySelector('img');
            if (existingImg && newImg) {
              // If the existing image has loaded (not a placeholder), preserve it
              if (existingImg.src && 
                  !existingImg.src.startsWith('data:image/svg+xml') && 
                  !existingImg.classList.contains('lazy-loading')) {
                newImg.src = existingImg.src;
                newImg.classList.remove('lazy-loading');
                newImg.classList.add('lazy-loaded');
                // Remove data-src so it doesn't try to reload
                delete newImg.dataset.src;
              }
            }
            
            cardElement.replaceWith(newCard);
            
            // Restart countdown if needed (use preserved ID)
            const airingInfo = getNextAiring(anime);
            if (airingInfo) {
              startCountdown(countdownId, airingInfo.ts);
            } else if (newCountdown) {
              // If no airing info, show a message instead of "Loading..."
              newCountdown.textContent = 'No airing data';
            }
          }
        }
      }
    }).catch(error => {
      console.error(`Failed to fetch streaming links for ${anime.title}:`, error);
    });
    });
  }
}

/**
 * Setup "Start Watching" buttons for PTW items
 */
function setupStartWatchingButtons() {
  document.addEventListener('click', async (e) => {
    if (e.target.matches('.start-watching-btn') || e.target.closest('.start-watching-btn')) {
      const button = e.target.closest('.start-watching-btn') || e.target;
      const animeId = parseInt(button.dataset.animeId);
      const animeTitle = button.dataset.animeTitle || 'Anime';
      
      if (!animeId) return;
      
      try {
        // Update status to "Current" via API
        const response = await fetch('/api/anilist/update-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mediaId: animeId,
            status: 'Current'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update status');
        }
        
        // Remove from queue if it was in there
        try {
          const { removeFromQueue } = await import('./watch-queue.js');
          await removeFromQueue(animeId);
        } catch (error) {
          // Ignore if not in queue
        }
        
        // Show success message
        const { showToast } = await import('./toast.js');
        showToast(`Started watching "${animeTitle}"!`, 'success');
        
        // Re-render the watching tab
        if (window.animeData) {
          // Update the status in the data
          const anime = window.animeData.find(a => a.id === animeId);
          if (anime) {
            anime.status = 'Current';
          }
          await renderEnhancedWatchingTab(window.animeData);
        }
      } catch (error) {
        const { handleError } = await import('./error-handler.js');
        handleError(error, 'starting to watch', {
          showToast: true
        });
      }
    }
  });
}

// --- Notification Settings Panel ---

export function initNotificationSettings() {
  loadNotificationSettings();
  
  const watchingTab = document.getElementById('watching-tab');
  if (!watchingTab) return;
  
  let settingsPanel = document.getElementById('airing-settings-panel');
  if (!settingsPanel) {
    settingsPanel = document.createElement('div');
    settingsPanel.id = 'airing-settings-panel';
    settingsPanel.className = 'anime-card rounded-xl p-4 shadow-md mb-4';
    settingsPanel.innerHTML = `
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 class="font-bold text-lg mb-1">Episode Notifications</h3>
          <p class="text-sm text-gray-600">Get alerted when new episodes air</p>
        </div>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="enable-notifications" class="w-5 h-5">
            <span class="font-medium">Enable Notifications</span>
          </label>
          <select id="notify-minutes-before" class="filter-select">
            <option value="1">1 min before</option>
            <option value="5" selected>5 min before</option>
            <option value="15">15 min before</option>
            <option value="30">30 min before</option>
            <option value="60">1 hour before</option>
          </select>
        </div>
      </div>`;
    watchingTab.insertBefore(settingsPanel, watchingTab.firstChild);
    
    const enableCheckbox = document.getElementById('enable-notifications');
    const minutesSelect = document.getElementById('notify-minutes-before');
    
    enableCheckbox.checked = notificationSettings.enabled;
    minutesSelect.value = notificationSettings.notifyMinutesBefore;
    
    enableCheckbox.addEventListener('change', async (e) => {
      if (e.target.checked) {
        const granted = await requestNotificationPermission();
        if (granted) {
          notificationSettings.enabled = true;
          saveNotificationSettings();
        } else {
          e.target.checked = false;
        }
      } else {
        notificationSettings.enabled = false;
        saveNotificationSettings();
      }
    });
    
    minutesSelect.addEventListener('change', (e) => {
      notificationSettings.notifyMinutesBefore = parseInt(e.target.value);
      saveNotificationSettings();
    });
  }
  
  // Clear existing interval if any
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }
  
  // Set up notification check interval
  notificationInterval = setInterval(() => {
    if (notificationSettings.enabled) {
      const watchingContent = document.getElementById('watching-content');
      if (watchingContent && !watchingContent.classList.contains('hidden')) {
        const watching = window.animeData?.filter(a =>
          (a.status || '').toLowerCase() === 'current' ||
          (a.status || '').toLowerCase() === 'watching' ||
          (a.status || '').toLowerCase() === 'repeating'
        ) || [];
        checkForNotifications(watching);
      }
    }
  }, 60000);
}

/**
 * Cleanup function to clear all intervals
 */
export function cleanupAiringIntervals() {
  stopAllCountdowns();
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

export function toggleAnimeNotifications(animeTitle) {
  if (notificationSettings.enabledAnime.has(animeTitle)) {
    notificationSettings.enabledAnime.delete(animeTitle);
    showToast(`Notifications disabled for ${animeTitle}`, 'info');
  } else {
    notificationSettings.enabledAnime.add(animeTitle);
    showToast(`Notifications enabled for ${animeTitle}`, 'success');
  }
  saveNotificationSettings();
}

// --- Calendar Export ---

export function exportToCalendar(animeList) {
  const watching = animeList.filter(a =>
    (a.status || '').toLowerCase() === 'current' ||
    (a.status || '').toLowerCase() === 'watching' ||
    (a.status || '').toLowerCase() === 'repeating'
  );
  
  if (watching.length === 0) {
    showToast('No airing anime to export', 'error');
    return;
  }
  
  let ical = 'BEGIN:VCALENDAR\r\n';
  ical += 'VERSION:2.0\r\n';
  ical += 'PRODID:-//Anime Dashboard//Airing Schedule//EN\r\n';
  ical += 'CALSCALE:GREGORIAN\r\n';
  ical += 'METHOD:PUBLISH\r\n';
  ical += 'X-WR-CALNAME:Anime Airing Schedule\r\n';
  ical += 'X-WR-TIMEZONE:UTC\r\n';
  
  watching.forEach(anime => {
    const airingInfo = getNextAiring(anime);
    if (!airingInfo) return;
    
    const title = anime.title || 'Unknown';
    const airingDate = new Date(airingInfo.ts < 2e12 ? airingInfo.ts * 1000 : airingInfo.ts);
    const endDate = new Date(airingDate.getTime() + 30 * 60000);
    
    const formatICalDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    ical += 'BEGIN:VEVENT\r\n';
    ical += `UID:${title.replace(/\s/g, '-')}-ep${airingInfo.episode}@anime-dashboard\r\n`;
    ical += `DTSTAMP:${formatICalDate(new Date())}\r\n`;
    ical += `DTSTART:${formatICalDate(airingDate)}\r\n`;
    ical += `DTEND:${formatICalDate(endDate)}\r\n`;
    ical += `SUMMARY:${title} - Episode ${airingInfo.episode}\r\n`;
    ical += `DESCRIPTION:New episode of ${title} airs!\r\n`;
    ical += 'STATUS:CONFIRMED\r\n';
    ical += 'BEGIN:VALARM\r\n';
    ical += 'TRIGGER:-PT5M\r\n';
    ical += 'ACTION:DISPLAY\r\n';
    ical += `DESCRIPTION:${title} episode airs in 5 minutes!\r\n`;
    ical += 'END:VALARM\r\n';
    ical += 'END:VEVENT\r\n';
  });
  
  ical += 'END:VCALENDAR\r\n';
  
  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'anime-airing-schedule.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Calendar exported! Import into Google Calendar or iCal', 'success');
}

// --- Initialize Module ---

export function initAiringSchedule() {
  initNotificationSettings();
  
  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('notify-toggle-btn')) {
      const animeTitle = e.target.dataset.animeTitle;
      toggleAnimeNotifications(animeTitle);
      e.target.classList.toggle('notify-enabled');
    }
  });
}

window.addEventListener('beforeunload', () => {
  cleanupAiringIntervals();
});