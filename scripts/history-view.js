// =====================================================================
// --- HISTORY VIEW MODULE (history-view.js) ---
// =====================================================================
// Handles rendering the watch history timeline, summaries, and UI interactions
// =====================================================================

import {
  generateMonthlySummary,
  getActiveYears,
  exportWatchHistoryJSON,
  exportWatchHistoryCSV,
  downloadExport
} from './watch-history.js';

/**
 * Initialize the history view
 */
export function initHistoryView() {
  const historyTab = document.getElementById('history-tab');
  if (!historyTab) return;

  // No view switcher needed - only one view now

  // Export buttons
  const exportJsonBtn = document.getElementById('export-json-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      if (!window.animeData) return;
      const json = exportWatchHistoryJSON(window.animeData);
      downloadExport(json, `watch-history-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (!window.animeData) return;
      const csv = exportWatchHistoryCSV(window.animeData);
      downloadExport(csv, `watch-history-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    });
  }

  // Year/month selectors
  const monthlyYearSelect = document.getElementById('monthly-year-select');
  const monthlyMonthSelect = document.getElementById('monthly-month-select');

  if (monthlyYearSelect) {
    monthlyYearSelect.addEventListener('change', () => {
      renderMonthlySummary();
    });
  }

  if (monthlyMonthSelect) {
    monthlyMonthSelect.addEventListener('change', () => {
      renderMonthlySummary();
    });
  }

  // Populate year selectors and render initial view if data is available
  if (window.animeData && window.animeData.length > 0) {
    // Populate year selectors
    populateYearSelectors();
    
    // Set default month to current month
    const currentMonth = new Date().getMonth() + 1;
    if (monthlyMonthSelect) {
      monthlyMonthSelect.value = currentMonth;
    }
    
    // Render the initial view
    renderMonthlySummary();
  } else {
    // Even without data, populate with fallback years so dropdowns show
    populateYearSelectors();
  }
}

// Removed switchHistoryView - no longer needed with single view

/**
 * Render monthly summary
 */
function renderMonthlySummary() {
  const container = document.getElementById('monthly-summary-content');
  const yearSelect = document.getElementById('monthly-year-select');
  const monthSelect = document.getElementById('monthly-month-select');
  
  if (!container || !yearSelect || !monthSelect || !window.animeData) return;

  const year = parseInt(yearSelect.value);
  const month = parseInt(monthSelect.value);
  const summary = generateMonthlySummary(window.animeData, year, month);

  let html = `
    <div class="monthly-summary-stats grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="anime-card rounded-lg p-4 text-center">
        <div class="text-sm theme-text-secondary mb-1">Started</div>
        <div class="text-2xl font-bold theme-text-primary">${summary.started}</div>
      </div>
      <div class="anime-card rounded-lg p-4 text-center">
        <div class="text-sm theme-text-secondary mb-1">Completed</div>
        <div class="text-2xl font-bold theme-text-primary">${summary.completed}</div>
      </div>
      <div class="anime-card rounded-lg p-4 text-center">
        <div class="text-sm theme-text-secondary mb-1">Episodes</div>
        <div class="text-2xl font-bold theme-text-primary">${summary.totalEpisodes}</div>
      </div>
      <div class="anime-card rounded-lg p-4 text-center">
        <div class="text-sm theme-text-secondary mb-1">Hours</div>
        <div class="text-2xl font-bold theme-text-primary">${summary.totalHours}</div>
      </div>
    </div>
  `;

  if (summary.animeCompleted.length > 0) {
    html += '<h4 class="font-bold text-lg theme-text-primary mb-3">Completed This Month</h4>';
    html += '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';
    
    summary.animeCompleted.forEach(anime => {
      html += `
        <div class="anime-card rounded-lg p-4">
          <div class="font-semibold theme-text-primary mb-1">${anime.title || anime._romaji || anime._english || 'Unknown'}</div>
          <div class="text-sm theme-text-secondary">
            ${anime.episodesWatched || 0} episodes
            ${anime.score ? ` • ⭐ ${anime.score}` : ''}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  }

  container.innerHTML = html;
}

// Removed renderYearlySummary - no longer needed

/**
 * Populate year selectors
 */
export function populateYearSelectors() {
  if (!window.animeData) {
    return;
  }

  const years = getActiveYears(window.animeData);
  const currentYear = new Date().getFullYear();
  
  // Add current year if not in list
  if (!years.includes(currentYear)) {
    years.unshift(currentYear);
  }
  
  // If no years found, add current year and a few previous years
  if (years.length === 0) {
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i);
    }
  }

  const monthlyYearSelect = document.getElementById('monthly-year-select');

  if (monthlyYearSelect) {
    monthlyYearSelect.innerHTML = '';
    years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      monthlyYearSelect.appendChild(option);
    });
    
    // Set default to current year if not already set
    if (!monthlyYearSelect.value) {
      monthlyYearSelect.value = currentYear;
    }
  }
}

/**
 * Refresh history view (called when data updates)
 */
export function refreshHistoryView() {
  // Make available globally for tab switching
  window.refreshHistoryView = refreshHistoryView;
  
  if (!window.animeData || window.animeData.length === 0) {
    return;
  }
  
  populateYearSelectors();
  
  // Set default month to current month if not already set
  const monthlyMonthSelect = document.getElementById('monthly-month-select');
  if (monthlyMonthSelect && !monthlyMonthSelect.value) {
    const currentMonth = new Date().getMonth() + 1;
    monthlyMonthSelect.value = currentMonth;
  }
  
  // Re-render view
  renderMonthlySummary();
}

