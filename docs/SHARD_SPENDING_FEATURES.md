# ✨ Shard Spending Features - Implementation Plan

This document focuses on features that give players meaningful ways to spend shards, making them feel valuable and useful.

---

## 🎯 Priority 1: High-Impact Shard Sinks (Implement First)

### 1. **Guaranteed Rarity Packs** ⭐ HIGH PRIORITY
**Why**: Provides guaranteed value, high shard cost, very appealing

- **Epic Guarantee Pack**: 800 shards
  - Guarantees at least one epic (4-star) cosmetic
  - Contains 3-5 cosmetics total
  - Higher chance for legendary/prismatic in remaining slots
  
- **Legendary Pack**: 1,500 shards
  - Guarantees one legendary (5-star) cosmetic
  - Contains 2-4 cosmetics total
  - Higher chance for prismatic in remaining slots
  
- **Prismatic Pack**: 5,000 shards
  - Ultra-rare pack with guaranteed prismatic cosmetic
  - Contains 1-3 cosmetics total
  - All cosmetics are epic or higher

**Implementation**:
- Add to `cosmetics-manifest.json` with `guaranteedRarity` field
- Backend logic to ensure at least one item matches rarity
- Special pack display with "GUARANTEED" badge
- Higher shard cost = high value proposition

**Impact**: Players have clear shard spending goals (save for guaranteed packs)

---

### 2. **Card Enhancement/Upgrade System** ⭐ HIGH PRIORITY
**Why**: Makes existing cards better, gives shards value beyond cosmetics

#### **Card Awakening** (Visual Enhancement)
- **100 shards** = Add glow effect to card
- **200 shards** = Add animated border
- **500 shards** = Add special particle effects
- **1,000 shards** = "Awaken" card (permanent visual upgrade, special frame)

#### **Card Duplicate Boost** (Mechanical Enhancement)
- **100 shards** = Add +1 duplicate count (shows as "x2", "x3", etc.)
- **500 shards** = Add +5 duplicate count
- **1,000 shards** = "Max Duplicate" (shows as "MAX" badge)

#### **Card Rarity Upgrade** (Visual Only)
- **500 shards** = Upgrade visual rarity tier (2-star → 3-star appearance)
- **1,000 shards** = Upgrade to 4-star appearance
- **2,000 shards** = Upgrade to 5-star appearance
- **5,000 shards** = "Prismatic Evolution" (any card → prismatic variant)

**Implementation**:
- Add `enhancements` field to `GachaCard` model (JSON: `{glow: true, awakened: true, visualRarity: 5}`)
- Backend endpoint: `POST /api/gacha/enhance-card`
- Frontend UI: "Enhance" button on card details modal
- Visual indicators on cards (glow, badge, special frame)

**Impact**: Players invest shards in their favorite cards, making them more valuable

---

### 3. **Card Fusion System** ⭐ HIGH PRIORITY
**Why**: Alternative to rolling for rare cards, uses cards + shards

- **200 shards** = Fuse 3 cards of same rarity → get 1 card of next rarity tier
  - Example: 3 x 2-star cards → 1 x 3-star card
  - Example: 3 x 3-star cards → 1 x 4-star card
  
- **500 shards** = Fuse 5 cards of same rarity → guaranteed 4+ star
  - Example: 5 x 3-star cards → guaranteed 4-star card
  
- **1,000 shards** = Fuse 10 cards of same rarity → guaranteed 5-star
  - Example: 10 x 4-star cards → guaranteed 5-star card
  
- **5,000 shards** = Fuse 20 cards of same rarity → guaranteed prismatic
  - Example: 20 x 5-star cards → guaranteed prismatic card

**Implementation**:
- Backend endpoint: `POST /api/gacha/fuse-cards`
- Frontend: "Fusion" tab or modal
- Card selection UI (multi-select)
- Fusion animation (cards combine → new card appears)
- Cost: shards + cards consumed

**Impact**: Players can work towards rare cards using duplicates + shards

---

### 4. **Collection Rarity Boost** ⭐ HIGH PRIORITY
**Why**: Strategic shard spending for better pull rates

- **500 shards** = "Lucky Hour" (2x 4+ star rate for 1 hour)
  - Next 10 rolls have 2x chance for epic/legendary/prismatic
  - Timer shows remaining time
  
- **1,000 shards** = "Prismatic Rush" (5x prismatic rate for 30 minutes)
  - Next 5 rolls have 5x chance for prismatic
  - Countdown timer
  
