// =====================================================================
// --- GACHA FEATURE SCRIPT (gacha.js) - WITH WEIGHTED RARITY SYSTEM ---
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
// RARITY CONFIGURATION
// =====================================================================

const RARITY_RATES = {
  'Prismatic': 0.001,  // 0.1% - Ultra rare
  5: 0.019,            // 1.9% - Legendary (5-star)
  4: 0.08,             // 8% - Epic (4-star)
  3: 0.30,             // 30% - Rare (3-star)
  2: 0.60              // 60% - Common (2-star)
};

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
let currentAnimationFrame = null;
let pendingTimeouts = [];

// State snapshot for rollback
let stateSnapshot = null;

// Filter & Sort State
let collectionFilters = {
  search: '',
  sortBy: 'rarity-desc',
  rarityFilter: [],
  animeFilter: 'all',
  cosmeticFilter: 'all'
};

// =====================================================================
// BACKEND API INTEGRATION
// =====================================================================

export const GachaAPI = {
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

  async buyPack(packId, packCost) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/buy-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, packCost })
      });
      return await validateApiResponse(response, validatePackPurchaseResponse);
    }, {
      maxRetries: 2
    });
  },
  
  async exchangeShards(tokensToExchange) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/exchange-shards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokensToExchange })
      });
      return await validateApiResponse(response, (data) => {
        if (!data.success || typeof data.tokens !== 'number' || typeof data.shards !== 'number') {
          throw new ValidationError('Invalid exchange response', 500);
        }
        return true;
      });
    }, {
      maxRetries: 2
    });
  },
  
  async buyCosmetic(cosmeticId, price) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/buy-cosmetic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosmeticId, price })
      });
      return await validateApiResponse(response, (data) => {
        if (!data.success || typeof data.shards !== 'number') {
          throw new ValidationError('Invalid purchase response', 500);
        }
        return true;
      });
    }, {
      maxRetries: 2
    });
  },
  
  async getCosmeticsList() {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/cosmetics-list');
      return await validateApiResponse(response, (data) => {
        if (!data.success || !Array.isArray(data.cosmetics)) {
          throw new ValidationError('Invalid cosmetics list response', 500);
        }
        return true;
      });
    });
  },
  
  async activateBoost(boostType) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/activate-boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boostType })
      });
      return await validateApiResponse(response, (data) => {
        if (!data.success || typeof data.shards !== 'number') {
          throw new ValidationError('Invalid boost response', 500);
        }
        return true;
      });
    });
  },
  
  async enhanceCard(cardId, enhancementType) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/enhance-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, enhancementType })
      });
      return await validateApiResponse(response, (data) => {
        if (!data.success || typeof data.shards !== 'number') {
          throw new ValidationError('Invalid enhance response', 500);
        }
        return true;
      });
    });
  },
  
  async fuseCards(cardIds, fusionType) {
    return withRetry(async () => {
      const response = await fetch('/api/gacha/fuse-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds, fusionType })
      });
      return await validateApiResponse(response, (data) => {
        if (!data.success || !data.resultCard) {
          throw new ValidationError('Invalid fuse response', 500);
        }
        return true;
      });
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
  },
  
  async setShards(shards) {
    return withRetry(async () => {
      console.log('🔧 [Set Shards] Making request to /api/gacha/set-shards with:', { shards });
      const response = await fetch('/api/gacha/set-shards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ shards })
      });
      console.log('🔧 [Set Shards] Response status:', response.status, response.statusText);
      return await validateApiResponse(response, (data) => {
        if (!data.success || typeof data.shards !== 'number') {
          throw new ValidationError('Invalid set shards response', 500);
        }
        return true;
      });
    });
  },
  
  async setTokens(tokens) {
    return withRetry(async () => {
      console.log('🔧 [Set Tokens] Making request to /api/gacha/set-tokens with:', { tokens });
      const response = await fetch('/api/gacha/set-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ tokens })
      });
      console.log('🔧 [Set Tokens] Response status:', response.status, response.statusText);
      return await validateApiResponse(response, (data) => {
        if (!data.success || typeof data.tokens !== 'number') {
          throw new ValidationError('Invalid set tokens response', 500);
        }
        return true;
      });
    });
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
  
  // Cancel any pending animations/timeouts from previous operations
  cancelAllAnimations();
  
  isOperationInProgress = true;
  currentOperation = operationName;
  stateSnapshot = createStateSnapshot();
  lastOperationTimestamp = Date.now();
  
  updateOperationUI(true);
  
  console.log(`🔒 Operation started: ${operationName}`);
}

function cancelAllAnimations() {
  // Cancel any pending animation frames
  if (currentAnimationFrame !== null) {
    cancelAnimationFrame(currentAnimationFrame);
    currentAnimationFrame = null;
  }
  
  // Clear all pending timeouts
  pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  pendingTimeouts = [];
  
  // Force cleanup of all animation elements including spinner elements
  const cleanupSelectors = [
    '.confetti-particle',
    '.sparkle-particle', 
    '.radial-burst',
    '.rainbow-flash-overlay',
    '.duplicate-pulse-ring',
    '.gacha-spinning-container',
    '.gacha-spinner-track',
    '.gacha-spinner-card',
    '.gacha-spinner-indicator',
    '.spinner-card-placeholder',
    '.spinner-placeholder-stars',
    '.spinner-card-stars',
    '.spinner-card-image',
    '.spinner-card-name',
    '.spinner-card-anime',
    '.rarity-reveal-splash',
    '.card-flip-container'
  ];
  
  cleanupSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (el.style) {
        el.style.animation = 'none';
        el.style.transition = 'none';
      }
      // Remove all children first
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
      if (el.parentNode) {
        el.remove();
      }
    });
  });
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
  const roll10Button = document.getElementById('gacha-10roll-button');
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
      rollButton.textContent = '🎲 ROLL (1 Token)';
    }
    
    rollButton.classList.toggle('opacity-50', rollButton.disabled);
  }
  
  if (roll10Button) {
    const hasTokens10 = window.gachaTokens >= 10;
    roll10Button.disabled = isLoading || !hasTokens10;
    
    if (isLoading) {
      roll10Button.classList.add('loading');
      roll10Button.innerHTML = `
        <span class="spinner"></span>
        <span>Rolling...</span>
      `;
    } else {
      roll10Button.classList.remove('loading');
      roll10Button.textContent = '✨ 10-PULL (10 Tokens)';
    }
    
    roll10Button.classList.toggle('opacity-50', roll10Button.disabled);
  }
  
  if (resetButton) {
    resetButton.disabled = isLoading;
    resetButton.classList.toggle('opacity-50', resetButton.disabled);
  }
  
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
// WEIGHTED RARITY SYSTEM
// =====================================================================

function selectWeightedRarity(boostMultiplier = {}) {
  // Get active boosts from state
  const activeBoosts = window.activeBoosts || {};
  
  // Apply boost multipliers
  const adjustedRates = { ...RARITY_RATES };
  
  if (activeBoosts.luckyHour && new Date(activeBoosts.luckyHour) > new Date()) {
    // 2x 4+ star rate
    adjustedRates[4] = Math.min(adjustedRates[4] * 2, 1.0);
    adjustedRates[5] = Math.min(adjustedRates[5] * 2, 1.0);
    adjustedRates['Prismatic'] = Math.min(adjustedRates['Prismatic'] * 2, 1.0);
  }
  
  if (activeBoosts.prismaticRush && new Date(activeBoosts.prismaticRush) > new Date()) {
    // 5x prismatic rate
    adjustedRates['Prismatic'] = Math.min(adjustedRates['Prismatic'] * 5, 1.0);
  }
  
  // Check for guaranteed pulls
  if (activeBoosts.guaranteedPull === true) {
    // Force 4+ star
    const random = Math.random();
    if (random < 0.5) return 4;
    if (random < 0.8) return 5;
    return 'Prismatic';
  }
  
  if (activeBoosts.prismaticGuarantee === true) {
    // Force prismatic
    return 'Prismatic';
  }
  
  // Normal weighted selection
  const random = Math.random();
  let cumulative = 0;
  
  for (const [rarity, rate] of Object.entries(adjustedRates)) {
    cumulative += rate;
    if (random < cumulative) {
      return rarity === 'Prismatic' ? 'Prismatic' : parseInt(rarity);
    }
  }
  
  return 2; // Fallback
}

