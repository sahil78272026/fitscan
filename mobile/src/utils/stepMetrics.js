/**
 * Step Metrics & Period Aggregations Utility
 *
 * Provides pure, deterministic calculation, distribution, and formatting
 * functions for daily, weekly, and monthly step tracking and active calories in FitScan.
 */

export const DAILY_STEP_GOAL = 10000;
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format a Date object to YYYY-MM-DD local string
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateKey(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.includes('T') ? date.split('T')[0] : date;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats step counts for bar chart columns, summaries, and compact labels.
 * Prevents awkward '0.0k' or '0.5k' for small numbers.
 * @param {number} steps
 * @returns {string}
 */
export function formatStepLabel(steps) {
  const n = Math.max(0, Math.round(Number(steps) || 0));
  if (n === 0) return '0';
  if (n < 1000) return `${n}`;
  const k = (n / 1000).toFixed(1);
  return k.endsWith('.0') ? `${k.slice(0, -2)}k` : `${k}k`;
}

/**
 * Calculate estimated distance in kilometers based on standard step length (~0.762m/step).
 * @param {number} steps
 * @param {number} decimals
 * @returns {string}
 */
export function calculateDistanceKm(steps, decimals = 2) {
  const n = Math.max(0, Number(steps) || 0);
  return ((n * 0.762) / 1000).toFixed(decimals);
}

/**
 * Calculate active movement minutes (~78 steps/minute brisk walking).
 * @param {number} steps
 * @returns {number}
 */
export function calculateMoveMinutes(steps) {
  const n = Math.max(0, Number(steps) || 0);
  return Math.round(n / 78);
}

/**
 * Calculate burned calories with Option 2 Health Connect standard fallback (Elapsed BMR + Active Burn).
 * @param {number} steps
 * @param {string|Date} dateStr
 * @param {object} [stepData]
 * @param {Record<string, number>} [stepCaloriesHistory]
 * @returns {number}
 */
export function resolveBurnedCalories(steps, dateStr, stepData = null, stepCaloriesHistory = {}) {
  const dateKey = typeof dateStr === 'string' ? dateStr : formatDateKey(dateStr);

  // 1. If stepData belongs to this date and has non-zero burned calories
  if (stepData && (!stepData.date || stepData.date === dateKey)) {
    const cb = Number(stepData.calories_burned);
    if (!isNaN(cb) && cb > 0) return Math.round(cb);
  }

  // 2. Authoritative date-keyed history
  if (stepCaloriesHistory && stepCaloriesHistory[dateKey] !== undefined && stepCaloriesHistory[dateKey] !== null) {
    const histCals = Number(stepCaloriesHistory[dateKey]);
    if (!isNaN(histCals) && histCals > 0) return Math.round(histCals);
  }

  // 3. Fallback: Elapsed BMR + Active Walking Burn
  const now = new Date();
  const d = dateStr instanceof Date ? dateStr : new Date(dateKey + 'T00:00:00');
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let elapsedHours = 24;
  if (isToday) {
    elapsedHours = now.getHours() + now.getMinutes() / 60;
  } else if (!isPast) {
    elapsedHours = 0; // Future date
  }

  const restingBurn = Math.round(1680 * (elapsedHours / 24));
  const activeBurn = Math.round((Number(steps) || 0) * 0.04);
  return restingBurn + activeBurn;
}

/**
 * Resolves authoritative total step count for a given date across available sources.
 * Prevents stale stepData for other dates from leaking into dateStr.
 *
 * Priority:
 * 1. Active stepData (only if date matches or date is untagged and dateStr is today)
 * 2. Sum of real hourly steps (if available and positive)
 * 3. Authoritative date-keyed history (from Health Connect range or backend history)
 * 4. Authoritative calendar entry
 * 5. 0 fallback
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {object} [stepData] - { step_count, calories_burned, date? }
 * @param {number[]|object[]} [hourlySteps] - hourly array
 * @param {Record<string, number>} [stepHistory] - date-keyed step counts
 * @param {object} [calendarDay] - calendar entry { step_count? }
 * @returns {number}
 */
export function resolveTotalSteps(dateStr, stepData = null, hourlySteps = null, stepHistory = {}, calendarDay = null) {
  const todayStr = formatDateKey(new Date());

  // 1. Direct stepData if it matches dateStr, or if untagged and querying today
  if (stepData) {
    const rawCount = Number(stepData.step_count);
    if (!isNaN(rawCount) && rawCount > 0) {
      if (stepData.date) {
        if (stepData.date === dateStr) return Math.round(rawCount);
      } else if (dateStr === todayStr) {
        return Math.round(rawCount);
      }
    }
  }

  // 2. Authoritative date-keyed history
  if (stepHistory && stepHistory[dateStr] !== undefined && stepHistory[dateStr] !== null) {
    const histCount = Number(stepHistory[dateStr]);
    if (!isNaN(histCount) && histCount > 0) {
      return Math.round(histCount);
    }
  }

  // 3. Sum of hourly steps if available and belongs to dateStr
  if (hourlySteps) {
    const hourlyArr = Array.isArray(hourlySteps) ? hourlySteps : hourlySteps?.data;
    const hourlyDate = hourlySteps?.date;
    const isHourlyValidForDate = hourlyDate ? hourlyDate === dateStr : dateStr === todayStr;
    if (isHourlyValidForDate && Array.isArray(hourlyArr) && hourlyArr.length > 0) {
      let hourlySum = 0;
      for (const h of hourlyArr) {
        const val = typeof h === 'number' ? h : (h?.steps || 0);
        const parsed = Number(val);
        if (!isNaN(parsed) && parsed > 0) {
          hourlySum += Math.round(parsed);
        }
      }
      if (hourlySum > 0) return hourlySum;
    }
  }

  // 4. Authoritative calendar entry
  if (calendarDay) {
    const calCount = Number(calendarDay.step_count);
    if (!isNaN(calCount) && calCount > 0) {
      return Math.round(calCount);
    }
  }

  return 0;
}

/**
 * Builds 24-hour distribution for Day View.
 * Handles both number[] and object[] formats for realHourlySteps.
 *
 * @param {number[]|object[]|{ date?: string, data?: number[]|object[] }} realHourlySteps
 * @param {object[]} [meals] - logged meals for calories
 * @param {string} [targetDateStr] - active date to prevent stale hourly rendering
 * @returns {{ hour: number, steps: number, cals: number }[]}
 */
export function buildHourlyDistribution(realHourlySteps, meals = [], targetDateStr = null) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, steps: 0, cals: 0 }));

  if (realHourlySteps) {
    const hourlyArr = Array.isArray(realHourlySteps) ? realHourlySteps : realHourlySteps?.data;
    const hourlyDate = realHourlySteps?.date;
    const todayStr = formatDateKey(new Date());
    const isHourlyValid = hourlyDate
      ? (targetDateStr ? hourlyDate === targetDateStr : true)
      : (targetDateStr ? targetDateStr === todayStr : true);

    if (isHourlyValid && Array.isArray(hourlyArr)) {
      hourlyArr.forEach((item, idx) => {
        if (typeof item === 'number') {
          if (idx >= 0 && idx < 24) hours[idx].steps = Math.max(0, Math.round(Number(item) || 0));
        } else if (item && typeof item === 'object') {
          const h = typeof item.hour === 'number' ? item.hour : idx;
          if (h >= 0 && h < 24) hours[h].steps = Math.max(0, Math.round(Number(item.steps) || 0));
        }
      });
    }
  }

  if (meals && Array.isArray(meals) && meals.length > 0) {
    meals.forEach((m) => {
      let h = null;
      const dateVal = m.logged_at || m.created_at;
      if (dateVal) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) h = d.getHours();
      }
      if (h === null || isNaN(h)) {
        if (m.meal_type === 'breakfast') h = 8;
        else if (m.meal_type === 'lunch') h = 13;
        else if (m.meal_type === 'snack') h = 16;
        else if (m.meal_type === 'dinner') h = 20;
        else h = 12;
      }
      if (h >= 0 && h < 24) {
        hours[h].cals += Math.max(0, Math.round(Number(m.total_calories) || 0));
      }
    });
  }

  return hours;
}

