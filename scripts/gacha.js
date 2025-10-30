// =====================================================================
// --- GACHA FEATURE SCRIPT (gacha.js) - ENHANCED WITH FILTERS ---
// =====================================================================

import { showToast, showConfirm } from './toast.js';
import { 
  validateApiResponse, 
  ValidationError, 
  withRetry,
  isSessionExpired,
  sanitizeGachaState,
  createErrorResponse,
  logError
} from './validation.js';
import {
  validateGachaStateResponse,
  validateGachaRollResponse,
  validateTokenCalculationResponse,
  validatePackPurchaseResponse
} from './types.js';

// =====================================================================
// STATE MANAGEMENT
// =====================================================================

let gachaManifest = null;
let cosmeticsManifest = null;
let currentlyCustomizingCardUrl = null;

// Operation state tracking
let isOperationInProgress = false;
let currentOperation = null;
let lastOperationTimestamp = 0;

// State snapshot for rollback
let stateSnapshot = null;

// 🆕 Filter & Sort State
let collectionFilters = {
  search: '',
  sortBy: 'rarity-desc', // rarity-desc, rarity-asc, name-asc, name-desc, anime-asc, date-desc
  rarityFilter: [], // Array of rarity values to show
  animeFilter: 'all', // 'all' or specific anime name
  cosmeticFilter: 'all' // 'all', 'with-cosmetics', 'without-cosmetics'
};

// =====================================================================
// BACKEND API INTEGRATION
// =====================================================================

const GachaAPI = {
  async getState() {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/state');
      return await validateApiResponse(response, validateGachaStateResponse);
    });
  },

  async calculateTokens(totalEpisodes) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/calculate-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalEpisodes })
      });
      return await validateApiResponse(response, validateTokenCalculationResponse);
    });
  },

  async roll(card) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card })
      });
      return await validateApiResponse(response, validateGachaRollResponse);
    }, {
      maxRetries: 2,
      shouldRetry: (error) => error.statusCode >= 500 && error.statusCode !== 503
    });
  },

  async buyPack(packCost, cosmetics) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/buy-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packCost, cosmetics })
      });
      return await validateApiResponse(response, validatePackPurchaseResponse);
    }, {
      maxRetries: 2
    });
  },

  async applyCosmetic(cardId, cosmeticName) {
    const response = await fetch('/api/gacha/apply-cosmetic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, cosmeticName })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ValidationError(error.error || 'Failed to apply cosmetic', response.status);
    }
    
    return await response.json();
  },

  async resetCollection() {
    const response = await fetch('/api/gacha/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ValidationError(error.error || 'Failed to reset collection', response.status);
    }
    
    return await response.json();
  }
};

// =====================================================================
// OPERATION GUARDS & STATE MANAGEMENT
// =====================================================================

function createStateSnapshot() {
  return {
    tokens: window.gachaTokens,
    shards: window.gachaShards,
    collection: JSON.parse(JSON.stringify(window.waifuCollection)),
    appliedCosmetics: { ...window.appliedCosmetics },
    ownedCosmetics: [...window.ownedCosmetics],
    timestamp: Date.now()
  };
}

function restoreStateSnapshot(snapshot) {
  if (!snapshot) return;
  
  window.gachaTokens = snapshot.tokens;
  window.gachaShards = snapshot.shards;
  window.waifuCollection = snapshot.collection;
  window.appliedCosmetics = snapshot.appliedCosmetics;
  window.ownedCosmetics = snapshot.ownedCosmetics;
  
  console.log('🔄 State rolled back to snapshot from', new Date(snapshot.timestamp).toISOString());
}

function canProceedWithOperation(operationName, minInterval = 500) {
  if (isOperationInProgress) {
    console.warn(`⚠️ Operation blocked: ${currentOperation} is still in progress`);
    return false;
  }
  
  const timeSinceLastOp = Date.now() - lastOperationTimestamp;
  if (timeSinceLastOp < minInterval) {
    console.warn(`⚠️ Operation blocked: too soon after last operation (${timeSinceLastOp}ms)`);
    return false;
  }
  
  return true;
}

