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

// Write to both public (for Vite to copy) and dist (for Vercel)
const publicPath = path.join(__dirname, '..', 'public', 'config.js');
const distPath = path.join(__dirname, '..', 'dist', 'config.js');
const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const distIndexHtmlPath = path.join(__dirname, '..', 'dist', 'index.html');

// Ensure directories exist
const publicDir = path.dirname(publicPath);
const distDir = path.dirname(distPath);

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('📁 Created public directory');
}

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('📁 Created dist directory');
}

// Write to public (for Vite dev and build)
fs.writeFileSync(publicPath, config);
console.log('✅ Generated config.js in public/ with API_BASE:', API_BASE);

// Also write to dist (for Vercel production)
if (fs.existsSync(distDir)) {
  fs.writeFileSync(distPath, config);
  console.log('✅ Generated config.js in dist/ with API_BASE:', API_BASE);
  
  // Also inject config into dist/index.html for Vercel
  if (fs.existsSync(distIndexHtmlPath)) {
    let distHtml = fs.readFileSync(distIndexHtmlPath, 'utf8');
    // Replace <script src="config.js"></script> with inline config
    distHtml = distHtml.replace(
      /<script src="config\.js"><\/script>/,
      `<script>${config}</script>`
    );
    fs.writeFileSync(distIndexHtmlPath, distHtml);
    console.log('✅ Injected config into dist/index.html');
  }
}

