import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateUserGoals } from '../services/api';

const GOALS = [
  { id: 'fat_loss', label: '🔥 Fat Loss', desc: 'Burn body fat while maintaining muscle mass', tag: 'High Protein • Deficit' },
  { id: 'weight_loss', label: '📉 Weight Loss', desc: 'Steady caloric deficit for healthy weight drop', tag: 'Caloric Deficit' },
  { id: 'muscle_building', label: '💪 Muscle Building', desc: 'Gain lean muscle mass with surplus protein', tag: 'Surplus • High Protein' },
  { id: 'muscle_maintain', label: '⚖️ Maintenance', desc: 'Maintain current weight and optimize energy', tag: 'Balanced Energy' },
];

const DIETS = [
  { id: 'veg', label: '🥦 Vegetarian', desc: 'Plant foods, lentils, dairy & legumes' },
  { id: 'non_veg', label: '🍗 Non-Vegetarian', desc: 'Chicken, fish, eggs & dairy' },
  { id: 'vegan', label: '🌱 Vegan', desc: '100% plant-based, no dairy or eggs' },
  { id: 'eggetarian', label: '🍳 Eggetarian', desc: 'Vegetarian plus eggs' },
];

const BUDGETS = [
  { id: 'low_budget', label: '🪙 Pocket Friendly', desc: 'Budget staples: Chana, Rajma, Eggs, Rice & Seasonal Veggies', cost: '₹100-140/day' },
  { id: 'moderate', label: '💳 Moderate', desc: 'Balanced variety: Paneer, Oats, Milk, Tofu, Local Chicken', cost: '₹180-250/day' },
  { id: 'flexible', label: '🌟 Flexible', desc: 'High protein & gourmet items: Whey, Fish, Nuts, Avocados', cost: '₹300+/day' },
];

const ACTIVITIES = [
  { id: 'sedentary', icon: '🪑', title: 'Sedentary', desc: 'Desk job, little to no workout' },
  { id: 'light', icon: '🚶', title: 'Light', desc: '1–3 workouts or walks/week' },
  { id: 'moderate', icon: '🏃', title: 'Moderate', desc: '3–5 regular workout days/week' },
  { id: 'very_active', icon: '⚡', title: 'Very Active', desc: '6–7 intense workouts/heavy training' },
];

const getGoalName = (id) => {
  const g = GOALS.find((item) => item.id === id);
  if (!g) return 'Goal';
  return g.label.replace(/^[^\w]+/, '').trim();
};

const getDietName = (id) => {
  const d = DIETS.find((item) => item.id === id);
  if (!d) return 'Diet';
  return d.label.replace(/^[^\w]+/, '').trim();
};

const getBudgetName = (id) => {
  const b = BUDGETS.find((item) => item.id === id);
  if (!b) return 'Budget';
  return b.label.replace(/^[^\w]+/, '').trim();
};

