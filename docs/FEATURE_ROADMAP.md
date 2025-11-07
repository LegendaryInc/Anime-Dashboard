# 🚀 Feature Roadmap

A comprehensive list of potential new features for the Anime Dashboard, organized by priority and category.

## 🎉 Recently Completed (Latest Updates)

The following major features have been **fully implemented** in recent updates:

1. ✅ **Charts & Visualizations** - Enhanced chart system with theme support:
   - Restored and improved `scripts/charts.js` with full Chart.js integration
   - Quick look stat cards at top of Visualizations tab (Top Genre, Top Studio, Highest Rated Genre, Completion Rate)
   - Theme-aware chart colors (brighter colors for neon theme)
   - Improved text visibility across all themes
   - 10+ interactive charts (Score Distribution, Status Distribution, Watch Time by Year, Score Trends, Genre Insights, Studio Insights, etc.)
   - Responsive chart grid layout
   - Chart colors automatically adapt to current theme

2. ✅ **Bulk Operations** - Complete bulk selection and management system:
   - Select multiple anime with checkboxes (table and grid views)
   - Bulk update status for multiple anime
   - Bulk update score for multiple anime
   - Bulk add to custom lists
   - Select all/none functionality
   - Bulk actions toolbar with selection count
   - Progress feedback with success/failure counts

2. ✅ **Custom Lists/Collections** - Complete list management system:
   - Create, edit, and delete custom lists
   - Add/remove anime from lists
   - "Add to List" functionality on anime cards and details modal
   - List view with entry counts
   - Full-screen modals for list management
   - Integration with anime cards and table view

3. ✅ **Advanced Statistics** - Enhanced analytics:
   - Watch time breakdown by genre and year
   - Genre evolution over time (chart)
   - Average episode length calculation
   - Most watched studios by watch time
   - Longest watched anime tracking
   - Advanced statistics cards and charts

4. ✅ **Performance Optimizations** - Improved responsiveness:
   - Debounced filter updates (150ms)
   - requestAnimationFrame for DOM batching
   - Deferred heavy calculations (statistics, charts)
   - Optimized filter application
   - Batched button population

5. ✅ **UI/UX Improvements**:
   - Fixed modal positioning (centered in viewport)
   - Fixed genre tooltip z-index (appears above other rows)
   - Improved modal scrolling
   - Better bulk selection UI
   - Quick Actions context menu with keyboard navigation

6. ✅ **Achievements/Badges System** - Complete gamification system:
   - 20+ achievements across multiple categories
   - Achievement tracking with localStorage persistence
   - Unlock notifications and progress tracking
   - Rarity system (common to legendary)
   - Achievement view with filtering

7. ✅ **Export Features** - Comprehensive export functionality:
   - JSON export (full data)
   - CSV export (spreadsheet compatible)
   - MyAnimeList XML export (for MAL import)
   - Watch history export (JSON/CSV)
   - Export menu in UI

8. ✅ **Watch History** - Enhanced tracking:
   - Monthly and yearly summaries
   - Export functionality for watch history
   - History view tab with date selectors

9. ✅ **Watch Queue/Planner** - Integrated into Watching tab:
   - Unified view showing Currently Watching, Rewatching, and Plan to Watch
   - Visual badges to differentiate status types
   - "Start Watching" button for PTW items
   - Queue integration for priority ordering
   - Clean, unified grid layout

10. ✅ **Personal Goals & Targets** - Goal tracking system:
    - Create yearly and monthly goals (watch time or completion targets)
    - Progress tracking with visual indicators
    - Goals view with filtering and management

