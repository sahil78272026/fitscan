import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, radius, spacing } from '../theme';
import { Card, Badge, Button, ScreenHeader } from '../components/ui';
import MealDetailModal from '../components/MealDetailModal';
import { getSettings, getDailySummary, logMeal } from '../services/api';
import { estimateMealCost } from '../utils/mealCostEstimator';

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
  const [userSettings, setUserSettings] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingMealType, setLoggingMealType] = useState(null);
  const [activeMeal, setActiveMeal] = useState(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [settings, summary] = await Promise.all([
        getSettings().catch(() => null),
        getDailySummary(todayStr).catch(() => null),
      ]);
      setUserSettings(settings);
      if (summary && Array.isArray(summary.meals)) {
        setTodayMeals(summary.meals);
      }
    } catch (err) {
      console.warn('Error fetching meal plan:', err);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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
      if (m.meal_type) set.add(m.meal_type.toLowerCase().trim());
      if (m.raw_input) set.add(m.raw_input.toLowerCase().trim());
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
        if (dishKey && (dishKey.includes(logged) || logged.includes(dishKey))) return true;
      }
      return false;
    },
    [loggedMealsSet]
  );

  // 1-Tap Log Meal Action
  const handleLogMeal = async (meal) => {
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
        'Meal Logged! 🎉',
        `${meal.dish_name} (${meal.calories} kcal) has been logged to today's diary.`
      );
      if (activeMeal) {
        setActiveMeal(null);
      }
    } catch (err) {
      Alert.alert('Logging Failed', err.message || 'Unable to log meal to diary.');
    } finally {
      setLoggingMealType(null);
    }
  };

  const handleDownloadMealPlan = async () => {
    if (!selectedPlan) {
      Alert.alert('No Plan', 'No active meal plan found to download.');
      return;
    }

    const goal = (userSettings?.goal_type || 'fat_loss').replace('_', ' ').toUpperCase();
    const diet = (userSettings?.diet_type || 'veg').toUpperCase();
    const calories = selectedPlan.daily_calories || userSettings?.calorie_goal || 2000;
    const protein = selectedPlan.protein_g || userSettings?.protein_goal || 150;
    const carbs = selectedPlan.carbs_g || userSettings?.carbs_goal || 200;
    const fat = selectedPlan.fat_g || userSettings?.fat_goal || 65;

    let content = `CORECONTROL - DAILY MEAL PLAN\n`;
    content += `Plan: ${selectedPlan.title || 'AI Meal Plan'}\n`;
    content += `Goal: ${goal} | Diet: ${diet}\n`;
    content += `Daily Targets: ${calories} kcal | ${protein}g Protein | ${carbs}g Carbs | ${fat}g Fat\n`;
    if (selectedPlan.estimated_cost) {
      content += `Daily Budget: ${selectedPlan.estimated_cost}\n`;
    }
    content += `\n--- MEAL SCHEDULE & COST BREAKDOWN ---\n\n`;

    (selectedPlan.meals || []).forEach((m, idx) => {
      const costInfo = estimateMealCost(m, selectedPlan, userSettings);
      content += `${idx + 1}. [${m.meal_type.toUpperCase()}] ${m.dish_name} (${m.calories} kcal • ${costInfo.formatted})\n`;
      content += `   Macros: ${m.protein}g P | ${m.carbs}g C | ${m.fat}g F\n`;
      if (m.ingredients && m.ingredients.length > 0) {
        content += `   Ingredients:\n`;
        m.ingredients.forEach((ing) => {
          content += `    • ${ing}\n`;
        });
      } else if (m.description) {
        content += `   Notes: ${m.description}\n`;
      }
      content += `\n`;
    });

    content += `Generated with FitScan • AI Nutrition Coach\n`;

    try {
      await Share.share({
        title: `FitScan Meal Plan - ${selectedPlan.title || 'Daily Plan'}`,
        message: content,
      });
    } catch (error) {
      Alert.alert('Download Error', error.message);
    }
  };

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
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Download Meal Plan"
    >
      <Text style={styles.headerDownloadBtnText}>📥 Share</Text>
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!selectedPlan ? (
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
            {/* Active Plan Hero Card */}
            <Card variant="highlight" style={styles.heroCard}>
              <View style={styles.badgeRow}>
                <Badge variant="primary" label="✨ Active Plan" size="sm" />
                {userSettings?.can_change_plan === false && (
                  <Badge
                    variant="warning"
                    label={`⏳ Change in ${userSettings.hours_until_next_plan_change || 1}h`}
                    size="sm"
                  />
                )}
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
                    variant="warning"
                    icon="💰"
                    label={selectedPlan.estimated_cost}
                    size="sm"
                  />
                )}
              </View>

              <Text style={styles.planTitle}>{selectedPlan.title || 'Personalized AI Meal Plan'}</Text>
              <Text style={styles.planTagline}>
                {selectedPlan.tagline || 'Tailored specifically to hit your daily macro targets.'}
              </Text>

              {/* Macro Distribution Cards Grid */}
              <View style={styles.macroGrid}>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <Text style={[styles.macroVal, { color: colors.primary }]}>
                    {selectedPlan.daily_calories || userSettings?.calorie_goal} kcal
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={[styles.macroVal, { color: colors.protein }]}>
                    {selectedPlan.protein_g || userSettings?.protein_goal}g
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <Text style={[styles.macroVal, { color: colors.carbs }]}>
                    {selectedPlan.carbs_g || userSettings?.carbs_goal}g
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Fat</Text>
                  <Text style={[styles.macroVal, { color: colors.fatText }]}>
                    {selectedPlan.fat_g || userSettings?.fat_goal}g
                  </Text>
                </View>
              </View>
            </Card>

            {/* Daily Meal Schedule Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Daily Meal Schedule & Recipes</Text>
              <Text style={styles.sectionSub}>Tap meal card for recipe & cost breakdown</Text>
            </View>

            {selectedPlan.meals && selectedPlan.meals.length > 0 ? (
              selectedPlan.meals.map((m, idx) => {
                const typeLower = (m.meal_type || 'lunch').toLowerCase();
                const icon = MEAL_TYPE_ICONS[m.meal_type] || MEAL_TYPE_ICONS[typeLower] || '🍱';
                const costInfo = estimateMealCost(m, selectedPlan, userSettings);
                const logged = isMealLoggedToday(m);
                const isLoggingThis = loggingMealType === typeLower;

                // Proportional macro bar for card
                const pCal = (m.protein || 0) * 4;
                const cCal = (m.carbs || 0) * 4;
                const fCal = (m.fat || 0) * 9;
                const totalCal = pCal + cCal + fCal || m.calories || 1;
                const pPct = Math.round((pCal / totalCal) * 100);
                const cPct = Math.round((cCal / totalCal) * 100);
                const fPct = Math.max(0, 100 - pPct - cPct);

                return (
                  <Card
                    key={idx}
                    variant="default"
                    onPress={() => setActiveMeal(m)}
                    style={styles.interactiveMealCard}
                    accessibilityLabel={`View recipe for ${m.dish_name}`}
                    accessibilityHint="Opens meal details, cost breakdown, ingredients checklist, and 1-tap logging"
                  >
                    {/* Meal Card Top Header */}
                    <View style={styles.mealCardTopRow}>
                      <View style={styles.mealTypeCluster}>
                        <Badge
                          variant="primary"
                          icon={icon}
                          label={m.meal_type}
                          size="sm"
                        />
                        {logged && (
                          <Badge
                            variant="success"
                            icon="✓"
                            label="Logged Today"
                            size="sm"
                          />
                        )}
                      </View>

                      <View style={styles.costAndCalCluster}>
                        <Badge
                          variant="warning"
                          icon="💰"
                          label={costInfo.formatted}
                          size="sm"
                        />
                        <Badge
                          variant="neutral"
                          label={`${m.calories} kcal`}
                          size="sm"
                        />
                      </View>
                    </View>

                    {/* Dish Name */}
                    <Text style={styles.dishName}>{m.dish_name}</Text>

                    {/* Description or Ingredients Preview */}
                    {m.description ? (
                      <Text style={styles.dishDesc} numberOfLines={2}>
                        {m.description}
                      </Text>
                    ) : m.ingredients && m.ingredients.length > 0 ? (
                      <Text style={styles.dishDesc} numberOfLines={2}>
                        • {m.ingredients.slice(0, 2).join('\n• ')}
                        {m.ingredients.length > 2 ? ` (+${m.ingredients.length - 2} more)` : ''}
                      </Text>
                    ) : null}

                    {/* Proportional Macro Distribution Bar */}
                    <View style={styles.cardMacroBar}>
                      <View style={[styles.macroBarSeg, { width: `${pPct}%`, backgroundColor: colors.protein }]} />
                      <View style={[styles.macroBarSeg, { width: `${cPct}%`, backgroundColor: colors.carbs }]} />
                      <View style={[styles.macroBarSeg, { width: `${fPct}%`, backgroundColor: colors.fat }]} />
                    </View>

                    {/* Macro Tags Row */}
                    <View style={styles.macroPillsRow}>
                      <Badge variant="protein" label={`P: ${m.protein}g`} size="sm" />
                      <Badge variant="carbs" label={`C: ${m.carbs}g`} size="sm" />
                      <Badge variant="fat" label={`F: ${m.fat}g`} size="sm" />

                      <View style={styles.viewRecipeAffordance}>
                        <Text style={styles.viewRecipeText}>Recipe & Prep ›</Text>
                      </View>
                    </View>

                    {/* 1-Tap Action Row */}
                    <View style={styles.cardActionRow}>
                      {logged ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          title="✓ Logged to Today"
                          icon="✓"
                          disabled={true}
                          style={{ flex: 1 }}
                        />
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          title="Mark as Eaten"
                          icon="🍴"
                          loading={isLoggingThis}
                          onPress={() => handleLogMeal(m)}
                          style={{ flex: 1 }}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Details →"
                        onPress={() => setActiveMeal(m)}
                      />
                    </View>
                  </Card>
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
                icon="📥"
                title="Download / Share Full Meal Plan"
                onPress={handleDownloadMealPlan}
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
  heroCard: {
    padding: spacing.cardPadding || 16,
    marginBottom: spacing.sectionGap || 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  planTitle: {
    fontSize: typography?.sizes?.lg || 20,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 4,
  },
  planTagline: {
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textSecondary || '#A79A85',
    marginBottom: 16,
    lineHeight: 18,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  macroCard: {
    flex: 1,
    backgroundColor: colors.background || '#181410',
    borderRadius: radius.md || 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
  },
  macroLabel: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    marginBottom: 4,
    fontWeight: '600',
  },
  macroVal: {
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography?.sizes?.md || 17,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  sectionSub: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    marginTop: 2,
  },
  interactiveMealCard: {
    padding: spacing.cardPadding || 16,
    marginBottom: 12,
  },
  mealCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTypeCluster: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  costAndCalCluster: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dishName: {
    fontSize: typography?.sizes?.base || 15,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 4,
  },
  dishDesc: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.textSecondary || '#A79A85',
    marginBottom: 10,
    lineHeight: 16,
  },
  cardMacroBar: {
    height: 4,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 10,
  },
  macroBarSeg: {
    height: '100%',
  },
  macroPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewRecipeAffordance: {
    flex: 1,
    alignItems: 'flex-end',
  },
  viewRecipeText: {
    fontSize: typography?.sizes?.xs || 11,
    color: colors.primary || '#E8A020',
    fontWeight: '600',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm || 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || '#2D261F',
    paddingTop: 10,
    marginTop: 10,
  },
  bottomActions: {
    gap: 12,
    marginTop: 16,
  },
});
