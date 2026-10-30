import { Platform } from 'react-native';

/**
 * Cross-Platform Elevation & Shadow System for FitScan Mobile
 * Uses Platform.select to provide subtle iOS shadow properties (shadowColor, shadowOffset, shadowRadius, shadowOpacity)
 * and Android native elevation with visual parity.
 */

export const shadows = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 2.2,
    },
    android: { elevation: 2 },
    default: { elevation: 2 },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.30,
      shadowRadius: 4.6,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.38,
      shadowRadius: 8.0,
    },
    android: { elevation: 8 },
    default: { elevation: 8 },
  }),
  primaryGlow: Platform.select({
    ios: {
      shadowColor: '#E8A020',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.40,
      shadowRadius: 6.0,
    },
    android: { elevation: 4 },
    default: { elevation: 4 },
  }),
};

export default shadows;
