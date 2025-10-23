// =====================================================================
// --- AIRING SCHEDULE MODULE (airing.js) ---
// =====================================================================
// Real-time countdown timers, notifications, and calendar features
// =====================================================================

import { showToast } from './toast.js';

// --- State Management ---
let countdownIntervals = new Map();
let notificationPermission = 'default';
let notificationSettings = {
  enabled: false,
  notifyMinutesBefore: 5,
  enabledAnime: new Set() // Track which anime have notifications enabled
};

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

/**
 * Format timestamp to absolute time
 */
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

/**
 * Format timestamp to relative countdown
 */
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

/**
 * Extract next airing info from anime object
 */
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

// --- Notification System ---

/**
 * Request browser notification permission
 */
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

/**
 * Show a browser notification
 */
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
    
    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
}

/**
 * Check if any anime should trigger notifications
 */
function checkForNotifications(animeList) {
  if (!notificationSettings.enabled) return;
  
  const now = Date.now();
  const notifyThreshold = notificationSettings.notifyMinutesBefore * 60 * 1000;
  
  animeList.forEach(anime => {
    const airingInfo = getNextAiring(anime);
    if (!airingInfo) return;
    
    const title = anime.title || 'Unknown';
    
    // Check if notifications are enabled for this anime
    if (!notificationSettings.enabledAnime.has(title)) return;
    
    const airingTime = airingInfo.ts < 2e12 ? airingInfo.ts * 1000 : airingInfo.ts;
    const timeUntil = airingTime - now;
    
    // Notify if within threshold and not already notified
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
    
    // Notify when episode airs
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

/**
 * Start a countdown timer for a specific element
 */
function startCountdown(elementId, timestamp, callback) {
  // Clear existing interval if any
  if (countdownIntervals.has(elementId)) {
    clearInterval(countdownIntervals.get(elementId));
  }
  
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const updateCountdown = () => {
    const countdown = formatRelativeCountdown(timestamp);
    element.textContent = countdown.text;
    
    // Apply urgent styling
    if (countdown.urgent) {
      element.classList.add('countdown-urgent');
    } else {
      element.classList.remove('countdown-urgent');
    }
    
    // Call callback if provided
    if (callback) callback(countdown);
    
    // Stop if finished
    if (countdown.finished) {
      clearInterval(countdownIntervals.get(elementId));
      countdownIntervals.delete(elementId);
      element.classList.add('countdown-finished');
    }
  };
  
  // Update immediately
  updateCountdown();
  
  // Update every second
  const interval = setInterval(updateCountdown, 1000);
  countdownIntervals.set(elementId, interval);
}

/**
 * Stop all countdown timers
 */
function stopAllCountdowns() {
  countdownIntervals.forEach(interval => clearInterval(interval));
  countdownIntervals.clear();
}

/**
 * Render watching tab with enhanced countdowns
 */
export function renderEnhancedWatchingTab(data = []) {
  const container = document.getElementById('watching-content');
  if (!container) return;
  
  // Stop existing countdowns
  stopAllCountdowns();
  
  const watching = data.filter(a =>
    (a.status || '').toLowerCase() === 'current' ||
    (a.status || '').toLowerCase() === 'watching'
  );
  
  if (watching.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-lg text-gray-500">No anime currently watching</p>
      </div>`;
    return;
  }
  
  // Sort by airing time (soonest first)
  watching.sort((a, b) => {
    const aTime = getNextAiring(a);
    const bTime = getNextAiring(b);
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime.ts - bTime.ts;
  });
  
  container.innerHTML = watching.map((anime, index) => {
    const airingInfo = getNextAiring(anime);
    const title = anime.title || 'Unknown';
    const progress = anime.episodesWatched ?? anime.progress ?? 0;
    const img = anime.coverImage || 'https://placehold.co/96x144/1f2937/94a3b8?text=No+Image';
    const countdownId = `countdown-${index}`;
    const notifyId = `notify-${index}`;
    const isNotifyEnabled = notificationSettings.enabledAnime.has(title);
    
    let nextEpisodeHTML = '';
    if (airingInfo) {
      const absoluteTime = formatAbsolute(airingInfo.ts);
      nextEpisodeHTML = `
        <div class="watch-airing">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold">Next: Episode ${airingInfo.episode}</span>
            ${notificationSettings.enabled ? `
              <button 
                class="notify-toggle-btn ${isNotifyEnabled ? 'notify-enabled' : ''}" 
                data-anime-title="${title.replace(/"/g, '&quot;')}"
                data-notify-id="${notifyId}"
                title="${isNotifyEnabled ? 'Disable notifications' : 'Enable notifications'}">
                🔔
              </button>
            ` : ''}
          </div>
          <div class="countdown-timer" id="${countdownId}">Loading...</div>
          <div class="text-xs text-gray-500 mt-1">${absoluteTime}</div>
        </div>`;
    }
    
    return `
      <div class="watch-card" data-anime-title="${title.replace(/"/g, '&quot;')}">
        <a class="watch-thumb" href="${anime.externalLinks?.[0]?.url || '#'}" target="_blank" rel="noopener">
          <img src="${img}" alt="${title.replace(/"/g, '&quot;')}" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='https://placehold.co/96x144/1f2937/94a3b8?text=No+Image';">
        </a>
        <div class="watch-info">
          <a class="watch-title" href="${anime.externalLinks?.[0]?.url || '#'}" target="_blank" rel="noopener">
            ${title}
          </a>
          <div class="watch-meta">Progress: ${progress}</div>
          ${nextEpisodeHTML}
        </div>
        <div class="watch-actions">
          <button class="btn-primary px-3 py-1 rounded add-episode-btn" data-title="${title.replace(/"/g, '&quot;')}">
            +1 Episode
          </button>
        </div>
      </div>`;
  }).join('');
  
  // Start countdowns
  watching.forEach((anime, index) => {
    const airingInfo = getNextAiring(anime);
    if (airingInfo) {
      startCountdown(`countdown-${index}`, airingInfo.ts);
    }
  });
  
  // Check for notifications
  checkForNotifications(watching);
}

/**
 * Initialize notification settings panel
 */
export function initNotificationSettings() {
  loadNotificationSettings();
  
  // Add settings to watching tab
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
    
    // Event listeners
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
  
  // Set up periodic notification checks (every minute)
  setInterval(() => {
    if (notificationSettings.enabled) {
      const watchingContent = document.getElementById('watching-content');
      if (watchingContent && !watchingContent.classList.contains('hidden')) {
        // Re-check notifications
        const watching = window.animeData?.filter(a =>
          (a.status || '').toLowerCase() === 'current' ||
          (a.status || '').toLowerCase() === 'watching'
        ) || [];
        checkForNotifications(watching);
      }
    }
  }, 60000); // Every minute
}

/**
 * Toggle notifications for specific anime
 */
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

/**
 * Export airing schedule to iCal format
 */
export function exportToCalendar(animeList) {
  const watching = animeList.filter(a =>
    (a.status || '').toLowerCase() === 'current' ||
    (a.status || '').toLowerCase() === 'watching'
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
    const endDate = new Date(airingDate.getTime() + 30 * 60000); // 30 min duration
    
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
  
  // Download file
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
  
  // Add event delegation for notification toggles
  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('notify-toggle-btn')) {
      const animeTitle = e.target.dataset.animeTitle;
      toggleAnimeNotifications(animeTitle);
      e.target.classList.toggle('notify-enabled');
    }
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAllCountdowns();
});