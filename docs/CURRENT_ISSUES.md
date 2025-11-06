# 🔧 Current Issues - Gacha System & Authentication

## 🚨 Critical Issues

### 1. **No Server Console Logs for Gacha Rolls**
- **Problem**: When rolling gacha, no logs appear in the server console, even though extensive logging has been added at every level (middleware, router, route handler)
- **Evidence**: Browser console shows tokens updating correctly (38 → 37), proving the API is working
- **Expected**: Should see logs like:
  ```
  🎮 [Gacha Middleware] Request received: POST /roll
  🔐 [requireAuth] ===== AUTH CHECK STARTING =====
  🎲 [ROLL] ===== GACHA ROLL REQUEST RECEIVED =====
  ```
- **Files to check**: 
  - `server.js` (lines 125-136) - middleware logging
  - `routes/gacha.js` (lines 274-277) - route handler logging
  - `routes/gacha.js` (lines 8-13) - router-level logging

### 2. **Shards Not Being Awarded**
- **Problem**: Shards remain at 0 even after rolling duplicates
- **Evidence**: Browser console shows `shards: 0` after every roll
- **Expected**: Duplicates should award shards based on rarity:
  - 2-star (Common): 1 shard
  - 3-star (Rare): 3 shards
  - 4-star (Epic): 5 shards
  - 5-star (Legendary): 10 shards
  - Prismatic: 20 shards
- **Files to check**:
  - `routes/gacha.js` (lines 330-351) - duplicate detection and shard awarding
  - `routes/gacha.js` (lines 24-35) - `CONFIG.RARITY_SHARD_VALUES` mapping
  - `scripts/gacha.js` (lines 476-490) - `convertCardToBackendFormat` and `getRarityString` conversion

### 3. **Admin Commands Return 404**
- **Problem**: `/api/gacha/set-shards` and `/api/gacha/set-tokens` return 404
- **Evidence**: Routes are registered (verified with test script), but requests don't reach them
- **Status**: Admin UI has been removed, but routes still exist in backend
- **Files to check**:
  - `routes/gacha.js` (lines 967-1024) - route definitions
  - `server.js` (line 125) - route registration
  - Vite proxy configuration in `vite.config.js`

### 4. **OAuth Redirect Issue**
- **Problem**: After AniList OAuth, redirects to port 3000 instead of 3001 (Vite dev server)
- **Evidence**: User gets redirected to Express server instead of Vite dev server
- **Files to check**:
  - `routes/auth.js` (lines 175-188, 269-274, 294-299) - redirect logic
  - `routes/auth.js` (lines 11-24) - `FRONTEND_URL` configuration
  - AniList API Client redirect URI settings

## ✅ What's Working

- Token calculation from episodes
- Token spending on rolls (tokens decrease correctly)
- Gacha rolling mechanism (cards are pulled)
- Collection storage (cards are saved to database)
- Frontend displays results correctly

## 🔍 Debugging Attempted

1. Added extensive logging at multiple levels:
   - Catch-all middleware for `/api/gacha/*`
   - Route mount middleware
   - Router-level middleware
   - Route handler logging
   - Auth middleware logging

2. Verified routes are registered:
   - Test script confirms routes exist in router stack
   - Routes are found: `/set-shards` and `/set-tokens` both exist

3. Fixed shard value mapping:
   - Added support for both numeric ('2', '3', '4', '5') and string ('Common', 'Rare', etc.) rarity keys
   - Added fallback logic for rarity lookup

4. Added frontend logging:
   - Browser console shows token updates correctly
   - Frontend receives API responses

## 🎯 Expected Behavior

1. **Server Console Logs**: Should see detailed logs for every gacha roll showing:
   - Request received
   - Auth check passed
   - Token spending
   - Duplicate detection
   - Shard awarding (if duplicate)

2. **Shard Awarding**: When a duplicate is rolled:
   - Should detect duplicate in database
   - Should calculate shard value based on rarity
   - Should update shards in database
   - Should return updated shard count in API response

3. **Admin Commands**: Should be able to set shards/tokens via API (if UI is re-added)

## 📝 Key Files

- `routes/gacha.js` - Main gacha logic, duplicate detection, shard awarding
- `server.js` - Route registration, middleware setup
- `scripts/gacha.js` - Frontend gacha logic, card conversion
- `routes/auth.js` - OAuth redirect logic
- `vite.config.js` - Proxy configuration

## 🚀 Next Steps

1. **Fix logging**: Determine why server console logs aren't appearing despite extensive logging
2. **Fix shard awarding**: Debug why duplicates aren't awarding shards (check rarity mapping, duplicate detection logic)
3. **Fix OAuth redirect**: Ensure redirects go to port 3001 in development
4. **Test thoroughly**: Verify tokens decrease, shards increase on duplicates, and logs appear correctly

