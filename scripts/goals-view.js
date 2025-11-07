// =====================================================================
// --- GOALS VIEW MODULE (goals-view.js) ---
// =====================================================================
// Handles rendering the goals UI
// =====================================================================

import {
  loadGoals,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal
} from './goals.js';
import { showButtonLoading } from './loading.js';
import { handleError } from './error-handler.js';
import { showToast, showConfirm } from './toast.js';
import { escapeHtml, showInputError, clearInputValidation } from './utils.js';

/**
 * Initialize the goals view
 */
export function initGoalsView() {
  const goalsTab = document.getElementById('goals-tab');
  if (!goalsTab) return;

  // Create goal button
  document.addEventListener('click', (e) => {
    if (e.target.matches('#create-goal-btn') || e.target.closest('#create-goal-btn')) {
      e.preventDefault();
      e.stopPropagation();
      showCreateGoalModal();
    }

    if (e.target.matches('[data-edit-goal]')) {
      const goalId = parseInt(e.target.dataset.editGoal);
      showEditGoalModal(goalId);
    }

    if (e.target.matches('[data-delete-goal]')) {
      const goalId = parseInt(e.target.dataset.deleteGoal);
      handleDeleteGoal(goalId);
    }
  });
}

/**
 * Render all goals
 */
export async function renderGoals() {
  const container = document.getElementById('goals-container');
  
  if (!container) {
    console.warn('Goals container not found!');
    return;
  }

  try {
    await loadGoals();
    const goals = getGoals();

    if (goals.length === 0) {
      container.innerHTML = `
        <p class="text-center theme-text-muted py-8">No goals yet. Create your first goal to get started!</p>
      `;
      return;
    }

    // Get current stats for progress calculation
    const stats = window.lastStats || {};
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Calculate completed anime count
    if (!stats.completedAnime && window.animeData) {
      stats.completedAnime = window.animeData.filter(a => 
        a.status && a.status.toLowerCase() === 'completed'
      ).length;
    }

    let html = '<div class="space-y-4">';
    
    goals.forEach(goal => {
      const progress = calculateGoalProgress(goal, stats, currentYear, currentMonth);
      const progressPercent = Math.min(100, Math.max(0, (progress.current / goal.target) * 100));
      
      html += `
        <div class="goal-card anime-card rounded-lg p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h3 class="font-bold text-lg theme-text-primary mb-1">
                ${escapeHtml(getGoalTitle(goal))}
              </h3>
              <p class="text-sm theme-text-secondary">
                ${getGoalDescription(goal)}
              </p>
            </div>
            <div class="flex gap-2">
              <button data-edit-goal="${goal.id}" 
                      class="text-sm px-2 py-1 rounded hover:bg-gray-100 theme-text-secondary" 
                      data-tooltip="Edit goal">
                ✏️
              </button>
              <button data-delete-goal="${goal.id}" 
                      class="text-sm px-2 py-1 rounded hover:bg-red-100 text-red-600" 
                      data-tooltip="Delete goal">
                🗑️
              </button>
            </div>
          </div>
          
          <div class="mb-2">
            <div class="flex justify-between text-sm mb-1">
              <span class="theme-text-secondary">Progress</span>
              <span class="font-semibold theme-text-primary">
                ${formatProgress(progress.current, goal)} / ${formatTarget(goal)}
              </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div class="h-full bg-indigo-600 rounded-full transition-all duration-300" 
                   style="width: ${progressPercent}%"></div>
            </div>
          </div>
          
          <div class="text-xs theme-text-muted">
            ${progressPercent.toFixed(1)}% complete
            ${progressPercent >= 100 ? ' ✅ Goal achieved!' : ''}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    const errorInfo = handleError(error, 'loading goals', {
      showToast: true
    });
    container.innerHTML = `
      <p class="text-center text-red-600 py-8">${errorInfo.message}</p>
    `;
  }
}

/**
 * Calculate goal progress
 */
function calculateGoalProgress(goal, stats, currentYear, currentMonth) {
  let current = 0;

  if (goal.type === 'watch_time') {
    // Calculate watch time in days
    const totalMinutes = stats.totalMinutes || 0;
    const totalDays = totalMinutes / (60 * 24);
    
    if (goal.period === 'yearly') {
      // For yearly goals, we'd need to filter by year
      // For now, use total watch time
      current = totalDays;
    } else if (goal.period === 'monthly') {
      // For monthly goals, we'd need to filter by month
      // For now, use total watch time
      current = totalDays;
    }
  } else if (goal.type === 'completion') {
    // Count completed anime
    const completedAnime = stats.completedAnime || 0;
    
    if (goal.period === 'yearly') {
      // For yearly goals, we'd need to filter by year
      // For now, use total completed
      current = completedAnime;
    } else if (goal.period === 'monthly') {
      // For monthly goals, we'd need to filter by month
      // For now, use total completed
      current = completedAnime;
    }
  }

  return { current };
}

/**
 * Get goal title
 */
function getGoalTitle(goal) {
  const typeLabel = goal.type === 'watch_time' ? 'Watch Time' : 'Completions';
  const periodLabel = goal.period === 'yearly' ? 'Yearly' : 'Monthly';
  return `${periodLabel} ${typeLabel} Goal`;
}

/**
 * Get goal description
 */
function getGoalDescription(goal) {
  const periodLabel = goal.period === 'yearly' 
    ? `${goal.year}` 
    : `${new Date(goal.year, goal.month - 1).toLocaleString('default', { month: 'long' })} ${goal.year}`;
  
  const targetLabel = formatTarget(goal);
  return `Target: ${targetLabel} for ${periodLabel}`;
}

/**
 * Format progress value
 */
function formatProgress(value, goal) {
  if (goal.type === 'watch_time') {
    return `${value.toFixed(1)} days`;
  } else {
    return `${Math.floor(value)} anime`;
  }
}

/**
 * Format target value
 */
function formatTarget(goal) {
  if (goal.type === 'watch_time') {
    return `${goal.target} days`;
  } else {
    return `${goal.target} anime`;
  }
}

/**
 * Show create goal modal
 */
function showCreateGoalModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Create New Goal</h3>
      <form id="create-goal-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Goal Type *</label>
          <select id="goal-type-input" required 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);">
            <option value="watch_time">Watch Time (days)</option>
            <option value="completion">Completions (anime count)</option>
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Period *</label>
          <select id="goal-period-input" required 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);">
            <option value="yearly">Yearly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div class="mb-4" id="goal-year-container">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Year *</label>
          <input type="number" id="goal-year-input" required min="2020" max="2100"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 value="${new Date().getFullYear()}">
        </div>
        <div class="mb-4 hidden" id="goal-month-container">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Month *</label>
          <select id="goal-month-input" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);">
            ${Array.from({ length: 12 }, (_, i) => {
              const month = i + 1;
              const monthName = new Date(2000, i).toLocaleString('default', { month: 'long' });
              return `<option value="${month}" ${month === new Date().getMonth() + 1 ? 'selected' : ''}>${monthName}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Target *</label>
          <input type="number" id="goal-target-input" required min="0.1" step="0.1"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 placeholder="Enter target value">
          <p class="text-xs mt-1" style="color: var(--theme-text-muted, #9ca3af);" id="goal-target-hint">
            Enter target in days for watch time, or count for completions
          </p>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-create-goal" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Create Goal
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Show/hide month selector based on period
  const periodSelect = modal.querySelector('#goal-period-input');
  const monthContainer = modal.querySelector('#goal-month-container');
  
  periodSelect.addEventListener('change', (e) => {
    if (e.target.value === 'monthly') {
      monthContainer.classList.remove('hidden');
      modal.querySelector('#goal-month-input').required = true;
    } else {
      monthContainer.classList.add('hidden');
      modal.querySelector('#goal-month-input').required = false;
    }
  });

  // Update hint based on type
  const typeSelect = modal.querySelector('#goal-type-input');
  const targetHint = modal.querySelector('#goal-target-hint');
  
  typeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'watch_time') {
      targetHint.textContent = 'Enter target in days (e.g., 30 for 30 days)';
    } else {
      targetHint.textContent = 'Enter target count (e.g., 20 for 20 anime)';
    }
  });

  const form = modal.querySelector('#create-goal-form');
  const targetInput = modal.querySelector('#goal-target-input');
  const yearInput = modal.querySelector('#goal-year-input');
  
  // Add real-time validation
  targetInput.addEventListener('blur', () => {
    const target = parseFloat(targetInput.value);
    if (!targetInput.value || isNaN(target) || target <= 0) {
      showInputError(targetInput, 'Target must be a positive number');
    } else {
      clearInputValidation(targetInput);
    }
  });
  
  targetInput.addEventListener('input', () => {
    clearInputValidation(targetInput);
  });
  
  yearInput.addEventListener('blur', () => {
    const year = parseInt(yearInput.value);
    if (!yearInput.value || isNaN(year) || year < 2020 || year > 2100) {
      showInputError(yearInput, 'Year must be between 2020 and 2100');
    } else {
      clearInputValidation(yearInput);
    }
  });
  
  yearInput.addEventListener('input', () => {
    clearInputValidation(yearInput);
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = modal.querySelector('#goal-type-input').value;
    const target = parseFloat(targetInput.value);
    const period = modal.querySelector('#goal-period-input').value;
    const year = parseInt(yearInput.value);
    const month = period === 'monthly' ? parseInt(modal.querySelector('#goal-month-input').value) : null;

    // Validate form
    let isValid = true;
    if (!targetInput.value || isNaN(target) || target <= 0) {
      showInputError(targetInput, 'Target must be a positive number');
      isValid = false;
    }
    if (!yearInput.value || isNaN(year) || year < 2020 || year > 2100) {
      showInputError(yearInput, 'Year must be between 2020 and 2100');
      isValid = false;
    }
    
    if (!isValid) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const restoreButton = showButtonLoading(submitButton, 'Creating...');

    try {
      await createGoal(type, target, period, year, month);
      document.body.removeChild(modal);
      await renderGoals();
      showToast('Goal created successfully!', 'success');
    } catch (error) {
      handleError(error, 'creating goal', {
        showToast: true
      });
    } finally {
      restoreButton();
    }
  });

  // Cancel button
  modal.querySelector('#cancel-create-goal').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Show edit goal modal
 */
function showEditGoalModal(goalId) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) {
    showToast('Goal not found', 'error');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="anime-card rounded-lg p-6 max-w-md w-full mx-4" style="background: var(--theme-bg, #ffffff);">
      <h3 class="text-xl font-bold mb-4" style="color: var(--theme-text-primary, #111827);">Edit Goal</h3>
      <form id="edit-goal-form">
        <div class="mb-4">
          <label class="block text-sm font-semibold mb-2" style="color: var(--theme-text-primary, #111827);">Target *</label>
          <input type="number" id="edit-goal-target-input" required min="0.1" step="0.1"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                 style="background: var(--theme-bg, #ffffff); color: var(--theme-text-primary, #111827);"
                 value="${goal.target}">
          <p class="text-xs mt-1" style="color: var(--theme-text-muted, #9ca3af);">
            ${goal.type === 'watch_time' ? 'Target in days' : 'Target count'}
          </p>
        </div>
        <div class="flex gap-3 justify-end">
          <button type="button" id="cancel-edit-goal" class="btn-secondary py-2 px-4 rounded-lg">
            Cancel
          </button>
          <button type="submit" class="btn-primary py-2 px-4 rounded-lg font-semibold">
            Update Goal
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector('#edit-goal-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = parseFloat(modal.querySelector('#edit-goal-target-input').value);

    const submitButton = form.querySelector('button[type="submit"]');
    const restoreButton = showButtonLoading(submitButton, 'Updating...');

    try {
      await updateGoal(goalId, target);
      document.body.removeChild(modal);
      await renderGoals();
      showToast('Goal updated successfully!', 'success');
    } catch (error) {
      handleError(error, 'updating goal', {
        showToast: true
      });
    } finally {
      restoreButton();
    }
  });

  // Cancel button
  modal.querySelector('#cancel-edit-goal').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

/**
 * Handle deleting a goal
 */
async function handleDeleteGoal(goalId) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  const confirmed = await showConfirm(
    `Are you sure you want to delete this goal?\n\n${getGoalTitle(goal)}\n\nThis action cannot be undone.`
  );
  if (!confirmed) return;

  try {
    await deleteGoal(goalId);
    await renderGoals();
    showToast('Goal deleted successfully', 'success');
  } catch (error) {
    handleError(error, 'deleting goal', {
      showToast: true
    });
  }
}

// escapeHtml is now imported from utils.js