**Files Created/Modified:**
- `scripts/charts.js` - **Restored and enhanced** with full Chart.js integration, theme-aware colors, and stat cards
- `scripts/bulk-operations.js` (integrated into `ui.js`) - Bulk selection and operations
- `scripts/custom-lists.js` - Custom list management logic
- `scripts/custom-lists-view.js` - Custom list UI rendering
- `scripts/context-menu.js` - Quick Actions context menu with keyboard navigation
- `css/features/bulk-operations.css` - Bulk operations styling
- `css/features/custom-lists.css` - Custom lists styling
- `css/components/context-menu.css` - Context menu styling
- `css/features/charts.css` - Chart styling and stat cards
- `prisma/schema.prisma` - Added CustomList and CustomListEntry models
- `routes/api.js` - Added custom lists CRUD endpoints
- `scripts/data.js` - Extended with advanced statistics
- `scripts/keyboard.js` - Updated keyboard shortcuts (Tab 8 for My Lists, context menu shortcuts)

---

## 📊 Current Features

- ✅ AniList OAuth integration
- ✅ Multiple themes (Default, Sakura, Sky, Neon) with theme-aware chart colors
- ✅ Statistics dashboard with **10+ interactive charts** (Chart.js integration)
- ✅ **Quick look stat cards** in Visualizations tab (Top Genre, Top Studio, Highest Rated Genre, Completion Rate)
- ✅ Calendar view for airing anime
- ✅ Advanced filtering and search
- ✅ Grid/List view toggle
- ✅ AI-powered recommendations (Insights tab)
- ✅ Notes feature (in anime details modal)
- ✅ Watch dates feature (startedAt, completedAt) in anime details modal
- ✅ Watch history summaries (monthly/yearly) with export functionality
- ✅ **Achievements/Badges System** - Fully implemented with 20+ achievements
- ✅ **Export Features** - JSON, CSV, and MAL XML export functionality
- ✅ Anime details modal with related anime
- ✅ Streaming links integration
- ✅ Responsive design
- ✅ Keyboard shortcuts (including context menu navigation)
- ✅ **Quick Actions Menu** - Right-click context menu with keyboard support

---

## 🎯 Priority 1: High-Value Features (Recommended First)

### 1. **Watch History Tracking** ⭐⭐⭐
**Status**: ✅ **Partially Implemented** (Simplified version)

**Completed:**
- ✅ Date Started and Date Completed fields in anime details modal
- ✅ API endpoints to save/retrieve watch dates from AniList
- ✅ Monthly/Yearly watch summaries
- ✅ Export watch history as CSV/JSON

**Removed (inaccurate with batch updates):**
- ❌ Timeline visualization (dates may be inaccurate)
- ❌ Streak calculation (requires accurate daily tracking)

**Note**: Simplified to focus on summaries and export, as most users batch update their AniList making precise timelines/streaks inaccurate.

---

### 2. **Anime Recommendations Engine** ⭐⭐⭐
**Status**: ✅ **Already Implemented!**

The Insights tab already includes:
- ✅ AI-powered recommendations (using Gemini AI)
- ✅ "For You" personalized recommendations
- ✅ "Hidden Gems" underrated anime
- ✅ "Based on Your Top 5" similar recommendations
- ✅ Similar anime feature (find similar to specific anime)
- ✅ Recommendation cards with images, reasons, and vibe badges
- ✅ Search and "Add to PTW" buttons

**Potential Enhancements (Optional):**
- Filter recommendations by genre/year/format
- "Trending in your genres" section
- Mark recommendations as "Interested" or "Not Interested"
- Cache recommendations to reduce API calls
- Use AniList API for additional similar anime queries

---

### 3. **Social Features** ⭐⭐⭐
**Impact**: High | **Complexity**: High

Connect with friends and share your anime journey.

**Features:**
- Friend list (follow other users)
- Share your list publicly (with privacy controls)
- Compare lists with friends
- "What are friends watching?" section
- Activity feed (when friends complete anime)

**Implementation:**
- Add `Friends` and `UserProfile` models to Prisma
- Create friend request system
- Add sharing/privacy settings
- Build comparison views

