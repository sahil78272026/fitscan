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

export default function DateStrip({ selectedDate, onDateSelect, calendarData, onToggleCalendar, calendarOpen }) {
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
    const d = new Date(weekRef);
    d.setDate(d.getDate() - 7);
    setWeekRef(d);
  };

  const nextWeek = () => {
    const d = new Date(weekRef);
    d.setDate(d.getDate() + 7);
    setWeekRef(d);
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

  return (
    <View style={styles.container}>
      {/* Top Action Row: Today Button & Month Calendar Toggle */}
      <View style={styles.topRow}>
        {!isToday ? (
          <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.7}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}

        <TouchableOpacity
          style={[styles.calBtn, calendarOpen && styles.calBtnActive]}
          onPress={onToggleCalendar}
          activeOpacity={0.7}
        >
          <Text style={[styles.calBtnText, calendarOpen && styles.calBtnTextActive]}>
            📅 {calendarOpen ? 'Hide Grid' : 'Month View'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Week Strip Navigation */}
      <View style={styles.stripRow}>
        <TouchableOpacity style={styles.navBtn} onPress={prevWeek} activeOpacity={0.7}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>

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

        <TouchableOpacity style={styles.navBtn} onPress={nextWeek} activeOpacity={0.7}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  todayBtn: {
    backgroundColor: '#E8A020',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  todayBtnText: {
    color: '#221803',
    fontSize: 12,
    fontWeight: 'bold',
  },
  calBtn: {
    backgroundColor: '#221D17',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  calBtnActive: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  calBtnText: {
    color: '#F4ECDD',
    fontSize: 12,
    fontWeight: '600',
  },
  calBtnTextActive: {
    color: '#221803',
    fontWeight: 'bold',
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBtn: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  navText: {
    fontSize: 22,
    color: '#F4ECDD',
    fontWeight: 'bold',
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayPill: {
    width: 40,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#221D17',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  todayPill: {
    borderColor: '#E8A020',
  },
  selectedPill: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  dayName: {
    fontSize: 10,
    color: '#A79A85',
    marginBottom: 2,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  selectedText: {
    color: '#221803',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
  },
  dotPlaceholder: {
    height: 5,
    marginTop: 3,
  },
});