function getCardsByRarity(targetRarity) {
  if (!gachaManifest || Object.keys(gachaManifest).length === 0) {
    return [];
  }
  
  const matchingCards = [];
  
  for (const animeName in gachaManifest) {
    for (const characterName in gachaManifest[animeName]) {
      const variants = gachaManifest[animeName][characterName];
      
      variants.forEach(variant => {
        if (variant.rarity === targetRarity) {
          matchingCards.push({
            anime: formatName(animeName),
            character: formatName(characterName),
            variant: variant
          });
        }
      });
    }
  }
  
  return matchingCards;
}

// =====================================================================
// FILTER & SORT FUNCTIONS
// =====================================================================

function getUniqueAnimeList() {
  const animeSet = new Set(window.waifuCollection.map(card => card.anime));
  return Array.from(animeSet).sort();
}

// =====================================================================
// PERFORMANCE OPTIMIZATION (Feature 24) - Debounced filtering
// =====================================================================

let filterTimeout = null;
let cachedFilteredCollection = null;
let collectionCacheDirty = true;

function filterAndSortCollection() {
  // Return cached result if filters haven't changed
  if (!collectionCacheDirty && cachedFilteredCollection !== null) {
    return cachedFilteredCollection;
  }
  
  let filtered = [...window.waifuCollection];

  // Optimize search filter - lowercase once
  if (collectionFilters.search) {
    const searchLower = collectionFilters.search.toLowerCase();
    filtered = filtered.filter(card => {
      const nameLower = card.name.toLowerCase();
      const animeLower = card.anime.toLowerCase();
      return nameLower.includes(searchLower) || animeLower.includes(searchLower);
    });
  }

  // Optimize rarity filter - use Set for O(1) lookup
  if (collectionFilters.rarityFilter.length > 0) {
    const raritySet = new Set(collectionFilters.rarityFilter);
    filtered = filtered.filter(card => {
      const cardRarity = typeof card.rarity === 'number' ? card.rarity : 'Prismatic';
      return raritySet.has(cardRarity);
    });
  }

  if (collectionFilters.animeFilter !== 'all') {
    filtered = filtered.filter(card => card.anime === collectionFilters.animeFilter);
  }

  // Optimize cosmetic filter - check once
  if (collectionFilters.cosmeticFilter === 'with-cosmetics') {
    filtered = filtered.filter(card => window.appliedCosmetics && window.appliedCosmetics[card.image_url]);
  } else if (collectionFilters.cosmeticFilter === 'without-cosmetics') {
    filtered = filtered.filter(card => !window.appliedCosmetics || !window.appliedCosmetics[card.image_url]);
  }

  // Optimize sort - cache comparison values
  const sortFn = (() => {
    switch (collectionFilters.sortBy) {
      case 'rarity-desc':
        return (a, b) => getRarityValue(b.rarity) - getRarityValue(a.rarity);
      case 'rarity-asc':
        return (a, b) => getRarityValue(a.rarity) - getRarityValue(b.rarity);
      case 'name-asc':
        return (a, b) => a.name.localeCompare(b.name);
      case 'name-desc':
        return (a, b) => b.name.localeCompare(a.name);
      case 'anime-asc':
        return (a, b) => a.anime.localeCompare(b.anime);
      case 'date-desc':
        return (a, b) => (b.acquiredAt || 0) - (a.acquiredAt || 0);
      default:
        return () => 0;
    }
  })();

  filtered.sort(sortFn);
  
  // Cache the result
  cachedFilteredCollection = filtered;
  collectionCacheDirty = false;
  
  return filtered;
}

function markCollectionCacheDirty() {
  collectionCacheDirty = true;
  cachedFilteredCollection = null;
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
    },
    byAnime: {},
    uniqueCharacters: new Set(),
    duplicates: 0,
    totalCards: 0
  };
  
  // Calculate stats from full collection (not filtered)
  const fullCollection = window.waifuCollection || [];
  stats.totalCards = fullCollection.length;
  stats.uniqueCharacters = new Set(fullCollection.map(card => card.name)).size;
  stats.duplicates = stats.totalCards - stats.uniqueCharacters;
  
  // Calculate stats from filtered collection
  filtered.forEach(card => {
    const rarity = card.rarity;
    if (stats.byRarity[rarity] !== undefined) {
      stats.byRarity[rarity]++;
    }
    
    // Track anime distribution
    const anime = card.anime || 'Unknown';
    stats.byAnime[anime] = (stats.byAnime[anime] || 0) + 1;
  });
  
  // Calculate average rarity (weighted)
  const rarityWeights = {
    Prismatic: 6,
    5: 5,
    4: 4,
    3: 3,
    2: 2,
    1: 1
  };
  
  let totalWeight = 0;
  let totalCount = 0;
  for (const rarity in stats.byRarity) {
    const count = stats.byRarity[rarity];
    if (count > 0 && rarityWeights[rarity]) {
      totalWeight += count * rarityWeights[rarity];
      totalCount += count;
    }
  }
  stats.averageRarity = totalCount > 0 ? (totalWeight / totalCount).toFixed(2) : 0;
  
  // Get top anime (sorted by count)
  stats.topAnime = Object.entries(stats.byAnime)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([anime, count]) => ({ anime, count }));
  
  // Calculate rarity percentages
  stats.rarityPercentages = {};
  for (const rarity in stats.byRarity) {
    const count = stats.byRarity[rarity];
    stats.rarityPercentages[rarity] = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
  }
  
  return stats;
}

// =====================================================================
// UI INITIALIZATION FOR FILTERS
// =====================================================================

export function initializeGachaFilters() {
  // Initialize dashboard toggle
  initializeDashboardToggle();
  
  // Initialize shard exchange
  initializeShardExchange();
  
  // Initialize direct purchase tab
  initializeDirectPurchaseTab();
  
  const searchInput = document.getElementById('gacha-search');
  const sortSelect = document.getElementById('gacha-sort');
  const animeFilter = document.getElementById('gacha-anime-filter');
  const cosmeticFilter = document.getElementById('gacha-cosmetic-filter');
  const clearFiltersBtn = document.getElementById('gacha-clear-filters');
  
  if (searchInput) {
    // Debounce search input for performance (Feature 24)
    searchInput.addEventListener('input', (e) => {
      collectionFilters.search = e.target.value;
      markCollectionCacheDirty();
      
      // Clear existing timeout
      if (filterTimeout) {
        clearTimeout(filterTimeout);
      }
      
      // Debounce render
      filterTimeout = setTimeout(() => {
        renderGachaState();
      }, 300);
    });
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      collectionFilters.sortBy = e.target.value;
      markCollectionCacheDirty();
      renderGachaState();
    });
  }

  if (animeFilter) {
    animeFilter.addEventListener('change', (e) => {
      collectionFilters.animeFilter = e.target.value;
      markCollectionCacheDirty();
      renderGachaState();
    });
  }

  if (cosmeticFilter) {
    cosmeticFilter.addEventListener('change', (e) => {
      collectionFilters.cosmeticFilter = e.target.value;
      markCollectionCacheDirty();
      renderGachaState();
    });
  }

  const rarityCheckboxes = document.querySelectorAll('.rarity-filter-checkbox');
  rarityCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateRarityFilter();
      markCollectionCacheDirty();
      renderGachaState();
    });
  });
  
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
  collectionFilters = {
    search: '',
    sortBy: 'rarity-desc',
    rarityFilter: [],
    animeFilter: 'all',
    cosmeticFilter: 'all'
  };
  
  const searchInput = document.getElementById('gacha-search');
  const sortSelect = document.getElementById('gacha-sort');
  const animeFilter = document.getElementById('gacha-anime-filter');
  const cosmeticFilter = document.getElementById('gacha-cosmetic-filter');
  
  if (searchInput) searchInput.value = '';
  if (sortSelect) sortSelect.value = 'rarity-desc';
  if (animeFilter) animeFilter.value = 'all';
  if (cosmeticFilter) cosmeticFilter.value = 'all';
  
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
  
  animeFilter.innerHTML = '<option value="all">All Anime</option>';
  
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

// =====================================================================
// OFFLINE SUPPORT (Feature 25) - localStorage caching
// =====================================================================

const CACHE_KEY = 'gacha_state_cache';
const CACHE_TIMESTAMP_KEY = 'gacha_state_cache_timestamp';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

function saveStateToCache(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn('Failed to save state to cache:', error);
  }
}

function loadStateFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    const age = Date.now() - parseInt(timestamp);
    if (age > CACHE_EXPIRY) {
      // Cache expired
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      return null;
    }
    
    return JSON.parse(cached);
  } catch (error) {
    console.warn('Failed to load state from cache:', error);
    return null;
  }
}

