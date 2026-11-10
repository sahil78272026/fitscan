import { Platform } from 'react-native';

/**
 * Cross-Platform Elevation & Shadow System for FitScan Mobile
 * Obsidian Biometric Luxury Standard
 * Uses Platform.select to provide subtle iOS shadow properties (shadowColor, shadowOffset, shadowRadius, shadowOpacity)
 * and Android native elevation with visual parity.
 */

export const shadows = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.35,
      shadowRadius: 3.0,
    },
    android: { elevation: 2 },
    default: { elevation: 2 },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.45,
      shadowRadius: 6.0,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.55,
      shadowRadius: 12.0,
    },
    android: { elevation: 8 },
    default: { elevation: 8 },
  }),
  primaryGlow: Platform.select({
    ios: {
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.45,
      shadowRadius: 8.0,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
  emeraldGlow: Platform.select({
    ios: {
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.40,
      shadowRadius: 8.0,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
  iceBlueGlow: Platform.select({
    ios: {
      shadowColor: '#38BDF8',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.40,
      shadowRadius: 8.0,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
  purpleGlow: Platform.select({
    ios: {
      shadowColor: '#A855F7',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.40,
      shadowRadius: 8.0,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
  floatingBar: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.50,
      shadowRadius: 16.0,
    },
    android: { elevation: 12 },
    default: { elevation: 12 },
  }),
};

export default shadows;
