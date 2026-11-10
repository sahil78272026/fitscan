import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { Badge } from './ui/Badge';
import { getGreetingDetails } from '../utils/personalizationEngine';

// --- Semantic Vector SVG Ambient & Action Icons (Zero Raw Emojis) ---

function SunriseIcon({ size = 20, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2v6M4.93 10.93l1.41 1.41M19.07 10.93l-1.41 1.41M2 18h20M12 11a4 4 0 00-4 4h8a4 4 0 00-4-4zM8 6l4-4 4 4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SunIcon({ size = 20, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" />
      <Path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SunsetIcon({ size = 20, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 10v6M4.93 10.93l1.41 1.41M19.07 10.93l-1.41 1.41M2 18h20M12 10a4 4 0 00-4 4h8a4 4 0 00-4-4zM8 14l4 4 4-4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoonIcon({ size = 20, color = colors.hydrationSky || '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FlameIcon({ size = 14, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 14.5A2.5 2.5 0 0011 17c1.38 0 2.5-1.12 2.5-2.5 0-1.63-1.07-2.91-1.5-3.5-.43.59-1.5 1.87-1.5 3.5zM12 2c-1.5 3-4.5 5.5-4.5 9.5a6.5 6.5 0 0013 0c0-4-3-6.5-4.5-9.5-1 2-2.5 3-4 0z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AmbientGreetingIcon({ period = 'morning', size = 20 }) {
  switch (period) {
    case 'morning':
    case 'sunrise':
      return <SunriseIcon size={size} color={colors.primary || '#F59E0B'} />;
    case 'afternoon':
    case 'sun':
      return <SunIcon size={size} color={colors.primary || '#F59E0B'} />;
    case 'evening':
    case 'sunset':
      return <SunsetIcon size={size} color={colors.primary || '#F59E0B'} />;
    case 'night':
    case 'moon':
      return <MoonIcon size={size} color={colors.hydrationSky || '#38BDF8'} />;
    default:
      return <SunIcon size={size} color={colors.primary || '#F59E0B'} />;
  }
}

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
            <AmbientGreetingIcon period={timePeriod || icon} size={20} />
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
              <FlameIcon size={13} color={colors.primary || '#F59E0B'} />
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
        />
        <Badge
          label={dietType}
          variant="protein"
          size="sm"
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
    backgroundColor: colors.surface || '#111318',
    borderRadius: radius.lg || 16,
    padding: spacing.cardPadding || 16,
    marginBottom: spacing.cardPadding || 16,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    ...(shadows.sm || {}),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingCol: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    letterSpacing: -0.3,
  },
  subGreetingText: {
    fontSize: 12,
    color: colors.textSecondary || '#94A3B8',
    lineHeight: 18,
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle || 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: colors.primaryBorder || 'rgba(245, 158, 11, 0.28)',
    borderRadius: radius.full || 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  streakCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
  },
  avatarBtn: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary || '#F59E0B',
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
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary || '#F59E0B',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || 'rgba(255, 255, 255, 0.08)',
  },
});
