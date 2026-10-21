import { Platform } from 'react-native';

let HealthConnectModule = null;

try {
  if (Platform.OS === 'android') {
    HealthConnectModule = require('react-native-health-connect');
  }
} catch (e) {
  console.warn('Health Connect native module not loaded:', e?.message || e);
}

/**
 * Check if Google Health Connect is supported and available on this device.
 */
export async function checkHealthConnectAvailable() {
  if (Platform.OS !== 'android' || !HealthConnectModule) {
    return false;
  }
  try {
    const { getSdkStatus, SdkAvailabilityStatus } = HealthConnectModule;
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch (err) {
    console.warn('Health Connect availability check error:', err);
    return false;
  }
}

/**
 * Request read permission for Steps and Active Calories in Health Connect.
 */
export async function requestHealthConnectPermissions() {
  if (Platform.OS !== 'android' || !HealthConnectModule) {
    return false;
  }
  try {
    const { initialize, requestPermission } = HealthConnectModule;
    await initialize();

    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);

    const hasSteps = granted && granted.some((p) => p.recordType === 'Steps');
    return Boolean(hasSteps);
  } catch (err) {
    console.warn('Health Connect permission request error:', err);
    return false;
  }
}

/**
 * Check if Health Connect permissions are already granted.
 */
export async function checkHealthConnectPermissionsGranted() {
  if (Platform.OS !== 'android' || !HealthConnectModule) {
    return false;
  }
  try {
    const { initialize, getGrantedPermissions } = HealthConnectModule;
    await initialize();
    const granted = await getGrantedPermissions();
    return Boolean(granted && granted.some((p) => p.recordType === 'Steps'));
  } catch (err) {
    return false;
  }
}

/**
 * Fetch total aggregated steps & active calories for a given date from Health Connect.
 * @param {Date} date
 * @returns {Promise<{ steps: number, calories: number } | null>}
 */
export async function getHealthConnectDailyMetrics(date = new Date()) {
  if (Platform.OS !== 'android' || !HealthConnectModule) {
    return null;
  }

  try {
    const isAvail = await checkHealthConnectAvailable();
    if (!isAvail) return null;

    const { initialize, aggregateRecord, readRecords } = HealthConnectModule;
    await initialize();

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const isToday = start.toDateString() === new Date().toDateString();
    const end = isToday ? new Date() : new Date(date);
    if (!isToday) {
      end.setHours(23, 59, 59, 999);
    }

    const startTime = start.toISOString();
    const endTime = end.toISOString();

    // 1. Try aggregateRecord (fastest & officially recommended by Google)
    try {
      const stepAgg = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });

      let steps = stepAgg?.COUNT_TOTAL ?? 0;

      // Also try fetching calories burned if available
      let calories = 0;
      try {
        const calAgg = await aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter: {
            operator: 'between',
            startTime,
            endTime,
          },
        });
        calories = Math.round(calAgg?.ENERGY_TOTAL?.inKilocalories || (steps * 0.04));
      } catch (cErr) {
        calories = Math.round(steps * 0.04);
      }

      return { steps, calories };
    } catch (aggErr) {
      // 2. Fallback to readRecords
      const rawRecords = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });

      const totalSteps = (rawRecords?.records || []).reduce(
        (acc, r) => acc + (r.count || 0),
        0
      );

      return {
        steps: totalSteps,
        calories: Math.round(totalSteps * 0.04),
      };
    }
  } catch (err) {
    console.warn('Health Connect metrics fetch error:', err);
    return null;
  }
}

/**
 * Fetch hourly step distribution (24-hour array) for a given date from Health Connect.
 * @param {Date} date
 * @returns {Promise<number[] | null>}
 */
export async function getHealthConnectHourlySteps(date = new Date()) {
  if (Platform.OS !== 'android' || !HealthConnectModule) {
    return null;
  }

  try {
    const isAvail = await checkHealthConnectAvailable();
    if (!isAvail) return null;

    const { initialize, readRecords } = HealthConnectModule;
    await initialize();

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const isToday = start.toDateString() === new Date().toDateString();
    const end = isToday ? new Date() : new Date(date);
    if (!isToday) {
      end.setHours(23, 59, 59, 999);
    }

    const rawRecords = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    const hourly = Array(24).fill(0);
    if (rawRecords?.records && Array.isArray(rawRecords.records)) {
      rawRecords.records.forEach((rec) => {
        if (rec.startTime) {
          const recHour = new Date(rec.startTime).getHours();
          if (recHour >= 0 && recHour < 24) {
            hourly[recHour] += (rec.count || 0);
          }
        }
      });
    }

    return hourly;
  } catch (err) {
    console.warn('Health Connect hourly fetch error:', err);
    return null;
  }
}
