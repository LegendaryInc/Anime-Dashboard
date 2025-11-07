// =====================================================================
// --- GOALS MODULE (goals.js) ---
// =====================================================================
// Contains functions for managing personal goals
// =====================================================================

import { handleError } from './error-handler.js';

let goals = [];

/**
 * Load all goals from the API
 */
export async function loadGoals() {
  try {
    const response = await fetch('/api/goals');
    if (!response.ok) {
      throw new Error(`Failed to load goals: ${response.statusText}`);
    }
    goals = await response.json();
    return goals;
  } catch (error) {
    handleError(error, 'loading goals', {
      showToast: false // Background loading
    });
    throw error;
  }
}

/**
 * Get all goals
 */
export function getGoals() {
  return goals;
}

/**
 * Create a new goal
 */
export async function createGoal(type, target, period, year, month = null) {
  try {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type, target, period, year, month })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 400 ? 'Invalid goal data' :
                        response.status === 401 ? 'You must be logged in to create goals' :
                        `Failed to create goal: ${response.statusText} (${response.status})`;
      throw new Error(errorData.error || statusText);
    }

    const newGoal = await response.json();
    goals.push(newGoal);
    return newGoal;
  } catch (error) {
    handleError(error, 'creating goal', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Update a goal
 */
export async function updateGoal(goalId, target) {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update goal: ${response.statusText}`);
    }

    const updatedGoal = await response.json();
    const index = goals.findIndex(g => g.id === goalId);
    if (index !== -1) {
      goals[index] = updatedGoal;
    }
    return updatedGoal;
  } catch (error) {
    handleError(error, 'updating goal', {
      showToast: true
    });
    throw error;
  }
}

/**
 * Delete a goal
 */
export async function deleteGoal(goalId) {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete goal: ${response.statusText}`);
    }

    goals = goals.filter(g => g.id !== goalId);
    return true;
  } catch (error) {
    handleError(error, 'deleting goal', {
      showToast: true
    });
    throw error;
  }
}