**Files to Create/Modify:**
- `prisma/schema.prisma` (add Friend, UserProfile models)
- `routes/social.js` (new)
- `scripts/social.js` (new)
- `css/features/social.css` (new)

---

### 4. **Achievements/Badges System** ⭐⭐
**Status**: ✅ **Fully Implemented!**

**Completed Features:**
- ✅ Achievement tracking system with localStorage persistence
- ✅ 20+ achievements across multiple categories (milestone, genre, score, diversity, studio, format, seasonal)
- ✅ Achievement unlock notifications with toast system
- ✅ Achievement view with filtering (all, unlocked, by category)
- ✅ Progress tracking for locked achievements
- ✅ Rarity system (common, uncommon, rare, epic, legendary)
- ✅ Achievement showcase with progress bars

**Files Created:**
- ✅ `scripts/achievements.js` - Achievement tracking and unlocking logic
- ✅ `scripts/achievements-view.js` - Achievement UI rendering
- ✅ `data/achievements.json` - Achievement definitions (20+ achievements)
- ✅ `css/features/achievements.css` - Achievement styling with rarity colors

**Potential Enhancements (Optional):**
- Backend achievement tracking (currently localStorage)
- Achievement sharing
- Achievement leaderboards
- More achievement categories

---

## 🎨 Priority 2: Enhanced User Experience

### 5. **Custom Lists/Collections** ⭐⭐
**Status**: ✅ **Fully Implemented!**

**Completed Features:**
- ✅ Create, edit, and delete custom lists
- ✅ Add/remove anime from lists
- ✅ "Add to List" functionality on anime cards, table view, and details modal
- ✅ List view with entry counts
- ✅ Full-screen modals for list management
- ✅ Database persistence with Prisma
- ✅ API endpoints for all CRUD operations

**Files Created:**
- ✅ `scripts/custom-lists.js` - List management logic
- ✅ `scripts/custom-lists-view.js` - List UI rendering
- ✅ `css/features/custom-lists.css` - List styling
- ✅ `prisma/schema.prisma` - CustomList and CustomListEntry models
- ✅ `routes/api.js` - List CRUD endpoints

**Potential Enhancements (Optional):**
- Drag-and-drop list organization
- Share lists publicly
- List templates (e.g., "Top 10 Favorites")
- Export lists as JSON
- List filtering in main list view

---

### 6. **Notes & Reviews System** ⭐⭐
**Status**: ✅ **Fully Implemented**

**Current Implementation:**
- ✅ Notes feature in anime details modal
  - ✅ Notes tab (📝) in anime modal
  - ✅ Textarea with 2000 character limit
  - ✅ Character count display
  - ✅ Save notes functionality
  - ✅ Syncing with AniList (notes stored on AniList)
  - ✅ Watch dates (startedAt, completedAt) in anime details modal
  - ✅ Save dates functionality synced with AniList

**Potential Enhancements (Optional):**
- ❌ Full reviews system (with ratings breakdown)
- ❌ "My Reviews" section (view all reviews)
- ❌ Export reviews as blog post format
- ❌ Review templates
- ❌ Rich text editor for reviews (currently plain text)
- ❌ Review search/filter

**Note**: The notes and dates features are fully functional and synced with AniList. The basic functionality is complete.

---

### 7. **Advanced Statistics & Charts** ⭐⭐
**Status**: ✅ **Fully Implemented!**

**Completed Features:**
- ✅ Watch time breakdown by genre and year
- ✅ Genre evolution over time (chart)
- ✅ Average episode length calculation
- ✅ Most watched studios by watch time
- ✅ Longest watched anime tracking
- ✅ Advanced statistics cards and charts
- ✅ **Quick look stat cards** in Visualizations tab (Top Genre, Top Studio, Highest Rated Genre, Completion Rate)
- ✅ **Theme-aware chart colors** (brighter colors for neon theme, improved visibility)
- ✅ **10+ interactive charts** with Chart.js:
  - Score Distribution (bar chart)
  - Status Distribution (doughnut chart)
  - Watch Time by Year (line chart)
  - Score Trends Over Time (line chart)
  - Watch Time by Genre (horizontal bar chart)
  - Average Score by Genre (horizontal bar chart)
  - Completion Rate by Genre (horizontal bar chart)
  - Genre Evolution Over Time (multi-line chart)
  - Top 10 Studios (horizontal bar chart)
  - Anime Completed Per Year (bar chart)

