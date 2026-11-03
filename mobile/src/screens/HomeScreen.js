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
import { colors, typography, spacing, radius, shadows } from '../theme';
import { Card, Button, Badge } from '../components/ui';
import MealDetailModal from '../components/MealDetailModal';
import MealCard from '../components/MealCard';
import DynamicGreetingHeader from '../components/DynamicGreetingHeader';
import ContextualMilestoneCard from '../components/ContextualMilestoneCard';
import GoalInsightsCard from '../components/GoalInsightsCard';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from '@react-navigation/native';

const MEAL_TYPE_ICONS = {
  breakfast: '🍳',
  lunch: '🥗',
  snack: '☕',
  dinner: '🍲',
  Breakfast: '🍳',
  Lunch: '🥗',
  Snack: '☕',
  Dinner: '🍲',
};

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
    const mealTypeLower = (plannedMeal.meal_type || 'lunch').toLowerCase();
    try {
      setLoggingPlannedMeal(mealTypeLower);
      const dateStr = formatDateStr(selectedDate);
      await logMeal(plannedMeal.dish_name, mealTypeLower, dateStr);
      await loadData();
      Alert.alert(
        'Logged to Today! 🎉',
        `${plannedMeal.dish_name} (${plannedMeal.calories} kcal) added to your diary.`
      );
      if (selectedPlannedMealModal) {
        setSelectedPlannedMealModal(null);
      }
    } catch (err) {
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
      loadData();
    }, [loadData])
  );

  const handleLogMeal = async () => {
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
      Alert.alert('Success! 🎉', 'Meal logged and macros updated.');
    } catch (err) {
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
          <Text style={styles.logoIcon}>🏋️</Text>
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
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Streak: ${adherenceStats?.current_streak ?? 0} days. Tap to view streak and achievements.`}
          >
            <Text style={styles.streakHeaderIcon}>🔥</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#E8A020" />}
      >
        {/* Offline / Connection Error Banner with Tap to Retry */}
        {loadError && (
          <View style={styles.errorBannerContainer}>
            <View style={styles.errorBannerLeft}>
              <Text style={styles.errorBannerIcon}>⚠️</Text>
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
          <Text style={styles.streakBannerText}>
            🔥 <Text style={styles.boldText}>{adherenceStats?.current_streak ?? 0}</Text> day streak
          </Text>
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
                  : `${remainingCals.toLocaleString()} kcal remaining for today`}
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
                    of {goalCals.toLocaleString()} kcal target
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
                        isSurplus && { color: colors.dangerText || '#E57453' },
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
              <Text style={[styles.fitStatVal, { color: colors.fatText || '#E57453' }]}>
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
                <Text style={[styles.miniMacroTrackName, { color: colors.fatText || '#E57453' }]}>Fat</Text>
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

        {/* Macro Progress Bars */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macronutrients</Text>
          
          {/* Protein */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroName}>Protein</Text>
              <Text style={styles.macroValue}>
                {summary?.total_protein || 0}g / {summary?.protein_goal || 150}g
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(((summary?.total_protein || 0) / (summary?.protein_goal || 150)) * 100, 100)}%`, backgroundColor: colors.protein }]} />
            </View>
          </View>

          {/* Carbs */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroName}>Carbs</Text>
              <Text style={styles.macroValue}>
                {summary?.total_carbs || 0}g / {summary?.carbs_goal || 200}g
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(((summary?.total_carbs || 0) / (summary?.carbs_goal || 200)) * 100, 100)}%`, backgroundColor: colors.carbs }]} />
            </View>
          </View>

          {/* Fat */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroName}>Fat</Text>
              <Text style={styles.macroValue}>
                {summary?.total_fat || 0}g / {summary?.fat_goal || 65}g
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(((summary?.total_fat || 0) / (summary?.fat_goal || 65)) * 100, 100)}%`, backgroundColor: colors.fat }]} />
            </View>
          </View>
        </View>

        {/* Goal Insights & Adaptive Suggestions */}
        <GoalInsightsCard
          summary={summary}
          userSettings={userSettings}
          onSelectSuggestion={(item) => {
            setRawInput(item.name);
          }}
        />

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
                const icon = MEAL_TYPE_ICONS[m.meal_type] || MEAL_TYPE_ICONS[typeLower] || '🍱';
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
                        <Text style={styles.plannedTypeTag}>{icon} {m.meal_type}</Text>
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
                      <Badge variant="warning" size="sm" icon="💰" label={costInfo.formatted} />
                    </View>

                    {/* 1-Tap Action Button */}
                    <View style={styles.plannedActionArea}>
                      {logged ? (
                        <Badge
                          variant="success"
                          icon="✓"
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
                          icon="🍴"
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
                  <Text style={styles.quickLogIcon}>⚡</Text>
                  <Text style={styles.quickLogTitle}>Quick Log Meal</Text>
                </View>
                <Text style={styles.quickLogSubTitle}>
                  Type food or snap a photo for instant macro breakdown
                </Text>
              </View>
              <Badge
                variant="primary"
                label={mealType.toUpperCase()}
                icon={MEAL_TYPE_ICONS[mealType] || '🍽️'}
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
              <Text style={styles.quickLogInputLeadingIcon}>✍️</Text>
              <TextInput
                style={styles.quickLogTextInput}
                placeholder="e.g. 2 eggs, 1 toast with butter"
                placeholderTextColor={colors.textSecondary || '#A79A85'}
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
                  <Text style={styles.quickLogClearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Meal Type Pills with Emojis */}
            <View style={styles.quickLogTypeRow}>
              {['breakfast', 'lunch', 'snack', 'dinner'].map((t) => {
                const isSelected = mealType === t;
                const icon = MEAL_TYPE_ICONS[t] || '🍽️';
                const label = t.charAt(0).toUpperCase() + t.slice(1);
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.quickLogTypePill,
                      isSelected && styles.quickLogTypePillActive,
                    ]}
                    onPress={() => setMealType(t)}
                    activeOpacity={0.75}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${label} meal`}
                  >
                    <Text style={styles.quickLogTypePillIcon}>{icon}</Text>
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

            {/* Previously Eaten Meal Suggestions (Follow-up 4) */}
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
                const itemMealType = (item.meal_type || mealType).toLowerCase();
                try {
                  setSubmitting(true);
                  const dateStr = formatDateStr(selectedDate);
                  await logMeal(item.name, itemMealType, dateStr);
                  await loadData();
                  Alert.alert('Meal Logged! 🎉', `${item.name} added to today's diary.`);
                } catch (err) {
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
                icon="✓"
                onPress={handleLogMeal}
                loading={submitting}
                variant="primary"
                size="md"
                style={styles.quickLogBtnFlex}
                disabled={submitting}
              />
              <Button
                title="Scan Photo"
                icon="📸"
                onPress={() => navigation.navigate('Scan', { mealDate: formatDateStr(selectedDate) })}
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
              <Text style={styles.emptyIcon}>🍽️</Text>
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
            <Text style={styles.imageModalCloseText}>✕ Close</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#181410',
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
    color: colors.textSecondary || '#A79A85',
    marginTop: 2,
  },
  viewPlanLink: {
    color: colors.primary || '#E8A020',
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
  },
  plannedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  plannedTypeTag: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  plannedCals: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  plannedDishName: {
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 6,
    minHeight: 38,
  },
  plannedMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  plannedMacroText: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
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
    backgroundColor: '#1C1712',
    borderBottomWidth: 1,
    borderBottomColor: '#251E17',
    zIndex: 20,
  },
  topHeaderShadow: {
    borderBottomColor: '#3A2E1F',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoIcon: {
    fontSize: 22,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8A020',
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
    borderColor: '#3A3128',
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
    backgroundColor: '#2C251D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#E8A020',
    fontSize: 12,
    fontWeight: 'bold',
  },
  streakHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#271D12',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 4,
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  streakHeaderIcon: {
    fontSize: 12,
  },
  streakHeaderText: {
    color: '#E8A020',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#221D17',
    borderWidth: 1,
    borderColor: '#3A3128',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
  },
  streakBannerText: {
    color: '#F4ECDD',
    fontSize: 13,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#E8A020',
  },
  streakDot: {
    color: '#A79A85',
  },
  streakBannerSub: {
    color: '#A79A85',
    fontSize: 12,
    flex: 1,
  },
  streakArrow: {
    color: '#E8A020',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dateLabel: {
    fontSize: 12,
    color: '#A79A85',
  },
  calToggleBtn: {
    backgroundColor: '#181410',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  calToggleBtnActive: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  calToggleText: {
    color: '#F4ECDD',
    fontSize: 13,
    fontWeight: '600',
  },
  calToggleTextActive: {
    color: '#221803',
    fontWeight: 'bold',
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    backgroundColor: '#2C251D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  navBtnText: {
    color: '#F4ECDD',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 14,
  },
  calsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
    backgroundColor: '#130F0C',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderTopColor: '#362A1D',
    borderLeftColor: '#281F15',
    borderRightColor: '#281F15',
    borderBottomColor: '#0E0A07',
    elevation: 7,
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  fitRingOuter: {
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#17130E',
    borderTopColor: '#FFAE2E',
    borderLeftColor: '#E8A020',
    borderRightColor: '#D4860D',
    borderBottomColor: '#6B3E03',
  },
  fitRingInner: {
    width: 114,
    height: 114,
    borderRadius: 57,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14100C',
    borderWidth: 1.5,
    borderTopColor: '#090705',
    borderLeftColor: '#100D0A',
    borderRightColor: '#100D0A',
    borderBottomColor: '#2C2217',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 3,
  },
  fitRingValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F4ECDD',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fitRingSub: {
    fontSize: 11,
    color: '#A79A85',
    marginTop: 2,
    fontWeight: '500',
  },
  nutritionBudgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  nutritionBudgetSub: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    marginTop: 2,
  },
  deficitStatusPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  deficitStatusDeficit: {
    backgroundColor: 'rgba(123, 160, 91, 0.12)',
    borderColor: 'rgba(123, 160, 91, 0.35)',
  },
  deficitStatusSurplus: {
    backgroundColor: 'rgba(199, 80, 47, 0.12)',
    borderColor: 'rgba(199, 80, 47, 0.35)',
  },
  deficitStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.protein || '#7BA05B',
  },
  nutritionCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1510',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2B2218',
  },
  fitStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#2B2319',
  },
  fitStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  fitStatVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4ECDD',
    marginBottom: 2,
  },
  fitStatLbl: {
    fontSize: 11,
    color: '#A79A85',
  },
  fitStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#2E251B',
  },
  miniMacroTracksContainer: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  miniMacroTrackItem: {
    marginBottom: 4,
  },
  miniMacroTrackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  miniMacroTrackName: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniMacroTrackPct: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
  },
  miniMacroTrackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    overflow: 'hidden',
  },
  miniMacroTrackFill: {
    height: 4,
    borderRadius: 2,
  },

  fitFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fitStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fitFooterHint: {
    fontSize: 11,
    color: '#A79A85',
    fontWeight: '500',
  },
  fitFooterArrow: {
    fontSize: 13,
    color: '#E8A020',
    fontWeight: 'bold',
  },
  calCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#181410',
    borderWidth: 4,
    borderColor: '#E8A020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calCircleVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  calCircleSub: {
    fontSize: 10,
    color: '#A79A85',
  },
  calsDetails: {
    flex: 1,
    marginLeft: 20,
    gap: 12,
  },
  calStatBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calStatVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  calStatLbl: {
    fontSize: 13,
    color: '#A79A85',
  },
  barBg: {
    height: 8,
    backgroundColor: '#2C251D',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#E8A020',
    borderRadius: 4,
  },
  macroBlock: {
    marginBottom: 12,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  macroName: {
    fontSize: 13,
    color: '#F4ECDD',
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F4ECDD',
  },
  input: {
    backgroundColor: '#2C251D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    color: '#F4ECDD',
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#2C251D',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  typeBtnActive: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  typeBtnText: {
    color: '#A79A85',
    fontSize: 11,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: '#221803',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scanBtn: {
    backgroundColor: '#2C251D',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  scanBtnText: {
    color: '#F4ECDD',
    fontSize: 14,
    fontWeight: '600',
  },
  quickLogCard: {
    padding: spacing.cardPadding || 16,
    marginBottom: spacing.cardPadding || 16,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg || 16,
    ...(shadows.sm || {}),
  },
  quickLogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  quickLogHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  quickLogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  quickLogIcon: {
    fontSize: 16,
  },
  quickLogTitle: {
    fontSize: typography?.sizes?.md || 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quickLogSubTitle: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  quickLogInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md || 10,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 12,
  },
  quickLogInputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceActive || colors.surfaceElevated,
  },
  quickLogInputLeadingIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  quickLogTextInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography?.sizes?.base || 14,
    paddingVertical: 10,
  },
  quickLogClearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  quickLogClearIcon: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  quickLogTypeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  quickLogTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickLogTypePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...(shadows.primaryGlow || {}),
  },
  quickLogTypePillIcon: {
    fontSize: 11,
  },
  quickLogTypePillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  quickLogTypePillTextActive: {
    color: colors.textOnPrimary || '#221803',
    fontWeight: '700',
  },
  quickLogActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickLogBtnFlex: {
    flex: 1,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  weightBtn: {
    backgroundColor: '#E8A020',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  weightBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealCountBadge: {
    fontSize: 12,
    color: '#A79A85',
    backgroundColor: '#2C251D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    color: '#A79A85',
    fontSize: 13,
  },
  mealItem: {
    backgroundColor: '#181410',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  mealItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mealTypeBadge: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mealTimeText: {
    color: '#A79A85',
    fontSize: 11,
    fontWeight: '500',
  },
  mealCals: {
    color: '#7BA05B',
    fontSize: 13,
    fontWeight: 'bold',
  },
  mealInputText: {
    color: '#F4ECDD',
    fontSize: 14,
    marginBottom: 4,
  },
  mealMacroSub: {
    color: '#A79A85',
    fontSize: 12,
  },
  mealHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteHeaderBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(199, 80, 47, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteHeaderBtnText: {
    color: '#E06D53',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  deleteText: {
    color: '#C7502F',
    fontSize: 12,
  },
  mealContentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  mealIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#262019',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  mealIconPlaceholderText: {
    fontSize: 20,
  },
  mealThumbContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2C251D',
    borderWidth: 1,
    borderColor: '#3A3128',
    position: 'relative',
  },
  mealThumb: {
    width: 58,
    height: 58,
    borderRadius: 10,
  },
  mealThumbZoomBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  mealThumbZoomIcon: {
    fontSize: 9,
  },
  mealImageBannerContainer: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2C251D',
    borderWidth: 1,
    borderColor: '#3A3128',
    position: 'relative',
  },
  mealImageBanner: {
    width: '100%',
    height: 150,
  },
  mealImageBannerOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  mealImageBannerText: {
    color: '#F4ECDD',
    fontSize: 11,
    fontWeight: '600',
  },
  mealFoodItemsBox: {
    marginTop: 10,
    backgroundColor: '#1E1914',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2E261E',
  },
  mealFoodItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealFoodItemsHeaderTitle: {
    color: '#A79A85',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  mealFoodItemsCount: {
    color: '#E8A020',
    fontSize: 10,
    fontWeight: '600',
  },
  mealFoodItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealFoodItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  mealFoodItemName: {
    color: '#F4ECDD',
    fontSize: 12.5,
    fontWeight: '600',
  },
  mealFoodItemMacros: {
    color: '#A79A85',
    fontSize: 10.5,
    marginTop: 1,
  },
  mealFoodItemCals: {
    color: '#7BA05B',
    fontSize: 12,
    fontWeight: '700',
  },
  mealTextCol: {
    flex: 1,
  },
  imageModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageModalClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 32,
    right: 20,
    zIndex: 10,
    backgroundColor: '#2C251D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageModalCloseText: {
    color: '#F4ECDD',
    fontWeight: 'bold',
    fontSize: 14,
  },
  imageModalImg: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
  },
  errorBannerContainer: {
    backgroundColor: '#2A1C16',
    borderWidth: 1,
    borderColor: '#E57453',
    borderRadius: 12,
    padding: 14,
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
    gap: 10,
  },
  errorBannerIcon: {
    fontSize: 20,
  },
  errorBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4ECDD',
    marginBottom: 2,
  },
  errorBannerSubtitle: {
    fontSize: 12,
    color: '#E57453',
    lineHeight: 16,
  },
  retryButton: {
    backgroundColor: '#E8A020',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#181410',
    fontSize: 13,
    fontWeight: '700',
  },
});

