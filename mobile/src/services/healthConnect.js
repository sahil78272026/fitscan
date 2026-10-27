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
 * Calculate Total Calories Burned matching Google Health Connect (Option 2):
 * Total Burn = Elapsed Basal Metabolic Rate (BMR) + Active Burn (Steps / Activity)
 */
export function calculateTotalCaloriesBurned(steps = 0, targetDate = new Date(), activeCals = 0) {
  const now = new Date();
  const d = new Date(targetDate);
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let elapsedHours = 24;
  if (isToday) {
    elapsedHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  } else if (!isPast) {
    // Future date
    elapsedHours = 0;
  }

  // Google Health Connect standard baseline BMR: ~1680 kcal/day (~70 kcal/hour)
  const restingBurn = Math.round(1680 * (elapsedHours / 24));
  const walkingBurn = activeCals > 0 ? Math.round(activeCals) : Math.round((steps || 0) * 0.04);

  return {
    totalCalories: restingBurn + walkingBurn,
    restingCalories: restingBurn,
    activeCalories: walkingBurn,
  };
}

/**
 * Fetch total aggregated steps & calories for a given date from Health Connect.
 * Uses local calendar day boundaries (00:00:00 to 23:59:59.999) converted to UTC.
 * @param {Date} date
 * @returns {Promise<{ steps: number, calories: number, activeCalories: number, restingCalories: number } | null>}
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

    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    // Local Day Boundaries (00:00:00 to 23:59:59 in device timezone)
    const start = new Date(year, month, day, 0, 0, 0, 0);
    const end = new Date(year, month, day, 23, 59, 59, 999);

    // Converted to UTC ISO strings for Health Connect API
    const startTime = start.toISOString();
    const endTime = end.toISOString();
    const localDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

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

      // 1. Check for native ActiveCaloriesBurned from Health Connect
      let activeCals = 0;
      try {
        const calAgg = await aggregateRecord({
          recordType: 'ActiveCaloriesBurned',
          timeRangeFilter: {
            operator: 'between',
            startTime,
            endTime,
          },
        });
        activeCals = Math.round(calAgg?.ENERGY_TOTAL?.inKilocalories || 0);
      } catch (cErr) {
        activeCals = 0;
      }

      // 2. Check for native TotalCaloriesBurned from Health Connect (if available/granted)
      let hcTotalCals = 0;
      try {
        const totalAgg = await aggregateRecord({
          recordType: 'TotalCaloriesBurned',
          timeRangeFilter: {
            operator: 'between',
            startTime,
            endTime,
          },
        });
        hcTotalCals = Math.round(totalAgg?.ENERGY_TOTAL?.inKilocalories || 0);
      } catch (tErr) {
        hcTotalCals = 0;
      }

      // 3. Option 2: Total Calories Burned matching Google Health Connect (Elapsed BMR + Active Burn)
      const computed = calculateTotalCaloriesBurned(steps, d, activeCals);
      const calories = hcTotalCals > 0 ? hcTotalCals : computed.totalCalories;

      if (__DEV__) {
        // Fetch raw sample records to inspect data origins & individual chunks
        let rawStepList = [];
        let rawCalList = [];
        try {
          const rawS = await readRecords('Steps', { timeRangeFilter: { operator: 'between', startTime, endTime } });
          rawStepList = rawS?.records || [];
        } catch {}
        try {
          const rawC = await readRecords('ActiveCaloriesBurned', { timeRangeFilter: { operator: 'between', startTime, endTime } });
          rawCalList = rawC?.records || [];
        } catch {}

        if (console.groupCollapsed) {
          console.groupCollapsed(`🏃 [HealthConnect] Daily Metrics for ${localDateStr}: ${steps.toLocaleString()} steps | ${calories} kcal (Total Burn)`);
          console.log('⏰ Time Window (Local vs UTC):', {
            targetDate: localDateStr,
            localDeviceTime: `${start.toLocaleTimeString()} -> ${end.toLocaleTimeString()}`,
            utcRangePassedToAPI: { startTime, endTime },
          });
          console.log('📊 Aggregation Total Steps:', steps);
          console.log(`👟 Raw Step Entries (${rawStepList.length} records):`, rawStepList.map((r) => ({
            count: r.count,
            sourceApp: r.metadata?.dataOrigin || 'system',
            start: r.startTime,
            end: r.endTime,
          })));
          console.log('⚡ Total Daily Burn (Option 2 - Health Connect):', calories, 'kcal');
          console.log('🫀 Resting BMR Burn (Elapsed):', computed.restingCalories, 'kcal');
          console.log('🔥 Active Walking Burn:', computed.activeCalories, 'kcal');
          console.groupEnd();
        } else {
          console.log(`🏃 [HealthConnect] Daily Metrics for ${localDateStr}: ${steps} steps, ${calories} kcal (Total Burn)`);
        }
      }

      return {
        steps,
        calories,
        activeCalories: computed.activeCalories,
        restingCalories: computed.restingCalories,
      };
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

      let totalCals = 0;
      try {
        const rawCals = await readRecords('ActiveCaloriesBurned', {
          timeRangeFilter: {
            operator: 'between',
            startTime,
            endTime,
          },
        });
        totalCals = (rawCals?.records || []).reduce(
          (acc, r) => acc + (r.energy?.inKilocalories || 0),
          0
        );
      } catch (cErr) {}

      const computed = calculateTotalCaloriesBurned(totalSteps, d, totalCals);
      const calories = computed.totalCalories;

      if (__DEV__) {
        const dateFormatted = start.toISOString().split('T')[0];
        if (console.groupCollapsed) {
          console.groupCollapsed(`🏃 [HealthConnect Raw] ${rawRecords?.records?.length || 0} entries for ${dateFormatted}: ${totalSteps.toLocaleString()} steps | ${calories} kcal`);
          console.log('⏰ Time Window:', { startTime, endTime });
          console.log('📦 Sample Records:', (rawRecords?.records || []).slice(0, 5));
          console.log('📊 Computed Totals:', { totalSteps, calories, ...computed });
          console.groupEnd();
        } else {
          console.log(`🏃 [HealthConnect Raw] ${dateFormatted}: ${totalSteps} steps | ${calories} kcal`);
        }
      }

      return {
        steps: totalSteps,
        calories,
        activeCalories: computed.activeCalories,
        restingCalories: computed.restingCalories,
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

    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    const start = new Date(year, month, day, 0, 0, 0, 0);
    const end = new Date(year, month, day, 23, 59, 59, 999);
    const localDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

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

    if (__DEV__) {
      const activeHours = hourly.filter((h) => h > 0).length;
      const totalHourlySteps = hourly.reduce((sum, h) => sum + h, 0);
      if (console.groupCollapsed) {
        console.groupCollapsed(`⏱️ [HealthConnect Hourly] ${localDateStr}: ${totalHourlySteps.toLocaleString()} steps across ${activeHours} active hours`);
        console.log('⏰ Time Window:', { localDateStr, localStart: start.toString(), localEnd: end.toString() });
        console.log('📈 24-Hour Distribution (0-23h):', hourly);
        console.log('📦 Raw Record Count:', rawRecords?.records?.length || 0);
        console.groupEnd();
      } else {
        console.log(`⏱️ [HealthConnect Hourly] ${localDateStr}: ${totalHourlySteps} steps`);
      }
    }

    return hourly;
  } catch (err) {
    console.warn('Health Connect hourly fetch error:', err);
    return null;
  }
}

/**
 * Fetch steps and calories for a date range in ONE single Health Connect call.
 * Avoids firing 30+ sequential daily calls across the native bridge.
 * @param {Date} startDate - Start boundary (e.g. 1st of month 00:00:00)
 * @param {Date} endDate - End boundary (e.g. 31st of month 23:59:59)
 * @returns {Promise<Record<string, { steps: number, calories: number }>>}
 */
