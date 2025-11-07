# 🎌 Anime Dashboard

A beautiful, feature-rich anime tracking dashboard with AniList integration. Visualize your anime watching journey with comprehensive statistics, calendar views, custom lists, achievements, and AI-powered recommendations.

![Anime Dashboard](https://img.shields.io/badge/Status-Production%20Ready-success)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## ✨ Features

### 📊 Core Features
- **AniList OAuth Integration** - Seamlessly connect your AniList account
- **9 Main Tabs** - Watching, Visualizations, Full List, Insights, Calendar, History, Achievements, My Lists, Goals
- **Multiple Themes** - Default, Sakura 🌸, Sky ☀️, and Neon 👾 with smooth animations
- **Advanced Statistics** - 10+ interactive charts with Chart.js
- **Smart Filtering** - Search, filter, and sort your anime collection
- **Grid/Table Views** - Toggle between grid and table layouts

### 🎯 Advanced Features
- **Custom Lists** - Create and organize custom collections (Favorites, Rewatch Later, Seasonal, etc.)
- **Achievements System** - Unlock 20+ achievements as you watch anime
- **Goals Tracking** - Set and track personal anime watching goals
- **Watch History** - Monthly and yearly summaries with export functionality
- **Calendar View** - See when your favorite anime air next with search and filters
- **AI Recommendations** - Get personalized anime recommendations using Gemini AI
- **Export Features** - Export your data as JSON, CSV, or MyAnimeList XML format
- **Notes & Dates** - Add notes and track watch dates for each anime
- **Streaming Links** - Quick access to free streaming sites
- **Bulk Operations** - Select and update multiple anime at once
- **Quick Actions** - Right-click context menu with keyboard navigation

### 🎨 UI/UX
- **Responsive Design** - Works beautifully on desktop and mobile
- **Smooth Animations** - Theme-aware transitions and effects
- **Keyboard Shortcuts** - Navigate efficiently with keyboard
- **Form Validation** - Visual feedback for form inputs
- **Loading States** - Skeleton loaders and progress indicators
- **Error Handling** - Graceful error handling with user-friendly messages

---

## 🚀 Quick Start Guide

### Prerequisites

Before you begin, make sure you have:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **PostgreSQL** database ([Download](https://www.postgresql.org/download/))
- **AniList OAuth App** ([Create one here](https://anilist.co/settings/developer))

### Step 1: Clone & Install

```bash
# Navigate to project directory
cd anime-dashboard

# Install dependencies
npm install
```

### Step 2: Set Up Database

1. **Create PostgreSQL database**:
   ```sql
   CREATE DATABASE anime_dashboard;
   ```

2. **Set up Prisma**:
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Create database tables
   npm run prisma:push
   ```

### Step 3: Configure AniList OAuth

1. Go to [AniList API Settings](https://anilist.co/settings/developer)
2. Click **"Create New Application"**
3. Fill in the form:
   - **Application Name**: `Anime Dashboard` (or any name)
   - **Application Description**: `Personal anime tracking dashboard`
   - **Redirect URL**: `http://localhost:3000/auth/anilist/callback`
4. Click **"Create Application"**
5. Copy your **Client ID** and **Client Secret**

### Step 4: Create Environment File

Create a `.env` file in the root directory:

```env
# Required - AniList OAuth
ANILIST_CLIENT_ID=your_client_id_here
ANILIST_CLIENT_SECRET=your_client_secret_here

# Required - Database
DATABASE_URL=postgresql://username:password@localhost:5432/anime_dashboard

# Optional - Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000
SESSION_SECRET=your-random-secret-here-change-this

# Optional - AI Features (Gemini)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Optional - Dashboard Configuration
DASHBOARD_TITLE=My Anime Dashboard
DASHBOARD_SUBTITLE=Visualize your anime watching journey.
```

**⚠️ Important**: Replace all placeholder values with your actual credentials!

### Step 5: Start the Application

**Option 1: Run both servers together** (Recommended):

```bash
npm run dev:all
```

This starts both the Express server (port 3000) and Vite dev server (port 3001) in one terminal.

**Option 2: Run servers separately**:

```bash
# Terminal 1 - Express server
npm run dev

# Terminal 2 - Vite dev server
npm run dev:vite
```

### Step 6: Open in Browser

Navigate to: **http://localhost:3001**

You should see the login page. Click **"Login with AniList"** to authenticate!

---

## 📖 Detailed Setup

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ANILIST_CLIENT_ID` | Your AniList OAuth Client ID | `12345` |
| `ANILIST_CLIENT_SECRET` | Your AniList OAuth Client Secret | `abc123...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/anime_dashboard` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Express server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `BASE_URL` | Base URL for OAuth callbacks | `http://localhost:3000` |
| `SESSION_SECRET` | Secret for session encryption | `change-me` |
| `GEMINI_API_KEY` | Google Gemini API key (for AI features) | - |
| `GEMINI_MODEL` | Gemini model to use | `gemini-2.5-flash` |
| `DASHBOARD_TITLE` | Dashboard title | `My Anime Dashboard` |
| `DASHBOARD_SUBTITLE` | Dashboard subtitle | `Visualize your anime watching journey.` |

### Database Setup

The project uses PostgreSQL with Prisma ORM. The database stores:

- User sessions
- Custom lists and list entries
- User preferences

**First-time setup**:

```bash
# 1. Create database (in PostgreSQL)
CREATE DATABASE anime_dashboard;

# 2. Generate Prisma client
npm run prisma:generate

# 3. Push schema to database (creates tables)
npm run prisma:push
```

**View database** (optional):

```bash
npm run prisma:studio
```

This opens Prisma Studio, a GUI to view and edit your database.

---

## 🎮 Usage

### Development Mode

Development mode uses two servers:

- **Express server** (port 3000): Backend API and authentication
- **Vite dev server** (port 3001): Frontend with hot module replacement

**Recommended**: Use `npm run dev:all` to start both servers together.

**Access**: Open `http://localhost:3001` in your browser.

### Production Mode

1. **Update `.env`** with production values:
   ```env
   NODE_ENV=production
   BASE_URL=https://yourdomain.com
   SESSION_SECRET=your-strong-random-secret-here
   # ... other production values
   ```

2. **Build the frontend**:
   ```bash
   npm run build
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access**: Navigate to your production URL (e.g., `https://yourdomain.com`)

---

## 📁 Project Structure

```
.
├── css/                    # Stylesheets
│   ├── base/              # Base styles (variables, reset, typography)
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature-specific styles
│   ├── layout/            # Layout styles (header, tabs, responsive)
│   └── themes/            # Theme-specific effects and animations
├── scripts/               # JavaScript modules
│   ├── main.js           # Main application entry point
│   ├── charts.js         # Chart.js integration
│   ├── airing.js         # Watching tab functionality
│   ├── calendar.js       # Calendar tab functionality
│   ├── achievements.js    # Achievements system
│   ├── custom-lists.js    # Custom lists management
│   └── ...                # Other feature modules
├── routes/                # Express route handlers
│   ├── api.js            # API endpoints
│   └── auth.js            # Authentication (AniList OAuth)
├── prisma/                # Prisma schema and migrations
│   └── schema.prisma     # Database schema
├── data/                  # Data files
│   └── achievements.json  # Achievement definitions
├── docs/                  # Documentation
│   └── FEATURE_ROADMAP.md # Feature roadmap
├── server.js              # Express server entry point
├── index.html             # Main HTML file
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json           # Dependencies and scripts
```

---

## 🛠️ Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Start both Express and Vite servers together (recommended) |
| `npm run dev` | Start Express server with nodemon (auto-restart on changes) |
| `npm run dev:vite` | Start Vite dev server for frontend development |

### Production

| Command | Description |
|---------|-------------|
| `npm run build` | Build frontend for production (outputs to `/dist`) |
| `npm run preview` | Preview production build locally |
| `npm start` | Start production server |

### Database (Prisma)

| Command | Description |
|---------|-------------|
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:push` | Push schema to database (creates/updates tables) |
| `npm run prisma:studio` | Open Prisma Studio (database GUI) |

### Code Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint to check code quality |
| `npm run lint:fix` | Run ESLint and auto-fix issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting without fixing |

---

## 🔧 Configuration

### AniList OAuth Setup

1. Go to [AniList API Settings](https://anilist.co/settings/developer)
2. Create a new application
3. **For Development**: Set redirect URL to `http://localhost:3000/auth/anilist/callback`
4. **For Production**: Add redirect URL to `https://yourdomain.com/auth/anilist/callback`
5. Copy Client ID and Client Secret to `.env`

**Note**: AniList allows multiple redirect URLs per application, so you can add both development and production URLs to the same app.

### AI Features (Optional)

To enable AI-powered recommendations:

1. Get a Google Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to `.env`:
   ```env
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```

Without this, the Insights tab will still work but won't have AI recommendations.

---

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 or 3001 is already in use:

- **Express server**: Change `PORT` in `.env`
- **Vite server**: Change `server.port` in `vite.config.js`

### Database Connection Issues

- Ensure PostgreSQL is running
- Verify `DATABASE_URL` is correct in `.env`
- Run `npm run prisma:push` to create tables
- Check database credentials and permissions

### OAuth Not Working

- Verify `ANILIST_CLIENT_ID` and `ANILIST_CLIENT_SECRET` are correct
- Check that redirect URL matches exactly in AniList settings
- Ensure `BASE_URL` in `.env` matches your server URL
- Check browser console for errors

### CSS/JavaScript Not Loading

- Clear browser cache
- Check that Vite dev server is running (development mode)
- Verify `npm run build` completed successfully (production mode)
- Check browser console for 404 errors

### Theme Animations Not Showing

- Check browser console for errors
- Ensure CSS files are loading correctly
- Try refreshing the page
- Verify theme files exist in `css/themes/`

---

## 🎨 Features Overview

### Watching Tab
- View currently watching, rewatching, and plan-to-watch anime
- See next episode countdowns and airing times
- Quick access to streaming links
- Episode progress indicators
- Priority highlighting for anime airing soon

### Visualizations Tab
- 10+ interactive charts (Chart.js)
- Quick stat cards (Top Genre, Top Studio, Completion Rate)
- Theme-aware chart colors
- Watch time breakdown by genre and year
- Genre evolution over time

### Full List Tab
- Advanced filtering and search
- Grid/Table view toggle
- Bulk operations (select multiple, update status/score)
- Sort by various criteria
- Quick actions context menu

### Insights Tab
- AI-powered personalized recommendations
- "For You" recommendations
- "Hidden Gems" underrated anime
- "Based on Your Top 5" similar recommendations
- Find similar anime feature

### Calendar Tab
- Seasonal anime browsing
- Search and filter functionality
- Quick filter buttons (Airing This Week, In My List, High Score)
- Genre filter
- Stats summary (Airing, Upcoming, In My List, High Score)
- Season navigation with "Current" button

### History Tab
- Monthly watch summaries
- Year and month selectors
- Export watch history as CSV/JSON

### Achievements Tab
- 20+ achievements across multiple categories
- Progress tracking
- Rarity system (common to legendary)
- Achievement filtering

### My Lists Tab
- Create, edit, and delete custom lists
- Add/remove anime from lists
- Form validation
- List management UI

### Goals Tab
- Set yearly and monthly goals
- Track progress with visual indicators
- Form validation
- Goal management

---

## 🛡️ Security Notes

- **Never commit** your `.env` file to version control
- **Never commit** `config.js` with API keys
- Use a strong, unique `SESSION_SECRET` in production
- Keep your AniList Client Secret secure
- Use HTTPS in production
- Regularly update dependencies

---

## 🧪 Tech Stack

- **Backend**: Express.js, Node.js
- **Frontend**: Vanilla JavaScript (ES6+), Vite
- **Styling**: CSS with PostCSS, Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Chart.js
- **Authentication**: OAuth 2.0 (AniList)
- **AI**: Google Gemini API (optional)

---

## 📝 License

ISC

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📚 Additional Resources

- [AniList API Documentation](https://anilist.gitbook.io/anilist-apiv2-docs/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Consumet API Setup Guide](./docs/CONSUMET_SETUP.md) - How to host your own Consumet API

---

## 🎉 Enjoy!

Happy anime tracking! 🎌✨