/**
 * Builds 7-day distribution for Week View (Monday - Sunday).
 *
 * @param {object} params
 * @returns {object[]}
 */
export function buildWeeklyDistribution({
  currentDate = new Date(),
  activeDateStr = '',
  activeTotalSteps = 0,
  activeBurnedCalories = 0,
  activeEatenCals = 0,
  calendarData = null,
  stepHistory = {},
  stepCaloriesHistory = {},
  metric = 'steps',
  goalCals = 2000,
  stepGoal = DAILY_STEP_GOAL,
}) {
  const days = [];
  const ref = new Date(currentDate);
  ref.setHours(12, 0, 0, 0);
  const day = ref.getDay();
  const diffToMon = (day + 6) % 7;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - diffToMon);

  const dayMap = {};
  if (calendarData?.days) {
    calendarData.days.forEach((d) => { dayMap[d.date] = d; });
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dStr = formatDateKey(d);
    const isCurrentDay = dStr === activeDateStr;
    const calDay = dayMap[dStr];

    const rawHistSteps = stepHistory[dStr] ?? calDay?.step_count ?? 0;
    const historySteps = Math.max(0, Math.round(Number(rawHistSteps) || 0));
    const dailySteps = isCurrentDay
      ? (activeTotalSteps > 0 ? Math.round(Number(activeTotalSteps)) : historySteps)
      : historySteps;

    const rawHistBurned = stepCaloriesHistory[dStr] ?? Math.round(dailySteps * 0.04);
    const historyBurned = Math.max(0, Math.round(Number(rawHistBurned) || 0));
    const dailyBurned = isCurrentDay
      ? (activeBurnedCalories > 0 ? Math.max(0, Math.round(Number(activeBurnedCalories) || 0)) : historyBurned)
      : historyBurned;

    const rawDailyCals = isCurrentDay ? activeEatenCals : (calDay?.total_calories || 0);
    const dailyCalsEaten = Math.max(0, Math.round(Number(rawDailyCals) || 0));
    const rawDayGoal = calDay?.calorie_goal || goalCals;
    const dayGoal = Math.max(0, Math.round(Number(rawDayGoal) || 0));

    days.push({
      date: d,
      dateStr: dStr,
      dayName: DAY_LABELS[d.getDay()],
      dayNum: d.getDate(),
      steps: dailySteps,
      burned: dailyBurned,
      cals: dailyCalsEaten,
      goal: dayGoal,
      achieved: metric === 'steps' ? dailySteps >= stepGoal : (dailyCalsEaten > 0 && dailyCalsEaten <= dayGoal),
    });
  }

  return days;
}

