import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSuggestedMealPlans, selectMealPlan } from '../services/api';

const AI_STEPS = [
  {
    icon: '🎯',
    title: 'Analyzing Nutrition Targets',
    detail: 'Reading your daily calories, protein split, and fitness goal...',
  },
  {
    icon: '🥗',
    title: 'Filtering Dietary Preferences',
    detail: 'Matching cuisine styles, dietary restrictions, and budget tier...',
  },
  {
    icon: '🍳',
    title: 'Balancing Daily Meals',
    detail: 'Designing optimal portions for breakfast, lunch, and dinner...',
  },
  {
    icon: '💰',
    title: 'Estimating Costs & Macros',
    detail: 'Auditing ingredient pricing and macronutrient distribution...',
  },
  {
    icon: '✨',
    title: 'Finalizing 3 Custom Plans',
    detail: 'Polishing dish descriptions and recipes for your review...',
  },
];

const MEAL_ICONS = {
  Breakfast: '🍳',
  Lunch: '🥗',
  Snack: '☕',
  Dinner: '🍲',
};

export default function MealPlanSelectorModal({ visible, onClose, onPlanSelected, onBackToWizard }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectingId, setSelectingId] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      loadMealPlans();
    }
  }, [visible]);

  // Step sequencer interval during Gemini AI generation
  useEffect(() => {
    if (!loading) {
      setActiveStepIndex(0);
      return;
    }
    setActiveStepIndex(0);
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < AI_STEPS.length - 1 ? prev + 1 : prev));
    }, 3600);

    return () => clearInterval(interval);
  }, [loading]);

  const loadMealPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuggestedMealPlans();
      setPlans(data?.plans || []);
    } catch (err) {
      setError(err.message || 'Failed to generate AI meal plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePlan = async (plan) => {
    const planKey = plan.plan_id || plan.title;
    setSelectingId(planKey);
    try {
      const updated = await selectMealPlan(plan);
      Alert.alert('Meal Plan Activated! 🎯', `Activated: ${plan.title}`);
      onPlanSelected(updated);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to activate meal plan');
    } finally {
      setSelectingId(null);
    }
  };

  const progressPercent = Math.min(
    95,
    Math.round(((activeStepIndex + 1) / AI_STEPS.length) * 100)
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Modal Top Header */}
        <View style={styles.modalHeader}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerIcon}>✨</Text>
            <Text style={styles.headerTitle}>AI Meal Plan Generator</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          /* Animated 5-Step AI Generation Sequencer */
          <ScrollView contentContainerStyle={styles.loadingScroll}>
            <View style={styles.glowIconWrapper}>
              <Text style={styles.glowEmoji}>✨</Text>
            </View>

            <Text style={styles.loadingTitle}>Crafting Your AI Meal Plans</Text>
            <Text style={styles.loadingSubtitle}>
              Gemini AI is evaluating your target macros and local ingredient costs.
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressStepLbl}>Step {activeStepIndex + 1} of {AI_STEPS.length}</Text>
                <Text style={styles.progressPercentLbl}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* Step Sequencer List */}
            <View style={styles.stepsList}>
              {AI_STEPS.map((step, idx) => {
                const isCompleted = idx < activeStepIndex;
                const isCurrent = idx === activeStepIndex;

                return (
                  <View
                    key={step.title}
                    style={[
                      styles.stepItem,
                      isCompleted && styles.stepItemCompleted,
                      isCurrent && styles.stepItemActive,
                    ]}
                  >
                    <View style={styles.stepStatusIcon}>
                      {isCompleted ? (
                        <Text style={styles.checkIcon}>✓</Text>
                      ) : isCurrent ? (
                        <ActivityIndicator size="small" color="#E8A020" />
                      ) : (
                        <View style={styles.pendingDot} />
                      )}
                    </View>

                    <View style={styles.stepTextCol}>
                      <View style={styles.stepTitleRow}>
                        <Text style={styles.stepEmoji}>{step.icon}</Text>
                        <Text style={[styles.stepTitle, isCurrent && styles.stepTitleActive]}>{step.title}</Text>
                      </View>
                      {isCurrent && (
                        <Text style={styles.stepDetailText}>{step.detail}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <Text style={styles.loadingFooterNote}>
              ⏱️ High-precision macro calculation usually takes ~5–10 seconds
            </Text>
          </ScrollView>
        ) : error ? (
          /* Error Screen */
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Generation Failed</Text>
            <Text style={styles.errorMsg}>{error}</Text>

            <TouchableOpacity style={styles.retryBtn} onPress={loadMealPlans}>
              <Text style={styles.retryBtnText}>🔄 Retry AI Generation</Text>
            </TouchableOpacity>

            {onClose && (
              <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
                <Text style={styles.dismissBtnText}>Keep Current Plan</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* 3 Generated Candidate Meal Plans */
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.screenHeader}>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>Select Active Plan</Text>
              </View>
              <Text style={styles.screenTitle}>🍱 Choose Your Daily Meal Plan</Text>
              <Text style={styles.screenSubtitle}>
                Based on your metrics & budget, pick the schedule that best fits your daily routine.
              </Text>
            </View>

            {plans.map((plan, idx) => {
              const isSelected = selectingId === (plan.plan_id || plan.title);
              return (
                <View key={plan.plan_id || idx} style={styles.planCard}>
                  {/* Card Header */}
                  <View style={styles.planCardHeader}>
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>Plan #{idx + 1}</Text>
                    </View>
                    {plan.estimated_cost && (
                      <View style={styles.costBadge}>
                        <Text style={styles.costBadgeText}>💰 {plan.estimated_cost}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planTagline}>{plan.tagline}</Text>

                  {/* 4-Macro Grid */}
                  <View style={styles.macroRow}>
                    <View style={styles.macroBox}>
                      <Text style={[styles.macroVal, { color: '#E8A020' }]}>{plan.daily_calories}</Text>
                      <Text style={styles.macroLbl}>Calories</Text>
                    </View>
                    <View style={styles.macroBox}>
                      <Text style={[styles.macroVal, { color: '#7BA05B' }]}>{plan.protein_g}g</Text>
                      <Text style={styles.macroLbl}>Protein</Text>
                    </View>
                    <View style={styles.macroBox}>
                      <Text style={[styles.macroVal, { color: '#D9A441' }]}>{plan.carbs_g}g</Text>
                      <Text style={styles.macroLbl}>Carbs</Text>
                    </View>
                    <View style={styles.macroBox}>
                      <Text style={[styles.macroVal, { color: '#C7502F' }]}>{plan.fat_g}g</Text>
                      <Text style={styles.macroLbl}>Fat</Text>
                    </View>
                  </View>

                  {/* Daily Meal Schedule & Recipes Breakdown */}
                  <Text style={styles.breakdownHeader}>🍽️ Daily Meal Schedule</Text>
                  <View style={styles.mealsContainer}>
                    {plan.meals?.map((m, mIdx) => {
                      const icon = MEAL_ICONS[m.meal_type] || '🍱';
                      return (
                        <View key={mIdx} style={styles.mealItemBox}>
                          <View style={styles.mealItemTopRow}>
                            <View style={styles.mealTypePill}>
                              <Text style={styles.mealTypePillText}>{icon} {m.meal_type}</Text>
                            </View>
                            <Text style={styles.mealCalsText}>{m.calories} kcal</Text>
                          </View>

                          <Text style={styles.dishNameText}>{m.dish_name}</Text>

                          {/* Bulleted Ingredients */}
                          {m.ingredients && m.ingredients.length > 0 ? (
                            <View style={styles.ingredientsBox}>
                              {m.ingredients.map((ing, ingIdx) => (
                                <Text key={ingIdx} style={styles.ingredientBullet}>• {ing}</Text>
                              ))}
                            </View>
                          ) : m.description ? (
                            <Text style={styles.descriptionText}>{m.description}</Text>
                          ) : null}

                          <View style={styles.mealMacroRow}>
                            <Text style={styles.mealMacroText}>P: <Text style={{ color: '#F4ECDD' }}>{m.protein}g</Text></Text>
                            <Text style={styles.mealMacroText}>C: <Text style={{ color: '#F4ECDD' }}>{m.carbs}g</Text></Text>
                            <Text style={styles.mealMacroText}>F: <Text style={{ color: '#F4ECDD' }}>{m.fat}g</Text></Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Activate Button */}
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={() => handleChoosePlan(plan)}
                    disabled={isSelected}
                    activeOpacity={0.8}
                  >
                    {isSelected ? (
                      <ActivityIndicator color="#221803" />
                    ) : (
                      <Text style={styles.selectBtnText}>Activate This Meal Plan ✨</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Disclaimer Box */}
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                ⚖️ <Text style={{ fontWeight: 'bold', color: '#A79A85' }}>Disclaimer:</Text> CoreControl AI meal suggestions and macro estimates are generated for general wellness purposes only and do not constitute medical nutrition therapy.
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181410',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#221D17',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#A79A85',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingScroll: {
    padding: 24,
    alignItems: 'center',
  },
  glowIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  glowEmoji: {
    fontSize: 28,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F4ECDD',
    textAlign: 'center',
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#A79A85',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    backgroundColor: '#221D17',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3A3128',
    marginBottom: 20,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressStepLbl: {
    fontSize: 12,
    color: '#A79A85',
    fontWeight: '600',
  },
  progressPercentLbl: {
    fontSize: 12,
    color: '#E8A020',
    fontWeight: 'bold',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#2D261F',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E8A020',
    borderRadius: 3,
  },
  stepsList: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#221D17',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3A3128',
    gap: 12,
  },
  stepItemActive: {
    borderColor: '#E8A020',
    backgroundColor: '#2A2219',
  },
  stepItemCompleted: {
    borderColor: 'rgba(123, 160, 91, 0.4)',
  },
  stepStatusIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: '#7BA05B',
    fontWeight: 'bold',
    fontSize: 16,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#706555',
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepEmoji: {
    fontSize: 14,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A79A85',
  },
  stepTitleActive: {
    color: '#E8A020',
    fontWeight: 'bold',
  },
  stepDetailText: {
    fontSize: 11,
    color: '#A79A85',
    marginTop: 4,
    lineHeight: 15,
  },
  loadingFooterNote: {
    fontSize: 11,
    color: '#706555',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 13,
    color: '#A79A85',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  retryBtnText: {
    color: '#221803',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dismissBtn: {
    paddingVertical: 10,
  },
  dismissBtnText: {
    color: '#A79A85',
    fontSize: 13,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  screenHeader: {
    marginBottom: 16,
  },
  stepPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  stepPillText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#A79A85',
    lineHeight: 18,
  },
  planCard: {
    backgroundColor: '#221D17',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planBadge: {
    backgroundColor: '#2C251D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  planBadgeText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  costBadge: {
    backgroundColor: 'rgba(123, 160, 91, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  costBadgeText: {
    color: '#7BA05B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 4,
  },
  planTagline: {
    fontSize: 12,
    color: '#A79A85',
    lineHeight: 16,
    marginBottom: 14,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#181410',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  macroBox: {
    alignItems: 'center',
    flex: 1,
  },
  macroVal: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  macroLbl: {
    fontSize: 10,
    color: '#A79A85',
  },
  breakdownHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 10,
  },
  mealsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  mealItemBox: {
    backgroundColor: '#181410',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2D261F',
  },
  mealItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealTypePill: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mealTypePillText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mealCalsText: {
    color: '#7BA05B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dishNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 6,
  },
  ingredientsBox: {
    gap: 2,
    marginBottom: 8,
  },
  ingredientBullet: {
    fontSize: 12,
    color: '#A79A85',
    lineHeight: 16,
  },
  descriptionText: {
    fontSize: 12,
    color: '#A79A85',
    lineHeight: 16,
    marginBottom: 8,
  },
  mealMacroRow: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#2D261F',
    paddingTop: 6,
  },
  mealMacroText: {
    fontSize: 11,
    color: '#A79A85',
  },
  selectBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disclaimerBox: {
    backgroundColor: '#221D17',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3A3128',
    marginTop: 4,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#706555',
    lineHeight: 16,
  },
});
