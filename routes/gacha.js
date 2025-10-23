// routes/gacha.js

const express = require('express');
const router = express.Router();

// =====================================================================
// GACHA SYSTEM - In-Memory Storage
// =====================================================================
// NOTE: This uses in-memory storage. Data will be lost on server restart.
const gachaStates = new Map();

// Helper: Get or initialize gacha state for user
function getUserGachaState(userId) {
  if (!gachaStates.has(userId)) {
    gachaStates.set(userId, {
      tokens: 5,              // Initial tokens
      shards: 0,
      totalPulls: 0,          // Track total rolls made
      collection: [],         // Array of card objects
      appliedCosmetics: {},   // { cardId: cosmeticName }
      ownedCosmetics: []      // Array of cosmetic IDs
    });
  }
  return gachaStates.get(userId);
}

// Helper: Calculate shards by rarity
function getShardsByRarity(rarity) {
  const shardMap = {
    'Common': 1,      // ⭐⭐ 2-star cards
    'Rare': 3,        // ⭐⭐⭐ 3-star cards
    'Epic': 5,        // ⭐⭐⭐⭐ 4-star cards
    'Legendary': 10   // ⭐⭐⭐⭐⭐ 5-star & Prismatic cards
  };
  return shardMap[rarity] || 1; // Default to 1
}

// =====================================================================
// GACHA API ROUTES
// =====================================================================
// Note: The 'requireAuth' middleware will be applied in server.js
// before this router is used.

// Helper to get user ID and check for it
function getGachaUserId(req, res) {
  const userId = req.session.internalUserId;
  if (!userId) {
    res.status(401).json({ error: 'User session is missing internal ID.' });
    return null;
  }
  return userId;
}

// GET /state - Get user's gacha state
router.get('/state', (req, res) => {
  try {
    const userId = getGachaUserId(req, res);
    if (!userId) return;

    const state = getUserGachaState(userId);
    console.log(`📊 Loading gacha state for user ${userId}`);
    
    res.json({
      tokens: state.tokens,
      shards: state.shards,
      collection: state.collection,
      appliedCosmetics: state.appliedCosmetics,
      ownedCosmetics: state.ownedCosmetics
    });
  } catch (error) {
    console.error('❌ Get state error:', error);
    res.status(500).json({ error: 'Failed to get gacha state' });
  }
});

// POST /calculate-tokens - Calculate tokens from episodes
router.post('/calculate-tokens', (req, res) => {
  try {
    const userId = getGachaUserId(req, res);
    if (!userId) return;
    
    const { totalEpisodes } = req.body;
    const state = getUserGachaState(userId);
    
    if (typeof totalEpisodes !== 'number' || totalEpisodes < 0) {
      return res.status(400).json({ error: 'Invalid totalEpisodes value' });
    }
    
    const EPISODES_PER_TOKEN = 50;
    const earnedTokens = Math.floor(totalEpisodes / EPISODES_PER_TOKEN);
    
    if (!state.totalPulls) {
      state.totalPulls = 0;
    }
    
    const availableTokens = Math.max(0, earnedTokens - state.totalPulls);
    state.tokens = availableTokens;
    
    console.log(`🎟️  User ${userId}: ${availableTokens} tokens (earned: ${earnedTokens}, used: ${state.totalPulls})`);
    
    res.json({
      tokens: state.tokens,
      shards: state.shards
    });
  } catch (error) {
    console.error('❌ Calculate tokens error:', error);
    res.status(500).json({ error: 'Failed to calculate tokens' });
  }
});

