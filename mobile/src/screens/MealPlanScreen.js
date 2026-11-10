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

export default function MealPlanScreen({ navigation }) {
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
    const mealTypeLower = (meal.meal_type || 'lunch').toLowerCase();
    try {
      setLoggingMealType(mealTypeLower);
      await logMeal(meal.dish_name, mealTypeLower, todayStr);

      // Refresh today's summary so diary and badges update
      const updatedSummary = await getDailySummary(todayStr).catch(() => null);
      if (updatedSummary && Array.isArray(updatedSummary.meals)) {
        setTodayMeals(updatedSummary.meals);
      }

      Alert.alert(
        'Meal Logged',
        `${meal.dish_name} (${meal.calories} kcal) has been logged to today's diary.`
      );
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
      if (c === 'high') return { level: 'high', label: '⚡ Key Recovery Meal' };
      if (c === 'low') return { level: 'low', label: '☕ Light Fuel' };
      return { level: 'medium', label: '⚖️ Core Staple' };
    }
    const type = (meal?.meal_type || '').toLowerCase();
    const protein = meal?.protein || 0;
    const calories = meal?.calories || 0;
    if (type === 'snack' || calories < 280) {
      return { level: 'low', label: '☕ Light Fuel' };
    }
    if (type === 'dinner' || protein >= 35 || calories >= 580) {
      return { level: 'high', label: '⚡ Key Recovery Meal' };
    }
    return { level: 'medium', label: '⚖️ Core Staple' };
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
        // Claim responder as soon as intentional drag gesture is detected (> 6px)
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isSwapping && mealsList.length > 1 && (Math.abs(gestureState.dy) > 6 || Math.abs(gestureState.dx) > 6),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          !isSwapping && mealsList.length > 1 && (Math.abs(gestureState.dy) > 6 || Math.abs(gestureState.dx) > 6),
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
        <Text style={styles.headerDownloadBtnText}>📄 PDF</Text>
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
            <Text style={styles.emptyIcon}>⚠️</Text>
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
            <Text style={styles.emptyIcon}>📋</Text>
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
                      <Text style={styles.masterHeaderBadgeIcon}>📋</Text>
                      <Text style={styles.masterHeaderBadgeText}>MASTER MEAL PLAN BLUEPRINT</Text>
                    </View>
                    <View style={styles.masterStatusPill}>
                      <Text style={styles.masterStatusText}>✨ Active</Text>
                    </View>
                  </View>

                  <Text style={styles.masterPlanTitle}>
                    {selectedPlan.title || 'Personalized AI Meal Plan'}
                  </Text>
                  <Text style={styles.masterPlanTagline}>
                    {selectedPlan.tagline || 'Daily nutrition schedule tailored to your exact metabolic targets.'}
                  </Text>

                  <View style={styles.masterBadgesRow}>
                    <Badge
                      variant="primary"
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
                        variant="warning"
                        icon="💰"
                        label={selectedPlan.estimated_cost}
                        size="sm"
                      />
                    )}
                    {userSettings?.can_change_plan === false && (
                      <Badge
                        variant="warning"
                        label={`⏳ Change in ${userSettings.hours_until_next_plan_change || 1}h`}
                        size="sm"
                      />
                    )}
                  </View>

                  {/* Master Daily Macro Progress Bar */}
                  <View style={styles.masterMacroBarContainer}>
                    <View style={styles.masterMacroBarLabels}>
                      <Text style={styles.masterMacroBarTitle}>Daily Target Macro Distribution</Text>
                      <Text style={styles.masterMacroBarSplit}>
                        P: {planProteinPct}% · C: {planCarbsPct}% · F: {planFatPct}%
                      </Text>
                    </View>
                    <View style={styles.masterMacroBarTrack}>
                      <View style={[styles.masterBarSeg, { width: `${planProteinPct}%`, backgroundColor: colors.protein }]} />
                      <View style={[styles.masterBarSeg, { width: `${planCarbsPct}%`, backgroundColor: colors.carbs }]} />
                      <View style={[styles.masterBarSeg, { width: `${planFatPct}%`, backgroundColor: colors.fat }]} />
                    </View>
                  </View>

                  {/* Macro Distribution Grid */}
                  <View style={styles.masterMacroGrid}>
                    <View style={styles.masterMacroCell}>
                      <Text style={styles.masterMacroCellLabel}>Calories</Text>
                      <Text style={[styles.masterMacroCellVal, { color: colors.primary }]}>
                        {planCalories}
                      </Text>
                      <Text style={styles.masterMacroCellUnit}>kcal/day</Text>
                    </View>
                    <View style={styles.masterMacroCell}>
                      <Text style={styles.masterMacroCellLabel}>Protein</Text>
                      <Text style={[styles.masterMacroCellVal, { color: colors.protein }]}>
                        {planProtein}g
                      </Text>
                      <Text style={styles.masterMacroCellUnit}>{planProteinPct}% cal</Text>
                    </View>
                    <View style={styles.masterMacroCell}>
                      <Text style={styles.masterMacroCellLabel}>Carbs</Text>
                      <Text style={[styles.masterMacroCellVal, { color: colors.carbs }]}>
                        {planCarbs}g
                      </Text>
                      <Text style={styles.masterMacroCellUnit}>{planCarbsPct}% cal</Text>
                    </View>
                    <View style={styles.masterMacroCell}>
                      <Text style={styles.masterMacroCellLabel}>Fat</Text>
                      <Text style={[styles.masterMacroCellVal, { color: colors.fatText || '#E57453' }]}>
                        {planFat}g
                      </Text>
                      <Text style={styles.masterMacroCellUnit}>{planFatPct}% cal</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Daily Meal Schedule Section Header */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Daily Meal Schedule & Swaps</Text>
                <Text style={styles.sectionSub}>Drag ⠿ to reorder • Tap card for full recipe • Tap ⇅ to swap</Text>
              </View>
              <Badge variant="neutral" label={`${selectedPlan.meals?.length || 0} Slots`} size="sm" />
            </View>

            {/* Differentiated, Concise Meal Cards with Drag & Drop */}
            {selectedPlan.meals && selectedPlan.meals.length > 0 ? (
              selectedPlan.meals.map((m, idx) => {
                const typeLower = (m.meal_type || 'lunch').toLowerCase();
                const icon = MEAL_TYPE_ICONS[m.meal_type] || MEAL_TYPE_ICONS[typeLower] || '🍱';
                const costInfo = estimateMealCost(m, selectedPlan, userSettings);
                const logged = isMealLoggedToday(m);
                const isLoggingThis = loggingMealType === typeLower;
                const priority = getMealPriority(m);
                const isDragging = draggingIndex === idx;
                const isHoverTarget = hoverTargetIndex === idx && draggingIndex !== null && !isDragging;

                return (
                  <Animated.View
                    key={idx}
                    {...panResponders[idx]?.panHandlers}
                    onLayout={(e) => {
                      itemLayoutsRef.current[idx] = e.nativeEvent.layout;
                    }}
                    style={[
                      styles.cardWrapper,
                      isDragging && styles.cardWrapperDragging,
                      isDragging && {
                        transform: [{ translateY: panY }, { scale: scaleAnim }],
                        zIndex: 9999,
                        elevation: 12,
                      },
                      isHoverTarget && styles.cardWrapperHoverTarget,
                    ]}
                  >
                    {/* Real-time drop target indicator/preview on hovered slot */}
                    {isHoverTarget && (
                      <View style={styles.dropPreviewBanner}>
                        <Text style={styles.dropPreviewText}>
                          {draggingIndex < idx ? '⇣ Move here (swap slots)' : '⇡ Move here (swap slots)'}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => setActiveMeal(m)}
                      style={[
                        styles.conciseMealCard,
                        priority.level === 'high' && styles.cardHighPriority,
                        priority.level === 'medium' && styles.cardMediumPriority,
                        priority.level === 'low' && styles.cardLowPriority,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.meal_type}: ${m.dish_name}, ${m.calories} calories, ${priority.label}. Tap for full recipe.`}
                    >
                      {/* Top Meta Row */}
                      <View style={styles.conciseTopRow}>
                        <View style={styles.conciseTypeCluster}>
                          <View style={styles.mealSlotPill}>
                            <Text style={styles.mealSlotPillText}>{icon} {m.meal_type}</Text>
                          </View>
                          <View
                            style={[
                              styles.priorityBadge,
                              priority.level === 'high' && styles.priorityBadgeHigh,
                              priority.level === 'medium' && styles.priorityBadgeMedium,
                              priority.level === 'low' && styles.priorityBadgeLow,
                            ]}
                          >
                            <Text
                              style={[
                                styles.priorityBadgeText,
                                priority.level === 'high' && styles.priorityTextHigh,
                                priority.level === 'medium' && styles.priorityTextMedium,
                                priority.level === 'low' && styles.priorityTextLow,
                              ]}
                            >
                              {priority.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.conciseRightPills}>
                          {logged && (
                            <View style={styles.loggedPill}>
                              <Text style={styles.loggedPillText}>✓ Logged</Text>
                            </View>
                          )}
                          <View style={styles.conciseCalPill}>
                            <Text style={styles.conciseCalText}>{m.calories} kcal</Text>
                          </View>

                          {/* Dedicated Drag Grip Handle */}
                          <View
                            style={[
                              styles.dragHandleGrip,
                              isDragging && styles.dragHandleGripActive,
                            ]}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Drag handle for ${m.dish_name}. Drag anywhere on the card to reorder.`}
                          >
                            <Text style={[styles.dragHandleIcon, isDragging && styles.dragHandleIconActive]}>
                              ⠿
                            </Text>
                            <Text style={[styles.dragHandleLabel, isDragging && styles.dragHandleLabelActive]}>
                              {isDragging ? 'DRAGGING' : 'DRAG'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Concise Dish Title */}
                      <View style={styles.conciseTitleRow}>
                        <Text style={styles.conciseDishTitle} numberOfLines={1}>
                          {m.dish_name}
                        </Text>
                        <Text style={styles.conciseCostText}>{costInfo.formatted}</Text>
                      </View>

                      {/* Glanceable Macro String Row */}
                      <View style={styles.glanceableMacroRow}>
                        <Text style={styles.glanceableMacroText}>
                          <Text style={{ color: colors.protein, fontWeight: '700' }}>P: {m.protein}g</Text>
                          <Text style={styles.macroSep}> · </Text>
                          <Text style={{ color: colors.carbs, fontWeight: '700' }}>C: {m.carbs}g</Text>
                          <Text style={styles.macroSep}> · </Text>
                          <Text style={{ color: colors.fatText || '#E57453', fontWeight: '700' }}>F: {m.fat}g</Text>
                        </Text>
                        <Text style={styles.tapRecipeHint}>Recipe & Checklist ›</Text>
                      </View>

                      {/* Compact Action Footer: ⇅ Swap Slot, Micro-Arrows & 1-Tap Log */}
                      <View style={styles.conciseActionRow}>
                        <View style={styles.reorderActionsGroup}>
                          <TouchableOpacity
                            style={styles.swapAffordanceBtn}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setSwapSourceIndex(idx);
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Swap slot for ${m.dish_name}`}
                          >
                            <Text style={styles.swapAffordanceText}>⇅ Swap Slot</Text>
                          </TouchableOpacity>

                          {/* Quick Step Micro-Arrows */}
                          <View style={styles.quickStepArrows}>
                            {idx > 0 && (
                              <TouchableOpacity
                                style={styles.microArrowBtn}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  handleSwapMeals(idx, idx - 1);
                                }}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Move ${m.dish_name} up`}
                                disabled={isSwapping}
                              >
                                <Text style={styles.microArrowText}>▲ Up</Text>
                              </TouchableOpacity>
                            )}
                            {idx < selectedPlan.meals.length - 1 && (
                              <TouchableOpacity
                                style={styles.microArrowBtn}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  handleSwapMeals(idx, idx + 1);
                                }}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Move ${m.dish_name} down`}
                                disabled={isSwapping}
                              >
                                <Text style={styles.microArrowText}>▼ Down</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        {logged ? (
                          <View style={styles.actionLoggedBox}>
                            <Text style={styles.actionLoggedText}>✓ In Diary</Text>
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
                              <ActivityIndicator size="small" color="#221803" />
                            ) : (
                              <Text style={styles.quickMarkEatenText}>🍴 Mark Eaten</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
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
                icon="📄"
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
                <Text style={styles.swapModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.swapSlotsList} showsVerticalScrollIndicator={false}>
              {selectedPlan?.meals?.map((targetMeal, targetIdx) => {
                const isCurrent = targetIdx === swapSourceIndex;
                const icon = MEAL_TYPE_ICONS[targetMeal.meal_type] || '🍱';
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
                      <Text style={styles.swapSlotIcon}>{icon}</Text>
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
    backgroundColor: colors.background || '#181410',
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
    paddingBottom: 36,
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
    backgroundColor: '#221911',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary || '#E8A020',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  masterHeaderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  masterHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  masterHeaderBadgeIcon: {
    fontSize: 11,
  },
  masterHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary || '#E8A020',
    letterSpacing: 0.5,
  },
  masterStatusPill: {
    backgroundColor: '#181410',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  masterStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7BA05B',
  },
  masterPlanTitle: {
    fontSize: typography?.sizes?.lg || 20,
    fontWeight: '800',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 4,
  },
  masterPlanTagline: {
    fontSize: typography?.sizes?.sm || 12,
    color: colors.textSecondary || '#A79A85',
    marginBottom: 12,
    lineHeight: 16,
  },
  masterBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  masterMacroBarContainer: {
    backgroundColor: '#181410',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2D261F',
    marginBottom: 12,
  },
  masterMacroBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  masterMacroBarTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
  },
  masterMacroBarSplit: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  masterMacroBarTrack: {
    height: 8,
    backgroundColor: '#2C251D',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  masterBarSeg: {
    height: '100%',
  },
  masterMacroGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  masterMacroCell: {
    flex: 1,
    backgroundColor: '#181410',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D261F',
  },
  masterMacroCellLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary || '#A79A85',
    marginBottom: 2,
  },
  masterMacroCellVal: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 1,
  },
  masterMacroCellUnit: {
    fontSize: 9,
    color: colors.textTertiary || '#706555',
    fontWeight: '600',
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography?.sizes?.md || 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  sectionSub: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    marginTop: 2,
  },

  // Differentiated Concise Meal Cards (Follow-up 2, 3, 1)
  conciseMealCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 0,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  cardHighPriority: {
    backgroundColor: '#241B12',
    borderColor: '#E8A020',
    borderWidth: 1.5,
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  cardMediumPriority: {
    backgroundColor: '#1E1914',
    borderColor: '#3A3128',
    borderWidth: 1,
  },
  cardLowPriority: {
    backgroundColor: '#191511',
    borderColor: '#2D251E',
    borderWidth: 1,
  },

  // Card Internal Rows
  conciseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conciseTypeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  mealSlotPill: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  mealSlotPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  priorityBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  priorityBadgeHigh: {
    backgroundColor: 'rgba(232, 160, 32, 0.18)',
    borderColor: '#E8A020',
  },
  priorityBadgeMedium: {
    backgroundColor: 'rgba(167, 154, 133, 0.12)',
    borderColor: '#3A3128',
  },
  priorityBadgeLow: {
    backgroundColor: 'rgba(112, 101, 85, 0.10)',
    borderColor: '#2D251E',
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priorityTextHigh: {
    color: colors.primary || '#E8A020',
  },
  priorityTextMedium: {
    color: colors.textSecondary || '#A79A85',
  },
  priorityTextLow: {
    color: colors.textMuted || '#948675',
  },

  conciseRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  loggedPill: {
    backgroundColor: 'rgba(123, 160, 91, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#7BA05B',
  },
  loggedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7BA05B',
  },
  conciseCalPill: {
    backgroundColor: '#181410',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#3A3128',
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conciseCalText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },

  conciseTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  conciseDishTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    flex: 1,
  },
  conciseCostText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning || '#E8A020',
  },

  glanceableMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  glanceableMacroText: {
    fontSize: 11,
    color: colors.textSecondary || '#A79A85',
  },
  macroSep: {
    color: colors.border || '#3A3128',
  },
  tapRecipeHint: {
    fontSize: 10,
    color: colors.textTertiary || '#706555',
    fontWeight: '600',
  },

  conciseActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2B2319',
    paddingTop: 8,
  },
  swapAffordanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#272018',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  swapAffordanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  actionLoggedBox: {
    backgroundColor: 'rgba(123, 160, 91, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#7BA05B',
  },
  actionLoggedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7BA05B',
  },
  quickMarkEatenBtn: {
    backgroundColor: colors.primary || '#E8A020',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickMarkEatenText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#221803',
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
    backgroundColor: '#221D17',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary || '#E8A020',
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
    borderBottomColor: '#2D261F',
    paddingBottom: 12,
    marginBottom: 12,
  },
  swapModalTitle: {
    fontSize: typography?.sizes?.md || 17,
    fontWeight: '800',
    color: colors.primary || '#E8A020',
  },
  swapModalSub: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    marginTop: 2,
  },
  swapModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C251D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapModalCloseText: {
    color: '#F4ECDD',
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
    backgroundColor: '#181410',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  swapSlotItemCurrent: {
    backgroundColor: '#2A2016',
    borderColor: colors.primary || '#E8A020',
    opacity: 0.6,
  },
  swapSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  swapSlotIcon: {
    fontSize: 20,
  },
  swapSlotType: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    textTransform: 'uppercase',
  },
  currentSlotBadge: {
    backgroundColor: colors.primarySubtle || 'rgba(232, 160, 32, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  currentSlotText: {
    fontSize: 9,
    color: colors.primary || '#E8A020',
    fontWeight: '700',
  },
  swapSlotDish: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    marginTop: 2,
  },
  swapSlotRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  swapSlotCals: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  swapActionArrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary || '#E8A020',
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