export async function getHealthConnectRangeMetrics(startDate, endDate) {
  if (Platform.OS !== 'android' || !HealthConnectModule) {
    return {};
  }

  try {
    const isAvail = await checkHealthConnectAvailable();
    if (!isAvail) return {};

    const { initialize, readRecords } = HealthConnectModule;
    await initialize();

    const start = new Date(startDate);
    const end = new Date(endDate);
    const startTime = start.toISOString();
    const endTime = end.toISOString();

    // 1. Fetch ALL step records across the entire range in ONE single call
    const rawSteps = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime,
        endTime,
      },
    });

    // 2. Fetch ALL active calorie records across the range in ONE single call
    let rawCals = { records: [] };
    try {
      rawCals = await readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: {
          operator: 'between',
          startTime,
          endTime,
        },
      });
    } catch {}

    // Group steps & calories by local calendar date (YYYY-MM-DD)
    const stepsByDate = {};
    for (const record of rawSteps?.records || []) {
      if (!record.startTime) continue;
      const recDate = new Date(record.startTime);
      const dayY = recDate.getFullYear();
      const dayM = String(recDate.getMonth() + 1).padStart(2, '0');
      const dayD = String(recDate.getDate()).padStart(2, '0');
      const dateKey = `${dayY}-${dayM}-${dayD}`;
      stepsByDate[dateKey] = (stepsByDate[dateKey] || 0) + (record.count || 0);
    }

    const activeCalsByDate = {};
    for (const record of rawCals?.records || []) {
      if (!record.startTime) continue;
      const recDate = new Date(record.startTime);
      const dayY = recDate.getFullYear();
      const dayM = String(recDate.getMonth() + 1).padStart(2, '0');
      const dayD = String(recDate.getDate()).padStart(2, '0');
      const dateKey = `${dayY}-${dayM}-${dayD}`;
      activeCalsByDate[dateKey] = (activeCalsByDate[dateKey] || 0) + (record.energy?.inKilocalories || 0);
    }

    // Populate every date in range with computed total calories
    const result = {};
    const curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (curr <= lastDay) {
      const dayY = curr.getFullYear();
      const dayM = String(curr.getMonth() + 1).padStart(2, '0');
      const dayD = String(curr.getDate()).padStart(2, '0');
      const dateKey = `${dayY}-${dayM}-${dayD}`;

      const daySteps = stepsByDate[dateKey] || 0;
      const dayActive = activeCalsByDate[dateKey] || 0;
      const computed = calculateTotalCaloriesBurned(daySteps, curr, dayActive);

      result[dateKey] = {
        steps: daySteps,
        calories: computed.totalCalories,
      };

      curr.setDate(curr.getDate() + 1);
    }

    if (__DEV__) {
      const totalSteps = Object.values(result).reduce((sum, d) => sum + d.steps, 0);
      const totalCals = Object.values(result).reduce((sum, d) => sum + d.calories, 0);
      console.log(`⚡ [HealthConnect] 1-Shot Batch Range Fetch: ${Object.keys(result).length} days (${totalSteps.toLocaleString()} steps, ${totalCals.toLocaleString()} kcal)`);
    }

    return result;
  } catch (err) {
    console.warn('Health Connect batch range fetch error:', err);
    return {};
  }
}
