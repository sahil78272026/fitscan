import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalendarGrid from '../components/CalendarGrid';
import { syncStepsToBackend, getHealthConnectHourlySteps } from '../services/pedometer';
import { getDailySummary, getDailySteps, getCalendarMonth, getStepHistory } from '../services/api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatYValue(num) {
  if (num >= 1000) {
    const k = num / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return `${Math.round(num)}`;
}

export default function ActivityDetailScreen({ navigation, route }) {
  const initialDateStr = route.params?.selectedDate;
  const initialStepData = route.params?.stepData;
  const initialSummary = route.params?.summary;
  const initialCalendarData = route.params?.calendarData;
  const initialTab = route.params?.initialTab;

  const [period, setPeriod] = useState('day'); // 'day' | 'week' | 'month'
  const [metric, setMetric] = useState(
    initialTab === 'steps' ? 'steps' : 'calories'
  ); // default to calories eaten
  const [selectedHour, setSelectedHour] = useState(null);
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialDateStr) {
      const parts = initialDateStr.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    return new Date();
  });

  const [stepData, setStepData] = useState(initialStepData || { step_count: 0, calories_burned: 0 });
  const [summary, setSummary] = useState(initialSummary || null);
  const [calendarData, setCalendarData] = useState(initialCalendarData || null);
  const [stepHistory, setStepHistory] = useState({});
  const [realHourlySteps, setRealHourlySteps] = useState(null);
  const [gridExpanded, setGridExpanded] = useState(false);

  // Tab order & Horizontal Paging for buttery-smooth sliding
  const { width: windowWidth } = useWindowDimensions();
  const horizontalScrollRef = useRef(null);
  const currentPageRef = useRef(0);
  const periodOrder = ['day', 'week', 'month'];

  const handleTabPress = (p, idx) => {
    currentPageRef.current = idx;
    setPeriod(p);
    horizontalScrollRef.current?.scrollTo({
      x: idx * windowWidth,
      animated: true,
    });
  };

  const onMomentumScrollEnd = (e) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
    currentPageRef.current = page;
    const newPeriod = periodOrder[page];
    if (newPeriod && newPeriod !== period) {
      setPeriod(newPeriod);
    }
  };

  useEffect(() => {
    const idx = periodOrder.indexOf(period);
    if (idx >= 0 && idx !== currentPageRef.current && horizontalScrollRef.current) {
      currentPageRef.current = idx;
      horizontalScrollRef.current.scrollTo({
        x: idx * windowWidth,
        animated: true,
      });
    }
  }, [period, windowWidth]);

  const curYear = currentDate.getFullYear();
  const curMonth = currentDate.getMonth() + 1;

  // Synchronize data whenever selected date changes
  const dateStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [currentDate]);

  useEffect(() => {
    let isMounted = true;
    getDailySummary(dateStr)
      .then((data) => {
        if (isMounted) setSummary(data);
      })
      .catch(() => {});

    getDailySteps(dateStr)
      .then((res) => {
        if (isMounted) {
          setStepData({
            step_count: res?.step_count || 0,
            calories_burned: res?.calories_burned || 0,
          });
        }
      })
      .catch(() => {
        if (isMounted) setStepData({ step_count: 0, calories_burned: 0 });
      });

    return () => {
      isMounted = false;
    };
  }, [dateStr]);

  // Dynamically fetch calendar month whenever month changes
  useEffect(() => {
    let isMounted = true;
    getCalendarMonth(curYear, curMonth)
      .then((data) => {
        if (isMounted && data) setCalendarData(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [curYear, curMonth]);

  // Fetch real step history from backend to populate weekly/monthly steps
  useEffect(() => {
    let isMounted = true;
    getStepHistory(90)
      .then((res) => {
        if (isMounted && res?.logs) {
          const map = {};
          res.logs.forEach((l) => {
            const dateKey = typeof l.logged_date === 'string' ? l.logged_date.split('T')[0] : l.logged_date;
            map[dateKey] = l.step_count || 0;
          });
          setStepHistory(map);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch real hourly step data for the active date (via Health Connect if on Android)
  useEffect(() => {
    let isMounted = true;
    getHealthConnectHourlySteps(currentDate)
      .then((hourly) => {
        if (isMounted) setRealHourlySteps(hourly);
      })
      .catch(() => {
        if (isMounted) setRealHourlySteps(null);
      });
    return () => {
      isMounted = false;
    };
  }, [currentDate]);

  // Period navigation
  const prevPeriod = () => {
    const d = new Date(currentDate);
    if (period === 'day') d.setDate(d.getDate() - 1);
    else if (period === 'week') d.setDate(d.getDate() - 7);
    else if (period === 'month') d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const nextPeriod = () => {
    const d = new Date(currentDate);
    if (period === 'day') d.setDate(d.getDate() + 1);
    else if (period === 'week') d.setDate(d.getDate() + 7);
    else if (period === 'month') d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  // Date heading label
  const periodLabel = useMemo(() => {
    if (period === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } else if (period === 'week') {
      const start = new Date(currentDate);
      const day = start.getDay();
      start.setDate(start.getDate() - ((day + 6) % 7));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('en-US', { month: 'long' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
  }, [currentDate, period]);

  // Derived metrics for calories eaten and steps
  const totalSteps = stepData?.step_count || 0;
  const distanceKm = (((totalSteps) * 0.762) / 1000).toFixed(2);
  const moveMinutes = Math.round(totalSteps / 78);

  const eatenCals = summary?.total_calories || 0;
  const goalCals = summary?.calorie_goal || 2000;
  const remainingCals = summary?.remaining_calories ?? (goalCals - eatenCals);

  // 24-hour distribution for day view
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, steps: 0, cals: 0 }));

    // Real recorded walking steps distribution (if available)
    if (realHourlySteps && Array.isArray(realHourlySteps) && realHourlySteps.length === 24) {
      realHourlySteps.forEach((s, idx) => {
        hours[idx].steps = s || 0;
      });
    }

    // Actual calories eaten mapped from logged meals using real logged_at time
    if (summary?.meals && summary.meals.length > 0) {
      summary.meals.forEach((m) => {
        let h = null;
        const dateVal = m.logged_at || m.created_at;
        if (dateVal) {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) {
            h = d.getHours();
          }
        }
        if (h === null || isNaN(h)) {
          if (m.meal_type === 'breakfast') h = 8;
          else if (m.meal_type === 'lunch') h = 13;
          else if (m.meal_type === 'snack') h = 16;
          else if (m.meal_type === 'dinner') h = 20;
          else h = 12;
        }
        if (h >= 0 && h < 24) {
          hours[h].cals += (m.total_calories || 0);
        }
      });
    }

    return hours;
  }, [realHourlySteps, summary?.meals]);

  const maxHourlyValue = useMemo(() => {
    if (metric === 'steps') {
      const vals = hourlyData.map((h) => h.steps);
      const maxVal = Math.max(0, ...vals);
      if (maxVal === 0) return 1000;
      return Math.max(500, Math.ceil(maxVal / 250) * 250);
    } else {
      const vals = hourlyData.map((h) => h.cals);
      const maxVal = Math.max(0, ...vals);
      if (maxVal === 0) return 600;
      return Math.max(400, Math.ceil(maxVal / 200) * 200);
    }
  }, [hourlyData, metric]);

  // 7-day distribution for week view
  const weeklyData = useMemo(() => {
    const days = [];
    const ref = new Date(currentDate);
    const day = ref.getDay();
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - ((day + 6) % 7));

    const dayMap = {};
    if (calendarData?.days) {
      calendarData.days.forEach((d) => {
        dayMap[d.date] = d;
      });
    }

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dayY = d.getFullYear();
      const dayM = String(d.getMonth() + 1).padStart(2, '0');
      const dayD = String(d.getDate()).padStart(2, '0');
      const dStr = `${dayY}-${dayM}-${dayD}`;

      const isCurrentDay = dStr === dateStr;
      const calDay = dayMap[dStr];

      const dailySteps = isCurrentDay
        ? totalSteps
        : (stepHistory[dStr] ?? calDay?.step_count ?? 0);
      const dailyCalsEaten = isCurrentDay ? eatenCals : (calDay?.total_calories || 0);
      const dayGoal = calDay?.calorie_goal || goalCals;

      days.push({
        date: d,
        dayName: DAY_LABELS[d.getDay()],
        dayNum: d.getDate(),
        steps: dailySteps,
        cals: dailyCalsEaten,
        goal: dayGoal,
        achieved: metric === 'steps' ? dailySteps >= 4000 : (dailyCalsEaten > 0 && dailyCalsEaten <= dayGoal),
      });
    }
    return days;
  }, [currentDate, totalSteps, calendarData, dateStr, eatenCals, goalCals, metric, stepHistory]);

  // Dynamic 4-week distribution for month view from real database records
  const monthlyData = useMemo(() => {
    const days = calendarData?.days || [];
    const dayMap = {};
    days.forEach((d) => { dayMap[d.date] = d; });

    const daysInMonth = new Date(curYear, curMonth, 0).getDate();
    const weeks = [
      { label: 'Week 1', start: 1, end: 7 },
      { label: 'Week 2', start: 8, end: 14 },
      { label: 'Week 3', start: 15, end: 21 },
      { label: 'Week 4', start: 22, end: daysInMonth },
    ];

    return weeks.map((w) => {
      let weekSteps = 0;
      let weekCals = 0;
      const numDays = w.end - w.start + 1;

      for (let day = w.start; day <= w.end; day++) {
        const dStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayRecord = dayMap[dStr];
        if (dStr === dateStr && summary) {
          weekCals += (summary.total_calories || 0);
          weekSteps += totalSteps;
        } else {
          weekCals += (dayRecord?.total_calories || 0);
          weekSteps += (stepHistory[dStr] ?? dayRecord?.step_count ?? 0);
        }
      }

      if (metric === 'steps') {
        const maxSteps = numDays * 10000;
        return {
          label: w.label,
          val: weekSteps,
          achieved: weekSteps >= (numDays * 6000),
          max: maxSteps,
        };
      } else {
        const weekGoal = numDays * goalCals;
        return {
          label: w.label,
          val: weekCals,
          achieved: weekCals > 0 && weekCals <= weekGoal,
          max: weekGoal,
        };
      }
    });
  }, [calendarData, curYear, curMonth, dateStr, summary, totalSteps, metric, goalCals, stepHistory]);

  // Dynamic period metrics (Day, Week, Month)
  const dayStats = useMemo(() => {
    const eaten = summary?.total_calories || 0;
    const goal = summary?.calorie_goal || goalCals;
    const remaining = summary?.remaining_calories ?? (goal - eaten);
    const steps = stepData?.step_count || 0;
    return {
      eaten,
      goal,
      remaining,
      steps,
      label1: 'Cal Eaten',
      val1: eaten.toLocaleString(),
      label2: 'Remaining',
      val2: remaining.toLocaleString(),
      val2Color: remaining < 0 ? '#f85149' : '#00D287',
      label3: 'Goal',
      val3: goal.toLocaleString(),
      subMetricVal: `${eaten.toLocaleString()} kcal eaten of ${goal.toLocaleString()} kcal`,
      stepsSubMetricVal: `${steps.toLocaleString()} steps of 10,000`,
      stepsLabel1: 'Steps',
      stepsVal1: steps.toLocaleString(),
      stepsLabel2: 'km',
      stepsVal2: distanceKm,
      stepsLabel3: 'Move Min',
      stepsVal3: moveMinutes,
    };
  }, [summary, goalCals, stepData, distanceKm, moveMinutes]);

  const weekStats = useMemo(() => {
    const weekTotalEaten = weeklyData.reduce((sum, d) => sum + (d.cals || 0), 0);
    const weekTotalGoal = weeklyData.reduce((sum, d) => sum + (d.goal || goalCals), 0);
    const weekAvgEaten = Math.round(weekTotalEaten / 7);
    const weekTotalSteps = weeklyData.reduce((sum, d) => sum + (d.steps || 0), 0);
    const weekAvgSteps = Math.round(weekTotalSteps / 7);
    const weekKm = ((weekTotalSteps * 0.762) / 1000).toFixed(1);
    return {
      eaten: weekTotalEaten,
      goal: weekTotalGoal,
      remaining: Math.max(0, weekTotalGoal - weekTotalEaten),
      steps: weekTotalSteps,
      label1: 'Week Total',
      val1: weekTotalEaten.toLocaleString(),
      label2: 'Daily Avg',
      val2: `${weekAvgEaten.toLocaleString()}/d`,
      val2Color: '#E8A020',
      label3: 'Weekly Goal',
      val3: weekTotalGoal.toLocaleString(),
      subMetricVal: `${weekTotalEaten.toLocaleString()} kcal eaten (avg ${weekAvgEaten.toLocaleString()} kcal/day)`,
      stepsSubMetricVal: `${weekTotalSteps.toLocaleString()} steps (avg ${weekAvgSteps.toLocaleString()}/day)`,
      stepsLabel1: 'Week Steps',
      stepsVal1: weekTotalSteps.toLocaleString(),
      stepsLabel2: 'Total km',
      stepsVal2: weekKm,
      stepsLabel3: 'Daily Avg',
      stepsVal3: weekAvgSteps.toLocaleString(),
    };
  }, [weeklyData, goalCals]);

  const monthStats = useMemo(() => {
    const days = calendarData?.days || [];
    const dayMap = {};
    days.forEach((d) => { dayMap[d.date] = d; });
    const daysInMonth = new Date(curYear, curMonth, 0).getDate();

    let monthTotalEaten = 0;
    let monthTotalSteps = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRecord = dayMap[dStr];
      if (dStr === dateStr && summary) {
        monthTotalEaten += (summary.total_calories || 0);
        monthTotalSteps += totalSteps;
      } else {
        monthTotalEaten += (dayRecord?.total_calories || 0);
        monthTotalSteps += (stepHistory[dStr] ?? dayRecord?.step_count ?? 0);
      }
    }

    const monthTotalGoal = daysInMonth * goalCals;
    const monthAvgEaten = daysInMonth > 0 ? Math.round(monthTotalEaten / daysInMonth) : 0;
    const monthAvgSteps = daysInMonth > 0 ? Math.round(monthTotalSteps / daysInMonth) : 0;
    const monthKm = ((monthTotalSteps * 0.762) / 1000).toFixed(1);
    return {
      eaten: monthTotalEaten,
      goal: monthTotalGoal,
      remaining: Math.max(0, monthTotalGoal - monthTotalEaten),
      steps: monthTotalSteps,
      label1: 'Month Total',
      val1: monthTotalEaten.toLocaleString(),
      label2: 'Daily Avg',
      val2: `${monthAvgEaten.toLocaleString()}/d`,
      val2Color: '#E8A020',
      label3: 'Monthly Goal',
      val3: monthTotalGoal.toLocaleString(),
      subMetricVal: `${monthTotalEaten.toLocaleString()} kcal eaten (avg ${monthAvgEaten.toLocaleString()} kcal/day)`,
      stepsSubMetricVal: `${monthTotalSteps.toLocaleString()} steps (avg ${monthAvgSteps.toLocaleString()}/day)`,
      stepsLabel1: 'Month Steps',
      stepsVal1: monthTotalSteps.toLocaleString(),
      stepsLabel2: 'Total km',
      stepsVal2: monthKm,
      stepsLabel3: 'Daily Avg',
      stepsVal3: monthAvgSteps.toLocaleString(),
    };
  }, [calendarData, curYear, curMonth, dateStr, summary, totalSteps, goalCals, stepHistory]);

  const periodStats = period === 'day' ? dayStats : period === 'week' ? weekStats : monthStats;

  // --- Helper Renderers for Modular, Buttery-Smooth Tab Paging ---
  const renderStatsBanner = (stats) => (
    <View style={styles.statsRow}>
      {metric === 'calories' ? (
        <>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#E8A020' }]}>{stats.val1}</Text>
            <Text style={styles.statLbl}>{stats.label1}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: stats.val2Color }]}>
              {stats.val2}
            </Text>
            <Text style={styles.statLbl}>{stats.label2}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.val3}</Text>
            <Text style={styles.statLbl}>{stats.label3}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.stepsVal1}</Text>
            <Text style={styles.statLbl}>{stats.stepsLabel1}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.stepsVal2}</Text>
            <Text style={styles.statLbl}>{stats.stepsLabel2}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{stats.stepsVal3}</Text>
            <Text style={styles.statLbl}>{stats.stepsLabel3}</Text>
          </View>
        </>
      )}
    </View>
  );

  const renderMetricPills = () => (
    <View style={styles.metricPillsRow}>
      <TouchableOpacity
        style={[
          styles.metricPill,
          metric === 'calories' && styles.metricPillActiveCals,
        ]}
        onPress={() => setMetric('calories')}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.metricPillText,
            metric === 'calories' && styles.metricPillTextActive,
          ]}
        >
          🔥 Calories Eaten
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.metricPill,
          metric === 'steps' && styles.metricPillActiveBlue,
        ]}
        onPress={() => setMetric('steps')}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.metricPillText,
            metric === 'steps' && styles.metricPillTextActive,
          ]}
        >
          👟 Steps
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDayChart = () => (
    <View style={styles.chartContainer}>
      {selectedHour !== null && (
        <View style={styles.chartTooltip}>
          <Text style={styles.chartTooltipText}>
            {selectedHour === 0
              ? '12:00 am'
              : selectedHour === 12
              ? '12:00 pm'
              : selectedHour > 12
              ? `${selectedHour - 12}:00 pm`
              : `${selectedHour}:00 am`}
            {' • '}
            <Text
              style={{
                fontWeight: '700',
                color: metric === 'steps' ? '#60A5FA' : '#E8A020',
              }}
            >
              {metric === 'steps'
                ? `${(hourlyData[selectedHour]?.steps || 0).toLocaleString()} steps`
                : `${(hourlyData[selectedHour]?.cals || 0).toLocaleString()} kcal`}
            </Text>
          </Text>
        </View>
      )}

      <View style={styles.gridLinesContainer}>
        <View style={styles.gridLineRow}>
          <Text style={styles.gridLabel}>{formatYValue(maxHourlyValue)}</Text>
          <View style={styles.gridLine} />
        </View>
        <View style={styles.gridLineRow}>
          <Text style={styles.gridLabel}>{formatYValue(maxHourlyValue / 2)}</Text>
          <View style={styles.gridLine} />
        </View>
        <View style={styles.gridLineRow}>
          <Text style={styles.gridLabel}>0</Text>
          <View style={[styles.gridLine, styles.gridLineBase]} />
        </View>
      </View>

      <View style={styles.barsArea}>
        {hourlyData.map((h) => {
          const val = metric === 'steps' ? h.steps : h.cals;
          const pct = Math.min(100, Math.round((val / maxHourlyValue) * 100));
          const hasVal = val > 0;
          const isSelected = selectedHour === h.hour;
          return (
            <TouchableOpacity
              key={h.hour}
              style={styles.barCol}
              onPress={() => setSelectedHour(isSelected ? null : h.hour)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.barTrack,
                  isSelected && styles.barTrackSelected,
                ]}
              >
                {hasVal && (
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(14, pct)}%`,
                        backgroundColor: isSelected
                          ? '#FFFFFF'
                          : metric === 'steps'
                          ? '#4285F4'
                          : '#E8A020',
                      },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.xAxisRow}>
        {hourlyData.map((h) => {
          const labelMap = { 0: '12a', 4: '4a', 8: '8a', 12: '12p', 16: '4p', 20: '8p' };
          const lbl = labelMap[h.hour];
          return (
            <View key={h.hour} style={styles.xLabelCol}>
              {lbl ? <Text style={styles.xLabel}>{lbl}</Text> : null}
            </View>
          );
        })}
      </View>

      {renderMetricPills()}
    </View>
  );

  const renderWeekChart = () => (
    <View style={styles.chartContainer}>
      <View style={styles.weeklyChartArea}>
        {weeklyData.map((w, idx) => {
          const maxVal = metric === 'steps' ? 10000 : (w.goal || 2000);
          const currentVal = metric === 'steps' ? w.steps : w.cals;
          const pct = Math.min(100, Math.round((currentVal / maxVal) * 100));
          const labelVal = metric === 'steps' ? `${(w.steps / 1000).toFixed(1)}k` : `${w.cals}`;
          return (
            <View key={idx} style={styles.weeklyCol}>
              <Text style={styles.weeklyVal}>{labelVal}</Text>
              <View style={styles.weeklyTrack}>
                <View
                  style={[
                    styles.weeklyFill,
                    {
                      height: `${Math.max(14, pct)}%`,
                      backgroundColor: metric === 'steps'
                        ? (w.achieved ? '#00D287' : '#4285F4')
                        : (w.cals > (w.goal || 2000) ? '#f85149' : (w.cals > 0 ? '#E8A020' : '#33271D')),
                    },
                  ]}
                />
              </View>
              <Text style={styles.weeklyDayName}>{w.dayName}</Text>
              <Text style={styles.weeklyDayNum}>{w.dayNum}</Text>
            </View>
          );
        })}
      </View>

      {renderMetricPills()}
    </View>
  );

  const renderMonthChart = () => (
    <View style={styles.chartContainer}>
      <View style={styles.monthSectionContainer}>
        <View style={styles.monthHeaderRow}>
          <Text style={styles.monthHeaderTitle}>
            {gridExpanded ? 'Calendar View' : '4-Week Trend'}
          </Text>
          <TouchableOpacity
            style={styles.compactToggleBtn}
            onPress={() => setGridExpanded(!gridExpanded)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.compactToggleIcon}>{gridExpanded ? '📊' : '📅'}</Text>
            <Text style={styles.compactToggleText}>
              {gridExpanded ? 'Show Chart' : 'Show Full Month'}
            </Text>
          </TouchableOpacity>
        </View>

        {gridExpanded ? (
          <View style={styles.calendarGridWrapper}>
            <CalendarGrid
              year={curYear}
              month={curMonth}
              calendarData={calendarData}
              calendarGoal={goalCals}
              selectedDateStr={dateStr}
              onSelectDate={(newDate) => {
                setCurrentDate(newDate);
                setPeriod('day');
              }}
              onChangeMonth={(y, m) => {
                const d = new Date(currentDate);
                d.setFullYear(y);
                d.setMonth(m - 1);
                setCurrentDate(d);
              }}
            />
          </View>
        ) : (
          <View style={styles.monthlyChartArea}>
            {monthlyData.map((m, idx) => {
              const maxVal = m.max || (metric === 'steps' ? 70000 : 14000);
              const pct = Math.min(100, Math.round((m.val / maxVal) * 100));
              const labelVal = m.val >= 1000 ? `${(m.val / 1000).toFixed(1)}k` : `${m.val}`;
              return (
                <View key={idx} style={styles.monthlyCol}>
                  <Text style={styles.monthlyVal}>{labelVal}</Text>
                  <View style={styles.monthlyTrack}>
                    <View
                      style={[
                        styles.monthlyFill,
                        {
                          height: `${Math.max(15, pct)}%`,
                          backgroundColor:
                            metric === 'steps'
                              ? m.achieved
                                ? '#00D287'
                                : '#4285F4'
                              : m.val > 0
                              ? '#E8A020'
                              : '#33271D',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.monthlyLabel}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {renderMetricPills()}
    </View>
  );

  const renderStepsActivities = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recorded Activities</Text>
      </View>
      {realHourlySteps && realHourlySteps.filter((h) => h.steps > 0).length > 0 ? (
        realHourlySteps
          .filter((h) => h.steps > 0)
          .map((h, idx) => {
            const hour12 =
              h.hour === 0
                ? '12:00 am'
                : h.hour === 12
                ? '12:00 pm'
                : h.hour > 12
                ? `${h.hour - 12}:00 pm`
                : `${h.hour}:00 am`;
            const estMins = Math.max(1, Math.round(h.steps / 85));
            const estKm = ((h.steps * 0.762) / 1000).toFixed(2);
            return (
              <View key={idx} style={styles.activityCard}>
                <View style={styles.activityIconBox}>
                  <Text style={styles.activityIcon}>🚶</Text>
                </View>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityTime}>{hour12}</Text>
                  <Text style={styles.activityName}>{h.steps.toLocaleString()} steps</Text>
                  <Text style={styles.activityMeta}>~{estMins}m active • {estKm} km</Text>
                </View>
              </View>
            );
          })
      ) : totalSteps > 0 ? (
        <View style={styles.activityCard}>
          <View style={styles.activityIconBox}>
            <Text style={styles.activityIcon}>🚶</Text>
          </View>
          <View style={styles.activityDetails}>
            <Text style={styles.activityTime}>Daily Summary</Text>
            <Text style={styles.activityName}>{totalSteps.toLocaleString()} steps</Text>
            <Text style={styles.activityMeta}>{distanceKm} km • {moveMinutes}m active movement</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyMealBox}>
          <Text style={styles.emptyMealIcon}>🚶</Text>
          <Text style={styles.emptyMealText}>No movement or steps recorded for this date</Text>
        </View>
      )}
    </>
  );

  const renderDayActivities = () => {
    if (metric === 'calories') {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Logged Meals {summary?.meals?.length ? `(${summary.meals.length})` : ''}
            </Text>
          </View>
          {(!summary?.meals || summary.meals.length === 0) ? (
            <View style={styles.emptyMealBox}>
              <Text style={styles.emptyMealIcon}>🍽️</Text>
              <Text style={styles.emptyMealText}>No meals logged for this date</Text>
            </View>
          ) : (
            summary.meals.map((m) => {
              const getMealIcon = (type) => {
                switch (type?.toLowerCase()) {
                  case 'breakfast': return '🍳';
                  case 'lunch': return '🥗';
                  case 'snack': return '🍎';
                  case 'dinner': return '🍲';
                  default: return '🍽️';
                }
              };
              let timeStr = m.meal_type ? m.meal_type.toUpperCase() : 'MEAL';
              const dateVal = m.logged_at || m.created_at;
              if (dateVal) {
                const d = new Date(dateVal);
                if (!isNaN(d.getTime())) {
                  const formattedTime = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                  timeStr = m.meal_type ? `${m.meal_type.toUpperCase()} • ${formattedTime}` : formattedTime;
                }
              }
              return (
                <View key={m.id} style={styles.activityCard}>
                  <View style={styles.activityIconBox}>
                    <Text style={styles.activityIcon}>{getMealIcon(m.meal_type)}</Text>
                  </View>
                  <View style={styles.activityDetails}>
                    <Text style={styles.activityTime}>{timeStr}</Text>
                    <Text style={styles.activityName}>{m.raw_input || m.meal_type}</Text>
                    <Text style={styles.activityMeta}>
                      {m.total_calories} kcal eaten • P: {m.total_protein || 0}g | C: {m.total_carbs || 0}g | F: {m.total_fat || 0}g
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </>
      );
    } else {
      return renderStepsActivities();
    }
  };

  const renderWeekActivities = () => {
    if (metric === 'calories') {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Intake Breakdown</Text>
          </View>
          {weeklyData.map((w, idx) => (
            <View key={idx} style={styles.activityCard}>
              <View style={styles.activityIconBox}>
                <Text style={styles.activityIcon}>{w.cals > 0 ? '🍽️' : '⚪'}</Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTime}>{w.dayName}, {w.dayNum}</Text>
                <Text style={styles.activityName}>
                  {w.cals > 0 ? `${w.cals.toLocaleString()} kcal eaten` : 'No meals logged'}
                </Text>
                <Text style={styles.activityMeta}>
                  Goal: {w.goal.toLocaleString()} kcal {w.cals > 0 ? `• ${Math.round((w.cals / w.goal) * 100)}%` : ''}
                </Text>
              </View>
            </View>
          ))}
        </>
      );
    } else {
      return renderStepsActivities();
    }
  };

  const renderMonthActivities = () => {
    if (metric === 'calories') {
      const activeDays = (calendarData?.days || []).filter((d) => d.total_calories > 0);
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Monthly History</Text>
          </View>
          {activeDays.length === 0 ? (
            <View style={styles.emptyMealBox}>
              <Text style={styles.emptyMealIcon}>🍽️</Text>
              <Text style={styles.emptyMealText}>No meals logged this month</Text>
            </View>
          ) : (
            activeDays.map((d, idx) => (
              <View key={idx} style={styles.activityCard}>
                <View style={styles.activityIconBox}>
                  <Text style={styles.activityIcon}>🍽️</Text>
                </View>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityTime}>{d.date}</Text>
                  <Text style={styles.activityName}>{d.total_calories.toLocaleString()} kcal eaten</Text>
                  <Text style={styles.activityMeta}>
                    Goal: {(d.calorie_goal || goalCals).toLocaleString()} kcal • P: {d.total_protein || 0}g
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      );
    } else {
      return renderStepsActivities();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle}>My activity</Text>

        <View style={styles.topRightActions} />
      </View>

      {/* Locked Header: Tab Switcher + Date Navigation */}
      <View style={styles.lockedHeaderContainer}>
        {/* Day / Week / Month Tab Switcher */}
        <View style={styles.tabBar}>
          {periodOrder.map((p, idx) => {
            const isActive = period === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => handleTabPress(p, idx)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Locked Date Selector Row with Left / Right Navigation */}
        <View style={styles.dateSelectorRow}>
          <TouchableOpacity
            style={styles.dateNavBtn}
            onPress={prevPeriod}
            activeOpacity={0.7}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 10 }}
          >
            <Text style={styles.dateNavText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.dateCenterInfo}>
            <Text style={styles.dateTitle}>{periodLabel}</Text>
            <View style={styles.dateSubRow}>
              {metric === 'steps' ? (
                <>
                  <Text style={styles.subMetricIcon}>👟</Text>
                  <Text style={styles.subMetricVal}>{periodStats.stepsSubMetricVal}</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.subMetricIcon, { color: '#E8A020' }]}>🔥</Text>
                  <Text style={[styles.subMetricVal, { color: '#E8A020' }]}>
                    {periodStats.subMetricVal}
                  </Text>
                </>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.dateNavBtn}
            onPress={nextPeriod}
            activeOpacity={0.7}
            hitSlop={{ top: 14, bottom: 14, left: 10, right: 14 }}
          >
            <Text style={styles.dateNavText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Paging Carousel for Day / Week / Month (Smooth native sliding, zero jerk) */}
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled={true}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {/* Page 1: Day */}
        <View style={{ width: windowWidth }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {renderStatsBanner(dayStats)}
            {renderDayChart()}
            {renderDayActivities()}
          </ScrollView>
        </View>

        {/* Page 2: Week */}
        <View style={{ width: windowWidth }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {renderStatsBanner(weekStats)}
            {renderWeekChart()}
            {renderWeekActivities()}
          </ScrollView>
        </View>

        {/* Page 3: Month */}
        <View style={{ width: windowWidth }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {renderStatsBanner(monthStats)}
            {renderMonthChart()}
            {renderMonthActivities()}
          </ScrollView>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161310',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#251E17',
  },
  backBtn: {
    padding: 4,
  },
  backArrow: {
    fontSize: 22,
    color: '#F4ECDD',
    fontWeight: 'bold',
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F4ECDD',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  actionIcon: {
    fontSize: 22,
    color: '#F4ECDD',
    fontWeight: 'bold',
  },
  lockedHeaderContainer: {
    backgroundColor: '#161310',
    borderBottomWidth: 1,
    borderBottomColor: '#282119',
    paddingBottom: 8,
    zIndex: 10,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#282119',
    backgroundColor: '#1A1511',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#F4ECDD',
  },
  tabText: {
    fontSize: 14,
    color: '#8A7E72',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#F4ECDD',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 10,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#241E18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateNavText: {
    fontSize: 20,
    color: '#F4ECDD',
    fontWeight: 'bold',
  },
  dateCenterInfo: {
    alignItems: 'center',
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4ECDD',
    marginBottom: 4,
  },
  dateSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subMetricIcon: {
    fontSize: 13,
  },
  subMetricVal: {
    fontSize: 13,
    color: '#85B7EB',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1914',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2D241B',
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#85B7EB',
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 12,
    color: '#9C9081',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#352B20',
  },
  chartContainer: {
    backgroundColor: '#1E1914',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D241B',
    padding: 16,
    marginBottom: 16,
  },
  chartTooltip: {
    backgroundColor: '#272018',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3D3123',
  },
  chartTooltipText: {
    fontSize: 12,
    color: '#F4ECDD',
    fontWeight: '500',
  },
  gridLinesContainer: {
    height: 120,
    justifyContent: 'space-between',
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    width: 36,
    fontSize: 10,
    fontWeight: '600',
    color: '#8A7D6F',
    textAlign: 'right',
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2D251C',
    marginLeft: 8,
  },
  gridLineBase: {
    backgroundColor: '#3D3226',
  },
  barsArea: {
    height: 120,
    marginLeft: 44,
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  barCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 7,
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  barTrackSelected: {
    backgroundColor: 'rgba(232, 160, 32, 0.25)',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 3.5,
    borderTopRightRadius: 3.5,
  },
  xAxisRow: {
    flexDirection: 'row',
    marginLeft: 44,
    marginRight: 4,
    marginTop: 8,
  },
  xLabelCol: {
    flex: 1,
    alignItems: 'center',
  },
  xLabel: {
    fontSize: 9,
    color: '#857769',
    textAlign: 'center',
    width: 26,
  },
  weeklyChartArea: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  weeklyCol: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyVal: {
    fontSize: 10,
    color: '#857769',
    marginBottom: 4,
  },
  weeklyTrack: {
    width: 14,
    height: 80,
    backgroundColor: '#261F18',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weeklyFill: {
    width: '100%',
    borderRadius: 6,
  },
  weeklyDayName: {
    fontSize: 10,
    color: '#9C9081',
    marginTop: 6,
  },
  weeklyDayNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F4ECDD',
  },
  swipeContainer: {
    flex: 1,
  },
  monthSectionContainer: {
    width: '100%',
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  monthHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A79A85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#241D16',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3D3123',
  },
  compactToggleIcon: {
    fontSize: 11,
  },
  compactToggleText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: '700',
  },
  calendarGridWrapper: {
    marginTop: 2,
  },
  monthlyChartArea: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  monthlyCol: {
    width: 50,
    alignItems: 'center',
  },
  monthlyVal: {
    fontSize: 11,
    color: '#857769',
    marginBottom: 4,
  },
  monthlyTrack: {
    width: 20,
    height: 80,
    backgroundColor: '#261F18',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  monthlyFill: {
    width: '100%',
    borderRadius: 8,
  },
  monthlyLabel: {
    fontSize: 11,
    color: '#9C9081',
    marginTop: 8,
  },
  metricPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  metricPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#251E17',
    borderWidth: 1,
    borderColor: '#352B20',
  },
  metricPillActiveCals: {
    backgroundColor: '#2E2214',
    borderColor: '#E8A020',
  },
  metricPillActiveBlue: {
    backgroundColor: '#1E2D4A',
    borderColor: '#4285F4',
  },
  metricPillText: {
    fontSize: 12,
    color: '#8A7D6F',
    fontWeight: '600',
  },
  metricPillTextActive: {
    color: '#F4ECDD',
    fontWeight: '700',
  },
  infoBanner: {
    backgroundColor: '#1A1511',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#E8A020',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#A89B8B',
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F4ECDD',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1914',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2D241B',
  },
  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#282119',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIcon: {
    fontSize: 20,
  },
  activityDetails: {
    flex: 1,
  },
  activityTime: {
    fontSize: 11,
    color: '#857769',
  },
  activityName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4ECDD',
    marginTop: 1,
  },
  activityMeta: {
    fontSize: 12,
    color: '#9C9081',
    marginTop: 2,
  },
  emptyMealBox: {
    backgroundColor: '#1E1914',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D241B',
    marginBottom: 12,
  },
  emptyMealIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  emptyMealText: {
    fontSize: 13,
    color: '#8A7E72',
  },
});