- **2,000 shards** = "Guaranteed Pull" (next roll is guaranteed 4+ star)
  - One-time use
  - Next single roll is guaranteed epic or higher
  
- **5,000 shards** = "Prismatic Guarantee" (next roll is guaranteed prismatic)
  - One-time use
  - Next single roll is guaranteed prismatic

**Implementation**:
- Add `activeBoosts` field to `GachaState` (JSON: `{luckyHour: expiresAt, guaranteed: true}`)
- Backend: Apply boost logic when rolling
- Frontend: Show active boost indicators, countdown timers
- UI: "Boost" button in currency display

**Impact**: Strategic shard spending for players who want guaranteed results

---

### 5. **Pack Bundles & Discounts** ⭐ MEDIUM PRIORITY
**Why**: Encourages larger shard spending

#### **Complete Set Bundle**
- All theme packs together for 20% off
- Example: 3 packs normally cost 1,800 shards → bundle costs 1,440 shards

#### **Buy 2 Get 1 Free**
- Purchase 2 packs, get 3rd pack free
- Example: Buy 2 packs (1,200 shards) → get 3rd pack free (saves 600 shards)

#### **Seasonal Bundles**
- "Holiday Bundle 2024" with all seasonal packs
- Limited-time only
- 25% discount

#### **Flash Sales**
- Limited-time discounts (e.g., 30% off for 24 hours)
- Countdown timer
- "SALE" badge on packs

**Implementation**:
- Add bundle definitions to `cosmetics-manifest.json`
- Calculate bundle pricing dynamically
- Display bundle savings and value
- Time-limited bundles with countdown

**Impact**: Encourages saving shards for better deals

---

### 6. **Limited-Time Packs** ⭐ MEDIUM PRIORITY
**Why**: Creates urgency and FOMO

- Add `availableFrom` and `availableUntil` timestamps to pack manifest
- Countdown timer on pack cards
- "NEW" badge for recently added packs (< 7 days)
- "LEAVING SOON" badge for expiring packs (< 24 hours)
- Special event packs (e.g., "Valentine's Day Pack", "Summer Pack")

**Implementation**:
- Update `cosmetics-manifest.json` with time fields
- Frontend logic to filter and display packs based on time
- Countdown timer component
- Badge system for new/expiring packs

**Impact**: Creates urgency, encourages spending shards before packs expire

---

## 🎯 Priority 2: Creative Shard Sinks

### 7. **Custom Card Creation** ⭐ MEDIUM PRIORITY
**Why**: Ultimate personalization, high shard cost

- **500 shards** = Create custom card (upload image, set name/anime)
  - Basic custom card with standard rarity
  
- **1,000 shards** = Create custom card with custom rarity
  - Choose rarity tier (2-5 stars)
  
- **2,000 shards** = Create custom animated card
  - Animated effects, special frame
  
- **5,000 shards** = Create custom prismatic card
  - Full prismatic treatment with custom image

**Implementation**:
- Backend endpoint: `POST /api/gacha/create-custom-card`
- Image upload handling
- Validation (image size, format, etc.)
- Add to collection as special "Custom" card type

**Impact**: Ultimate personalization, high-value shard sink

---

### 8. **Bulk Card Operations** ⭐ MEDIUM PRIORITY
**Why**: Quality of life, shard cost for convenience

- **50 shards** = "Bulk Sell Duplicates" (sell 10 duplicates, get shards back)
- **100 shards** = "Bulk Apply Cosmetic" (apply cosmetic to 10 cards)
- **200 shards** = "Bulk Organize" (auto-organize 50 cards)
- **300 shards** = "Export Collection" (export as JSON/CSV)

**Implementation**:
- Backend endpoints for bulk operations
- Frontend UI: "Bulk Actions" button in collection
- Multi-select card interface
- Confirmation modal showing cost and action

**Impact**: Convenience for power users, shard spending for time-saving

---

### 9. **Collection Display Customization** ⭐ LOW PRIORITY
**Why**: Visual customization, moderate shard cost

- **200 shards** = "Gallery Mode" (full-screen card viewer)
- **300 shards** = "Timeline Mode" (chronological collection view)
- **500 shards** = "Custom Layout" (drag-and-drop organization)
- **1,000 shards** = "Custom Collection Theme" (apply theme to entire collection)

