import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { getActiveMilestones } from '../utils/personalizationEngine';

export default function ContextualMilestoneCard({
  adherenceStats,
  weightData,
  summary,
  userSettings,
  navigation,
}) {
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const milestones = getActiveMilestones({
    adherenceStats,
    weightData,
    summary,
    userSettings,
  });

  // Filter out any dismissed milestone
  const activeMilestones = milestones.filter((m) => !dismissedIds.has(m.id));

  if (activeMilestones.length === 0) return null;

  // Take the highest priority active milestone
  const current = activeMilestones[0];

  const handleDismiss = () => {
    setDismissedIds((prev) => new Set(prev).add(current.id));
  };

  const isCelebration = current.variant === 'celebration' || current.variant === 'macro_success';

  return (
    <View style={[styles.card, isCelebration && styles.celebrationCard]}>
      <View style={styles.contentRow}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{current.icon}</Text>
        </View>

        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{current.title}</Text>
            {isCelebration && <Text style={styles.badgeText}>UNLOCKED</Text>}
          </View>
          <Text style={styles.subtitleText}>{current.subtitle}</Text>

          {navigation && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Streak')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View achievements and streak details"
            >
              <Text style={styles.actionBtnText}>View Achievements →</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss milestone notification"
        >
          <Text style={styles.dismissBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 12,
    padding: spacing.md || 12,
    marginBottom: spacing.md || 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
    ...(shadows.sm || {}),
  },
  celebrationCard: {
    borderColor: colors.primaryBorder || 'rgba(232, 160, 32, 0.40)',
    backgroundColor: 'rgba(232, 160, 32, 0.08)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232, 160, 32, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: 18,
  },
  textCol: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary || '#E8A020',
    backgroundColor: 'rgba(232, 160, 32, 0.20)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 12,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 16,
    marginBottom: 6,
  },
  actionBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  dismissBtn: {
    padding: 4,
  },
  dismissBtnText: {
    fontSize: 12,
    color: colors.textSecondary || '#A79A85',
  },
});