/**
 * Aggregates weekly metrics and stats banner values.
 *
 * @param {object[]} weeklyData
 * @param {number} [goalCals]
 * @returns {object}
 */
export function calculateWeekAggregates(weeklyData = [], goalCals = 2000) {
  const weekTotalEaten = weeklyData.reduce((sum, d) => sum + (Math.round(Number(d.cals)) || 0), 0);
  const weekTotalGoal = weeklyData.reduce((sum, d) => sum + (Math.round(Number(d.goal)) || Math.round(Number(goalCals)) || 2000), 0);
  const weekAvgEaten = Math.round(weekTotalEaten / 7);

  const weekTotalSteps = weeklyData.reduce((sum, d) => sum + (Math.round(Number(d.steps)) || 0), 0);
  const weekAvgSteps = Math.round(weekTotalSteps / 7);
  const weekKm = calculateDistanceKm(weekTotalSteps, 1);
  const weekBurnedCals = weeklyData.reduce((sum, d) => sum + (Math.round(Number(d.burned)) || 0), 0);
  const weekMoveMinutes = calculateMoveMinutes(weekTotalSteps);

  return {
    eaten: weekTotalEaten,
    goal: weekTotalGoal,
    remaining: Math.max(0, weekTotalGoal - weekTotalEaten),
    steps: weekTotalSteps,
    avgSteps: weekAvgSteps,
    label1: 'Week Total',
    val1: weekTotalEaten.toLocaleString(),
    label2: 'Daily Avg',
    val2: `${weekAvgEaten.toLocaleString()}/d`,
    val2Color: '#E8A020',
    label3: 'Weekly Goal',
    val3: weekTotalGoal.toLocaleString(),
    subMetricVal: `${weekTotalEaten.toLocaleString()} kcal eaten (avg ${weekAvgEaten.toLocaleString()} kcal/day)`,
    stepsSubMetricVal: `${weekTotalSteps.toLocaleString()} steps (avg ${weekAvgSteps.toLocaleString()}/day)`,
    stepsLabel1: 'Cal Burned',
    stepsVal1: weekBurnedCals.toLocaleString(),
    stepsLabel2: 'km',
    stepsVal2: weekKm,
    stepsLabel3: 'Move Min',
    stepsVal3: weekMoveMinutes,
  };
}

