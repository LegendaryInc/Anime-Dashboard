// =====================================================================
// --- KEYBOARD SHORTCUTS MODULE (keyboard.js) ---
// =====================================================================
// Global keyboard shortcuts for improved navigation and productivity
// =====================================================================

import { showToast } from './toast.js';
import { setActiveTab } from './ui.js';

// =====================================================================
// SHORTCUT CONFIGURATION
// =====================================================================

const SHORTCUTS = {
  // Search & Navigation
  '/': { action: 'focus-search', description: 'Focus search bar' },
  'Escape': { action: 'clear-search', description: 'Clear search and close modals' },
  'Ctrl+F': { action: 'focus-search', description: 'Focus search bar' },
  'Ctrl+K': { action: 'focus-search', description: 'Focus search bar' },
  
  // Tab Navigation (matches actual tab order)
  '1': { action: 'switch-tab', param: 'watching', description: 'Switch to Watching tab' },
  '2': { action: 'switch-tab', param: 'charts', description: 'Switch to Visualizations tab' },
  '3': { action: 'switch-tab', param: 'list', description: 'Switch to Full List tab' },
  '4': { action: 'switch-tab', param: 'insights', description: 'Switch to Insights tab' },
  '5': { action: 'switch-tab', param: 'calendar', description: 'Switch to Calendar tab' },
  '6': { action: 'switch-tab', param: 'gacha', description: 'Switch to Gacha tab' },
  
  // View Controls
  'g': { action: 'toggle-view', description: 'Toggle grid/table view' },
  'v': { action: 'toggle-view', description: 'Toggle grid/table view' },
  
  // Filter Controls
  'f': { action: 'toggle-filters', description: 'Toggle advanced filters panel' },
  'Ctrl+Shift+H': { action: 'show-help', description: 'Show keyboard shortcuts help' },
  
  // Modal Controls
  'Escape': { action: 'close-modals', description: 'Close any open modals' },
  
  // Quick Actions
  'r': { action: 'refresh-data', description: 'Refresh data from AniList' },
  's': { action: 'open-settings', description: 'Open settings modal' },
};

// Track if shortcuts are enabled
let shortcutsEnabled = true;
let helpModal = null;

// =====================================================================
// INITIALIZATION
// =====================================================================

export function initKeyboardShortcuts() {
  // Don't interfere with typing in inputs
  document.addEventListener('keydown', handleKeyDown, true);
  
  // Show help on Ctrl+Shift+H
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      showShortcutsHelp();
    }
  });
  
  console.log('⌨️ Keyboard shortcuts enabled');
}

// =====================================================================
// KEYBOARD EVENT HANDLER
// =====================================================================

function handleKeyDown(e) {
  // Ignore shortcuts if typing in inputs, textareas, or contenteditable
  const target = e.target;
  const isInput = target.tagName === 'INPUT' || 
                  target.tagName === 'TEXTAREA' || 
                  target.isContentEditable;
  
  // Allow Escape and Ctrl shortcuts even in inputs
  const allowInInput = e.key === 'Escape' || 
                       (e.ctrlKey && (e.key === 'k' || e.key === 'f' || e.key === '/' || e.shiftKey));
  
  if (isInput && !allowInInput) {
    // Special case: '/' should focus search even when typing
    if (e.key === '/' && target.id !== 'search-bar') {
      e.preventDefault();
      focusSearch();
      return;
    }
    return;
  }
  
  // Don't trigger shortcuts when modifier keys are pressed (except Ctrl which we handle)
  if (e.altKey || e.metaKey || (e.shiftKey && e.key !== '?')) {
    return;
  }
  
  // Build shortcut key
  let shortcutKey = '';
  if (e.ctrlKey) shortcutKey += 'Ctrl+';
  if (e.key) shortcutKey += e.key;
  
  const shortcut = SHORTCUTS[shortcutKey] || SHORTCUTS[e.key];
  
  if (shortcut && shortcutsEnabled) {
    e.preventDefault();
    executeShortcut(shortcut, e);
  }
}

// =====================================================================
// SHORTCUT EXECUTION
// =====================================================================

