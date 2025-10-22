// =====================================================================
// --- GACHA FEATURE SCRIPT (gacha.js) - WITH BACKEND INTEGRATION ---
// =====================================================================

import { showToast, showConfirm } from './toast.js';

// --- Backend API Integration ---
const GachaAPI = {
  async getState() {
    const response = await fetch('/api/gacha/state');
    if (!response.ok) throw new Error('Failed to get gacha state');
    return await response.json();
  },

  async calculateTokens(totalEpisodes) {
    const response = await fetch('/api/gacha/calculate-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalEpisodes })
    });
    if (!response.ok) throw new Error('Failed to calculate tokens');
    return await response.json();
  },

  async roll(card) {
    const response = await fetch('/api/gacha/roll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to perform roll');
    }
    return await response.json();
  },

  async buyPack(packCost, cosmetics) {
    const response = await fetch('/api/gacha/buy-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packCost, cosmetics })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to buy pack');
    }
    return await response.json();
  },

  async applyCosmetic(cardId, cosmeticName) {
    const response = await fetch('/api/gacha/apply-cosmetic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, cosmeticName })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to apply cosmetic');
    }
    return await response.json();
  },

  async resetCollection() {
    const response = await fetch('/api/gacha/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset collection');
    }
    return await response.json();
  }
};

// --- State Management ---
let gachaManifest = null;
let cosmeticsManifest = null;
let currentlyCustomizingCardUrl = null;

// --- Helper Functions ---

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

function convertBackendCollectionToDisplay(backendCollection) {
  return backendCollection.map(card => ({
    name: card.name || card.card_name,
    anime: card.anime,
    image_url: card.imageUrl || card.image_url || card.id,
    rarity: card.rarity === 'Legendary' ? 'Prismatic' : 
            card.rarity === 'Epic' ? 4 :
            card.rarity === 'Rare' ? 3 : 2,
    count: card.count || 1
  }));
}

// --- Core Gacha & UI Functions ---

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
    
    window.gachaTokens = state.tokens;
    window.gachaShards = state.shards;
    window.waifuCollection = convertBackendCollectionToDisplay(state.collection);
    window.appliedCosmetics = state.appliedCosmetics || {};
    window.ownedCosmetics = state.ownedCosmetics || [];
    
    console.log('✅ Gacha state loaded from backend');
    return state;
  } catch (error) {
    console.error('❌ Failed to load gacha state:', error);
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
    console.error('❌ Failed to update tokens:', error);
    const tokensPerEpisode = window.CONFIG.GACHA_EPISODES_PER_TOKEN || 50;
    const earnedTokens = Math.floor(totalEpisodes / tokensPerEpisode);
    window.gachaTokens = Math.max(0, earnedTokens - totalPulls);
  }
}

export function renderGachaState() {
  const gachaTokenCount = document.getElementById('gacha-token-count');
  const gachaShardCount = document.getElementById('gacha-shard-count');
  const gachaRollButton = document.getElementById('gacha-roll-button');
  const gachaCollectionDisplay = document.getElementById('gacha-collection-display');
  const gachaStatsDisplay = document.getElementById('gacha-stats-display');

  if (gachaTokenCount) gachaTokenCount.textContent = window.gachaTokens;
  if (gachaShardCount) gachaShardCount.textContent = window.gachaShards;
  if (gachaRollButton) {
    gachaRollButton.disabled = window.gachaTokens < 1;
    gachaRollButton.classList.toggle('opacity-50', gachaRollButton.disabled);
  }

  if (gachaStatsDisplay) {
    if (window.waifuCollection.length > 0) {
      const uniqueCharacters = new Set(window.waifuCollection.map(card => card.name)).size;
      gachaStatsDisplay.innerHTML = `<span class="text-sm text-gray-500">Total: ${window.waifuCollection.length} | Unique: ${uniqueCharacters}</span>`;
    } else {
      gachaStatsDisplay.innerHTML = '';
    }
  }

  if (gachaCollectionDisplay) {
    gachaCollectionDisplay.innerHTML = '';
    if (window.waifuCollection.length === 0) {
      gachaCollectionDisplay.innerHTML = `<p class="col-span-full text-gray-500 py-4">Your collection is empty!</p>`;
    } else {
      window.waifuCollection.forEach(card => {
        const cardElement = document.createElement('div');
        const rarity = card.rarity || 1;
        const appliedBorder = window.appliedCosmetics[card.image_url] || '';

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

/**
 * 🆕 Resets the user's gacha collection (backend version).
 */
export async function resetGachaCollection() {
  const confirmMessage = '⚠️ Are you sure you want to reset your entire gacha collection?\n\nThis will:\n- Delete all cards\n- Remove all cosmetics\n- Reset tokens to 5\n- Reset shards to 0\n\nThis action CANNOT be undone!';
  
  const confirmed = await showConfirm(confirmMessage);
  if (!confirmed) {
    return false;
  }

  try {
    const result = await GachaAPI.resetCollection();
    
    // Update local state
    window.gachaTokens = result.tokens;
    window.gachaShards = result.shards;
    window.waifuCollection = [];
    window.appliedCosmetics = {};
    window.ownedCosmetics = [];
    window.totalPulls = 0;
    
    // Re-render UI
    renderGachaState();
    
    // Clear result display
    const gachaResultDisplay = document.getElementById('gacha-result-display');
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `
        <div class="text-center">
          <p class="text-xl font-bold mb-2 text-blue-600">🔄 RESET COMPLETE</p>
          <p class="text-sm text-gray-600">Your collection has been cleared!</p>
        </div>`;
    }
    
    showToast('Collection reset successfully!', 'success');
    console.log('✅ Gacha collection reset successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to reset collection:', error);
    
    // Check if user needs to re-authenticate
    if (error.message.includes('<!DOCTYPE') || error.message.includes('is not valid JSON')) {
      showToast('Your session has expired. Please log out and log back in.', 'error', 5000);
      // Optionally auto-redirect to logout
      setTimeout(() => {
        window.location.href = '/logout';
      }, 2000);
    } else {
      showToast(`Failed to reset collection: ${error.message}`, 'error');
    }
    return false;
  }
}

export async function rollGacha() {
  const gachaResultDisplay = document.getElementById('gacha-result-display');
  
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
    const backendCard = convertCardToBackendFormat(finalCharacter);
    const result = await GachaAPI.roll(backendCard);

    window.gachaTokens = result.tokens;
    window.gachaShards = result.shards;

    if (result.isDuplicate) {
      return {
        status: 'duplicate',
        shardsAwarded: result.shardsAwarded,
        card: finalCharacter
      };
    } else {
      window.waifuCollection.unshift(finalCharacter);
      return {
        status: 'new',
        card: finalCharacter
      };
    }
  } catch (error) {
    console.error('❌ Gacha roll failed:', error);
    if (gachaResultDisplay) {
      gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Roll failed: ${error.message}</p>`;
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

  if (window.gachaShards < pack.cost) {
    showToast("Not enough shards!", "error");
    return null;
  }

  try {
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
    return wonItem;
  } catch (error) {
    console.error('❌ Failed to buy pack:', error);
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
    console.error('❌ Failed to apply cosmetic:', error);
    showToast(`Failed to apply cosmetic: ${error.message}`, 'error');
    return false;
  }
}