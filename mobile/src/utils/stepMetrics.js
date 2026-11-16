/**
 * Nutrition Metrics & Period Aggregations Utility
 *
 * Provides pure, deterministic calculation, distribution, and formatting
 * functions for daily, weekly, and monthly nutrition tracking and calorie compliance in FitScan.
 */

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
 * Builds 24-hour distribution for Day View based on logged meals.
 *
 * @param {object[]} [meals] - logged meals for calories
 * @returns {{ hour: number, cals: number }[]}
 */
export function buildHourlyDistribution(meals = []) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, cals: 0 }));

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
  activeEatenCals = 0,
  calendarData = null,
  goalCals = 2000,
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

    const rawDailyCals = isCurrentDay ? activeEatenCals : (calDay?.total_calories || 0);
    const dailyCalsEaten = Math.max(0, Math.round(Number(rawDailyCals) || 0));
    const rawDayGoal = calDay?.calorie_goal || goalCals;
    const dayGoal = Math.max(0, Math.round(Number(rawDayGoal) || 0));

    days.push({
      date: d,
      dateStr: dStr,
      dayName: DAY_LABELS[d.getDay()],
      dayNum: d.getDate(),
      cals: dailyCalsEaten,
      goal: dayGoal,
      achieved: dailyCalsEaten > 0 && dailyCalsEaten <= dayGoal,
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

  return {
    eaten: weekTotalEaten,
    goal: weekTotalGoal,
    remaining: Math.max(0, weekTotalGoal - weekTotalEaten),
    label1: 'Week Total',
    val1: weekTotalEaten.toLocaleString(),
    label2: 'Daily Avg',
    val2: `${weekAvgEaten.toLocaleString()}/d`,
    val2Color: '#E8A020',
    label3: 'Weekly Goal',
    val3: weekTotalGoal.toLocaleString(),
    subMetricVal: `${weekTotalEaten.toLocaleString()} kcal eaten (avg ${weekAvgEaten.toLocaleString()} kcal/day)`,
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
 *
 * @param {object} params
 * @returns {object[]}
 */
export function buildMonthlyDistribution({
  curYear,
  curMonth,
  activeDateStr = '',
  summary = null,
  calendarData = null,
  goalCals = 2000,
}) {
  const dayMap = {};
  if (calendarData?.days) {
    calendarData.days.forEach((d) => { dayMap[d.date] = d; });
  }

  const weeks = partitionMonthIntoWeeks(curYear, curMonth);

  return weeks.map((w) => {
    let weekCals = 0;
    const numDays = w.numDays;

    for (let day = w.start; day <= w.end; day++) {
      const dStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRecord = dayMap[dStr];
      const isCurrent = dStr === activeDateStr;

      const rawCals = isCurrent && summary
        ? (summary.total_calories || 0)
        : (dayRecord?.total_calories || 0);
      const dCals = Math.max(0, Math.round(Number(rawCals) || 0));

      weekCals += dCals;
    }

    const weekGoal = numDays * goalCals;
    return {
      label: w.label,
      dateRange: w.dateRange,
      val: weekCals,
      achieved: weekCals > 0 && weekCals <= weekGoal,
      max: weekGoal,
    };
  });
}

/**
 * Aggregates monthly metrics across all days in month.
 *
 * @param {object} params
 * @returns {object}
 */
export function calculateMonthAggregates({
  curYear,
  curMonth,
  activeDateStr = '',
  summary = null,
  calendarData = null,
  goalCals = 2000,
}) {
  const dayMap = {};
  if (calendarData?.days) {
    calendarData.days.forEach((d) => { dayMap[d.date] = d; });
  }
  const daysInMonth = new Date(curYear, curMonth, 0).getDate();

  let monthTotalEaten = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayRecord = dayMap[dStr];
    const isCurrent = dStr === activeDateStr;

    const rawEaten = isCurrent && summary
      ? (summary.total_calories || 0)
      : (dayRecord?.total_calories || 0);
    const dEaten = Math.max(0, Math.round(Number(rawEaten) || 0));

    monthTotalEaten += dEaten;
  }

  const monthTotalGoal = daysInMonth * goalCals;
  const monthAvgEaten = daysInMonth > 0 ? Math.round(monthTotalEaten / daysInMonth) : 0;

  return {
    eaten: monthTotalEaten,
    goal: monthTotalGoal,
    remaining: Math.max(0, monthTotalGoal - monthTotalEaten),
    label1: 'Month Total',
    val1: monthTotalEaten.toLocaleString(),
    label2: 'Daily Avg',
    val2: `${monthAvgEaten.toLocaleString()}/d`,
    val2Color: '#E8A020',
    label3: 'Monthly Goal',
    val3: monthTotalGoal.toLocaleString(),
    subMetricVal: `${monthTotalEaten.toLocaleString()} kcal eaten (avg ${monthAvgEaten.toLocaleString()} kcal/day)`,
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
