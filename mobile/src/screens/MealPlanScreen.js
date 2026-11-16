import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, radius, spacing } from '../theme';
import { Card, Badge, Button, ScreenHeader } from '../components/ui';
import MealDetailModal from '../components/MealDetailModal';
import { getSettings, getDailySummary, logMeal, selectMealPlan, swapMealPlan } from '../services/api';
import { estimateMealCost } from '../utils/mealCostEstimator';
import { exportMealPlanPdf } from '../utils/mealPlanPdfGenerator';
import ProUpgradeModal from '../components/ProUpgradeModal';
import useSubscription from '../hooks/useSubscription';
import { useToast } from '../context/ToastContext';
import Svg, { Path } from 'react-native-svg';

function CheckIcon({ size = 12, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17L4 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SwapIcon({ size = 13, color = '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 13, color = '#64748B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18L15 12L9 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CloseIcon({ size = 14, color = '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const MEAL_TYPE_ICONS = {
  breakfast: '',
  lunch: '',
  snack: '',
  dinner: '',
  Breakfast: '',
  Lunch: '',
  Snack: '',
  Dinner: '',
};

export default function MealPlanScreen({ navigation }) {
  const { showToast } = useToast();
  const {
    isPro,
    trialDaysRemaining,
    hasAccess,
    refreshSubscription,
    openPaywall,
    closePaywall,
    isPaywallOpen,
  } = useSubscription();

  const [userSettings, setUserSettings] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingMealType, setLoggingMealType] = useState(null);
  const [activeMeal, setActiveMeal] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [swapSourceIndex, setSwapSourceIndex] = useState(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // Gesture drag-and-drop state
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [hoverTargetIndex, setHoverTargetIndex] = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const draggingIndexRef = useRef(null);
  const hoverTargetIndexRef = useRef(null);
  const itemLayoutsRef = useRef({});
  const panY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [settings, summary] = await Promise.all([
        getSettings(),
        getDailySummary(todayStr).catch(() => null),
      ]);
      setUserSettings(settings);
      if (summary && Array.isArray(summary.meals)) {
        setTodayMeals(summary.meals);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('Error fetching meal plan:', err);
      }
      setLoadError(err.message || 'Unable to connect to server. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useFocusEffect(
    useCallback(() => {
      refreshSubscription();
      loadData();
    }, [loadData, refreshSubscription])
  );

  // Safely parse selected_meal_plan (handles JSON string or dict)
  const selectedPlan = useMemo(() => {
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

  // Set of logged meal types / dishes today for quick check
  const loggedMealsSet = useMemo(() => {
    const set = new Set();
    todayMeals.forEach((m) => {
      const typeTrimmed = (m.meal_type || '').toLowerCase().trim();
      if (typeTrimmed) set.add(typeTrimmed);
      const rawTrimmed = (m.raw_input || '').toLowerCase().trim();
      if (rawTrimmed) set.add(rawTrimmed);
    });
    return set;
  }, [todayMeals]);

  const isMealLoggedToday = useCallback(
    (meal) => {
      if (!meal) return false;
      const typeKey = (meal.meal_type || '').toLowerCase().trim();
      const dishKey = (meal.dish_name || '').toLowerCase().trim();
      if (typeKey && loggedMealsSet.has(typeKey)) return true;
      for (const logged of loggedMealsSet) {
        if (logged && dishKey && (dishKey.includes(logged) || logged.includes(dishKey))) return true;
      }
      return false;
    },
    [loggedMealsSet]
  );

  // 1-Tap Log Meal Action
  const handleLogMeal = async (meal) => {
    if (!hasAccess) {
      openPaywall('log_meal');
      return;
    }
    if (!userSettings?.height_cm || !userSettings?.weight_kg) {
      Alert.alert(
        'Goal Required',
        'Please set your fitness and calorie goal before logging meals.',
        [
          { text: 'Set Goal', onPress: () => navigation.navigate('Profile') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    const mealTypeLower = (meal.meal_type || 'lunch').toLowerCase();
    try {
      setLoggingMealType(mealTypeLower);
      await logMeal(meal.dish_name, mealTypeLower, todayStr);

      // Refresh today's summary so diary and badges update
      const updatedSummary = await getDailySummary(todayStr).catch(() => null);
      if (updatedSummary && Array.isArray(updatedSummary.meals)) {
        setTodayMeals(updatedSummary.meals);
      }

      showToast({
        type: 'success',
        title: 'Meal Logged',
        message: `${meal.dish_name} logged to today's diary.`,
        badge: meal.meal_type || 'Meal',
        calories: meal.calories,
        macros: {
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
        },
      });
      if (activeMeal) {
        setActiveMeal(null);
      }
    } catch (err) {
      if (err.status === 402 || err.code === 'TRIAL_EXPIRED') {
        openPaywall('log_meal');
        return;
      }
      Alert.alert('Logging Failed', err.message || 'Unable to log meal to diary.');
    } finally {
      setLoggingMealType(null);
    }
  };

  const handleDownloadMealPlan = async () => {
    if (!selectedPlan) {
      Alert.alert('No Plan', 'No active meal plan found to export.');
      return;
    }

    setExportingPdf(true);
    try {
      await exportMealPlanPdf(selectedPlan, userSettings);
    } catch (error) {
      Alert.alert('Export Failed', error.message || 'Unable to generate meal plan PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const getMealPriority = (meal) => {
    if (meal?.criticality) {
      const c = String(meal.criticality).toLowerCase();
      if (c === 'high') return { level: 'high', label: 'Key Recovery Meal' };
      if (c === 'low') return { level: 'low', label: 'Light Fuel' };
      return { level: 'medium', label: 'Core Staple' };
    }
    const type = (meal?.meal_type || '').toLowerCase();
    const protein = meal?.protein || 0;
    const calories = meal?.calories || 0;
    if (type === 'snack' || calories < 280) {
      return { level: 'low', label: 'Light Fuel' };
    }
    if (type === 'dinner' || protein >= 35 || calories >= 580) {
      return { level: 'high', label: 'Key Recovery Meal' };
    }
    return { level: 'medium', label: 'Core Staple' };
  };

  const handleSwapMeals = useCallback(
    async (sourceIdx, targetIdx, { isDrag = false } = {}) => {
      if (!hasAccess) {
        openPaywall('swap_meals');
        return;
      }
      if (isSwapping || sourceIdx === targetIdx || !selectedPlan?.meals) return;
      if (sourceIdx < 0 || sourceIdx >= selectedPlan.meals.length) return;
      if (targetIdx < 0 || targetIdx >= selectedPlan.meals.length) return;

      const currentMeals = [...selectedPlan.meals];
      const sourceMeal = currentMeals[sourceIdx];
      const targetMeal = currentMeals[targetIdx];
      if (!sourceMeal || !targetMeal) return;

      // Swap meals between slots while preserving canonical slot names
      const updatedMeals = [...currentMeals];
      updatedMeals[sourceIdx] = {
        ...targetMeal,
        meal_type: sourceMeal.meal_type,
      };
      updatedMeals[targetIdx] = {
        ...sourceMeal,
        meal_type: targetMeal.meal_type,
      };

      const updatedPlan = {
        ...selectedPlan,
        meals: updatedMeals,
      };

      // Optimistic local state update
      const prevSettings = userSettings;
      setUserSettings((prev) => ({
        ...prev,
        selected_meal_plan: updatedPlan,
      }));
      setSwapSourceIndex(null);
      setIsSwapping(true);

      try {
        const res = await swapMealPlan(sourceIdx, targetIdx, updatedPlan);
        if (res && res.selected_meal_plan) {
          setUserSettings(res);
        }
        if (!isDrag) {
          Alert.alert(
            'Meals Swapped',
            `Swapped ${sourceMeal.dish_name} (${sourceMeal.meal_type}) with ${targetMeal.dish_name} (${targetMeal.meal_type}).`
          );
        }
      } catch (err) {
        console.warn('Meal swap API error:', err);
        setUserSettings(prevSettings);
        if (err.status === 402 || err.code === 'TRIAL_EXPIRED') {
          openPaywall('swap_meals');
          return;
        }
        Alert.alert('Swap Error', err.message || 'Failed to persist swapped meal plan.');
      } finally {
        setIsSwapping(false);
      }
    },
    [hasAccess, isSwapping, openPaywall, selectedPlan, userSettings]
  );

  const updateHoverTarget = useCallback(
    (sourceIdx, dy) => {
      const layouts = itemLayoutsRef.current;
      const numMeals = selectedPlan?.meals?.length || 0;
      if (numMeals <= 1) return;

      const sourceLayout = layouts[sourceIdx];
      const sourceHeight = sourceLayout?.height || 135;
      const sourceY = sourceLayout?.y ?? sourceIdx * 135;
      const currentCenterY = sourceY + sourceHeight / 2 + dy;

      let closestIndex = sourceIdx;
      let minDistance = Infinity;

      for (let i = 0; i < numMeals; i++) {
        const layout = layouts[i];
        const itemHeight = layout?.height || 135;
        const itemY = layout?.y ?? i * 135;
        const itemCenterY = itemY + itemHeight / 2;

        const dist = Math.abs(currentCenterY - itemCenterY);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = i;
        }
      }

      closestIndex = Math.max(0, Math.min(numMeals - 1, closestIndex));

      if (closestIndex !== hoverTargetIndexRef.current) {
        hoverTargetIndexRef.current = closestIndex;
        setHoverTargetIndex(closestIndex);
      }
    },
    [selectedPlan?.meals?.length]
  );

  const handleDropRelease = useCallback(() => {
    const sourceIdx = draggingIndexRef.current;
    const targetIdx = hoverTargetIndexRef.current;

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
    panY.setValue(0);

    setDraggingIndex(null);
    setHoverTargetIndex(null);
    setScrollEnabled(true);
    draggingIndexRef.current = null;
    hoverTargetIndexRef.current = null;

    if (sourceIdx !== null && targetIdx !== null && sourceIdx !== targetIdx) {
      handleSwapMeals(sourceIdx, targetIdx, { isDrag: true });
    }
  }, [handleSwapMeals, panY, scaleAnim]);

  const handleDropCancel = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
    panY.setValue(0);
    setDraggingIndex(null);
    setHoverTargetIndex(null);
    setScrollEnabled(true);
    draggingIndexRef.current = null;
    hoverTargetIndexRef.current = null;
  }, [panY, scaleAnim]);

  const panResponders = useMemo(() => {
    const mealsList = selectedPlan?.meals || [];
    return mealsList.map((_, idx) =>
      PanResponder.create({
        // Allow inner TouchableOpacity (recipe modal, swap button, log button) to receive initial touch
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        // Do not intercept or capture vertical scroll gestures to ensure standard ScrollView scrolling is never locked
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          if (isSwapping || mealsList.length <= 1) return;
          draggingIndexRef.current = idx;
          hoverTargetIndexRef.current = idx;
          setDraggingIndex(idx);
          setHoverTargetIndex(idx);
          setScrollEnabled(false);
          panY.setValue(0);
          Animated.spring(scaleAnim, {
            toValue: 1.03,
            friction: 7,
            useNativeDriver: false,
          }).start();
        },
        onPanResponderMove: (_, gestureState) => {
          if (draggingIndexRef.current !== idx) return;
          panY.setValue(gestureState.dy);
          updateHoverTarget(idx, gestureState.dy);
        },
        onPanResponderRelease: () => {
          handleDropRelease();
        },
        onPanResponderTerminate: () => {
          handleDropCancel();
        },
        onPanResponderTerminationRequest: () => false,
      })
    );
  }, [selectedPlan?.meals, isSwapping, updateHoverTarget, handleDropRelease, handleDropCancel, panY, scaleAnim]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary || '#E8A020'} />
          <Text style={styles.loaderText}>Loading Meal Plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const downloadAction = (
    <TouchableOpacity
      style={styles.headerDownloadBtn}
      onPress={handleDownloadMealPlan}
      disabled={exportingPdf}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Export Meal Plan as PDF"
    >
      {exportingPdf ? (
        <ActivityIndicator size="small" color={colors.primary || '#E8A020'} />
      ) : (
        <Text style={styles.headerDownloadBtnText}>PDF</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Normalized Header without Android double status bar padding */}
      <ScreenHeader
        title="Meal Plan Details"
        subtitle="Daily schedule & recipes"
        onBack={() => navigation.navigate('Today')}
        backTitle="Tracker"
        backIcon="←"
        rightAction={downloadAction}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {loadError ? (
          <Card variant="default" style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Failed to Load Meal Plan</Text>
            <Text style={styles.emptySubtext}>
              {loadError}
            </Text>
            <Button
              variant="primary"
              size="md"
              title="Tap to Retry"
              onPress={loadData}
              fullWidth
            />
          </Card>
        ) : !selectedPlan ? (
          <Card variant="default" style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Active Meal Plan Selected</Text>
            <Text style={styles.emptySubtext}>
              Set your target metrics in Profile and choose an AI-generated daily meal schedule with cost breakdowns.
            </Text>
            <Button
              variant="primary"
              size="md"
              title="Go to Profile & Select Plan"
              onPress={() => navigation.navigate('Profile')}
              fullWidth
            />
          </Card>
        ) : (
          <>
            {/* Master Meal Plan Overview Container (Follow-up 5) */}
            {(() => {
              const planCalories = selectedPlan.daily_calories || userSettings?.calorie_goal || 2000;
              const planProtein = selectedPlan.protein_g || userSettings?.protein_goal || 150;
              const planCarbs = selectedPlan.carbs_g || userSettings?.carbs_goal || 200;
              const planFat = selectedPlan.fat_g || userSettings?.fat_goal || 65;
              const totalMacroCals = (planProtein * 4) + (planCarbs * 4) + (planFat * 9) || 1;
              const planProteinPct = Math.round(((planProtein * 4) / totalMacroCals) * 100);
              const planCarbsPct = Math.round(((planCarbs * 4) / totalMacroCals) * 100);
              const planFatPct = Math.max(0, 100 - planProteinPct - planCarbsPct);

              return (
                <View style={styles.masterPlanContainer}>
                  <View style={styles.masterHeaderBanner}>
                    <View style={styles.masterHeaderBadge}>
                      <Text style={styles.masterHeaderBadgeText}>DAILY PLAN</Text>
                    </View>
                    <View style={styles.masterStatusPill}>
                      <View style={styles.activeDot} />
                      <Text style={styles.masterStatusText}>Active</Text>
                    </View>
                  </View>

                  <Text style={styles.masterPlanTitle}>
                    {selectedPlan.title || 'Personalized AI Meal Plan'}
                  </Text>
                  {selectedPlan.tagline ? (
                    <Text style={styles.masterPlanTagline} numberOfLines={2}>
                      {selectedPlan.tagline}
                    </Text>
                  ) : null}

                  <View style={styles.masterBadgesRow}>
                    <Badge
                      variant="neutral"
                      label={(userSettings?.goal_type || 'fat_loss').replace('_', ' ').toUpperCase()}
                      size="sm"
                    />
                    <Badge
                      variant="neutral"
                      label={(userSettings?.diet_type || 'veg').toUpperCase()}
                      size="sm"
                    />
                    {selectedPlan.estimated_cost && (
                      <Badge
                        variant="neutral"
                        label={selectedPlan.estimated_cost}
                        size="sm"
                      />
                    )}
                    {userSettings?.can_change_plan === false && (
                      <Badge
                        variant="neutral"
                        label={`Change in ${userSettings.hours_until_next_plan_change || 1}h`}
                        size="sm"
                      />
                    )}
                  </View>

                  {/* Slim Macro Progress Bar */}
                  <View style={styles.masterMacroTrack}>
                    <View style={[styles.masterBarSeg, { width: `${planProteinPct}%`, backgroundColor: colors.protein }]} />
                    <View style={[styles.masterBarSeg, { width: `${planCarbsPct}%`, backgroundColor: colors.carbs }]} />
                    <View style={[styles.masterBarSeg, { width: `${planFatPct}%`, backgroundColor: colors.fat }]} />
                  </View>

                  {/* Soothing Macro Stats Row */}
                  <View style={styles.masterMacroStatsRow}>
                    <View style={styles.masterStatItem}>
                      <Text style={styles.masterStatVal}>{planCalories}</Text>
                      <Text style={styles.masterStatLabel}>kcal</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.masterStatItem}>
                      <Text style={[styles.masterStatVal, { color: colors.protein }]}>{planProtein}g</Text>
                      <Text style={styles.masterStatLabel}>protein</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.masterStatItem}>
                      <Text style={[styles.masterStatVal, { color: colors.carbs }]}>{planCarbs}g</Text>
                      <Text style={styles.masterStatLabel}>carbs</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.masterStatItem}>
                      <Text style={[styles.masterStatVal, { color: colors.fatText || '#FB7185' }]}>{planFat}g</Text>
                      <Text style={styles.masterStatLabel}>fat</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Daily Meal Schedule Section Header */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Daily Schedule</Text>
                <Text style={styles.sectionSub}>Tap any meal for recipe & ingredients</Text>
              </View>
              <Badge variant="neutral" label={`${selectedPlan.meals?.length || 0} Meals`} size="sm" />
            </View>

            {/* Differentiated, Concise Meal Cards */}
            {selectedPlan.meals && selectedPlan.meals.length > 0 ? (
              selectedPlan.meals.map((m, idx) => {
                const typeLower = (m.meal_type || 'lunch').toLowerCase();
                const costInfo = estimateMealCost(m, selectedPlan, userSettings);
                const logged = isMealLoggedToday(m);
                const isLoggingThis = loggingMealType === typeLower;

                return (
                  <View
                    key={idx}
                    style={styles.cardWrapper}
                  >
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setActiveMeal(m)}
                      style={styles.conciseMealCard}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.meal_type}: ${m.dish_name}, ${m.calories} calories. Tap for full recipe.`}
                    >
                      {/* Top Meta Row */}
                      <View style={styles.conciseTopRow}>
                        <View style={styles.mealSlotPill}>
                          <Text style={styles.mealSlotPillText}>{m.meal_type}</Text>
                        </View>

                        <View style={styles.conciseRightPills}>
                          {logged && (
                            <View style={styles.loggedPill}>
                              <CheckIcon size={11} color="#10B981" />
                              <Text style={styles.loggedPillText}>Logged</Text>
                            </View>
                          )}
                          <Text style={styles.conciseCalText}>{m.calories} kcal</Text>
                        </View>
                      </View>

                      {/* Concise Dish Title */}
                      <View style={styles.conciseTitleRow}>
                        <Text style={styles.conciseDishTitle} numberOfLines={1}>
                          {m.dish_name}
                        </Text>
                        {costInfo?.formatted ? (
                          <Text style={styles.conciseCostText}>{costInfo.formatted}</Text>
                        ) : null}
                      </View>

                      {/* Glanceable Macro String Row */}
                      <View style={styles.glanceableMacroRow}>
                        <Text style={styles.glanceableMacroText}>
                          <Text style={{ color: colors.protein }}>{m.protein}g P</Text>
                          <Text style={styles.macroSep}>  ·  </Text>
                          <Text style={{ color: colors.carbs }}>{m.carbs}g C</Text>
                          <Text style={styles.macroSep}>  ·  </Text>
                          <Text style={{ color: colors.fatText || '#FB7185' }}>{m.fat}g F</Text>
                        </Text>
                        <View style={styles.tapRecipeHintGroup}>
                          <Text style={styles.tapRecipeHint}>Recipe</Text>
                          <ChevronRightIcon size={12} color="#64748B" />
                        </View>
                      </View>

                      {/* Compact Action Footer: ⇅ Swap Slot & 1-Tap Log */}
                      <View style={styles.conciseActionRow}>
                        <TouchableOpacity
                          style={styles.swapAffordanceBtn}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setSwapSourceIndex(idx);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Swap slot for ${m.dish_name}`}
                        >
                          <SwapIcon size={12} color="#94A3B8" />
                          <Text style={styles.swapAffordanceText}>Swap Slot</Text>
                        </TouchableOpacity>

                        {logged ? (
                          <View style={styles.actionLoggedBox}>
                            <CheckIcon size={12} color="#10B981" />
                            <Text style={styles.actionLoggedText}>Completed</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.quickMarkEatenBtn}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleLogMeal(m);
                            }}
                            disabled={isLoggingThis}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={`Mark ${m.dish_name} as eaten`}
                          >
                            {isLoggingThis ? (
                              <ActivityIndicator size="small" color="#F8FAFC" />
                            ) : (
                              <Text style={styles.quickMarkEatenText}>Log Meal</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptySubtext}>No meal items listed in this plan.</Text>
            )}

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              <Button
                variant="secondary"
                size="md"
                title={exportingPdf ? 'Exporting PDF...' : 'Export Meal Plan (PDF)'}
                onPress={handleDownloadMealPlan}
                disabled={exportingPdf}
                loading={exportingPdf}
                fullWidth
              />

              <Button
                variant="outline"
                size="md"
                title="Change Meal Plan in Profile"
                onPress={() => navigation.navigate('Profile')}
                fullWidth
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Rich Meal Detail Modal */}
      <MealDetailModal
        visible={Boolean(activeMeal)}
        meal={activeMeal}
        selectedPlan={selectedPlan}
        userSettings={userSettings}
        isAlreadyLogged={isMealLoggedToday(activeMeal)}
        isLogging={loggingMealType === (activeMeal?.meal_type || '').toLowerCase()}
        onLogMeal={handleLogMeal}
        onClose={() => setActiveMeal(null)}
      />

      {/* Quick Meal Swapping Slot Selector Modal (Follow-up 1) */}
      <Modal
        visible={swapSourceIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSwapSourceIndex(null)}
      >
        <View style={styles.swapModalOverlay}>
          <View style={styles.swapModalContent}>
            <View style={styles.swapModalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.swapModalTitle}>⇅ Swap Meal Slot</Text>
                <Text style={styles.swapModalSub} numberOfLines={1}>
                  Move {selectedPlan?.meals?.[swapSourceIndex]?.dish_name} to:
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSwapSourceIndex(null)}
                style={styles.swapModalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close swap modal"
              >
                <CloseIcon size={14} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.swapSlotsList} showsVerticalScrollIndicator={false}>
              {selectedPlan?.meals?.map((targetMeal, targetIdx) => {
                const isCurrent = targetIdx === swapSourceIndex;
                const slotNum = `0${targetIdx + 1}`.slice(-2);
                return (
                  <TouchableOpacity
                    key={targetIdx}
                    style={[
                      styles.swapSlotItem,
                      isCurrent && styles.swapSlotItemCurrent,
                    ]}
                    disabled={isCurrent || isSwapping}
                    onPress={() => handleSwapMeals(swapSourceIndex, targetIdx)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Swap with ${targetMeal.meal_type}: ${targetMeal.dish_name}`}
                  >
                    <View style={styles.swapSlotLeft}>
                      <View style={styles.swapSlotBadge}>
                        <Text style={styles.swapSlotBadgeText}>{slotNum}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.swapSlotType}>{targetMeal.meal_type}</Text>
                          {isCurrent && (
                            <View style={styles.currentSlotBadge}>
                              <Text style={styles.currentSlotText}>Current Slot</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.swapSlotDish} numberOfLines={1}>
                          {targetMeal.dish_name}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.swapSlotRight}>
                      <Text style={styles.swapSlotCals}>{targetMeal.calories} kcal</Text>
                      {!isCurrent && (
                        <Text style={styles.swapActionArrow}>Swap ⇅</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: colors.textSecondary || '#A79A85',
    fontSize: typography?.sizes?.sm || 13,
    marginTop: 10,
  },
  headerDownloadBtn: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerDownloadBtnText: {
    color: colors.primary || '#E8A020',
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '700',
  },
  scroll: {
    padding: spacing.screenPadding || 16,
    paddingBottom: 120,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    marginTop: 30,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: typography?.sizes?.lg || 20,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textSecondary || '#A79A85',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  // Master Plan Overview Container Styles (Follow-up 5)
  masterPlanContainer: {
    backgroundColor: colors.surface || '#111318',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    padding: 16,
    marginBottom: 20,
  },
  masterHeaderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  masterHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  masterHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary || '#94A3B8',
    letterSpacing: 0.8,
  },
  masterStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.20)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  masterStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  masterPlanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    marginBottom: 4,
  },
  masterPlanTagline: {
    fontSize: 12,
    color: colors.textSecondary || '#94A3B8',
    marginBottom: 12,
    lineHeight: 17,
  },
  masterBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  masterMacroTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'row',
    marginVertical: 12,
  },
  masterBarSeg: {
    height: '100%',
  },
  masterMacroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  masterStatItem: {
    alignItems: 'center',
  },
  masterStatVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
  },
  masterStatLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted || '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
  },
  sectionSub: {
    fontSize: 11,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 2,
  },

  // Soothing Obsidian Meal Cards
  conciseMealCard: {
    backgroundColor: colors.surface || '#111318',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    padding: 14,
    marginBottom: 0,
    justifyContent: 'space-between',
  },

  // Card Internal Rows
  conciseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealSlotPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.20)',
  },
  mealSlotPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  conciseRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loggedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.20)',
  },
  loggedPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  conciseCalText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary || '#94A3B8',
  },

  conciseTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  conciseDishTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    flex: 1,
  },
  conciseCostText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted || '#64748B',
  },

  glanceableMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  glanceableMacroText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary || '#94A3B8',
  },
  macroSep: {
    color: 'rgba(255, 255, 255, 0.12)',
  },
  tapRecipeHintGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tapRecipeHint: {
    fontSize: 11,
    color: colors.textMuted || '#64748B',
    fontWeight: '500',
  },

  conciseActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
    marginTop: 4,
  },
  swapAffordanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  swapAffordanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary || '#94A3B8',
  },
  actionLoggedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.20)',
  },
  actionLoggedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  quickMarkEatenBtn: {
    backgroundColor: '#1A1D24',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  quickMarkEatenText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
  },

  // Meal Swapping Modal Styles (Follow-up 1)
  swapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  swapModalContent: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: colors.surface || '#111318',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  swapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 12,
    marginBottom: 12,
  },
  swapModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
  },
  swapModalSub: {
    fontSize: 11,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 2,
  },
  swapModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapModalCloseText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  swapSlotsList: {
    maxHeight: 340,
  },
  swapSlotItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  swapSlotItemCurrent: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: colors.primary || '#F59E0B',
    opacity: 0.7,
  },
  swapSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  swapSlotBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceActive || '#222631',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapSlotBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
  },
  swapSlotType: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
    textTransform: 'uppercase',
  },
  currentSlotBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  currentSlotText: {
    fontSize: 9,
    color: colors.primary || '#F59E0B',
    fontWeight: '700',
  },
  swapSlotDish: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary || '#F8FAFC',
    marginTop: 2,
  },
  swapSlotRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  swapSlotCals: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
  },
  swapActionArrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary || '#F59E0B',
  },

  // Drag & Drop Reordering Styles
  cardWrapper: {
    marginBottom: 10,
    borderRadius: 12,
  },
  cardWrapperDragging: {
    zIndex: 9999,
    elevation: 12,
    shadowColor: colors.primary || '#E8A020',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  cardWrapperHoverTarget: {
    borderWidth: 2,
    borderColor: colors.primary || '#E8A020',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: 'rgba(232, 160, 32, 0.08)',
  },
  dropPreviewBanner: {
    backgroundColor: 'rgba(232, 160, 32, 0.20)',
    borderWidth: 1,
    borderColor: colors.primary || '#E8A020',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  dropPreviewText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary || '#E8A020',
    letterSpacing: 0.5,
  },
  dragHandleGrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#272018',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#3A3128',
    gap: 3,
    height: 22,
  },
  dragHandleGripActive: {
    backgroundColor: 'rgba(232, 160, 32, 0.25)',
    borderColor: colors.primary || '#E8A020',
  },
  dragHandleIcon: {
    fontSize: 12,
    lineHeight: 14,
    color: colors.textSecondary || '#A79A85',
    fontWeight: '800',
    includeFontPadding: false,
  },
  dragHandleIconActive: {
    color: colors.primary || '#E8A020',
  },
  dragHandleLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  dragHandleLabelActive: {
    color: colors.primary || '#E8A020',
  },
  reorderActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickStepArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  microArrowBtn: {
    backgroundColor: '#272018',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  microArrowText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
  },

  bottomActions: {
    gap: 12,
    marginTop: 16,
  },
});
