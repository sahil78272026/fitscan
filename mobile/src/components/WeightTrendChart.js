import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';

export default function WeightTrendChart({ logs = [], currentTimeframe = 30, onTimeframeChange }) {
  if (!logs || logs.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>📈 Weight Trend</Text>
          <View style={styles.timeframeRow}>
            {[7, 30, 90].map((days) => (
              <TouchableOpacity
                key={days}
                style={[styles.tfBtn, currentTimeframe === days && styles.tfBtnActive]}
                onPress={() => onTimeframeChange(days)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tfText, currentTimeframe === days && styles.tfTextActive]}>
                  {days}D
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>⚖️</Text>
          <Text style={styles.emptyTitle}>No weight entries logged yet</Text>
          <Text style={styles.emptySub}>Log your weight below to view your trend chart</Text>
        </View>
      </View>
    );
  }

  const weights = logs.map((l) => l.weight_kg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightRange = maxWeight === minWeight ? 1 : maxWeight - minWeight;

  return (
    <View style={styles.card}>
      {/* Header & Timeframe Filters */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>📈 Weight Trend</Text>
          <Text style={styles.subtitle}>
            Min: {minWeight}kg • Max: {maxWeight}kg
          </Text>
        </View>

        <View style={styles.timeframeRow}>
          {[7, 30, 90].map((days) => (
            <TouchableOpacity
              key={days}
              style={[styles.tfBtn, currentTimeframe === days && styles.tfBtnActive]}
              onPress={() => onTimeframeChange(days)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tfText, currentTimeframe === days && styles.tfTextActive]}>
                {days}D
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Visual Bar Trend Chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
        {logs.map((item, idx) => {
          // Normalize height between 25% and 100%
          const pct = Math.max(25, Math.round(((item.weight_kg - minWeight) / weightRange) * 75 + 25));
          const isMin = item.weight_kg === minWeight && logs.length > 1;
          const isMax = item.weight_kg === maxWeight && logs.length > 1;
          const isLatest = idx === logs.length - 1;

          // Format date for bar label (e.g. "09/15")
          const dateParts = item.logged_date.split('-');
          const shortDate = `${dateParts[1]}/${dateParts[2]}`;

          return (
            <View key={item.id || idx} style={styles.barCol}>
              {/* Weight Tooltip Badge */}
              <Text style={[styles.weightBadge, isMin && styles.minText, isMax && styles.maxText, isLatest && styles.latestText]}>
                {item.weight_kg}
              </Text>

              {/* Bar Fill */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${pct}%` },
                    isMin && styles.barMin,
                    isMax && styles.barMax,
                    isLatest && !isMin && !isMax && styles.barLatest,
                  ]}
                />
              </View>

              {/* Date Label */}
              <Text style={styles.dateLabel}>{shortDate}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#221D17',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  subtitle: {
    fontSize: 11,
    color: '#A79A85',
    marginTop: 2,
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tfBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#181410',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  tfBtnActive: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  tfText: {
    fontSize: 12,
    color: '#A79A85',
    fontWeight: '600',
  },
  tfTextActive: {
    color: '#221803',
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  emptySub: {
    fontSize: 12,
    color: '#A79A85',
    marginTop: 4,
  },
  chartScroll: {
    paddingVertical: 8,
    gap: 14,
    alignItems: 'flex-end',
  },
  barCol: {
    alignItems: 'center',
    width: 44,
  },
  weightBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 6,
  },
  barTrack: {
    width: 14,
    height: 100,
    backgroundColor: '#181410',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#E8A020',
    borderRadius: 7,
  },
  barMin: {
    backgroundColor: '#3fb950',
  },
  barMax: {
    backgroundColor: '#f85149',
  },
  barLatest: {
    backgroundColor: '#58a6ff',
  },
  minText: {
    color: '#3fb950',
  },
  maxText: {
    color: '#f85149',
  },
  latestText: {
    color: '#58a6ff',
  },
  dateLabel: {
    fontSize: 10,
    color: '#A79A85',
    marginTop: 6,
  },
});
