// =====================================================================
// --- THEMES MODULE (themes.js) ---
// =====================================================================
// Handles loading and applying visual themes.
// =====================================================================

/**
 * Loads the saved theme from localStorage and applies it.
 * Defaults to 'default' theme if none is saved.
 */
export function loadTheme() {
  const savedTheme = localStorage.getItem('animeDashboardTheme') || 'default';
  setTheme(savedTheme);
}

/**
 * Applies a new theme to the application.
 * @param {string} theme - The name of the theme to apply (e.g., 'sakura', 'neon').
 */
export function setTheme(theme) {
  const themeSwitcher = document.getElementById('theme-switcher');
  const backgroundAnimations = document.getElementById('background-animations');
  const blobContainer = document.getElementById('blob-container');

  // 1. Set the new theme on the body
  document.body.className = `theme-${theme}`;
  localStorage.setItem('animeDashboardTheme', theme);

  // 2. Update the theme switcher UI
  if (themeSwitcher) {
    themeSwitcher.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  // 3. Handle theme-specific background animations
  if (backgroundAnimations) backgroundAnimations.innerHTML = ''; // Clear old animations
  if (blobContainer) blobContainer.classList.remove('hidden'); // Show blob by default

  if (theme === 'sakura') {
    for (let i = 0; i < 15; i++) {
      const petal = document.createElement('div');
      petal.className = 'petal';
      petal.style.left = `${Math.random() * 100}vw`;
      petal.style.animationDuration = `${5 + Math.random() * 10}s`;
      petal.style.animationDelay = `-${Math.random() * 10}s`;
      petal.style.transform = `scale(${0.5 + Math.random() * 0.5})`;
      if (backgroundAnimations) backgroundAnimations.appendChild(petal);
    }
  } else if (theme === 'sky') {
    for (let i = 0; i < 3; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      cloud.style.left = `${-400 - Math.random() * 400}px`;
      cloud.style.top = `${20 + Math.random() * 50}vh`;
      cloud.style.animationDuration = `${20 + Math.random() * 40}s`;
      cloud.style.animationDelay = `-${Math.random() * 40}s`;
      if (backgroundAnimations) backgroundAnimations.appendChild(cloud);
    }
  } else if (theme === 'neon') {
    if (blobContainer) blobContainer.classList.add('hidden'); // Hide blob on neon theme
  }

  // NOTE: Re-rendering charts is now handled by the event listener in main.js
  // This keeps this module focused *only* on theme application.
}