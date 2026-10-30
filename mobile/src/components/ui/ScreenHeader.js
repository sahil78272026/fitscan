import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../theme';

/**
 * Universal ScreenHeader primitive for FitScan mobile.
 * Eliminates the Android double-padding bug by reading safe area insets cleanly.
 * Guarantees >= 48x48dp touch target on back and action buttons.
 *
 * @param {string|React.ReactNode} title - Page title
 * @param {string} [subtitle] - Optional subtitle
 * @param {() => void} [onBack] - Back button press handler (renders back button if provided)
 * @param {string} [backTitle] - Optional text next to back arrow (e.g. "Tracker")
 * @param {React.ReactNode|string} [backIcon='‹'] - Custom back icon or symbol
 * @param {React.ReactNode} [rightAction] - Element placed on the right side of header
 * @param {boolean} [showBorder=true] - Shows subtle bottom divider
 * @param {string} [backgroundColor] - Header background override
 * @param {boolean} [safeArea=true] - Applies top safe area inset cleanly
 * @param {object} [style] - Custom container style
 * @param {object} [titleStyle] - Custom title style
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backTitle,
  backIcon = '‹',
  rightAction,
  showBorder = true,
  backgroundColor = colors.surface || '#221D17',
  safeArea = true,
  style,
  titleStyle,
  testID,
}) {
  const insets = useSafeAreaInsets();
  const topPadding = safeArea ? (insets.top > 0 ? insets.top : 12) : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          paddingTop: topPadding,
          borderBottomWidth: showBorder ? 1 : 0,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.contentRow}>
        {/* Left: Back Button or Spacer */}
        <View style={styles.leftContainer}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Navigates to the previous screen"
            >
              {typeof backIcon === 'string' ? (
                <Text style={styles.backIconText}>{backIcon}</Text>
              ) : (
                backIcon
              )}
              {Boolean(backTitle) ? (
                <Text style={styles.backTitleText} numberOfLines={1}>
                  {backTitle}
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Center: Title & Subtitle */}
        <View style={styles.centerContainer}>
          {(typeof title === 'string' || typeof title === 'number') ? (
            <Text
              style={[styles.title, titleStyle]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : (
            title != null ? title : null
          )}

          {Boolean(subtitle) ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right: Actions or Spacer */}
        <View style={styles.rightContainer}>
          {rightAction ? (
            <View style={styles.rightActionWrapper}>
              {rightAction}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomColor: colors.borderSubtle || '#2D261F',
    zIndex: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.screenPadding || 16,
    paddingVertical: 6,
  },
  leftContainer: {
    minWidth: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 48,
    minHeight: 48, // Guaranteed >= 48dp touch target
    justifyContent: 'center',
  },
  backIconText: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    marginRight: 2,
  },
  backTitleText: {
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '600',
    color: colors.primary || '#E8A020',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: typography?.sizes?.md || 17,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    textAlign: 'center',
    marginTop: 2,
  },
  rightContainer: {
    minWidth: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightActionWrapper: {
    minWidth: 48,
    minHeight: 48, // Guaranteed >= 48dp touch target container
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});

export default ScreenHeader;
