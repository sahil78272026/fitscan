import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function AdherenceCard({ stats }) {
  if (!stats) return null;

  const { current_streak = 0, weekly_adherence_score = 0, seven_day_grid = [], badges = [] } = stats;

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
          <Text style={styles.fireIcon}>🔥</Text>
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
        <Text style={styles.sectionTitle}>📅 7-Day Consistency</Text>
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
          <Text style={styles.sectionTitle}>🏆 Badges & Achievements</Text>
          <View style={styles.badgesGrid}>
            {badges.map((b) => (
              <View
                key={b.id}
                style={[styles.badgeCard, b.unlocked ? styles.badgeUnlocked : styles.badgeLocked]}
              >
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <View style={styles.badgeInfo}>
                  <Text style={[styles.badgeTitle, !b.unlocked && styles.textMuted]}>
                    {b.title}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={1}>
                    {b.unlocked ? 'Unlocked 🎉' : 'Locked'}
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
    backgroundColor: '#181410',
    borderColor: '#3A3128',
    opacity: 0.6,
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
