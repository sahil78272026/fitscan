import { logSteps } from './api';
import {
  checkHealthConnectAvailable,
  requestHealthConnectPermissions,
  checkHealthConnectPermissionsGranted,
  getHealthConnectDailyMetrics,
  getHealthConnectHourlySteps,
  getHealthConnectRangeMetrics,
} from './healthConnect';

export {
  checkHealthConnectAvailable,
  requestHealthConnectPermissions,
  checkHealthConnectPermissionsGranted,
  getHealthConnectDailyMetrics,
  getHealthConnectHourlySteps,
  getHealthConnectRangeMetrics,
};

export async function syncStepsToBackend(steps, calories = null, loggedDate = null) {
  if (!steps || steps <= 0) return;
  try {
    const validCalories = typeof calories === 'number' && !isNaN(calories) && calories > 0 ? calories : null;
    if (__DEV__) {
      console.log(`☁️ [HealthConnect -> Backend Sync] Uploading ${steps.toLocaleString()} steps (${validCalories ?? 0} kcal) for ${loggedDate || 'today'}`);
    }
    await logSteps(steps, loggedDate, validCalories);
  } catch (error) {
    // Gracefully handle backend errors / auth state without breaking the UI
    console.warn('Steps sync notice:', error?.message || error);
  }
}

/**
 * Health Connect Step Fetcher:
 * Reads daily step counts and active metrics from Google Health Connect
 */
export async function getUnifiedDailySteps(date = new Date()) {
  try {
    const hcGranted = await checkHealthConnectPermissionsGranted();
    if (hcGranted) {
      const hcData = await getHealthConnectDailyMetrics(date);
      if (hcData && typeof hcData.steps === 'number') {
        return {
          steps: hcData.steps,
          calories: hcData.calories,
          source: 'health_connect',
        };
      }
    }
  } catch (err) {
    console.warn('Health Connect step fetch failed:', err);
  }

  return null;
}