function startOperation(operationName) {
  if (!canProceedWithOperation(operationName)) {
    throw new Error(`Cannot start operation: ${operationName}`);
  }
  
  isOperationInProgress = true;
  currentOperation = operationName;
  stateSnapshot = createStateSnapshot();
  lastOperationTimestamp = Date.now();
  
  updateOperationUI(true);
  
  console.log(`🔒 Operation started: ${operationName}`);
}

function endOperation(success = true) {
  const operation = currentOperation;
  isOperationInProgress = false;
  currentOperation = null;
  
  if (!success) {
    console.log(`❌ Operation failed: ${operation}, rolling back...`);
    restoreStateSnapshot(stateSnapshot);
  } else {
    console.log(`✅ Operation completed: ${operation}`);
  }
  
  stateSnapshot = null;
  
  updateOperationUI(false);
  renderGachaState();
}

function updateOperationUI(isLoading) {
  const rollButton = document.getElementById('gacha-roll-button');
  const resetButton = document.getElementById('gacha-reset-button');
  
  if (rollButton) {
    const hasTokens = window.gachaTokens >= 1;
    rollButton.disabled = isLoading || !hasTokens;
    
    if (isLoading) {
      rollButton.classList.add('loading');
      rollButton.innerHTML = `
        <span class="spinner"></span>
        <span>Rolling...</span>
      `;
    } else {
      rollButton.classList.remove('loading');
      rollButton.textContent = 'ROLL (1 Token)';
    }
    
    rollButton.classList.toggle('opacity-50', rollButton.disabled);
  }
  
  if (resetButton) {
    resetButton.disabled = isLoading;
    resetButton.classList.toggle('opacity-50', resetButton.disabled);
  }
  
  // Disable all buy pack buttons
  document.querySelectorAll('.buy-pack-btn').forEach(btn => {
    btn.disabled = isLoading;
    btn.classList.toggle('opacity-50', btn.disabled);
    
    if (isLoading) {
      btn.classList.add('loading');
    } else {
      btn.classList.remove('loading');
    }
  });
}

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

