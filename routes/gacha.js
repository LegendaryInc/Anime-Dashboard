// routes/gacha.js
// 🆕 ENHANCED WITH TRANSACTION SAFETY AND VALIDATION

const express = require('express');
const router = express.Router();

// =====================================================================
// IN-MEMORY GACHA STATE STORAGE (Per User Session)
// =====================================================================
// Map structure: userId -> gachaState
const gachaStates = new Map();

// Export for monitoring
router.gachaStates = gachaStates;

// =====================================================================
// CONFIGURATION
// =====================================================================
const CONFIG = {
  EPISODES_PER_TOKEN: 50,
  INITIAL_TOKENS: 5,
  INITIAL_SHARDS: 0,
  RARITY_SHARD_VALUES: {
    'Common': 1,
    'Rare': 3,
    'Epic': 5,
    'Legendary': 10
  },
  MAX_TOKENS: 10000,
  MAX_SHARDS: 100000,
  MAX_COLLECTION_SIZE: 10000
};

// =====================================================================
// STATE MANAGEMENT HELPERS
// =====================================================================

/**
 * 🆕 Gets or initializes user's gacha state.
 */
function getGachaState(userId) {
  if (!gachaStates.has(userId)) {
    gachaStates.set(userId, {
      tokens: CONFIG.INITIAL_TOKENS,
      shards: CONFIG.INITIAL_SHARDS,
      collection: [],
      appliedCosmetics: {},
      ownedCosmetics: [],
      totalPulls: 0,
      lastModified: Date.now()
    });
    console.log(`🎰 Initialized gacha state for user ${userId}`);
  }
  return gachaStates.get(userId);
}

/**
 * 🆕 Validates state bounds to prevent exploits.
 */
function validateStateBounds(state) {
  const errors = [];
  
  if (state.tokens < 0 || state.tokens > CONFIG.MAX_TOKENS) {
    errors.push(`Invalid token count: ${state.tokens}`);
  }
  
  if (state.shards < 0 || state.shards > CONFIG.MAX_SHARDS) {
    errors.push(`Invalid shard count: ${state.shards}`);
  }
  
  if (state.collection.length > CONFIG.MAX_COLLECTION_SIZE) {
    errors.push(`Collection too large: ${state.collection.length}`);
  }
  
  return errors;
}

/**
 * 🆕 Creates a transaction-safe state snapshot.
 */
function createStateSnapshot(state) {
  return {
    tokens: state.tokens,
    shards: state.shards,
    collection: JSON.parse(JSON.stringify(state.collection)),
    appliedCosmetics: { ...state.appliedCosmetics },
    ownedCosmetics: [...state.ownedCosmetics],
    totalPulls: state.totalPulls
  };
}

/**
 * 🆕 Restores state from snapshot (rollback).
 */
function restoreStateSnapshot(state, snapshot) {
  state.tokens = snapshot.tokens;
  state.shards = snapshot.shards;
  state.collection = snapshot.collection;
  state.appliedCosmetics = snapshot.appliedCosmetics;
  state.ownedCosmetics = snapshot.ownedCosmetics;
  state.totalPulls = snapshot.totalPulls;
  state.lastModified = Date.now();
}

/**
 * 🆕 Executes an operation with transaction safety.
 */
async function withTransaction(userId, operation) {
  const state = getGachaState(userId);
  const snapshot = createStateSnapshot(state);
  
  try {
    const result = await operation(state);
    
    // Validate state after operation
    const errors = validateStateBounds(state);
    if (errors.length > 0) {
      throw new Error(`State validation failed: ${errors.join(', ')}`);
    }
    
    state.lastModified = Date.now();
    return result;
    
  } catch (error) {
    // Rollback on error
    console.error(`❌ Transaction failed for user ${userId}, rolling back:`, error.message);
    restoreStateSnapshot(state, snapshot);
    throw error;
  }
}

// =====================================================================
// API ENDPOINTS
// =====================================================================

/**
 * GET /api/gacha/state
 * Returns current gacha state for the authenticated user.
 */
router.get('/state', (req, res) => {
  try {
    const userId = req.session.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const state = getGachaState(userId);
    
    res.json({
      tokens: state.tokens,
      shards: state.shards,
      collection: state.collection,
      appliedCosmetics: state.appliedCosmetics,
      ownedCosmetics: state.ownedCosmetics
    });
  } catch (error) {
    console.error('Error fetching gacha state:', error);
    res.status(500).json({ error: 'Failed to fetch gacha state' });
  }
});

/**
 * POST /api/gacha/calculate-tokens
 * Calculates tokens based on total episodes watched.
 * Body: { totalEpisodes: number }
 */
router.post('/calculate-tokens', (req, res) => {
  try {
    const userId = req.session.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { totalEpisodes } = req.body;
    
    if (typeof totalEpisodes !== 'number' || totalEpisodes < 0) {
      return res.status(400).json({ error: 'Invalid totalEpisodes value' });
    }
    
    const state = getGachaState(userId);
    
    // Calculate earned tokens (episodes / episodes per token)
    const earnedTokens = Math.floor(totalEpisodes / CONFIG.EPISODES_PER_TOKEN);
    
    // Subtract pulls already made
    const availableTokens = Math.max(0, earnedTokens - state.totalPulls);
    
    // Update state (this is idempotent - safe to call multiple times)
    state.tokens = Math.min(availableTokens, CONFIG.MAX_TOKENS);
    
    res.json({
      tokens: state.tokens,
      shards: state.shards
    });
    
  } catch (error) {
    console.error('Error calculating tokens:', error);
    res.status(500).json({ error: 'Failed to calculate tokens' });
  }
});

