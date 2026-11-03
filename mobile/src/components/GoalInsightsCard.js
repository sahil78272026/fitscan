import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { Badge } from './ui/Badge';
import { getGoalInsights, getAdaptiveSuggestions } from '../utils/personalizationEngine';

const DIET_ICONS = {
  veg: '🌱',
  vegan: '🥑',
  eggetarian: '🥚',
  non_veg: '🍗',
};

export default function GoalInsightsCard({
  summary,
  userSettings,
  onSelectSuggestion,
}) {
  const insight = getGoalInsights({ summary, userSettings });
  const suggestions = getAdaptiveSuggestions({ userSettings, summary });

  const getBorderColor = () => {
    if (insight.variant === 'danger') return colors.danger || '#C7502F';
    if (insight.variant === 'warning') return colors.warning || '#E8A020';
    return colors.success || '#7BA05B';
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.iconTitle}>🧠</Text>
          <Text style={styles.cardTitle}>Goal Insights & Coaching</Text>
        </View>
        <Badge
          label={insight.badge}
          variant={insight.variant}
          size="sm"
        />
      </View>

      {/* Real-time Coach Advice Box */}
      <View style={[styles.coachBox, { borderLeftColor: getBorderColor() }]}>
        <Text style={styles.coachTitle}>{insight.title}</Text>
        <Text style={styles.coachMessage}>{insight.message}</Text>
      </View>

      {/* Adaptive Suggestions Section */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>
              TAILORED FOOD IDEAS ({userSettings?.diet_type?.toUpperCase() || 'VEG'})
            </Text>
            <Text style={styles.suggestionsSub}>Tap to quick-fill</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestionChip}
                onPress={() => onSelectSuggestion && onSelectSuggestion(item)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Suggest ${item.name}, ${item.calories} calories, ${item.protein} grams protein`}
              >
                <View style={styles.chipTopRow}>
                  <Text style={styles.dietIcon}>{DIET_ICONS[item.diet] || '🍽️'}</Text>
                  <Text style={styles.chipTag}>{item.tag}</Text>
                </View>

                <Text style={styles.chipName} numberOfLines={2}>
                  {item.name}
                </Text>

                <View style={styles.chipBottomRow}>
                  <Text style={styles.chipCals}>{item.calories} kcal</Text>
                  <Text style={styles.chipProtein}>P: {item.protein}g</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconTitle: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  coachBox: {
    backgroundColor: colors.surface || '#221D17',
    borderRadius: radius.sm || 8,
    padding: spacing.sm || 10,
    borderLeftWidth: 3,
    marginBottom: 12,
  },
  coachTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 3,
  },
  coachMessage: {
    fontSize: 12,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 17,
  },
  suggestionsSection: {
    marginTop: 2,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
    letterSpacing: 0.5,
  },
  suggestionsSub: {
    fontSize: 10,
    color: colors.primary || '#E8A020',
  },
  chipsScroll: {
    paddingRight: 8,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: colors.surface || '#221D17',
    borderRadius: radius.sm || 8,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    padding: 10,
    width: 170,
    justifyContent: 'space-between',
  },
  chipTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dietIcon: {
    fontSize: 13,
  },
  chipTag: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  chipName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    lineHeight: 16,
    marginBottom: 8,
    minHeight: 32,
  },
  chipBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || '#2D261F',
  },
  chipCals: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary || '#A79A85',
  },
  chipProtein: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.protein || '#7BA05B',
  },
});
