import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function CalendarGrid({
  year,
  month,
  calendarData,
  calendarGoal = 2000,
  selectedDateStr,
  onSelectDate,
  onChangeMonth,
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  // Get index of first day of month (0 = Mon, 6 = Sun)
  const jsFirstDay = new Date(year, month - 1, 1).getDay();
  const firstDayIndex = (jsFirstDay + 6) % 7;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
    const isToday = todayStr === dateStr;

    const totalCals = dayData?.total_calories || 0;
    const goal = dayData?.calorie_goal || calendarGoal || 2000;

    let calColor = null;
    let cellBg = 'transparent';

    if (dayData && totalCals > 0) {
      const pct = totalCals / goal;
      if (pct > 1) {
        calColor = '#f85149'; // Over goal (red)
        cellBg = 'rgba(248, 81, 73, 0.14)';
      } else if (pct > 0.7) {
        calColor = '#3fb950'; // On target / good (green)
        cellBg = 'rgba(63, 185, 80, 0.16)';
      } else {
        calColor = '#E8A020'; // Light / under (amber)
        cellBg = 'rgba(232, 160, 32, 0.12)';
      }
    }

    cells.push(
      <TouchableOpacity
        key={dateStr}
        style={[
          styles.dayCell,
          cellBg !== 'transparent' && !isSelected && { backgroundColor: cellBg },
          isToday && !isSelected && styles.todayCell,
          isSelected && styles.selectedCell,
        ]}
        onPress={() => onSelectDate(new Date(year, month - 1, day))}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.dayNum,
            isToday && styles.todayDayNum,
            isSelected && styles.selectedDayNum,
          ]}
        >
          {day}
        </Text>
        {totalCals > 0 ? (
          <Text
            style={[
              styles.calNum,
              { color: isSelected ? '#E8A020' : calColor },
            ]}
            numberOfLines={1}
          >
            {totalCals}
          </Text>
        ) : (
          <Text style={styles.calPlaceholder}> </Text>
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
          <View style={[styles.legendDot, { backgroundColor: '#3fb950' }]} />
          <Text style={styles.legendText}>On Target</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E8A020' }]} />
          <Text style={styles.legendText}>Under</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f85149' }]} />
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
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 8,
    paddingVertical: 2,
  },
  emptyCell: {
    width: '14.28%',
    height: 48,
  },
  todayCell: {
    borderWidth: 1,
    borderColor: '#E8A020',
  },
  todayDayNum: {
    color: '#E8A020',
    fontWeight: 'bold',
  },
  selectedCell: {
    backgroundColor: '#3A3128',
    borderWidth: 1.5,
    borderColor: '#E8A020',
  },
  dayNum: {
    fontSize: 13,
    color: '#F4ECDD',
    fontWeight: '500',
  },
  selectedDayNum: {
    fontWeight: 'bold',
    color: '#E8A020',
  },
  calNum: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    lineHeight: 12,
  },
  calPlaceholder: {
    fontSize: 10,
    marginTop: 1,
    lineHeight: 12,
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
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#A79A85',
  },
});
