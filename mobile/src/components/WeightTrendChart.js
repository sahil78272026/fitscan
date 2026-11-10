import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Animated,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
  Line,
  Text as SvgText,
} from 'react-native-svg';
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
          <View style={styles.titleCol}>
            <Text style={styles.title}>Weight & Body Trend</Text>
            <Text style={styles.subtitle}>Track your body composition changes</Text>
          </View>
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

        {/* Clean SVG Empty State - Zero Emojis */}
        <View style={styles.emptyContainer}>
          <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 17l6-6 4 4 8-8"
              stroke={colors.primary || '#F59E0B'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M17 7h4v4"
              stroke={colors.primary || '#F59E0B'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={3} cy={17} r={1.5} fill={colors.primary || '#F59E0B'} />
            <Circle cx={9} cy={11} r={1.5} fill={colors.primary || '#F59E0B'} />
            <Circle cx={13} cy={15} r={1.5} fill={colors.primary || '#F59E0B'} />
            <Circle cx={21} cy={7} r={1.5} fill={colors.primary || '#F59E0B'} />
          </Svg>
          <Text style={styles.emptyTitle}>No weight entries logged yet</Text>
          <Text style={styles.emptySub}>
            Log your current weight below to start plotting your trend line
          </Text>
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

  // SVG Chart Geometry
  const chartHeight = 170;
  const paddingTop = 26;
  const paddingBottom = 32;
  const paddingLeft = 32;
  const paddingRight = 32;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const pointSpacing = Math.max(
    56,
    Math.floor((windowWidth - 72) / Math.max(validLogs.length, 1))
  );
  const totalChartWidth = Math.max(
    windowWidth - 64,
    (validLogs.length - 1) * pointSpacing + paddingLeft + paddingRight
  );

  const rawRange = maxWeight - minWeight;
  const yPadding = rawRange === 0 ? 1.0 : Math.max(0.5, rawRange * 0.15);
  const minY = minWeight - yPadding;
  const maxY = maxWeight + yPadding;
  const effectiveRange = maxY - minY;

  const points = validLogs.map((item, idx) => {
    const x =
      validLogs.length === 1
        ? totalChartWidth / 2
        : paddingLeft + idx * pointSpacing;
    const y =
      chartHeight -
      paddingBottom -
      ((item.weight_kg - minY) / effectiveRange) * usableHeight;
    return { ...item, x, y, idx };
  });

  // Smooth SVG Path Generation (Monotone cubic spline or line)
  let pathD = '';
  let areaD = '';

  if (points.length === 1) {
    pathD = `M ${points[0].x - 18} ${points[0].y} L ${points[0].x + 18} ${points[0].y}`;
    areaD = `M ${points[0].x - 18} ${chartHeight - paddingBottom} L ${points[0].x - 18} ${points[0].y} L ${points[0].x + 18} ${points[0].y} L ${points[0].x + 18} ${chartHeight - paddingBottom} Z`;
  } else {
    // Build path with clean line segments
    pathD = points.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );
    const lastP = points[points.length - 1];
    const firstP = points[0];
    areaD = `${pathD} L ${lastP.x} ${chartHeight - paddingBottom} L ${firstP.x} ${chartHeight - paddingBottom} Z`;
  }

  const activePoint =
    selectedIdx !== null && points[selectedIdx]
      ? points[selectedIdx]
      : points[points.length - 1];

  const deltaFromStart = activePoint
    ? Number((activePoint.weight_kg - firstWeight).toFixed(1))
    : 0;
  const deltaFromStartStr =
    deltaFromStart > 0 ? `+${deltaFromStart}` : `${deltaFromStart}`;

  // Target weight Y coordinate
  const targetY =
    typeof targetWeight === 'number' && targetWeight >= minY && targetWeight <= maxY
      ? chartHeight - paddingBottom - ((targetWeight - minY) / effectiveRange) * usableHeight
      : null;

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>Weight & Body Trend</Text>
          <View style={styles.summaryBadgeRow}>
            <View style={[styles.pill, styles.minPill]}>
              <Text style={styles.minPillText}>Min {minWeight.toFixed(1)}kg</Text>
            </View>
            <View style={[styles.pill, styles.maxPill]}>
              <Text style={styles.maxPillText}>Max {maxWeight.toFixed(1)}kg</Text>
            </View>
            <View
              style={[
                styles.pill,
                netDeltaNum <= 0 ? styles.lossPill : styles.gainPill,
              ]}
            >
              <Text style={netDeltaNum <= 0 ? styles.lossText : styles.gainText}>
                {netDeltaStr} kg
              </Text>
            </View>
          </View>
        </View>

        {/* Timeframe Selector Buttons */}
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
        <Animated.View
          style={[styles.tooltipBox, { transform: [{ scale: tooltipScale }] }]}
        >
          <View style={styles.tooltipLeft}>
            <Text style={styles.tooltipDate}>{activePoint.logged_date}</Text>
            <Text style={styles.tooltipVal}>{activePoint.weight_kg.toFixed(1)} kg</Text>
          </View>
          <View style={styles.tooltipRight}>
            <View style={styles.badgeWrapper}>
              <Text style={styles.tooltipTag}>
                {activePoint.weight_kg === minWeight && points.length > 1
                  ? 'Lowest'
                  : activePoint.weight_kg === maxWeight && points.length > 1
                  ? 'Peak'
                  : activePoint.idx === points.length - 1
                  ? 'Current'
                  : 'Entry'}
              </Text>
            </View>
            {points.length > 1 && (
              <Text
                style={[
                  styles.tooltipDelta,
                  deltaFromStart <= 0 ? styles.lossText : styles.gainText,
                ]}
              >
                {deltaFromStartStr} kg
              </Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Modern Luxury SVG Graph */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: totalChartWidth, height: chartHeight + 12 }}
      >
        <View style={[styles.chartContainer, { width: totalChartWidth, height: chartHeight }]}>
          <Svg
            width={totalChartWidth}
            height={chartHeight}
            viewBox={`0 0 ${totalChartWidth} ${chartHeight}`}
          >
            <Defs>
              <LinearGradient id="weightGradientMobile" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.45" />
                <Stop offset="75%" stopColor="#F59E0B" stopOpacity="0.08" />
                <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Baseline Grid Line */}
            <Line
              x1={16}
              y1={chartHeight - paddingBottom}
              x2={totalChartWidth - 16}
              y2={chartHeight - paddingBottom}
              stroke={colors.border || '#222631'}
              strokeWidth={1}
            />

            {/* Optional Target Weight Reference Line */}
            {targetY !== null && (
              <>
                <Line
                  x1={16}
                  y1={targetY}
                  x2={totalChartWidth - 16}
                  y2={targetY}
                  stroke="#10B981"
                  strokeWidth={1}
                  strokeDasharray="4, 4"
                />
                <SvgText
                  x={totalChartWidth - 20}
                  y={targetY - 5}
                  fontSize={9}
                  fill="#10B981"
                  fontWeight="600"
                  textAnchor="end"
                >
                  Target {targetWeight}kg
                </SvgText>
              </>
            )}

            {/* Area Fill */}
            <Path d={areaD} fill="url(#weightGradientMobile)" />

            {/* Stroke Line */}
            <Path
              d={pathD}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Min / Max Reference Y-Labels */}
            <SvgText
              x={paddingLeft}
              y={paddingTop - 10}
              fontSize={10}
              fill={colors.textSecondary || '#94A3B8'}
              fontWeight="600"
            >
              {maxY.toFixed(1)} kg
            </SvgText>
            <SvgText
              x={paddingLeft}
              y={chartHeight - paddingBottom + 16}
              fontSize={10}
              fill={colors.textSecondary || '#94A3B8'}
              fontWeight="600"
            >
              {minY.toFixed(1)} kg
            </SvgText>

            {/* Data Point SVG Circles */}
            {points.map((p) => {
              const isSelected = activePoint && activePoint.idx === p.idx;
              const isMin = p.weight_kg === minWeight && points.length > 1;
              const isMax = p.weight_kg === maxWeight && points.length > 1;

              const circleStroke = isMin ? '#10B981' : isMax ? '#F43F5E' : '#F59E0B';
              const circleFill = isSelected ? '#FFFFFF' : colors.surface || '#111318';

              return (
                <React.Fragment key={`svg-node-${p.id || p.idx}`}>
                  {/* Subtle outer halo for selected point */}
                  {isSelected && (
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={10}
                      fill="rgba(245, 158, 11, 0.25)"
                      stroke="rgba(245, 158, 11, 0.6)"
                      strokeWidth={1.5}
                    />
                  )}
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 6 : 4.5}
                    fill={circleFill}
                    stroke={circleStroke}
                    strokeWidth={isSelected ? 2.5 : 2}
                  />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Interactive Touch Overlay Nodes */}
          {points.map((p) => {
            const dateParts = p.logged_date ? p.logged_date.split('-') : [];
            const shortDate =
              dateParts.length >= 3 ? `${dateParts[1]}/${dateParts[2]}` : p.logged_date;
            const isSelected = activePoint && activePoint.idx === p.idx;

            return (
              <React.Fragment key={`touch-${p.id || p.idx}`}>
                <TouchableOpacity
                  style={[
                    styles.nodeTouchTarget,
                    {
                      left: p.x - 22,
                      top: p.y - 22,
                    },
                  ]}
                  onPress={() => handleSelectNode(p.idx)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                />
                {/* Responsive Date Axis Label */}
                <Text
                  style={[
                    styles.dateLabel,
                    {
                      left: p.x - 24,
                      top: chartHeight - 20,
                    },
                    isSelected && styles.dateLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {shortDate}
                </Text>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface || '#111318',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
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
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 2,
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  minPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  minPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  maxPill: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  maxPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F43F5E',
  },
  lossPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  gainPill: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  lossText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  gainText: {
    color: '#F43F5E',
    fontSize: 11,
    fontWeight: '700',
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tfBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  tfBtnActive: {
    backgroundColor: colors.primary || '#F59E0B',
    borderColor: colors.primary || '#F59E0B',
  },
  tfText: {
    fontSize: 12,
    color: colors.textSecondary || '#94A3B8',
    fontWeight: '600',
  },
  tfTextActive: {
    color: '#08090C',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  tooltipBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    marginBottom: 10,
  },
  tooltipLeft: {
    flexDirection: 'column',
  },
  tooltipDate: {
    fontSize: 11,
    color: colors.textSecondary || '#94A3B8',
    fontWeight: '500',
  },
  tooltipVal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  tooltipRight: {
    alignItems: 'flex-end',
  },
  badgeWrapper: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tooltipTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary || '#F8FAFC',
  },
  tooltipDelta: {
    fontSize: 11,
    marginTop: 3,
  },
  chartContainer: {
    position: 'relative',
    marginTop: 4,
  },
  nodeTouchTarget: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 5,
  },
  dateLabel: {
    position: 'absolute',
    width: 48,
    textAlign: 'center',
    fontSize: 10,
    color: colors.textSecondary || '#94A3B8',
    zIndex: 4,
  },
  dateLabelActive: {
    color: colors.textPrimary || '#F8FAFC',
    fontWeight: '700',
  },
});
