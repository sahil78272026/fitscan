/**
 * FitScan Mobile Theme Aggregator
 * Provides both named exports and default theme object for Metro bundling resilience.
 */

import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';

// 1. Named exports for destructured consumers:
//    import { colors, spacing, typography } from '../theme';
export { colors, typography, spacing, radius, shadows };

// 2. Composite theme object:
export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
};

// 3. Default export for theme object consumers:
//    import theme from '../theme';
export default theme;
