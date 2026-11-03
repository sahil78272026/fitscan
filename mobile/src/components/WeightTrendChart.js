import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { colors } from '../theme';

export default function WeightTrendChart({
  logs = [],
  currentTimeframe = 30,
  onTimeframeChange,
  targetWeight = null,
}) {
  const { width: windowWidth } = useWindowDimensions();

  // Filter and sort logs ascending by date
  const validLogs = useMemo(() => {
    return (logs || [])
      .filter((l) => typeof l?.weight_kg === 'number' && l.weight_kg >= 25 && l.weight_kg <= 300)
      .sort((a, b) => (a.logged_date > b.logged_date ? 1 : -1));
  }, [logs]);

  const [selectedIdx, setSelectedIdx] = useState(null);
  const tooltipScale = useRef(new Animated.Value(1)).current;

  const handleSelectNode = (idx) => {
    setSelectedIdx(idx);
    tooltipScale.setValue(0.92);
    Animated.spring(tooltipScale, {
      toValue: 1,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };


  if (!validLogs || validLogs.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Weight Trend & Trajectory</Text>
          <View style={styles.timeframeRow}>
            {[7, 30, 90].map((days) => (
              <TouchableOpacity
                key={days}
                style={[styles.tfBtn, currentTimeframe === days && styles.tfBtnActive]}
                onPress={() => onTimeframeChange && onTimeframeChange(days)}
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
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyTitle}>No weight entries logged yet</Text>
          <Text style={styles.emptySub}>Log your weight below to view your interactive curve</Text>
        </View>
      </View>
    );
  }

  const weights = validLogs.map((l) => l.weight_kg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const firstWeight = validLogs[0].weight_kg;
  const latestWeight = validLogs[validLogs.length - 1].weight_kg;
  const netDeltaNum = Number((latestWeight - firstWeight).toFixed(1));
  const netDeltaStr = netDeltaNum > 0 ? `+${netDeltaNum}` : `${netDeltaNum}`;

  // Layout Geometry
  const chartHeight = 180;
  const paddingVertical = 30;
  const usableHeight = chartHeight - paddingVertical * 2;
  const pointSpacing = Math.max(54, Math.floor((windowWidth - 72) / Math.max(validLogs.length, 1)));
  const totalChartWidth = Math.max(windowWidth - 64, (validLogs.length - 1) * pointSpacing + 64);

  const yRange = maxWeight === minWeight ? 2 : maxWeight - minWeight;
  const minY = minWeight - yRange * 0.15;
  const maxY = maxWeight + yRange * 0.15;
  const effectiveRange = maxY - minY;

  const points = validLogs.map((item, idx) => {
    const x = 32 + idx * pointSpacing;
    const y = chartHeight - paddingVertical - ((item.weight_kg - minY) / effectiveRange) * usableHeight;
    return { ...item, x, y, idx };
  });

  const activePoint = selectedIdx !== null && points[selectedIdx] ? points[selectedIdx] : points[points.length - 1];
  const deltaFromStart = activePoint ? Number((activePoint.weight_kg - firstWeight).toFixed(1)) : 0;
  const deltaFromStartStr = deltaFromStart > 0 ? `+${deltaFromStart}` : `${deltaFromStart}`;

  return (
    <View style={styles.card}>
      {/* Header & Badges */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>Weight Trend & Trajectory</Text>
          <View style={styles.summaryBadgeRow}>
            <View style={[styles.pill, styles.minPill]}>
              <Text style={styles.minPillText}>Min {minWeight}kg</Text>
            </View>
            <View style={[styles.pill, styles.maxPill]}>
              <Text style={styles.maxPillText}>Max {maxWeight}kg</Text>
            </View>
            <View style={[styles.pill, netDeltaNum <= 0 ? styles.lossPill : styles.gainPill]}>
              <Text style={netDeltaNum <= 0 ? styles.lossText : styles.gainText}>
                {netDeltaStr} kg
              </Text>
            </View>
          </View>
        </View>

        {/* Timeframe Buttons */}
        <View style={styles.timeframeRow}>
          {[7, 30, 90].map((days) => (
            <TouchableOpacity
              key={days}
              style={[styles.tfBtn, currentTimeframe === days && styles.tfBtnActive]}
              onPress={() => {
                setSelectedIdx(null);
                if (onTimeframeChange) onTimeframeChange(days);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tfText, currentTimeframe === days && styles.tfTextActive]}>
                {days}D
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Floating Active Tooltip Callout */}
      {activePoint && (
        <Animated.View style={[styles.tooltipBox, { transform: [{ scale: tooltipScale }] }]}>
          <View style={styles.tooltipLeft}>
            <Text style={styles.tooltipDate}>{activePoint.logged_date}</Text>
            <Text style={styles.tooltipVal}>{activePoint.weight_kg} kg</Text>
          </View>
          <View style={styles.tooltipRight}>
            <View style={styles.badgeWrapper}>
              <Text style={styles.tooltipTag}>
                {activePoint.weight_kg === minWeight && points.length > 1
                  ? '🟢 Lowest'
                  : activePoint.weight_kg === maxWeight && points.length > 1
                  ? '🔴 Peak'
                  : activePoint.idx === points.length - 1
                  ? '🟡 Current'
                  : 'Entry'}
              </Text>
            </View>
            {points.length > 1 && (
              <Text style={[styles.tooltipDelta, deltaFromStart <= 0 ? styles.lossText : styles.gainText]}>
                {deltaFromStart <= 0 ? '📉' : '📈'} {deltaFromStartStr} kg
              </Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Interactive Trend Chart Canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: totalChartWidth, height: chartHeight + 28 }}
      >
        <View style={[styles.chartCanvas, { width: totalChartWidth, height: chartHeight }]}>
          {/* Target Reference Line */}
          {typeof targetWeight === 'number' && targetWeight >= minY && targetWeight <= maxY && (
            <View
              style={[
                styles.targetLine,
                {
                  top: chartHeight - paddingVertical - ((targetWeight - minY) / effectiveRange) * usableHeight,
                  width: totalChartWidth,
                },
              ]}
            >
              <Text style={styles.targetLabel}>Target {targetWeight} kg</Text>
            </View>
          )}

          {/* Baseline Grid Line */}
          <View style={[styles.gridLine, { top: chartHeight - paddingVertical, width: totalChartWidth }]} />

          {/* Connected Vector Line Segments & Glow Area Columns */}
          {points.map((p, i) => {
            if (i === points.length - 1) return null;
            const next = points[i + 1];
            const dx = next.x - p.x;
            const dy = next.y - p.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const midX = (p.x + next.x) / 2;
            const midY = (p.y + next.y) / 2;

            return (
              <React.Fragment key={`segment-${i}`}>
                {/* Glowing area under data point */}
                <View
                  style={[
                    styles.glowColumn,
                    {
                      left: p.x - 14,
                      top: p.y,
                      height: Math.max(4, chartHeight - paddingVertical - p.y),
                      width: 28,
                    },
                  ]}
                />
                {/* Anti-aliased connected vector trend line */}
                <View
                  style={[
                    styles.vectorLine,
                    {
                      width: length,
                      left: midX - length / 2,
                      top: midY - 1.5,
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              </React.Fragment>
            );
          })}

          {/* Glow area for the last data point */}
          {points.length > 0 && (
            <View
              style={[
                styles.glowColumn,
                {
                  left: points[points.length - 1].x - 14,
                  top: points[points.length - 1].y,
                  height: Math.max(4, chartHeight - paddingVertical - points[points.length - 1].y),
                  width: 28,
                },
              ]}
            />
          )}

          {/* Interactive Data Nodes with glowing halos */}
          {points.map((p) => {
            const isMin = p.weight_kg === minWeight && points.length > 1;
            const isMax = p.weight_kg === maxWeight && points.length > 1;
            const isSelected = activePoint && activePoint.idx === p.idx;

            return (
              <TouchableOpacity
                key={`node-${p.id || p.idx}`}
                style={[
                  styles.nodeTouch,
                  { left: p.x - 18, top: p.y - 18 },
                ]}
                onPress={() => handleSelectNode(p.idx)}
                activeOpacity={0.8}
              >
                {isSelected && <View style={styles.nodeOuterHalo} />}
                <View
                  style={[
                    styles.nodeOuter,
                    isMin && styles.nodeOuterMin,
                    isMax && styles.nodeOuterMax,
                    isSelected && styles.nodeOuterSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.nodeInner,
                      isMin && styles.nodeInnerMin,
                      isMax && styles.nodeInnerMax,
                      isSelected && styles.nodeInnerSelected,
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Responsive Date Axis Labels */}
          {points.map((p) => {
            const dateParts = p.logged_date ? p.logged_date.split('-') : [];
            const shortDate = dateParts.length >= 3 ? `${dateParts[1]}/${dateParts[2]}` : p.logged_date;
            const isSelected = activePoint && activePoint.idx === p.idx;

            return (
              <Text
                key={`label-${p.idx}`}
                style={[
                  styles.dateLabel,
                  { left: p.x - 18, top: chartHeight - 18 },
                  isSelected && styles.dateLabelActive,
                ]}
              >
                {shortDate}
              </Text>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface || '#221D17',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleCol: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary || '#F4ECDD',
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  minPill: {
    backgroundColor: 'rgba(123, 160, 91, 0.15)',
    borderColor: '#7BA05B',
  },
  minPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7BA05B',
  },
  maxPill: {
    backgroundColor: 'rgba(229, 116, 83, 0.15)',
    borderColor: '#E57453',
  },
  maxPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E57453',
  },
  lossPill: {
    backgroundColor: 'rgba(123, 160, 91, 0.15)',
    borderColor: '#7BA05B',
  },
  gainPill: {
    backgroundColor: 'rgba(229, 116, 83, 0.15)',
    borderColor: '#E57453',
  },
  lossText: {
    color: '#7BA05B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  gainText: {
    color: '#E57453',
    fontSize: 11,
    fontWeight: 'bold',
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tfBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.background || '#181410',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
  },
  tfBtnActive: {
    backgroundColor: colors.primary || '#E8A020',
    borderColor: colors.primary || '#E8A020',
  },
  tfText: {
    fontSize: 12,
    color: colors.textSecondary || '#A79A85',
    fontWeight: '600',
  },
  tfTextActive: {
    color: '#221803',
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary || '#F4ECDD',
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary || '#A79A85',
    marginTop: 4,
  },
  tooltipBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background || '#181410',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    marginBottom: 10,
  },
  tooltipLeft: {
    flexDirection: 'column',
  },
  tooltipDate: {
    fontSize: 11,
    color: colors.textSecondary || '#A79A85',
    fontWeight: '500',
  },
  tooltipVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary || '#E8A020',
    marginTop: 2,
  },
  tooltipRight: {
    alignItems: 'flex-end',
  },
  badgeWrapper: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tooltipTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
  },
  tooltipDelta: {
    fontSize: 11,
    marginTop: 3,
  },
  chartCanvas: {
    position: 'relative',
    marginTop: 4,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    borderTopWidth: 1,
    borderTopColor: '#7BA05B',
    borderStyle: 'dashed',
    justifyContent: 'center',
    zIndex: 1,
  },
  targetLabel: {
    position: 'absolute',
    right: 8,
    top: -14,
    fontSize: 10,
    color: '#7BA05B',
    fontWeight: '600',
    backgroundColor: colors.surface || '#221D17',
    paddingHorizontal: 4,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: colors.border || '#3A3128',
    zIndex: 1,
  },
  glowColumn: {
    position: 'absolute',
    backgroundColor: 'rgba(232, 160, 32, 0.10)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    zIndex: 2,
  },
  vectorLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: colors.primary || '#E8A020',
    borderRadius: 1.5,
    zIndex: 3,
  },
  nodeTouch: {
    position: 'absolute',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  nodeOuterHalo: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(232, 160, 32, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(232, 160, 32, 0.50)',
    zIndex: 1,
  },
  nodeOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surface || '#221D17',
    borderWidth: 2,
    borderColor: colors.primary || '#E8A020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeOuterMin: {
    borderColor: '#7BA05B',
  },
  nodeOuterMax: {
    borderColor: '#E57453',
  },
  nodeOuterSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.primary || '#E8A020',
    backgroundColor: 'rgba(232, 160, 32, 0.25)',
  },
  nodeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary || '#E8A020',
  },
  nodeInnerMin: {
    backgroundColor: '#7BA05B',
  },
  nodeInnerMax: {
    backgroundColor: '#E57453',
  },
  nodeInnerSelected: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  dateLabel: {
    position: 'absolute',
    width: 36,
    textAlign: 'center',
    fontSize: 10,
    color: colors.textSecondary || '#A79A85',
    zIndex: 3,
  },
  dateLabelActive: {
    color: colors.textPrimary || '#F4ECDD',
    fontWeight: 'bold',
  },
});
