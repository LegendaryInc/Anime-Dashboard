// =====================================================================
// --- GACHA FEATURE SCRIPT (gacha.js) ---
// =====================================================================
// This module contains all logic for the gacha system,
// cosmetics, and shard shop. It exports functions for main.js to use.
// =====================================================================

// --- 1. Gacha & Cosmetic State & Data ---
// State is stored on the global 'window' object, managed by main.js
// window.gachaTokens = 0;
// window.totalPulls = 0;
// window.waifuCollection = [];
// window.gachaShards = 0;
// window.ownedCosmetics = [];
// window.appliedCosmetics = {};
let gachaManifest = null;
let cosmeticsManifest = null;
let currentlyCustomizingCardUrl = null;


// --- 2. Core Gacha & UI Functions ---

/**
 * (Private) Formats a slug (e.g., "one-piece") into a proper name ("One Piece").
 * @param {string} slug - The input slug.
 * @returns {string} The formatted name.
 */
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

/**
 * Loads the gacha and cosmetics manifest files.
 */
export async function loadGachaData() {
  try {
    // Note: These paths are relative to the HTML file, not this JS file.
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
    if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Error: Could not load gacha data.</p>`;
  }
}

/**
 * Calculates and updates the user's gacha tokens based on episodes watched.
 * This function *sets* the global window.gachaTokens.
 * @param {number} totalEpisodes - The user's total episodes watched.
 * @param {number} totalPulls - The user's total gacha pulls.
 */
export function updateGachaTokens(totalEpisodes, totalPulls) {
  const tokensPerEpisode = window.CONFIG.GACHA_EPISODES_PER_TOKEN || 50;
  const earnedTokens = Math.floor(totalEpisodes / tokensPerEpisode);

  window.gachaTokens = earnedTokens - totalPulls;
  window.gachaTokens = Math.max(0, window.gachaTokens); // Can't go below 0
}

/**
 * Renders the entire gacha UI based on the current global state.
 */
export function renderGachaState() {
  const gachaTokenCount = document.getElementById('gacha-token-count');
  const gachaShardCount = document.getElementById('gacha-shard-count');
  const gachaRollButton = document.getElementById('gacha-roll-button');
  const gachaCollectionDisplay = document.getElementById('gacha-collection-display');
  const gachaStatsDisplay = document.getElementById('gacha-stats-display');

  // Update token and shard counts
  if (gachaTokenCount) gachaTokenCount.textContent = window.gachaTokens;
  if (gachaShardCount) gachaShardCount.textContent = window.gachaShards;
  if (gachaRollButton) {
    gachaRollButton.disabled = window.gachaTokens < 1;
    gachaRollButton.classList.toggle('opacity-50', gachaRollButton.disabled);
  }

  // Update collection stats
  if (gachaStatsDisplay) {
    if (window.waifuCollection.length > 0) {
      const uniqueCharacters = new Set(window.waifuCollection.map(card => card.name)).size;
      gachaStatsDisplay.innerHTML = `<span class="text-sm text-gray-500">Total: ${window.waifuCollection.length} | Unique: ${uniqueCharacters}</span>`;
    } else {
      gachaStatsDisplay.innerHTML = '';
    }
  }

  // Render the collection
  if (gachaCollectionDisplay) {
    gachaCollectionDisplay.innerHTML = ''; // Clear old collection
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
        cardElement.dataset.cardUrl = card.image_url; // Used to open cosmetic modal
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
        // The click listener for this will be added in main.js
        cardElement.addEventListener('click', () => openCosmeticModal(card.image_url));
        gachaCollectionDisplay.appendChild(cardElement);
      });
    }
  }
}

/**
 * Resets the user's gacha collection.
 * This is called by a button added in main.js.
 * @returns {boolean} True if reset was confirmed, false otherwise.
 */
export function resetGachaCollection() {
  if (confirm('Are you sure you want to reset your entire Collection, Shards, and Pulls?')) {
    window.waifuCollection = [];
    window.gachaShards = 0;
    window.totalPulls = 0;
    window.ownedCosmetics = [];
    window.appliedCosmetics = {};
    
    // Recalculate tokens based on current episodes
    updateGachaTokens(window.episodesWatchedTotal, 0);

    const gachaResultDisplay = document.getElementById('gacha-result-display');
    if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-green-600 font-semibold">Collection reset!</p>`;
    
    return true; // Indicates reset was successful
  }
  return false; // Reset was cancelled
}

/**
 * Performs the gacha roll logic and returns the result.
 * Does NOT modify state directly, except for totalPulls.
 * @returns {object} An object describing the result of the roll.
 */
