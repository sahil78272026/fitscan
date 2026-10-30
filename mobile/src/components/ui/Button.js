import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  View,
} from 'react-native';
import { colors, typography, radius, shadows, spacing } from '../../theme';

/**
 * Universal Button primitive for FitScan mobile.
 * Guarantees >= 48x48dp touch target, tactile press feedback, and accessibility attributes.
 *
 * @param {string|React.ReactNode} title - Button label text or node
 * @param {() => void} onPress - Handler triggered on press
 * @param {'primary'|'secondary'|'outline'|'ghost'|'danger'|'subtleDanger'} [variant='primary'] - Button style variant
 * @param {'sm'|'md'|'lg'} [size='md'] - Button size (all guarantee >= 48dp effective target)
 * @param {React.ReactNode|string} [icon] - Leading or trailing icon / emoji
 * @param {'left'|'right'} [iconPosition='left'] - Icon placement
 * @param {boolean} [disabled=false] - Disables interactions and dims opacity
 * @param {boolean} [loading=false] - Displays spinner and disables interactions
 * @param {boolean} [fullWidth=false] - Expands button to 100% width
 * @param {object} [style] - Custom outer container style overrides
 * @param {object} [textStyle] - Custom text style overrides
 * @param {string} [accessibilityLabel] - Spoken label for screen readers
 * @param {string} [accessibilityHint] - Hint describing action for screen readers
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
  ...touchableProps
}) {
  const isInteractive = !disabled && !loading;

  // Resolve container styles
  const containerStyles = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style,
  ];

  // Resolve text styles
  const labelStyles = [
    styles.label,
    styles[`labelSize_${size}`],
    styles[`labelVariant_${variant}`],
    textStyle,
  ];

  // Spinner color resolution
  const getSpinnerColor = () => {
    switch (variant) {
      case 'primary':
        return colors.textOnPrimary || '#221803';
      case 'danger':
        return '#FFFFFF';
      case 'outline':
      case 'ghost':
        return colors.primary || '#E8A020';
      case 'subtleDanger':
        return colors.dangerText || colors.danger || '#E57453';
      case 'secondary':
      default:
        return colors.textPrimary || '#F4ECDD';
    }
  };

  // HitSlop to ensure 'sm' buttons strictly achieve >= 48x48dp touch region
  const hitSlop = size === 'sm' ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined;

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={isInteractive ? onPress : undefined}
      activeOpacity={0.75}
      disabled={!isInteractive}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || ((typeof title === 'string' || typeof title === 'number') ? String(title) : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: !isInteractive,
        busy: loading,
      }}
      testID={testID}
      {...touchableProps}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getSpinnerColor()} />
      ) : (
        <View style={styles.contentRow}>
          {Boolean(icon) && iconPosition === 'left' ? (
            <View style={styles.iconLeft}>
              {typeof icon === 'string' ? (
                <Text style={styles.iconText}>{icon}</Text>
              ) : (
                icon
              )}
            </View>
          ) : null}

          {(typeof title === 'string' || typeof title === 'number') ? (
            <Text style={labelStyles} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            title != null ? title : null
          )}

          {Boolean(icon) && iconPosition === 'right' ? (
            <View style={styles.iconRight}>
              {typeof icon === 'string' ? (
                <Text style={styles.iconText}>{icon}</Text>
              ) : (
                icon
              )}
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md || 10,
    minWidth: 48,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // Size configurations
  size_sm: {
    minHeight: 40, // Visual 40dp + hitSlop 6dp = 52dp effective touch target
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  size_md: {
    minHeight: 48, // Standard 48dp minimum touch target
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  size_lg: {
    minHeight: 54, // Large prominent CTA
    paddingVertical: 14,
    paddingHorizontal: 20,
  },

  // Variant styles
  variant_primary: {
    backgroundColor: colors.primary || '#E8A020',
    ...(shadows.primaryGlow || shadows.sm),
  },
  variant_secondary: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    ...(shadows.sm || {}),
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primaryBorder || colors.primary || '#E8A020',
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: colors.danger || '#C7502F',
    ...(shadows.sm || {}),
  },
  variant_subtleDanger: {
    backgroundColor: colors.dangerSubtle || 'rgba(199, 80, 47, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger || '#C7502F',
  },

  // Text labels
  label: {
    fontWeight: '700',
    textAlign: 'center',
  },
  labelSize_sm: {
    fontSize: typography?.sizes?.sm || 13,
  },
  labelSize_md: {
    fontSize: typography?.sizes?.base || 15,
  },
  labelSize_lg: {
    fontSize: typography?.sizes?.md || 17,
  },

  labelVariant_primary: {
    color: colors.textOnPrimary || '#221803',
  },
  labelVariant_secondary: {
    color: colors.textPrimary || '#F4ECDD',
  },
  labelVariant_outline: {
    color: colors.primary || '#E8A020',
  },
  labelVariant_ghost: {
    color: colors.primary || '#E8A020',
  },
  labelVariant_danger: {
    color: '#FFFFFF',
  },
  labelVariant_subtleDanger: {
    color: colors.dangerText || '#E57453',
  },

  // Icons
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  iconText: {
    fontSize: 16,
  },
});

export default Button;
