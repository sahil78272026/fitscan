import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { Badge } from './ui/Badge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MEAL_TYPE_ICONS = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍿',
};

export function getMealPriority(meal) {
  const type = (meal?.meal_type || '').toLowerCase();
  const protein = Number(meal?.total_protein || meal?.protein || 0);
  const calories = Number(meal?.total_calories || meal?.calories || 0);

  if (type === 'dinner' || protein >= 35 || calories >= 550) {
    return { label: '⚡ Recovery Anchor', variant: 'primary' };
  }
  if (type === 'snack' || calories < 300) {
    return { label: '☕ Snack', variant: 'neutral' };
  }
  return { label: '🌾 Balanced', variant: 'protein' };
}

export default function MealCard({
  meal,
  isToday = true,
  onDelete,
  onPreviewImage,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!meal) return null;

  const dateVal = meal.logged_at || meal.created_at;
  let mealTimeStr = '';
  if (dateVal) {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      mealTimeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  }

  const priority = getMealPriority(meal);

  const protein = Math.max(0, Number(meal.total_protein || meal.protein || 0));
  const carbs = Math.max(0, Number(meal.total_carbs || meal.carbs || 0));
  const fat = Math.max(0, Number(meal.total_fat || meal.fat || 0));

  // Calculate caloric proportions for 4dp macro ratio track
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;

  const proteinFlex = totalMacroCals > 0 ? Math.max(0.08, proteinCals / totalMacroCals) : 1;
  const carbsFlex = totalMacroCals > 0 ? Math.max(0.08, carbsCals / totalMacroCals) : 1;
  const fatFlex = totalMacroCals > 0 ? Math.max(0.08, fatCals / totalMacroCals) : 1;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const foodItems = Array.isArray(meal.food_items) ? meal.food_items : [];

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={toggleExpand}
        style={styles.cardHeaderArea}
        accessibilityRole="button"
        accessibilityLabel={`${meal.meal_type || 'Meal'} card, tap to ${expanded ? 'collapse' : 'expand'}`}
      >
        <View style={styles.topRow}>
          {/* Left: Thumbnail / Icon */}
          {meal.image_url ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                if (onPreviewImage) onPreviewImage(meal.image_url);
              }}
              activeOpacity={0.8}
              style={styles.thumbWrapper}
              accessibilityRole="button"
              accessibilityLabel="View full meal photo"
            >
              <Image source={{ uri: meal.image_url }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.zoomBadge}>
                <Text style={styles.zoomBadgeText}>🔍</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.iconPlaceholder}>
              <Text style={styles.iconPlaceholderText}>
                {MEAL_TYPE_ICONS[meal.meal_type] || '🍽️'}
              </Text>
            </View>
          )}

          {/* Center Info */}
          <View style={styles.mainInfo}>
            <View style={styles.badgeRow}>
              <Badge
                label={(meal.meal_type || 'MEAL').toUpperCase()}
                variant="primary"
                size="sm"
              />
              <Badge
                label={priority.label}
                variant={priority.variant}
                size="sm"
              />
              {mealTimeStr ? <Text style={styles.timeText}>• {mealTimeStr}</Text> : null}
            </View>

            <Text style={styles.rawInputText} numberOfLines={expanded ? undefined : 2}>
              {meal.raw_input || 'Logged Meal'}
            </Text>

            <View style={styles.macroPillsRow}>
              <Text style={styles.macroPillProtein}>P: {protein}g</Text>
              <Text style={styles.macroDivider}>·</Text>
              <Text style={styles.macroPillCarbs}>C: {carbs}g</Text>
              <Text style={styles.macroDivider}>·</Text>
              <Text style={styles.macroPillFat}>F: {fat}g</Text>
            </View>
          </View>

          {/* Right: Calories & Actions */}
          <View style={styles.rightCol}>
            <Text style={styles.calorieNumber}>{meal.total_calories || meal.calories || 0}</Text>
            <Text style={styles.calorieUnit}>kcal</Text>

            <View style={styles.actionIconRow}>
              {isToday && onDelete && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onDelete(meal.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete meal ${meal.raw_input || ''}`}
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.expandChevron}>{expanded ? '▲' : '▼'}</Text>
            </View>
          </View>
        </View>

        {/* 4dp Macro Ratio Track */}
        <View style={styles.macroRatioBarContainer}>
          <View style={[styles.macroBarSegment, { flex: proteinFlex, backgroundColor: colors.protein }]} />
          <View style={styles.macroBarGap} />
          <View style={[styles.macroBarSegment, { flex: carbsFlex, backgroundColor: colors.carbs }]} />
          <View style={styles.macroBarGap} />
          <View style={[styles.macroBarSegment, { flex: fatFlex, backgroundColor: colors.fat }]} />
        </View>
      </TouchableOpacity>

      {/* Accordion Expanded Body */}
      {expanded && (
        <View style={styles.expandedBody}>
          {/* Prominent Image Banner */}
          {meal.image_url ? (
            <TouchableOpacity
              onPress={() => onPreviewImage && onPreviewImage(meal.image_url)}
              activeOpacity={0.9}
              style={styles.imageBannerContainer}
              accessibilityRole="button"
              accessibilityLabel="View enlarged meal photo"
            >
              <Image source={{ uri: meal.image_url }} style={styles.imageBanner} resizeMode="cover" />
              <View style={styles.imageBannerOverlay}>
                <Text style={styles.imageBannerText}>📸 Tap to enlarge photo</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Itemized Food Items Breakdown */}
          {foodItems.length > 0 && (
            <View style={styles.foodItemsBox}>
              <View style={styles.foodItemsHeader}>
                <Text style={styles.foodItemsHeaderTitle}>ITEMIZED FOOD BREAKDOWN</Text>
                <Text style={styles.foodItemsCount}>
                  {foodItems.length} {foodItems.length === 1 ? 'item' : 'items'}
                </Text>
              </View>

              {foodItems.map((item, idx) => (
                <View key={item.id || idx} style={styles.foodItemRow}>
                  <View style={styles.foodItemLeft}>
                    <Text style={styles.foodItemName} numberOfLines={1}>
                      {item.quantity && item.quantity > 1 ? `${item.quantity}× ` : ''}
                      {item.name}
                    </Text>
                    <Text style={styles.foodItemMacros}>
                      P: {item.protein || 0}g · C: {item.carbs || 0}g · F: {item.fat || 0}g
                    </Text>
                  </View>
                  <Text style={styles.foodItemCals}>{item.calories} kcal</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
    marginBottom: spacing.sm || 8,
    overflow: 'hidden',
  },
  cardHeaderArea: {
    padding: spacing.md || 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  thumbWrapper: {
    position: 'relative',
    marginRight: spacing.sm || 8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm || 8,
    backgroundColor: colors.surface || '#221D17',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  zoomBadgeText: {
    fontSize: 9,
  },
  iconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.sm || 8,
    backgroundColor: colors.surface || '#221D17',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm || 8,
  },
  iconPlaceholderText: {
    fontSize: 22,
  },
  mainInfo: {
    flex: 1,
    paddingRight: spacing.xs || 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.textSecondary || '#A79A85',
    marginLeft: 2,
  },
  rawInputText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 4,
    lineHeight: 18,
  },
  macroPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroPillProtein: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.protein || '#7BA05B',
  },
  macroPillCarbs: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.carbs || '#D9A441',
  },
  macroPillFat: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.fatText || '#E57453',
  },
  macroDivider: {
    fontSize: 10,
    color: colors.textTertiary || '#706555',
  },
  rightCol: {
    alignItems: 'flex-end',
    minWidth: 64,
  },
  calorieNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  calorieUnit: {
    fontSize: 10,
    color: colors.textSecondary || '#A79A85',
  },
  actionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  deleteBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(199, 80, 47, 0.15)',
  },
  deleteBtnText: {
    fontSize: 11,
    color: colors.dangerText || '#E57453',
    fontWeight: '700',
  },
  expandChevron: {
    fontSize: 10,
    color: colors.textSecondary || '#A79A85',
  },
  macroRatioBarContainer: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSubtle || '#2D261F',
    marginTop: 10,
    overflow: 'hidden',
  },
  macroBarSegment: {
    height: 4,
    borderRadius: 1,
  },
  macroBarGap: {
    width: 2,
    backgroundColor: 'transparent',
  },
  expandedBody: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || '#2D261F',
    padding: spacing.sm || 8,
    backgroundColor: colors.surface || '#221D17',
  },
  imageBannerContainer: {
    width: '100%',
    height: 150,
    borderRadius: radius.sm || 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.sm || 8,
  },
  imageBanner: {
    width: '100%',
    height: '100%',
  },
  imageBannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  imageBannerText: {
    fontSize: 11,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  foodItemsBox: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.sm || 8,
    padding: spacing.sm || 8,
  },
  foodItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle || '#2D261F',
  },
  foodItemsHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
    letterSpacing: 0.5,
  },
  foodItemsCount: {
    fontSize: 10,
    color: colors.textSecondary || '#A79A85',
  },
  foodItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  foodItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  foodItemName: {
    fontSize: 12,
    color: colors.textPrimary || '#F4ECDD',
    fontWeight: '500',
  },
  foodItemMacros: {
    fontSize: 10,
    color: colors.textSecondary || '#A79A85',
    marginTop: 1,
  },
  foodItemCals: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
  },
});
