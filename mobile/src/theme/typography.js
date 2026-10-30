import { Platform } from 'react-native';

/**
 * Standard Typography Scale for FitScan Mobile
 * Enforces a strict minimum font floor of 11dp for accessibility (WCAG 2.1 AA)
 * and provides cross-platform font families for iOS and Android.
 */

export const typography = {
  // Platform-native font stacks
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),

  // Font size scale with minimum 11dp readability floor
  sizes: {
    xs: 11,      // Absolute floor: Footnotes, tiny badges, micro-labels (min mobile readability)
    sm: 13,      // Secondary text, sub-labels, badge text, dates
    base: 15,    // Standard body text, button labels, text inputs
    md: 17,      // Emphasized body, card titles, subheadings
    lg: 20,      // Section titles, modal headers
    xl: 24,      // Screen headers, main stats
    xxl: 32,     // Hero numbers, large metric callouts (current weight)
    display: 40, // Large display numbers
    hero: 48,    // Max hero counters (e.g. calorie ring, login title)
  },

  // Font weights
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },

  // Relative line heights for readability
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // Absolute accessibility floor (WCAG AA)
  minFontSize: 11,
};

export default typography;