/**
 * 🆕 POST /api/gacha/roll
 * Performs a gacha roll with transaction safety.
 * Body: { card: BackendGachaCard }
 */
router.post('/roll', async (req, res) => {
  try {
    const userId = req.session.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { card } = req.body;
    
    // Validate card data
    if (!card || !card.id || !card.name || !card.rarity || !card.imageUrl) {
      return res.status(400).json({ error: 'Invalid card data' });
    }
    
    // Execute roll within transaction
    const result = await withTransaction(userId, (state) => {
      // Check if user has tokens
      if (state.tokens < 1) {
        throw new Error('Insufficient tokens');
      }
      
      // Deduct token
      state.tokens -= 1;
      state.totalPulls += 1;
      
      // Check for duplicate
      const existingCard = state.collection.find(c => c.id === card.id);
      
      if (existingCard) {
        // Duplicate - award shards
        const shardValue = CONFIG.RARITY_SHARD_VALUES[card.rarity] || 1;
        state.shards = Math.min(state.shards + shardValue, CONFIG.MAX_SHARDS);
        
        // Increment count (optional - for duplicate tracking)
        existingCard.count = (existingCard.count || 1) + 1;
        
        console.log(`🎲 User ${userId}: Duplicate ${card.name} (+${shardValue} shards)`);
        
        return {
          success: true,
          tokens: state.tokens,
          shards: state.shards,
          isDuplicate: true,
          shardsAwarded: shardValue
        };
      } else {
        // New card - add to collection
        state.collection.push({
          id: card.id,
          name: card.name,
          anime: card.anime,
          rarity: card.rarity,
          imageUrl: card.imageUrl,
          count: 1,
          acquiredAt: Date.now()
        });
        
        console.log(`✨ User ${userId}: New card ${card.name} (${card.rarity})`);
        
        return {
          success: true,
          tokens: state.tokens,
          shards: state.shards,
          isDuplicate: false,
          card: state.collection[state.collection.length - 1]
        };
      }
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error performing gacha roll:', error);
    
    if (error.message === 'Insufficient tokens') {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }
    
    res.status(500).json({ error: 'Failed to perform gacha roll' });
  }
});

/**
 * 🆕 POST /api/gacha/buy-pack
 * Purchases a cosmetic pack with transaction safety.
 * Body: { packCost: number, cosmetics: string[] }
 */
router.post('/buy-pack', async (req, res) => {
  try {
    const userId = req.session.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { packCost, cosmetics } = req.body;
    
    // Validate input
    if (typeof packCost !== 'number' || packCost <= 0) {
      return res.status(400).json({ error: 'Invalid pack cost' });
    }
    
    if (!Array.isArray(cosmetics) || cosmetics.length === 0) {
      return res.status(400).json({ error: 'Invalid cosmetics array' });
    }
    
    // Execute purchase within transaction
    const result = await withTransaction(userId, (state) => {
      // Check if user has enough shards
      if (state.shards < packCost) {
        throw new Error('Insufficient shards');
      }
      
      // Deduct shards
      state.shards -= packCost;
      
      // Add cosmetics to owned list (avoid duplicates)
      cosmetics.forEach(cosmeticId => {
        if (!state.ownedCosmetics.includes(cosmeticId)) {
          state.ownedCosmetics.push(cosmeticId);
        }
      });
      
      console.log(`🛒 User ${userId}: Purchased pack for ${packCost} shards`);
      
      return {
        success: true,
        shards: state.shards,
        cosmetics: cosmetics
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
 * POST /api/gacha/apply-cosmetic
 * Applies a cosmetic to a card.
 * Body: { cardId: string, cosmeticName: string }
 */
router.post('/apply-cosmetic', (req, res) => {
  try {
    const userId = req.session.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const { cardId, cosmeticName } = req.body;
    
    if (!cardId || typeof cardId !== 'string') {
      return res.status(400).json({ error: 'Invalid cardId' });
    }
    
    if (!cosmeticName || typeof cosmeticName !== 'string') {
      return res.status(400).json({ error: 'Invalid cosmeticName' });
    }
    
    const state = getGachaState(userId);
    
    // Apply or remove cosmetic
    if (cosmeticName === 'Default') {
      delete state.appliedCosmetics[cardId];
    } else {
      // Verify user owns this cosmetic
      if (!state.ownedCosmetics.includes(cosmeticName)) {
        return res.status(400).json({ error: 'Cosmetic not owned' });
      }
      state.appliedCosmetics[cardId] = cosmeticName;
    }
    
    state.lastModified = Date.now();
    
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
 * 🆕 POST /api/gacha/reset
 * Resets user's gacha collection with transaction safety.
 */
router.post('/reset', async (req, res) => {
  try {
    const userId = req.session.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    // Execute reset within transaction (though rollback isn't needed here)
    const result = await withTransaction(userId, (state) => {
      // Reset all gacha data
      state.tokens = CONFIG.INITIAL_TOKENS;
      state.shards = CONFIG.INITIAL_SHARDS;
      state.collection = [];
      state.appliedCosmetics = {};
      state.ownedCosmetics = [];
      state.totalPulls = 0;
      
      console.log(`🔄 User ${userId}: Collection reset`);
      
      return {
        success: true,
        tokens: state.tokens,
        shards: state.shards
      };
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('Error resetting collection:', error);
    res.status(500).json({ error: 'Failed to reset collection' });
  }
});

/**
 * GET /api/gacha/stats
 * Returns aggregated gacha statistics (for admin/debugging).
 */
router.get('/stats', (req, res) => {
  try {
    const userId = req.session.internalUserId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }
    
    const state = getGachaState(userId);
    
    // Calculate statistics
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
      cosmeticsOwned: state.ownedCosmetics.length,
      lastModified: new Date(state.lastModified).toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;