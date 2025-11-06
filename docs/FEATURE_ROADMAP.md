# 🚀 Feature Roadmap

A comprehensive list of potential new features for the Anime Dashboard, organized by priority and category.

## 📊 Current Features

- ✅ AniList OAuth integration
- ✅ Multiple themes (Default, Sakura, Sky, Neon)
- ✅ Statistics dashboard with charts
- ✅ Calendar view for airing anime
- ✅ Advanced filtering and search
- ✅ Grid/List view toggle
- ✅ AI-powered recommendations (Insights tab)
- ✅ Notes feature (in anime details modal)
- ✅ Anime details modal with related anime
- ✅ Streaming links integration
- ✅ Responsive design
- ✅ Keyboard shortcuts

---

## 🎯 Priority 1: High-Value Features (Recommended First)

### 1. **Watch History Tracking** ⭐⭐⭐
**Impact**: High | **Complexity**: Medium

Track when you watched each anime and generate a watch history timeline.

**Features:**
- Add "Date Started" and "Date Completed" fields
- Visual timeline showing when you watched each anime
- "Watching Streak" counter (days in a row)
- Monthly/Yearly watch summaries
- Export watch history as CSV/JSON

**Implementation:**
- Store watch dates in localStorage or backend
- Add date pickers to anime details modal
- Create timeline visualization component
- Add streak calculation logic

**Files to Create/Modify:**
- `scripts/watch-history.js` (new)
- `scripts/anime-modal.js` (add date fields)
- `routes/api.js` (add watch history endpoints)
- `css/features/timeline.css` (new)

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
**Impact**: Medium-High | **Complexity**: Low-Medium

Gamify your anime watching experience with achievements.

**Features:**
- Unlock badges for milestones (100 anime, 1000 episodes, etc.)
- Genre master badges (completed 10+ anime in a genre)
- Streak achievements
- Seasonal badges (watched 10+ seasonal anime)
- Achievement showcase on profile

**Implementation:**
- Define achievement rules in config
- Track achievements in localStorage or backend
- Create badge display component
- Add achievement notifications

**Files to Create/Modify:**
- `scripts/achievements.js` (new)
- `data/achievements.json` (new)
- `css/features/achievements.css` (new)
- `routes/api.js` (add achievement tracking)

---

## 🎨 Priority 2: Enhanced User Experience

### 5. **Custom Lists/Collections** ⭐⭐
**Impact**: Medium | **Complexity**: Medium

Create custom lists to organize your anime (e.g., "Favorites", "Rewatch Later", "Seasonal 2024").

**Features:**
- Create unlimited custom lists
- Add/remove anime from lists
- Drag-and-drop list organization
- Share lists publicly
- List templates (e.g., "Top 10 Favorites")

**Implementation:**
- Add `CustomList` model to Prisma
- Create list management UI
- Add list filtering to main list view
- Export lists as JSON

**Files to Create/Modify:**
- `prisma/schema.prisma` (add CustomList model)
- `scripts/custom-lists.js` (new)
- `routes/api.js` (add list CRUD endpoints)
- `css/features/lists.css` (new)

---

### 6. **Notes & Reviews System** ⭐⭐
**Status**: ⚠️ **Partially Implemented**

**Current Implementation:**
- ✅ Notes feature exists in anime details modal
  - ✅ Notes tab (📝) in anime modal
  - ✅ Textarea with 2000 character limit
  - ✅ Character count display
  - ✅ Save notes functionality
  - ✅ Syncing with AniList (notes stored on AniList)

**Missing Features (Potential Enhancements):**
- ❌ Full reviews system (with ratings breakdown)
- ❌ "My Reviews" section (view all reviews)
- ❌ Export reviews as blog post format
- ❌ Review templates
- ❌ Rich text editor for reviews (currently plain text)
- ❌ Review search/filter

**Note**: The notes feature is already fully functional and synced with AniList. This could be enhanced with a full reviews system, but the basic notes functionality is complete.

---

### 7. **Advanced Statistics** ⭐⭐
**Impact**: Medium | **Complexity**: Low-Medium

More detailed statistics and analytics.

**Features:**
- Watch time breakdown by genre/year
- Completion rate statistics
- Average episode length
- Most watched studios/directors
- Genre evolution over time (chart)
- "Anime you've watched the longest" (time between start and complete)

**Implementation:**
- Extend existing statistics calculation
- Add new chart types
- Create advanced stats component
- Add time-based analytics

**Files to Create/Modify:**
- `scripts/data.js` (extend statistics)
- `scripts/charts.js` (add new chart types)
- `css/features/advanced-stats.css` (new)

---

### 8. **Export & Import Features** ⭐⭐
**Impact**: Medium | **Complexity**: Low

Enhanced export/import capabilities.

**Features:**
- Export to CSV/Excel
- Export to MyAnimeList XML format
- Import from MAL XML
- Export watch history
- Export statistics as PDF
- Backup/restore functionality

