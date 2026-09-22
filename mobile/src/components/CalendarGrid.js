import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function CalendarGrid({
  year,
  month,
  calendarData,
  selectedDateStr,
  onSelectDate,
  onChangeMonth,
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  // Get index of first day of month (0 = Mon, 6 = Sun)
  const jsFirstDay = new Date(year, month - 1, 1).getDay();
  const firstDayIndex = (jsFirstDay + 6) % 7;

  const dayMap = {};
  if (calendarData?.days) {
    calendarData.days.forEach((d) => {
      dayMap[d.date] = d;
    });
  }

  const prevMonth = () => {
    if (month === 1) onChangeMonth(year - 1, 12);
    else onChangeMonth(year, month - 1);
  };

  const nextMonth = () => {
    if (month === 12) onChangeMonth(year + 1, 1);
    else onChangeMonth(year, month + 1);
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(<View key={`empty-${i}`} style={styles.emptyCell} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = dayMap[dateStr];
    const isSelected = selectedDateStr === dateStr;

    let dotColor = null;
    if (dayData && dayData.total_calories > 0) {
      dotColor = dayData.total_calories <= dayData.calorie_goal ? '#3fb950' : '#f85149';
    }

    cells.push(
      <TouchableOpacity
        key={dateStr}
        style={[styles.dayCell, isSelected && styles.selectedCell]}
        onPress={() => onSelectDate(new Date(year, month - 1, day))}
        activeOpacity={0.7}
      >
        <Text style={[styles.dayNum, isSelected && styles.selectedDayNum]}>{day}</Text>
        {dotColor ? (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        ) : (
          <View style={styles.dotPlaceholder} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header Month Switcher */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{monthName} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekRow}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => (
          <Text key={w} style={styles.weekHead}>{w}</Text>
        ))}
      </View>

      {/* Calendar Days Grid */}
      <View style={styles.grid}>{cells}</View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#3fb950' }]} />
          <Text style={styles.legendText}>Under Goal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#f85149' }]} />
          <Text style={styles.legendText}>Over Goal</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#221D17',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#181410',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  navText: {
    fontSize: 20,
    color: '#F4ECDD',
    fontWeight: 'bold',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekHead: {
    fontSize: 12,
    color: '#A79A85',
    width: 36,
    textAlign: 'center',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 42,
    alignItems: 'center',
    justify: 'center',
    marginVertical: 2,
    borderRadius: 8,
  },
  emptyCell: {
    width: '14.28%',
    height: 42,
  },
  selectedCell: {
    backgroundColor: '#3A3128',
    borderWidth: 1,
    borderColor: '#E8A020',
  },
  dayNum: {
    fontSize: 14,
    color: '#F4ECDD',
  },
  selectedDayNum: {
    fontWeight: 'bold',
    color: '#E8A020',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  dotPlaceholder: {
    height: 6,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2D261F',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#A79A85',
  },
});
