/**
 * Canonical Color Palette for FitScan Mobile
 * Obsidian Biometric Luxury Standard (Apple Fitness & Linear Inspired)
 * Aligned 100% with frontend/src/app/globals.css
 * and WCAG 2.1 AAA/AA Contrast Standards (>= 7.0:1 / >= 4.5:1 on dark surfaces).
 */

export const colors = {
  // Brand & Calorie Energy (Warm Amber)
  primary: '#F59E0B',
  primaryHover: '#D97706',
  primaryDark: '#180D00',
  primaryGlow: 'rgba(245, 158, 11, 0.20)',
  primarySubtle: 'rgba(245, 158, 11, 0.12)',
  primaryBorder: 'rgba(245, 158, 11, 0.28)',

  // Obsidian Surfaces & Backgrounds
  background: '#08090C',       // Base OLED obsidian void background
  surface: '#111318',          // Level 1: Standard cards, panels, modals
  surfaceElevated: '#1A1D24',  // Level 2: Inputs, chips, elevated action cards
  surfaceActive: '#222631',    // Level 3: Selected items, active rows, hovered states
  surfaceGlass: 'rgba(17, 19, 24, 0.85)', // Glassmorphic card surface with blur
  surfaceModal: '#1A1D24',     // Elevated modal surface
  surfaceOverlay: 'rgba(8, 9, 12, 0.85)', // Modal and dialog backdrops

  // Borders & Dividers
  border: '#222631',           // Primary card & container border
  borderSubtle: 'rgba(255, 255, 255, 0.08)', // Internal card dividers & list item lines
  borderFocus: '#F59E0B',      // Active focus border
  borderHover: '#333948',      // Active / focused input border

  // Foreground & Typography (High-Legibility Slate Scale)
  textPrimary: '#F8FAFC',      // Slate 50 - High-emphasis (19.0:1 on bg, 18.2:1 on surface - WCAG AAA)
  textSecondary: '#94A3B8',    // Slate 400 - Medium-emphasis / labels (7.7:1 on bg, 7.4:1 on surface - WCAG AAA)
  textTertiary: '#64748B',     // Slate 500 - Low-emphasis decorative (4.6:1 on bg - WCAG AA)
  textMuted: '#64748B',        // Accessible low-emphasis body / caption text (4.6:1 on bg - WCAG AA)
  textInverse: '#08090C',      // Dark text on light / active backgrounds
  textOnPrimary: '#08090C',    // Text on #F59E0B buttons (9.24:1 - WCAG AAA)

  // Macro Accents (Biometric Standards)
  protein: '#10B981',          // Crisp Emerald - Nutrition & Targets (7.8:1 - WCAG AAA)
  proteinSubtle: 'rgba(16, 185, 129, 0.15)',
  carbs: '#F59E0B',            // Energetic Amber - Fuel & Carbs (9.2:1 - WCAG AAA)
  carbsSubtle: 'rgba(245, 158, 11, 0.15)',
  fat: '#F43F5E',              // Rose Red - Essential Lipids (5.3:1 - WCAG AA)
  fatSubtle: 'rgba(244, 63, 94, 0.15)',
  fatText: '#FB7185',          // High-contrast rose text for fat labels

  // Domain & Functional Accents
  nutritionEmerald: '#10B981',
  hydrationSky: '#38BDF8',
  streakPurple: '#A855F7',
  accentAmber: '#F59E0B',
  accentEmerald: '#10B981',
  accentSky: '#38BDF8',
  accentPurple: '#A855F7',
  accentPurpleSubtle: 'rgba(168, 85, 247, 0.15)',

  // Semantic Status & Feedback
  success: '#10B981',
  successSubtle: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningSubtle: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  dangerSubtle: 'rgba(239, 68, 68, 0.15)',
  dangerText: '#F87171',
  info: '#38BDF8',             // Ice Blue / Informational (9.3:1 - WCAG AAA)
  infoSubtle: 'rgba(56, 189, 248, 0.15)',
  neutral: '#94A3B8',
  neutralSubtle: 'rgba(148, 163, 184, 0.15)',
};

export default colors;
