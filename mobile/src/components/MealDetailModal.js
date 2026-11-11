import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, typography, radius, shadows, spacing } from '../theme';
import { Card, Badge, Button } from './ui';
import { estimateMealCost, parseDailyBudget } from '../utils/mealCostEstimator';
import { logMeal } from '../services/api';

// --- Semantic Vector SVG Icons (Zero Raw Emojis) ---
function SunriseIcon({ size = 14, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2v6M4.93 10.93l1.41 1.41M19.07 10.93l-1.41 1.41M2 18h20M12 11a4 4 0 00-4 4h8a4 4 0 00-4-4zM8 6l4-4 4 4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SunIcon({ size = 14, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" />
      <Path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MoonIcon({ size = 14, color = colors.hydrationSky || '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CoffeeIcon({ size = 14, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TagIcon({ size = 12, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon({ size = 14, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ size = 16, color = '#94A3B8' }) {
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

function LightbulbIcon({ size = 18, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18h6M10 22h4M12 2a7 7 0 00-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 00-7-7z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SwapIcon({ size = 14, color = colors.hydrationSky || '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UtensilsIcon({ size = 16, color = '#F8FAFC' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 2v20M21 15v7M21 2a3 3 0 00-3 3v6a3 3 0 003 3v-2M3 2v7a4 4 0 004 4v9M7 2v7M11 2v7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareIcon({ size = 16, color = '#F8FAFC' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function getMealTypeIcon(type, size = 13, color = colors.primary || '#F59E0B') {
  const t = (type || '').toLowerCase();
  if (t.includes('breakfast')) return <SunriseIcon size={size} color={color} />;
  if (t.includes('lunch')) return <SunIcon size={size} color={color} />;
  if (t.includes('snack')) return <CoffeeIcon size={size} color={color} />;
  if (t.includes('dinner')) return <MoonIcon size={size} color={color} />;
  return <UtensilsIcon size={size} color={color} />;
}

/**
 * Universal Meal Detail Modal for FitScan Mobile.
 *
 * Implements:
 * 1. Modal header with meal name, meal type badge, and accessible close button (>=48dp)
 * 2. Estimated cost breakdown per serving alongside daily budget summary
 * 3. Visual Macro distribution bar and macro cards (Calories, Protein, Carbs, Fat)
 * 4. Interactive ingredients checklist with pantry checkboxes and quantity pills
 * 5. Step-by-step preparation instructions
 * 6. Meal swap / recipe variations
 * 7. Actionable 1-tap "Mark as Eaten / Log to Today" syncing with diary
 */
export default function MealDetailModal({
  visible,
  meal,
  selectedPlan,
  userSettings,
  dailyBudget,
  isAlreadyLogged = false,
  isLogged = false,
  isLogging = false,
  onClose,
  onMealLogged,
  onLogMeal,
}) {
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [isLoggingLocal, setIsLoggingLocal] = useState(false);
  const [hasLoggedLocal, setHasLoggedLocal] = useState(false);

  // Reset local states when opened for a new meal
  useEffect(() => {
    if (visible && meal) {
      setCheckedIngredients({});
      setHasLoggedLocal(Boolean(isAlreadyLogged || isLogged));
    }
  }, [visible, meal, isAlreadyLogged, isLogged]);

  // Derived Cost Calculations
  const effectiveSettings = useMemo(() => {
    if (userSettings) return userSettings;
    if (dailyBudget) return { budget_tier: dailyBudget };
    return {};
  }, [userSettings, dailyBudget]);

  const costInfo = useMemo(() => {
    return estimateMealCost(meal, selectedPlan, effectiveSettings);
  }, [meal, selectedPlan, effectiveSettings]);

  const budgetContext = useMemo(() => {
    return parseDailyBudget(
      selectedPlan?.estimated_cost,
      effectiveSettings?.budget_tier,
      effectiveSettings?.currency
    );
  }, [selectedPlan, effectiveSettings]);

  // Ingredients Handling
  const ingredients = useMemo(() => {
    return Array.isArray(meal?.ingredients) ? meal.ingredients : [];
  }, [meal]);

  // Preparation Steps Parsing
  const prepSteps = useMemo(() => {
    if (!meal) return [];
    if (Array.isArray(meal.instructions) && meal.instructions.length > 0) {
      return meal.instructions;
    }
    if (meal.recipe_summary) {
      return meal.recipe_summary.split(/\.\s+/).filter((s) => s.trim().length > 0);
    }
    if (meal.description) {
      return meal.description.split(/\.\s+/).filter((s) => s.trim().length > 0);
    }
    return [
      `Prepare ${meal.dish_name || 'meal'} with listed measured ingredients.`,
      `Cook lightly using at most 1 teaspoon oil/ghee.`,
      `Serve warm and enjoy your macro-balanced meal.`,
    ];
  }, [meal]);

  // Recipe Variations / Swaps
  const recipeVariations = useMemo(() => {
    if (!meal) return [];
    const list = [];
    const dish = (meal.dish_name || '').toLowerCase();
    const ings = ingredients.join(' ').toLowerCase();

    if (dish.includes('paneer') || ings.includes('paneer')) {
      list.push({
        title: 'Tofu Lean Swap',
        desc: 'Swap paneer with 100g firm tofu for the same protein with 40% less saturated fat.',
      });
    }
    if (dish.includes('egg') || ings.includes('egg')) {
      list.push({
        title: 'Vegetarian Moong Swap',
        desc: 'Swap eggs with 100g sprouted moong or paneer bhurji for equal protein density.',
      });
    }
    if (dish.includes('chicken') || ings.includes('chicken')) {
      list.push({
        title: 'Plant Protein Alternative',
        desc: 'Swap chicken breast with 45g soya chunks boiled in light spices (+23g protein).',
      });
    }
    if (dish.includes('rice') || ings.includes('rice')) {
      list.push({
        title: 'Calorie Deficit Cut',
        desc: 'Swap white or brown rice with 1 cup cauliflower rice to reduce ~140 kcal of carbs.',
      });
    }
    if (dish.includes('roti') || ings.includes('roti') || dish.includes('toast')) {
      list.push({
        title: 'High-Fiber Swap',
        desc: 'Use 100% whole grain multi-millet roti or 100% rye sourdough for sustained energy.',
      });
    }
    // Generic fallback variation
    list.push({
      title: 'Macro Booster Tip',
      desc: 'Add 1 scoop unflavored whey or 100g Greek yogurt to boost protein by +15-20g.',
    });

    return list.slice(0, 3);
  }, [meal, ingredients]);

  if (!visible || !meal) return null;

  const mealTypeStr = meal.meal_type || 'Lunch';
  const mealIcon = getMealTypeIcon(mealTypeStr);
  const isLoggedToday = hasLoggedLocal || isAlreadyLogged || isLogged;
  const isCurrentlyLogging = isLogging || isLoggingLocal;

  // Macro Calculations for Visual Share Bar
  const pCal = (meal.protein || 0) * 4;
  const cCal = (meal.carbs || 0) * 4;
  const fCal = (meal.fat || 0) * 9;
  const totalMacroCal = pCal + cCal + fCal || meal.calories || 1;
  const pPercent = Math.round((pCal / totalMacroCal) * 100);
  const cPercent = Math.round((cCal / totalMacroCal) * 100);
  const fPercent = Math.max(0, 100 - pPercent - cPercent);

  const checkedCount = Object.values(checkedIngredients).filter(Boolean).length;
  const allIngredientsChecked = ingredients.length > 0 && checkedCount === ingredients.length;

  const toggleIngredient = (idx) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleToggleAllIngredients = () => {
    if (allIngredientsChecked) {
      setCheckedIngredients({});
    } else {
      const allTrue = {};
      ingredients.forEach((_, idx) => {
        allTrue[idx] = true;
      });
      setCheckedIngredients(allTrue);
    }
  };

  // Action: Log Meal to Today's Tracker
  const handleLogMealAction = async () => {
    if (isLoggedToday || isCurrentlyLogging) return;

    try {
      setIsLoggingLocal(true);
      if (onLogMeal) {
        await onLogMeal(meal);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        const rawInput = meal.dish_name;
        const type = (meal.meal_type || 'lunch').toLowerCase();

        await logMeal(rawInput, type, todayStr);
        Alert.alert(
          'Meal Logged',
          `Successfully logged ${meal.dish_name} (${meal.calories} kcal) to today's diary.`,
          [{ text: 'Great' }]
        );
      }
      setHasLoggedLocal(true);

      if (onMealLogged) {
        onMealLogged(meal);
      }
    } catch (err) {
      console.warn('Error logging meal from plan:', err);
      Alert.alert('Logging Failed', err.message || 'Unable to log meal to today.');
    } finally {
      setIsLoggingLocal(false);
    }
  };

  // Action: Share Recipe
  const handleShareMeal = async () => {
    let text = `CORECONTROL MEAL RECIPE\n`;
    text += `[${mealTypeStr.toUpperCase()}] ${meal.dish_name}\n`;
    text += `Estimated Cost: ${costInfo.formatted} / serving (${costInfo.percentage}% of daily budget)\n`;
    text += `Target Macros: ${meal.calories} kcal | ${meal.protein}g Protein | ${meal.carbs}g Carbs | ${meal.fat}g Fat\n\n`;

    if (ingredients.length > 0) {
      text += `Ingredients:\n`;
      ingredients.forEach((ing) => {
        text += ` • ${ing}\n`;
      });
      text += `\n`;
    }

    text += `Preparation:\n`;
    prepSteps.forEach((st, i) => {
      text += ` ${i + 1}. ${st}\n`;
    });

    text += `\nShared via CoreControl • AI Nutrition Coach\n`;

    try {
      await Share.share({
        title: `${meal.dish_name} - CoreControl Recipe`,
        message: text,
      });
    } catch (err) {
      // ignore
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop touchable to close */}
        <TouchableOpacity
          style={styles.backdropDismiss}
          onPress={onClose}
          activeOpacity={1}
          accessibilityLabel="Dismiss modal backdrop"
        />

        <View style={styles.sheetCard}>
          {/* Top Drag Indicator */}
          <View style={styles.dragIndicatorWrapper}>
            <View style={styles.dragIndicator} />
          </View>

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.badgeCluster}>
                <Badge
                  variant="primary"
                  icon={mealIcon}
                  label={mealTypeStr}
                  size="md"
                />
                <Badge
                  variant="warning"
                  icon={<TagIcon size={12} color={colors.primary || '#F59E0B'} />}
                  label={`${costInfo.formatted} / meal`}
                  size="md"
                />
              </View>
              <Text style={styles.dishTitle} numberOfLines={2}>
                {meal.dish_name}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close meal detail"
            >
              <CloseIcon size={16} color={colors.textSecondary || '#94A3B8'} />
            </TouchableOpacity>
          </View>

          {/* Modal Content ScrollView */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Estimated Cost Breakdown Card */}
            <Card variant="elevated" style={styles.sectionCard}>
              <View style={styles.costHeaderRow}>
                <View>
                  <Text style={styles.costCardSub}>ESTIMATED COST PER SERVING</Text>
                  <View style={styles.costMainRow}>
                    <Text style={styles.costMainVal}>{costInfo.formatted}</Text>
                    <Text style={styles.costPerUnit}> / serving</Text>
                  </View>
                </View>
                <Badge
                  variant="neutral"
                  label={`${costInfo.percentage}% of Daily`}
                  size="sm"
                />
              </View>

              {/* Proportional Budget Bar */}
              <View style={styles.budgetBarContainer}>
                <View
                  style={[
                    styles.budgetBarFill,
                    { width: `${Math.min(costInfo.percentage, 100)}%` },
                  ]}
                />
              </View>

              <View style={styles.budgetContextRow}>
                <Text style={styles.budgetContextText}>
                  Daily Budget: {costInfo.currency}{costInfo.dailyBudget}/day
                </Text>
                <Text style={styles.budgetTierNote}>{budgetContext.tierLabel}</Text>
              </View>

              <Text style={styles.costFootnote}>
                Estimated using local grocery prices and portion caloric share. Cost may vary by brand and market.
              </Text>
            </Card>

            {/* 2. Macros Breakdown Card */}
            <Card variant="default" style={styles.sectionCard}>
              <View style={styles.macroCardHeader}>
                <Text style={styles.sectionLabel}>NUTRITION BREAKDOWN</Text>
                <Text style={styles.totalCalsBadge}>{meal.calories} kcal</Text>
              </View>

              {/* Visual Macro Share Bar */}
              <View style={styles.macroBarTrack}>
                <View
                  style={[
                    styles.macroBarSegment,
                    { width: `${pPercent}%`, backgroundColor: colors.protein },
                  ]}
                />
                <View
                  style={[
                    styles.macroBarSegment,
                    { width: `${cPercent}%`, backgroundColor: colors.carbs },
                  ]}
                />
                <View
                  style={[
                    styles.macroBarSegment,
                    { width: `${fPercent}%`, backgroundColor: colors.fat },
                  ]}
                />
              </View>

              {/* Macro Cards Row */}
              <View style={styles.macroGridRow}>
                <View style={styles.macroStatCard}>
                  <View style={[styles.macroDotIndicator, { backgroundColor: colors.protein }]} />
                  <Text style={styles.macroStatLabel}>PROTEIN</Text>
                  <Text style={[styles.macroStatVal, { color: colors.protein }]}>
                    {meal.protein}g
                  </Text>
                  <Text style={styles.macroStatSub}>{pPercent}% • {pCal} kcal</Text>
                </View>

                <View style={styles.macroStatCard}>
                  <View style={[styles.macroDotIndicator, { backgroundColor: colors.carbs }]} />
                  <Text style={styles.macroStatLabel}>CARBS</Text>
                  <Text style={[styles.macroStatVal, { color: colors.carbs }]}>
                    {meal.carbs}g
                  </Text>
                  <Text style={styles.macroStatSub}>{cPercent}% • {cCal} kcal</Text>
                </View>

                <View style={styles.macroStatCard}>
                  <View style={[styles.macroDotIndicator, { backgroundColor: colors.fatText }]} />
                  <Text style={styles.macroStatLabel}>FAT</Text>
                  <Text style={[styles.macroStatVal, { color: colors.fatText }]}>
                    {meal.fat}g
                  </Text>
                  <Text style={styles.macroStatSub}>{fPercent}% • {fCal} kcal</Text>
                </View>
              </View>
            </Card>

            {/* 3. Ingredients Checklist Card */}
            <Card variant="default" style={styles.sectionCard}>
              <View style={styles.ingredientsHeaderRow}>
                <View>
                  <Text style={styles.sectionLabel}>INGREDIENTS CHECKLIST</Text>
                  <Text style={styles.checklistProgressText}>
                    {checkedCount} of {ingredients.length} items ready
                  </Text>
                </View>

                {ingredients.length > 0 && (
                  <TouchableOpacity
                    style={styles.toggleAllBtn}
                    onPress={handleToggleAllIngredients}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={allIngredientsChecked ? 'Uncheck all' : 'Check all'}
                  >
                    <Text style={styles.toggleAllBtnText}>
                      {allIngredientsChecked ? 'Clear All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {ingredients.length > 0 ? (
                <View style={styles.ingredientList}>
                  {ingredients.map((ing, idx) => {
                    const isChecked = Boolean(checkedIngredients[idx]);
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.ingredientRow,
                          isChecked && styles.ingredientRowChecked,
                        ]}
                        onPress={() => toggleIngredient(idx)}
                        activeOpacity={0.7}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isChecked }}
                        accessibilityLabel={ing}
                      >
                        <View
                          style={[
                            styles.checkboxBox,
                            isChecked && styles.checkboxBoxChecked,
                          ]}
                        >
                          {isChecked ? (
                            <CheckIcon size={12} color="#08090C" />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.ingredientText,
                            isChecked && styles.ingredientTextChecked,
                          ]}
                        >
                          {ing}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyNote}>
                  {meal.description || 'Standard ingredients as described in recipe.'}
                </Text>
              )}

              {allIngredientsChecked && (
                <View style={styles.allReadyPill}>
                  <CheckIcon size={14} color="#10B981" />
                  <Text style={styles.allReadyText}>All ingredients checked & ready to cook!</Text>
                </View>
              )}
            </Card>

            {/* 4. Step-by-Step Preparation Instructions */}
            <Card variant="default" style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>PREPARATION INSTRUCTIONS</Text>

              <View style={styles.prepStepsList}>
                {prepSteps.map((step, idx) => (
                  <View key={idx} style={styles.prepStepRow}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.prepStepText}>{step.trim()}</Text>
                  </View>
                ))}
              </View>

              {/* Low-Oil Guideline Callout */}
              <View style={styles.cookingTipBox}>
                <LightbulbIcon size={18} color={colors.primary || '#F59E0B'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cookingTipTitle}>Low-Oil Cooking Tip</Text>
                  <Text style={styles.cookingTipBody}>
                    Cap added cooking oil/ghee to 1 tsp (5g) for light tempering. Healthy fats come naturally from whole ingredients.
                  </Text>
                </View>
              </View>
            </Card>

            {/* 5. Meal Swap / Recipe Variations */}
            <Card variant="default" style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>RECIPE VARIATIONS & SWAPS</Text>

              <View style={styles.variationsList}>
                {recipeVariations.map((v, idx) => (
                  <View key={idx} style={styles.variationRow}>
                    <View style={styles.variationIconBox}>
                      <SwapIcon size={14} color={colors.hydrationSky || '#38BDF8'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.variationTitle}>{v.title}</Text>
                      <Text style={styles.variationDesc}>{v.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Modal Fixed Footer Actions */}
          <View style={styles.footerContainer}>
            <View style={styles.footerActionsRow}>
              <Button
                variant={isLoggedToday ? 'secondary' : 'primary'}
                size="lg"
                title={
                  isLoggedToday
                    ? 'Logged to Today'
                    : 'Mark as Eaten / Log to Today'
                }
                icon={isLoggedToday ? <CheckIcon size={16} color="#10B981" /> : <UtensilsIcon size={16} color="#08090C" />}
                onPress={handleLogMealAction}
                disabled={isLoggedToday || isCurrentlyLogging}
                loading={isCurrentlyLogging}
                style={{ flex: 1 }}
              />

              <TouchableOpacity
                style={styles.shareIconBtn}
                onPress={handleShareMeal}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Share recipe details"
              >
                <ShareIcon size={18} color={colors.textPrimary || '#F8FAFC'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    backgroundColor: colors.surface || '#221D17',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '65%',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    ...(shadows.lg || {}),
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderHover || '#4A3F34',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screenPadding || 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle || '#2D261F',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  badgeCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  dishTitle: {
    fontSize: typography?.sizes?.lg || 20,
    fontWeight: '800',
    color: colors.textPrimary || '#F4ECDD',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
  },
  closeBtnText: {
    color: colors.textSecondary || '#A79A85',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding || 16,
    gap: 14,
  },
  sectionCard: {
    padding: spacing.cardPadding || 16,
  },
  sectionLabel: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // 1. Cost Breakdown Styles
  costHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  costCardSub: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  costMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  costMainVal: {
    fontSize: typography?.sizes?.xl || 24,
    fontWeight: '800',
    color: colors.primary || '#E8A020',
  },
  costPerUnit: {
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textSecondary || '#A79A85',
    marginLeft: 2,
  },
  budgetBarContainer: {
    height: 8,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  budgetBarFill: {
    height: '100%',
    backgroundColor: colors.primary || '#E8A020',
    borderRadius: 4,
  },
  budgetContextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  budgetContextText: {
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textPrimary || '#F4ECDD',
    fontWeight: '600',
  },
  budgetTierNote: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textMuted || '#948675',
  },
  costFootnote: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textMuted || '#948675',
    lineHeight: 15,
    marginTop: 4,
  },

  // 2. Nutrition Breakdown Styles
  macroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalCalsBadge: {
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    backgroundColor: colors.surfaceElevated || '#2C251D',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm || 6,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
  },
  macroBarTrack: {
    height: 8,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 12,
  },
  macroBarSegment: {
    height: '100%',
  },
  macroGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroStatCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  macroDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  macroStatLabel: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    fontWeight: '600',
    marginBottom: 2,
  },
  macroStatVal: {
    fontSize: typography?.sizes?.base || 15,
    fontWeight: '700',
  },
  macroStatSub: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textMuted || '#948675',
    marginTop: 2,
  },

  // 3. Ingredients Checklist Styles
  ingredientsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  checklistProgressText: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
  },
  toggleAllBtn: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  toggleAllBtnText: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.primary || '#E8A020',
    fontWeight: '700',
  },
  ingredientList: {
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 48, // Guaranteed accessibility touch target >=48dp
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  ingredientRowChecked: {
    backgroundColor: colors.background || '#08090C',
    opacity: 0.65,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border || '#3A3128',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: colors.surface || '#221D17',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary || '#E8A020',
    borderColor: colors.primary || '#E8A020',
  },
  checkboxCheck: {
    color: colors.primaryDark || '#221803',
    fontSize: 13,
    fontWeight: '800',
  },
  ingredientText: {
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textPrimary || '#F4ECDD',
    flex: 1,
    lineHeight: 18,
  },
  ingredientTextChecked: {
    textDecorationLine: 'line-through',
    color: colors.textMuted || '#948675',
  },
  allReadyPill: {
    marginTop: 10,
    backgroundColor: colors.successSubtle || 'rgba(123, 160, 91, 0.18)',
    borderRadius: radius.md || 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.success || '#7BA05B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  allReadyText: {
    color: colors.success || '#7BA05B',
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
  },
  emptyNote: {
    color: colors.textSecondary || '#A79A85',
    fontSize: typography?.sizes?.sm || 13,
    lineHeight: 18,
  },

  // 4. Preparation Instructions Styles
  prepStepsList: {
    gap: 10,
    marginVertical: 4,
  },
  prepStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySubtle || 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: colors.primaryBorder || 'rgba(232, 160, 32, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  prepStepText: {
    flex: 1,
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textPrimary || '#F4ECDD',
    lineHeight: 20,
  },
  cookingTipBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  cookingTipIcon: {
    fontSize: 16,
  },
  cookingTipTitle: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    marginBottom: 2,
  },
  cookingTipBody: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 16,
  },

  // 5. Recipe Variations Styles
  variationsList: {
    gap: 8,
    marginTop: 4,
  },
  variationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.background || '#08090C',
    borderRadius: radius.md || 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  variationIconBox: {
    marginTop: 2,
    marginRight: 2,
  },
  variationTitle: {
    fontSize: typography?.sizes?.xs || 11,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    marginBottom: 2,
  },
  variationDesc: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 16,
  },

  // Footer Actions
  footerContainer: {
    paddingHorizontal: spacing.screenPadding || 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || '#2D261F',
    backgroundColor: colors.surface || '#221D17',
  },
  footerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  shareIconBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md || 10,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
  },
  shareIconText: {
    fontSize: 18,
  },
});
