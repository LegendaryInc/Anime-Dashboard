// Generate config.js at build time
// This script creates config.js with the API_BASE URL from environment variables

const fs = require('fs');
const path = require('path');

// Get API base URL from environment variable
const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE || 'http://localhost:3000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DASHBOARD_TITLE = process.env.DASHBOARD_TITLE || 'My Anime Dashboard';
const DASHBOARD_SUBTITLE = process.env.DASHBOARD_SUBTITLE || 'Visualize your anime watching journey.';
const EPISODES_PER_PAGE = process.env.EPISODES_PER_PAGE || 25;
const CHART_GENRE_LIMIT = process.env.CHART_GENRE_LIMIT || 10;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const config = `window.CONFIG = {
  DASHBOARD_TITLE: "${DASHBOARD_TITLE}",
  DASHBOARD_SUBTITLE: "${DASHBOARD_SUBTITLE}",
  GEMINI_API_KEY: "${GEMINI_API_KEY}",
  EPISODES_PER_PAGE: ${EPISODES_PER_PAGE},
  CHART_GENRE_LIMIT: ${CHART_GENRE_LIMIT},
  GEMINI_MODEL: "${GEMINI_MODEL}",
  API_BASE: "${API_BASE}"
};`;

const configPath = path.join(__dirname, '..', 'public', 'config.js');
fs.writeFileSync(configPath, config);
console.log('✅ Generated config.js with API_BASE:', API_BASE);