**Implementation:**
- Add export functions to data.js
- Create CSV/XML parsers
- Add import UI
- PDF generation library

**Files to Create/Modify:**
- `scripts/export.js` (new)
- `scripts/import.js` (new)
- `routes/api.js` (add import endpoint)

---

## 🔧 Priority 3: Quality of Life Improvements

### 9. **Bulk Operations** ⭐
**Impact**: Medium | **Complexity**: Low

Perform actions on multiple anime at once.

**Features:**
- Select multiple anime (checkboxes)
- Bulk update status/score
- Bulk add to custom lists
- Bulk export selected anime
- Bulk delete from list (if custom lists)

**Implementation:**
- Add selection mode to list view
- Create bulk action menu
- Add confirmation dialogs
- Batch API endpoints

**Files to Create/Modify:**
- `scripts/list.js` (add selection mode)
- `scripts/bulk-operations.js` (new)
- `routes/api.js` (add bulk endpoints)

---

### 10. **Quick Actions Menu** ⭐
**Impact**: Low-Medium | **Complexity**: Low

Right-click context menu for quick actions.

**Features:**
- Right-click on anime card for menu
- Quick actions: "Update Status", "Add Note", "Add to List", "Open Streaming Links"
- Keyboard shortcuts for common actions
- Customizable quick actions

**Implementation:**
- Create context menu component
- Add event listeners to anime cards
- Keyboard shortcut mapping

**Files to Create/Modify:**
- `scripts/context-menu.js` (new)
- `css/components/context-menu.css` (new)

---

### 11. **Dark Mode Toggle** ⭐
**Impact**: Low-Medium | **Complexity**: Low

Add a dedicated dark mode (separate from themes).

**Features:**
- Toggle dark/light mode
- Remember preference
- Auto-detect system preference
- Smooth transitions

**Implementation:**
- Add dark mode CSS variables
- Create theme toggle component
- Store preference in localStorage

**Files to Create/Modify:**
- `scripts/themes.js` (add dark mode)
- `css/themes/dark-mode.css` (new)

---

### 12. **Anime Details Enhancement** ⭐
**Impact**: Low-Medium | **Complexity**: Low

Enhanced anime details modal with more information.

**Features:**
- Character list with images
- Staff information (director, writer, etc.)
- Related anime (sequels, prequels, spin-offs)
- External links (MAL, AniList, official site)
- Trailers/PV links
- Studio information

**Implementation:**
- Fetch additional data from AniList API
- Enhance anime-modal.js
- Add character/staff display components

**Files to Create/Modify:**
- `scripts/anime-modal.js` (enhance)
- `routes/api.js` (add detailed info endpoint)

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

### 14. **Mobile App (PWA)** ⭐
**Impact**: Medium | **Complexity**: Medium

Convert to Progressive Web App for mobile installation.

**Features:**
- Install as mobile app
- Offline mode
- Push notifications for new episodes
- Mobile-optimized UI

**Implementation:**
- Add service worker
- Create manifest.json
- Optimize for mobile
- Add offline caching

**Files to Create/Modify:**
- `public/manifest.json` (new)
- `public/sw.js` (service worker)
- `vite.config.js` (PWA plugin)

---

### 15. **AI-Powered List Analysis** ⭐
**Impact**: Low | **Complexity**: Medium

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

---

## 📝 Implementation Recommendations

### Start with These (Easy Wins):
1. **Watch History Tracking** - High value, medium complexity
2. **Achievements System** - Fun, low-medium complexity
3. **Notes & Reviews** - Useful, low-medium complexity

### Next Steps (Medium Effort):
4. **Anime Recommendations** - High value, medium complexity
5. **Custom Lists** - Very useful, medium complexity
6. **Advanced Statistics** - Extend existing features

### Future (Long-term):
7. **Social Features** - Requires infrastructure
8. **Watch Together** - Complex real-time features

---

## 💡 Quick Feature Ideas (Low Effort)

- **Anime of the Day** - Randomly show one anime from your list each day
- **Completion Tracker** - Visual progress bar for completion percentage
- **Genre Wheel** - Visual representation of genre distribution
- **Seasonal Planner** - Plan what to watch each season
- **Rewatch Tracker** - Track how many times you've rewatched an anime
- **Episode Counter Widget** - Small widget showing daily/weekly episode count
- **Quote Collection** - Save favorite quotes from anime
- **Soundtrack Links** - Quick links to anime soundtracks on Spotify/YouTube

---

## 🎯 Suggested Next Feature

Based on complexity, impact, and user value, I recommend starting with:

**🎯 Watch History Tracking**

This feature:
- ✅ Provides immediate value (tracking when you watched things)
- ✅ Medium complexity (not too hard, not too easy)
- ✅ Builds on existing infrastructure
- ✅ Can be extended later (timeline, streaks, etc.)

Would you like me to start implementing this feature, or would you prefer to begin with a different one from the list?

