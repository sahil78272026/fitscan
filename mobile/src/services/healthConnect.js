/**
 * Health Connect Service (Safe No-Op Stub)
 * Health Connect has been removed in favor of backend-synchronized metrics.
 * These stubs guarantee backward-compatibility without native dependencies.
 */

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

export default {
  checkHealthConnectAvailable,
  requestHealthConnectPermissions,
  checkHealthConnectPermissionsGranted,
  getHealthConnectDailyMetrics,
  getHealthConnectHourlySteps,
  getHealthConnectRangeMetrics,
};
