// Vite plugin to inject config.js into index.html during build
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export function injectConfig() {
  return {
    name: 'inject-config',
    transformIndexHtml(html, context) {
      // Only inject in production builds
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        // Get config from environment variables
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

        // Replace <script src="config.js"></script> with inline config
        const configScript = `<script>${config}</script>`;
        
        // Try to replace the script tag
        let modifiedHtml = html.replace(
          /<script[^>]*\s+src=["']\/?config\.js["'][^>]*><\/script>/gi,
          configScript
        );
        
        // If no script tag found, inject before </head>
        if (modifiedHtml === html && !html.includes('window.CONFIG')) {
          modifiedHtml = html.replace('</head>', `${configScript}\n</head>`);
        }
        
        console.log('✅ Injected config into index.html via Vite plugin');
        return modifiedHtml;
      }
      
      return html;
    }
  };
}