function formatName(slug) {
  if (!slug) return '';
  const minorWords = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'for', 'to', 'with']);
  const words = slug.replace(/-/g, ' ').split(' ');
  const formattedWords = words.map((word, index) => {
    if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
    if (minorWords.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return formattedWords.join(' ');
}

function convertCardToBackendFormat(card) {
  return {
    id: card.image_url,
    name: card.name,
    anime: card.anime,
    rarity: getRarityString(card.rarity),
    imageUrl: card.image_url
  };
}

function getRarityString(rarity) {
  if (rarity === 'Prismatic') return 'Legendary';
  const rarityMap = { 1: 'Common', 2: 'Common', 3: 'Rare', 4: 'Epic', 5: 'Legendary' };
  return rarityMap[rarity] || 'Common';
}

function getRarityNumber(rarityString) {
  const rarityMap = { 'Common': 2, 'Rare': 3, 'Epic': 4, 'Legendary': 5 };
  return rarityMap[rarityString] || 2;
}

function convertBackendCollectionToDisplay(backendCollection) {
  return backendCollection.map(card => ({
    name: card.name || card.card_name,
    anime: card.anime,
    image_url: card.imageUrl || card.image_url || card.id,
    rarity: card.rarity === 'Legendary' ? 'Prismatic' : 
            card.rarity === 'Epic' ? 4 :
            card.rarity === 'Rare' ? 3 : 2,
    count: card.count || 1,
    acquiredAt: card.acquiredAt || Date.now()
  }));
}

// =====================================================================
// 🆕 FILTER & SORT FUNCTIONS
// =====================================================================

function getUniqueAnimeList() {
  const animeSet = new Set(window.waifuCollection.map(card => card.anime));
  return Array.from(animeSet).sort();
}

function filterAndSortCollection() {
  let filtered = [...window.waifuCollection];
  
  // Apply search filter
  if (collectionFilters.search) {
    const searchLower = collectionFilters.search.toLowerCase();
    filtered = filtered.filter(card => 
      card.name.toLowerCase().includes(searchLower) ||
      card.anime.toLowerCase().includes(searchLower)
    );
  }
  
  // Apply rarity filter
  if (collectionFilters.rarityFilter.length > 0) {
    filtered = filtered.filter(card => {
      const cardRarity = typeof card.rarity === 'number' ? card.rarity : 'Prismatic';
      return collectionFilters.rarityFilter.includes(cardRarity);
    });
  }
  
  // Apply anime filter
  if (collectionFilters.animeFilter !== 'all') {
    filtered = filtered.filter(card => card.anime === collectionFilters.animeFilter);
  }
  
  // Apply cosmetic filter
  if (collectionFilters.cosmeticFilter === 'with-cosmetics') {
    filtered = filtered.filter(card => window.appliedCosmetics[card.image_url]);
  } else if (collectionFilters.cosmeticFilter === 'without-cosmetics') {
    filtered = filtered.filter(card => !window.appliedCosmetics[card.image_url]);
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    switch (collectionFilters.sortBy) {
      case 'rarity-desc':
        return getRarityValue(b.rarity) - getRarityValue(a.rarity);
      case 'rarity-asc':
        return getRarityValue(a.rarity) - getRarityValue(b.rarity);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'anime-asc':
        return a.anime.localeCompare(b.anime);
      case 'date-desc':
        return (b.acquiredAt || 0) - (a.acquiredAt || 0);
      default:
        return 0;
    }
  });
  
  return filtered;
}

function getRarityValue(rarity) {
  if (rarity === 'Prismatic') return 6;
  return typeof rarity === 'number' ? rarity : 0;
}

function calculateCollectionStats(filtered) {
  const stats = {
    total: filtered.length,
    byRarity: {
      Prismatic: 0,
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    }
  };
  
  filtered.forEach(card => {
    const rarity = card.rarity;
    if (stats.byRarity[rarity] !== undefined) {
      stats.byRarity[rarity]++;
    }
  });
  
  return stats;
}

// =====================================================================
// 🆕 UI INITIALIZATION FOR FILTERS
// =====================================================================

export function initializeGachaFilters() {
  const searchInput = document.getElementById('gacha-search');
  const sortSelect = document.getElementById('gacha-sort');
  const animeFilter = document.getElementById('gacha-anime-filter');
  const cosmeticFilter = document.getElementById('gacha-cosmetic-filter');
  const clearFiltersBtn = document.getElementById('gacha-clear-filters');
  
  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      collectionFilters.search = e.target.value;
      renderGachaState();
    });
  }
  
  // Sort select
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      collectionFilters.sortBy = e.target.value;
      renderGachaState();
    });
  }
  
  // Anime filter
  if (animeFilter) {
    animeFilter.addEventListener('change', (e) => {
      collectionFilters.animeFilter = e.target.value;
      renderGachaState();
    });
  }
  
  // Cosmetic filter
  if (cosmeticFilter) {
    cosmeticFilter.addEventListener('change', (e) => {
      collectionFilters.cosmeticFilter = e.target.value;
      renderGachaState();
    });
  }
  
  // Rarity checkboxes
  const rarityCheckboxes = document.querySelectorAll('.rarity-filter-checkbox');
  rarityCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateRarityFilter();
      renderGachaState();
    });
  });
  
  // Clear filters button
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      clearAllFilters();
    });
  }
}

