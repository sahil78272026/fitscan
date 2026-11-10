import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Animated,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  Modal,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { Card, Button, Badge } from '../components/ui';
import MealDetailModal from '../components/MealDetailModal';
import MealCard from '../components/MealCard';
import DynamicGreetingHeader from '../components/DynamicGreetingHeader';
import ContextualMilestoneCard from '../components/ContextualMilestoneCard';
import { estimateMealCost } from '../utils/mealCostEstimator';
import {
  getDailySummary,
  getCalendarMonth,
  getAdherenceStats,
  getMorningBriefing,
  logMeal,
  deleteMeal,
  getSettings,
  logWeight,
  getWeightHistory,
} from '../services/api';
import RecentMealsChips from '../components/RecentMealsChips';
import AdherenceCard from '../components/AdherenceCard';
import MorningBriefingCard from '../components/MorningBriefingCard';
import OnboardingModal from '../components/OnboardingModal';
import MealPlanSelectorModal from '../components/MealPlanSelectorModal';
import MissedMealBanner from '../components/MissedMealBanner';
import ProUpgradeModal from '../components/ProUpgradeModal';
import useSubscription from '../hooks/useSubscription';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// --- Semantic Vector SVG Icons (Zero Raw Emojis) ---

function DumbbellIcon({ size = 20, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 5v14M18 5v14M2 8v8M22 8v8M6 12h12"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FlameIcon({ size = 16, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 14.5A2.5 2.5 0 0011 17c1.38 0 2.5-1.12 2.5-2.5 0-1.63-1.07-2.91-1.5-3.5-.43.59-1.5 1.87-1.5 3.5zM12 2c-1.5 3-4.5 5.5-4.5 9.5a6.5 6.5 0 0013 0c0-4-3-6.5-4.5-9.5-1 2-2.5 3-4 0z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AlertTriangleIcon({ size = 18, color = colors.danger || '#EF4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ZapIcon({ size = 16, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SearchIcon({ size = 16, color = colors.textSecondary || '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function PlateUtensilsIcon({ size = 32, color = colors.textMuted || '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.4" strokeDasharray="2 2" />
      <Path d="M12 7v10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function CloseIcon({ size = 14, color = colors.textSecondary || '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const getInitialMealType = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
};

export default function HomeScreen({ navigation, user, onLogout }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 12 : 0);

  const {
    isPro,
    trialDaysRemaining,
    hasAccess,
    refreshSubscription,
    openPaywall,
    closePaywall,
    isPaywallOpen,
  } = useSubscription(user);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [mealType, setMealType] = useState(getInitialMealType);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [weightData, setWeightData] = useState(null);

  // Planned Meals State
  const [loggingPlannedMeal, setLoggingPlannedMeal] = useState(null);
  const [selectedPlannedMealModal, setSelectedPlannedMealModal] = useState(null);

  // Calendar State
  const [calendarData, setCalendarData] = useState(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);

  // Adherence & Streak State
  const [adherenceStats, setAdherenceStats] = useState(null);

  // Morning Briefing State
  const [morningBriefing, setMorningBriefing] = useState(null);
  const [briefingDismissed, setBriefingDismissed] = useState(false);

  // Onboarding & Meal Plan State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);
  const [userSettings, setUserSettings] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const hasCheckedOnboarding = React.useRef(false);

  // Animated scroll tracking for buttery-smooth header streak transition
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerStreakOpacity = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerStreakTranslateY = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  });

  const headerStreakScale = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [0.85, 1],
    extrapolate: 'clamp',
  });

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const scrolled = offsetY > 25;
    if (scrolled !== isScrolled) {
      setIsScrolled(scrolled);
    }
  };

  const formatDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isToday = formatDateStr(selectedDate) === formatDateStr(new Date());

  // Active Plan parsing for Planned Meals widget
  const activePlan = useMemo(() => {
    const raw = userSettings?.selected_meal_plan;
    if (!raw) return null;
    if (typeof raw === 'object') return Object.keys(raw).length > 0 ? raw : null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }, [userSettings]);

  const isPlannedMealLogged = useCallback(
    (plannedMeal) => {
      if (!summary?.meals?.length || !plannedMeal) return false;
      const pType = (plannedMeal.meal_type || '').toLowerCase().trim();
      const pName = (plannedMeal.dish_name || '').toLowerCase().trim();
      return summary.meals.some((logged) => {
        const lType = (logged.meal_type || '').toLowerCase().trim();
        const lRaw = (logged.raw_input || '').toLowerCase().trim();
        return (pType && lType === pType) || (pName && lRaw && (lRaw.includes(pName) || pName.includes(lRaw)));
      });
    },
    [summary?.meals]
  );

  const getCurrentMealIndex = (meals = []) => {
    const hour = new Date().getHours();
    let currentType = 'dinner';
    if (hour < 11) currentType = 'breakfast';
    else if (hour < 16) currentType = 'lunch';
    else if (hour < 19) currentType = 'snack';

    const idx = meals.findIndex(
      (m) => (m.meal_type || '').toLowerCase() === currentType
    );
    return idx >= 0 ? idx : 0;
  };

  const handleLogPlannedMeal = async (plannedMeal) => {
    if (!hasAccess) {
      openPaywall('log_meal');
      return;
    }
    if (!userSettings?.height_cm || !userSettings?.weight_kg) {
      Alert.alert(
        'Goal Required',
        'Please set your fitness and calorie goal before logging meals.',
        [
          { text: 'Set Goal', onPress: () => setWizardOpen(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    const mealTypeLower = (plannedMeal.meal_type || 'lunch').toLowerCase();
    try {
      setLoggingPlannedMeal(mealTypeLower);
      const dateStr = formatDateStr(selectedDate);
      await logMeal(plannedMeal.dish_name, mealTypeLower, dateStr);
      await loadData();
      Alert.alert(
        'Logged to Today',
        `${plannedMeal.dish_name} (${plannedMeal.calories} kcal) added to your diary.`
      );
      if (selectedPlannedMealModal) {
        setSelectedPlannedMealModal(null);
      }
    } catch (err) {
      if (err.status === 402 || err.code === 'TRIAL_EXPIRED') {
        openPaywall('log_meal');
        return;
      }
      Alert.alert('Logging Failed', err.message || 'Failed to log planned meal.');
    } finally {
      setLoggingPlannedMeal(null);
    }
  };

  const fetchCalendar = useCallback(async (y, m) => {
    try {
      const res = await getCalendarMonth(y, m);
      setCalendarData(res);
    } catch (err) {
      console.warn('Calendar fetch error:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const dateStr = formatDateStr(selectedDate);
      const sumData = await getDailySummary(dateStr);
      setSummary(sumData);
      
      const selYear = selectedDate.getFullYear();
      const selMonth = selectedDate.getMonth() + 1;
      setCalendarYear(selYear);
      setCalendarMonth(selMonth);

      // Fetch calendar, adherence streak stats, weight history, and check onboarding status
      const promises = [
        fetchCalendar(selYear, selMonth),
        getAdherenceStats().then(setAdherenceStats).catch(() => null),
        getWeightHistory(30).then(setWeightData).catch(() => null),
        getSettings().then((settings) => {
          setUserSettings(settings);
          // Until a user fixes their metrics, it reappears:
          if (!settings?.height_cm || !settings?.weight_kg) {
            setWizardOpen(true);
          } else if (!settings?.selected_meal_plan && !hasCheckedOnboarding.current) {
            hasCheckedOnboarding.current = true;
            setPlanSelectorOpen(true);
          }
        }).catch(() => null),
      ];

      if (isToday) {
        promises.push(
          (async () => {
            try {
              const todayStr = formatDateStr(new Date());
              const dismissed = await AsyncStorage.getItem('briefing_dismissed_date');
              if (dismissed === todayStr) {
                setBriefingDismissed(true);
                return;
              }
              const briefingRes = await getMorningBriefing();
              if (briefingRes && briefingRes.visible && briefingRes.briefing) {
                setMorningBriefing(briefingRes);
              }
            } catch (bErr) {
              // fail silently
            }
          })()
        );
      }

      await Promise.all(promises);
    } catch (err) {
      if (__DEV__) {
        console.warn('Dashboard load error:', err);
      }
      setLoadError(err.message || 'Unable to connect to server. Please check your internet connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, fetchCalendar, isToday]);

  const handleWizardComplete = (updatedSettings) => {
    setUserSettings(updatedSettings);
    setWizardOpen(false);
    setPlanSelectorOpen(true);
  };

  const handlePlanSelected = (updatedSettings) => {
    setUserSettings(updatedSettings);
    setPlanSelectorOpen(false);
    loadData();
  };

  const handleTriggerMealLog = (targetType, defaultDish) => {
    if (targetType) {
      setMealType(targetType.toLowerCase());
    }
    if (defaultDish) {
      setRawInput(defaultDish);
    }
  };

  // Automatically reload data whenever selectedDate changes
  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      refreshSubscription();
      loadData();
    }, [loadData, refreshSubscription])
  );

  const handleLogMeal = async () => {
    if (!hasAccess) {
      openPaywall('log_meal');
      return;
    }
    if (!userSettings?.height_cm || !userSettings?.weight_kg) {
      Alert.alert(
        'Goal Required',
        'Please set your fitness and calorie goal before logging meals.',
        [
          { text: 'Set Goal', onPress: () => setWizardOpen(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    if (!rawInput.trim()) {
      Alert.alert('Empty Input', 'Please type a meal description or use photo scan.');
      return;
    }
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const dateStr = formatDateStr(selectedDate);
      await logMeal(rawInput.trim(), mealType, dateStr);
      setRawInput('');
      await loadData();
      Alert.alert('Success', 'Meal logged and macros updated.');
    } catch (err) {
      if (err.status === 402 || err.code === 'TRIAL_EXPIRED') {
        openPaywall('log_meal');
        return;
      }
      Alert.alert('Error', err.message || 'Failed to log meal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    Alert.alert('Delete Meal', 'Are you sure you want to remove this meal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMeal(mealId);
            await loadData();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete meal');
          }
        },
      },
    ]);
  };

  const handleQuickLogWeight = async () => {
    const w = parseFloat(newWeight);
    if (!w || w < 25 || w > 300) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight between 25 and 300 kg');
      return;
    }
    try {
      await logWeight(w);
      setNewWeight('');
      Alert.alert('Weight Saved', `Logged ${w} kg`);
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to log weight');
    }
  };

  const consumedCals = summary?.total_calories || 0;
  const goalCals = summary?.calorie_goal || 2000;
  const remainingCals = Math.max(0, goalCals - consumedCals);
  const isSurplus = consumedCals > goalCals;
  const surplusCals = isSurplus ? consumedCals - goalCals : 0;
  const calPercent = Math.min((consumedCals / goalCals) * 100, 100).toFixed(0);

  const dateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: topInset }, isScrolled && styles.topHeaderShadow]}>
        <View style={styles.logoRow}>
          <DumbbellIcon size={22} color={colors.primary || '#F59E0B'} />
          <Text style={styles.logoText}>CoreControl</Text>
        </View>

        {/* Smooth Animated Streak Pill moving to header when scrolling past banner */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.headerCenter,
            {
              opacity: headerStreakOpacity,
              transform: [
                { translateY: headerStreakTranslateY },
                { scale: headerStreakScale },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.streakHeaderPill}
            onPress={() => navigation.navigate('Streak')}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Streak: ${adherenceStats?.current_streak ?? 0} days. Tap to view streak and achievements.`}
          >
            <FlameIcon size={13} color={colors.primary || '#F59E0B'} />
            <Text style={styles.streakHeaderText}>
              {adherenceStats?.current_streak ?? 0}d
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.headerRight}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <TouchableOpacity
            style={styles.headerAvatarBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.headerAvatarImg} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {(user?.name || user?.email || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true, listener: handleScroll }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary || '#F59E0B'}
          />
        }
      >
        {/* Offline / Connection Error Banner with Tap to Retry */}
        {loadError && (
          <View style={styles.errorBannerContainer}>
            <View style={styles.errorBannerLeft}>
              <AlertTriangleIcon size={20} color={colors.danger || '#EF4444'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorBannerTitle}>Connection Error</Text>
                <Text style={styles.errorBannerSubtitle} numberOfLines={2}>
                  {loadError}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => loadData()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Tap to Retry"
            >
              <Text style={styles.retryButtonText}>Tap to Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dynamic Personalized Greeting Header */}
        <DynamicGreetingHeader
          user={user}
          userSettings={userSettings}
          summary={summary}
          navigation={navigation}
          adherenceStats={adherenceStats}
        />

        {/* Contextual Milestones (Celebration & Upcoming) */}
        <ContextualMilestoneCard
          adherenceStats={adherenceStats}
          weightData={weightData}
          summary={summary}
          userSettings={userSettings}
          navigation={navigation}
        />

        {/* Compact Streak Banner matching Web (stable, non-jerking) */}
        <TouchableOpacity
          style={styles.streakBanner}
          onPress={() => navigation.navigate('Streak')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Streak banner: ${adherenceStats?.current_streak ?? 0} day streak, ${Math.round(adherenceStats?.weekly_adherence_score ?? 0)}% weekly adherence. Tap to view details.`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FlameIcon size={16} color={colors.primary || '#F59E0B'} />
            <Text style={styles.streakBannerText}>
              <Text style={styles.boldText}>{adherenceStats?.current_streak ?? 0}</Text> day streak
            </Text>
          </View>
          <Text style={styles.streakDot}>•</Text>
          <Text style={styles.streakBannerSub}>
            {Math.round(adherenceStats?.weekly_adherence_score ?? 0)}% weekly
          </Text>
          <Text style={styles.streakArrow}>→</Text>
        </TouchableOpacity>

        {/* Daily Nutrition & Calorie Budget Card */}
        <View style={styles.card}>
          {/* Header Row */}
          <View style={styles.nutritionBudgetHeader}>
            <View>
              <Text style={styles.cardTitle}>Daily Calorie Budget</Text>
              <Text style={styles.nutritionBudgetSub}>
                {isSurplus
                  ? `Over budget by ${surplusCals.toLocaleString()} kcal`
                  : `Target: ${goalCals.toLocaleString()} kcal • ${calPercent}% consumed`}
              </Text>
            </View>
            <Badge
              variant={isSurplus ? 'danger' : 'primary'}
              label={`${calPercent}% Goal`}
              size="sm"
            />
          </View>

          {/* Centered Circular Progress Ring (Tappable -> Opens MyActivity Screen) */}
          <TouchableOpacity
            style={styles.fitRingContainer}
            onPress={() =>
              navigation.navigate('ActivityDetail', {
                selectedDate: formatDateStr(selectedDate),
                summary,
                calendarData,
                initialTab: 'calories',
              })
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Calorie progress: ${consumedCals} of ${goalCals} kcal eaten. Tap to view activity details.`}
          >
            {/* 3D Gauge Outer Casing & Shadow Well */}
            <View style={styles.fitRingCasing3D}>
              <View style={styles.fitRingOuter}>
                <View style={styles.fitRingInner}>
                  <Text style={styles.fitRingValue}>
                    {consumedCals.toLocaleString()}
                  </Text>
                  <Text style={styles.fitRingSub}>
                    KCAL CONSUMED
                  </Text>
                  <View
                    style={[
                      styles.deficitStatusPill,
                      isSurplus ? styles.deficitStatusSurplus : styles.deficitStatusDeficit,
                    ]}
                  >
                    <Text
                      style={[
                        styles.deficitStatusText,
                        isSurplus && { color: colors.dangerText || '#F87171' },
                      ]}
                    >
                      {isSurplus
                        ? `+${surplusCals.toLocaleString()} kcal surplus`
                        : `${remainingCals.toLocaleString()} kcal left`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* 3 Metric Nutrition Stats Row: Protein • Carbs • Fat */}
          <View style={styles.fitStatsRow}>
            <View style={styles.fitStatItem}>
              <Text style={[styles.fitStatVal, { color: colors.protein }]}>
                {summary?.total_protein || 0}g
              </Text>
              <Text style={styles.fitStatLbl}>
                Protein ({summary?.protein_goal || 150}g)
              </Text>
            </View>
            <View style={styles.fitStatDivider} />
            <View style={styles.fitStatItem}>
              <Text style={[styles.fitStatVal, { color: colors.carbs }]}>
                {summary?.total_carbs || 0}g
              </Text>
              <Text style={styles.fitStatLbl}>
                Carbs ({summary?.carbs_goal || 200}g)
              </Text>
            </View>
            <View style={styles.fitStatDivider} />
            <View style={styles.fitStatItem}>
              <Text style={[styles.fitStatVal, { color: colors.fatText || '#F87171' }]}>
                {summary?.total_fat || 0}g
              </Text>
              <Text style={styles.fitStatLbl}>
                Fat ({summary?.fat_goal || 65}g)
              </Text>
            </View>
          </View>

          {/* Mini Macro Distribution Progress Bars */}
          <View style={styles.miniMacroTracksContainer}>
            <View style={styles.miniMacroTrackItem}>
              <View style={styles.miniMacroTrackHeader}>
                <Text style={[styles.miniMacroTrackName, { color: colors.protein }]}>Protein</Text>
                <Text style={styles.miniMacroTrackPct}>
                  {Math.round(((summary?.total_protein || 0) / (summary?.protein_goal || 150)) * 100)}%
                </Text>
              </View>
              <View style={styles.miniMacroTrackBg}>
                <View
                  style={[
                    styles.miniMacroTrackFill,
                    {
                      width: `${Math.min(((summary?.total_protein || 0) / (summary?.protein_goal || 150)) * 100, 100)}%`,
                      backgroundColor: colors.protein,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.miniMacroTrackItem}>
              <View style={styles.miniMacroTrackHeader}>
                <Text style={[styles.miniMacroTrackName, { color: colors.carbs }]}>Carbs</Text>
                <Text style={styles.miniMacroTrackPct}>
                  {Math.round(((summary?.total_carbs || 0) / (summary?.carbs_goal || 200)) * 100)}%
                </Text>
              </View>
              <View style={styles.miniMacroTrackBg}>
                <View
                  style={[
                    styles.miniMacroTrackFill,
                    {
                      width: `${Math.min(((summary?.total_carbs || 0) / (summary?.carbs_goal || 200)) * 100, 100)}%`,
                      backgroundColor: colors.carbs,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.miniMacroTrackItem}>
              <View style={styles.miniMacroTrackHeader}>
                <Text style={[styles.miniMacroTrackName, { color: colors.fatText || '#F87171' }]}>Fat</Text>
                <Text style={styles.miniMacroTrackPct}>
                  {Math.round(((summary?.total_fat || 0) / (summary?.fat_goal || 65)) * 100)}%
                </Text>
              </View>
              <View style={styles.miniMacroTrackBg}>
                <View
                  style={[
                    styles.miniMacroTrackFill,
                    {
                      width: `${Math.min(((summary?.total_fat || 0) / (summary?.fat_goal || 65)) * 100, 100)}%`,
                      backgroundColor: colors.fat,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Quick Nutrition Insights Footer */}
          <TouchableOpacity
            style={styles.nutritionCardFooter}
            onPress={() =>
              navigation.navigate('ActivityDetail', {
                selectedDate: formatDateStr(selectedDate),
                summary,
                calendarData,
                initialTab: 'calories',
              })
            }
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View full nutrition activity breakdown"
          >
            <View style={styles.fitFooterLeft}>
              <View style={[styles.fitStatusDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.fitFooterHint}>
                {summary?.meal_count || 0} meals logged today • Tap for detailed analytics
              </Text>
            </View>
            <Text style={styles.fitFooterArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Planned Meals Quick-Access Widget */}
        {isToday && activePlan?.meals?.length > 0 && (
          <View style={styles.plannedMealsContainer}>
            <View style={styles.plannedHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Today's Planned Meals</Text>
                <Text style={styles.plannedSubTitle}>
                  {activePlan.title || 'AI Daily Schedule'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('Meals')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="View full meal plan schedule"
              >
                <Text style={styles.viewPlanLink}>View Plan →</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.plannedScrollRow}
            >
              {activePlan.meals.map((m, idx) => {
                const typeLower = (m.meal_type || 'lunch').toLowerCase();
                const logged = isPlannedMealLogged(m);
                const isCurrentSlot = getCurrentMealIndex(activePlan.meals) === idx;
                const isLoggingThis = loggingPlannedMeal === typeLower;
                const costInfo = estimateMealCost(m, activePlan, userSettings);

                return (
                  <Card
                    key={idx}
                    variant={isCurrentSlot ? 'highlight' : 'default'}
                    style={[
                      styles.plannedMealCard,
                      isCurrentSlot && { borderColor: colors.primary },
                    ]}
                    onPress={() => setSelectedPlannedMealModal(m)}
                  >
                    {/* Header */}
                    <View style={styles.plannedCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.plannedTypeTag}>{(m.meal_type || 'MEAL').toUpperCase()}</Text>
                        {isCurrentSlot && (
                          <Badge variant="primary" size="sm" label="Next Up" />
                        )}
                      </View>
                      <Text style={styles.plannedCals}>{m.calories} kcal</Text>
                    </View>

                    {/* Dish Title */}
                    <Text style={styles.plannedDishName} numberOfLines={2}>
                      {m.dish_name}
                    </Text>

                    {/* Macros & Cost Badges */}
                    <View style={styles.plannedMacroRow}>
                      <Text style={styles.plannedMacroText}>
                        P: <Text style={{ color: colors.protein, fontWeight: '700' }}>{m.protein}g</Text> • C: {m.carbs}g
                      </Text>
                      <Badge variant="warning" size="sm" label={costInfo.formatted} />
                    </View>

                    {/* 1-Tap Action Button */}
                    <View style={styles.plannedActionArea}>
                      {logged ? (
                        <Badge
                          variant="success"
                          label="Logged to Diary"
                          size="md"
                          style={{ width: '100%', justifyContent: 'center' }}
                        />
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          title="Log to Today"
                          loading={isLoggingThis}
                          onPress={() => handleLogPlannedMeal(m)}
                        />
                      )}
                    </View>
                  </Card>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Morning Welcome Feedback & Improvements Card */}
        {isToday && morningBriefing && !briefingDismissed && (
          <MorningBriefingCard
            briefingData={morningBriefing}
            onDismiss={async () => {
              setBriefingDismissed(true);
              const todayStr = formatDateStr(new Date());
              await AsyncStorage.setItem('briefing_dismissed_date', todayStr);
            }}
            onLogBreakfast={() => {
              setMealType('breakfast');
            }}
          />
        )}

        {/* Missed Meal Alert Banner */}
        {isToday && (
          <MissedMealBanner
            user={user}
            userSettings={userSettings}
            summary={summary}
            isToday={isToday}
            onLogMeal={handleTriggerMealLog}
          />
        )}

        {/* Quick Log Meal Section */}
        {isToday && (
          <Card variant="default" style={styles.quickLogCard}>
            {/* Card Header with Icon, Subtitle, and Active Badge */}
            <View style={styles.quickLogHeaderRow}>
              <View style={styles.quickLogHeaderLeft}>
                <View style={styles.quickLogTitleRow}>
                  <ZapIcon size={18} color={colors.primary || '#F59E0B'} />
                  <Text style={styles.quickLogTitle}>Quick Log Meal</Text>
                </View>
                <Text style={styles.quickLogSubTitle}>
                  Type food or snap a photo for instant macro breakdown
                </Text>
              </View>
              <Badge
                variant="primary"
                label={mealType.toUpperCase()}
                size="sm"
              />
            </View>

            {/* Enhanced Input Field with Leading Icon, Focus Glow & Clear Button */}
            <View
              style={[
                styles.quickLogInputWrapper,
                isInputFocused && styles.quickLogInputFocused,
              ]}
            >
              <SearchIcon size={16} color={colors.textSecondary || '#94A3B8'} />
              <TextInput
                style={styles.quickLogTextInput}
                placeholder="e.g. 2 eggs, 1 toast with butter"
                placeholderTextColor={colors.textSecondary || '#94A3B8'}
                value={rawInput}
                onChangeText={setRawInput}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                returnKeyType="done"
                onSubmitEditing={handleLogMeal}
                blurOnSubmit
              />
              {rawInput.length > 0 && (
                <TouchableOpacity
                  style={styles.quickLogClearBtn}
                  onPress={() => setRawInput('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear meal description"
                >
                  <CloseIcon size={12} color={colors.textSecondary || '#94A3B8'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Meal Type Pills */}
            <View style={styles.quickLogTypeRow}>
              {['breakfast', 'lunch', 'snack', 'dinner'].map((t) => {
                const isSelected = mealType === t;
                const label = t.charAt(0).toUpperCase() + t.slice(1);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.quickLogTypePill,
                      isSelected && styles.quickLogTypePillActive,
                    ]}
                    onPress={() => setMealType(t)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${label} meal`}
                  >
                    <Text
                      style={[
                        styles.quickLogTypePillText,
                        isSelected && styles.quickLogTypePillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Previously Eaten Meal Suggestions */}
            <RecentMealsChips
              recentItems={summary?.recent_items}
              currentMealType={mealType}
              onSelectSuggestion={(itemName) => {
                setRawInput((prev) => {
                  const trimmed = prev.trim();
                  if (!trimmed) return itemName;
                  return `${trimmed}, ${itemName}`;
                });
              }}
              onQuickLog={async (item) => {
                if (!hasAccess) {
                  openPaywall('log_meal');
                  return;
                }
                if (!userSettings?.height_cm || !userSettings?.weight_kg) {
                  Alert.alert(
                    'Goal Required',
                    'Please set your fitness and calorie goal before logging meals.',
                    [
                      { text: 'Set Goal', onPress: () => setWizardOpen(true) },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                  return;
                }
                const itemMealType = (item.meal_type || mealType).toLowerCase();
                try {
                  setSubmitting(true);
                  const dateStr = formatDateStr(selectedDate);
                  await logMeal(item.name, itemMealType, dateStr);
                  await loadData();
                  Alert.alert('Meal Logged', `${item.name} added to today's diary.`);
                } catch (err) {
                  if (err.status === 402 || err.code === 'TRIAL_EXPIRED') {
                    openPaywall('log_meal');
                    return;
                  }
                  Alert.alert('Logging Failed', err.message || 'Failed to log meal.');
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            />

            {/* Symmetrical Action Buttons Row */}
            <View style={styles.quickLogActionRow}>
              <Button
                title="Log Meal"
                onPress={handleLogMeal}
                loading={submitting}
                variant="primary"
                size="md"
                style={styles.quickLogBtnFlex}
                disabled={submitting}
              />
              <Button
                title="Scan Photo"
                onPress={() => {
                  if (!hasAccess) {
                    openPaywall('scan_meal');
                    return;
                  }
                  if (!userSettings?.height_cm || !userSettings?.weight_kg) {
                    Alert.alert(
                      'Goal Required',
                      'Please set your fitness and calorie goal before scanning meals.',
                      [
                        { text: 'Set Goal', onPress: () => setWizardOpen(true) },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                    return;
                  }
                  navigation.navigate('Scan', { mealDate: formatDateStr(selectedDate) });
                }}
                variant="secondary"
                size="md"
                style={styles.quickLogBtnFlex}
                disabled={submitting}
              />
            </View>
          </Card>
        )}

        {/* Logged Meals List */}
        <View style={styles.card}>
          <View style={styles.mealsHeader}>
            <Text style={styles.cardTitle}>Logged Meals</Text>
            <Badge label={`${summary?.meal_count || 0} meals`} variant="neutral" size="sm" />
          </View>

          {summary?.meals?.length === 0 ? (
            <View style={styles.emptyBox}>
              <PlateUtensilsIcon size={36} color={colors.textMuted || '#64748B'} />
              <Text style={styles.emptyText}>No meals logged for this date</Text>
            </View>
          ) : (
            summary?.meals?.map((m) => (
              <MealCard
                key={m.id}
                meal={m}
                isToday={isToday}
                onDelete={handleDeleteMeal}
                onPreviewImage={setPreviewImage}
              />
            ))
          )}
        </View>
      </Animated.ScrollView>

      {/* Meal Image Full Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.imageModalBg}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setPreviewImage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CloseIcon size={14} color={colors.textPrimary || '#F8FAFC'} />
              <Text style={styles.imageModalCloseText}>Close</Text>
            </View>
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.imageModalImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Onboarding Wizard Modal for New Users */}
      <OnboardingModal
        visible={wizardOpen}
        initialSettings={userSettings}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      {/* AI Meal Plan Generator Modal */}
      <MealPlanSelectorModal
        visible={planSelectorOpen}
        onClose={() => setPlanSelectorOpen(false)}
        onPlanSelected={handlePlanSelected}
        onBackToWizard={() => {
          setPlanSelectorOpen(false);
          setWizardOpen(true);
        }}
      />

      {/* Shared Meal Detail Modal */}
      <MealDetailModal
        visible={Boolean(selectedPlannedMealModal)}
        meal={selectedPlannedMealModal}
        selectedPlan={activePlan}
        userSettings={userSettings}
        isAlreadyLogged={isPlannedMealLogged(selectedPlannedMealModal)}
        isLogging={loggingPlannedMeal === (selectedPlannedMealModal?.meal_type || '').toLowerCase()}
        onLogMeal={handleLogPlannedMeal}
        onClose={() => setSelectedPlannedMealModal(null)}
      />

      {/* Monetization Paywall Modal */}
      <ProUpgradeModal
        visible={isPaywallOpen}
        onClose={closePaywall}
        daysRemaining={trialDaysRemaining}
        currentTier={isPro ? 'pro' : 'free'}
        onSuccess={refreshSubscription}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#08090C',
  },
  plannedMealsContainer: {
    marginBottom: spacing.cardPadding || 16,
  },
  plannedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.cardPadding || 16,
    marginBottom: spacing.sm || 8,
  },
  plannedSubTitle: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 2,
  },
  viewPlanLink: {
    color: colors.primary || '#F59E0B',
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '700',
  },
  plannedScrollRow: {
    paddingHorizontal: spacing.cardPadding || 16,
    gap: spacing.sm || 8,
  },
  plannedMealCard: {
    width: 250,
    minHeight: 170,
    justifyContent: 'space-between',
    backgroundColor: colors.surface || '#111318',
    borderColor: colors.border || '#222631',
  },
  plannedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  plannedTypeTag: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
  },
  plannedCals: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
  },
  plannedDishName: {
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    marginBottom: 8,
    minHeight: 38,
  },
  plannedMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  plannedMacroText: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#94A3B8',
  },
  plannedActionArea: {
    minHeight: 38,
    justifyContent: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background || '#08090C',
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#222631',
    zIndex: 20,
  },
  topHeaderShadow: {
    borderBottomColor: colors.border || '#222631',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary || '#F59E0B',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatarBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    overflow: 'hidden',
  },
  headerAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  headerAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: colors.primary || '#F59E0B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  streakHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle || 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: colors.primaryBorder || 'rgba(245, 158, 11, 0.28)',
    borderRadius: radius.full || 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  streakHeaderText: {
    color: colors.primary || '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface || '#111318',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    borderRadius: radius.md || 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  streakBannerText: {
    color: colors.textPrimary || '#F8FAFC',
    fontSize: 13,
  },
  boldText: {
    fontWeight: 'bold',
    color: colors.primary || '#F59E0B',
  },
  streakDot: {
    color: colors.textSecondary || '#94A3B8',
  },
  streakBannerSub: {
    color: colors.textSecondary || '#94A3B8',
    fontSize: 12,
    flex: 1,
  },
  streakArrow: {
    color: colors.primary || '#F59E0B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dateLabel: {
    fontSize: 12,
    color: colors.textSecondary || '#94A3B8',
  },
  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface || '#111318',
    borderRadius: radius.lg || 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary || '#F8FAFC',
    marginBottom: 12,
  },
  fitRingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  fitRingCasing3D: {
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: colors.background || '#08090C',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border || '#222631',
    elevation: 4,
    shadowColor: colors.primary || '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fitRingOuter: {
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface || '#111318',
    borderTopColor: colors.primary || '#F59E0B',
    borderLeftColor: colors.primary || '#F59E0B',
    borderRightColor: '#D97706',
    borderBottomColor: colors.surfaceActive || '#222631',
  },
  fitRingInner: {
    width: 114,
    height: 114,
    borderRadius: 57,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  fitRingValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary || '#F8FAFC',
    letterSpacing: -0.5,
  },
  fitRingSub: {
    fontSize: 10,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nutritionBudgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nutritionBudgetSub: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 2,
  },
  deficitStatusPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  deficitStatusDeficit: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  deficitStatusSurplus: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  deficitStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.protein || '#10B981',
  },
  nutritionCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  fitStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || 'rgba(255, 255, 255, 0.08)',
  },
  fitStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  fitStatVal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    marginBottom: 2,
  },
  fitStatLbl: {
    fontSize: 11,
    color: colors.textSecondary || '#94A3B8',
  },
  fitStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderSubtle || 'rgba(255, 255, 255, 0.08)',
  },
  miniMacroTracksContainer: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  miniMacroTrackItem: {
    marginBottom: 4,
  },
  miniMacroTrackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniMacroTrackName: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniMacroTrackPct: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary || '#94A3B8',
  },
  miniMacroTrackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    overflow: 'hidden',
  },
  miniMacroTrackFill: {
    height: 4,
    borderRadius: 2,
  },
  fitFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fitStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fitFooterHint: {
    fontSize: 11,
    color: colors.textSecondary || '#94A3B8',
    fontWeight: '500',
  },
  fitFooterArrow: {
    fontSize: 13,
    color: colors.primary || '#F59E0B',
    fontWeight: 'bold',
  },
  quickLogCard: {
    padding: 20,
    marginBottom: 16,
    backgroundColor: colors.surface || '#111318',
    borderColor: colors.border || '#222631',
    borderRadius: 18,
    borderWidth: 1,
    ...(shadows.sm || {}),
  },
  quickLogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  quickLogHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  quickLogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  quickLogTitle: {
    fontSize: typography?.sizes?.md || 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    letterSpacing: -0.2,
  },
  quickLogSubTitle: {
    fontSize: typography?.sizes?.xs || 12,
    color: colors.textSecondary || '#94A3B8',
    lineHeight: 16,
  },
  quickLogInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderWidth: 1.5,
    borderColor: colors.border || '#222631',
    borderRadius: radius.md || 12,
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: 16,
  },
  quickLogInputFocused: {
    borderColor: colors.primary || '#F59E0B',
    backgroundColor: colors.surfaceActive || '#222631',
  },
  quickLogTextInput: {
    flex: 1,
    color: colors.textPrimary || '#F8FAFC',
    fontSize: typography?.sizes?.base || 14,
    paddingVertical: 12,
    marginLeft: 8,
  },
  quickLogClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface || '#111318',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  quickLogTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickLogTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderRadius: radius.pill || 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  quickLogTypePillActive: {
    backgroundColor: colors.primary || '#F59E0B',
    borderColor: colors.primary || '#F59E0B',
    ...(shadows.primaryGlow || {}),
  },
  quickLogTypePillText: {
    color: colors.textSecondary || '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  quickLogTypePillTextActive: {
    color: colors.textOnPrimary || '#08090C',
    fontWeight: '700',
  },
  quickLogActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  quickLogBtnFlex: {
    flex: 1,
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  emptyText: {
    color: colors.textSecondary || '#94A3B8',
    fontSize: 13,
  },
  imageModalBg: {
    flex: 1,
    backgroundColor: 'rgba(8, 9, 12, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageModalClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 32,
    right: 20,
    zIndex: 10,
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageModalCloseText: {
    color: colors.textPrimary || '#F8FAFC',
    fontWeight: 'bold',
    fontSize: 14,
  },
  imageModalImg: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
  },
  errorBannerContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.danger || '#EF4444',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    marginBottom: 2,
  },
  errorBannerSubtitle: {
    fontSize: 12,
    color: colors.dangerText || '#F87171',
    lineHeight: 16,
  },
  retryButton: {
    backgroundColor: colors.primary || '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: colors.textOnPrimary || '#08090C',
    fontSize: 13,
    fontWeight: '700',
  },
});