**Implementation**:
- Frontend view modes
- Save layout preferences
- Collection theme system

**Impact**: Visual customization, moderate shard spending

---

### 10. **Shard-Based Analytics** ⭐ LOW PRIORITY
**Why**: Data-driven insights, one-time or recurring cost

- **500 shards** = "Pull History" (view all past pulls with filters)
- **1,000 shards** = "Rate Analytics" (compare your rates to expected rates)
- **2,000 shards** = "Predictive Analytics" (predict next pull outcomes based on history)
- **5,000 shards** = "Lifetime Analytics" (unlock forever, all analytics features)

**Implementation**:
- Backend: Track pull history in database
- Frontend: Analytics dashboard with charts
- Data visualization (Chart.js)

**Impact**: Data-driven gameplay, one-time shard investment

---

## 🎯 Priority 3: Social & Engagement Shard Sinks

### 11. **Shard Gifting** ⭐ MEDIUM PRIORITY (if friend system exists)
**Why**: Social engagement, encourages shard spending

- **1 shard** = Send 1 shard to friend
- **50 shards** = Send 50 shards to friend (bonus: get 5 shards back)
- **100 shards** = Send 100 shards (bonus: get 15 shards back)
- Daily limit: 100 shards can be gifted per day

**Impact**: Social features, community building

---

### 12. **Shard Discount Bundles** ⭐ MEDIUM PRIORITY
**Why**: Better value, encourages larger shard spending

- **1,000 shards** = "Token Bundle" (get 25 tokens for 1000 shards, normally 1250)
- **2,000 shards** = "Pack Bundle" (get 3 packs for 2000 shards, normally 2250)
- **5,000 shards** = "Mega Bundle" (get 10 packs + 50 tokens, normally 6250)

**Impact**: Better value proposition, encourages saving and spending

---

## 📊 Implementation Priority

### Week 1: Core Shard Sinks
1. ✅ Guaranteed Rarity Packs (Epic, Legendary, Prismatic packs)
2. ✅ Collection Rarity Boost (Lucky Hour, Prismatic Rush, Guaranteed Pull)

### Week 2: Card Enhancement
3. ✅ Card Enhancement System (Awakening, visual upgrades)
4. ✅ Card Fusion System (Fuse cards to get better ones)

### Week 3: Shop Improvements
5. ✅ Pack Bundles & Discounts
6. ✅ Limited-Time Packs

### Week 4: Creative Features
7. ✅ Custom Card Creation
8. ✅ Bulk Card Operations

---

## 💰 Recommended Shard Costs

### Low-Cost (Quick Decisions)
- 50-200 shards: Small conveniences, minor enhancements
- Examples: Bulk organize, small card enhancements

### Medium-Cost (Thoughtful Decisions)
- 500-1,000 shards: Significant features, moderate investment
- Examples: Card awakening, guaranteed pulls, custom cards

### High-Cost (Major Decisions)
- 2,000-5,000 shards: Premium features, major investments
- Examples: Prismatic evolution, prismatic packs, lifetime unlocks

### Ultra-Cost (Long-Term Goals)
- 10,000+ shards: Ultimate goals, rare achievements
- Examples: Ultimate collection themes, unlimited features

---

## 🎯 Quick Implementation Guide

### Step 1: Guaranteed Rarity Packs (Easiest)
1. Add packs to `cosmetics-manifest.json` with `guaranteedRarity` field
2. Update backend pack opening logic to ensure guaranteed rarity
3. Add "GUARANTEED" badge to pack cards
4. **Time**: ~2-3 hours

### Step 2: Collection Rarity Boost (Easy)
1. Add `activeBoosts` field to `GachaState` model
2. Create boost activation endpoint
3. Apply boost logic in roll function
4. Add boost UI with countdown timers
5. **Time**: ~3-4 hours

### Step 3: Card Enhancement (Medium)
1. Add `enhancements` field to `GachaCard` model
2. Create enhancement endpoint
3. Add enhancement UI to card details modal
4. Visual effects for enhanced cards
5. **Time**: ~4-6 hours

### Step 4: Card Fusion (Medium)
1. Create fusion endpoint (consumes cards + shards)
2. Add fusion UI (multi-select cards)
3. Fusion animation
4. **Time**: ~5-7 hours

---

*Last Updated: [Current Date]*

**Focus**: These features make shards feel valuable by providing meaningful choices and high-value spending options.

