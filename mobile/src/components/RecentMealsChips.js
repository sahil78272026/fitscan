import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, radius } from '../theme';

// Semantic vector Plus icon (Zero raw emojis)
function PlusIcon({ size = 12, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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
        <Text style={styles.sectionLabel}>PREVIOUSLY EATEN</Text>
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
            activeOpacity={0.8}
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
                <PlusIcon size={12} color={colors.primary || '#F59E0B'} />
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
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.textSecondary || '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textMuted || '#64748B',
  },
  scrollRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    borderRadius: radius.md || 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  chipText: {
    fontSize: typography?.sizes?.sm || 12,
    fontWeight: '600',
    color: colors.textPrimary || '#F8FAFC',
    maxWidth: 160,
  },
  calBadge: {
    backgroundColor: colors.primarySubtle || 'rgba(245, 158, 11, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  calText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
  },
  quickAddBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySubtle || 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
