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
  const currentTheme = document.body.className.replace('theme-', '') || 'default';

  // Skip if already on this theme
  if (currentTheme === theme) {
    return;
  }

  // 1. Create transition overlay for smooth theme switching
  const transitionOverlay = document.createElement('div');
  transitionOverlay.className = 'theme-transition-overlay';
  document.body.appendChild(transitionOverlay);

  // 2. Fade out current theme
  requestAnimationFrame(() => {
    transitionOverlay.classList.add('active');
    
    // After fade out, switch theme
    setTimeout(() => {
      // Set the new theme on the body
      document.body.className = `theme-${theme}`;
      localStorage.setItem('animeDashboardTheme', theme);

      // Update the theme switcher UI
      if (themeSwitcher) {
        themeSwitcher.querySelectorAll('button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.theme === theme);
        });
      }

      // Clear old background animations and ensure container exists
      if (backgroundAnimations) {
        backgroundAnimations.innerHTML = '';
      } else {
        // Container doesn't exist, create it
        const container = document.createElement('div');
        container.id = 'background-animations';
        document.body.insertBefore(container, document.body.firstChild);
      }

      // Apply theme-specific background effects with a double RAF to ensure DOM is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = document.getElementById('background-animations');
          if (!container) {
            console.warn('setTheme: background-animations container not found');
            return;
          }

          if (theme === 'sakura') {
            createSakuraPetals(container);
          } else if (theme === 'sky') {
            createSkyClouds(container);
          } else if (theme === 'neon') {
            createNeonCityscape();
            // Light streaks removed - user preference
          } else {
            // Clear container for default theme
            container.innerHTML = '';
          }

          // Fade in new theme
          setTimeout(() => {
            transitionOverlay.classList.remove('active');
            setTimeout(() => {
              transitionOverlay.remove();
            }, 300);
          }, 50);
        });
      });
    }, 150); // Half of transition duration
  });

  // Note: Chart re-rendering is handled by event listener in main.js
}

/**
 * Shows a preview of a theme when hovering over theme switcher buttons
 * @param {string} theme - The theme to preview
 */
export function previewTheme(theme) {
  if (!theme) {
    // Remove preview
    document.body.classList.remove('theme-preview');
    return;
  }
  
  // Add preview class to body
  document.body.classList.add('theme-preview');
  document.body.setAttribute('data-preview-theme', theme);
}

/**
 * Removes theme preview
 */
export function removeThemePreview() {
  document.body.classList.remove('theme-preview');
  document.body.removeAttribute('data-preview-theme');
}

/**
 * Creates falling sakura petals for the Sakura theme
 */