export function rollGacha() {
  const gachaResultDisplay = document.getElementById('gacha-result-display');
  if (window.gachaTokens < 1) {
    if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Not enough tokens!</p>`;
    return { status: 'error', message: 'No tokens' };
  }
  if (!gachaManifest || Object.keys(gachaManifest).length === 0) {
    if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-red-500">Gacha data not loaded.</p>`;
    return { status: 'error', message: 'Gacha manifest not loaded' };
  }

  // --- This is the one state change it makes ---
  window.totalPulls++; 
  // ---------------------------------------------

  // Pick a random card
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

  const isDuplicate = window.waifuCollection.some(card => card.image_url === finalCharacter.image_url);

  if (isDuplicate) {
    const shardValues = { 1: 5, 2: 10, 3: 25, 4: 50, 5: 100, "Prismatic": 250 };
    const shardsAwarded = shardValues[finalCharacter.rarity] || 5;
    
    // Return the duplicate result
    return {
      status: 'duplicate',
      shardsAwarded: shardsAwarded,
      card: finalCharacter
    };
  } else {
    // Return the new card result
    return {
      status: 'new',
      card: finalCharacter
    };
  }
}

/**
 * Renders the result of a gacha roll to the DOM.
 * @param {object} result - The result object returned from rollGacha().
 */
export function displayGachaResult(result) {
    const gachaResultDisplay = document.getElementById('gacha-result-display');
    if (!gachaResultDisplay) return;

    if (result.status === 'duplicate') {
        gachaResultDisplay.innerHTML = `<div class="text-center"><p class="text-xl font-bold mb-2 text-yellow-500">DUPLICATE!</p><p class="text-lg font-semibold">You received +${result.shardsAwarded} ✨ Shards</p><p class="text-sm text-gray-600 mb-2">for a duplicate ${result.card.name}</p><img src="${result.card.image_url}" alt="${result.card.name}" class="w-32 h-auto mx-auto my-3 rounded-lg shadow-xl opacity-70"></div>`;
    } else if (result.status === 'new') {
        gachaResultDisplay.innerHTML = `<div class="text-center"><p class="text-2xl font-bold mb-2 text-green-600">SUCCESS!</p><p class="text-lg font-semibold">You summoned: ${result.card.name}</p><p class="text-sm text-gray-600 mb-2">from ${result.card.anime}</p><img src="${result.card.image_url}" alt="${result.card.name}" class="w-32 h-auto mx-auto my-3 rounded-lg shadow-xl"></div>`;
    }
}

// --- 3. Cosmetic & Shard Shop Functions ---

/**
 * (Private) Renders the shard shop UI from the manifest.
 */
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

/**
 * Logic for buying a cosmetic pack.
 * @param {string} packId - The ID of the pack to buy.
 * @returns {object | null} The item that was won, or null if failed.
 */
export function buyCosmeticPack(packId) {
  const pack = cosmeticsManifest.packs[packId];
  if (!pack) return null;

  if (window.gachaShards < pack.cost) {
    alert("Not enough shards!");
    return null;
  }

  // Update state
  window.gachaShards -= pack.cost;

  // Simple logic: give one random item from the pack
  const wonItem = pack.items[Math.floor(Math.random() * pack.items.length)];

  if (!window.ownedCosmetics.includes(wonItem.id)) {
    window.ownedCosmetics.push(wonItem.id);
  }

  // Display the result
  const resultDisplay = document.getElementById('cosmetic-result-display');
  const rewardsContainer = document.getElementById('cosmetic-rewards');
  if (resultDisplay && rewardsContainer) {
    resultDisplay.classList.remove('hidden');
    rewardsContainer.innerHTML = `<div class="p-2 border rounded text-center"><strong>${wonItem.name}</strong><br><span class="text-xs">${wonItem.rarity} ${wonItem.type}</span></div>`;
  }

  return wonItem; // Return the item so main.js can save state
}

/**
 * Opens the cosmetic modal for a specific card.
 * @param {string} cardUrl - The unique image URL of the card.
 */
export function openCosmeticModal(cardUrl) {
  currentlyCustomizingCardUrl = cardUrl;
  const modal = document.getElementById('cosmetic-modal-backdrop');
  const selectionContainer = document.getElementById('cosmetic-selection-container');
  if (!modal || !selectionContainer) return;

  selectionContainer.innerHTML = '';

  // Add default option
  const defaultOption = document.createElement('button');
  defaultOption.className = 'p-2 border rounded hover:bg-gray-100';
  defaultOption.textContent = 'Default';
  // Note: This click listener is simple enough to live here.
  defaultOption.onclick = () => applyCosmetic('default'); 
  selectionContainer.appendChild(defaultOption);

  // Add owned borders
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

/**
 * Applies a cosmetic to the currently selected card.
 * @param {string} cosmeticId - The ID of the cosmetic to apply (or 'default').
 * @returns {boolean} True if the cosmetic was applied.
 */
export function applyCosmetic(cosmeticId) {
  if (currentlyCustomizingCardUrl) {
    if (cosmeticId === 'default') {
      delete window.appliedCosmetics[currentlyCustomizingCardUrl];
    } else {
      window.appliedCosmetics[currentlyCustomizingCardUrl] = cosmeticId;
    }

    // Close the modal
    const modal = document.getElementById('cosmetic-modal-backdrop');
    if (modal) modal.classList.remove('show');
    
    return true; // Return true so main.js knows to save
  }
  return false;
}