/**
 * Standard Spacing System for FitScan Mobile
 * 4/8pt baseline grid with explicit accessibility touch target standards
 * satisfying both Android Material (>=48dp) and iOS HIG (>=44pt).
 */

export const spacing = {
  // Baseline 4/8pt scale
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,

  // Layout semantic insets
  screenPadding: 16,
  cardPadding: 16,
  sectionGap: 20,
  itemGap: 12,
  floatingTabOffset: 96,  // Bottom padding clearance for screens above floating pill tab bar

  // Accessibility touch target standards
  touchTargetMin: 48,     // Universal accessibility standard (Android Material >=48dp, iOS HIG >=44pt)
  touchTargetIos: 44,     // iOS Human Interface Guidelines minimum (44pt)
  touchTargetAndroid: 48, // Android Material Design minimum (48dp)
};

export default spacing;
