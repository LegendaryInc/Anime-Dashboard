/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './scripts/**/*.js',
    './css/**/*.css'
  ],
  // Enable CSS purging in production (removes unused Tailwind classes)
  // This is automatic in Tailwind v3+ via the content configuration above
  theme: {
    extend: {}
  },
  plugins: [],
  // Optimize for production
  corePlugins: {
    // Disable unused Tailwind features if needed
    preflight: true // Keep base reset styles
  }
}