function updateRarityFilter() {
  const checkedBoxes = document.querySelectorAll('.rarity-filter-checkbox:checked');
  collectionFilters.rarityFilter = Array.from(checkedBoxes).map(cb => {
    const value = cb.value;
    return value === 'Prismatic' ? 'Prismatic' : parseInt(value);
  });
}

function clearAllFilters() {
  // Reset filter state
  collectionFilters = {
    search: '',
    sortBy: 'rarity-desc',
    rarityFilter: [],
    animeFilter: 'all',
    cosmeticFilter: 'all'
  };
  
  // Reset UI elements
  const searchInput = document.getElementById('gacha-search');
  const sortSelect = document.getElementById('gacha-sort');
  const animeFilter = document.getElementById('gacha-anime-filter');
  const cosmeticFilter = document.getElementById('gacha-cosmetic-filter');
  
  if (searchInput) searchInput.value = '';
  if (sortSelect) sortSelect.value = 'rarity-desc';
  if (animeFilter) animeFilter.value = 'all';
  if (cosmeticFilter) cosmeticFilter.value = 'all';
  
  // Uncheck all rarity filters
  document.querySelectorAll('.rarity-filter-checkbox').forEach(cb => {
    cb.checked = false;
  });
  
  renderGachaState();
  showToast('Filters cleared', 'success');
}

function populateAnimeFilter() {
  const animeFilter = document.getElementById('gacha-anime-filter');
  if (!animeFilter) return;
  
  const animeList = getUniqueAnimeList();
  
  // Clear existing options except "All Anime"
  animeFilter.innerHTML = '<option value="all">All Anime</option>';
  
  // Add anime options
  animeList.forEach(anime => {
    const option = document.createElement('option');
    option.value = anime;
    option.textContent = anime;
    animeFilter.appendChild(option);
  });
}

// =====================================================================
// CORE GACHA & UI FUNCTIONS
// =====================================================================