/**
 * Splits calendar month into Monday-Sunday chunks (zero overlap).
 *
 * @param {number} year
 * @param {number} month - 1-12
 * @returns {{ label: string, dateRange: string, start: number, end: number, numDays: number }[]}
 */
export function partitionMonthIntoWeeks(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentStart = 1;
  let wIdx = 1;

  while (currentStart <= daysInMonth) {
    const d = new Date(year, month - 1, currentStart);
    const jsDay = d.getDay(); // 0 = Sun, ..., 6 = Sat
    const daysUntilSun = jsDay === 0 ? 0 : 7 - jsDay;
    const currentEnd = Math.min(daysInMonth, currentStart + daysUntilSun);

    weeks.push({
      label: `Week ${wIdx}`,
      dateRange: `${month}/${currentStart} - ${month}/${currentEnd}`,
      start: currentStart,
      end: currentEnd,
      numDays: currentEnd - currentStart + 1,
    });

    currentStart = currentEnd + 1;
    wIdx++;
  }

  return weeks;
}

/**
 * Builds weekly aggregated bars for Month View.
 * Fixes bug where steps were dropped if meal summary was null.
 *
 * @param {object} params
 * @returns {object[]}
 */
export function buildMonthlyDistribution({
  curYear,
  curMonth,
  activeDateStr = '',
  activeTotalSteps = 0,
  summary = null,
  calendarData = null,
  stepHistory = {},
  metric = 'steps',
  goalCals = 2000,
  dailyStepGoal = DAILY_STEP_GOAL,
}) {
  const dayMap = {};
  if (calendarData?.days) {
    calendarData.days.forEach((d) => { dayMap[d.date] = d; });
  }

  const weeks = partitionMonthIntoWeeks(curYear, curMonth);

  return weeks.map((w) => {
    let weekSteps = 0;
    let weekCals = 0;
    const numDays = w.numDays;

    for (let day = w.start; day <= w.end; day++) {
      const dStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRecord = dayMap[dStr];
      const isCurrent = dStr === activeDateStr;

      // Ensure steps are NEVER dropped even if summary is null
      const rawHistSteps = stepHistory[dStr] ?? dayRecord?.step_count ?? 0;
      const historySteps = Math.max(0, Math.round(Number(rawHistSteps) || 0));
      const dSteps = isCurrent
        ? (activeTotalSteps > 0 ? Math.round(Number(activeTotalSteps)) : historySteps)
        : historySteps;

      const rawCals = isCurrent && summary
        ? (summary.total_calories || 0)
        : (dayRecord?.total_calories || 0);
      const dCals = Math.max(0, Math.round(Number(rawCals) || 0));

      weekSteps += dSteps;
      weekCals += dCals;
    }

    if (metric === 'steps') {
      const maxSteps = numDays * dailyStepGoal;
      return {
        label: w.label,
        dateRange: w.dateRange,
        val: weekSteps,
        achieved: weekSteps >= maxSteps,
        max: maxSteps,
      };
    } else {
      const weekGoal = numDays * goalCals;
      return {
        label: w.label,
        dateRange: w.dateRange,
        val: weekCals,
        achieved: weekCals > 0 && weekCals <= weekGoal,
        max: weekGoal,
      };
    }
  });
}

/**
 * Aggregates monthly metrics across all days in month.
 * Fixes bug where steps or calories burned were dropped if summary was null.
 *
 * @param {object} params
 * @returns {object}
 */