function executeShortcut(shortcut, event) {
  switch (shortcut.action) {
    case 'focus-search':
      focusSearch();
      break;
      
    case 'clear-search':
      clearSearch();
      break;
      
    case 'switch-tab':
      switchTab(shortcut.param);
      break;
      
    case 'toggle-view':
      toggleView();
      break;
      
    case 'toggle-filters':
      toggleFilters();
      break;
      
    case 'close-modals':
      closeModals();
      break;
      
    case 'refresh-data':
      refreshData();
      break;
      
    case 'open-settings':
      openSettings();
      break;
      
    case 'show-help':
      showShortcutsHelp();
      break;
      
    default:
      console.warn('Unknown shortcut action:', shortcut.action);
  }
}

// =====================================================================
// SHORTCUT ACTIONS
// =====================================================================

function focusSearch() {
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.focus();
    searchBar.select();
    showToast('Search focused', 'info', 1000);
  }
}

function clearSearch() {
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.value = '';
    searchBar.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Close any open modals
  const modals = document.querySelectorAll('.modal, .confirm-backdrop');
  modals.forEach(modal => {
    if (modal.classList.contains('show') || modal.classList.contains('confirm-show')) {
      modal.classList.remove('show', 'confirm-show');
      setTimeout(() => modal.remove(), 200);
    }
  });
}

function switchTab(tabName) {
  // Use the setActiveTab function from ui.js
  setActiveTab(tabName);
  
  // Also trigger button click for any additional handlers
  const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (tabButton) {
    tabButton.click();
  }
  
  // Map tab names to display names
  const tabNames = {
    watching: 'Watching',
    charts: 'Visualizations',
    list: 'Full List',
    insights: 'Insights',
    calendar: 'Calendar',
    gacha: 'Gacha'
  };
  
  const displayName = tabNames[tabName] || tabName.charAt(0).toUpperCase() + tabName.slice(1);
  showToast(`Switched to ${displayName} tab`, 'info', 1000);
}

function toggleView() {
  const viewMode = localStorage.getItem('animeViewMode') || 'table';
  const newMode = viewMode === 'table' ? 'grid' : 'table';
  
  // Trigger view toggle if available
  const viewToggle = document.querySelector('.view-toggle-btn, [data-view-mode]');
  if (viewToggle) {
    viewToggle.click();
  } else {
    // Fallback: manually set view mode
    localStorage.setItem('animeViewMode', newMode);
    window.location.reload(); // Simple fallback
  }
  
  showToast(`Switched to ${newMode} view`, 'info', 1000);
}

function toggleFilters() {
  const filtersPanel = document.getElementById('advanced-filters');
  if (filtersPanel) {
    const isHidden = filtersPanel.classList.contains('hidden') || 
                     filtersPanel.style.display === 'none';
    
    if (isHidden) {
      filtersPanel.classList.remove('hidden');
      filtersPanel.style.display = '';
      showToast('Advanced filters shown', 'info', 1000);
    } else {
      filtersPanel.classList.add('hidden');
      filtersPanel.style.display = 'none';
      showToast('Advanced filters hidden', 'info', 1000);
    }
  }
}

function closeModals() {
  const modals = document.querySelectorAll('.modal.show, .confirm-backdrop.confirm-show');
  modals.forEach(modal => {
    modal.classList.remove('show', 'confirm-show');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 200);
  });
  
  if (helpModal) {
    helpModal.classList.remove('show');
    setTimeout(() => {
      if (helpModal.parentNode) {
        helpModal.remove();
      }
      helpModal = null;
    }, 200);
  }
}

function refreshData() {
  const resyncBtn = document.getElementById('resync-btn');
  if (resyncBtn) {
    resyncBtn.click();
    showToast('Refreshing data from AniList...', 'info', 2000);
  } else {
    showToast('Refresh not available', 'warning', 2000);
  }
}

function openSettings() {
  const settingsBtn = document.getElementById('settings-button');
  if (settingsBtn) {
    settingsBtn.click();
    showToast('Settings opened', 'info', 1000);
  }
}