function isOnline() {
  return navigator.onLine !== false;
}

export async function loadGachaState() {
  try {
    let state;
    
    if (isOnline()) {
      // Try to fetch from server
      try {
        state = await GachaAPI.getState();
        // Save to cache on successful fetch
        saveStateToCache(state);
      } catch (error) {
        // If fetch fails, try cache
        console.warn('Failed to fetch state, trying cache...', error);
        const cached = loadStateFromCache();
        if (cached) {
          state = cached;
          showToast('Using cached data (offline mode)', 'info', 2000);
        } else {
          throw error;
        }
      }
    } else {
      // Offline mode - use cache
      const cached = loadStateFromCache();
      if (cached) {
        state = cached;
        showToast('Using cached data (offline mode)', 'info', 2000);
      } else {
        throw new Error('No cached data available');
      }
    }
    
    const sanitized = sanitizeGachaState(state);
    
    window.gachaTokens = sanitized.tokens;
    window.gachaShards = sanitized.shards;
    window.waifuCollection = convertBackendCollectionToDisplay(sanitized.collection);
    window.appliedCosmetics = sanitized.appliedCosmetics;
    window.ownedCosmetics = sanitized.ownedCosmetics;
    window.remainingDailyExchanges = sanitized.remainingDailyExchanges || 10;
    window.activeBoosts = sanitized.activeBoosts || {};
    
    // Mark cache dirty when collection changes
    markCollectionCacheDirty();
    
    console.log('✅ Gacha state loaded', isOnline() ? 'from backend' : 'from cache');
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
  const remainingExchanges = document.getElementById('remaining-exchanges');

  if (gachaTokenCount) gachaTokenCount.textContent = window.gachaTokens;
  if (gachaShardCount) gachaShardCount.textContent = window.gachaShards;
  if (remainingExchanges) {
    const remaining = window.remainingDailyExchanges || 10;
    remainingExchanges.textContent = `Daily exchanges: ${remaining} remaining`;
  }
  
  if (gachaRollButton && !isOperationInProgress) {
    gachaRollButton.disabled = window.gachaTokens < 1;
    gachaRollButton.classList.toggle('opacity-50', gachaRollButton.disabled);
  }

  populateAnimeFilter();

  const filteredCollection = filterAndSortCollection();
  const stats = calculateCollectionStats(filteredCollection);

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
  
  // Update dashboard if it's open (lazy-loaded, only updates when visible)
  const dashboardContent = document.getElementById('dashboard-content');
  if (dashboardContent && !dashboardContent.classList.contains('hidden')) {
    renderCollectionDashboard(stats);
  }

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
        cardElement.addEventListener('click', () => openCardDetailsModal(card));
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

  const selectedRarity = selectWeightedRarity();
  console.log(`🎲 Rolled rarity: ${selectedRarity}`);
  
  let cardsOfRarity = getCardsByRarity(selectedRarity);
  
  if (cardsOfRarity.length === 0) {
    console.warn(`⚠️ No cards found for rarity ${selectedRarity}, falling back to random`);
    
    const allRarities = [2, 3, 4, 5, 'Prismatic'];
    for (const fallbackRarity of allRarities) {
      cardsOfRarity = getCardsByRarity(fallbackRarity);
      if (cardsOfRarity.length > 0) {
        console.log(`✔ Using fallback rarity: ${fallbackRarity}`);
        break;
      }
    }
    
    if (cardsOfRarity.length === 0) {
      console.error('❌ No cards available in manifest, using random selection');
      const animeNames = Object.keys(gachaManifest);
      const randomAnimeName = animeNames[Math.floor(Math.random() * animeNames.length)];
      const characterNames = Object.keys(gachaManifest[randomAnimeName]);
      const randomCharacterName = characterNames[Math.floor(Math.random() * characterNames.length)];
      const variants = gachaManifest[randomAnimeName][randomCharacterName];
      const randomVariant = variants[Math.floor(Math.random() * variants.length)];
      
      cardsOfRarity = [{
        anime: formatName(randomAnimeName),
        character: formatName(randomCharacterName),
        variant: randomVariant
      }];
    }
  }
  
  const selectedCard = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
  
  const finalCharacter = {
    name: selectedCard.character,
    anime: selectedCard.anime,
    image_url: selectedCard.variant.path,
    rarity: selectedCard.variant.rarity
  };
  
  console.log(`✨ Pulled: ${finalCharacter.name} from ${finalCharacter.anime} (${finalCharacter.rarity})`);

  try {
    startOperation('roll');
    
    const backendCard = convertCardToBackendFormat(finalCharacter);
    const result = await GachaAPI.roll(backendCard);

    window.gachaTokens = result.tokens;
    window.gachaShards = result.shards;
    
    console.log(`💰 [Frontend] Updated tokens: ${result.tokens}, shards: ${result.shards}`);
    if (result.isDuplicate) {
      console.log(`✨ [Frontend] Duplicate! Awarded ${result.shardsAwarded} shards`);
    }

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
    
    // Don't end operation here - let displayGachaResult handle it after animation completes
    // The operation will be ended when the animation completes
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

// =====================================================================
// 10-PULL MULTI-ROLL (Feature 1)
// =====================================================================

export async function rollGacha10() {
  const gachaResultDisplay = document.getElementById('gacha-result-display');
  
  if (!canProceedWithOperation('roll10', 500)) {
    showToast('Please wait before rolling again', 'warning', 1500);
    return { status: 'error', message: 'Operation in progress' };
  }
  
  if (window.gachaTokens < 10) {
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Not enough tokens! Need 10 tokens for 10-Pull.</p>`;
    }
    return { status: 'error', message: 'No tokens' };
  }
  
  if (!gachaManifest || Object.keys(gachaManifest).length === 0) {
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500">Gacha data not loaded.</p>`;
    }
    return { status: 'error', message: 'Gacha manifest not loaded' };
  }

  try {
    startOperation('roll10');
    
    const results = [];
    let guaranteed4Plus = false;
    
    // Roll 10 cards - ensure at least one 4+ star
    for (let i = 0; i < 10; i++) {
      const selectedRarity = selectWeightedRarity();
      let cardsOfRarity = getCardsByRarity(selectedRarity);
      
      // If this is the 10th card and we haven't gotten a 4+ star yet, force one
      if (i === 9 && !guaranteed4Plus) {
        // Force a 4 or 5 star
        const highRarities = [5, 4];
        for (const rarity of highRarities) {
          cardsOfRarity = getCardsByRarity(rarity);
          if (cardsOfRarity.length > 0) {
            break;
          }
        }
        if (cardsOfRarity.length === 0) {
          // Fallback to any rarity if no 4+ stars available
          cardsOfRarity = getCardsByRarity(3);
        }
      }
      
      if (cardsOfRarity.length === 0) {
        // Fallback to random if no cards found
        const allRarities = [2, 3, 4, 5, 'Prismatic'];
        for (const fallbackRarity of allRarities) {
          cardsOfRarity = getCardsByRarity(fallbackRarity);
          if (cardsOfRarity.length > 0) break;
        }
      }
      
      const selectedCard = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
      const rarity = selectedCard.variant.rarity;
      
      if (rarity >= 4 || rarity === 'Prismatic') {
        guaranteed4Plus = true;
      }
      
      const finalCharacter = {
        name: selectedCard.character,
        anime: selectedCard.anime,
        image_url: selectedCard.variant.path,
        rarity: selectedCard.variant.rarity
      };
      
      const backendCard = convertCardToBackendFormat(finalCharacter);
      const result = await GachaAPI.roll(backendCard);
      
      window.gachaTokens = result.tokens;
      window.gachaShards = result.shards;
      
      if (result.isDuplicate) {
        results.push({
          status: 'duplicate',
          shardsAwarded: result.shardsAwarded,
          card: finalCharacter
        });
      } else {
        finalCharacter.acquiredAt = Date.now();
        window.waifuCollection.unshift(finalCharacter);
        results.push({
          status: 'new',
          card: finalCharacter
        });
      }
    }
    
    // Update final token/shard counts
    const finalState = await GachaAPI.getState();
    window.gachaTokens = finalState.tokens;
    window.gachaShards = finalState.shards;
    
    endOperation(true);
    return {
      status: 'success',
      results: results
    };
    
  } catch (error) {
    logError(error, 'rollGacha10', {});
    endOperation(false);
    
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">10-Pull failed: ${error.message}</p>`;
    }
    
    if (isSessionExpired(error)) {
      showToast('Your session has expired. Please log in again.', 'error', 5000);
      setTimeout(() => window.location.href = '/logout', 2000);
    } else {
      showToast(`10-Pull failed: ${error.message}`, 'error');
    }
    
    return { status: 'error', message: error.message };
  }
}

export function displayGacha10Result(result) {
  const gachaResultDisplay = document.getElementById('gacha-result-display');
  if (!gachaResultDisplay || !result.results) return;
  
  // Clean up any previous animations
  cancelAllAnimations();
  gachaResultDisplay.innerHTML = '';
  gachaResultDisplay.classList.remove('gacha-rolling', 'screen-shake');
  
  // Create grid container for 10 results
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
  
  result.results.forEach((cardResult, index) => {
    const card = cardResult.card;
    const rarity = card.rarity || 1;
    const rarityClass = typeof rarity === 'number' ? `rarity-${rarity}` : 'rarity-prismatic';
    const rarityText = typeof rarity === 'number' ? '★'.repeat(rarity) : '✨ PRISMATIC';
    
    const cardElement = document.createElement('div');
    cardElement.className = `gacha-card ${rarityClass} cursor-pointer animate-pop-in`;
    cardElement.style.animationDelay = `${index * 0.1}s`;
    cardElement.innerHTML = `
      <div class="card-image-container">
        <img src="${card.image_url}" alt="${card.name}" 
             onerror="this.onerror=null; this.src='https://placehold.co/225x350/cccccc/333333?text=No+Image';"
             class="card-image">
        ${cardResult.status === 'duplicate' ? '<div class="duplicate-badge">DUPLICATE</div>' : '<div class="new-badge">NEW</div>'}
      </div>
      <div class="card-name">${card.name}</div>
      <div class="card-anime">${card.anime}</div>
      <div class="card-stars">${rarityText}</div>
      ${cardResult.status === 'duplicate' ? `<div class="text-xs text-center mt-1 text-yellow-500">+${cardResult.shardsAwarded} ✨</div>` : ''}
    `;
    
    cardElement.addEventListener('click', () => openCardDetailsModal(card));
    gridContainer.appendChild(cardElement);
  });
  
  gachaResultDisplay.appendChild(gridContainer);
  
  // Show summary
  const summary = document.createElement('div');
  summary.className = 'mt-4 text-center';
  const newCount = result.results.filter(r => r.status === 'new').length;
  const duplicateCount = result.results.filter(r => r.status === 'duplicate').length;
  const totalShards = result.results.filter(r => r.status === 'duplicate').reduce((sum, r) => sum + (r.shardsAwarded || 0), 0);
  
  summary.innerHTML = `
    <p class="text-lg font-bold theme-text-primary mb-2">10-Pull Complete!</p>
    <p class="text-sm theme-text-secondary">
      ${newCount} New • ${duplicateCount} Duplicates ${totalShards > 0 ? `• +${totalShards} ✨ Shards` : ''}
    </p>
  `;
  gachaResultDisplay.appendChild(summary);
}

// =====================================================================
// 🎬 ANIMATION HELPER FUNCTIONS
// =====================================================================

function createConfetti() {
  // Clean up any existing confetti first
  document.querySelectorAll('.confetti-particle').forEach(el => {
    if (el.style) {
      el.style.animation = 'none';
    }
    el.remove();
  });
  
  const colors = ['#f43f5e', '#eab308', '#84cc16', '#22d3ee', '#8b5cf6'];
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-particle';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
    document.body.appendChild(confetti);
    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.remove();
      }
    }, 5000);
  }
}