export async function loadGachaData() {
  try {
    const [gachaRes, cosmeticRes] = await Promise.all([
      fetch('gacha-manifest.json'),
      fetch('cosmetics-manifest.json')
    ]);
    
    if (!gachaRes.ok) throw new Error('Gacha manifest could not be loaded.');
    if (!cosmeticRes.ok) throw new Error('Cosmetics manifest could not be loaded.');

    gachaManifest = await gachaRes.json();
    cosmeticsManifest = await cosmeticRes.json();

    console.log('✅ Gacha & Cosmetics manifests loaded successfully!');
    renderShardShop();
  } catch (error) {
    console.error('❌', error);
    const gachaResultDisplay = document.getElementById('gacha-result-display');
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Error: Could not load gacha data.</p>`;
    }
    showToast('Failed to load gacha data', 'error');
  }
}

export async function loadGachaState() {
  try {
    const state = await GachaAPI.getState();
    const sanitized = sanitizeGachaState(state);
    
    window.gachaTokens = sanitized.tokens;
    window.gachaShards = sanitized.shards;
    window.waifuCollection = convertBackendCollectionToDisplay(sanitized.collection);
    window.appliedCosmetics = sanitized.appliedCosmetics;
    window.ownedCosmetics = sanitized.ownedCosmetics;
    
    console.log('✅ Gacha state loaded from backend');
    return state;
  } catch (error) {
    logError(error, 'loadGachaState');
    
    if (isSessionExpired(error)) {
      showToast('Your session has expired. Please log out and log back in.', 'error', 5000);
      setTimeout(() => window.location.href = '/logout', 2000);
    } else {
      showToast('Failed to load gacha state', 'error');
    }
    
    window.gachaTokens = 0;
    window.gachaShards = 0;
    window.waifuCollection = [];
    window.appliedCosmetics = {};
    window.ownedCosmetics = [];
    
    throw error;
  }
}

export async function updateGachaTokens(totalEpisodes, totalPulls) {
  try {
    const result = await GachaAPI.calculateTokens(totalEpisodes);
    window.gachaTokens = result.tokens;
    window.gachaShards = result.shards;
    console.log(`✅ Tokens updated: ${result.tokens} tokens, ${result.shards} shards`);
  } catch (error) {
    logError(error, 'updateGachaTokens', { totalEpisodes, totalPulls });
    
    const tokensPerEpisode = window.CONFIG?.GACHA_EPISODES_PER_TOKEN || 50;
    const earnedTokens = Math.floor(totalEpisodes / tokensPerEpisode);
    window.gachaTokens = Math.max(0, earnedTokens - totalPulls);
    
    showToast('Token calculation failed, using local estimate', 'warning');
  }
}

export function renderGachaState() {
  const gachaTokenCount = document.getElementById('gacha-token-count');
  const gachaShardCount = document.getElementById('gacha-shard-count');
  const gachaRollButton = document.getElementById('gacha-roll-button');
  const gachaCollectionDisplay = document.getElementById('gacha-collection-display');
  const gachaStatsDisplay = document.getElementById('gacha-stats-display');

  // Update token/shard counts
  if (gachaTokenCount) gachaTokenCount.textContent = window.gachaTokens;
  if (gachaShardCount) gachaShardCount.textContent = window.gachaShards;
  
  // Update roll button state
  if (gachaRollButton && !isOperationInProgress) {
    gachaRollButton.disabled = window.gachaTokens < 1;
    gachaRollButton.classList.toggle('opacity-50', gachaRollButton.disabled);
  }

  // 🆕 Populate anime filter dropdown
  populateAnimeFilter();

  // 🆕 Apply filters and sorting
  const filteredCollection = filterAndSortCollection();
  const stats = calculateCollectionStats(filteredCollection);

  // 🆕 Update stats display
  if (gachaStatsDisplay) {
    const totalCards = window.waifuCollection.length;
    const uniqueCharacters = new Set(window.waifuCollection.map(card => card.name)).size;
    
    const rarityBadges = `
      ${stats.byRarity.Prismatic > 0 ? `<span class="stat-badge prismatic">✨ ${stats.byRarity.Prismatic}</span>` : ''}
      ${stats.byRarity[5] > 0 ? `<span class="stat-badge legendary">★★★★★ ${stats.byRarity[5]}</span>` : ''}
      ${stats.byRarity[4] > 0 ? `<span class="stat-badge epic">★★★★ ${stats.byRarity[4]}</span>` : ''}
      ${stats.byRarity[3] > 0 ? `<span class="stat-badge rare">★★★ ${stats.byRarity[3]}</span>` : ''}
      ${stats.byRarity[2] > 0 ? `<span class="stat-badge common">★★ ${stats.byRarity[2]}</span>` : ''}
    `;
    
    gachaStatsDisplay.innerHTML = `
      <div class="gacha-stats-bar">
        <span class="stat-item"><strong>Total:</strong> ${totalCards}</span>
        <span class="stat-item"><strong>Unique:</strong> ${uniqueCharacters}</span>
        <span class="stat-separator">|</span>
        ${rarityBadges}
      </div>
      ${stats.total !== totalCards ? `<div class="filter-info">Showing ${stats.total} of ${totalCards} cards</div>` : ''}
    `;
  }

  // 🆕 Render filtered collection
  if (gachaCollectionDisplay) {
    gachaCollectionDisplay.innerHTML = '';
    
    if (filteredCollection.length === 0) {
      const isFiltered = collectionFilters.search || 
                        collectionFilters.rarityFilter.length > 0 || 
                        collectionFilters.animeFilter !== 'all' ||
                        collectionFilters.cosmeticFilter !== 'all';
      
      const message = isFiltered 
        ? 'No cards match your filters. Try adjusting your search or filters.'
        : 'Your collection is empty! Roll to get your first card!';
      
      gachaCollectionDisplay.innerHTML = `
        <p class="col-span-full text-center py-8 theme-text-muted">
          ${message}
        </p>
      `;
    } else {
      filteredCollection.forEach(card => {
        const cardElement = document.createElement('div');
        const rarity = card.rarity || 1;
        const appliedBorder = window.appliedCosmetics[card.image_url] || '';
        const duplicateCount = card.count || 1;

        let starsHTML = '';
        let rarityClass = '';

        if (typeof rarity === 'number') {
          starsHTML = '★'.repeat(rarity);
          rarityClass = `rarity-${rarity}`;
        } else {
          starsHTML = '✨';
          rarityClass = 'rarity-prismatic';
        }

        cardElement.className = `gacha-card ${rarityClass} ${appliedBorder} cursor-pointer`;
        cardElement.dataset.cardUrl = card.image_url;
        cardElement.innerHTML = `
          <div class="card-image-container">
            <img src="${card.image_url}" alt="${card.name}"
                 onerror="this.onerror=null; this.src='https://placehold.co/225x350/cccccc/333333?text=No+Image';"
                 class="card-image">
            ${duplicateCount > 1 ? `<div class="duplicate-badge">x${duplicateCount}</div>` : ''}
          </div>
          <div class="card-name">${card.name}</div>
          <div class="card-anime" title="${card.anime}">${card.anime}</div>
          <div class="card-stars">${starsHTML}</div>
        `;
        cardElement.addEventListener('click', () => openCosmeticModal(card.image_url));
        gachaCollectionDisplay.appendChild(cardElement);
      });
    }
  }
}

export async function resetGachaCollection() {
  if (!canProceedWithOperation('reset', 2000)) {
    showToast('Please wait before resetting again', 'warning');
    return false;
  }
  
  const confirmMessage = '⚠️ Are you sure you want to reset your entire gacha collection?\n\nThis will:\n- Delete all cards\n- Remove all cosmetics\n- Reset tokens to 5\n- Reset shards to 0\n\nThis action CANNOT be undone!';
  
  const confirmed = await showConfirm(confirmMessage);
  if (!confirmed) {
    return false;
  }

  try {
    startOperation('reset');
    
    const result = await GachaAPI.resetCollection();
    
    window.gachaTokens = result.tokens;
    window.gachaShards = result.shards;
    window.waifuCollection = [];
    window.appliedCosmetics = {};
    window.ownedCosmetics = [];
    window.totalPulls = 0;
    
    const gachaResultDisplay = document.getElementById('gacha-result-display');
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `
        <div class="text-center">
          <p class="text-xl font-bold mb-2 text-blue-600">🔄 RESET COMPLETE</p>
          <p class="text-sm text-gray-600">Your collection has been cleared!</p>
        </div>`;
    }
    
    showToast('Collection reset successfully!', 'success');
    
    endOperation(true);
    return true;
    
  } catch (error) {
    logError(error, 'resetGachaCollection');
    
    endOperation(false);
    
    if (isSessionExpired(error)) {
      showToast('Your session has expired. Please log out and log back in.', 'error', 5000);
      setTimeout(() => window.location.href = '/logout', 2000);
    } else {
      showToast(`Failed to reset collection: ${error.message}`, 'error');
    }
    
    return false;
  }
}

export async function rollGacha() {
  const gachaResultDisplay = document.getElementById('gacha-result-display');
  
  if (!canProceedWithOperation('roll', 500)) {
    showToast('Please wait before rolling again', 'warning', 1500);
    return { status: 'error', message: 'Operation in progress' };
  }
  
  if (window.gachaTokens < 1) {
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Not enough tokens!</p>`;
    }
    return { status: 'error', message: 'No tokens' };
  }
  
  if (!gachaManifest || Object.keys(gachaManifest).length === 0) {
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500">Gacha data not loaded.</p>`;
    }
    return { status: 'error', message: 'Gacha manifest not loaded' };
  }

  const animeNames = Object.keys(gachaManifest);
  const randomAnimeName = animeNames[Math.floor(Math.random() * animeNames.length)];
  const characterNames = Object.keys(gachaManifest[randomAnimeName]);
  const randomCharacterName = characterNames[Math.floor(Math.random() * characterNames.length)];
  const variants = gachaManifest[randomAnimeName][randomCharacterName];
  const randomVariant = variants[Math.floor(Math.random() * variants.length)];

  const finalCharacter = {
    name: formatName(randomCharacterName),
    anime: formatName(randomAnimeName),
    image_url: randomVariant.path,
    rarity: randomVariant.rarity
  };

  try {
    startOperation('roll');
    
    const backendCard = convertCardToBackendFormat(finalCharacter);
    const result = await GachaAPI.roll(backendCard);

    window.gachaTokens = result.tokens;
    window.gachaShards = result.shards;

    let returnValue;
    if (result.isDuplicate) {
      returnValue = {
        status: 'duplicate',
        shardsAwarded: result.shardsAwarded,
        card: finalCharacter
      };
    } else {
      finalCharacter.acquiredAt = Date.now();
      window.waifuCollection.unshift(finalCharacter);
      returnValue = {
        status: 'new',
        card: finalCharacter
      };
    }
    
    endOperation(true);
    return returnValue;
    
  } catch (error) {
    logError(error, 'rollGacha', { card: finalCharacter });
    
    endOperation(false);
    
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Roll failed: ${error.message}</p>`;
    }
    
    if (isSessionExpired(error)) {
      showToast('Your session has expired. Please log in again.', 'error', 5000);
      setTimeout(() => window.location.href = '/logout', 2000);
    } else {
      showToast(`Roll failed: ${error.message}`, 'error');
    }
    
    return { status: 'error', message: error.message };
  }
}

export function displayGachaResult(result) {
  const gachaResultDisplay = document.getElementById('gacha-result-display');
  if (!gachaResultDisplay) return;

  if (result.status === 'duplicate') {
    gachaResultDisplay.innerHTML = `
      <div class="text-center">
        <p class="text-xl font-bold mb-2 text-yellow-500">DUPLICATE!</p>
        <p class="text-lg font-semibold">You received +${result.shardsAwarded} ✨ Shards</p>
        <p class="text-sm text-gray-600 mb-2">for a duplicate ${result.card.name}</p>
        <img src="${result.card.image_url}" alt="${result.card.name}" 
             class="w-32 h-auto mx-auto my-3 rounded-lg shadow-xl opacity-70">
      </div>`;
  } else if (result.status === 'new') {
    gachaResultDisplay.innerHTML = `
      <div class="text-center">
        <p class="text-2xl font-bold mb-2 text-green-600">SUCCESS!</p>
        <p class="text-lg font-semibold">You summoned: ${result.card.name}</p>
        <p class="text-sm text-gray-600 mb-2">from ${result.card.anime}</p>
        <img src="${result.card.image_url}" alt="${result.card.name}" 
             class="w-32 h-auto mx-auto my-3 rounded-lg shadow-xl">
      </div>`;
  }
}

function renderShardShop() {
  const packContainer = document.getElementById('cosmetic-pack-container');
  if (!cosmeticsManifest || !packContainer) return;

  packContainer.innerHTML = '';
  for (const packId in cosmeticsManifest.packs) {
    const pack = cosmeticsManifest.packs[packId];
    const packElement = document.createElement('div');
    packElement.className = 'border rounded-lg p-4';
    packElement.innerHTML = `
      <h4 class="font-bold text-lg">${pack.name}</h4>
      <p class="text-sm text-gray-600">Contains various cosmetic items.</p>
      <button class="btn-primary mt-4 buy-pack-btn" data-pack-id="${packId}">
        Buy for ${pack.cost} ✨
      </button>
    `;
    packContainer.appendChild(packElement);
  }
}

export async function buyCosmeticPack(packId) {
  const pack = cosmeticsManifest.packs[packId];
  if (!pack) return null;

  if (!canProceedWithOperation('buyPack', 1000)) {
    showToast('Please wait before buying another pack', 'warning');
    return null;
  }

  if (window.gachaShards < pack.cost) {
    showToast("Not enough shards!", "error");
    return null;
  }

  try {
    startOperation('buyPack');
    
    const cosmeticNames = pack.items.map(item => item.id);
    const result = await GachaAPI.buyPack(pack.cost, cosmeticNames);
    
    window.gachaShards = result.shards;
    result.cosmetics.forEach(cosmeticId => {
      if (!window.ownedCosmetics.includes(cosmeticId)) {
        window.ownedCosmetics.push(cosmeticId);
      }
    });

    const wonItem = pack.items[Math.floor(Math.random() * pack.items.length)];
    const resultDisplay = document.getElementById('cosmetic-result-display');
    const rewardsContainer = document.getElementById('cosmetic-rewards');
    if (resultDisplay && rewardsContainer) {
      resultDisplay.classList.remove('hidden');
      rewardsContainer.innerHTML = `
        <div class="p-2 border rounded text-center">
          <strong>${wonItem.name}</strong><br>
          <span class="text-xs">${wonItem.rarity} ${wonItem.type}</span>
        </div>`;
    }

    showToast(`Purchased ${pack.name}!`, 'success');
    
    endOperation(true);
    return wonItem;
    
  } catch (error) {
    logError(error, 'buyCosmeticPack', { packId, packCost: pack.cost });
    
    endOperation(false);
    
    showToast(`Failed to buy pack: ${error.message}`, 'error');
    return null;
  }
}

export function openCosmeticModal(cardUrl) {
  currentlyCustomizingCardUrl = cardUrl;
  const modal = document.getElementById('cosmetic-modal-backdrop');
  const selectionContainer = document.getElementById('cosmetic-selection-container');
  if (!modal || !selectionContainer) return;

  selectionContainer.innerHTML = '';

  const defaultOption = document.createElement('button');
  defaultOption.className = 'p-2 border rounded hover:bg-gray-100';
  defaultOption.textContent = 'Default';
  defaultOption.onclick = () => applyCosmetic('default');
  selectionContainer.appendChild(defaultOption);

  window.ownedCosmetics.forEach(cosmeticId => {
    if (cosmeticId.startsWith('border-')) {
      const cosmeticOption = document.createElement('button');
      cosmeticOption.className = 'p-2 border rounded hover:bg-gray-100';
      cosmeticOption.textContent = formatName(cosmeticId.replace('border-', '').replace('-', ' '));
      cosmeticOption.onclick = () => applyCosmetic(cosmeticId);
      selectionContainer.appendChild(cosmeticOption);
    }
  });

  modal.classList.add('show');
}

export async function applyCosmetic(cosmeticId) {
  if (!currentlyCustomizingCardUrl) return false;

  try {
    const cosmeticName = cosmeticId === 'default' ? 'Default' : cosmeticId;
    await GachaAPI.applyCosmetic(currentlyCustomizingCardUrl, cosmeticName);
    
    if (cosmeticId === 'default') {
      delete window.appliedCosmetics[currentlyCustomizingCardUrl];
    } else {
      window.appliedCosmetics[currentlyCustomizingCardUrl] = cosmeticId;
    }

    const modal = document.getElementById('cosmetic-modal-backdrop');
    if (modal) modal.classList.remove('show');
    
    renderGachaState();
    showToast('Cosmetic applied!', 'success');
    return true;
  } catch (error) {
    logError(error, 'applyCosmetic', { cardUrl: currentlyCustomizingCardUrl, cosmeticId });
    showToast(`Failed to apply cosmetic: ${error.message}`, 'error');
    return false;
  }
}