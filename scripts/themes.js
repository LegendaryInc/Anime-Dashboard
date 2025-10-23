// =====================================================================
// --- THEMES MODULE (themes.js) - WITH NEON CITY ENHANCEMENTS ---
// =====================================================================
// Handles loading and applying visual themes with background effects
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

  // 1. Set the new theme on the body
  document.body.className = `theme-${theme}`;
  localStorage.setItem('animeDashboardTheme', theme);

  // 2. Update the theme switcher UI
  if (themeSwitcher) {
    themeSwitcher.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  // 3. Clear old background animations
  if (backgroundAnimations) backgroundAnimations.innerHTML = '';

  // 4. Apply theme-specific background effects
  if (theme === 'sakura') {
    createSakuraPetals(backgroundAnimations);
  } else if (theme === 'sky') {
    createSkyClouds(backgroundAnimations);
  } else if (theme === 'neon') {
    createNeonCityscape();
    createLightStreaks();
  }

  // Note: Chart re-rendering is handled by event listener in main.js
}

/**
 * Creates falling sakura petals for the Sakura theme
 */
function createSakuraPetals(container) {
  if (!container) return;
  
  for (let i = 0; i < 15; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.left = `${Math.random() * 100}vw`;
    petal.style.animationDuration = `${5 + Math.random() * 10}s`;
    petal.style.animationDelay = `-${Math.random() * 10}s`;
    petal.style.transform = `scale(${0.5 + Math.random() * 0.5})`;
    container.appendChild(petal);
  }
}

/**
 * Creates drifting clouds for the Sky theme
 */
function createSkyClouds(container) {
  if (!container) return;
  
  for (let i = 0; i < 3; i++) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    cloud.style.left = `${-400 - Math.random() * 400}px`;
    cloud.style.top = `${20 + Math.random() * 50}vh`;
    cloud.style.animationDuration = `${20 + Math.random() * 40}s`;
    cloud.style.animationDelay = `-${Math.random() * 40}s`;
    container.appendChild(cloud);
  }
}

/**
 * Creates the neon cityscape background for the Neon theme
 */
function createNeonCityscape() {
  // Remove existing cityscape if present
  let existingCity = document.querySelector('.city-buildings');
  if (existingCity) {
    existingCity.remove();
  }

  // Create city container
  const cityContainer = document.createElement('div');
  cityContainer.className = 'city-buildings';

  // Create 8-12 buildings with random heights
  const buildingCount = 8 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < buildingCount; i++) {
    const building = document.createElement('div');
    building.className = 'building';
    
    // Random building dimensions
    const width = 40 + Math.random() * 80; // 40-120px wide
    const height = 30 + Math.random() * 70; // 30-100% of container height
    
    building.style.width = `${width}px`;
    building.style.height = `${height}%`;
    building.style.marginLeft = `${Math.random() * 10}px`; // Small spacing
    
    // Random animation delay for building lights
    building.style.setProperty('--light-delay', `${Math.random() * 4}s`);
    
    cityContainer.appendChild(building);
  }

  // Append to body
  document.body.appendChild(cityContainer);
}

/**
 * Creates neon light streaks that occasionally zip across the screen
 */
function createLightStreaks() {
  // Remove existing streaks
  document.querySelectorAll('.light-streak').forEach(streak => streak.remove());

  // Create 3 light streaks
  const colors = [
    { color: 'rgba(0, 255, 255, 0.8)', shadow: 'rgba(0, 255, 255, 0.8)' },      // Cyan
    { color: 'rgba(255, 0, 255, 0.8)', shadow: 'rgba(255, 0, 255, 0.8)' },      // Magenta
    { color: 'rgba(255, 255, 0, 0.8)', shadow: 'rgba(255, 255, 0, 0.8)' }       // Yellow
  ];

  for (let i = 0; i < 3; i++) {
    const streak = document.createElement('div');
    streak.className = 'light-streak';
    
    // Random positioning
    const top = 20 + Math.random() * 70; // 20-90% from top
    const width = 150 + Math.random() * 100; // 150-250px wide
    const duration = 3 + Math.random() * 3; // 3-6 seconds
    const delay = Math.random() * 5; // 0-5 second initial delay
    
    streak.style.top = `${top}%`;
    streak.style.width = `${width}px`;
    streak.style.animationDuration = `${duration}s`;
    streak.style.animationDelay = `${delay}s`;
    
    // Apply color
    const colorData = colors[i % colors.length];
    streak.style.background = `linear-gradient(90deg, transparent, ${colorData.color}, transparent)`;
    streak.style.boxShadow = `0 0 10px ${colorData.shadow}`;
    
    // Make them repeat forever
    streak.style.animationIterationCount = 'infinite';
    
    document.body.appendChild(streak);
  }
}

/**
 * Clean up function to remove neon city elements when switching themes
 */
function cleanupNeonEffects() {
  // Remove city buildings
  const cityBuildings = document.querySelector('.city-buildings');
  if (cityBuildings) {
    cityBuildings.remove();
  }

  // Remove light streaks
  document.querySelectorAll('.light-streak').forEach(streak => streak.remove());
}

// Call cleanup when theme changes away from neon
const originalSetTheme = setTheme;
export { originalSetTheme };