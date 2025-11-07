// =====================================================================
// --- TOOLTIP MODULE (tooltips.js) ---
// =====================================================================
// Provides a reusable tooltip system for buttons and features
// =====================================================================

/**
 * Initialize tooltip system
 */
export function initTooltips() {
  // Use event delegation for elements with data-tooltip attribute
  // Use capture phase to ensure we don't interfere with click events
  document.addEventListener('mouseenter', handleTooltipShow, true);
  document.addEventListener('mouseleave', handleTooltipHide, true);
  document.addEventListener('focus', handleTooltipShow, true);
  document.addEventListener('blur', handleTooltipHide, true);
  
  // Ensure tooltips don't interfere with click events
  // Hide tooltips on click, but don't prevent the click from reaching the button
  document.addEventListener('click', (e) => {
    // Don't interfere with clicks - just hide tooltips
    // The click will still propagate to the button
    // Skip if clicking on a button with data-tooltip (let the button handle it)
    if (e.target.closest && e.target.closest('button[data-tooltip]')) {
      // Let the button handle the click first
      return;
    }
    const allTooltipElements = document.querySelectorAll('[data-tooltip]');
    for (const el of allTooltipElements) {
      if (el._tooltipElement) {
        hideTooltip(el);
      }
    }
  }, false); // Use bubble phase, not capture, so button click handlers run first
}

/**
 * Show tooltip on hover/focus
 */
function handleTooltipShow(e) {
  // Ensure e.target is an Element (not a text node)
  const target = e.target instanceof Element ? e.target : e.target?.parentElement;
  if (!target) return;
  
  const element = target.closest ? target.closest('[data-tooltip]') : null;
  if (!element) return;
  
  const tooltipText = element.getAttribute('data-tooltip');
  if (!tooltipText) return;
  
  // Don't show if already has a tooltip
  if (element._tooltipElement) return;
  
  // Get position from data attribute or default to 'top'
  const position = element.getAttribute('data-tooltip-position') || 'top';
  
  showTooltip(element, tooltipText, position);
}

/**
 * Hide tooltip on mouse leave/blur
 */
function handleTooltipHide(e) {
  // Ensure e.target is an Element (not a text node)
  const target = e.target instanceof Element ? e.target : e.target?.parentElement;
  if (!target) {
    // Hide all tooltips if target is invalid
    const allTooltipElements = document.querySelectorAll('[data-tooltip]');
    for (const el of allTooltipElements) {
      if (el._tooltipElement) {
        hideTooltip(el);
      }
    }
    return;
  }
  
  // Check if we're leaving an element with a tooltip
  const element = target.closest ? target.closest('[data-tooltip]') : null;
  if (!element) {
    // Mouse left the document or moved to something without a tooltip
    // Hide all tooltips
    const allTooltipElements = document.querySelectorAll('[data-tooltip]');
    for (const el of allTooltipElements) {
      if (el._tooltipElement) {
        hideTooltip(el);
      }
    }
    return;
  }
  
  // Check if mouse is moving to a child element (don't hide in that case)
  const relatedTarget = e.relatedTarget instanceof Element ? e.relatedTarget : e.relatedTarget?.parentElement;
  if (relatedTarget && element.contains(relatedTarget)) {
    return;
  }
  
  // Mouse is leaving the element, hide its tooltip
  hideTooltip(element);
}

/**
 * Show a tooltip for an element
 * @param {HTMLElement} element - The element to show tooltip for
 * @param {string} text - The tooltip text
 * @param {string} position - Tooltip position: 'top', 'bottom', 'left', 'right' (default: 'top')
 */
export function showTooltip(element, text, position = 'top') {
  if (!element || !text) return;
  
  // Remove existing tooltip if any
  hideTooltip(element);
  
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip-element';
  tooltip.setAttribute('data-position', position);
  tooltip.setAttribute('data-tooltip-for', element.id || `tooltip-${Date.now()}`);
  tooltip.textContent = text;
  
  // Store reference to tooltip on element so we can find it later
  element._tooltipElement = tooltip;
  
  // Don't modify element positioning - use fixed positioning for tooltip instead
  // This prevents issues with buttons that have transforms or absolute positioning
  
  // Append to body instead of element to avoid transform inheritance
  document.body.appendChild(tooltip);
  
  // Force tooltip to be visible for measurement (but keep it hidden visually)
  tooltip.style.visibility = 'hidden';
  tooltip.style.display = 'block';
  
  // Position tooltip using fixed positioning relative to viewport
  positionTooltipFixed(element, tooltip, position);
  
  // Make tooltip visible and show with animation
  tooltip.style.visibility = 'visible';
  requestAnimationFrame(() => {
    tooltip.classList.add('tooltip-show');
  });
}

/**
 * Hide tooltip for an element
 */
export function hideTooltip(element) {
  if (!element) return;
  
  // Get tooltip from stored reference (since it's now in body, not element)
  const tooltip = element._tooltipElement;
  if (!tooltip) return;
  
  // Clear the reference
  element._tooltipElement = null;
  
  tooltip.classList.remove('tooltip-show');
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.remove();
    }
  }, 200);
}

/**
 * Position tooltip using fixed positioning (relative to viewport)
 * This prevents issues with parent transforms
 */
function positionTooltipFixed(element, tooltip, position) {
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Use fixed positioning
  tooltip.style.position = 'fixed';
  
  let top = 0;
  let left = 0;
  
  switch (position) {
    case 'top':
      top = rect.top - tooltipRect.height - 8;
      left = rect.left + (rect.width - tooltipRect.width) / 2;
      break;
    case 'bottom':
      top = rect.bottom + 8;
      left = rect.left + (rect.width - tooltipRect.width) / 2;
      break;
    case 'left':
      top = rect.top + (rect.height - tooltipRect.height) / 2;
      left = rect.left - tooltipRect.width - 8;
      break;
    case 'right':
      top = rect.top + (rect.height - tooltipRect.height) / 2;
      left = rect.right + 8;
      break;
  }
  
  // Adjust if tooltip would go off-screen
  if (left < 8) {
    left = 8;
  } else if (left + tooltipRect.width > viewportWidth - 8) {
    left = viewportWidth - tooltipRect.width - 8;
  }
  
  if (top < 8) {
    // If top doesn't fit, try bottom
    if (position === 'top') {
      top = rect.bottom + 8;
      tooltip.setAttribute('data-position', 'bottom');
    } else {
      top = 8;
    }
  } else if (top + tooltipRect.height > viewportHeight - 8) {
    // If bottom doesn't fit, try top
    if (position === 'bottom') {
      top = rect.top - tooltipRect.height - 8;
      tooltip.setAttribute('data-position', 'top');
    } else {
      top = viewportHeight - tooltipRect.height - 8;
    }
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

/**
 * Add tooltip to an element programmatically
 * @param {HTMLElement|string} elementOrSelector - Element or selector
 * @param {string} text - Tooltip text
 * @param {string} position - Tooltip position
 */
export function addTooltip(elementOrSelector, text, position = 'top') {
  const element = typeof elementOrSelector === 'string' 
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
  
  if (!element) return;
  
  element.setAttribute('data-tooltip', text);
  if (position !== 'top') {
    element.setAttribute('data-tooltip-position', position);
  }
}

