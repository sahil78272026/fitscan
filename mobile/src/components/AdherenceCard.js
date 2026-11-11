import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

function FlameIcon({ size = 20, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C10.5 4.5 8 7 8 11a4 4 0 008 0c0-2-1-3.5-2-4.5.5 2.5-1 3.5-2 3.5s-1.5-1-1-2.5c.5-1.5 1-3.5-1-5.5z"
        fill={color}
      />
      <Path
        d="M12 22c-4.4 0-8-3.6-8-8 0-4.1 3.1-7.4 7-7.9-.6 1-.9 2.4-.9 3.9 0 2.2 1.8 4 4 4 .5 0 1-.1 1.5-.3 1.5 2.5 1.1 5.9-1.1 7.2A7.95 7.95 0 0112 22z"
        fill={color}
        opacity={0.8}
      />
    </Svg>
  );
}

function ZapIcon({ size = 18, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  );
}

function TargetIcon({ size = 18, color = '#7BA05B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="12" r="6" />
      <Circle cx="12" cy="12" r="2" />
    </Svg>
  );
}

function TrophyIcon({ size = 18, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
      <Path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
      <Path d="M4 22h16" />
      <Path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34" />
      <Path d="M6 4h12v5c0 3.31-2.69 6-6 6s-6-2.69-6-6V4z" />
    </Svg>
  );
}

function renderBadgeIcon(badge) {
  const color = badge.unlocked ? '#E8A020' : '#6B7280';
  if (badge.id === 'streak_3' || (typeof badge.icon === 'string' && badge.icon.includes('\uD83D\uDD25'))) {
    return <FlameIcon size={18} color={color} />;
  }
  if (badge.id === 'streak_7' || (typeof badge.icon === 'string' && badge.icon.includes('\u26A1'))) {
    return <ZapIcon size={18} color={color} />;
  }
  if (badge.id === 'macro_master' || (typeof badge.icon === 'string' && badge.icon.includes('\uD83C\uDFAF'))) {
    return <TargetIcon size={18} color={badge.unlocked ? '#7BA05B' : '#6B7280'} />;
  }
  return <TrophyIcon size={18} color={color} />;
}

export default function AdherenceCard({ stats }) {
  const {
    current_streak = 0,
    weekly_adherence_score = 0,
    seven_day_grid = [
      { day_name: 'Mon', status: 'no_log', date: '1' },
      { day_name: 'Tue', status: 'no_log', date: '2' },
      { day_name: 'Wed', status: 'no_log', date: '3' },
      { day_name: 'Thu', status: 'no_log', date: '4' },
      { day_name: 'Fri', status: 'no_log', date: '5' },
      { day_name: 'Sat', status: 'no_log', date: '6' },
      { day_name: 'Sun', status: 'no_log', date: '7' },
    ],
    badges = [],
  } = stats || {};

  const getStatusSymbol = (status) => {
    switch (status) {
      case 'on_target':
        return '✓';
      case 'close':
        return '∼';
      case 'off_target':
        return '!';
      default:
        return '–';
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'on_target':
        return styles.statusOnTarget;
      case 'close':
        return styles.statusClose;
      case 'off_target':
        return styles.statusOffTarget;
      default:
        return styles.statusNoLog;
    }
  };

  return (
    <View style={styles.card}>
      {/* Top Row: Streak & Adherence Score */}
      <View style={styles.topRow}>
        {/* Streak Pill */}
        <View style={styles.streakBadge}>
          <FlameIcon size={20} color="#E8A020" />
          <View>
            <Text style={styles.streakNumber}>{current_streak} Day Streak</Text>
            <Text style={styles.streakSub}>Keep logging daily!</Text>
          </View>
        </View>

        {/* Adherence Score Box */}
        <View style={styles.scoreBox}>
          <Text style={styles.scoreVal}>{Math.round(weekly_adherence_score)}%</Text>
          <Text style={styles.scoreLbl}>7-Day Adherence</Text>
        </View>
      </View>

      {/* 7-Day Consistency Dots */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7-Day Consistency</Text>
        <View style={styles.gridRow}>
          {seven_day_grid.map((d) => (
            <View key={d.date} style={styles.dayCol}>
              <Text style={styles.dayName}>{d.day_name}</Text>
              <View style={[styles.statusBadge, getStatusStyle(d.status)]}>
                <Text style={styles.statusSymbol}>{getStatusSymbol(d.status)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Badges & Achievements */}
      {badges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges & Achievements</Text>
          <View style={styles.badgesGrid}>
            {badges.map((b) => (
              <View
                key={b.id}
                style={[styles.badgeCard, b.unlocked ? styles.badgeUnlocked : styles.badgeLocked]}
              >
                <View style={styles.badgeIconBox}>{renderBadgeIcon(b)}</View>
                <View style={styles.badgeInfo}>
                  <Text style={[styles.badgeTitle, !b.unlocked && styles.textMuted]}>
                    {b.title}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={1}>
                    {b.unlocked ? 'Unlocked' : 'Locked'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2112',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  fireIcon: {
    fontSize: 24,
  },
  streakNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  streakSub: {
    fontSize: 10,
    color: '#A79A85',
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  scoreVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#7BA05B',
  },
  scoreLbl: {
    fontSize: 11,
    color: '#A79A85',
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2D261F',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
  },
  dayName: {
    fontSize: 11,
    color: '#A79A85',
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusSymbol: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusOnTarget: {
    backgroundColor: '#3fb950',
  },
  statusClose: {
    backgroundColor: '#d29922',
  },
  statusOffTarget: {
    backgroundColor: '#f85149',
  },
  statusNoLog: {
    backgroundColor: '#30363d',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  badgeUnlocked: {
    backgroundColor: '#1C2719',
    borderColor: '#7BA05B',
  },
  badgeLocked: {
    backgroundColor: '#08090C',
    borderColor: '#3A3128',
    opacity: 0.6,
  },
  badgeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 20,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  badgeDesc: {
    fontSize: 10,
    color: '#A79A85',
  },
  textMuted: {
    color: '#A79A85',
  },
});