export function calculateMonthAggregates({
  curYear,
  curMonth,
  activeDateStr = '',
  activeTotalSteps = 0,
  activeBurnedCalories = 0,
  summary = null,
  calendarData = null,
  goalCals = 2000,
  stepHistory = {},
  stepCaloriesHistory = {},
}) {
  const dayMap = {};
  if (calendarData?.days) {
    calendarData.days.forEach((d) => { dayMap[d.date] = d; });
  }
  const daysInMonth = new Date(curYear, curMonth, 0).getDate();

  let monthTotalEaten = 0;
  let monthTotalSteps = 0;
  let monthBurnedCals = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayRecord = dayMap[dStr];
    const isCurrent = dStr === activeDateStr;

    // Steps resolution
    const rawHistSteps = stepHistory[dStr] ?? dayRecord?.step_count ?? 0;
    const historySteps = Math.max(0, Math.round(Number(rawHistSteps) || 0));
    const dSteps = isCurrent
      ? (activeTotalSteps > 0 ? Math.round(Number(activeTotalSteps)) : historySteps)
      : historySteps;

    // Burned calories resolution with active burn fallback
    const rawHistBurned = stepCaloriesHistory[dStr] ?? Math.round(dSteps * 0.04);
    const historyBurned = Math.max(0, Math.round(Number(rawHistBurned) || 0));
    const dBurned = isCurrent
      ? (activeBurnedCalories > 0 ? Math.max(0, Math.round(Number(activeBurnedCalories) || 0)) : historyBurned)
      : historyBurned;

    // Eaten calories resolution
    const rawEaten = isCurrent && summary
      ? (summary.total_calories || 0)
      : (dayRecord?.total_calories || 0);
    const dEaten = Math.max(0, Math.round(Number(rawEaten) || 0));

    monthTotalEaten += dEaten;
    monthTotalSteps += dSteps;
    monthBurnedCals += dBurned;
  }

  const monthTotalGoal = daysInMonth * goalCals;
  const monthAvgEaten = daysInMonth > 0 ? Math.round(monthTotalEaten / daysInMonth) : 0;
  const monthAvgSteps = daysInMonth > 0 ? Math.round(monthTotalSteps / daysInMonth) : 0;
  const monthKm = calculateDistanceKm(monthTotalSteps, 1);
  const monthMoveMinutes = calculateMoveMinutes(monthTotalSteps);

  return {
    eaten: monthTotalEaten,
    goal: monthTotalGoal,
    remaining: Math.max(0, monthTotalGoal - monthTotalEaten),
    steps: monthTotalSteps,
    avgSteps: monthAvgSteps,
    label1: 'Month Total',
    val1: monthTotalEaten.toLocaleString(),
    label2: 'Daily Avg',
    val2: `${monthAvgEaten.toLocaleString()}/d`,
    val2Color: '#E8A020',
    label3: 'Monthly Goal',
    val3: monthTotalGoal.toLocaleString(),
    subMetricVal: `${monthTotalEaten.toLocaleString()} kcal eaten (avg ${monthAvgEaten.toLocaleString()} kcal/day)`,
    stepsSubMetricVal: `${monthTotalSteps.toLocaleString()} steps (avg ${monthAvgSteps.toLocaleString()}/day)`,
    stepsLabel1: 'Cal Burned',
    stepsVal1: monthBurnedCals.toLocaleString(),
    stepsLabel2: 'km',
    stepsVal2: monthKm,
    stepsLabel3: 'Move Min',
    stepsVal3: monthMoveMinutes,
  };
}

/**
 * Safely navigates date by period (day, week, month), preventing 31st month overflow bugs.
 *
 * @param {Date} currentDate
 * @param {'day'|'week'|'month'} period
 * @param {1|-1} direction - +1 for next, -1 for previous
 * @returns {Date}
 */
export function safeNavigateDate(currentDate, period, direction = 1) {
  const d = new Date(currentDate);
  d.setHours(12, 0, 0, 0);
  if (period === 'day') {
    d.setDate(d.getDate() + direction);
    return d;
  }
  if (period === 'week') {
    d.setDate(d.getDate() + direction * 7);
    return d;
  }
  if (period === 'month') {
    const curYear = d.getFullYear();
    const curMonth = d.getMonth();
    const curDay = d.getDate();

    let targetYear = curYear;
    let targetMonth = curMonth + direction;

    if (targetMonth < 0) {
      targetYear -= 1;
      targetMonth = 11;
    } else if (targetMonth > 11) {
      targetYear += 1;
      targetMonth = 0;
    }

    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const safeDay = Math.min(curDay, daysInTargetMonth);
    return new Date(targetYear, targetMonth, safeDay, 12, 0, 0);
  }
  return d;
}
