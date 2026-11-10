import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme';

/**
 * Universal Card container primitive for FitScan mobile.
 * Implements the Warm Culinary Palette with platform-adaptive elevation/shadows.
 *
 * @param {React.ReactNode} children - Contents of the card
 * @param {'default'|'elevated'|'highlight'|'outlined'|'flat'} [variant='default'] - Card surface style
 * @param {() => void} [onPress] - If provided, makes the card pressable with >=48dp touch target
 * @param {number|'none'|'sm'|'md'|'lg'} [padding='md'] - Padding inside the card
 * @param {object} [style] - Custom container style overrides
 * @param {string} [accessibilityLabel] - Screen reader label for pressable cards
 * @param {string} [accessibilityHint] - Screen reader hint for pressable cards
 */
export function Card({
  children,
  variant = 'default',
  onPress,
  padding = 'md',
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
  ...props
}) {
  const getPaddingStyle = () => {
    if (typeof padding === 'number') return { padding };
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'sm':
        return { padding: spacing.sm || 8 };
      case 'lg':
        return { padding: spacing.xl || 20 };
      case 'md':
      default:
        return { padding: spacing.cardPadding || 16 };
    }
  };

  const cardStyles = [
    styles.base,
    styles[`variant_${variant}`],
    getPaddingStyle(),
    onPress && styles.interactive,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles} testID={testID} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg || 16,
    overflow: 'hidden',
  },
  interactive: {
    minHeight: 48,
  },

  variant_default: {
    backgroundColor: colors.surface || '#111318',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    ...(shadows.sm || {}),
  },
  variant_elevated: {
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderWidth: 1,
    borderColor: colors.borderSubtle || 'rgba(255, 255, 255, 0.08)',
    ...(shadows.md || {}),
  },
  variant_highlight: {
    backgroundColor: colors.surface || '#111318',
    borderWidth: 1.5,
    borderColor: colors.primaryBorder || 'rgba(245, 158, 11, 0.35)',
    ...(shadows.primaryGlow || shadows.sm || {}),
  },
  variant_glass: {
    backgroundColor: colors.surfaceGlass || 'rgba(17, 19, 24, 0.85)',
    borderWidth: 1,
    borderColor: colors.borderSubtle || 'rgba(255, 255, 255, 0.08)',
  },
  variant_emerald: {
    backgroundColor: colors.surface || '#111318',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.30)',
    ...(shadows.emeraldGlow || shadows.sm || {}),
  },
  variant_outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  variant_flat: {
    backgroundColor: colors.surface || '#111318',
    borderWidth: 0,
  },
});

export default Card;