function createSparkles(container, count) {
  // Clean up any existing sparkles first
  container.querySelectorAll('.sparkle-particle').forEach(el => {
    if (el.style) {
      el.style.animation = 'none';
    }
    el.remove();
  });
  
  const positions = [
    { top: '10%', left: '10%' },
    { top: '10%', right: '10%' },
    { top: '50%', left: '5%' },
    { top: '50%', right: '5%' },
    { bottom: '10%', left: '15%' },
    { bottom: '10%', right: '15%' },
    { top: '30%', left: '50%' },
    { bottom: '30%', left: '50%' }
  ];

  for (let i = 0; i < Math.min(count, positions.length); i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle-particle';
    Object.assign(sparkle.style, positions[i]);
    sparkle.style.animationDelay = (i * 0.1) + 's';
    container.appendChild(sparkle);
    setTimeout(() => {
      if (sparkle.parentNode) {
        sparkle.remove();
      }
    }, 2000);
  }
}

// =====================================================================
// 🎬 ENHANCED DISPLAY WITH ANIMATIONS
// =====================================================================

function createSpinningWheel(container, finalCard, rarityClass, rarityText, result) {
  // Create spinning effect with multiple placeholder cards
  const spinningContainer = document.createElement('div');
  spinningContainer.className = 'gacha-spinning-container';
  
  // Generate random placeholder cards for the spinning effect
  const placeholderCards = [];
  for (let i = 0; i < 10; i++) {
    const randomRarity = Math.floor(Math.random() * 4) + 2; // 2-5
    placeholderCards.push({ rarity: randomRarity });
  }
  
  const track = document.createElement('div');
  track.className = 'gacha-spinner-track';
  
  // Add some padding cards at the start so we can see cards scrolling in
  for (let i = 0; i < 3; i++) {
    const paddingCard = document.createElement('div');
    paddingCard.className = 'gacha-spinner-card rarity-2';
    paddingCard.style.opacity = '0.3';
    const stars = '★'.repeat(2);
    paddingCard.innerHTML = `
      <div class="spinner-card-image">
        <div class="spinner-card-placeholder rarity-2" style="display: flex; align-items: center; justify-content: center;">
          <span class="spinner-placeholder-stars rarity-2">${stars}</span>
        </div>
      </div>
      <div class="spinner-card-stars rarity-2">${stars}</div>
    `;
    track.appendChild(paddingCard);
  }
  
  // Add placeholder cards
  placeholderCards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = `gacha-spinner-card rarity-${card.rarity}`;
    const stars = '★'.repeat(card.rarity);
    cardEl.innerHTML = `
      <div class="spinner-card-image">
        <div class="spinner-card-placeholder rarity-${card.rarity}" style="display: flex; align-items: center; justify-content: center;">
          <span class="spinner-placeholder-stars rarity-${card.rarity}">${stars}</span>
        </div>
      </div>
      <div class="spinner-card-stars rarity-${card.rarity}">${stars}</div>
    `;
    track.appendChild(cardEl);
  });
  
  // Add final card at the end
  const finalCardEl = document.createElement('div');
  finalCardEl.className = `gacha-spinner-card final-card ${rarityClass}`;
  finalCardEl.innerHTML = `
    <div class="spinner-card-image">
      <img src="${finalCard.image_url}" alt="${finalCard.name}" onerror="this.onerror=null; this.src='https://placehold.co/225x350/cccccc/333333?text=No+Image';">
    </div>
    <div class="spinner-card-name">${finalCard.name}</div>
    <div class="spinner-card-anime">${finalCard.anime}</div>
    <div class="spinner-card-stars ${rarityClass}">${rarityText}</div>
  `;
  track.appendChild(finalCardEl);
  
  // Add indicator line
  const indicator = document.createElement('div');
  indicator.className = 'gacha-spinner-indicator';
  
  spinningContainer.appendChild(track);
  spinningContainer.appendChild(indicator);
  container.appendChild(spinningContainer);
  
  // Start spinning animation - need to wait for DOM to render
  currentAnimationFrame = requestAnimationFrame(() => {
    // Check if operation was cancelled
    if (!isOperationInProgress || currentOperation !== 'roll') {
      spinningContainer.remove();
      currentAnimationFrame = null;
      return;
    }
    
    const duration = 2500; // 2.5 seconds of spinning
    const startTime = Date.now();
    
    // Calculate total scroll distance (card width + gap)
    const cardWidth = 200; // px
    const gap = 16; // px
    const cardUnit = cardWidth + gap;
    
    // Calculate position to center the final card on the indicator
    // The container center is where the indicator is, so we want the final card centered there
    const containerWidth = spinningContainer.clientWidth || container.clientWidth;
    const centerOffset = (containerWidth / 2) - (cardWidth / 2);
    
    // Total cards: padding (3) + placeholders (10) + final (1) = 14
    // We want to scroll so the final card (index 14) is centered
    const paddingCards = 3;
    const totalPlaceholders = placeholderCards.length;
    // Position of final card start: (padding + placeholders) * cardUnit
    const finalCardStart = (paddingCards + totalPlaceholders) * cardUnit;
    // We want final card centered, so scroll to: finalCardStart - centerOffset
    const totalScroll = finalCardStart - centerOffset;
    
    // Animate spinning
    function animate() {
      // Check if operation was cancelled
      if (!isOperationInProgress || currentOperation !== 'roll') {
        if (currentAnimationFrame) {
          cancelAnimationFrame(currentAnimationFrame);
        }
        spinningContainer.remove();
        currentAnimationFrame = null;
        return;
      }
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out function for smooth deceleration (cubic ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      // Calculate position in pixels
      const position = easeOut * totalScroll;
      
      track.style.transform = `translateX(-${position}px)`;
      
      if (progress < 1) {
        currentAnimationFrame = requestAnimationFrame(animate);
      } else {
        // Spinning complete, clean up ALL spinner elements immediately
        currentAnimationFrame = null;
        
        // Force remove the entire spinning container and all its children
        if (spinningContainer && spinningContainer.parentNode) {
          // Remove all children first
          while (spinningContainer.firstChild) {
            spinningContainer.removeChild(spinningContainer.firstChild);
          }
          spinningContainer.remove();
        }
        
        // Clean up any orphaned spinner elements
        container.querySelectorAll('.gacha-spinning-container, .gacha-spinner-track, .gacha-spinner-card, .gacha-spinner-indicator, .spinner-card-placeholder, .spinner-placeholder-stars, .spinner-card-stars').forEach(el => el.remove());
        
        container.classList.remove('gacha-rolling');
        
        const timeoutId = setTimeout(() => {
          // Check again before revealing
          if (isOperationInProgress && currentOperation === 'roll') {
            revealFinalCard(container, finalCard, rarityClass, rarityText, result);
          }
        }, 300);
        pendingTimeouts.push(timeoutId);
      }
    }
    
    currentAnimationFrame = requestAnimationFrame(animate);
  });
}

