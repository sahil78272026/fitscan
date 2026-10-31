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
import {
  syncStepsToBackend,
  getHealthConnectHourlySteps,
  getHealthConnectDailyMetrics,
  getHealthConnectRangeMetrics,
  checkHealthConnectPermissionsGranted,
} from '../services/pedometer';
import { getDailySummary, getDailySteps, getCalendarMonth, getStepHistory } from '../services/api';
import {
  formatDateKey,
  formatStepLabel,
  calculateDistanceKm,
  calculateMoveMinutes,
  resolveBurnedCalories,
  resolveTotalSteps,
  buildHourlyDistribution,
  buildWeeklyDistribution,
  calculateWeekAggregates,
  buildMonthlyDistribution,
  calculateMonthAggregates,
  safeNavigateDate,
} from '../utils/stepMetrics';

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
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      }
    }
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });

  const [stepData, setStepData] = useState(() => {
    if (initialStepData) {
      return {
        ...initialStepData,
        date: initialStepData.date || initialDateStr || formatDateKey(new Date()),
      };
    }
    return { step_count: 0, calories_burned: 0, date: initialDateStr || formatDateKey(new Date()) };
  });
  const [summary, setSummary] = useState(initialSummary || null);
  const [calendarData, setCalendarData] = useState(initialCalendarData || null);
  const [stepHistory, setStepHistory] = useState({});
  const [stepCaloriesHistory, setStepCaloriesHistory] = useState({});
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
    if (!windowWidth || windowWidth <= 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
    if (page >= 0 && page < periodOrder.length) {
      currentPageRef.current = page;
      const newPeriod = periodOrder[page];
      if (newPeriod && newPeriod !== period) {
        setPeriod(newPeriod);
      }
    }
  };

  useEffect(() => {
    const idx = periodOrder.indexOf(period);
    if (idx >= 0 && idx !== currentPageRef.current && horizontalScrollRef.current && windowWidth > 0) {
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

  // Synchronize meal summary and step metrics for active date (Health Connect FIRST)
  useEffect(() => {
    let isMounted = true;
    setSelectedHour(null);

    // 1. Fetch daily meal intake summary
    getDailySummary(dateStr)
      .then((data) => {
        if (isMounted) setSummary(data);
      })
      .catch(() => {});

    // 2. Fetch step count prioritizing Google Health Connect
    (async () => {
      try {
        const hc = await getHealthConnectDailyMetrics(currentDate);
        if (isMounted && hc && typeof hc.steps === 'number') {
          setStepData({
            step_count: hc.steps,
            calories_burned: hc.calories,
            date: dateStr,
          });
          setStepHistory((prev) => ({ ...prev, [dateStr]: hc.steps }));
          setStepCaloriesHistory((prev) => ({ ...prev, [dateStr]: hc.calories }));
          const isToday = new Date().toDateString() === currentDate.toDateString();
          if (isToday && hc.steps > 0) {
            syncStepsToBackend(hc.steps, hc.calories);
          }
          return; // Success from Health Connect; do not overwrite with backend
        }
      } catch (hcErr) {
        // Health Connect unavailable or failed, fallback to backend below
      }

      // Fallback: fetch from backend only if Health Connect had no data
      try {
        const res = await getDailySteps(dateStr);
        if (isMounted && res) {
          const sc = res?.step_count || 0;
          const cb = res?.calories_burned || 0;
          setStepData({
            step_count: sc,
            calories_burned: cb,
            date: dateStr,
          });
          setStepHistory((prev) => ({ ...prev, [dateStr]: sc }));
          setStepCaloriesHistory((prev) => ({ ...prev, [dateStr]: cb }));
        }
      } catch (err) {
        if (isMounted) setStepData({ step_count: 0, calories_burned: 0, date: dateStr });
      }
    })();

    // 3. Fetch hourly steps from Health Connect for the active date
    setRealHourlySteps(null);
    getHealthConnectHourlySteps(currentDate)
      .then((hourly) => {
        if (isMounted) setRealHourlySteps({ date: dateStr, data: hourly });
      })
      .catch(() => {
        if (isMounted) setRealHourlySteps(null);
      });

    return () => {
      isMounted = false;
    };
  }, [currentDate, dateStr]);

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
    getStepHistory(365)
      .then((res) => {
        if (isMounted && res?.logs) {
          const map = {};
          const calsMap = {};
          res.logs.forEach((l) => {
            const dateKey = typeof l.logged_date === 'string' ? l.logged_date.split('T')[0] : l.logged_date;
            map[dateKey] = l.step_count || 0;
            calsMap[dateKey] = l.calories_burned || 0;
          });
          setStepHistory((prev) => ({ ...map, ...prev }));
          setStepCaloriesHistory((prev) => ({ ...calsMap, ...prev }));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Health Connect metrics for every day in the current week/month in ONE single shot
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hcGranted = await checkHealthConnectPermissionsGranted();
        if (!hcGranted) return;

        const daysInMonth = new Date(curYear, curMonth, 0).getDate();
        const monthStart = new Date(curYear, curMonth - 1, 1, 0, 0, 0, 0);
        const monthEnd = new Date(curYear, curMonth - 1, daysInMonth, 23, 59, 59, 999);

        const ref = new Date(currentDate);
        ref.setHours(12, 0, 0, 0);
        const day = ref.getDay();
        const diffToMon = (day + 6) % 7;
        const weekStart = new Date(ref);
        weekStart.setDate(ref.getDate() - diffToMon);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const rangeStart = monthStart < weekStart ? monthStart : weekStart;
        const rangeEnd = monthEnd > weekEnd ? monthEnd : weekEnd;

        const metricsMap = await getHealthConnectRangeMetrics(rangeStart, rangeEnd);
        if (isMounted && metricsMap && Object.keys(metricsMap).length > 0) {
          const updates = {};
          const calUpdates = {};
          Object.entries(metricsMap).forEach(([dStr, m]) => {
            updates[dStr] = m.steps;
            calUpdates[dStr] = m.calories;
          });
          setStepHistory((prev) => ({ ...prev, ...updates }));
          setStepCaloriesHistory((prev) => ({ ...prev, ...calUpdates }));
        }
      } catch (err) {
        // ignore
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [currentDate, period, curYear, curMonth]);

  // Period navigation
  const prevPeriod = () => {
    setCurrentDate((prev) => safeNavigateDate(prev, period, -1));
  };

  const nextPeriod = () => {
    setCurrentDate((prev) => safeNavigateDate(prev, period, 1));
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
      const diffToMon = (day + 6) % 7;
      start.setDate(start.getDate() - diffToMon);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('en-US', { month: 'long' })}`;
      }
      return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
  }, [currentDate, period]);

  // Derived metrics for calories eaten and steps
  const calDayForDate = useMemo(() => {
    return calendarData?.days?.find((d) => d.date === dateStr);
  }, [calendarData, dateStr]);

  const totalHourlySteps = useMemo(() => {
    if (!realHourlySteps) return 0;
    const arr = Array.isArray(realHourlySteps) ? realHourlySteps : realHourlySteps?.data;
    if (!arr || !Array.isArray(arr)) return 0;
    return arr.reduce((acc, count) => acc + (typeof count === 'number' ? count : (count?.steps || 0)), 0);
  }, [realHourlySteps]);

  const totalSteps = useMemo(() => {
    return resolveTotalSteps(dateStr, stepData, realHourlySteps, stepHistory, calDayForDate);
  }, [dateStr, stepData, realHourlySteps, stepHistory, calDayForDate]);

  const distanceKm = calculateDistanceKm(totalSteps, 2);
  const moveMinutes = calculateMoveMinutes(totalSteps);
  const burnedCalories = useMemo(() => {
    return resolveBurnedCalories(totalSteps, dateStr, stepData, stepCaloriesHistory);
  }, [totalSteps, dateStr, stepData, stepCaloriesHistory]);

  const eatenCals = summary?.total_calories || 0;
  const goalCals = summary?.calorie_goal || 2000;
  const remainingCals = summary?.remaining_calories ?? (goalCals - eatenCals);

  // 24-hour distribution for day view
  const hourlyData = useMemo(() => {
    return buildHourlyDistribution(realHourlySteps, summary?.meals, dateStr);
  }, [realHourlySteps, summary?.meals, dateStr]);

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

  // 7-day distribution for week view (Monday - Sunday)
  const weeklyData = useMemo(() => {
    return buildWeeklyDistribution({
      currentDate,
      activeDateStr: dateStr,
      activeTotalSteps: totalSteps,
      activeBurnedCalories: burnedCalories,
      activeEatenCals: eatenCals,
      calendarData,
      stepHistory,
      stepCaloriesHistory,
      metric,
      goalCals,
      stepGoal: 10000,
    });
  }, [currentDate, dateStr, totalSteps, burnedCalories, eatenCals, calendarData, stepHistory, stepCaloriesHistory, metric, goalCals]);

  // Dynamic calendar weeks distribution for month view (Monday - Sunday, zero overlap)
  const monthlyData = useMemo(() => {
    return buildMonthlyDistribution({
      curYear,
      curMonth,
      activeDateStr: dateStr,
      activeTotalSteps: totalSteps,
      summary,
      calendarData,
      stepHistory,
      metric,
      goalCals,
      dailyStepGoal: 10000,
    });
  }, [calendarData, curYear, curMonth, dateStr, summary, totalSteps, metric, goalCals, stepHistory]);

  // Dynamic period metrics (Day, Week, Month)
  const dayStats = useMemo(() => {
    const eaten = summary?.total_calories || 0;
    const goal = summary?.calorie_goal || goalCals;
    const remaining = summary?.remaining_calories ?? (goal - eaten);
    const steps = totalSteps;
    const burnedCals = burnedCalories;
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
      stepsLabel1: 'Cal Burned',
      stepsVal1: burnedCals.toLocaleString(),
      stepsLabel2: 'km',
      stepsVal2: distanceKm,
      stepsLabel3: 'Move Min',
      stepsVal3: moveMinutes,
    };
  }, [summary, goalCals, totalSteps, burnedCalories, distanceKm, moveMinutes]);

  const weekStats = useMemo(() => {
    return calculateWeekAggregates(weeklyData, goalCals);
  }, [weeklyData, goalCals]);

  const monthStats = useMemo(() => {
    return calculateMonthAggregates({
      curYear,
      curMonth,
      activeDateStr: dateStr,
      activeTotalSteps: totalSteps,
      activeBurnedCalories: burnedCalories,
      summary,
      calendarData,
      goalCals,
      stepHistory,
      stepCaloriesHistory,
    });
  }, [calendarData, curYear, curMonth, dateStr, summary, totalSteps, burnedCalories, goalCals, stepHistory, stepCaloriesHistory]);

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
            <Text style={[styles.statVal, { color: '#E8A020' }]}>{stats.stepsVal1}</Text>
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
          const labelVal = metric === 'steps' ? formatStepLabel(w.steps) : `${w.cals}`;
          return (
            <View key={idx} style={styles.weeklyCol}>
              <Text style={styles.weeklyVal}>{labelVal}</Text>
              <View style={styles.weeklyTrack}>
                {currentVal > 0 && (
                  <View
                    style={[
                      styles.weeklyFill,
                      {
                        height: `${Math.max(14, pct)}%`,
                        backgroundColor: metric === 'steps'
                          ? (w.achieved ? '#00D287' : '#4285F4')
                          : (w.cals > (w.goal || 2000) ? '#f85149' : '#E8A020'),
                      },
                    ]}
                  />
                )}
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
            {gridExpanded ? 'Calendar View' : `${monthlyData.length}-Week Trend`}
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
              metric={metric}
              stepHistory={stepHistory}
              todaySteps={dateStr === formatDateKey(new Date()) ? totalSteps : Math.max(0, Math.round(Number(stepHistory[formatDateKey(new Date())]) || 0))}
              selectedDateSteps={totalSteps}
              onSelectDate={(newDate) => {
                const d = new Date(newDate);
                d.setHours(12, 0, 0, 0);
                setCurrentDate(d);
                setPeriod('day');
              }}
              onChangeMonth={(y, m) => {
                const daysInNewMonth = new Date(y, m, 0).getDate();
                const safeDay = Math.min(currentDate.getDate(), daysInNewMonth);
                setCurrentDate(new Date(y, m - 1, safeDay, 12, 0, 0));
              }}
            />
          </View>
        ) : (
          <View style={styles.monthlyChartArea}>
            {monthlyData.map((m, idx) => {
              const maxVal = m.max || (metric === 'steps' ? 70000 : 14000);
              const pct = Math.min(100, Math.round((m.val / maxVal) * 100));
              const labelVal = metric === 'steps' ? formatStepLabel(m.val) : `${m.val}`;
              return (
                <View key={idx} style={styles.monthlyCol}>
                  <Text style={styles.monthlyVal}>{labelVal}</Text>
                  <View style={styles.monthlyTrack}>
                    {m.val > 0 && (
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
                                : '#E8A020',
                          },
                        ]}
                      />
                    )}
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
      {hourlyData && hourlyData.filter((h) => h.steps > 0).length > 0 ? (
        hourlyData
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
            const estMins = Math.max(1, calculateMoveMinutes(h.steps));
            const estKm = calculateDistanceKm(h.steps, 2);
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
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Steps Breakdown</Text>
          </View>
          {weeklyData.map((w, idx) => (
            <View key={idx} style={styles.activityCard}>
              <View style={styles.activityIconBox}>
                <Text style={styles.activityIcon}>{w.steps > 0 ? '👟' : '⚪'}</Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTime}>{w.dayName}, {w.dayNum}</Text>
                <Text style={styles.activityName}>
                  {w.steps > 0 ? `${w.steps.toLocaleString()} steps` : 'No steps recorded'}
                </Text>
                <Text style={styles.activityMeta}>
                  {w.burned.toLocaleString()} kcal burned • {calculateDistanceKm(w.steps, 1)} km
                </Text>
              </View>
            </View>
          ))}
        </>
      );
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
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Step Totals</Text>
          </View>
          {monthlyData.map((m, idx) => (
            <View key={idx} style={styles.activityCard}>
              <View style={styles.activityIconBox}>
                <Text style={styles.activityIcon}>{m.val > 0 ? '👟' : '⚪'}</Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTime}>{m.label} ({m.dateRange})</Text>
                <Text style={styles.activityName}>
                  {m.val > 0 ? `${m.val.toLocaleString()} steps` : 'No steps recorded'}
                </Text>
                <Text style={styles.activityMeta}>
                  Goal: {m.max?.toLocaleString()} steps {m.val > 0 ? `• ${Math.round((m.val / m.max) * 100)}%` : ''}
                </Text>
              </View>
            </View>
          ))}
        </>
      );
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
