import { logSteps } from './api';
import {
  checkHealthConnectAvailable,
  requestHealthConnectPermissions,
  checkHealthConnectPermissionsGranted,
  getHealthConnectDailyMetrics,
  getHealthConnectHourlySteps,
} from './healthConnect';

export {
  checkHealthConnectAvailable,
  requestHealthConnectPermissions,
  checkHealthConnectPermissionsGranted,
  getHealthConnectDailyMetrics,
  getHealthConnectHourlySteps,
};

export async function syncStepsToBackend(steps) {
  if (steps <= 0) return;
  try {
    await logSteps(steps);
  } catch (error) {
    console.warn('Failed to sync steps to backend:', error);
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