function revealFinalCard(container, finalCard, rarityClass, rarityText, result) {
  const rarity = finalCard.rarity;
  
  // Clean up any leftover elements from previous reveals
  container.innerHTML = '';
  
  // Step 1: Show rarity reveal splash
  const rarityReveal = document.createElement('div');
  rarityReveal.className = `rarity-reveal-splash ${rarityClass}`;
  rarityReveal.textContent = rarityText;
  container.appendChild(rarityReveal);
  
  // Step 2: Add screen effects for high rarity (with cleanup guards)
  if (rarity === 'Prismatic') {
    // Clean up any existing rainbow flashes first
    document.querySelectorAll('.rainbow-flash-overlay').forEach(el => el.remove());
    
    // Rainbow flash overlay
    const rainbowFlash = document.createElement('div');
    rainbowFlash.className = 'rainbow-flash-overlay';
    document.body.appendChild(rainbowFlash);
    const timeoutId = setTimeout(() => {
      if (rainbowFlash.parentNode) {
        rainbowFlash.remove();
      }
    }, 1000);
    rainbowFlash.dataset.timeoutId = timeoutId;

    // Clean up any existing confetti first
    document.querySelectorAll('.confetti-particle').forEach(el => el.remove());
    // Confetti particles
    createConfetti();
  } else if (rarity === 5 || rarity === 4) {
    // Screen shake for legendary/epic
    container.classList.remove('screen-shake'); // Remove first to reset animation
    requestAnimationFrame(() => {
      container.classList.add('screen-shake');
      setTimeout(() => container.classList.remove('screen-shake'), 500);
    });
  }

  // Step 3: Add radial burst (with cleanup guard) - REMOVED for now to avoid circle artifacts
  // The radial burst was causing circle artifacts that persist
  // if (rarity >= 3 || rarity === 'Prismatic') {
  //   // Clean up any existing bursts first
  //   container.querySelectorAll('.radial-burst').forEach(el => el.remove());
  //   
  //   const burst = document.createElement('div');
  //   burst.className = `radial-burst ${rarityClass}`;
  //   container.appendChild(burst);
  //   
  //   // Store timeout ID for potential cleanup
  //   const timeoutId = setTimeout(() => {
  //     if (burst.parentNode) {
  //       burst.remove();
  //     }
  //   }, 1000);
  //   
  //   // Store timeout ID on element for cleanup if needed
  //   burst.dataset.timeoutId = timeoutId;
  // }

  // Step 4: After rarity reveal, show the card with flip animation
  setTimeout(() => {
    rarityReveal.remove();

    if (result.status === 'duplicate') {
      // Duplicate card display with pulse ring
      const duplicateContainer = document.createElement('div');
      duplicateContainer.className = 'card-flip-container text-center';
      duplicateContainer.innerHTML = `
        <div class="gacha-card ${rarityClass} holographic inline-block relative">
          <div class="card-image-container">
            <img src="${result.card.image_url}" alt="${result.card.name}" 
                 class="card-image opacity-70">
            <div class="duplicate-badge">DUPLICATE</div>
          </div>
          <div class="card-name">${result.card.name}</div>
          <div class="card-anime">${result.card.anime}</div>
          <div class="card-stars">${rarityText}</div>
        </div>
        <p class="text-xl font-bold mt-4 text-yellow-500">+${result.shardsAwarded} ✨ SHARDS!</p>
        <p class="text-sm text-gray-600 mt-2">Duplicate converted to shards</p>
      `;

      // Clean up any existing pulse rings first
      duplicateContainer.querySelectorAll('.duplicate-pulse-ring').forEach(el => el.remove());
      
      // Add pulse ring effect
      const pulseRing = document.createElement('div');
      pulseRing.className = 'duplicate-pulse-ring';
      duplicateContainer.querySelector('.gacha-card').appendChild(pulseRing);
      const timeoutId = setTimeout(() => {
        if (pulseRing.parentNode) {
          pulseRing.remove();
        }
      }, 1000);
      pulseRing.dataset.timeoutId = timeoutId;

      container.appendChild(duplicateContainer);
      
      // End operation after animation completes
      setTimeout(() => {
        endOperation(true);
      }, 500);

    } else if (result.status === 'new') {
      // New card display with full animations - wait for image to load first
      const cardContainer = document.createElement('div');
      cardContainer.className = 'card-flip-container text-center';
      
      // Create image first and wait for it to load
      const img = new Image();
      img.src = result.card.image_url;
      img.alt = result.card.name;
      img.className = 'card-image';
      img.onerror = function() {
        this.onerror = null;
        this.src = 'https://placehold.co/225x350/cccccc/333333?text=No+Image';
        showCard();
      };
      
      function showCard() {
        // Clean up any existing elements first
        container.querySelectorAll('.card-flip-container, .sparkle-particle').forEach(el => el.remove());
        
        cardContainer.innerHTML = `
          <div class="gacha-card ${rarityClass} holographic animate-pop-in inline-block relative">
            <div class="card-image-container">
              ${img.outerHTML}
            </div>
            <div class="card-name">${result.card.name}</div>
            <div class="card-anime">${result.card.anime}</div>
            <div class="card-stars">${rarityText}</div>
          </div>
          <p class="text-2xl font-bold mt-4 text-green-600">NEW CARD!</p>
          <p class="text-lg font-semibold mt-2">${result.card.name}</p>
          <p class="text-sm text-gray-600">from ${result.card.anime}</p>
        `;

        container.appendChild(cardContainer);

        // Clean up any existing sparkles first
        container.querySelectorAll('.sparkle-particle').forEach(el => el.remove());
        
        // Add sparkle particles for high rarity
        if (rarity >= 4 || rarity === 'Prismatic') {
          createSparkles(container, 8);
        }
        
        // End operation after animation completes
        setTimeout(() => {
          endOperation(true);
        }, 500);
      }
      
      if (img.complete) {
        showCard();
      } else {
        img.onload = showCard;
        // Fallback timeout in case image never loads
        setTimeout(showCard, 2000);
      }
    }
  }, 1500); // Wait for rarity reveal animation
}

export function displayGachaResult(result) {
  // Check if result is valid
  if (!result || !result.card) {
    console.error('Invalid result passed to displayGachaResult:', result);
    return;
  }
  
  // If another operation is in progress, cancel it
  if (isOperationInProgress && currentOperation !== 'roll') {
    cancelAllAnimations();
  }
  
  const gachaResultDisplay = document.getElementById('gacha-result-display');
  if (!gachaResultDisplay) {
    console.error('gacha-result-display element not found!');
    return;
  }

  const rarity = result.card.rarity;
  const rarityClass = typeof rarity === 'number' ? `rarity-${rarity}` : 'rarity-prismatic';
  const rarityText = typeof rarity === 'number' ? '★'.repeat(rarity) : '✨ PRISMATIC';

  console.log('🎬 Displaying gacha result:', result.card.name, rarity);

  // Cancel all previous animations first
  cancelAllAnimations();
  
  // Also clean up any elements in the result display
  gachaResultDisplay.innerHTML = '';
  gachaResultDisplay.classList.remove('gacha-rolling', 'screen-shake');
  gachaResultDisplay.classList.add('gacha-rolling');
  
  // Create spinning wheel effect with multiple cards
  createSpinningWheel(gachaResultDisplay, result.card, rarityClass, rarityText, result);
}

