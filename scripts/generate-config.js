// Generate config.js at build time
// This script creates config.js with the API_BASE URL from environment variables

const fs = require('fs');
const path = require('path');

// Wrap everything in try-catch to catch any errors
try {

// Get API base URL from environment variable
const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE || 'http://localhost:3000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DASHBOARD_TITLE = process.env.DASHBOARD_TITLE || 'My Anime Dashboard';
const DASHBOARD_SUBTITLE = process.env.DASHBOARD_SUBTITLE || 'Visualize your anime watching journey.';
const EPISODES_PER_PAGE = process.env.EPISODES_PER_PAGE || 25;
const CHART_GENRE_LIMIT = process.env.CHART_GENRE_LIMIT || 10;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Log environment variables for debugging
console.log('🔧 Environment variables:');
console.log('  API_BASE:', API_BASE);
console.log('  VITE_API_BASE:', process.env.VITE_API_BASE || 'not set');
console.log('  GEMINI_API_KEY:', GEMINI_API_KEY ? '***set***' : 'not set');

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
console.log('🔍 Checking if dist directory exists:', distDir);
if (fs.existsSync(distDir)) {
  console.log('✅ dist directory exists');
  fs.writeFileSync(distPath, config);
  console.log('✅ Generated config.js in dist/ with API_BASE:', API_BASE);
  
  // Also inject config into dist/index.html for Vercel
  console.log('🔍 Checking for dist/index.html at:', distIndexHtmlPath);
  console.log('🔍 File exists?', fs.existsSync(distIndexHtmlPath));
  if (fs.existsSync(distIndexHtmlPath)) {
    console.log('✅ Found dist/index.html, attempting to inject config...');
    let distHtml = fs.readFileSync(distIndexHtmlPath, 'utf8');
    
    // Check if config is already injected (avoid double injection)
    console.log('🔍 Checking if config is already present in dist/index.html...');
    if (distHtml.includes('window.CONFIG')) {
      console.log('✅ Config already present in dist/index.html, skipping injection');
      // But verify API_BASE is correct
      if (distHtml.includes(`API_BASE: "${API_BASE}"`)) {
        console.log(`✅ Verified: API_BASE is correctly set to "${API_BASE}"`);
      } else {
        console.warn(`⚠️  Warning: API_BASE might not be set correctly. Expected: "${API_BASE}"`);
      }
    } else {
      console.log('🔍 Config not found, attempting to inject...');
      // Try multiple patterns to find and replace the script tag
      // Handle various formats: <script src="config.js"></script>, <script src='/config.js'></script>, etc.
      const patterns = [
        /<script[^>]*\s+src=["']config\.js["'][^>]*><\/script>/gi,
        /<script[^>]*\s+src=["']\/config\.js["'][^>]*><\/script>/gi,
        /<script[^>]*\s+src=["']\.\/config\.js["'][^>]*><\/script>/gi,
        /<script[^>]*\s+src=["']\/?config\.js["'][^>]*><\/script>/gi,
      ];
      
      let replaced = false;
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        if (pattern.test(distHtml)) {
          distHtml = distHtml.replace(pattern, `<script>${config}</script>`);
          replaced = true;
          console.log(`✅ Replaced config.js script tag in dist/index.html (pattern ${i + 1})`);
          break;
        }
      }
      
      if (!replaced) {
        // If no script tag found, inject before closing </head> tag
        if (distHtml.includes('</head>')) {
          distHtml = distHtml.replace('</head>', `<script>${config}</script>\n</head>`);
          console.log('✅ Injected config before </head> in dist/index.html');
        } else {
          // Last resort: inject at the beginning of <head>
          if (distHtml.includes('<head>')) {
            distHtml = distHtml.replace('<head>', `<head>\n<script>${config}</script>`);
            console.log('✅ Injected config at start of <head> in dist/index.html');
          } else {
            console.warn('⚠️  Could not find <head> tag in dist/index.html');
            // Last last resort: inject at the very beginning
            distHtml = `<script>${config}</script>\n${distHtml}`;
            console.log('✅ Injected config at the very beginning of dist/index.html');
          }
        }
      }
      
      fs.writeFileSync(distIndexHtmlPath, distHtml);
      console.log('✅ Updated dist/index.html with embedded config');
      
      // Verify the injection worked
      const verifyHtml = fs.readFileSync(distIndexHtmlPath, 'utf8');
      if (verifyHtml.includes('window.CONFIG')) {
        console.log('✅ Verified: window.CONFIG is present in dist/index.html');
        if (verifyHtml.includes(`API_BASE: "${API_BASE}"`)) {
          console.log(`✅ Verified: API_BASE is set to "${API_BASE}"`);
        } else {
          console.warn(`⚠️  Warning: API_BASE might not be set correctly in dist/index.html`);
        }
      } else {
        console.error('❌ Error: window.CONFIG was not found in dist/index.html after injection!');
      }
    }
  } else {
    console.warn('⚠️  dist/index.html not found, skipping injection');
    console.warn('⚠️  dist/index.html path:', distIndexHtmlPath);
    console.warn('⚠️  dist directory contents:', fs.existsSync(distDir) ? fs.readdirSync(distDir).join(', ') : 'distDir does not exist');
  }
} else {
  console.warn('⚠️  dist directory does not exist:', distDir);
}

} catch (error) {
  console.error('❌ Error in generate-config.js:', error);
  console.error('❌ Error stack:', error.stack);
  process.exit(1);
}

