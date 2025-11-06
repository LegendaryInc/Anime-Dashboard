// routes/gacha.js
// 🔧 FIXED: Proper User ID handling for Prisma

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

// Log all requests to this router for debugging
router.use((req, res, next) => {
  // Use both console.log and console.error to ensure visibility
  console.error(`🎮 [Gacha Router] Request received: ${req.method} ${req.path}`);
  console.error(`🎮 [Gacha Router] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  console.log(`🎮 [Gacha Router] Request received: ${req.method} ${req.path}`);
  console.log(`🎮 [Gacha Router] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  next();
});

const prisma = new PrismaClient();

// =====================================================================
// CONFIGURATION
// =====================================================================
const CONFIG = {
  EPISODES_PER_TOKEN: 10, // Temporarily reduced for testing (was 50)
  INITIAL_TOKENS: 5,
  INITIAL_SHARDS: 0,
  RARITY_SHARD_VALUES: {
    '2': 1,        // Common (2-star): 1 shard
    '3': 3,        // Rare (3-star): 3 shards
    '4': 5,        // Epic (4-star): 5 shards
    '5': 10,       // Legendary (5-star): 10 shards
    'Prismatic': 20, // Prismatic: 20 shards
    // Legacy string values (for backwards compatibility)
    'Common': 1,
    'Rare': 3,
    'Epic': 5,
    'Legendary': 10
  },
  MAX_TOKENS: 10000,
  MAX_SHARDS: 100000,
  MAX_COLLECTION_SIZE: 10000,
  // Shard Exchange System
  SHARDS_PER_TOKEN: 50, // Exchange rate: 50 shards = 1 token
  MAX_TOKENS_PER_DAY: 10, // Daily exchange limit
  // Direct Cosmetic Purchase pricing
  COSMETIC_PRICES: {
    'common': 100,
    'rare': 200,
    'epic': 400,
    'legendary': 800,
    'prismatic': 2000
  }
};

// =====================================================================
// DATABASE HELPERS
// =====================================================================

/**
 * 🔧 FIXED: Gets database user ID from session
 * Session now stores the actual database user.id (after auth.js fix)
 */
async function getDatabaseUserId(sessionUserId) {
  // Session now stores the actual database user.id
  if (typeof sessionUserId === 'number') {
    return sessionUserId;
  }
  
  // Fallback: if it's stored as string number
  const userId = parseInt(sessionUserId);
  if (!isNaN(userId) && userId > 0) {
    return userId;
  }
  
  throw new Error(`Invalid session user ID: ${sessionUserId}`);
}

/**
 * Gets or creates user's gacha state from database
 */
async function getOrCreateGachaState(databaseUserId) {
  let state = await prisma.gachaState.findUnique({
    where: { userId: databaseUserId },
    include: {
      collection: {
        orderBy: { acquiredAt: 'desc' }
      },
      cosmetics: true
    }
  });

  if (!state) {
    state = await prisma.gachaState.create({
      data: {
        userId: databaseUserId,
        tokens: CONFIG.INITIAL_TOKENS,
        shards: CONFIG.INITIAL_SHARDS,
        totalPulls: 0
      },
      include: {
        collection: true,
        cosmetics: true
      }
    });
    console.log(`🎰 Created gacha state for database user ${databaseUserId}`);
  }

  return state;
}

/**
 * Converts DB state to API response format
 */
function formatGachaStateForClient(state) {
  const activeBoosts = state.activeBoosts || {};
  
  // Clean up expired boosts
  const now = new Date();
  const cleanedBoosts = {};
  
  if (activeBoosts.luckyHour && new Date(activeBoosts.luckyHour) > now) {
    cleanedBoosts.luckyHour = activeBoosts.luckyHour;
  }
  
  if (activeBoosts.prismaticRush && new Date(activeBoosts.prismaticRush) > now) {
    cleanedBoosts.prismaticRush = activeBoosts.prismaticRush;
  }
  
  if (activeBoosts.guaranteedPull === true) {
    cleanedBoosts.guaranteedPull = true;
  }
  
  if (activeBoosts.prismaticGuarantee === true) {
    cleanedBoosts.prismaticGuarantee = true;
  }
  
  // Update state if boosts were cleaned
  if (JSON.stringify(activeBoosts) !== JSON.stringify(cleanedBoosts)) {
    prisma.gachaState.update({
      where: { id: state.id },
      data: { activeBoosts: cleanedBoosts }
    }).catch(err => console.error('Error cleaning boosts:', err));
  }
  const collection = state.collection.map(card => ({
    id: card.cardId,
    card_name: card.name,
    name: card.name,
    anime: card.anime,
    rarity: card.rarity,
    imageUrl: card.imageUrl,
    image_url: card.imageUrl,
    count: card.count,
    acquiredAt: card.acquiredAt.getTime()
  }));

  const appliedCosmetics = {};
  
  // Include exchange tracking data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastExchangeDate = state.lastExchangeDate ? new Date(state.lastExchangeDate) : null;
  const lastExchange = lastExchangeDate ? new Date(lastExchangeDate) : null;
  lastExchange?.setHours(0, 0, 0, 0);
  
  let dailyExchanges = state.dailyExchanges || 0;
  if (!lastExchange || lastExchange.getTime() !== today.getTime()) {
    dailyExchanges = 0; // Reset if new day
  }
  state.cosmetics.forEach(cosmetic => {
    if (cosmetic.cardId) {
      appliedCosmetics[cosmetic.cardId] = cosmetic.cosmeticId;
    }
  });

  const ownedCosmetics = [...new Set(state.cosmetics.map(c => c.cosmeticId))];

  return {
    tokens: state.tokens,
    shards: state.shards,
    collection,
    appliedCosmetics,
    ownedCosmetics,
    dailyExchanges: dailyExchanges,
    remainingDailyExchanges: CONFIG.MAX_TOKENS_PER_DAY - dailyExchanges,
    activeBoosts: cleanedBoosts
  };
}

/**
 * Validates state bounds
 */
function validateStateBounds(state) {
  const errors = [];
  
  if (state.tokens < 0 || state.tokens > CONFIG.MAX_TOKENS) {
    errors.push(`Invalid token count: ${state.tokens}`);
  }
  
  if (state.shards < 0 || state.shards > CONFIG.MAX_SHARDS) {
    errors.push(`Invalid shard count: ${state.shards}`);
  }
  
  return errors;
}

// =====================================================================
// API ENDPOINTS
// =====================================================================

/**
 * GET /api/gacha/test-route
 * Simple test endpoint to verify routes are working
 * This bypasses auth for testing purposes
 */
router.get('/test-route', async (req, res) => {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('🧪 [TEST ROUTE] GET /test-route hit!');
  console.error('🧪 [TEST ROUTE] Timestamp:', new Date().toISOString());
  console.error('🧪 [TEST ROUTE] Session:', req.session ? 'exists' : 'missing');
  console.error('🧪 [TEST ROUTE] Internal user ID:', req.session?.internalUserId);
  console.error('═══════════════════════════════════════════════════════════');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 [TEST ROUTE] GET /test-route hit!');
  console.log('🧪 [TEST ROUTE] Timestamp:', new Date().toISOString());
  console.log('🧪 [TEST ROUTE] Session:', req.session ? 'exists' : 'missing');
  console.log('🧪 [TEST ROUTE] Internal user ID:', req.session?.internalUserId);
  console.log('═══════════════════════════════════════════════════════════');
  res.json({ success: true, message: 'Test route is working!', timestamp: new Date().toISOString() });
});

/**
 * GET /api/gacha/state
 */
router.get('/state', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    const state = await getOrCreateGachaState(databaseUserId);
    const clientState = formatGachaStateForClient(state);
    
    res.json(clientState);
  } catch (error) {
    console.error('Error fetching gacha state:', error);
    res.status(500).json({ error: 'Failed to fetch gacha state' });
  }
});