function renderShardShop() {
  const packContainer = document.getElementById('cosmetic-pack-container');
  if (!cosmeticsManifest || !packContainer) return;

  packContainer.innerHTML = '';
  for (const packId in cosmeticsManifest.packs) {
    const pack = cosmeticsManifest.packs[packId];
    const packElement = document.createElement('div');
    packElement.className = 'gacha-pack';
    packElement.innerHTML = `
      <h4 class="gacha-pack-title">${pack.name}</h4>
      <p class="gacha-pack-description">Contains various cosmetic items.</p>
      <button class="buy-pack-btn" data-pack-id="${packId}">
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
    
    const result = await GachaAPI.buyPack(packId, pack.cost);
    
    window.gachaShards = result.shards;
    result.cosmetics.forEach(cosmeticId => {
      if (!window.ownedCosmetics.includes(cosmeticId)) {
        window.ownedCosmetics.push(cosmeticId);
      }
    });

    // Display all won cosmetics
    const resultDisplay = document.getElementById('cosmetic-result-display');
    const rewardsContainer = document.getElementById('cosmetic-rewards');
    if (resultDisplay && rewardsContainer) {
      resultDisplay.classList.remove('hidden');
      
      const cosmeticsList = result.cosmetics.map(cosmeticId => {
        const cosmetic = pack.items.find(item => item.id === cosmeticId);
        if (!cosmetic) return null;
        return `
          <div class="p-2 border rounded text-center">
            <strong>${cosmetic.name}</strong><br>
            <span class="text-xs">${cosmetic.rarity} ${cosmetic.type}</span>
          </div>`;
      }).filter(Boolean).join('');
      
      rewardsContainer.innerHTML = cosmeticsList || '<p>No new cosmetics received.</p>';
    }

    showToast(`Purchased ${pack.name}!`, 'success');
    
    endOperation(true);
    return result.cosmetics;
    
  } catch (error) {
    logError(error, 'buyCosmeticPack', { packId, packCost: pack.cost });
    
    endOperation(false);
    
    showToast(`Failed to buy pack: ${error.message}`, 'error');
    return null;
  }
}

// =====================================================================
// CARD DETAILS MODAL (Feature 5)
// =====================================================================

export function openCardDetailsModal(card) {
  const modalBackdrop = document.getElementById('card-details-modal-backdrop');
  const modalContent = document.getElementById('card-details-content');
  
  if (!modalBackdrop || !modalContent) return;
  
  const rarity = card.rarity || 1;
  const rarityClass = typeof rarity === 'number' ? `rarity-${rarity}` : 'rarity-prismatic';
  const rarityText = typeof rarity === 'number' ? '★'.repeat(rarity) : '✨ PRISMATIC';
  const duplicateCount = card.count || 1;
  const acquiredAt = card.acquiredAt ? new Date(card.acquiredAt).toLocaleDateString() : 'Unknown';
  const appliedBorder = window.appliedCosmetics?.[card.image_url] || '';
  
  modalContent.innerHTML = `
    <div class="gacha-card ${rarityClass} ${appliedBorder} inline-block mb-4 max-w-xs mx-auto">
      <div class="card-image-container" style="height: 400px;">
        <img src="${card.image_url}" alt="${card.name}" 
             onerror="this.onerror=null; this.src='https://placehold.co/225x350/cccccc/333333?text=No+Image';"
             class="card-image w-full h-full object-cover">
        ${duplicateCount > 1 ? `<div class="duplicate-badge">x${duplicateCount}</div>` : ''}
      </div>
      <div class="card-name text-xl mt-4">${card.name}</div>
      <div class="card-anime text-lg mt-2">${card.anime}</div>
      <div class="card-stars text-2xl mt-2">${rarityText}</div>
    </div>
    <div class="mt-6 space-y-3 text-left max-w-md mx-auto">
      <div class="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span class="font-semibold theme-text-secondary">Rarity:</span>
        <span class="font-bold theme-text-primary">${rarityText}</span>
      </div>
      <div class="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span class="font-semibold theme-text-secondary">Copies:</span>
        <span class="font-bold theme-text-primary">${duplicateCount}</span>
      </div>
      <div class="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span class="font-semibold theme-text-secondary">Acquired:</span>
        <span class="font-bold theme-text-primary">${acquiredAt}</span>
      </div>
      ${appliedBorder ? `
        <div class="flex justify-between items-center p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg">
          <span class="font-semibold theme-text-secondary">Cosmetic:</span>
          <span class="font-bold theme-text-primary">Applied ✨</span>
        </div>
      ` : ''}
    </div>
  `;
  
  modalBackdrop.classList.add('show');
}

export function closeCardDetailsModal() {
  const modalBackdrop = document.getElementById('card-details-modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.classList.remove('show');
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

// =====================================================================
// 🎲 OPTIONAL: Display Rarity Rates to Users
// =====================================================================

export function displayRarityRates() {
  const ratesHTML = `
    <div class="rarity-rates-info text-center p-4 bg-gray-50 rounded-lg">
      <h4 class="font-bold mb-3 text-lg">Drop Rates</h4>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between items-center">
          <span class="rarity-label prismatic">✨ Prismatic</span>
          <span class="font-semibold text-purple-600">${(RARITY_RATES['Prismatic'] * 100).toFixed(2)}%</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="rarity-label legendary">★★★★★ Legendary</span>
          <span class="font-semibold text-yellow-600">${(RARITY_RATES[5] * 100).toFixed(2)}%</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="rarity-label epic">★★★★ Epic</span>
          <span class="font-semibold text-purple-600">${(RARITY_RATES[4] * 100).toFixed(1)}%</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="rarity-label rare">★★★ Rare</span>
          <span class="font-semibold text-blue-600">${(RARITY_RATES[3] * 100).toFixed(0)}%</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="rarity-label common">★★ Common</span>
          <span class="font-semibold text-gray-600">${(RARITY_RATES[2] * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  `;
  
  return ratesHTML;
}

// =====================================================================
// COLLECTION STATISTICS DASHBOARD (Feature 19)
// =====================================================================

let dashboardInitialized = false;

function renderCollectionDashboard(stats) {
  const dashboardContent = document.getElementById('dashboard-content');
  if (!dashboardContent) return;
  
  // Only render if dashboard is open (lazy loading for performance)
  if (!dashboardContent.classList.contains('hidden')) {
    const totalCards = stats.totalCards || 0;
    const uniqueCharacters = stats.uniqueCharacters || 0;
    const duplicates = stats.duplicates || 0;
    
    // Calculate collection completion (based on manifest if available)
    let completionPercentage = 0;
    if (gachaManifest && totalCards > 0) {
      let totalPossibleCards = 0;
      for (const anime in gachaManifest) {
        if (gachaManifest[anime].characters) {
          for (const char in gachaManifest[anime].characters) {
            if (gachaManifest[anime].characters[char].variants) {
              totalPossibleCards += Object.keys(gachaManifest[anime].characters[char].variants).length;
            }
          }
        }
      }
      completionPercentage = totalPossibleCards > 0 ? ((uniqueCharacters / totalPossibleCards) * 100).toFixed(1) : 0;
    }
    
    dashboardContent.innerHTML = `
      <div class="dashboard-grid">
        <!-- Overview Cards -->
        <div class="dashboard-card">
          <div class="dashboard-card-header">
            <span class="dashboard-icon">📦</span>
            <h4 class="dashboard-card-title">Overview</h4>
          </div>
          <div class="dashboard-card-content">
            <div class="stat-row">
              <span class="stat-label">Total Cards:</span>
              <span class="stat-value">${totalCards}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Unique Characters:</span>
              <span class="stat-value">${uniqueCharacters}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Duplicates:</span>
              <span class="stat-value">${duplicates}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Completion:</span>
              <span class="stat-value">${completionPercentage}%</span>
            </div>
          </div>
        </div>
        
        <!-- Rarity Distribution -->
        <div class="dashboard-card">
          <div class="dashboard-card-header">
            <span class="dashboard-icon">⭐</span>
            <h4 class="dashboard-card-title">Rarity Distribution</h4>
          </div>
          <div class="dashboard-card-content">
            <div class="rarity-distribution">
              ${stats.byRarity.Prismatic > 0 ? `
                <div class="rarity-bar-item">
                  <div class="rarity-bar-label">
                    <span class="rarity-name prismatic">✨ Prismatic</span>
                    <span class="rarity-count">${stats.byRarity.Prismatic} (${stats.rarityPercentages.Prismatic}%)</span>
                  </div>
                  <div class="rarity-bar">
                    <div class="rarity-bar-fill prismatic" style="width: ${stats.rarityPercentages.Prismatic}%"></div>
                  </div>
                </div>
              ` : ''}
              ${stats.byRarity[5] > 0 ? `
                <div class="rarity-bar-item">
                  <div class="rarity-bar-label">
                    <span class="rarity-name legendary">★★★★★ Legendary</span>
                    <span class="rarity-count">${stats.byRarity[5]} (${stats.rarityPercentages[5]}%)</span>
                  </div>
                  <div class="rarity-bar">
                    <div class="rarity-bar-fill legendary" style="width: ${stats.rarityPercentages[5]}%"></div>
                  </div>
                </div>
              ` : ''}
              ${stats.byRarity[4] > 0 ? `
                <div class="rarity-bar-item">
                  <div class="rarity-bar-label">
                    <span class="rarity-name epic">★★★★ Epic</span>
                    <span class="rarity-count">${stats.byRarity[4]} (${stats.rarityPercentages[4]}%)</span>
                  </div>
                  <div class="rarity-bar">
                    <div class="rarity-bar-fill epic" style="width: ${stats.rarityPercentages[4]}%"></div>
                  </div>
                </div>
              ` : ''}
              ${stats.byRarity[3] > 0 ? `
                <div class="rarity-bar-item">
                  <div class="rarity-bar-label">
                    <span class="rarity-name rare">★★★ Rare</span>
                    <span class="rarity-count">${stats.byRarity[3]} (${stats.rarityPercentages[3]}%)</span>
                  </div>
                  <div class="rarity-bar">
                    <div class="rarity-bar-fill rare" style="width: ${stats.rarityPercentages[3]}%"></div>
                  </div>
                </div>
              ` : ''}
              ${stats.byRarity[2] > 0 ? `
                <div class="rarity-bar-item">
                  <div class="rarity-bar-label">
                    <span class="rarity-name common">★★ Common</span>
                    <span class="rarity-count">${stats.byRarity[2]} (${stats.rarityPercentages[2]}%)</span>
                  </div>
                  <div class="rarity-bar">
                    <div class="rarity-bar-fill common" style="width: ${stats.rarityPercentages[2]}%"></div>
                  </div>
                </div>
              ` : ''}
            </div>
            <div class="stat-row mt-3">
              <span class="stat-label">Average Rarity:</span>
              <span class="stat-value">${stats.averageRarity}</span>
            </div>
          </div>
        </div>
        
        <!-- Top Anime -->
        <div class="dashboard-card">
          <div class="dashboard-card-header">
            <span class="dashboard-icon">🎬</span>
            <h4 class="dashboard-card-title">Top Anime</h4>
          </div>
          <div class="dashboard-card-content">
            ${stats.topAnime && stats.topAnime.length > 0 ? `
              <div class="top-anime-list">
                ${stats.topAnime.map((item, index) => `
                  <div class="top-anime-item">
                    <span class="top-anime-rank">${index + 1}.</span>
                    <span class="top-anime-name">${item.anime}</span>
                    <span class="top-anime-count">${item.count}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-sm theme-text-muted">No anime data available</p>'}
          </div>
        </div>
      </div>
    `;
  }
}

function initializeDashboardToggle() {
  if (dashboardInitialized) return;
  
  const toggleBtn = document.getElementById('dashboard-toggle');
  const dashboardContent = document.getElementById('dashboard-content');
  
  if (toggleBtn && dashboardContent) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = dashboardContent.classList.contains('hidden');
      
      if (isHidden) {
        // Open dashboard
        dashboardContent.classList.remove('hidden');
        toggleBtn.querySelector('.dashboard-toggle-icon').textContent = '▲';
        
        // Render dashboard content (lazy load)
        const filteredCollection = filterAndSortCollection();
        const stats = calculateCollectionStats(filteredCollection);
        renderCollectionDashboard(stats);
      } else {
        // Close dashboard
        dashboardContent.classList.add('hidden');
        toggleBtn.querySelector('.dashboard-toggle-icon').textContent = '▼';
      }
    });
    
    dashboardInitialized = true;
  }
}

// =====================================================================
// SHARD EXCHANGE SYSTEM (Feature 7)
// =====================================================================

let allCosmeticsList = [];
let cosmeticFilters = {
  search: '',
  type: 'all',
  rarity: 'all',
  owned: 'all'
};

function initializeShardExchange() {
  const exchangeBtn = document.getElementById('shard-exchange-button');
  const exchangeModal = document.getElementById('shard-exchange-modal-backdrop');
  const exchangeClose = document.getElementById('shard-exchange-modal-close');
  const exchangeCancel = document.getElementById('shard-exchange-cancel');
  const exchangeConfirm = document.getElementById('shard-exchange-confirm');
  const exchangeAmount = document.getElementById('exchange-token-amount');
  const exchangeShardCost = document.getElementById('exchange-shard-cost');
  const exchangeRemaining = document.getElementById('exchange-remaining');
  const exchangeDailyLimit = document.getElementById('exchange-daily-limit');
  
  if (exchangeBtn && exchangeModal) {
    // Ensure modal is appended to body if not already there
    if (exchangeModal.parentElement !== document.body) {
      document.body.appendChild(exchangeModal);
    }
    
    exchangeBtn.addEventListener('click', () => {
      if (exchangeModal) {
        // Update remaining exchanges
        const remaining = window.remainingDailyExchanges || 10;
        if (exchangeRemaining) exchangeRemaining.textContent = remaining;
        if (exchangeDailyLimit) exchangeDailyLimit.textContent = '10 tokens/day';
        
        // Update max based on remaining
        if (exchangeAmount) {
          exchangeAmount.max = Math.min(remaining, 10);
          exchangeAmount.value = Math.min(1, remaining);
          updateExchangeCost();
        }
        
        // Force modal positioning to viewport
        exchangeModal.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          z-index: 9999 !important;
          margin: 0 !important;
          padding: 20px !important;
          box-sizing: border-box !important;
        `;
        
        exchangeModal.classList.add('show');
        
        // Scroll to top to ensure modal is visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
  
  if (exchangeClose) {
    exchangeClose.addEventListener('click', () => {
      if (exchangeModal) exchangeModal.classList.remove('show');
    });
  }
  
  if (exchangeCancel) {
    exchangeCancel.addEventListener('click', () => {
      if (exchangeModal) exchangeModal.classList.remove('show');
    });
  }
  
  if (exchangeModal) {
    exchangeModal.addEventListener('click', (e) => {
      if (e.target === exchangeModal) {
        exchangeModal.classList.remove('show');
      }
    });
  }
  
  if (exchangeAmount) {
    exchangeAmount.addEventListener('input', updateExchangeCost);
  }
  
  if (exchangeConfirm) {
    exchangeConfirm.addEventListener('click', async () => {
      const amount = parseInt(exchangeAmount?.value || '1');
      if (amount < 1 || amount > 10) {
        showToast('Invalid amount', 'error');
        return;
      }
      
      const remaining = window.remainingDailyExchanges || 10;
      if (amount > remaining) {
        showToast(`You can only exchange ${remaining} more tokens today`, 'error');
        return;
      }
      
      const shardsNeeded = amount * 50;
      if (window.gachaShards < shardsNeeded) {
        showToast(`Not enough shards! Need ${shardsNeeded} shards`, 'error');
        return;
      }
      
      try {
        exchangeConfirm.disabled = true;
        const result = await GachaAPI.exchangeShards(amount);
        
        window.gachaTokens = result.tokens;
        window.gachaShards = result.shards;
        window.remainingDailyExchanges = result.remainingDailyExchanges;
        
        renderGachaState();
        showToast(`Exchanged ${shardsNeeded} shards for ${amount} token${amount > 1 ? 's' : ''}!`, 'success');
        
        if (exchangeModal) exchangeModal.classList.remove('show');
      } catch (error) {
        showToast(`Exchange failed: ${error.message}`, 'error');
      } finally {
        exchangeConfirm.disabled = false;
      }
    });
  }
}

function updateExchangeCost() {
  const exchangeAmount = document.getElementById('exchange-token-amount');
  const exchangeShardCost = document.getElementById('exchange-shard-cost');
  
  if (exchangeAmount && exchangeShardCost) {
    const amount = parseInt(exchangeAmount.value || '1');
    const cost = amount * 50;
    exchangeShardCost.textContent = `Cost: ${cost} shards`;
  }
}

// =====================================================================
// DIRECT COSMETIC PURCHASE (Feature 6)
// =====================================================================

async function loadCosmeticsList() {
  try {
    const result = await GachaAPI.getCosmeticsList();
    allCosmeticsList = result.cosmetics || [];
    renderDirectPurchaseTab();
  } catch (error) {
    console.error('Failed to load cosmetics list:', error);
    showToast('Failed to load cosmetics list', 'error');
  }
}

function renderDirectPurchaseTab() {
  const directList = document.getElementById('cosmetic-direct-list');
  if (!directList) return;
  
  let filtered = allCosmeticsList.filter(cosmetic => {
    // Search filter
    if (cosmeticFilters.search) {
      const searchLower = cosmeticFilters.search.toLowerCase();
      if (!cosmetic.name.toLowerCase().includes(searchLower) &&
          !cosmetic.id.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    
    // Type filter
    if (cosmeticFilters.type !== 'all' && cosmetic.type !== cosmeticFilters.type) {
      return false;
    }
    
    // Rarity filter
    if (cosmeticFilters.rarity !== 'all') {
      const cosmeticRarity = cosmetic.rarity?.toLowerCase() || 'common';
      if (cosmeticRarity !== cosmeticFilters.rarity) {
        return false;
      }
    }
    
    // Owned filter
    if (cosmeticFilters.owned !== 'all') {
      const isOwned = window.ownedCosmetics?.includes(cosmetic.id) || false;
      if (cosmeticFilters.owned === 'owned' && !isOwned) return false;
      if (cosmeticFilters.owned === 'unowned' && isOwned) return false;
    }
    
    return true;
  });
  
  directList.innerHTML = '';
  
  if (filtered.length === 0) {
    directList.innerHTML = '<p class="text-center theme-text-muted col-span-full py-8">No cosmetics found</p>';
    return;
  }
  
  filtered.forEach(cosmetic => {
    const isOwned = window.ownedCosmetics?.includes(cosmetic.id) || false;
    const cosmeticElement = document.createElement('div');
    cosmeticElement.className = 'cosmetic-direct-item p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:shadow-lg transition-all';
    cosmeticElement.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="flex-1">
          <h4 class="font-bold theme-text-primary">${cosmetic.name}</h4>
          <p class="text-xs theme-text-muted">${cosmetic.type} • ${cosmetic.rarity || 'Common'}</p>
        </div>
        ${isOwned ? '<span class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">OWNED</span>' : ''}
      </div>
      <div class="flex justify-between items-center mt-3">
        <span class="font-bold text-indigo-600 dark:text-indigo-400">${cosmetic.price} ✨</span>
        <button 
          class="buy-cosmetic-btn btn-primary text-sm py-1 px-3 rounded ${isOwned ? 'opacity-50 cursor-not-allowed' : ''}" 
          data-cosmetic-id="${cosmetic.id}" 
          data-price="${cosmetic.price}"
          ${isOwned ? 'disabled' : ''}
        >
          ${isOwned ? 'Owned' : 'Buy'}
        </button>
      </div>
    `;
    directList.appendChild(cosmeticElement);
  });
  
  // Add event listeners to buy buttons
  document.querySelectorAll('.buy-cosmetic-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cosmeticId = btn.dataset.cosmeticId;
      const price = parseInt(btn.dataset.price);
      
      if (window.gachaShards < price) {
        showToast(`Not enough shards! Need ${price} shards`, 'error');
        return;
      }
      
      try {
        btn.disabled = true;
        const result = await GachaAPI.buyCosmetic(cosmeticId, price);
        
        window.gachaShards = result.shards;
        if (!window.ownedCosmetics.includes(cosmeticId)) {
          window.ownedCosmetics.push(cosmeticId);
        }
        
        renderGachaState();
        renderDirectPurchaseTab();
        showToast(`Purchased ${cosmeticId}!`, 'success');
      } catch (error) {
        showToast(`Purchase failed: ${error.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function initializeDirectPurchaseTab() {
  const packsTab = document.getElementById('shop-tab-packs');
  const directTab = document.getElementById('shop-tab-direct');
  const packsContent = document.getElementById('shop-packs-tab');
  const directContent = document.getElementById('shop-direct-tab');
  
  const cosmeticSearch = document.getElementById('cosmetic-search');
  const cosmeticTypeFilter = document.getElementById('cosmetic-type-filter');
  const cosmeticRarityFilter = document.getElementById('cosmetic-rarity-filter');
  const cosmeticOwnedFilter = document.getElementById('cosmetic-owned-filter');
  
  if (packsTab && directTab && packsContent && directContent) {
    packsTab.addEventListener('click', () => {
      packsTab.classList.add('active');
      packsTab.classList.remove('border-transparent');
      packsTab.classList.add('border-indigo-600', 'dark:border-indigo-400');
      packsTab.classList.remove('theme-text-muted');
      packsTab.classList.add('theme-text-primary');
      
      directTab.classList.remove('active');
      directTab.classList.add('border-transparent');
      directTab.classList.remove('border-indigo-600', 'dark:border-indigo-400');
      directTab.classList.add('theme-text-muted');
      directTab.classList.remove('theme-text-primary');
      
      packsContent.classList.remove('hidden');
      directContent.classList.add('hidden');
    });
    
    directTab.addEventListener('click', () => {
      directTab.classList.add('active');
      directTab.classList.remove('border-transparent');
      directTab.classList.add('border-indigo-600', 'dark:border-indigo-400');
      directTab.classList.remove('theme-text-muted');
      directTab.classList.add('theme-text-primary');
      
      packsTab.classList.remove('active');
      packsTab.classList.add('border-transparent');
      packsTab.classList.remove('border-indigo-600', 'dark:border-indigo-400');
      packsTab.classList.add('theme-text-muted');
      packsTab.classList.remove('theme-text-primary');
      
      packsContent.classList.add('hidden');
      directContent.classList.remove('hidden');
      
      // Load cosmetics list if not loaded
      if (allCosmeticsList.length === 0) {
        loadCosmeticsList();
      }
    });
  }
  
  // Filter event listeners
  if (cosmeticSearch) {
    cosmeticSearch.addEventListener('input', (e) => {
      cosmeticFilters.search = e.target.value;
      renderDirectPurchaseTab();
    });
  }
  
  if (cosmeticTypeFilter) {
    cosmeticTypeFilter.addEventListener('change', (e) => {
      cosmeticFilters.type = e.target.value;
      renderDirectPurchaseTab();
    });
  }
  
  if (cosmeticRarityFilter) {
    cosmeticRarityFilter.addEventListener('change', (e) => {
      cosmeticFilters.rarity = e.target.value;
      renderDirectPurchaseTab();
    });
  }
  
  if (cosmeticOwnedFilter) {
    cosmeticOwnedFilter.addEventListener('change', (e) => {
      cosmeticFilters.owned = e.target.value;
      renderDirectPurchaseTab();
    });
  }
}

export function calculatePullStatistics() {
  if (!window.waifuCollection || window.waifuCollection.length === 0) {
    return null;
  }
  
  const stats = {
    total: window.waifuCollection.length,
    byRarity: {
      'Prismatic': 0,
      5: 0,
      4: 0,
      3: 0,
      2: 0
    }
  };
  
  window.waifuCollection.forEach(card => {
    const rarity = card.rarity;
    if (stats.byRarity[rarity] !== undefined) {
      stats.byRarity[rarity]++;
    }
  });
  
  const actualRates = {};
  for (const rarity in stats.byRarity) {
    actualRates[rarity] = ((stats.byRarity[rarity] / stats.total) * 100).toFixed(2) + '%';
  }
  
  console.log('📊 Pull Statistics:');
  console.log('Total pulls:', stats.total);
  console.log('Actual rates:', actualRates);
  console.log('Expected rates:', RARITY_RATES);
  
  return {
    total: stats.total,
    byRarity: stats.byRarity,
    actualRates: actualRates,
    expectedRates: RARITY_RATES
  };
}