function createSakuraPetals(container) {
  if (!container) {
    console.warn('createSakuraPetals: container not found');
    return;
  }
  
  // Ensure body has sakura theme class
  if (!document.body.classList.contains('theme-sakura')) {
    document.body.classList.add('theme-sakura');
  }
  
  // Ensure container is visible and positioned correctly
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.setProperty('display', 'block', 'important'); // Ensure container is visible
  
  // Inject CSS rule to force petals to be visible (override any hiding rules)
  if (!document.getElementById('force-petal-display')) {
    const style = document.createElement('style');
    style.id = 'force-petal-display';
    style.textContent = `
      .petal {
        display: block !important;
        visibility: visible !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Create more petals for a richer effect (20 instead of 15)
  for (let i = 0; i < 20; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.setProperty('display', 'block', 'important'); // Force display - override any CSS hiding it
    petal.style.position = 'absolute';
    // Set initial horizontal position (left stays constant, top animates)
    petal.style.left = `${Math.random() * 100}vw`;
    // Don't set top - animation handles it from -10% to 110%
    
    // Use animation shorthand to ensure it's applied correctly
    const duration = 6 + Math.random() * 12;
    const delay = Math.random() * 15;
    // Animation will handle top position from -10% to 110%
    // Use setProperty with important to override any CSS rules
    petal.style.setProperty('animation', `sakura-fall ${duration}s linear -${delay}s infinite`, 'important');
    petal.style.setProperty('animation-fill-mode', 'both', 'important');
    petal.style.setProperty('animation-play-state', 'running', 'important');
    // Don't set transform inline - animation uses transform for translateX and rotate
    // Scale is handled by CSS nth-child selectors
    petal.style.opacity = '0.8'; // Ensure visible
    petal.style.visibility = 'visible'; // Force visible
    petal.style.willChange = 'transform, opacity'; // Optimize for animation
    // Ensure background is visible
    petal.style.background = 'linear-gradient(135deg, #ffc0cb 0%, #ffb6c1 50%, #ff69b4 100%)';
    petal.style.borderRadius = '50% 0 50% 0';
    petal.style.width = '12px';
    petal.style.height = '12px';
    petal.style.zIndex = '1'; // Ensure above background
    container.appendChild(petal);
  }
  
  // Force reflow to ensure animations start
  container.offsetHeight; // Trigger reflow
  
  // Debug: Check if elements are visible and force display if needed
  setTimeout(() => {
    const petals = container.querySelectorAll('.petal');
    petals.forEach(petal => {
      const computed = window.getComputedStyle(petal);
      if (computed.display === 'none') {
        console.warn('Petal still hidden, forcing display...');
        petal.style.setProperty('display', 'block', 'important');
        petal.style.setProperty('visibility', 'visible', 'important');
      }
    });
    
    // Check container visibility
    const containerComputed = window.getComputedStyle(container);
    const containerRect = container.getBoundingClientRect();
    console.log('Container visibility:', {
      display: containerComputed.display,
      visibility: containerComputed.visibility,
      opacity: containerComputed.opacity,
      position: containerComputed.position,
      zIndex: containerComputed.zIndex,
      width: containerComputed.width,
      height: containerComputed.height,
      rect: containerRect
    });
    
    const firstPetal = container.querySelector('.petal');
    if (firstPetal) {
      const rect = firstPetal.getBoundingClientRect();
      const computed = window.getComputedStyle(firstPetal);
      console.log(`Petal visibility check:`, {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        position: computed.position,
        zIndex: computed.zIndex,
        top: computed.top,
        left: computed.left,
        width: computed.width,
        height: computed.height,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        },
        animation: computed.animation,
        animationName: computed.animationName,
        animationDuration: computed.animationDuration,
        animationDelay: computed.animationDelay,
        animationPlayState: computed.animationPlayState,
        backgroundColor: computed.backgroundColor
      });
      
      // Force animation if not running
      if (!computed.animationName || computed.animationName === 'none' || computed.animationPlayState === 'paused') {
        console.warn('⚠️ Petal animation not applied! Forcing animation...');
        const duration = computed.animationDuration || '10s';
        const delay = computed.animationDelay || '0s';
        firstPetal.style.animation = `sakura-fall ${duration} linear ${delay} infinite`;
        firstPetal.style.animationPlayState = 'running';
      }
    }
  }, 100);
  
  console.log(`Created ${container.children.length} sakura petals`);
}

/**
 * Creates drifting clouds for the Sky theme
 */
function createSkyClouds(container) {
  if (!container) {
    console.warn('createSkyClouds: container not found');
    return;
  }
  
  // Ensure body has sky theme class
  if (!document.body.classList.contains('theme-sky')) {
    document.body.classList.add('theme-sky');
  }
  
  // Ensure container is visible and positioned correctly
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.setProperty('display', 'block', 'important'); // Ensure container is visible
  
  // Inject CSS rule to force clouds to be visible (override any hiding rules)
  if (!document.getElementById('force-cloud-display')) {
    const style = document.createElement('style');
    style.id = 'force-cloud-display';
    style.textContent = `
      .cloud {
        display: block !important;
        visibility: visible !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Create more clouds for a richer sky effect (5 instead of 3)
  for (let i = 0; i < 5; i++) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    cloud.style.setProperty('display', 'block', 'important'); // Force display - override any CSS hiding it
    cloud.style.position = 'absolute';
    
    // Set initial vertical position (top stays constant, left animates)
    cloud.style.top = `${15 + Math.random() * 60}vh`;
    // Don't set left - animation handles it from -250px to calc(100% + 50px)
    
    // Use animation shorthand to ensure it's applied correctly
    const duration = 25 + Math.random() * 35;
    const delay = Math.random() * 50;
    // Animation will handle left position from -250px to calc(100% + 50px)
    // Use setProperty with important to override any CSS rules
    cloud.style.setProperty('animation', `cloud-drift ${duration}s linear -${delay}s infinite`, 'important');
    cloud.style.setProperty('animation-fill-mode', 'both', 'important');
    cloud.style.setProperty('animation-play-state', 'running', 'important');
    cloud.style.opacity = '0.8'; // Ensure visible
    cloud.style.visibility = 'visible'; // Force visible
    cloud.style.willChange = 'transform, opacity'; // Optimize for animation
    // Ensure background is visible
    cloud.style.background = 'rgba(255, 255, 255, 0.8)';
    cloud.style.borderRadius = '100px';
    cloud.style.width = '200px';
    cloud.style.height = '60px';
    cloud.style.boxShadow = '0 4px 15px rgba(14, 165, 233, 0.1)';
    cloud.style.zIndex = '1'; // Ensure above background
    container.appendChild(cloud);
  }
  
  // Force reflow to ensure animations start
  container.offsetHeight; // Trigger reflow
  
  // Debug: Check if elements are visible and force display if needed
  setTimeout(() => {
    const clouds = container.querySelectorAll('.cloud');
    clouds.forEach(cloud => {
      const computed = window.getComputedStyle(cloud);
      if (computed.display === 'none') {
        console.warn('Cloud still hidden, forcing display...');
        cloud.style.setProperty('display', 'block', 'important');
        cloud.style.setProperty('visibility', 'visible', 'important');
      }
    });
    
    // Check container visibility
    const containerComputed = window.getComputedStyle(container);
    const containerRect = container.getBoundingClientRect();
    console.log('Container visibility:', {
      display: containerComputed.display,
      visibility: containerComputed.visibility,
      opacity: containerComputed.opacity,
      position: containerComputed.position,
      zIndex: containerComputed.zIndex,
      width: containerComputed.width,
      height: containerComputed.height,
      rect: containerRect
    });
    
    const firstCloud = container.querySelector('.cloud');
    if (firstCloud) {
      const rect = firstCloud.getBoundingClientRect();
      const computed = window.getComputedStyle(firstCloud);
      console.log(`Cloud visibility check:`, {
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        position: computed.position,
        zIndex: computed.zIndex,
        top: computed.top,
        left: computed.left,
        width: computed.width,
        height: computed.height,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        },
        animation: computed.animation,
        animationName: computed.animationName,
        animationDuration: computed.animationDuration,
        animationDelay: computed.animationDelay,
        animationPlayState: computed.animationPlayState,
        backgroundColor: computed.backgroundColor
      });
      
      // Force animation if not running
      if (!computed.animationName || computed.animationName === 'none') {
        console.warn('⚠️ Animation not applied! Forcing animation...');
        const duration = computed.animationDuration || '30s';
        const delay = computed.animationDelay || '0s';
        firstCloud.style.animation = `cloud-drift ${duration} linear ${delay} infinite`;
      }
    }
  }, 100);
  
  console.log(`Created ${container.children.length} sky clouds`);
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