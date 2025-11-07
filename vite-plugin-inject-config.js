// Vite plugin to inject config.js into index.html during build
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export function injectConfig() {
  return {
    name: 'inject-config',
    transformIndexHtml(html, context) {
      // Always inject during build (Vite only calls this during build)
      // Get config from environment variables
      const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE || 'http://localhost:3000';
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
      const DASHBOARD_TITLE = process.env.DASHBOARD_TITLE || 'My Anime Dashboard';
      const DASHBOARD_SUBTITLE = process.env.DASHBOARD_SUBTITLE || 'Visualize your anime watching journey.';
      const EPISODES_PER_PAGE = process.env.EPISODES_PER_PAGE || 25;
      const CHART_GENRE_LIMIT = process.env.CHART_GENRE_LIMIT || 10;
      const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      // Log environment variables for debugging
      console.log('🔧 [Vite Plugin] Environment variables:');
      console.log('  API_BASE:', API_BASE);
      console.log('  NODE_ENV:', process.env.NODE_ENV);
      console.log('  VERCEL:', process.env.VERCEL);
      console.log('  All API_BASE env vars:', {
        'process.env.API_BASE': process.env.API_BASE,
        'process.env.VITE_API_BASE': process.env.VITE_API_BASE
      });

      const config = `window.CONFIG = {
  DASHBOARD_TITLE: "${DASHBOARD_TITLE}",
  DASHBOARD_SUBTITLE: "${DASHBOARD_SUBTITLE}",
  GEMINI_API_KEY: "${GEMINI_API_KEY}",
  EPISODES_PER_PAGE: ${EPISODES_PER_PAGE},
  CHART_GENRE_LIMIT: ${CHART_GENRE_LIMIT},
  GEMINI_MODEL: "${GEMINI_MODEL}",
  API_BASE: "${API_BASE}"
};`;

      // Replace <script src="config.js"></script> with inline config
      const configScript = `<script>${config}</script>`;
      
      // Check if script tag exists
      const scriptTagPattern = /<script[^>]*\s+src=["']\/?config\.js["'][^>]*><\/script>/gi;
      const hasScriptTag = scriptTagPattern.test(html);
      
      // Try to replace the script tag
      let modifiedHtml = html.replace(scriptTagPattern, configScript);
      
      // If no script tag found and config not already present, inject before </head>
      if (modifiedHtml === html && !html.includes('window.CONFIG')) {
        if (html.includes('</head>')) {
          modifiedHtml = html.replace('</head>', `${configScript}\n</head>`);
          console.log('✅ [Vite Plugin] Injected config before </head>');
        } else if (html.includes('<head>')) {
          modifiedHtml = html.replace('<head>', `<head>\n${configScript}`);
          console.log('✅ [Vite Plugin] Injected config at start of <head>');
        } else {
          console.warn('⚠️  [Vite Plugin] Could not find <head> tag');
        }
      } else if (hasScriptTag) {
        console.log('✅ [Vite Plugin] Replaced config.js script tag');
      } else if (html.includes('window.CONFIG')) {
        console.log('✅ [Vite Plugin] Config already present in HTML');
      }
      
      console.log('✅ [Vite Plugin] Config injected with API_BASE:', API_BASE);
      return modifiedHtml;
    }
  };
}

