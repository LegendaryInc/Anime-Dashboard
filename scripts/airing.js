// =====================================================================
// --- AIRING SCHEDULE MODULE (airing.js) ---
// =====================================================================
// Real-time countdown timers, notifications, and Jikan streaming links
// =====================================================================

import { showToast } from './toast.js';
import { observeNewImages } from './lazy-loading.js';

// --- State Management ---
let countdownIntervals = new Map();
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
function renderAnimeCard(anime, index, streamingInfo = null) {
  const airingInfo = getNextAiring(anime);
  const title = anime.title || 'Unknown';
  const progress = anime.episodesWatched ?? anime.progress ?? 0;
  const img = anime.coverImage || 'https://placehold.co/70x140/1f2937/94a3b8?text=No+Image';
  const countdownId = `countdown-${index}`;
  const isNotifyEnabled = notificationSettings.enabledAnime.has(title);
  const isRewatching = (anime.status || '').toLowerCase() === 'repeating';
  
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
  
  // Build streaming links section
  const isLoading = streamingInfo === null || (malIdNum && !streamingLinksCache.has(malIdNum));
  let streamingHTML = `
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
    </div>
    
    <div class="text-xs mt-2 space-y-1">
      ${isLoading ? `
        <div class="opacity-60">
          <span class="font-medium">Free sites:</span>
          <span class="loading-skeleton">Loading...</span>
        </div>
      ` : `
        <div class="opacity-60 hover:opacity-100 transition-opacity">
          <span class="font-medium">Free sites:</span>
          <a href="${freeLinks.gogoanime}" target="_blank" rel="noopener" class="hover:underline">Gogo</a> • 
          <a href="${freeLinks.animepahe}" target="_blank" rel="noopener" class="hover:underline">Pahe</a> • 
          <a href="${freeLinks.aniwave}" target="_blank" rel="noopener" class="hover:underline">AniWave</a> •
          <a href="${freeLinks.animixplay}" target="_blank" rel="noopener" class="hover:underline">AnimixPlay</a>
        </div>
      `}`;
  
  // Add official links if available
  if (!isLoading && officialLinks.length > 0) {
    const officialLinksHTML = officialLinks
      .map(link => {
        if (!link.url || !link.name) return '';
        const url = link.url.startsWith('http') ? link.url : `https://${link.url}`;
        return `<a href="${url}" target="_blank" rel="noopener" class="hover:underline text-green-600">${link.name}</a>`;
      })
      .filter(html => html.length > 0)
      .join(' • ');
    
    if (officialLinksHTML) {
      streamingHTML += `
        <div class="opacity-70 hover:opacity-100 transition-opacity text-green-600">
          <span class="font-medium">Official:</span>
          ${officialLinksHTML}
        </div>`;
    }
  }
  
  streamingHTML += `</div>`;
  
  return `
    <div class="watch-card ${isRewatching ? 'rewatching' : ''} ${isLoading ? 'loading' : ''}" data-anime-id="${malIdNum || ''}" data-index="${index}">
      <a class="watch-thumb" href="${anime.externalLinks?.[0]?.url || '#'}" target="_blank" rel="noopener">
        <img src="${img}" alt="${title.replace(/"/g, '&quot;')}" referrerpolicy="no-referrer"
             onerror="this.onerror=null;this.src='https://placehold.co/70x140/1f2937/94a3b8?text=No+Image';">
        ${isRewatching ? '<div class="rewatch-badge">🔁 REWATCH</div>' : ''}
      </a>
      
      <div class="watch-card-content">
        <a class="watch-title" href="${anime.externalLinks?.[0]?.url || '#'}" target="_blank" rel="noopener">
          ${title}
        </a>
        <div class="watch-progress">Progress: ${progress} episodes</div>
        
        ${airingHTML}
        ${streamingHTML}
      </div>
    </div>`;
}

