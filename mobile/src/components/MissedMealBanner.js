import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEAL_CONFIG = {
  breakfast: {
    label: 'Breakfast',
    icon: '🍳',
    ratio: 0.25,
    tag: 'Missed Breakfast',
  },
  lunch: {
    label: 'Lunch',
    icon: '🥗',
    ratio: 0.35,
    tag: 'Missed Lunch',
  },
  dinner: {
    label: 'Dinner',
    icon: '🍲',
    ratio: 0.3,
    tag: 'Missed Dinner',
  },
};

const SNOOZE_DURATION_MS = 45 * 60 * 1000; // 45 minutes

export default function MissedMealBanner({
  user,
  userSettings,
  summary,
  isToday,
  onLogMeal,
}) {
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [dismissedMeals, setDismissedMeals] = useState({});

  useEffect(() => {
    async function loadDismissals() {
      try {
        const raw = await AsyncStorage.getItem('fitscan_missed_meals_dismissed');
        if (raw) {
          setDismissedMeals(JSON.parse(raw));
        }
      } catch (e) {
        // ignore
      }
    }
    loadDismissals();
  }, []);

  // Do not show banner if not today or no active meal plan
  const activePlan = (() => {
    const raw = userSettings?.selected_meal_plan;
    if (!raw) return null;
    if (typeof raw === 'object') return Object.keys(raw).length > 0 ? raw : null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      return null;
    }
  })();

  if (!isToday || !activePlan) {
    return null;
  }

  const loggedMeals = summary?.meals || [];
  const now = new Date();
  const currentHour = now.getHours();
  const currentTime = now.getTime();

  const hasBreakfast = loggedMeals.some(
    (m) => m.meal_type?.toLowerCase() === 'breakfast'
  );
  const hasLunch = loggedMeals.some(
    (m) => m.meal_type?.toLowerCase() === 'lunch'
  );
  const hasDinner = loggedMeals.some(
    (m) => m.meal_type?.toLowerCase() === 'dinner'
  );

  const missedMeals = [];

  // Check breakfast: 11:00 AM or later, or if lunch/dinner already logged
  if (!hasBreakfast && (currentHour >= 11 || hasLunch || hasDinner)) {
    const dismissedAt = dismissedMeals['breakfast'];
    if (!dismissedAt || currentTime - dismissedAt > SNOOZE_DURATION_MS) {
      missedMeals.push('breakfast');
    }
  }

  // Check lunch: 3:00 PM (15:00) or later, or if dinner already logged
  if (!hasLunch && (currentHour >= 15 || hasDinner)) {
    const dismissedAt = dismissedMeals['lunch'];
    if (!dismissedAt || currentTime - dismissedAt > SNOOZE_DURATION_MS) {
      missedMeals.push('lunch');
    }
  }

  // Check dinner: 9:00 PM (21:00) or later
  if (!hasDinner && currentHour >= 21) {
    const dismissedAt = dismissedMeals['dinner'];
    if (!dismissedAt || currentTime - dismissedAt > SNOOZE_DURATION_MS) {
      missedMeals.push('dinner');
    }
  }

  if (missedMeals.length === 0) {
    return null;
  }

  // Active meal type (prefer explicitly selected tab if still missed, else latest missed)
  const activeMealType =
    selectedMealType && missedMeals.includes(selectedMealType)
      ? selectedMealType
      : missedMeals[missedMeals.length - 1];

  const config = MEAL_CONFIG[activeMealType];
  if (!config) return null;

  // User's first name for personalization
  const rawName = user?.name || userSettings?.name || '';
  const firstName = rawName.trim() ? rawName.trim().split(' ')[0] : 'there';

  // Macro & dish info from active plan
  const planMeals = activePlan?.meals || [];
  const planMeal = planMeals.find(
    (m) => m.meal_type?.toLowerCase() === activeMealType
  );

  let targetCalories, targetProtein, targetCarbs, targetFat, dishName;

  if (planMeal) {
    targetCalories = planMeal.calories;
    targetProtein = planMeal.protein;
    targetCarbs = planMeal.carbs;
    targetFat = planMeal.fat;
    dishName = planMeal.dish_name;
  } else {
    const calsGoal = summary?.calorie_goal || userSettings?.calorie_goal || 2000;
    const protGoal = summary?.protein_goal || userSettings?.protein_goal || 150;
    const carbsGoal = summary?.carbs_goal || userSettings?.carbs_goal || 200;
    const fatGoal = summary?.fat_goal || userSettings?.fat_goal || 65;

    targetCalories = Math.round(calsGoal * config.ratio);
    targetProtein = Math.round(protGoal * config.ratio);
    targetCarbs = Math.round(carbsGoal * config.ratio);
    targetFat = Math.round(fatGoal * config.ratio);
    dishName = null;
  }

  const handleDismiss = async () => {
    const updated = {
      ...dismissedMeals,
      [activeMealType]: Date.now(),
    };
    setDismissedMeals(updated);
    try {
      await AsyncStorage.setItem('fitscan_missed_meals_dismissed', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleLogClick = () => {
    if (onLogMeal) {
      onLogMeal(activeMealType, dishName);
    }
  };

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.bannerHeaderRow}>
        <View style={styles.badgeRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.badgeText}>{config.icon} {config.tag}</Text>
        </View>

        {missedMeals.length > 1 && (
          <View style={styles.miniTabsRow}>
            {missedMeals.map((type) => {
              const tabCfg = MEAL_CONFIG[type];
              const isActive = activeMealType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.miniTab, isActive && styles.miniTabActive]}
                  onPress={() => setSelectedMealType(type)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.miniTabIcon}>{tabCfg.icon}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.headline}>
        <Text style={{ fontWeight: 'bold', color: '#F4ECDD' }}>{firstName}</Text>,{' '}
        {dishName ? `planned: ${dishName}` : `missing ~${targetCalories} kcal`}
      </Text>

      {/* Planned Macro Distribution */}
      <View style={styles.macroRow}>
        <View style={styles.macroPill}>
          <Text style={[styles.macroPillVal, { color: '#E8A020' }]}>{targetCalories}</Text>
          <Text style={styles.macroPillLbl}> kcal</Text>
        </View>
        <Text style={styles.macroDot}>•</Text>
        <View style={styles.macroPill}>
          <Text style={[styles.macroPillVal, { color: '#7BA05B' }]}>{targetProtein}g</Text>
          <Text style={styles.macroPillLbl}> protein</Text>
        </View>
        <Text style={styles.macroDot}>•</Text>
        <View style={styles.macroPill}>
          <Text style={[styles.macroPillVal, { color: '#D9A441' }]}>{targetCarbs}g</Text>
          <Text style={styles.macroPillLbl}> carbs</Text>
        </View>
        <Text style={styles.macroDot}>•</Text>
        <View style={styles.macroPill}>
          <Text style={[styles.macroPillVal, { color: '#C7502F' }]}>{targetFat}g</Text>
          <Text style={styles.macroPillLbl}> fat</Text>
        </View>
      </View>

      {/* Log Now Action Button */}
      <TouchableOpacity
        style={styles.logActionBtn}
        onPress={handleLogClick}
        activeOpacity={0.8}
      >
        <Text style={styles.logActionBtnText}>
          {dishName ? `Log Planned ${config.label} (${dishName})` : `Log ${config.label} Now`}
        </Text>
        <Text style={styles.logActionArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.4)',
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8A020',
  },
  badgeText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  miniTabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniTab: {
    backgroundColor: '#181410',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  miniTabActive: {
    borderColor: '#E8A020',
    backgroundColor: 'rgba(232, 160, 32, 0.2)',
  },
  miniTabIcon: {
    fontSize: 12,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#706555',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headline: {
    fontSize: 14,
    color: '#A79A85',
    lineHeight: 19,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#181410',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  macroPillVal: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  macroPillLbl: {
    fontSize: 11,
    color: '#A79A85',
  },
  macroDot: {
    color: '#3A3128',
    fontSize: 12,
  },
  logActionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.4)',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  logActionBtnText: {
    color: '#E8A020',
    fontSize: 13,
    fontWeight: 'bold',
  },
  logActionArrow: {
    color: '#E8A020',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
