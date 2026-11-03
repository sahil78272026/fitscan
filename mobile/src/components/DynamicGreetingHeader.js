import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { Badge } from './ui/Badge';
import { getGreetingDetails } from '../utils/personalizationEngine';

export default function DynamicGreetingHeader({
  user,
  userSettings,
  summary,
  navigation,
  adherenceStats,
}) {
  const { greeting, subGreeting, icon, timePeriod } = getGreetingDetails({
    user,
    userSettings,
    summary,
  });

  const goalType = (userSettings?.goal_type || 'fat_loss').replace('_', ' ').toUpperCase();
  const dietType = (userSettings?.diet_type || 'veg').replace('_', ' ').toUpperCase();
  const streakDays = adherenceStats?.current_streak ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.greetingCol}>
          <View style={styles.titleRow}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
          <Text style={styles.subGreetingText} numberOfLines={2}>
            {subGreeting}
          </Text>
        </View>

        {/* Right side: Streak and Avatar */}
        <View style={styles.actionsCol}>
          {navigation && (
            <TouchableOpacity
              style={styles.streakPill}
              onPress={() => navigation.navigate('Streak')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Streak ${streakDays} days, tap for achievements`}
            >
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakCount}>{streakDays}d</Text>
            </TouchableOpacity>
          )}

          {navigation && (
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open user profile and settings"
            >
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(user?.name || user?.email || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Goal & Diet Tags */}
      <View style={styles.tagsRow}>
        <Badge
          label={goalType}
          variant="primary"
          size="sm"
          icon="🎯"
        />
        <Badge
          label={dietType}
          variant="protein"
          size="sm"
          icon="🥗"
        />
        {summary?.calorie_goal ? (
          <Badge
            label={`${summary.calorie_goal} kcal target`}
            variant="neutral"
            size="sm"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.lg || 16,
    padding: spacing.md || 14,
    marginBottom: spacing.md || 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
    ...(shadows.sm || {}),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingCol: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    letterSpacing: -0.3,
  },
  iconText: {
    fontSize: 18,
  },
  subGreetingText: {
    fontSize: 12,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 17,
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: colors.primaryBorder || 'rgba(232, 160, 32, 0.35)',
    borderRadius: radius.full || 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  avatarBtn: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary || '#E8A020',
    padding: 1,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface || '#221D17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary || '#E8A020',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || '#2D261F',
  },
});
