// =====================================================================
// --- GACHA FEATURE SCRIPT (gacha.js) ---
// =====================================================================

// --- 1. Gacha & Cosmetic State & Data ---
window.gachaTokens = 0;
window.totalPulls = 0;
window.waifuCollection = [];
window.gachaShards = 0;
window.ownedCosmetics = []; // IDs of owned items like 'border-sakura-solid'
window.appliedCosmetics = {}; // Maps card image_url to a cosmetic ID
let gachaManifest = null;
let cosmeticsManifest = null;
let currentlyCustomizingCardUrl = null;


// --- 2. Core Gacha & UI Functions ---

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

async function loadGachaData() {
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
        if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Error: Could not load gacha data.</p>`;
    }
}

function updateGachaTokens() {
    const tokensPerEpisode = window.CONFIG.GACHA_EPISODES_PER_TOKEN || 50;
    const pullsCount = window.totalPulls || 0;
    const earnedTokens = Math.floor(window.episodesWatchedTotal / tokensPerEpisode);

    window.gachaTokens = earnedTokens - pullsCount;
    window.gachaTokens = Math.max(0, window.gachaTokens);

    renderGachaState();
}

function renderGachaState() {
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
            const rarityCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 'Prismatic': 0 };
            window.waifuCollection.forEach(card => {
                const rarity = card.rarity || 1;
                if (rarityCounts[rarity] !== undefined) rarityCounts[rarity]++;
            });
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

            const resetButton = document.createElement('div');
            resetButton.className = 'col-span-full flex justify-center mt-4';
            resetButton.innerHTML = `<button onclick="resetGachaCollection()" class="btn-secondary">🔄 Reset Collection</button>`;
            gachaCollectionDisplay.appendChild(resetButton);
        }
    }
}

function resetGachaCollection() {
    if (confirm('Are you sure you want to reset your entire Collection, Shards, and Pulls?')) {
        window.waifuCollection = [];
        window.gachaShards = 0;
        window.totalPulls = 0;
        window.ownedCosmetics = [];
        window.appliedCosmetics = {};
        if (window.lastStats) window.episodesWatchedTotal = window.lastStats.totalEpisodes;
        updateGachaTokens();
        saveDataToLocalStorage(animeData);
        renderGachaState();
        const gachaResultDisplay = document.getElementById('gacha-result-display');
        if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-green-600 font-semibold">Collection reset!</p>`;
    }
}

function rollGacha() {
    const gachaResultDisplay = document.getElementById('gacha-result-display');
    if (window.gachaTokens < 1) {
        if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-red-500 font-semibold">Not enough tokens!</p>`;
        return;
    }
    if (!gachaManifest || Object.keys(gachaManifest).length === 0) {
        if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<p class="text-red-500">Gacha data not loaded.</p>`;
        return;
    }

    window.totalPulls++;
    
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
        window.gachaShards += shardsAwarded;
        if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<div class="text-center"><p class="text-xl font-bold mb-2 text-yellow-500">DUPLICATE!</p><p class="text-lg font-semibold">You received +${shardsAwarded} ✨ Shards</p><p class="text-sm text-gray-600 mb-2">for a duplicate ${finalCharacter.name}</p><img src="${finalCharacter.image_url}" alt="${finalCharacter.name}" class="w-32 h-auto mx-auto my-3 rounded-lg shadow-xl opacity-70"></div>`;
    } else {
        window.waifuCollection.push(finalCharacter);
        if (gachaResultDisplay) gachaResultDisplay.innerHTML = `<div class="text-center"><p class="text-2xl font-bold mb-2 text-green-600">SUCCESS!</p><p class="text-lg font-semibold">You summoned: ${finalCharacter.name}</p><p class="text-sm text-gray-600 mb-2">from ${finalCharacter.anime}</p><img src="${finalCharacter.image_url}" alt="${finalCharacter.name}" class="w-32 h-auto mx-auto my-3 rounded-lg shadow-xl"></div>`;
    }
    
    saveDataToLocalStorage(animeData);
    updateGachaTokens();
}


// --- 3. Cosmetic & Shard Shop Functions ---

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

function buyCosmeticPack(packId) {
    const pack = cosmeticsManifest.packs[packId];
    if (!pack) return;

    if (window.gachaShards < pack.cost) {
        alert("Not enough shards!");
        return;
    }

    window.gachaShards -= pack.cost;

    // Simple logic: give one random item from the pack
    const wonItem = pack.items[Math.floor(Math.random() * pack.items.length)];
    
    if (!window.ownedCosmetics.includes(wonItem.id)) {
        window.ownedCosmetics.push(wonItem.id);
    }

    const resultDisplay = document.getElementById('cosmetic-result-display');
    const rewardsContainer = document.getElementById('cosmetic-rewards');
    if (resultDisplay && rewardsContainer) {
        resultDisplay.classList.remove('hidden');
        rewardsContainer.innerHTML = `<div class="p-2 border rounded text-center"><strong>${wonItem.name}</strong><br><span class="text-xs">${wonItem.rarity} ${wonItem.type}</span></div>`;
    }

    saveDataToLocalStorage(animeData);
    renderGachaState();
}

function openCosmeticModal(cardUrl) {
    currentlyCustomizingCardUrl = cardUrl;
    const modal = document.getElementById('cosmetic-modal-backdrop');
    const selectionContainer = document.getElementById('cosmetic-selection-container');
    if (!modal || !selectionContainer) return;

    selectionContainer.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('button');
    defaultOption.className = 'p-2 border rounded hover:bg-gray-100';
    defaultOption.textContent = 'Default';
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

function applyCosmetic(cosmeticId) {
    if (currentlyCustomizingCardUrl) {
        if (cosmeticId === 'default') {
            delete window.appliedCosmetics[currentlyCustomizingCardUrl];
        } else {
            window.appliedCosmetics[currentlyCustomizingCardUrl] = cosmeticId;
        }
        saveDataToLocalStorage(animeData);
        renderGachaState();
        const modal = document.getElementById('cosmetic-modal-backdrop');
        if(modal) modal.classList.remove('show');
    }
}


// --- 4. Expose Functions & Initial Load ---

window.renderGachaState = renderGachaState;
window.updateGachaTokens = updateGachaTokens;
window.resetGachaCollection = resetGachaCollection;
window.rollGacha = rollGacha; // EXPOSE arollGacha TO THE GLOBAL SCOPE

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('buy-pack-btn')) {
        buyCosmeticPack(e.target.dataset.packId);
    }
    if (e.target.id === 'cosmetic-modal-close') {
        const modal = document.getElementById('cosmetic-modal-backdrop');
        if (modal) modal.classList.remove('show');
    }
});

loadGachaData();

