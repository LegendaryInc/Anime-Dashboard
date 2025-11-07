import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import legacy from '@vitejs/plugin-legacy'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // CSS optimization
    cssCodeSplit: true, // Split CSS into separate files for better caching
    cssMinify: true, // Minify CSS in production (default: true)
    // Minify JavaScript (esbuild is faster than terser)
    minify: 'esbuild', // Use esbuild for faster minification
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        // Organize CSS files in assets/css directory
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        // Optimize chunk splitting
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.error('Vite proxy error:', err.message);
          });
        }
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/config.js': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/cosmetics-manifest.json': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // Gacha manifest removed - backed up to gacha-backup/
    }
  }
})

