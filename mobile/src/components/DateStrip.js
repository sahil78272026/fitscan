import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

function getWeekDates(referenceDate) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7)); // Get Monday

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DateStrip({ selectedDate, onDateSelect, calendarData }) {
  const today = useMemo(() => new Date(), []);
  const [weekRef, setWeekRef] = useState(selectedDate || today);
  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);

  const dataMap = useMemo(() => {
    const map = {};
    if (calendarData?.days) {
      calendarData.days.forEach((d) => { map[d.date] = d; });
    }
    return map;
  }, [calendarData]);

  const prevWeek = () => {
    const ref = new Date(selectedDate || weekRef);
    const d = new Date(ref);
    d.setDate(d.getDate() - 7);
    setWeekRef(d);
    onDateSelect(d);
  };

  const nextWeek = () => {
    const ref = new Date(selectedDate || weekRef);
    const d = new Date(ref);
    d.setDate(d.getDate() + 7);
    setWeekRef(d);
    onDateSelect(d);
  };

  const prevDay = () => {
    const current = new Date(selectedDate || weekRef);
    const d = new Date(current);
    d.setDate(d.getDate() - 1);
    onDateSelect(d);
  };

  const nextDay = () => {
    const current = new Date(selectedDate || weekRef);
    const d = new Date(current);
    d.setDate(d.getDate() + 1);
    onDateSelect(d);
  };

  const goToToday = () => {
    setWeekRef(today);
    onDateSelect(today);
  };

  useEffect(() => {
    if (selectedDate) setWeekRef(selectedDate);
  }, [selectedDate]);

  const selectedStr = formatDateStr(selectedDate || today);
  const todayStr = formatDateStr(today);
  const isToday = selectedStr === todayStr;

  const monthYearLabel = useMemo(() => {
    const d = (weekDates && weekDates.length >= 4) ? weekDates[3] : (weekRef || selectedDate || today);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [weekDates, weekRef, selectedDate, today]);

  return (
    <View style={styles.container}>
      {/* Top Action Row: Prominent Month/Year + Today button */}
      <View style={styles.topRow}>
        <View style={styles.monthHeader}>
          <Text style={styles.monthTitleText}>{monthYearLabel}</Text>
        </View>

        <View style={styles.topActionsRight}>
          {!isToday && (
            <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.7}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Week Strip Navigation with 4 Arrows (Week & Day) */}
      <View style={styles.stripCard}>
        {/* Left Navigation: Week back & Day back */}
        <View style={styles.navGroup}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={prevWeek}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 4 }}
          >
            <Text style={styles.navTextWeek}>«</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={prevDay}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 4, right: 6 }}
          >
            <Text style={styles.navTextDay}>‹</Text>
          </TouchableOpacity>
        </View>

        {/* 7 Days Grid */}
        <View style={styles.daysRow}>
          {weekDates.map((d, i) => {
            const dateStr = formatDateStr(d);
            const isSelected = dateStr === selectedStr;
            const isCurrentDay = dateStr === todayStr;
            const dayData = dataMap[dateStr];
            let dotColor = null;
            if (dayData && dayData.total_calories > 0) {
              dotColor = dayData.total_calories <= dayData.calorie_goal ? '#3fb950' : '#f85149';
            }

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayPill,
                  isSelected && styles.selectedPill,
                  isCurrentDay && !isSelected && styles.todayPill,
                ]}
                onPress={() => onDateSelect(d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayName, isSelected && styles.selectedText]}>{DAY_NAMES[i]}</Text>
                <Text style={[styles.dayNum, isSelected && styles.selectedText]}>{d.getDate()}</Text>
                {dotColor ? (
                  <View style={[styles.dot, { backgroundColor: isSelected ? '#221803' : dotColor }]} />
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right Navigation: Day forward & Week forward */}
        <View style={styles.navGroup}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={nextDay}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 6, right: 4 }}
          >
            <Text style={styles.navTextDay}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={nextWeek}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 4, right: 10 }}
          >
            <Text style={styles.navTextWeek}>»</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  monthTitleText: {
    color: '#F4ECDD',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  monthChevron: {
    color: '#E8A020',
    fontSize: 10,
    marginLeft: 2,
  },
  topActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayBtn: {
    backgroundColor: '#E8A020',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  todayBtnText: {
    color: '#221803',
    fontSize: 11,
    fontWeight: '700',
  },
  stripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1612',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D251C',
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  navBtn: {
    width: 28,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#241E18',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#3A3025',
  },
  navTextWeek: {
    fontSize: 16,
    color: '#E8A020',
    fontWeight: 'bold',
    lineHeight: 18,
  },
  navTextDay: {
    fontSize: 22,
    color: '#F4ECDD',
    fontWeight: 'bold',
    lineHeight: 22,
    marginTop: -2,
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 3,
  },
  dayPill: {
    width: 29,
    paddingVertical: 3,
    alignItems: 'center',
    borderRadius: 7,
    backgroundColor: '#16120D',
    borderWidth: 1,
    borderColor: '#2D251C',
  },
  todayPill: {
    borderColor: '#E8A020',
    backgroundColor: '#251F16',
  },
  selectedPill: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  dayName: {
    fontSize: 8.5,
    color: '#A79A85',
    fontWeight: '500',
    marginBottom: 1,
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F4ECDD',
  },
  selectedText: {
    color: '#221803',
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    marginTop: 2,
  },
  dotPlaceholder: {
    height: 3.5,
    marginTop: 2,
  },
});