**Files Modified:**
- ✅ `scripts/data.js` - Extended statistics calculation
- ✅ `scripts/charts.js` - **Restored and enhanced** with full Chart.js integration, theme detection, and improved colors

**Potential Enhancements (Optional - Need to evaluate data limits):**
- Most watched directors
- Additional time-based analytics
- Chart export functionality (PNG/PDF)

**Note**: Charts now automatically adapt to theme colors, with special handling for neon theme for better visibility.

---

### 8. **Export Features** ⭐⭐
**Status**: ✅ **Fully Implemented** (Export features complete)

**Completed Features:**
- ✅ Export to JSON format (full data with all fields)
- ✅ Export to CSV format (spreadsheet compatible)
- ✅ Export to MyAnimeList XML format (for MAL import)
- ✅ Export watch history as JSON/CSV
- ✅ Export menu in UI with format selection
- ✅ Download functionality for all export formats

**Files Created:**
- ✅ `scripts/export.js` - Export functions for JSON, CSV, and MAL XML
- ✅ `css/features/export.css` - Export menu styling

**Note**: Import features are not needed - users already sync with AniList.

---

## 🔧 Priority 3: Quality of Life Improvements

### 9. **Bulk Operations** ⭐
**Status**: ✅ **Fully Implemented!**

**Completed Features:**
- ✅ Select multiple anime with checkboxes (table and grid views)
- ✅ Bulk update status for multiple anime
- ✅ Bulk update score for multiple anime
- ✅ Bulk add to custom lists
- ✅ Select all/none functionality
- ✅ Bulk actions toolbar with selection count
- ✅ Progress feedback with success/failure counts

**Files Created/Modified:**
- ✅ `scripts/ui.js` - Added bulk selection and operations
- ✅ `css/features/bulk-operations.css` - Bulk operations styling
- ✅ `index.html` - Added bulk actions toolbar

**Potential Enhancements (Optional):**
- Bulk export selected anime
- Bulk delete from custom lists
- Batch API endpoints for better performance

---

### 10. **Quick Actions Menu** ⭐
**Status**: ✅ **Fully Implemented!**

**Completed Features:**
- ✅ Right-click context menu on anime cards and table rows
- ✅ Quick actions: "View Details", "Update Status", "Update Score", "Add Episode", "Add to List", "Open on AniList"
- ✅ Keyboard shortcuts: Enter (open details), Arrow keys (navigate), Esc (close)
- ✅ Clean, minimal design with icons and labels
- ✅ Intelligent positioning to avoid viewport overflow
- ✅ Focus management for keyboard navigation

**Files Created:**
- ✅ `scripts/context-menu.js` - Context menu logic and keyboard handling
- ✅ `css/components/context-menu.css` - Context menu styling

**Note**: "Find Similar" feature was removed from the context menu and table view as it was not working properly.

---



## 🎮 Priority 4: Advanced Features

### 13. **Watch Together/Collaborative Lists** ⭐
**Impact**: Low | **Complexity**: High

Watch anime "together" with friends remotely.

**Features:**
- Create watch parties
- Synchronized playback (if using same streaming service)
- Group chat during watching
- Shared progress tracking
- Schedule watch sessions

**Implementation:**
- Real-time sync (WebSockets or polling)
- Chat system
- Video sync coordination

**Files to Create/Modify:**
- `routes/watch-party.js` (new)
- `scripts/watch-party.js` (new)
- WebSocket server setup

---


