import { logSteps, getDailySteps } from './api';

// Safe backwards-compatible stubs for legacy imports
export async function checkHealthConnectAvailable() {
  return false;
}
export async function requestHealthConnectPermissions() {
  return false;
}
export async function checkHealthConnectPermissionsGranted() {
  return false;
}
export async function getHealthConnectDailyMetrics() {
  return null;
}
export async function getHealthConnectHourlySteps() {
  return null;
}
export async function getHealthConnectRangeMetrics() {
  return {};
}

/**
 * Upload step counts and burned calories to the backend.
 */
export async function syncStepsToBackend(steps, calories = null, loggedDate = null) {
  if (!steps || steps <= 0) return;
  try {
    const validCalories = typeof calories === 'number' && !isNaN(calories) && calories > 0 ? calories : null;
    if (__DEV__) {
      console.log(`[Steps -> Backend Sync] Uploading ${steps.toLocaleString()} steps (${validCalories ?? 0} kcal) for ${loggedDate || 'today'}`);
    }
    await logSteps(steps, loggedDate, validCalories);
  } catch (error) {
    if (__DEV__) {
      console.warn('Steps sync notice:', error?.message || error);
    }
  }
}

/**
 * Unified Step Fetcher:
 * Reads daily step counts and active metrics directly from the backend API.
 */
export async function getUnifiedDailySteps(date = new Date()) {
  try {
    const dateKey = typeof date === 'string' ? (date.includes('T') ? date.split('T')[0] : date) : date.toISOString().split('T')[0];
    const res = await getDailySteps(dateKey);
    if (res && typeof res.step_count === 'number') {
      return {
        steps: res.step_count,
        calories: res.calories_burned,
        source: 'backend',
      };
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('Backend step fetch notice:', err?.message || err);
    }
  }

  return null;
}