export default function OnboardingModal({ visible, initialSettings, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState(initialSettings?.goal_type || 'fat_loss');
  const [dietType, setDietType] = useState(initialSettings?.diet_type || 'veg');
  const [budgetTier, setBudgetTier] = useState(initialSettings?.budget_tier || 'moderate');
  const [activityLevel, setActivityLevel] = useState(initialSettings?.activity_level || 'moderate');
  const [age, setAge] = useState(initialSettings?.age || 25);
  const [gender, setGender] = useState(initialSettings?.gender || 'male');
  const [heightCm, setHeightCm] = useState(initialSettings?.height_cm || 170);
  const [weightKg, setWeightKg] = useState(initialSettings?.weight_kg || 70);

  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [loading, setLoading] = useState(false);

  const scrollViewRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  const [cardOffsets, setCardOffsets] = useState({
    gender: 70,
    age: 180,
    weight: 310,
    height: 440,
    activity: 600,
  });

  const handleCardLayout = (key, event) => {
    const { y, height } = event.nativeEvent.layout;
    const triggerY = Math.max(20, Math.round(y + height * 0.35));
    setCardOffsets((prev) => (Math.abs(prev[key] - triggerY) < 5 ? prev : { ...prev, [key]: triggerY }));
  };

  useEffect(() => {
    setScrollY(0);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  useEffect(() => {
    if (initialSettings) {
      if (initialSettings.goal_type) setGoalType(initialSettings.goal_type);
      if (initialSettings.diet_type) setDietType(initialSettings.diet_type);
      if (initialSettings.budget_tier) setBudgetTier(initialSettings.budget_tier);
      if (initialSettings.activity_level) setActivityLevel(initialSettings.activity_level);
      if (initialSettings.age) setAge(Number(initialSettings.age));
      if (initialSettings.gender) setGender(initialSettings.gender);
      if (initialSettings.height_cm) setHeightCm(Number(initialSettings.height_cm));
      if (initialSettings.weight_kg) setWeightKg(Number(initialSettings.weight_kg));
    }
  }, [initialSettings]);

  // Step Selectors with auto-advance
  const handleSelectGoal = (id) => {
    setGoalType(id);
    setTimeout(() => setStep(2), 150);
  };

  const handleSelectDiet = (id) => {
    setDietType(id);
    setTimeout(() => setStep(3), 150);
  };

  const handleSelectBudget = (id) => {
    setBudgetTier(id);
    setTimeout(() => setStep(4), 150);
  };

  // Weight handlers
  const displayWeight = weightUnit === 'kg' ? weightKg : Math.round(weightKg * 2.20462 * 10) / 10;

  const handleWeightChange = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    if (weightUnit === 'kg') {
      setWeightKg(Math.max(30, Math.min(250, num)));
    } else {
      setWeightKg(Math.max(30, Math.min(250, Math.round((num / 2.20462) * 10) / 10)));
    }
  };

  const stepWeight = (delta) => {
    if (weightUnit === 'kg') {
      setWeightKg((prev) => Math.max(30, Math.min(250, Math.round((Number(prev) + delta) * 10) / 10)));
    } else {
      const currentLbs = weightKg * 2.20462;
      const newLbs = Math.max(66, Math.min(550, currentLbs + delta));
      setWeightKg(Math.round((newLbs / 2.20462) * 10) / 10);
    }
  };

  // Height handlers
  const feet = Math.floor(heightCm / 30.48);
  const inches = Math.round((heightCm % 30.48) / 2.54);

  const handleHeightFtChange = (newFt, newIn) => {
    const ft = Math.max(3, Math.min(7, parseInt(newFt, 10) || 0));
    const inc = Math.max(0, Math.min(11, parseInt(newIn, 10) || 0));
    const totalCm = Math.round(ft * 30.48 + inc * 2.54);
    setHeightCm(Math.max(100, Math.min(240, totalCm)));
  };

  const stepHeight = (delta) => {
    setHeightCm((prev) => Math.max(100, Math.min(240, Number(prev) + delta)));
  };

  const stepFeet = (delta) => {
    const newFt = Math.max(3, Math.min(7, feet + delta));
    handleHeightFtChange(newFt, inches);
  };

  const stepInches = (delta) => {
    const totalInches = feet * 12 + inches + delta;
    const clampedInches = Math.max(36, Math.min(95, totalInches));
    const newFt = Math.floor(clampedInches / 12);
    const newIn = clampedInches % 12;
    handleHeightFtChange(newFt, newIn);
  };

  // Age step
  const stepAge = (delta) => {
    setAge((prev) => Math.max(12, Math.min(99, Number(prev) + delta)));
  };

  // Live Calculations (Mifflin-St Jeor Formula)
  const calcResults = useMemo(() => {
    const w = Number(weightKg) || 70;
    const h = Number(heightCm) || 170;
    const a = Number(age) || 25;

    const bmiVal = w / ((h / 100) ** 2);
    let bmiCategory = 'Normal';
    let bmiColor = '#7BA05B';
    if (bmiVal < 18.5) {
      bmiCategory = 'Underweight';
      bmiColor = '#D9A441';
    } else if (bmiVal >= 25 && bmiVal < 30) {
      bmiCategory = 'Overweight';
      bmiColor = '#E8A020';
    } else if (bmiVal >= 30) {
      bmiCategory = 'Obese';
      bmiColor = '#C7502F';
    }

    // BMR
    const bmr = gender === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;

    const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725 };
    const tdee = Math.round(bmr * (mults[activityLevel] || 1.55));

    let target = tdee;
    let goalLabel = 'Maintenance';
    if (goalType === 'fat_loss') {
      target = Math.round(tdee * 0.8);
      goalLabel = 'Fat Loss (-20%)';
    } else if (goalType === 'weight_loss') {
      target = Math.round(tdee * 0.85);
      goalLabel = 'Weight Loss (-15%)';
    } else if (goalType === 'muscle_building') {
      target = Math.round(tdee * 1.12);
      goalLabel = 'Muscle Building (+12%)';
    }

    return {
      bmi: bmiVal.toFixed(1),
      bmiCategory,
      bmiColor,
      bmr: Math.round(bmr),
      tdee,
      target,
      goalLabel,
    };
  }, [weightKg, heightCm, age, gender, activityLevel, goalType]);

  const showGender = scrollY >= cardOffsets.gender;
  const showAge = scrollY >= cardOffsets.age;
  const showWeight = scrollY >= cardOffsets.weight;
  const showHeight = scrollY >= cardOffsets.height;
  const showActivity = scrollY >= cardOffsets.activity;

  const hasAnySticky = showGender || showAge || showWeight || showHeight || showActivity;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        goal_type: goalType,
        diet_type: dietType,
        budget_tier: budgetTier,
        activity_level: activityLevel,
        age: parseInt(age, 10) || 25,
        gender,
        height_cm: parseFloat(heightCm) || 170,
        weight_kg: parseFloat(weightKg) || 70,
      };

      const updated = await updateUserGoals(payload);
      onComplete(updated);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save onboarding goals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header & Step Bar */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>✨</Text>
              <Text style={styles.headerTitle}>Personalization Wizard</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar & Stage Indicator */}
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stepLabelsRow}
            >
              <TouchableOpacity
                onPress={() => step > 1 && setStep(1)}
                disabled={step <= 1}
                activeOpacity={0.7}
                style={step > 1 ? styles.completedStepBadge : styles.stepBadge}
              >
                <Text
                  style={[
                    styles.stepLabel,
                    step === 1 && styles.stepLabelCurrent,
                    step > 1 && styles.stepLabelCompleted,
                  ]}
                >
                  {step > 1 ? `Goal (${getGoalName(goalType)})` : '1. Goal'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.stepDivider}>›</Text>

              <TouchableOpacity
                onPress={() => step > 2 && setStep(2)}
                disabled={step <= 2}
                activeOpacity={0.7}
                style={step > 2 ? styles.completedStepBadge : styles.stepBadge}
              >
                <Text
                  style={[
                    styles.stepLabel,
                    step === 2 && styles.stepLabelCurrent,
                    step > 2 && styles.stepLabelCompleted,
                  ]}
                >
                  {step > 2 ? `Diet (${getDietName(dietType)})` : '2. Diet'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.stepDivider}>›</Text>

              <TouchableOpacity
                onPress={() => step > 3 && setStep(3)}
                disabled={step <= 3}
                activeOpacity={0.7}
                style={step > 3 ? styles.completedStepBadge : styles.stepBadge}
              >
                <Text
                  style={[
                    styles.stepLabel,
                    step === 3 && styles.stepLabelCurrent,
                    step > 3 && styles.stepLabelCompleted,
                  ]}
                >
                  {step > 3 ? `Budget (${getBudgetName(budgetTier)})` : '3. Budget'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.stepDivider}>›</Text>

              <View style={styles.stepBadge}>
                <Text style={[styles.stepLabel, step === 4 && styles.stepLabelCurrent]}>
                  4. Metrics
                </Text>
              </View>
            </ScrollView>
          </View>

          {/* Sticky Dynamic Metrics Summary Bar (appears dynamically and step-wise when scrolling in Step 4) */}
          {step === 4 && hasAnySticky && (
            <View style={styles.stickyMetricsBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stickyMetricsScroll}
              >
                <Text style={styles.stickyMetricsTitle}>Selected:</Text>

                {/* 1. Gender */}
                {showGender && (
                  <TouchableOpacity
                    style={styles.stickyMetricChip}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: Math.max(0, (cardOffsets.gender || 70) - 100), animated: true })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stickyMetricChipText}>
                      {gender === 'male' ? '👨 Male' : '👩 Female'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 2. Age */}
                {showAge && (
                  <TouchableOpacity
                    style={styles.stickyMetricChip}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: Math.max(0, (cardOffsets.age || 180) - 100), animated: true })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stickyMetricChipText}>
                      🎂 {age} yrs
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 3. Weight - with plus/minus stepper */}
                {showWeight && (
                  <View style={styles.miniStepperChip}>
                    <TouchableOpacity
                      style={styles.miniChipBtn}
                      onPress={() => stepWeight(weightUnit === 'kg' ? -0.5 : -1)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.miniChipBtnText}>–</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => scrollViewRef.current?.scrollTo({ y: Math.max(0, (cardOffsets.weight || 310) - 100), animated: true })}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stickyMetricChipText}>
                        ⚖️ {displayWeight} {weightUnit}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.miniChipBtn}
                      onPress={() => stepWeight(weightUnit === 'kg' ? 0.5 : 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.miniChipBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 4. Height - with plus/minus stepper */}
                {showHeight && (
                  <View style={styles.miniStepperChip}>
                    <TouchableOpacity
                      style={styles.miniChipBtn}
                      onPress={() => (heightUnit === 'cm' ? stepHeight(-1) : stepInches(-1))}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.miniChipBtnText}>–</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => scrollViewRef.current?.scrollTo({ y: Math.max(0, (cardOffsets.height || 440) - 100), animated: true })}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stickyMetricChipText}>
                        📏 {heightUnit === 'cm' ? `${heightCm} cm` : `${feet}'${inches}"`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.miniChipBtn}
                      onPress={() => (heightUnit === 'cm' ? stepHeight(1) : stepInches(1))}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.miniChipBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 5. Activity */}
                {showActivity && (
                  <TouchableOpacity
                    style={styles.stickyMetricChip}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: Math.max(0, (cardOffsets.activity || 600) - 100), animated: true })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stickyMetricChipText}>
                      {ACTIVITIES.find((a) => a.id === activityLevel)?.icon || '🏃'}{' '}
                      {ACTIVITIES.find((a) => a.id === activityLevel)?.title || 'Moderate'}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scroll}
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            {/* STEP 1: GOALS */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={styles.screenTitle}>🎯 What is your primary fitness goal?</Text>
                <Text style={styles.screenSubtitle}>We will customize your daily calories & macros based on this target.</Text>

                <View style={styles.cardList}>
                  {GOALS.map((g) => {
                    const isSelected = goalType === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.cardItem, isSelected && styles.cardItemActive]}
                        onPress={() => handleSelectGoal(g.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardTopRow}>
                          <Text style={styles.cardLabel}>{g.label}</Text>
                          <View style={[styles.cardTag, isSelected && styles.cardTagActive]}>
                            <Text style={[styles.cardTagText, isSelected && styles.cardTagTextActive]}>{g.tag}</Text>
                          </View>
                        </View>
                        <Text style={styles.cardDesc}>{g.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* STEP 2: DIET */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={styles.screenTitle}>🥗 What is your dietary style?</Text>
                <Text style={styles.screenSubtitle}>Your AI meal plans will only include recipes aligned with your diet.</Text>

                <View style={styles.cardList}>
                  {DIETS.map((d) => {
                    const isSelected = dietType === d.id;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.cardItem, isSelected && styles.cardItemActive]}
                        onPress={() => handleSelectDiet(d.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cardLabel}>{d.label}</Text>
                        <Text style={styles.cardDesc}>{d.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* STEP 3: BUDGET */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={styles.screenTitle}>🪙 Select your daily food budget</Text>
                <Text style={styles.screenSubtitle}>We'll tailor ingredients to match your preferred spend range.</Text>

                <View style={styles.cardList}>
                  {BUDGETS.map((b) => {
                    const isSelected = budgetTier === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.cardItem, isSelected && styles.cardItemActive]}
                        onPress={() => handleSelectBudget(b.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardTopRow}>
                          <Text style={styles.cardLabel}>{b.label}</Text>
                          <View style={styles.costBadge}>
                            <Text style={styles.costBadgeText}>{b.cost}</Text>
                          </View>
                        </View>
                        <Text style={styles.cardDesc}>{b.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* STEP 4: BODY METRICS & ACTIVITY */}
            {step === 4 && (
              <View style={styles.stepContainer}>
                <Text style={styles.screenTitle}>📏 Enter your personal stats</Text>
                <Text style={styles.screenSubtitle}>Used to calculate your Basal Metabolic Rate (BMR) and daily targets.</Text>

                {/* Gender Toggle */}
                <View style={styles.metricCard} onLayout={(e) => handleCardLayout('gender', e)}>
                  <Text style={styles.inputLabel}>👤 Gender</Text>
                  <View style={styles.genderRow}>
                    <TouchableOpacity
                      style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                      onPress={() => setGender('male')}
                    >
                      <Text style={[styles.genderBtnText, gender === 'male' && styles.genderBtnTextActive]}>👨 Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                      onPress={() => setGender('female')}
                    >
                      <Text style={[styles.genderBtnText, gender === 'female' && styles.genderBtnTextActive]}>👩 Female</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Age Input (now right below Gender) */}
                <View style={styles.metricCard} onLayout={(e) => handleCardLayout('age', e)}>
                  <Text style={styles.inputLabel}>🎂 Age</Text>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => stepAge(-1)}>
                      <Text style={styles.stepperBtnText}>–</Text>
                    </TouchableOpacity>
                    <View style={styles.stepperValWrapper}>
                      <TextInput
                        style={styles.stepperInput}
                        value={String(age)}
                        onChangeText={(v) => {
                          setAge(Math.max(12, Math.min(99, parseInt(v, 10) || 25)));
                        }}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.stepperUnit}>yrs</Text>
                    </View>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => stepAge(1)}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Weight Input */}
                <View style={styles.metricCard} onLayout={(e) => handleCardLayout('weight', e)}>
                  <View style={styles.metricHeaderRow}>
                    <Text style={styles.inputLabel}>⚖️ Weight</Text>
                    <View style={styles.unitToggleGroup}>
                      <TouchableOpacity
                        style={[styles.unitToggleBtn, weightUnit === 'kg' && styles.unitToggleBtnActive]}
                        onPress={() => setWeightUnit('kg')}
                      >
                        <Text style={[styles.unitToggleText, weightUnit === 'kg' && styles.unitToggleTextActive]}>kg</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitToggleBtn, weightUnit === 'lbs' && styles.unitToggleBtnActive]}
                        onPress={() => setWeightUnit('lbs')}
                      >
                        <Text style={[styles.unitToggleText, weightUnit === 'lbs' && styles.unitToggleTextActive]}>lbs</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.stepperContainer}>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => stepWeight(weightUnit === 'kg' ? -0.5 : -1)}>
                      <Text style={styles.stepperBtnText}>–</Text>
                    </TouchableOpacity>
                    <View style={styles.stepperValWrapper}>
                      <TextInput
                        style={styles.stepperInput}
                        value={String(displayWeight)}
                        onChangeText={handleWeightChange}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.stepperUnit}>{weightUnit}</Text>
                    </View>
                    <TouchableOpacity style={styles.stepperBtn} onPress={() => stepWeight(weightUnit === 'kg' ? 0.5 : 1)}>
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Height Input */}
                <View style={styles.metricCard} onLayout={(e) => handleCardLayout('height', e)}>
                  <View style={styles.metricHeaderRow}>
                    <Text style={styles.inputLabel}>📏 Height</Text>
                    <View style={styles.unitToggleGroup}>
                      <TouchableOpacity
                        style={[styles.unitToggleBtn, heightUnit === 'cm' && styles.unitToggleBtnActive]}
                        onPress={() => setHeightUnit('cm')}
                      >
                        <Text style={[styles.unitToggleText, heightUnit === 'cm' && styles.unitToggleTextActive]}>cm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.unitToggleBtn, heightUnit === 'ft' && styles.unitToggleBtnActive]}
                        onPress={() => setHeightUnit('ft')}
                      >
                        <Text style={[styles.unitToggleText, heightUnit === 'ft' && styles.unitToggleTextActive]}>ft/in</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {heightUnit === 'cm' ? (
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepHeight(-1)}>
                        <Text style={styles.stepperBtnText}>–</Text>
                      </TouchableOpacity>
                      <View style={styles.stepperValWrapper}>
                        <TextInput
                          style={styles.stepperInput}
                          value={String(heightCm)}
                          onChangeText={(v) => {
                            setHeightCm(Math.max(100, Math.min(240, parseInt(v, 10) || 170)));
                          }}
                          keyboardType="number-pad"
                        />
                        <Text style={styles.stepperUnit}>cm</Text>
                      </View>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepHeight(1)}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.ftInRow}>
                      <View style={styles.ftInCol}>
                        <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepFeet(-1)}>
                          <Text style={styles.stepperBtnText}>–</Text>
                        </TouchableOpacity>
                        <View style={styles.stepperValWrapper}>
                          <TextInput
                            style={styles.stepperInput}
                            value={String(feet)}
                            onChangeText={(v) => handleHeightFtChange(v, inches)}
                            keyboardType="number-pad"
                          />
                          <Text style={styles.stepperUnit}>ft</Text>
                        </View>
                        <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepFeet(1)}>
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.ftInCol}>
                        <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepInches(-1)}>
                          <Text style={styles.stepperBtnText}>–</Text>
                        </TouchableOpacity>
                        <View style={styles.stepperValWrapper}>
                          <TextInput
                            style={styles.stepperInput}
                            value={String(inches)}
                            onChangeText={(v) => handleHeightFtChange(feet, v)}
                            keyboardType="number-pad"
                          />
                          <Text style={styles.stepperUnit}>in</Text>
                        </View>
                        <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepInches(1)}>
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Activity Level */}
                <View onLayout={(e) => handleCardLayout('activity', e)}>
                  <Text style={[styles.inputLabel, { marginTop: 14, marginBottom: 8 }]}>⚡ Activity Level</Text>
                  <View style={styles.activityGrid}>
                    {ACTIVITIES.map((act) => {
                      const isSelected = activityLevel === act.id;
                      return (
                        <TouchableOpacity
                          key={act.id}
                          style={[styles.activityCard, isSelected && styles.activityCardActive]}
                          onPress={() => setActivityLevel(act.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.activityIcon}>{act.icon}</Text>
                          <Text style={[styles.activityTitle, isSelected && styles.activityTitleActive]}>{act.title}</Text>
                          <Text style={styles.activityDesc}>{act.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Live Target Projection Preview Card */}
                <View style={styles.liveCalcCard}>
                  <Text style={styles.liveCalcHeader}>📊 LIVE TARGET PROJECTION</Text>
                  <View style={styles.calcMetricsRow}>
                    <View style={styles.calcMetricBox}>
                      <Text style={styles.calcMetricVal}>{calcResults.bmr}</Text>
                      <Text style={styles.calcMetricLbl}>BMR kcal</Text>
                    </View>
                    <View style={styles.calcMetricBox}>
                      <Text style={styles.calcMetricVal}>{calcResults.tdee}</Text>
                      <Text style={styles.calcMetricLbl}>TDEE kcal</Text>
                    </View>
                    <View style={styles.calcMetricBox}>
                      <Text style={[styles.calcMetricVal, { color: calcResults.bmiColor }]}>{calcResults.bmi}</Text>
                      <Text style={styles.calcMetricLbl}>{calcResults.bmiCategory}</Text>
                    </View>
                  </View>

                  <View style={styles.targetCaloriesHighlight}>
                    <Text style={styles.targetCaloriesLabel}>{calcResults.goalLabel} Target</Text>
                    <Text style={styles.targetCaloriesValue}>{calcResults.target} kcal / day</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Navigation Buttons */}
          <View style={styles.bottomBar}>
            {step > 1 ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 80 }} />
            )}

            {step < 4 ? (
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#221803" />
                ) : (
                  <Text style={styles.submitBtnText}>Save & Generate AI Plan ✨</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
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
  progressSection: {
    backgroundColor: '#221D17',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#2D261F',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E8A020',
    borderRadius: 2,
  },
  stepLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  stepBadge: {
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  completedStepBadge: {
    backgroundColor: '#2D261F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  stepLabel: {
    fontSize: 11,
    color: '#706555',
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#E8A020',
  },
  stepLabelCurrent: {
    color: '#F4ECDD',
    fontWeight: '700',
  },
  stepLabelCompleted: {
    color: '#E8A020',
    fontWeight: '600',
  },
  stepDivider: {
    color: '#554A3D',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stickyMetricsBar: {
    backgroundColor: '#1E1914',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  stickyMetricsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stickyMetricsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A79A85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stickyMetricChip: {
    backgroundColor: '#2D261F',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyMetricChipText: {
    color: '#F4ECDD',
    fontSize: 12,
    fontWeight: '600',
  },
  miniStepperChip: {
    backgroundColor: '#2D261F',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniChipBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    borderRadius: 5,
  },
  miniChipBtnText: {
    color: '#E8A020',
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 17,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  stepContainer: {
    gap: 16,
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
    marginBottom: 10,
  },
  cardList: {
    gap: 12,
  },
  cardItem: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  cardItemActive: {
    borderColor: '#E8A020',
    backgroundColor: '#2A2219',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  cardDesc: {
    fontSize: 13,
    color: '#A79A85',
    lineHeight: 18,
  },
  cardTag: {
    backgroundColor: '#2C251D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardTagActive: {
    backgroundColor: 'rgba(232, 160, 32, 0.2)',
  },
  cardTagText: {
    color: '#A79A85',
    fontSize: 11,
    fontWeight: '600',
  },
  cardTagTextActive: {
    color: '#E8A020',
  },
  costBadge: {
    backgroundColor: 'rgba(123, 160, 91, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  costBadgeText: {
    color: '#7BA05B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  metricCard: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
    marginBottom: 10,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  genderBtn: {
    flex: 1,
    backgroundColor: '#181410',
    borderWidth: 1,
    borderColor: '#3A3128',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  genderBtnActive: {
    borderColor: '#E8A020',
    backgroundColor: '#2A2219',
  },
  genderBtnText: {
    color: '#A79A85',
    fontSize: 14,
    fontWeight: '600',
  },
  genderBtnTextActive: {
    color: '#E8A020',
    fontWeight: 'bold',
  },
  unitToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#181410',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  unitToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitToggleBtnActive: {
    backgroundColor: '#E8A020',
  },
  unitToggleText: {
    color: '#A79A85',
    fontSize: 12,
    fontWeight: '600',
  },
  unitToggleTextActive: {
    color: '#221803',
    fontWeight: 'bold',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181410',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3128',
    padding: 4,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#221D17',
    borderRadius: 8,
  },
  stepperMiniBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#221D17',
    borderRadius: 6,
  },
  stepperBtnText: {
    color: '#E8A020',
    fontSize: 22,
    fontWeight: 'bold',
  },
  stepperValWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stepperInput: {
    color: '#F4ECDD',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 50,
  },
  stepperUnit: {
    color: '#A79A85',
    fontSize: 13,
  },
  ftInRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ftInCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181410',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3128',
    padding: 4,
  },
  activityGrid: {
    gap: 10,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#221D17',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3A3128',
    gap: 12,
  },
  activityCardActive: {
    borderColor: '#E8A020',
    backgroundColor: '#2A2219',
  },
  activityIcon: {
    fontSize: 22,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F4ECDD',
    width: 90,
  },
  activityTitleActive: {
    color: '#E8A020',
  },
  activityDesc: {
    flex: 1,
    fontSize: 12,
    color: '#A79A85',
  },
  liveCalcCard: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8A020',
    marginTop: 10,
    gap: 12,
  },
  liveCalcHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#E8A020',
    letterSpacing: 1,
    textAlign: 'center',
  },
  calcMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#2D261F',
    paddingBottom: 10,
  },
  calcMetricBox: {
    alignItems: 'center',
  },
  calcMetricVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  calcMetricLbl: {
    fontSize: 11,
    color: '#A79A85',
    marginTop: 2,
  },
  targetCaloriesHighlight: {
    alignItems: 'center',
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  targetCaloriesLabel: {
    fontSize: 12,
    color: '#A79A85',
    fontWeight: '600',
  },
  targetCaloriesValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E8A020',
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#221D17',
    borderTopWidth: 1,
    borderTopColor: '#3A3128',
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2C251D',
  },
  backBtnText: {
    color: '#A79A85',
    fontSize: 14,
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#E8A020',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  nextBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  submitBtn: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#E8A020',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