### 15. **AI-Powered List Analysis** ⭐
**Status**: Not needed currently | **Impact**: Low | **Complexity**: Medium

Use AI to analyze your list and provide insights.

**Features:**
- "What does your list say about you?" analysis
- Genre diversity analysis
- Watch pattern analysis
- Personalized watch suggestions based on AI analysis

**Implementation:**
- Extend existing Gemini integration
- Create analysis prompts
- Display AI-generated insights

**Files to Create/Modify:**
- `scripts/ai.js` (add analysis functions)
- `scripts/insights.js` (enhance)

**Note**: Can be implemented later if desired.

---

## 📝 Implementation Recommendations

### Recently Completed ✅:
1. ✅ **Charts & Visualizations** - Restored and enhanced chart system with theme-aware colors, quick look stat cards, and 10+ interactive charts
2. ✅ **Bulk Operations** - Fully implemented with selection, bulk updates, and list management
3. ✅ **Custom Lists/Collections** - Fully implemented with CRUD operations, list management, and UI
4. ✅ **Advanced Statistics** - Watch time by genre/year, genre evolution, longest watched anime, and more
5. ✅ **Performance Optimizations** - Debounced filters, requestAnimationFrame batching, deferred calculations
6. ✅ **UI/UX Improvements** - Fixed modal positioning, genre tooltips, improved scrolling, context menu, improved chart visibility
7. ✅ **Achievements System** - Fully implemented with 20+ achievements
8. ✅ **Export Features** - JSON, CSV, and MAL XML export complete
9. ✅ **Watch History** - Monthly/yearly summaries with export
10. ✅ **Quick Actions Menu** - Right-click context menu with keyboard navigation (Enter, Arrow keys, Esc)
11. ✅ **Watch Queue/Planner** - Integrated into Watching tab with unified view
12. ✅ **Personal Goals & Targets** - Goal tracking with progress indicators

### Next Steps (Recommended Priority):

1. **Statistics Enhancements** ⭐⭐ (User Interest: Medium)
   - Completion rate statistics
   - Most watched directors
   - Additional time-based analytics
   - **Note**: Need to evaluate data limits and performance impact
   - **Good for**: Personal use, single-user setup

2. **AI-Powered List Analysis** ⭐ (User Interest: Low - Not needed currently)
   - "What does your list say about you?" analysis
   - Genre diversity analysis
   - Watch pattern analysis
   - Can be implemented later if desired

3. **Social Features** ⭐ (User Interest: Low - Not needed for self-hosted single-user)
   - Friend system
   - Share lists publicly
   - Compare lists with friends
   - Requires infrastructure, high complexity
   - **Note**: Not needed for personal use

4. **Watch Together/Collaborative Lists** ⭐ (User Interest: Low - Not needed for self-hosted single-user)
   - Watch parties
   - Synchronized playback
   - Group chat
   - Complex real-time features
   - **Note**: Not needed for personal use

---

## 🎯 Suggested Next Features

### Priority 1: Personal Use Features
1. **Statistics Enhancements** - Additional analytics (need to evaluate data limits)
   - Completion rate statistics
   - Most watched directors
   - Additional time-based analytics
   - Good for single-user, self-hosted setup

### Priority 2: Low Priority / Not Needed Currently
2. **AI-Powered List Analysis** - Not needed currently, can be implemented later
3. **Social Features** - Not needed for self-hosted single-user setup
4. **Watch Together/Collaborative Lists** - Not needed for self-hosted single-user setup

---

## 🚫 Do Not Suggest

The following features should **not** be suggested or implemented:

1. **Dark Mode Toggle** - User does not want dark mode
2. **Import Features** - Not needed (users already sync with AniList)
3. **Enhancements to Existing Features** (Section 3) - User does not like this category
4. **Social Features** - Not needed for self-hosted single-user setup
5. **Watch Together/Collaborative Lists** - Not needed for self-hosted single-user setup

