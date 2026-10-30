/**
 * Canonical Color Palette for FitScan Mobile
 * Aligned 100% with frontend/src/app/globals.css (Warm Culinary Palette)
 * and WCAG 2.1 AA Contrast Standards (>= 4.5:1 on dark surfaces).
 */

export const colors = {
  // Brand Turmeric Gold
  primary: '#E8A020',
  primaryHover: '#D4901A',
  primaryDark: '#221803', // High-contrast text on primary buttons (7.90:1 - WCAG AAA)
  primaryGlow: 'rgba(232, 160, 32, 0.18)',
  primarySubtle: 'rgba(232, 160, 32, 0.10)',
  primaryBorder: 'rgba(232, 160, 32, 0.35)',

  // Warm Surfaces & Backgrounds
  background: '#181410',       // Base app screen background
  surface: '#221D17',          // Standard cards, modals, top header
  surfaceElevated: '#2C251D',  // Inputs, chips, elevated cards, action buttons
  surfaceActive: '#2A2219',    // Selected items, active rows
  surfaceOverlay: 'rgba(0, 0, 0, 0.80)', // Modal and dialog backdrops

  // Borders & Dividers
  border: '#3A3128',           // Primary card & container border
  borderSubtle: '#2D261F',     // Internal card dividers & list item lines
  borderHover: '#4A3F34',      // Active / focused input border

  // Foreground & Typography
  textPrimary: '#F4ECDD',      // High-emphasis text (Cream) - 15.6:1 on bg, 14.2:1 on surface (WCAG AAA)
  textSecondary: '#A79A85',    // Medium-emphasis / labels / subtitles - 6.6:1 on bg, 6.0:1 on surface (WCAG AA)
  textTertiary: '#706555',     // Canonical web token: low-emphasis decorative / disabled text (3.2:1 on bg, 2.9:1 on surface)
  textMuted: '#948675',        // Accessible low-emphasis body / caption text (5.2:1 on bg, 4.7:1 on surface - WCAG AA)
  textInverse: '#181410',      // Dark text on light backgrounds
  textOnPrimary: '#221803',    // Text on #E8A020 buttons (7.90:1 - WCAG AAA)

  // Macro Accents (Canonical)
  protein: '#7BA05B',          // Olive Green - 6.1:1 on bg, 5.6:1 on surface (WCAG AA)
  proteinSubtle: 'rgba(123, 160, 91, 0.18)',
  carbs: '#D9A441',            // Warm Mustard / Amber - 8.1:1 on bg, 7.4:1 on surface (WCAG AAA)
  carbsSubtle: 'rgba(217, 164, 65, 0.18)',
  fat: '#C7502F',              // Terracotta Rust - 4.0:1 on bg, 3.7:1 on surface (Passes 3:1 for UI components)
  fatSubtle: 'rgba(199, 80, 47, 0.18)',
  fatText: '#E57453',          // High-contrast coral text for fat & danger labels on dark (5.5:1 on surface - WCAG AA)

  // Semantic Status
  success: '#7BA05B',
  successSubtle: 'rgba(123, 160, 91, 0.18)',
  warning: '#E8A020',
  warningSubtle: 'rgba(232, 160, 32, 0.18)',
  danger: '#C7502F',
  dangerSubtle: 'rgba(199, 80, 47, 0.18)',
  dangerText: '#E57453',
  info: '#4285F4',             // Health Connect / Google Blue - 5.1:1 on bg, 4.7:1 on surface (WCAG AA)
  infoSubtle: 'rgba(66, 133, 244, 0.18)',
  neutral: '#A79A85',
  neutralSubtle: 'rgba(167, 154, 133, 0.15)',
};

export default colors;
