import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, radius } from '../theme';

/**
 * RecentMealsChips Component
 *
 * Displays horizontal scrollable chips of previously eaten meals matching
 * the currently selected meal type (Breakfast, Lunch, Dinner, Snack).
 * Tapping a chip populates the input (or quick-logs with 1 tap),
 * establishing feature parity with the web application.
 */
export default function RecentMealsChips({
  recentItems = [],
  currentMealType = 'lunch',
  onSelectSuggestion,
  onQuickLog,
  disabled = false,
}) {
  const filteredItems = useMemo(() => {
    if (!Array.isArray(recentItems) || recentItems.length === 0) return [];

    const targetType = (currentMealType || '').toLowerCase().trim();
    const seenNames = new Set();
    const result = [];

    for (const item of recentItems) {
      if (!item || !item.name) continue;
      const itemType = (item.meal_type || '').toLowerCase().trim();

      // Match meal type or include if no type specified
      if (!targetType || itemType === targetType) {
        const cleanName = item.name.trim();
        const key = cleanName.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          result.push({
            name: cleanName,
            calories: item.calories || 0,
            protein: item.protein || 0,
            carbs: item.carbs || 0,
            fat: item.fat || 0,
            meal_type: item.meal_type || targetType,
          });
        }
      }
    }

    return result.slice(0, 10);
  }, [recentItems, currentMealType]);

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>🕒 Previously Eaten Suggestions:</Text>
        <Text style={styles.sectionHint}>Tap to add</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollRow}
      >
        {filteredItems.map((item, idx) => (
          <TouchableOpacity
            key={`${item.name}-${idx}`}
            style={styles.chip}
            onPress={() => onSelectSuggestion && onSelectSuggestion(item.name)}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Previously eaten item: ${item.name}, ${item.calories} calories`}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {item.name}
            </Text>
            {item.calories > 0 && (
              <View style={styles.calBadge}>
                <Text style={styles.calText}>{item.calories}</Text>
              </View>
            )}
            {typeof onQuickLog === 'function' && (
              <TouchableOpacity
                style={styles.quickAddBtn}
                onPress={() => onQuickLog(item)}
                disabled={disabled}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Instant log ${item.name}`}
              >
                <Text style={styles.quickAddIcon}>⚡</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textTertiary || '#706555',
  },
  scrollRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    borderRadius: radius.md || 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  chipText: {
    fontSize: typography?.sizes?.sm || 12,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    maxWidth: 160,
  },
  calBadge: {
    backgroundColor: colors.primarySubtle || 'rgba(232, 160, 32, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  calText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  quickAddBtn: {
    paddingLeft: 2,
  },
  quickAddIcon: {
    fontSize: 11,
    color: colors.primary || '#E8A020',
  },
});
