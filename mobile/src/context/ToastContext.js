import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../theme';

const ToastContext = createContext({
  showToast: () => {},
  hideToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function SuccessIcon({ size = 20, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" strokeOpacity="0.3" fill="rgba(16, 185, 129, 0.12)" />
      <Path d="M8 12.5L10.5 15L16 9.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function InfoIcon({ size = 20, color = '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" strokeOpacity="0.3" fill="rgba(56, 189, 248, 0.12)" />
      <Path d="M12 16V12M12 8H12.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function WarningIcon({ size = 20, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" strokeOpacity="0.3" fill="rgba(245, 158, 11, 0.12)" />
      <Path d="M12 8V12M12 16H12.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ToastProvider({ children }) {
  const [toastConfig, setToastConfig] = useState(null);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastConfig(null);
    });
  }, [translateY, opacity]);

  const showToast = useCallback(
    ({
      type = 'success',
      title = 'Event Recorded',
      message = '',
      subtitle = '',
      badge = '',
      calories = null,
      macros = null,
      duration = 3200,
    }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setToastConfig({
        type,
        title,
        message: message || subtitle,
        badge,
        calories,
        macros,
      });

      translateY.setValue(-120);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [translateY, opacity, hideToast]
  );

  const topPosition = Math.max(insets.top, 14) + (Platform.OS === 'android' ? 8 : 4);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toastConfig && (
        <Animated.View
          style={[
            styles.toastWrapper,
            {
              top: topPosition,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={hideToast}
            style={[
              styles.toastContainer,
              toastConfig.type === 'success' && styles.toastSuccess,
              toastConfig.type === 'warning' && styles.toastWarning,
              toastConfig.type === 'info' && styles.toastInfo,
            ]}
          >
            <View style={styles.iconContainer}>
              {toastConfig.type === 'success' && <SuccessIcon />}
              {toastConfig.type === 'warning' && <WarningIcon />}
              {toastConfig.type === 'info' && <InfoIcon />}
            </View>

            <View style={styles.contentContainer}>
              <View style={styles.headerRow}>
                <Text style={styles.titleText} numberOfLines={1}>
                  {toastConfig.title}
                </Text>
                {toastConfig.badge ? (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>{toastConfig.badge}</Text>
                  </View>
                ) : null}
              </View>

              {toastConfig.message ? (
                <Text style={styles.messageText} numberOfLines={2}>
                  {toastConfig.message}
                </Text>
              ) : null}

              {toastConfig.macros ? (
                <View style={styles.macroPillsRow}>
                  {toastConfig.macros.protein !== undefined && (
                    <Text style={[styles.macroPill, { color: colors.protein || '#10B981' }]}>
                      P: {toastConfig.macros.protein}g
                    </Text>
                  )}
                  {toastConfig.macros.carbs !== undefined && (
                    <Text style={[styles.macroPill, { color: colors.carbs || '#F59E0B' }]}>
                      C: {toastConfig.macros.carbs}g
                    </Text>
                  )}
                  {toastConfig.macros.fat !== undefined && (
                    <Text style={[styles.macroPill, { color: colors.fatText || '#FB7185' }]}>
                      F: {toastConfig.macros.fat}g
                    </Text>
                  )}
                </View>
              ) : null}
            </View>

            {toastConfig.calories ? (
              <View style={styles.calorieBubble}>
                <Text style={styles.calorieVal}>+{toastConfig.calories}</Text>
                <Text style={styles.calorieUnit}>kcal</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 20,
    alignItems: 'center',
  },
  toastContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 19, 24, 0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
  },
  toastSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: '#111614',
  },
  toastWarning: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: '#18140E',
  },
  toastInfo: {
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: '#0F161C',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  badgePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  macroPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  macroPill: {
    fontSize: 10,
    fontWeight: '600',
  },
  calorieBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  calorieVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  calorieUnit: {
    fontSize: 9,
    color: '#6EE7B7',
    fontWeight: '600',
  },
});