// POST /roll - Perform a gacha roll
router.post('/roll', (req, res) => {
  try {
    const userId = getGachaUserId(req, res);
    if (!userId) return;
    
    const { card } = req.body;
    const state = getUserGachaState(userId);
    
    if (!card || !card.id || !card.name || !card.anime || !card.rarity) {
      return res.status(400).json({ error: 'Invalid card data - missing required fields' });
    }
    
    if (state.tokens < 1) {
      return res.status(400).json({ error: 'Not enough tokens' });
    }
    
    state.tokens -= 1;
    state.totalPulls = (state.totalPulls || 0) + 1;
    
    const existingCard = state.collection.find(c => c.id === card.id);
    
    if (existingCard) {
      const shardsAwarded = getShardsByRarity(card.rarity);
      state.shards += shardsAwarded;
      existingCard.count = (existingCard.count || 1) + 1;
      
      console.log(`🔁 User ${userId}: Duplicate ${card.name} (+${shardsAwarded} shards) [Pull #${state.totalPulls}]`);
      
      res.json({
        tokens: state.tokens,
        shards: state.shards,
        isDuplicate: true,
        shardsAwarded
      });
    } else {
      // Add the full card object
      state.collection.push({ ...card, count: 1 });
      
      console.log(`✨ User ${userId}: New card ${card.name} (${card.rarity}) [Pull #${state.totalPulls}]`);
      
      res.json({
        tokens: state.tokens,
        shards: state.shards,
        isDuplicate: false
      });
    }
  } catch (error) {
    console.error('❌ Roll error:', error);
    res.status(500).json({ error: 'Failed to perform roll' });
  }
});

// POST /buy-pack - Buy a cosmetic pack
router.post('/buy-pack', (req, res) => {
  try {
    const userId = getGachaUserId(req, res);
    if (!userId) return;

    const { packCost, cosmetics } = req.body;
    const state = getUserGachaState(userId);
    
    if (typeof packCost !== 'number' || !Array.isArray(cosmetics)) {
      return res.status(400).json({ error: 'Invalid pack data' });
    }
    if (state.shards < packCost) {
      return res.status(400).json({ error: 'Not enough shards' });
    }
    
    state.shards -= packCost;
    
    cosmetics.forEach(cosmeticId => {
      if (!state.ownedCosmetics.includes(cosmeticId)) {
        state.ownedCosmetics.push(cosmeticId);
      }
    });
    
    console.log(`🎨 User ${userId}: Bought pack for ${packCost} shards`);
    
    res.json({
      shards: state.shards,
      cosmetics: state.ownedCosmetics
    });
  } catch (error) {
    console.error('❌ Buy pack error:', error);
    res.status(500).json({ error: 'Failed to buy pack' });
  }
});

// POST /apply-cosmetic - Apply a cosmetic to a card
router.post('/apply-cosmetic', (req, res) => {
  try {
    const userId = getGachaUserId(req, res);
    if (!userId) return;

    const { cardId, cosmeticName } = req.body;
    const state = getUserGachaState(userId);
    
    if (!cardId || !cosmeticName) {
      return res.status(400).json({ error: 'Invalid cosmetic data' });
    }
    
    if (cosmeticName === 'Default') {
      delete state.appliedCosmetics[cardId];
      console.log(`🖌️  User ${userId}: Removed cosmetic from card`);
    } else {
      if (!state.ownedCosmetics.includes(cosmeticName)) {
        return res.status(400).json({ error: 'Cosmetic not owned' });
      }
      state.appliedCosmetics[cardId] = cosmeticName;
      console.log(`🖌️  User ${userId}: Applied ${cosmeticName} to card`);
    }
    
    res.json({
      appliedCosmetics: state.appliedCosmetics
    });
  } catch (error) {
    console.error('❌ Apply cosmetic error:', error);
    res.status(500).json({ error: 'Failed to apply cosmetic' });
  }
});

// POST /reset - Reset user's gacha collection
router.post('/reset', (req, res) => {
  try {
    const userId = getGachaUserId(req, res);
    if (!userId) return;
    
    console.log(`🔄 Resetting gacha collection for user ${userId}`);
    
    gachaStates.set(userId, {
      tokens: 5,
      shards: 0,
      totalPulls: 0,
      collection: [],
      appliedCosmetics: {},
      ownedCosmetics: []
    });
    
    console.log(`✅ User ${userId}: Gacha collection reset`);
    
    res.json({
      success: true,
      message: 'Gacha collection reset successfully',
      tokens: 5,
      shards: 0,
      collection: [],
      appliedCosmetics: {},
      ownedCosmetics: []
    });
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reset gacha collection',
      message: error.message 
    });
  }
});

// We also expose the gachaStates map for the /cache-stats endpoint in server.js
router.gachaStates = gachaStates;

module.exports = router;