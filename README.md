# Anime Dashboard

An anime tracking dashboard with AniList integration, featuring beautiful themes, statistics, calendar views, and more.

## Features

- 🎨 **Multiple Themes**: Default, Sakura, Sky, and Neon themes with smooth animations
- 📊 **Statistics Dashboard**: View your anime statistics with interactive charts
- 📅 **Calendar View**: See when your favorite anime air next
- 🎮 **Gacha System**: Earn tokens by watching episodes and collect cosmetics
- 🔍 **Advanced Filtering**: Filter and search through your anime collection
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** database (for session storage and user data)
- **AniList OAuth App** (get credentials from [AniList API Settings](https://anilist.co/settings/developer))

## Installation

1. **Clone the repository** (or navigate to the project directory):
   ```bash
   cd /path/to/anime-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   # Required
   ANILIST_CLIENT_ID=your_anilist_client_id
   ANILIST_CLIENT_SECRET=your_anilist_client_secret
   DATABASE_URL=postgresql://user:password@localhost:5432/anime_dashboard
   
   # Optional - Server Configuration
   PORT=3000
   NODE_ENV=development
   BASE_URL=http://localhost:3000
   
   # Optional - Dashboard Configuration
   DASHBOARD_TITLE=My Anime Dashboard
   DASHBOARD_SUBTITLE=Visualize your anime watching journey.
   EPISODES_PER_PAGE=25
   CHART_GENRE_LIMIT=10
   
   # Optional - Gacha System
   GACHA_EPISODES_PER_TOKEN=50
   GACHA_INITIAL_TOKENS=5
   
   # Optional - AI Features (Gemini)
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   
   # Optional - MyAnimeList (if using MAL)
   MAL_CLIENT_ID=your_mal_client_id
   MAL_CLIENT_SECRET=your_mal_client_secret
   
   # Optional - Consumet API (for streaming links)
   CONSUMET_API_URL=http://localhost:3002
   ```

4. **Set up Prisma**:
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Push schema to database (creates tables)
   npm run prisma:push
   ```

## Getting Started

### Development Mode

The project uses two servers in development:
- **Express server** (port 3000): Backend API and authentication
- **Vite dev server** (port 3001): Frontend with hot module replacement

**Option 1: Run both servers with one command** (easiest):

```bash
npm run dev:all
```

This will start both servers in the same terminal with colored output to distinguish them.

**Option 2: Run both servers separately** (if you need separate terminal windows):

1. **Terminal 1 - Start Express server**:
   ```bash
   npm run dev
   ```

2. **Terminal 2 - Start Vite dev server**:
   ```bash
   npm run dev:vite
   ```

3. **Open your browser**:
   Navigate to `http://localhost:3001` (Vite dev server)

### Production Mode

#### ⚠️ **IMPORTANT: Update Configuration for Production**

Before deploying to production, you **MUST** update these environment variables in your `.env` file:

**Required Changes:**
- ✅ `BASE_URL` - Change from `http://localhost:3000` to your production URL (e.g., `https://yourdomain.com`)
- ✅ `NODE_ENV=production` - Set to production mode
- ✅ `ANILIST_CLIENT_ID` - Verify it's correct for production
- ✅ `ANILIST_CLIENT_SECRET` - Verify it's correct for production
- ✅ `GEMINI_API_KEY` - Update if using production API key
- ✅ `DATABASE_URL` - Update to production database URL
- ✅ `SESSION_SECRET` - Use a strong, unique secret (not the default)

**Example Production `.env`:**
```env
NODE_ENV=production
BASE_URL=https://yourdomain.com
PORT=3000
DATABASE_URL=postgresql://user:password@prod-db-host:5432/anime_dashboard
SESSION_SECRET=your-strong-random-secret-here
ANILIST_CLIENT_ID=your_production_client_id
ANILIST_CLIENT_SECRET=your_production_client_secret
GEMINI_API_KEY=your_production_gemini_key
```

#### Production Deployment Steps

1. **Update `.env` file** with production values (see above)

2. **Build the frontend**:
   ```bash
   npm run build
   ```
   This creates an optimized production build in the `dist/` folder with:
   - Minified CSS and JavaScript
   - Optimized assets (images, fonts, etc.)
   - Tree-shaken code (removed unused code)
   - CSS purging (removed unused Tailwind classes)

3. **Start the production server**:
   ```bash
   NODE_ENV=production npm start
   ```
   Or on Windows PowerShell:
   ```powershell
   $env:NODE_ENV="production"; npm start
   ```
   
   The server will:
   - Serve the optimized production build from `dist/`
   - Use production configuration from `.env`
   - Generate `config.js` with production `BASE_URL` and API keys

4. **Open your browser**:
   Navigate to your production URL (e.g., `https://yourdomain.com`)

**Note**: The `dist/` folder contains the production build and should be:
- Deployed to your hosting service (the entire folder)
- Included in `.gitignore` (already configured)
- Regenerated whenever you make changes to the code

**⚠️ Security Reminder**: Never commit your `.env` file or `config.js` with API keys to version control!

## Available Scripts

### Development
- `npm run dev:all` - Start both Express and Vite servers together (recommended)
- `npm run dev` - Start Express server with nodemon (auto-restart on changes)
- `npm run dev:vite` - Start Vite dev server for frontend development

### Production
- `npm run build` - Build frontend for production (outputs to `/dist`)
- `npm run preview` - Preview production build locally
- `npm start` - Start production server

### Code Quality
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Run ESLint and auto-fix issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without fixing

### Database (Prisma)
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:push` - Push schema to database (creates/updates tables)
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Project Structure

```
.
├── css/                 # Stylesheets organized by category
│   ├── base/           # Base styles (variables, reset, typography)
│   ├── components/     # Reusable UI components
│   ├── features/       # Feature-specific styles
│   ├── layout/         # Layout styles (header, tabs, responsive)
│   └── themes/         # Theme-specific effects and animations
├── scripts/            # JavaScript modules
│   ├── main.js        # Main application entry point
│   ├── charts.js      # Chart.js integration
│   ├── themes.js      # Theme management
│   └── ...            # Content management tools
├── routes/             # Express route handlers
│   ├── api.js         # API endpoints
│   ├── auth.js        # Authentication (AniList, MAL)
│   └── gacha.js       # Gacha system
├── docs/               # Documentation files
│   ├── CONTENT_MANAGEMENT_GUIDE.md
│   ├── CHARACTERS_WALKTHROUGH.md
│   └── ...
├── data/               # Data and template files
│   ├── character-images.json      # Generated character images
│   ├── my-characters-list.json    # User's character list
│   ├── gacha-manifest-new.json    # Generated manifest (temporary)
│   └── *-template.*               # Template files
├── images/             # Image assets
│   └── gacha/          # Gacha character images
├── prisma/            # Prisma schema and migrations
├── public/            # Static assets
├── server.js          # Express server entry point
├── gacha-manifest.json # Main gacha manifest (served by server)
├── cosmetics-manifest.json # Cosmetics manifest (served by server)
├── vite.config.js     # Vite configuration
├── tailwind.config.js # Tailwind CSS configuration
└── postcss.config.js  # PostCSS configuration
```

## Configuration

### AniList OAuth Setup

1. Go to [AniList API Settings](https://anilist.co/settings/developer)
2. Create a new application (or use existing)
3. **For Development**: Set redirect URL to: `http://localhost:3000/auth/anilist/callback`
4. **For Production**: Add redirect URL to: `https://yourdomain.com/auth/anilist/callback` (replace with your actual domain)
5. Copy the Client ID and Client Secret to your `.env` file

**⚠️ Important**: AniList allows multiple redirect URLs per application, so you can add both development and production URLs to the same app.

### Database Setup

The project uses PostgreSQL for:
- User session storage
- User data persistence
- Gacha system state

Make sure PostgreSQL is running and create a database:
```sql
CREATE DATABASE anime_dashboard;
```

Then set `DATABASE_URL` in your `.env` file.

## Troubleshooting

### Port Already in Use
If port 3000 or 3001 is already in use:
- Change `PORT` in `.env` for Express server
- Change `server.port` in `vite.config.js` for Vite server

### CSS Import Errors
If you see PostCSS errors about `@import` statements:
- Make sure `postcss-import` is installed: `npm install --save-dev postcss-import`
- Check that `postcss.config.js` includes `postcss-import` as the first plugin

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify `DATABASE_URL` is correct in `.env`
- Run `npm run prisma:push` to create tables

### Theme Animations Not Showing
- Check browser console for errors
- Ensure background animations container exists in HTML
- Verify CSS files are loading correctly

## Tech Stack

- **Backend**: Express.js, Node.js
- **Frontend**: Vanilla JavaScript (ES6+), Vite
- **Styling**: CSS with PostCSS, Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Chart.js
- **Authentication**: OAuth 2.0 (AniList, MyAnimeList)

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

