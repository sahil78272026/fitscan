import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, radius, spacing } from '../../theme';

/**
 * Universal Badge / Pill primitive for FitScan mobile.
 * Provides status, macro tags (protein, carbs, fat), and interactive chip toggles.
 * Enforces strict >= 11dp font size floor and >= 48dp touch target when interactive.
 *
 * @param {string|React.ReactNode} label - Badge text or element
 * @param {string|React.ReactNode} [icon] - Leading icon or emoji
 * @param {'neutral'|'primary'|'protein'|'carbs'|'fat'|'success'|'warning'|'danger'|'info'} [variant='neutral']
 * @param {'sm'|'md'|'lg'} [size='md'] - Size variant (all enforce >= 11dp font)
 * @param {() => void} [onPress] - If provided, wraps in pressable chip with hitSlop >= 48dp
 * @param {boolean} [selected=false] - For filter chips, highlights active border
 * @param {object} [style] - Custom outer container style
 * @param {object} [textStyle] - Custom text style
 * @param {string} [accessibilityLabel] - Screen reader label
 * @param {object|number} [hitSlop] - Optional custom touch expansion override
 */
const BADGE_HIT_SLOP = {
  sm: { top: 14, bottom: 14, left: 12, right: 12 },
  md: { top: 12, bottom: 12, left: 10, right: 10 },
  lg: { top: 10, bottom: 10, left: 8, right: 8 },
};

export function Badge({
  label,
  icon,
  variant = 'neutral',
  size = 'md',
  onPress,
  selected = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
  hitSlop: customHitSlop,
  ...props
}) {
  const containerStyles = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    selected && styles.selectedBorder,
    style,
  ];

  const labelStyles = [
    styles.label,
    styles[`labelSize_${size}`],
    styles[`labelVariant_${variant}`],
    textStyle,
  ];

  const content = (
    <View style={styles.contentRow}>
      {Boolean(icon) ? (
        <View style={styles.iconContainer}>
          {typeof icon === 'string' ? (
            <Text style={styles.iconText}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      ) : null}
      {(typeof label === 'string' || typeof label === 'number') ? (
        <Text style={labelStyles} numberOfLines={1}>
          {label}
        </Text>
      ) : (
        label != null ? label : null
      )}
    </View>
  );

  if (onPress) {
    const effectiveHitSlop = customHitSlop !== undefined
      ? customHitSlop
      : (BADGE_HIT_SLOP[size] || BADGE_HIT_SLOP.md);

    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        activeOpacity={0.75}
        hitSlop={effectiveHitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || ((typeof label === 'string' || typeof label === 'number') ? String(label) : undefined)}
        accessibilityState={{ selected }}
        testID={testID}
        {...props}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyles} testID={testID} {...props}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full || 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBorder: {
    borderColor: colors.primary || '#F59E0B',
    borderWidth: 1.5,
  },

  // Sizes: strictly maintain >= 11dp font floor and guaranteed min bounding box
  size_sm: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    minHeight: 22,
    minWidth: 24,
  },
  size_md: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    minHeight: 26,
    minWidth: 28,
  },
  size_lg: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    minHeight: 30,
    minWidth: 32,
  },

  // Color variants
  variant_neutral: {
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderColor: colors.border || '#222631',
  },
  variant_primary: {
    backgroundColor: colors.primarySubtle || 'rgba(245, 158, 11, 0.12)',
    borderColor: colors.primaryBorder || 'rgba(245, 158, 11, 0.28)',
  },
  variant_protein: {
    backgroundColor: colors.proteinSubtle || 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  variant_carbs: {
    backgroundColor: colors.carbsSubtle || 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  variant_fat: {
    backgroundColor: colors.fatSubtle || 'rgba(244, 63, 94, 0.14)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  variant_success: {
    backgroundColor: colors.successSubtle || 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  variant_warning: {
    backgroundColor: colors.warningSubtle || 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  variant_danger: {
    backgroundColor: colors.dangerSubtle || 'rgba(239, 68, 68, 0.14)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  variant_info: {
    backgroundColor: colors.infoSubtle || 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },

  // Labels
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  labelSize_sm: {
    fontSize: typography?.sizes?.xs || 11, // Strict floor
  },
  labelSize_md: {
    fontSize: 12,
  },
  labelSize_lg: {
    fontSize: typography?.sizes?.sm || 13,
  },

  labelVariant_neutral: {
    color: colors.textSecondary || '#94A3B8',
  },
  labelVariant_primary: {
    color: colors.primary || '#F59E0B',
  },
  labelVariant_protein: {
    color: colors.protein || '#10B981',
  },
  labelVariant_carbs: {
    color: colors.carbs || '#F59E0B',
  },
  labelVariant_fat: {
    color: colors.fatText || colors.fat || '#F43F5E',
  },
  labelVariant_success: {
    color: colors.success || '#10B981',
  },
  labelVariant_warning: {
    color: colors.warning || '#F59E0B',
  },
  labelVariant_danger: {
    color: colors.dangerText || colors.danger || '#EF4444',
  },
  labelVariant_info: {
    color: colors.info || '#38BDF8',
  },

  // Icon
  iconContainer: {
    marginRight: 4,
  },
  iconText: {
    fontSize: 12,
  },
});

export default Badge;
