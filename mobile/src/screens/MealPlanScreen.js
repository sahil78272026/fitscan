import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSettings } from '../services/api';

const MEAL_TYPE_ICONS = {
  Breakfast: '🍳',
  Lunch: '🥗',
  Snack: '☕',
  Dinner: '🍲',
};

export default function MealPlanScreen({ navigation }) {
  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlan() {
      try {
        setLoading(true);
        const settings = await getSettings();
        setUserSettings(settings);
      } catch (err) {
        console.warn('Error fetching meal plan:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlan();
  }, []);

  const selectedPlan = userSettings?.selected_meal_plan;

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
    content += `Daily Targets: ${calories} kcal | ${protein}g Protein | ${carbs}g Carbs | ${fat}g Fat\n\n`;
    content += `--- MEAL SCHEDULE ---\n\n`;

    (selectedPlan.meals || []).forEach((m, idx) => {
      content += `${idx + 1}. [${m.meal_type.toUpperCase()}] ${m.dish_name} (${m.calories} kcal)\n`;
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

    content += `Generated with CoreControl • www.corecontrol.fit\n`;

    try {
      await Share.share({
        title: `CoreControl Meal Plan - ${selectedPlan.title || 'Daily Plan'}`,
        message: content,
      });
    } catch (error) {
      Alert.alert('Download Error', error.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#E8A020" />
          <Text style={styles.loaderText}>Loading Meal Plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header matching Web */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Tracker</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Meal Plan Details</Text>
        <TouchableOpacity style={styles.headerDownloadBtn} onPress={handleDownloadMealPlan}>
          <Text style={styles.headerDownloadBtnText}>📥 Download</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!selectedPlan ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Active Meal Plan Selected</Text>
            <Text style={styles.emptySubtext}>
              Go to Profile to set your metrics and select an AI-generated daily meal plan schedule.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Profile')}>
              <Text style={styles.primaryBtnText}>Go to Profile & Select Plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Active Plan Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.badgeRow}>
                <View style={styles.badge}><Text style={styles.badgeText}>✨ Active Plan</Text></View>
                {userSettings?.can_change_plan === false && (
                  <View style={[styles.badge, { backgroundColor: 'rgba(234, 88, 12, 0.15)', borderColor: 'rgba(234, 88, 12, 0.35)' }]}>
                    <Text style={[styles.badgeText, { color: '#fb923c' }]}>
                      ⏳ Next change in {userSettings.hours_until_next_plan_change || 1}h
                    </Text>
                  </View>
                )}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{(userSettings?.goal_type || 'fat_loss').replace('_', ' ').toUpperCase()}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{(userSettings?.diet_type || 'veg').toUpperCase()}</Text>
                </View>
                {selectedPlan.estimated_cost && (
                  <View style={[styles.badge, styles.costBadge]}>
                    <Text style={styles.costBadgeText}>💰 {selectedPlan.estimated_cost}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.planTitle}>{selectedPlan.title || 'Personalized AI Meal Plan'}</Text>
              <Text style={styles.planTagline}>{selectedPlan.tagline || 'Tailored specifically to hit your daily macro targets.'}</Text>

              {/* Macro Distribution Cards Grid */}
              <View style={styles.macroGrid}>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <Text style={[styles.macroVal, { color: '#E8A020' }]}>
                    {selectedPlan.daily_calories || userSettings?.calorie_goal} kcal
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={[styles.macroVal, { color: '#7BA05B' }]}>
                    {selectedPlan.protein_g || userSettings?.protein_goal}g
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Carbs</Text>
                  <Text style={[styles.macroVal, { color: '#D9A441' }]}>
                    {selectedPlan.carbs_g || userSettings?.carbs_goal}g
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroLabel}>Fat</Text>
                  <Text style={[styles.macroVal, { color: '#C7502F' }]}>
                    {selectedPlan.fat_g || userSettings?.fat_goal}g
                  </Text>
                </View>
              </View>
            </View>

            {/* Daily 4-Meal Schedule Section */}
            <Text style={styles.sectionTitle}>Daily Meal Schedule & Recipes</Text>

            {selectedPlan.meals && selectedPlan.meals.length > 0 ? (
              selectedPlan.meals.map((m, idx) => {
                const icon = MEAL_TYPE_ICONS[m.meal_type] || '🍱';
                return (
                  <View key={idx} style={styles.mealCard}>
                    <View style={styles.mealCardHeader}>
                      <Text style={styles.mealTypeTag}>{icon} {m.meal_type}</Text>
                      <Text style={styles.mealCalsPill}>{m.calories} kcal</Text>
                    </View>

                    <Text style={styles.dishName}>{m.dish_name}</Text>
                    {m.ingredients && m.ingredients.length > 0 ? (
                      <View style={{ marginVertical: 6, gap: 3 }}>
                        {m.ingredients.map((ing, ingIdx) => (
                          <Text key={ingIdx} style={styles.dishDesc}>• {ing}</Text>
                        ))}
                      </View>
                    ) : m.description ? (
                      <Text style={styles.dishDesc}>{m.description}</Text>
                    ) : null}

                    <View style={styles.macroSubRow}>
                      <Text style={styles.macroSubItem}>Protein: <Text style={{ color: '#F4ECDD', fontWeight: 'bold' }}>{m.protein}g</Text></Text>
                      <Text style={styles.macroSubItem}>Carbs: <Text style={{ color: '#F4ECDD', fontWeight: 'bold' }}>{m.carbs}g</Text></Text>
                      <Text style={styles.macroSubItem}>Fat: <Text style={{ color: '#F4ECDD', fontWeight: 'bold' }}>{m.fat}g</Text></Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptySubtext}>No meal items listed in this plan.</Text>
            )}

            <View style={{ gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={styles.downloadActionBtn} onPress={handleDownloadMealPlan}>
                <Text style={styles.downloadActionBtnText}>📥 Download / Share Meal Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Profile')}>
                <Text style={styles.primaryBtnText}>
                  Change Meal Plan in Profile
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181410',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#A79A85',
    fontSize: 14,
    marginTop: 10,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#221D17',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: '#E8A020',
    fontSize: 13,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  profileBtn: {
    padding: 6,
  },
  profileBtnText: {
    color: '#A79A85',
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    padding: 16,
  },
  emptyCard: {
    backgroundColor: '#221D17',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#A79A85',
    textAlign: 'center',
    marginBottom: 20,
  },
  heroCard: {
    backgroundColor: '#221D17',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8A020',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#2C251D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  proPlanBadge: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: '#E8A020',
  },
  proPlanBadgeText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rotationBadgeReady: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  rotationBadgeReadyText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rotationBadgeCooldown: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.35)',
  },
  rotationBadgeCooldownText: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: 'bold',
  },
  costBadge: {
    backgroundColor: '#E8A020',
  },
  costBadgeText: {
    color: '#221803',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 6,
  },
  planTagline: {
    fontSize: 13,
    color: '#A79A85',
    marginBottom: 16,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#181410',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  macroLabel: {
    fontSize: 10,
    color: '#A79A85',
    marginBottom: 4,
  },
  macroVal: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 14,
  },
  mealCard: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTypeTag: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  mealCalsPill: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7BA05B',
    backgroundColor: '#181410',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dishName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 4,
  },
  dishDesc: {
    fontSize: 13,
    color: '#A79A85',
    marginBottom: 12,
  },
  macroSubRow: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#181410',
    padding: 8,
    borderRadius: 6,
  },
  macroSubItem: {
    fontSize: 12,
    color: '#A79A85',
  },
  primaryBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#221803',
    fontSize: 15,
    fontWeight: 'bold',
  },
  headerDownloadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.4)',
  },
  headerDownloadBtnText: {
    color: '#E8A020',
    fontSize: 12,
    fontWeight: '700',
  },
  downloadActionBtn: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.5)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  downloadActionBtnText: {
    color: '#E8A020',
    fontSize: 14,
    fontWeight: '700',
  },
  proActionBtn: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  proActionBtnText: {
    color: '#E8A020',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
