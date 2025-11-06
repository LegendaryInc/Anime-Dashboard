# Shard System Enhancements

This document outlines ways to expand and enhance the shard system to make it more valuable and engaging.

## 💎 Current Shard System

### How Shards Work Now:
- **Earned from**: Duplicate cards (1-10 shards based on rarity)
  - Common (2-star): 1 shard
  - Rare (3-star): 3 shards
  - Epic (4-star): 5 shards
  - Legendary (5-star): 10 shards
  - Prismatic: 20 shards (suggested)
- **Spent on**: Cosmetic packs (600-750 shards per pack)
- **Max**: 100,000 shards

### Current Limitations:
- Only one use case (cosmetic packs)
- No way to convert excess shards
- No individual cosmetic purchases
- Limited pack variety

---

## 🚀 Proposed Shard Enhancements

### 1. **Shard Exchange System** ⭐ HIGH PRIORITY
**Convert shards to tokens to keep rolling**

- **Exchange Rate**: 50 shards = 1 token (configurable)
- **Daily Limit**: Max 10 tokens per day (configurable)
- **UI**: Exchange button in currency display
- **Safety**: Confirmation modal to prevent accidents
- **Impact**: Gives players a way to use excess shards for more rolls

**Implementation:**
- Add `dailyExchanges` field to track daily exchange count
- Add `lastExchangeDate` to reset daily limit
- Backend endpoint: `POST /api/gacha/exchange-shards`
- Frontend modal with exchange amount input

---

### 2. **Direct Cosmetic Purchase** ⭐ HIGH PRIORITY
**Buy specific cosmetics directly instead of random packs**

- **Individual Prices**: Higher than pack average (guaranteed item)
  - Common: 100 shards
  - Rare: 200 shards
  - Epic: 400 shards
  - Legendary: 800 shards
  - Prismatic: 2000 shards
- **UI**: "Direct Purchase" tab in shop
- **Filter**: By type (border, theme, background), rarity, owned/unowned
- **Impact**: Reduces RNG frustration, gives players choice

**Implementation:**
- Extract all cosmetics from packs into a master list
- Add pricing model to cosmetics-manifest.json
- Backend endpoint: `POST /api/gacha/buy-cosmetic`
- Frontend filterable list of all cosmetics

---

### 3. **Guaranteed Rarity Packs** ⭐ MEDIUM PRIORITY
**Packs that guarantee specific rarities**

- **Epic Guarantee Pack**: 800 shards - guarantees at least one epic (4-star)
- **Legendary Pack**: 1500 shards - guarantees one legendary (5-star)
- **Prismatic Pack**: 5000 shards - ultra-rare pack with guaranteed prismatic
- **Impact**: Provides guaranteed value for players who want specific items

**Implementation:**
- Add new pack types to cosmetics-manifest.json
- Backend logic to ensure guaranteed rarity in pack opening
- Special pack display with "GUARANTEED" badge

---

### 4. **Limited-Time Packs** ⭐ MEDIUM PRIORITY
**Rotating packs that create urgency**

- **Features**:
  - `availableUntil` timestamp in manifest
  - Countdown timer on pack cards
  - "NEW" badge for recently added packs
  - "LEAVING SOON" badge for expiring packs (< 24 hours)
- **Example**: "Valentine's Day Pack", "Summer Pack", "Holiday Bundle"
- **Impact**: Creates FOMO and increases engagement

**Implementation:**
- Add `availableFrom` and `availableUntil` to pack manifest
- Frontend logic to filter and display packs based on time
- Countdown timer component
- Badge system for new/expiring packs

---

### 5. **Pack Bundles & Discounts** ⭐ MEDIUM PRIORITY
**Bundle multiple packs together for discounts**

- **Complete Set Bundle**: All theme packs together for 20% off
- **Buy 2 Get 1 Free**: Purchase 2 packs, get 3rd free
- **Seasonal Bundles**: "Holiday Bundle 2024" with all seasonal packs
- **Flash Sales**: Limited-time discounts (e.g., 30% off for 24 hours)
- **Impact**: Encourages larger purchases, improves value perception

**Implementation:**
- Add bundle definitions to manifest
- Calculate bundle pricing dynamically
- Display bundle savings and value

---

### 6. **Starter Packs** ⭐ LOW PRIORITY
**New player friendly packs with discounts**

- **Welcome Pack**: 200 shards (normally 600) - available first 7 days
- **New Player Bundle**: Includes tokens, cosmetics, guaranteed 5-star card
- **One-time purchase**: Track via `firstPurchaseDate` in GachaState
- **Impact**: Improves new player retention

**Implementation:**
- Add `isStarterPack` flag to manifest
- Backend logic to check account age and purchase history
- Display eligibility on pack cards

---

### 7. **Shard Rewards for Achievements** ⭐ MEDIUM PRIORITY
**Earn shards from achievements and milestones**

- **Collection Milestones**: 10 cards = 50 shards, 100 cards = 500 shards
- **Streak Rewards**: 7-day login streak = 100 shards
- **Achievement Rewards**: Various achievements give shards
- **Impact**: Provides additional shard income and engagement

**Implementation:**
- Add achievement system (future feature)
- Award shards when milestones are reached
- Display in achievement notifications

---

### 8. **Shard Multiplier Events** ⭐ LOW PRIORITY
**Temporary events that increase shard earning**

- **Double Shard Weekend**: All duplicate cards give 2x shards
- **Triple Prismatic Shards**: Prismatic duplicates give 3x shards
- **Event Duration**: 24-48 hours
- **Notification**: Banner/notification when event is active
- **Impact**: Creates excitement and encourages rolling during events

**Implementation:**
- Add event system with start/end times
- Modify shard calculation during events
- Display event banner in gacha tab

---

## 📊 Priority Recommendations

### High Priority (Quick Wins):
1. **Shard Exchange System** - Easy to implement, high value
2. **Direct Cosmetic Purchase** - Reduces frustration, high value

### Medium Priority (Moderate Impact):
3. **Guaranteed Rarity Packs** - Good value proposition
4. **Limited-Time Packs** - Creates urgency
5. **Pack Bundles & Discounts** - Encourages spending

### Low Priority (Nice to Have):
6. **Starter Packs** - Requires account age tracking
7. **Shard Rewards for Achievements** - Requires achievement system
8. **Shard Multiplier Events** - Requires event system

---

## 🎯 Implementation Plan

### Phase 1: Exchange System + Direct Purchase
1. Add shard exchange endpoint
2. Add direct cosmetic purchase endpoint
3. Update cosmetics manifest with individual prices
4. Add UI for exchange and direct purchase

### Phase 2: Enhanced Packs
1. Add guaranteed rarity packs
2. Add limited-time pack support
3. Add bundle system

### Phase 3: Advanced Features
1. Starter packs
2. Shard rewards system
3. Event multipliers

---

*Last Updated: [Current Date]*