/**
 * POST /api/gacha/calculate-tokens
 */
router.post('/calculate-tokens', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { totalEpisodes } = req.body;
    
    if (typeof totalEpisodes !== 'number' || totalEpisodes < 0) {
      return res.status(400).json({ error: 'Invalid totalEpisodes value' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    const state = await getOrCreateGachaState(databaseUserId);
    
    console.log(`💰 [Token Calc] CONFIG.EPISODES_PER_TOKEN = ${CONFIG.EPISODES_PER_TOKEN}`);
    console.log(`💰 [Token Calc] totalEpisodes = ${totalEpisodes}`);
    console.log(`💰 [Token Calc] state.totalPulls = ${state.totalPulls}`);
    
    const earnedTokens = Math.floor(totalEpisodes / CONFIG.EPISODES_PER_TOKEN);
    const availableTokens = Math.max(0, earnedTokens - state.totalPulls);
    const newTokens = Math.min(availableTokens, CONFIG.MAX_TOKENS);
    
    console.log(`💰 [Token Calc] User ${anilistId}: ${totalEpisodes} episodes ÷ ${CONFIG.EPISODES_PER_TOKEN} = ${earnedTokens} earned tokens, ${state.totalPulls} spent, ${availableTokens} available, setting to ${newTokens}`);
    
    const updatedState = await prisma.gachaState.update({
      where: { userId: databaseUserId },
      data: { tokens: newTokens }
    });
    
    console.log(`💰 [Token Calc] User ${anilistId}: Tokens updated to ${updatedState.tokens}, current shards: ${updatedState.shards}`);
    
    res.json({
      tokens: updatedState.tokens,
      shards: updatedState.shards
    });
    
  } catch (error) {
    console.error('Error calculating tokens:', error);
    res.status(500).json({ error: 'Failed to calculate tokens' });
  }
});

/**
 * POST /api/gacha/roll
 */
router.post('/roll', async (req, res) => {
  // Use both console.log and console.error to ensure logs appear
  console.error('═══════════════════════════════════════════════════════════');
  console.error('🎲 [ROLL] ===== GACHA ROLL REQUEST RECEIVED =====');
  console.error(`🎲 [ROLL] Timestamp: ${new Date().toISOString()}`);
  console.error('═══════════════════════════════════════════════════════════');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎲 [ROLL] ===== GACHA ROLL REQUEST RECEIVED =====');
  console.log(`🎲 [ROLL] Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    const anilistId = req.session.internalUserId;
    console.log(`🎲 [ROLL] User ID from session: ${anilistId}`);
    
    if (!anilistId) {
      console.log('❌ [ROLL] ERROR: No user session found');
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { card } = req.body;
    console.log(`🎲 [ROLL] Card data received:`, { name: card?.name, rarity: card?.rarity, id: card?.id });
    
    if (!card || !card.id || !card.name || !card.rarity || !card.imageUrl) {
      return res.status(400).json({ error: 'Invalid card data' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId },
        include: { collection: true }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      console.log(`🎲 [Roll] User ${anilistId}: Starting roll with ${state.tokens} tokens, ${state.shards} shards`);
      
      if (state.tokens < 1) {
        throw new Error('Insufficient tokens');
      }
      
      // Log existing cards for debugging
      console.log(`🔍 [Roll] Collection size: ${state.collection.length}`);
      if (state.collection.length > 0) {
        console.log(`🔍 [Roll] Existing card IDs (first 5):`, state.collection.slice(0, 5).map(c => c.cardId));
      }
      console.log(`🔍 [Roll] Checking for duplicate: Card ID "${card.id}"`);
      console.log(`🔍 [Roll] Card details: name="${card.name}", rarity="${card.rarity}", imageUrl="${card.imageUrl}"`);
      
      const existingCard = await tx.gachaCard.findFirst({
        where: {
          stateId: state.id,
          cardId: card.id
        }
      });
      
      const updatedState = await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          tokens: state.tokens - 1,
          totalPulls: state.totalPulls + 1
        }
      });
      
      console.log(`🎲 [Roll] User ${anilistId}: Spent 1 token, now have ${updatedState.tokens} tokens`);
      console.log(`🔍 [Roll] Duplicate check result: Existing card found: ${existingCard ? 'YES' : 'NO'}`);
      if (existingCard) {
        console.log(`🔍 [Roll] Existing card details:`, {
          id: existingCard.id,
          cardId: existingCard.cardId,
          name: existingCard.name,
          count: existingCard.count
        });
      }
      
      if (existingCard) {
        console.log(`🔍 [Roll] Duplicate detected! Card ID: ${card.id}, Rarity: ${card.rarity}, Rarity type: ${typeof card.rarity}`);
        console.log(`🔍 [Roll] Available shard values:`, CONFIG.RARITY_SHARD_VALUES);
        
        // Try both string and numeric keys
        const shardValue = CONFIG.RARITY_SHARD_VALUES[card.rarity] || 
                          CONFIG.RARITY_SHARD_VALUES[card.rarity.toString()] || 
                          CONFIG.RARITY_SHARD_VALUES[String(card.rarity)] || 
                          1;
        
        console.log(`🔍 [Roll] Shard value calculated: ${shardValue} for rarity ${card.rarity}`);
        
        const newShards = Math.min(state.shards + shardValue, CONFIG.MAX_SHARDS);
        
        const shardUpdatedState = await tx.gachaState.update({
          where: { userId: databaseUserId },
          data: {
            shards: newShards
          }
        });
        
        console.log(`✨ [Roll] User ${anilistId}: Duplicate ${card.name} (${card.rarity}) → +${shardValue} shards (${state.shards} → ${newShards})`);
        console.log(`✨ [Roll] Updated state shards: ${shardUpdatedState.shards}`);
        
        await tx.gachaCard.update({
          where: { id: existingCard.id },
          data: {
            count: existingCard.count + 1
          }
        });
        
        console.log(`🎲 User ${anilistId}: Duplicate ${card.name} (+${shardValue} shards)`);
        
        return {
          success: true,
          tokens: updatedState.tokens,
          shards: shardUpdatedState.shards, // Use the actual updated shards from database
          isDuplicate: true,
          shardsAwarded: shardValue
        };
      } else {
        await tx.gachaCard.create({
          data: {
            stateId: state.id,
            cardId: card.id,
            name: card.name,
            anime: card.anime,
            rarity: card.rarity,
            imageUrl: card.imageUrl,
            count: 1
          }
        });
        
        console.log(`✨ [Roll] User ${anilistId}: New card ${card.name} (${card.rarity}), keeping ${state.shards} shards`);
        
        return {
          success: true,
          tokens: updatedState.tokens,
          shards: state.shards,
          isDuplicate: false,
          card: {
            id: card.id,
            name: card.name,
            anime: card.anime,
            rarity: card.rarity,
            imageUrl: card.imageUrl
          }
        };
      }
    });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎲 [ROLL] ===== GACHA ROLL COMPLETED =====');
    console.log(`🎲 [ROLL] Result:`, { 
      success: result.success, 
      tokens: result.tokens, 
      shards: result.shards, 
      isDuplicate: result.isDuplicate,
      shardsAwarded: result.shardsAwarded || 'N/A'
    });
    console.log('═══════════════════════════════════════════════════════════');
    
    res.json(result);
    
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ [ROLL] ERROR performing gacha roll:', error);
    console.error('═══════════════════════════════════════════════════════════');
    
    if (error.message === 'Insufficient tokens') {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }
    
    res.status(500).json({ error: 'Failed to perform gacha roll' });
  }
});

/**
 * POST /api/gacha/test-duplicate
 * Test endpoint to force roll a duplicate card
 * Takes an existing card ID from the collection and rolls it again
 */
router.post('/test-duplicate', async (req, res) => {
  console.error('🧪 [TEST] ===== TEST DUPLICATE ROLL REQUEST =====');
  console.log('🧪 [TEST] ===== TEST DUPLICATE ROLL REQUEST =====');
  
  try {
    const anilistId = req.session.internalUserId;
    console.log(`🧪 [TEST] User ID from session: ${anilistId}`);
    
    if (!anilistId) {
      console.log('❌ [TEST] ERROR: No user session found');
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { cardId } = req.body;
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId },
        include: { collection: true }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      // If no cardId provided, use the first card in collection
      let targetCard;
      if (cardId) {
        targetCard = state.collection.find(c => c.cardId === cardId);
        if (!targetCard) {
          throw new Error(`Card with ID ${cardId} not found in collection`);
        }
      } else {
        if (state.collection.length === 0) {
          throw new Error('No cards in collection to test duplicate with. Please roll at least one card first.');
        }
        targetCard = state.collection[0];
        console.log(`🧪 [TEST] No cardId provided, using first card: ${targetCard.cardId}`);
      }
      
      console.log(`🧪 [TEST] Testing duplicate for card: ${targetCard.name} (ID: ${targetCard.cardId})`);
      
      if (state.tokens < 1) {
        throw new Error('Insufficient tokens');
      }
      
      // Update tokens
      const updatedState = await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          tokens: state.tokens - 1,
          totalPulls: state.totalPulls + 1
        }
      });
      
      // This should be a duplicate since we're using an existing card
      const shardValue = CONFIG.RARITY_SHARD_VALUES[targetCard.rarity] || 
                        CONFIG.RARITY_SHARD_VALUES[targetCard.rarity.toString()] || 
                        CONFIG.RARITY_SHARD_VALUES[String(targetCard.rarity)] || 
                        1;
      
      const newShards = Math.min(state.shards + shardValue, CONFIG.MAX_SHARDS);
      
      const shardUpdatedState = await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          shards: newShards
        }
      });
      
      // Update card count
      await tx.gachaCard.update({
        where: { id: targetCard.id },
        data: {
          count: targetCard.count + 1
        }
      });
      
      // Get updated card
      const updatedCard = await tx.gachaCard.findUnique({
        where: { id: targetCard.id }
      });
      
      console.log(`✨ [TEST] Duplicate ${targetCard.name} (${targetCard.rarity}) → +${shardValue} shards (${state.shards} → ${newShards})`);
      
      return {
        success: true,
        tokens: updatedState.tokens,
        shards: shardUpdatedState.shards,
        isDuplicate: true,
        shardsAwarded: shardValue,
        card: {
          id: targetCard.cardId,
          name: targetCard.name,
          anime: targetCard.anime,
          rarity: targetCard.rarity,
          imageUrl: targetCard.imageUrl,
          count: updatedCard.count
        }
      };
    });
    
    console.log('🧪 [TEST] ===== TEST DUPLICATE ROLL COMPLETED =====');
    console.log(`🧪 [TEST] Result:`, { 
      success: result.success, 
      tokens: result.tokens, 
      shards: result.shards, 
      isDuplicate: result.isDuplicate,
      shardsAwarded: result.shardsAwarded 
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ [TEST] ERROR testing duplicate:', error);
    
    if (error.message === 'Insufficient tokens') {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }
    
    res.status(500).json({ error: error.message || 'Failed to test duplicate' });
  }
});

/**
 * POST /api/gacha/buy-pack
 */
router.post('/buy-pack', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { packId, packCost } = req.body;
    
    if (!packId || typeof packId !== 'string') {
      return res.status(400).json({ error: 'Invalid pack ID' });
    }
    
    if (typeof packCost !== 'number' || packCost <= 0) {
      return res.status(400).json({ error: 'Invalid pack cost' });
    }
    
    // Load cosmetics manifest
    const fs = require('fs');
    const path = require('path');
    const manifestPath = path.join(__dirname, '..', 'cosmetics-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    const pack = manifest.packs[packId];
    if (!pack) {
      return res.status(400).json({ error: 'Pack not found' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId },
        include: { cosmetics: true }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      if (state.shards < packCost) {
        throw new Error('Insufficient shards');
      }
      
      // Select cosmetics from pack with guaranteed rarity logic
      const selectedCosmetics = selectCosmeticsFromPack(pack);
      
      await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          shards: state.shards - packCost
        }
      });
      
      const existingCosmeticIds = new Set(state.cosmetics.map(c => c.cosmeticId));
      const newCosmetics = selectedCosmetics.filter(id => !existingCosmeticIds.has(id));
      
      if (newCosmetics.length > 0) {
        await tx.gachaCosmetic.createMany({
          data: newCosmetics.map(cosmeticId => ({
            stateId: state.id,
            cosmeticId
          }))
        });
      }
      
      console.log(`🛒 User ${anilistId}: Purchased ${pack.name} for ${packCost} shards`);
      
      return {
        success: true,
        shards: state.shards - packCost,
        cosmetics: selectedCosmetics,
        packName: pack.name
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error buying pack:', error);
    
    if (error.message === 'Insufficient shards') {
      return res.status(400).json({ error: 'Insufficient shards' });
    }
    
    res.status(500).json({ error: 'Failed to purchase pack' });
  }
});

/**
 * Select cosmetics from pack with guaranteed rarity logic
 */
function selectCosmeticsFromPack(pack) {
  const items = pack.items || [];
  if (items.length === 0) return [];
  
  const guaranteedRarity = pack.guaranteedRarity;
  const selected = [];
  
  // If pack has guaranteed rarity, ensure at least one item matches
  if (guaranteedRarity) {
    const guaranteedItems = items.filter(item => {
      const itemRarity = item.rarity?.toLowerCase() || 'common';
      const rarityMap = {
        'common': 2,
        'rare': 3,
        'epic': 4,
        'legendary': 5,
        'prismatic': 6
      };
      const guaranteedValue = rarityMap[guaranteedRarity.toLowerCase()] || 4;
      const itemValue = rarityMap[itemRarity] || 2;
      return itemValue >= guaranteedValue;
    });
    
    if (guaranteedItems.length > 0) {
      // Select at least one guaranteed item
      const guaranteedItem = guaranteedItems[Math.floor(Math.random() * guaranteedItems.length)];
      selected.push(guaranteedItem.id);
    }
  }
  
  // Select remaining items (2-4 total items)
  const numItems = Math.min(items.length, Math.floor(Math.random() * 3) + 2); // 2-4 items
  const remainingItems = items.filter(item => !selected.includes(item.id));
  
  while (selected.length < numItems && remainingItems.length > 0) {
    const randomItem = remainingItems[Math.floor(Math.random() * remainingItems.length)];
    if (!selected.includes(randomItem.id)) {
      selected.push(randomItem.id);
    }
  }
  
  return selected;
}

/**
 * POST /api/gacha/apply-cosmetic
 */
router.post('/apply-cosmetic', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { cardId, cosmeticName } = req.body;
    
    if (!cardId || typeof cardId !== 'string') {
      return res.status(400).json({ error: 'Invalid cardId' });
    }
    
    if (!cosmeticName || typeof cosmeticName !== 'string') {
      return res.status(400).json({ error: 'Invalid cosmeticName' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    const state = await getOrCreateGachaState(databaseUserId);
    
    if (cosmeticName === 'Default') {
      await prisma.gachaCosmetic.updateMany({
        where: {
          stateId: state.id,
          cardId: cardId
        },
        data: {
          cardId: null
        }
      });
    } else {
      const ownedCosmetic = await prisma.gachaCosmetic.findFirst({
        where: {
          stateId: state.id,
          cosmeticId: cosmeticName
        }
      });
      
      if (!ownedCosmetic) {
        return res.status(400).json({ error: 'Cosmetic not owned' });
      }
      
      await prisma.gachaCosmetic.updateMany({
        where: {
          stateId: state.id,
          cosmeticId: cosmeticName
        },
        data: {
          cardId: null
        }
      });
      
      await prisma.gachaCosmetic.updateMany({
        where: {
          stateId: state.id,
          cosmeticId: cosmeticName
        },
        data: {
          cardId: cardId
        }
      });
    }
    
    res.json({
      success: true,
      cardId,
      cosmetic: cosmeticName
    });
    
  } catch (error) {
    console.error('Error applying cosmetic:', error);
    res.status(500).json({ error: 'Failed to apply cosmetic' });
  }
});

/**
 * POST /api/gacha/activate-boost
 */
router.post('/activate-boost', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { boostType } = req.body;
    
    if (!boostType || typeof boostType !== 'string') {
      return res.status(400).json({ error: 'Invalid boost type' });
    }
    
    const BOOST_COSTS = {
      luckyHour: 500,
      prismaticRush: 1000,
      guaranteedPull: 2000,
      prismaticGuarantee: 5000
    };
    
    const cost = BOOST_COSTS[boostType];
    if (!cost) {
      return res.status(400).json({ error: 'Invalid boost type' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      if (state.shards < cost) {
        throw new Error('Insufficient shards');
      }
      
      const activeBoosts = (state.activeBoosts || {});
      const now = new Date();
      
      // Set boost expiration or one-time use
      let boostData = {};
      if (boostType === 'luckyHour') {
        boostData = { luckyHour: new Date(now.getTime() + 60 * 60 * 1000) }; // 1 hour
      } else if (boostType === 'prismaticRush') {
        boostData = { prismaticRush: new Date(now.getTime() + 30 * 60 * 1000) }; // 30 minutes
      } else if (boostType === 'guaranteedPull') {
        boostData = { guaranteedPull: true }; // One-time use
      } else if (boostType === 'prismaticGuarantee') {
        boostData = { prismaticGuarantee: true }; // One-time use
      }
      
      await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          shards: state.shards - cost,
          activeBoosts: { ...activeBoosts, ...boostData }
        }
      });
      
      console.log(`✨ User ${anilistId}: Activated ${boostType} boost for ${cost} shards`);
      
      return {
        success: true,
        shards: state.shards - cost,
        activeBoosts: { ...activeBoosts, ...boostData }
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error activating boost:', error);
    
    if (error.message === 'Insufficient shards') {
      return res.status(400).json({ error: 'Insufficient shards' });
    }
    
    res.status(500).json({ error: 'Failed to activate boost' });
  }
});

/**
 * POST /api/gacha/enhance-card
 */
router.post('/enhance-card', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { cardId, enhancementType } = req.body;
    
    if (!cardId || !enhancementType) {
      return res.status(400).json({ error: 'Invalid card ID or enhancement type' });
    }
    
    const ENHANCEMENT_COSTS = {
      glow: 100,
      awaken: 500,
      visualRarity3: 500,
      visualRarity4: 1000,
      visualRarity5: 2000,
      prismaticEvolution: 5000
    };
    
    const cost = ENHANCEMENT_COSTS[enhancementType];
    if (!cost) {
      return res.status(400).json({ error: 'Invalid enhancement type' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId },
        include: { collection: true }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      if (state.shards < cost) {
        throw new Error('Insufficient shards');
      }
      
      const card = await tx.gachaCard.findFirst({
        where: {
          stateId: state.id,
          cardId: cardId
        }
      });
      
      if (!card) {
        throw new Error('Card not found');
      }
      
      const enhancements = (card.enhancements || {});
      
      // Apply enhancement
      let enhancementData = {};
      if (enhancementType === 'glow') {
        enhancementData = { glow: true };
      } else if (enhancementType === 'awaken') {
        enhancementData = { awakened: true, glow: true };
      } else if (enhancementType === 'visualRarity3') {
        enhancementData = { visualRarity: 3 };
      } else if (enhancementType === 'visualRarity4') {
        enhancementData = { visualRarity: 4 };
      } else if (enhancementType === 'visualRarity5') {
        enhancementData = { visualRarity: 5 };
      } else if (enhancementType === 'prismaticEvolution') {
        enhancementData = { prismatic: true, visualRarity: 6 };
      }
      
      await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          shards: state.shards - cost
        }
      });
      
      await tx.gachaCard.update({
        where: { id: card.id },
        data: {
          enhancements: { ...enhancements, ...enhancementData }
        }
      });
      
      console.log(`✨ User ${anilistId}: Enhanced card ${cardId} with ${enhancementType} for ${cost} shards`);
      
      return {
        success: true,
        shards: state.shards - cost,
        enhancements: { ...enhancements, ...enhancementData }
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error enhancing card:', error);
    
    if (error.message === 'Insufficient shards' || error.message === 'Card not found') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to enhance card' });
  }
});

/**
 * POST /api/gacha/fuse-cards
 */
router.post('/fuse-cards', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { cardIds, fusionType } = req.body;
    
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ error: 'Invalid card IDs' });
    }
    
    if (!fusionType || typeof fusionType !== 'string') {
      return res.status(400).json({ error: 'Invalid fusion type' });
    }
    
    const FUSION_CONFIGS = {
      fuse3: { shardCost: 200, minCards: 3, maxCards: 3, guaranteedRarity: null },
      fuse5: { shardCost: 500, minCards: 5, maxCards: 5, guaranteedRarity: 4 },
      fuse10: { shardCost: 1000, minCards: 10, maxCards: 10, guaranteedRarity: 5 },
      fuse20: { shardCost: 5000, minCards: 20, maxCards: 20, guaranteedRarity: 'Prismatic' }
    };
    
    const config = FUSION_CONFIGS[fusionType];
    if (!config) {
      return res.status(400).json({ error: 'Invalid fusion type' });
    }
    
    if (cardIds.length < config.minCards || cardIds.length > config.maxCards) {
      return res.status(400).json({ error: `Requires exactly ${config.minCards} cards` });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId },
        include: { collection: true }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      if (state.shards < config.shardCost) {
        throw new Error('Insufficient shards');
      }
      
      // Verify all cards exist and get their rarities
      const cards = await Promise.all(
        cardIds.map(cardId => 
          tx.gachaCard.findFirst({
            where: {
              stateId: state.id,
              cardId: cardId
            }
          })
        )
      );
      
      const missingCards = cards.filter(c => !c);
      if (missingCards.length > 0) {
        throw new Error('One or more cards not found');
      }
      
      // Verify all cards have the same rarity (for fuse3)
      if (fusionType === 'fuse3') {
        const firstRarity = cards[0].rarity;
        const allSameRarity = cards.every(c => c.rarity === firstRarity);
        if (!allSameRarity) {
          throw new Error('All cards must have the same rarity for fusion');
        }
      }
      
      // Determine result rarity
      let resultRarity = config.guaranteedRarity;
      if (!resultRarity) {
        // For fuse3, upgrade to next rarity tier
        const baseRarity = cards[0].rarity;
        const rarityMap = { '2': 3, '3': 4, '4': 5, '5': 'Prismatic', 'Prismatic': 'Prismatic' };
        resultRarity = rarityMap[baseRarity.toString()] || 3;
      }
      
      // Load gacha manifest to get a random card of the result rarity
      const fs = require('fs');
      const path = require('path');
      const manifestPath = path.join(__dirname, '..', 'gacha-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Find a card of the result rarity
      let resultCard = null;
      for (const anime in manifest) {
        for (const character in manifest[anime]) {
          const variants = manifest[anime][character];
          for (const variant of variants) {
            if (variant.rarity === resultRarity || variant.rarity?.toString() === resultRarity?.toString()) {
              resultCard = {
                cardId: `${anime}-${character}-${variant.rarity}-${Date.now()}`,
                name: character,
                anime: anime,
                rarity: variant.rarity,
                imageUrl: variant.path
              };
              break;
            }
          }
          if (resultCard) break;
        }
        if (resultCard) break;
      }
      
      if (!resultCard) {
        throw new Error('No card found for result rarity');
      }
      
      // Delete fused cards
      await tx.gachaCard.deleteMany({
        where: {
          stateId: state.id,
          cardId: { in: cardIds }
        }
      });
      
      // Create result card
      await tx.gachaCard.create({
        data: {
          stateId: state.id,
          cardId: resultCard.cardId,
          name: resultCard.name,
          anime: resultCard.anime,
          rarity: resultCard.rarity,
          imageUrl: resultCard.imageUrl,
          count: 1
        }
      });
      
      // Deduct shards
      await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          shards: state.shards - config.shardCost
        }
      });
      
      console.log(`✨ User ${anilistId}: Fused ${cardIds.length} cards into ${resultCard.name} (${resultRarity}) for ${config.shardCost} shards`);
      
      return {
        success: true,
        shards: state.shards - config.shardCost,
        resultCard: resultCard
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error fusing cards:', error);
    
    if (error.message === 'Insufficient shards' || error.message.includes('not found') || error.message.includes('same rarity')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to fuse cards' });
  }
});

/**
 * POST /api/gacha/set-shards
 */
router.post('/set-shards', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { shards } = req.body;
    
    if (typeof shards !== 'number' || shards < 0) {
      return res.status(400).json({ error: 'Invalid shards value' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      const updatedState = await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          shards: Math.min(shards, CONFIG.MAX_SHARDS)
        }
      });
      
      console.log(`⚙️ Admin: User ${anilistId} shards set to ${shards}`);
      
      return {
        success: true,
        shards: updatedState.shards,
        tokens: updatedState.tokens
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error setting shards:', error);
    
    if (error.message === 'Gacha state not found') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to set shards' });
  }
});

/**
 * POST /api/gacha/set-tokens
 */
router.post('/set-tokens', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { tokens } = req.body;
    
    if (typeof tokens !== 'number' || tokens < 0) {
      return res.status(400).json({ error: 'Invalid tokens value' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    const result = await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      const updatedState = await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          tokens: Math.min(tokens, CONFIG.MAX_TOKENS)
        }
      });
      
      console.log(`⚙️ Admin: User ${anilistId} tokens set to ${tokens}`);
      
      return {
        success: true,
        shards: updatedState.shards,
        tokens: updatedState.tokens
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error setting tokens:', error);
    
    if (error.message === 'Gacha state not found') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to set tokens' });
  }
});

/**
 * POST /api/gacha/reset
 */
router.post('/reset', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    
    await prisma.$transaction(async (tx) => {
      const state = await tx.gachaState.findUnique({
        where: { userId: databaseUserId }
      });
      
      if (!state) {
        throw new Error('Gacha state not found');
      }
      
      await tx.gachaCard.deleteMany({
        where: { stateId: state.id }
      });
      
      await tx.gachaCosmetic.deleteMany({
        where: { stateId: state.id }
      });
      
      await tx.gachaState.update({
        where: { userId: databaseUserId },
        data: {
          tokens: CONFIG.INITIAL_TOKENS,
          shards: CONFIG.INITIAL_SHARDS,
          totalPulls: 0
        }
      });
    });
    
    console.log(`🔄 User ${anilistId}: Collection reset`);
    
    res.json({
      success: true,
      tokens: CONFIG.INITIAL_TOKENS,
      shards: CONFIG.INITIAL_SHARDS
    });
    
  } catch (error) {
    console.error('Error resetting collection:', error);
    res.status(500).json({ error: 'Failed to reset collection' });
  }
});

/**
 * GET /api/gacha/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const anilistId = req.session.internalUserId;
    if (!anilistId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const databaseUserId = await getDatabaseUserId(anilistId);
    const state = await getOrCreateGachaState(databaseUserId);
    
    const rarityBreakdown = {};
    state.collection.forEach(card => {
      rarityBreakdown[card.rarity] = (rarityBreakdown[card.rarity] || 0) + 1;
    });
    
    const uniqueCharacters = new Set(state.collection.map(c => c.name)).size;
    const uniqueAnime = new Set(state.collection.map(c => c.anime)).size;
    
    res.json({
      totalCards: state.collection.length,
      uniqueCharacters,
      uniqueAnime,
      rarityBreakdown,
      totalPulls: state.totalPulls,
      tokens: state.tokens,
      shards: state.shards,
      cosmeticsOwned: new Set(state.cosmetics.map(c => c.cosmeticId)).size,
      lastModified: state.lastModified.toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Cleanup on module unload
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = router;