function showShortcutsHelp() {
  // Close existing help if open
  if (helpModal) {
    helpModal.classList.remove('show');
    setTimeout(() => {
      if (helpModal.parentNode) {
        helpModal.remove();
      }
      helpModal = null;
    }, 200);
    return;
  }
  
  // Create help modal backdrop
  helpModal = document.createElement('div');
  helpModal.className = 'modal-backdrop show';
  helpModal.innerHTML = `
    <div class="modal-content anime-card" style="max-width: 600px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--border);">
        <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">⌨️ Keyboard Shortcuts</h2>
        <button class="modal-close-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-primary); padding: 4px 8px;" onclick="this.closest('.modal-backdrop').remove()">×</button>
      </div>
      <div style="max-height: 70vh; overflow-y: auto;">
        <div class="shortcuts-help">
          <div class="shortcut-section">
            <h3>🔍 Search & Navigation</h3>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <kbd>/</kbd> or <kbd>Ctrl+K</kbd>
                <span>Focus search bar</span>
              </div>
              <div class="shortcut-item">
                <kbd>Esc</kbd>
                <span>Clear search / Close modals</span>
              </div>
            </div>
          </div>
          
          <div class="shortcut-section">
            <h3>📑 Tab Navigation</h3>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <kbd>1</kbd>
                <span>Watching tab</span>
              </div>
              <div class="shortcut-item">
                <kbd>2</kbd>
                <span>Visualizations tab</span>
              </div>
              <div class="shortcut-item">
                <kbd>3</kbd>
                <span>Full List tab</span>
              </div>
              <div class="shortcut-item">
                <kbd>4</kbd>
                <span>Insights tab</span>
              </div>
              <div class="shortcut-item">
                <kbd>5</kbd>
                <span>Calendar tab</span>
              </div>
              <div class="shortcut-item">
                <kbd>6</kbd>
                <span>Gacha tab</span>
              </div>
            </div>
          </div>
          
          <div class="shortcut-section">
            <h3>👁️ View Controls</h3>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <kbd>G</kbd> or <kbd>V</kbd>
                <span>Toggle grid/table view</span>
              </div>
              <div class="shortcut-item">
                <kbd>F</kbd>
                <span>Toggle filters panel</span>
              </div>
            </div>
          </div>
          
          <div class="shortcut-section">
            <h3>⚡ Quick Actions</h3>
            <div class="shortcut-list">
              <div class="shortcut-item">
                <kbd>R</kbd>
                <span>Refresh data</span>
              </div>
              <div class="shortcut-item">
                <kbd>S</kbd>
                <span>Open settings</span>
              </div>
              <div class="shortcut-item">
                <kbd>Ctrl+Shift+H</kbd>
                <span>Show this help</span>
              </div>
            </div>
          </div>
          
          <div class="shortcut-note">
            <p>💡 <strong>Tip:</strong> Shortcuts are disabled when typing in input fields.</p>
            <p>Press <kbd>Ctrl+Shift+H</kbd> anytime to see this help.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(helpModal);
  
  // Close on Escape
  const closeHandler = (e) => {
    if (e.key === 'Escape' && helpModal) {
      helpModal.classList.remove('show');
      setTimeout(() => {
        if (helpModal && helpModal.parentNode) {
          helpModal.remove();
        }
        helpModal = null;
      }, 200);
      document.removeEventListener('keydown', closeHandler);
    }
  };
  document.addEventListener('keydown', closeHandler);
  
  // Close button
  const closeBtn = helpModal.querySelector('.modal-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      helpModal.classList.remove('show');
      setTimeout(() => {
        if (helpModal && helpModal.parentNode) {
          helpModal.remove();
        }
        helpModal = null;
      }, 200);
    });
  }
  
  // Close on backdrop click
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.classList.remove('show');
      setTimeout(() => {
        if (helpModal && helpModal.parentNode) {
          helpModal.remove();
        }
        helpModal = null;
      }, 200);
    }
  });
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

export function enableShortcuts() {
  shortcutsEnabled = true;
  showToast('Keyboard shortcuts enabled', 'success', 2000);
}

export function disableShortcuts() {
  shortcutsEnabled = false;
  showToast('Keyboard shortcuts disabled', 'info', 2000);
}

export function isShortcutsEnabled() {
  return shortcutsEnabled;
}