export async function renderEnhancedWatchingTab(data = []) {
  const container = document.getElementById('watching-content');
  if (!container) return;
  
  stopAllCountdowns();
  
  const watching = data.filter(a =>
    (a.status || '').toLowerCase() === 'current' ||
    (a.status || '').toLowerCase() === 'watching' ||
    (a.status || '').toLowerCase() === 'repeating'
  );
  
  if (watching.length === 0) {
    container.innerHTML = `
      <div class="watch-empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <p class="text-lg">No anime currently watching</p>
      </div>`;
    return;
  }
  
  // Sort by airing time
  watching.sort((a, b) => {
    const aTime = getNextAiring(a);
    const bTime = getNextAiring(b);
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime.ts - bTime.ts;
  });
  
  // Render skeleton cards immediately (with loading state)
  console.log('📺 Rendering', watching.length, 'anime cards (loading state)...');
  container.innerHTML = watching.map((anime, index) => renderAnimeCard(anime, index, null)).join('');
  
  // Initialize lazy loading for new images
  observeNewImages(container);
  
  // Start countdowns immediately (they don't need streaming data)
  watching.forEach((anime, index) => {
    const airingInfo = getNextAiring(anime);
    if (airingInfo) {
      startCountdown(`countdown-${index}`, airingInfo.ts);
    }
  });
  
  checkForNotifications(watching);
  
  // Fetch streaming links progressively and update cards as they arrive
  console.log('📺 Fetching streaming links for', watching.length, 'anime...');
  console.log('📋 Watching anime MAL IDs:', watching.map(a => a.idMal || a.malId).filter(Boolean));
  
  // Start batch fetch in background
  batchFetchStreamingLinks(watching).then(batchResults => {
    console.log(`✅ Batch fetch completed. Received ${batchResults?.length || 0} results.`);
    
    // Update each card as streaming data becomes available
    watching.forEach((anime, index) => {
      const malId = anime.idMal || anime.malId;
      const malIdNum = malId ? (typeof malId === 'string' ? parseInt(malId, 10) : malId) : null;
      
      if (malIdNum && streamingLinksCache.has(malIdNum)) {
        const streamingInfo = streamingLinksCache.get(malIdNum);
        const cardElement = container.querySelector(`[data-anime-id="${malIdNum}"]`);
        if (cardElement) {
          // Update the card with streaming data
          const newCardHTML = renderAnimeCard(anime, index, streamingInfo);
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = newCardHTML;
          const newCard = tempDiv.firstElementChild;
          
          // Preserve countdown timer if it exists
          const existingCountdown = cardElement.querySelector('.countdown-timer');
          if (existingCountdown && newCard.querySelector('.countdown-timer')) {
            newCard.querySelector('.countdown-timer').id = existingCountdown.id;
            newCard.querySelector('.countdown-timer').textContent = existingCountdown.textContent;
          }
          
          cardElement.replaceWith(newCard);
          
          // Restart countdown if needed
          const airingInfo = getNextAiring(anime);
          if (airingInfo) {
            startCountdown(`countdown-${index}`, airingInfo.ts);
          }
        }
      }
    });
  }).catch(error => {
    console.error('❌ Batch fetch failed:', error);
  });
  
  // Also fetch individual streaming links as they become available (progressive)
  // This allows cards to update one-by-one as data arrives
  watching.forEach((anime, index) => {
    const malId = anime.idMal || anime.malId;
    if (!malId) return;
    
    // Fetch streaming link for this anime (will update cache)
    fetchStreamingLinks(malId, anime.title).then(result => {
      if (result && malId) {
        const malIdNum = typeof malId === 'string' ? parseInt(malId, 10) : malId;
        if (malIdNum && streamingLinksCache.has(malIdNum)) {
          const streamingInfo = streamingLinksCache.get(malIdNum);
          const cardElement = container.querySelector(`[data-anime-id="${malIdNum}"]`);
          if (cardElement) {
            // Update the card with streaming data
            const newCardHTML = renderAnimeCard(anime, index, streamingInfo);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newCardHTML;
            const newCard = tempDiv.firstElementChild;
            
            // Preserve countdown timer
            const existingCountdown = cardElement.querySelector('.countdown-timer');
            if (existingCountdown && newCard.querySelector('.countdown-timer')) {
              newCard.querySelector('.countdown-timer').id = existingCountdown.id;
              newCard.querySelector('.countdown-timer').textContent = existingCountdown.textContent;
            }
            
            cardElement.replaceWith(newCard);
            
            // Restart countdown if needed
            const airingInfo = getNextAiring(anime);
            if (airingInfo) {
              startCountdown(`countdown-${index}`, airingInfo.ts);
            }
          }
        }
      }
    }).catch(error => {
      console.error(`Failed to fetch streaming links for ${anime.title}:`, error);
    });
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
  
  setInterval(() => {
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
  stopAllCountdowns();
});