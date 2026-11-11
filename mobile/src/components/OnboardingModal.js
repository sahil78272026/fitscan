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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateUserGoals } from '../services/api';
import { colors, radius, typography } from '../theme';

const GOALS = [
  {
    id: 'fat_loss',
    label: 'Fat Loss & Conditioning',
    tag: '20% Deficit • High Protein',
    desc: 'Burn body fat while preserving lean muscle mass and optimizing definition.',
  },
  {
    id: 'muscle_building',
    label: 'Muscle Building & Hypertrophy',
    tag: '12% Surplus • High Protein',
    desc: 'Build lean muscle mass and increase recovery capacity with surplus protein.',
  },
  {
    id: 'weight_loss',
    label: 'Steady Weight Loss',
    tag: '15% Deficit • Moderate Protein',
    desc: 'Consistent caloric deficit designed for sustainable weekly scale reduction.',
  },
  {
    id: 'muscle_maintain',
    label: 'Maintenance & Athletic Tone',
    tag: 'Energy Balance • Balanced Macros',
    desc: 'Maintain current body weight, improve stamina, and boost daily energy.',
  },
];

const DIETS = [
  {
    id: 'veg',
    label: 'Vegetarian',
    desc: 'Plant foods, lentils, dairy, and legumes.',
  },
  {
    id: 'non_veg',
    label: 'Non-Vegetarian',
    desc: 'Chicken, fish, eggs, dairy, and wholesome plant staples.',
  },
  {
    id: 'eggetarian',
    label: 'Eggetarian',
    desc: 'Vegetarian meals supplemented with whole eggs.',
  },
  {
    id: 'vegan',
    label: 'Vegan',
    desc: '100% plant-based with zero animal products or dairy.',
  },
];

const BUDGETS = [
  {
    id: 'low_budget',
    label: 'Pocket Friendly',
    cost: '₹100–140 / day',
    desc: 'Affordable staples: Chana, rajma, eggs, rice, and seasonal produce.',
  },
  {
    id: 'moderate',
    label: 'Balanced Moderate',
    cost: '₹180–250 / day',
    desc: 'Everyday variety: Paneer, oats, milk, tofu, and fresh chicken.',
  },
  {
    id: 'flexible',
    label: 'Performance & Gourmet',
    cost: '₹300+ / day',
    desc: 'Premium selection: Whey isolate, salmon, nuts, seeds, and avocados.',
  },
];

const ACTIVITIES = [
  {
    id: 'sedentary',
    title: 'Sedentary',
    schedule: '0–1 workouts/wk',
    desc: 'Desk job, little to no structured exercise.',
  },
  {
    id: 'light',
    title: 'Lightly Active',
    schedule: '1–2 workouts/wk',
    desc: 'Light weekly workouts or daily brisk walking.',
  },
  {
    id: 'moderate',
    title: 'Moderately Active',
    schedule: '3–5 workouts/wk',
    desc: 'Regular gym sessions, running, or sport activities.',
  },
  {
    id: 'very_active',
    title: 'Very Active',
    schedule: '6+ workouts/wk',
    desc: 'Daily intense training, heavy lifting, or athlete workload.',
  },
];

const getGoalName = (id) => GOALS.find((item) => item.id === id)?.label.split('&')[0].trim() || 'Goal';
const getDietName = (id) => DIETS.find((item) => item.id === id)?.label || 'Diet';
const getBudgetName = (id) => BUDGETS.find((item) => item.id === id)?.label.split(' ')[0] || 'Budget';

export const sanitizeWeightInput = (val) => {
  if (val === '' || val === null || val === undefined) return '';
  if (typeof val !== 'string') val = String(val);
  let cleaned = val.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1 && cleaned.length > dotIndex + 2) {
    cleaned = cleaned.slice(0, dotIndex + 2);
  }
  return cleaned;
};

export const clampWeight = (val, unit = 'kg') => {
  const num = parseFloat(val);
  if (unit === 'kg') {
    const defaultKg = 70.0;
    const validNum = isNaN(num) || num <= 0 ? defaultKg : num;
    const clamped = Math.max(30, Math.min(250, validNum));
    return Math.round(clamped * 10) / 10;
  } else {
    const defaultLbs = 154.3;
    const validNum = isNaN(num) || num <= 0 ? defaultLbs : num;
    const clamped = Math.max(66, Math.min(550, validNum));
    return Math.round(clamped * 10) / 10;
  }
};

export const calculateStepWeight = (currentVal, delta = 0.5, unit = 'kg') => {
  const parsed = parseFloat(currentVal);
  const current = !isNaN(parsed) && parsed > 0
    ? parsed
    : (unit === 'kg' ? 70.0 : 154.3);
  const next = Math.round((current + delta) * 10) / 10;
  return clampWeight(next, unit);
};

export const convertWeightUnit = (val, fromUnit, toUnit) => {
  if (fromUnit === toUnit) {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : Math.round(num * 10) / 10;
  }
  const num = parseFloat(val);
  if (isNaN(num) || num <= 0) {
    return toUnit === 'lbs' ? 154.3 : 70.0;
  }
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return Math.round(num * 2.20462 * 10) / 10;
  } else if (fromUnit === 'lbs' && toUnit === 'kg') {
    return Math.round((num / 2.20462) * 10) / 10;
  }
  return num;
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
  const initialWeight = initialSettings?.weight_kg ? Number(initialSettings.weight_kg) : 70;
  const [weightKg, setWeightKg] = useState(initialWeight);

  const [weightUnit, setWeightUnit] = useState('kg');
  const [weightInput, setWeightInput] = useState(String(initialWeight));
  const [heightUnit, setHeightUnit] = useState('cm');
  const [loading, setLoading] = useState(false);

  const scrollViewRef = useRef(null);

  useEffect(() => {
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
      if (initialSettings.weight_kg) {
        const kg = Number(initialSettings.weight_kg);
        setWeightKg(kg);
        setWeightInput(weightUnit === 'kg' ? String(kg) : String(convertWeightUnit(kg, 'kg', 'lbs')));
      }
    }
  }, [initialSettings]);

  // Step Selectors with auto-advance
  const handleSelectGoal = (id) => {
    setGoalType(id);
    setTimeout(() => setStep(2), 160);
  };

  const handleSelectDiet = (id) => {
    setDietType(id);
    setTimeout(() => setStep(3), 160);
  };

  const handleSelectBudget = (id) => {
    setBudgetTier(id);
    setTimeout(() => setStep(4), 160);
  };

  // Weight handlers
  const displayWeight = weightUnit === 'kg' ? weightKg : Math.round(weightKg * 2.20462 * 10) / 10;

  const handleWeightChange = (val) => {
    if (val === '') {
      setWeightInput('');
      return;
    }
    const sanitized = sanitizeWeightInput(val);
    if (!/^[0-9]*\.?[0-9]?$/.test(sanitized)) {
      return;
    }
    setWeightInput(sanitized);

    const num = parseFloat(sanitized);
    if (!isNaN(num) && num > 0) {
      if (weightUnit === 'kg') {
        setWeightKg(Math.round(num * 10) / 10);
      } else {
        setWeightKg(convertWeightUnit(num, 'lbs', 'kg'));
      }
    }
  };

  const handleWeightBlur = () => {
    const num = parseFloat(weightInput);
    if (weightUnit === 'kg') {
      const clamped = clampWeight(isNaN(num) || num <= 0 ? weightKg : num, 'kg');
      setWeightKg(clamped);
      setWeightInput(String(clamped));
    } else {
      const fallbackLbs = convertWeightUnit(weightKg, 'kg', 'lbs');
      const clamped = clampWeight(isNaN(num) || num <= 0 ? fallbackLbs : num, 'lbs');
      const kgVal = convertWeightUnit(clamped, 'lbs', 'kg');
      setWeightKg(kgVal);
      setWeightInput(String(clamped));
    }
  };

  const stepWeight = (delta = 0.5) => {
    const current = parseFloat(weightInput);
    const effectiveCurrent = !isNaN(current) && current > 0
      ? current
      : (weightUnit === 'kg' ? weightKg : convertWeightUnit(weightKg, 'kg', 'lbs'));

    const stepped = calculateStepWeight(effectiveCurrent, delta, weightUnit);
    if (weightUnit === 'kg') {
      setWeightKg(stepped);
      setWeightInput(String(stepped));
    } else {
      const kgVal = convertWeightUnit(stepped, 'lbs', 'kg');
      setWeightKg(kgVal);
      setWeightInput(String(stepped));
    }
  };

  const handleUnitToggle = (targetUnit) => {
    if (targetUnit === weightUnit) return;
    const parsed = parseFloat(weightInput);
    if (targetUnit === 'lbs') {
      const currentKg = !isNaN(parsed) && parsed > 0 ? parsed : weightKg;
      const lbsVal = convertWeightUnit(currentKg, 'kg', 'lbs');
      setWeightInput(String(lbsVal));
      setWeightUnit('lbs');
    } else {
      const currentLbs = !isNaN(parsed) && parsed > 0 ? parsed : convertWeightUnit(weightKg, 'kg', 'lbs');
      const kgVal = convertWeightUnit(currentLbs, 'lbs', 'kg');
      setWeightKg(kgVal);
      setWeightInput(String(kgVal));
      setWeightUnit('kg');
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

  const stepAge = (delta) => {
    setAge((prev) => Math.max(12, Math.min(99, Number(prev) + delta)));
  };

  // Live Nutrition Projection
  const calcResults = useMemo(() => {
    const w = Number(weightKg) || 70;
    const h = Number(heightCm) || 170;
    const a = Number(age) || 25;

    // BMR (Mifflin-St Jeor)
    const bmr = gender === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;

    const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725 };
    const tdee = Math.round(bmr * (mults[activityLevel] || 1.55));

    let target = tdee;
    let goalLabel = 'Maintenance';
    let proteinMultiplier = 1.8;

    if (goalType === 'fat_loss') {
      target = Math.round(tdee * 0.8);
      goalLabel = 'Fat Loss (-20%)';
      proteinMultiplier = 2.2;
    } else if (goalType === 'weight_loss') {
      target = Math.round(tdee * 0.85);
      goalLabel = 'Weight Loss (-15%)';
      proteinMultiplier = 1.9;
    } else if (goalType === 'muscle_building') {
      target = Math.round(tdee * 1.12);
      goalLabel = 'Muscle Building (+12%)';
      proteinMultiplier = 2.0;
    }

    target = Math.max(1200, Math.min(5500, target));
    const proteinG = Math.round(Math.min(w * proteinMultiplier, (target * 0.35) / 4));
    const fatG = Math.round((target * 0.25) / 9);
    const carbsG = Math.round(Math.max(50, (target - (proteinG * 4 + fatG * 9)) / 4));

    return {
      target,
      goalLabel,
      proteinG,
      carbsG,
      fatG,
    };
  }, [weightKg, heightCm, age, gender, activityLevel, goalType]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const parsedInput = parseFloat(weightInput);
      const finalKg = weightUnit === 'kg'
        ? (!isNaN(parsedInput) && parsedInput > 0 ? parsedInput : weightKg)
        : (!isNaN(parsedInput) && parsedInput > 0 ? convertWeightUnit(parsedInput, 'lbs', 'kg') : weightKg);
      const clampedKg = clampWeight(finalKg, 'kg');

      const payload = {
        goal_type: goalType,
        diet_type: dietType,
        budget_tier: budgetTier,
        activity_level: activityLevel,
        age: parseInt(age, 10) || 25,
        gender,
        height_cm: parseFloat(heightCm) || 170,
        weight_kg: clampedKg,
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
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.headerTitle}>Fitness Profile & Goals</Text>
              <Text style={styles.headerSub}>Step {step} of 4</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar & Stage Indicator */}
          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
            </View>
            <View style={styles.stepLabelsRow}>
              <TouchableOpacity
                onPress={() => step > 1 && setStep(1)}
                disabled={step <= 1}
                style={[styles.stepTab, step === 1 && styles.stepTabActive, step > 1 && styles.stepTabCompleted]}
              >
                <Text style={[styles.stepTabText, step === 1 && styles.stepTabTextActive]}>
                  {step > 1 ? `1. ${getGoalName(goalType)}` : '1. Goal'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => step > 2 && setStep(2)}
                disabled={step <= 2}
                style={[styles.stepTab, step === 2 && styles.stepTabActive, step > 2 && styles.stepTabCompleted]}
              >
                <Text style={[styles.stepTabText, step === 2 && styles.stepTabTextActive]}>
                  {step > 2 ? `2. ${getDietName(dietType)}` : '2. Diet'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => step > 3 && setStep(3)}
                disabled={step <= 3}
                style={[styles.stepTab, step === 3 && styles.stepTabActive, step > 3 && styles.stepTabCompleted]}
              >
                <Text style={[styles.stepTabText, step === 3 && styles.stepTabTextActive]}>
                  {step > 3 ? `3. ${getBudgetName(budgetTier)}` : '3. Budget'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.stepTab, step === 4 && styles.stepTabActive]}>
                <Text style={[styles.stepTabText, step === 4 && styles.stepTabTextActive]}>
                  4. Profile
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* STEP 1: GOALS */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={styles.screenTitle}>What is your primary fitness goal?</Text>
                <Text style={styles.screenSubtitle}>Your daily calorie and macronutrient targets will align with this objective.</Text>

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
                          <Text style={[styles.cardLabel, isSelected && styles.cardLabelActive]}>{g.label}</Text>
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
                <Text style={styles.screenTitle}>What is your dietary preference?</Text>
                <Text style={styles.screenSubtitle}>Meal plans and recommendations will only include foods compatible with your choice.</Text>

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
                        <Text style={[styles.cardLabel, isSelected && styles.cardLabelActive]}>{d.label}</Text>
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
                <Text style={styles.screenTitle}>Select your daily grocery budget</Text>
                <Text style={styles.screenSubtitle}>We will tailor recipes and ingredients to fit your everyday spending range.</Text>

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
                          <Text style={[styles.cardLabel, isSelected && styles.cardLabelActive]}>{b.label}</Text>
                          <View style={[styles.costBadge, isSelected && styles.costBadgeActive]}>
                            <Text style={[styles.costBadgeText, isSelected && styles.costBadgeTextActive]}>{b.cost}</Text>
                          </View>
                        </View>
                        <Text style={styles.cardDesc}>{b.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* STEP 4: BODY PROFILE & ACTIVITY */}
            {step === 4 && (
              <View style={styles.stepContainer}>
                <Text style={styles.screenTitle}>Your Body Profile & Activity</Text>
                <Text style={styles.screenSubtitle}>Used to compute your baseline energy expenditure and precision macro targets.</Text>

                {/* Section 1: Biological Sex & Age */}
                <View style={styles.metricCard}>
                  <Text style={styles.cardSectionTitle}>Biological Sex & Age</Text>
                  
                  {/* Gender Segmented Control */}
                  <View style={styles.genderRow}>
                    <TouchableOpacity
                      style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                      onPress={() => setGender('male')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.genderBtnText, gender === 'male' && styles.genderBtnTextActive]}>
                        Male
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                      onPress={() => setGender('female')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.genderBtnText, gender === 'female' && styles.genderBtnTextActive]}>
                        Female
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Age Stepper */}
                  <View style={styles.stepperContainer}>
                    <Text style={styles.inputFieldLabel}>Age</Text>
                    <View style={styles.stepperControl}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepAge(-1)} activeOpacity={0.6}>
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
                        <Text style={styles.stepperUnit}>years</Text>
                      </View>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepAge(1)} activeOpacity={0.6}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Section 2: Weight & Height */}
                <View style={styles.metricCard}>
                  <Text style={styles.cardSectionTitle}>Height & Current Weight</Text>

                  {/* Weight */}
                  <View style={styles.metricSubSection}>
                    <View style={styles.metricHeaderRow}>
                      <Text style={styles.inputFieldLabel}>Current Weight</Text>
                      <View style={styles.unitToggleGroup}>
                        <TouchableOpacity
                          style={[styles.unitToggleBtn, weightUnit === 'kg' && styles.unitToggleBtnActive]}
                          onPress={() => handleUnitToggle('kg')}
                        >
                          <Text style={[styles.unitToggleText, weightUnit === 'kg' && styles.unitToggleTextActive]}>kg</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.unitToggleBtn, weightUnit === 'lbs' && styles.unitToggleBtnActive]}
                          onPress={() => handleUnitToggle('lbs')}
                        >
                          <Text style={[styles.unitToggleText, weightUnit === 'lbs' && styles.unitToggleTextActive]}>lbs</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.stepperControl}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepWeight(-0.5)} activeOpacity={0.6}>
                        <Text style={styles.stepperBtnText}>–</Text>
                      </TouchableOpacity>
                      <View style={styles.stepperValWrapper}>
                        <TextInput
                          style={styles.stepperInput}
                          value={weightInput}
                          onChangeText={handleWeightChange}
                          onBlur={handleWeightBlur}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                        />
                        <Text style={styles.stepperUnit}>{weightUnit}</Text>
                      </View>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepWeight(0.5)} activeOpacity={0.6}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Height */}
                  <View style={[styles.metricSubSection, { marginTop: 14 }]}>
                    <View style={styles.metricHeaderRow}>
                      <Text style={styles.inputFieldLabel}>Height</Text>
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
                          <Text style={[styles.unitToggleText, heightUnit === 'ft' && styles.unitToggleTextActive]}>ft / in</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {heightUnit === 'cm' ? (
                      <View style={styles.stepperControl}>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => stepHeight(-1)} activeOpacity={0.6}>
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
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => stepHeight(1)} activeOpacity={0.6}>
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.ftInRow}>
                        <View style={styles.ftInCol}>
                          <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepFeet(-1)} activeOpacity={0.6}>
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
                          <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepFeet(1)} activeOpacity={0.6}>
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.ftInCol}>
                          <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepInches(-1)} activeOpacity={0.6}>
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
                          <TouchableOpacity style={styles.stepperMiniBtn} onPress={() => stepInches(1)} activeOpacity={0.6}>
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Section 3: Activity Level */}
                <View style={styles.metricCard}>
                  <Text style={styles.cardSectionTitle}>Weekly Activity Level</Text>
                  <Text style={styles.cardSectionSub}>Select the category matching your average weekly exercise</Text>

                  <View style={styles.activityList}>
                    {ACTIVITIES.map((act) => {
                      const isSelected = activityLevel === act.id;
                      return (
                        <TouchableOpacity
                          key={act.id}
                          style={[styles.activityItem, isSelected && styles.activityItemActive]}
                          onPress={() => setActivityLevel(act.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.activityTopRow}>
                            <Text style={[styles.activityTitle, isSelected && styles.activityTitleActive]}>{act.title}</Text>
                            <View style={[styles.activityPill, isSelected && styles.activityPillActive]}>
                              <Text style={[styles.activityPillText, isSelected && styles.activityPillTextActive]}>{act.schedule}</Text>
                            </View>
                          </View>
                          <Text style={styles.activityDesc}>{act.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Section 4: Live Target Preview */}
                <View style={styles.previewBox}>
                  <View style={styles.previewTopRow}>
                    <Text style={styles.previewHeading}>ESTIMATED DAILY TARGET</Text>
                    <View style={styles.previewGoalBadge}>
                      <Text style={styles.previewGoalText}>{calcResults.goalLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.previewCalorieVal}>
                    {calcResults.target.toLocaleString()} <Text style={styles.previewCalorieUnit}>kcal / day</Text>
                  </Text>

                  <View style={styles.macroSplitRow}>
                    <View style={styles.macroSplitItem}>
                      <Text style={[styles.macroSplitNum, { color: colors.protein || '#10B981' }]}>{calcResults.proteinG}g</Text>
                      <Text style={styles.macroSplitLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroDivider} />
                    <View style={styles.macroSplitItem}>
                      <Text style={[styles.macroSplitNum, { color: colors.carbs || '#38BDF8' }]}>{calcResults.carbsG}g</Text>
                      <Text style={styles.macroSplitLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroDivider} />
                    <View style={styles.macroSplitItem}>
                      <Text style={[styles.macroSplitNum, { color: colors.fatText || '#F59E0B' }]}>{calcResults.fatG}g</Text>
                      <Text style={styles.macroSplitLabel}>Fat</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Bar Navigation */}
          <View style={styles.bottomBar}>
            {step > 1 ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 80 }} />
            )}

            {step < 4 ? (
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)}>
                <Text style={styles.nextBtnText}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#08090C" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Goals & Continue</Text>
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
    backgroundColor: '#0C0A09',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#08090C',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F5F5F4',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 12,
    color: '#A8A29E',
    marginTop: 2,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
  },
  closeText: {
    color: '#A8A29E',
    fontSize: 13,
    fontWeight: '600',
  },
  progressSection: {
    backgroundColor: '#08090C',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 2,
  },
  stepLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepTab: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  stepTabActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  stepTabCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  stepTabText: {
    fontSize: 11,
    color: '#78716C',
    fontWeight: '600',
  },
  stepTabTextActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  stepContainer: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F5F5F4',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#A8A29E',
    lineHeight: 18,
    marginBottom: 20,
  },
  cardList: {
    gap: 12,
  },
  cardItem: {
    backgroundColor: '#08090C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
  },
  cardItemActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F5F5F4',
    flex: 1,
  },
  cardLabelActive: {
    color: '#F59E0B',
  },
  cardTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  cardTagActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  cardTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
  },
  cardTagTextActive: {
    color: '#F59E0B',
  },
  cardDesc: {
    fontSize: 13,
    color: '#A8A29E',
    lineHeight: 18,
  },
  costBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  costBadgeActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  costBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
  },
  costBadgeTextActive: {
    color: '#F59E0B',
  },
  metricCard: {
    backgroundColor: '#08090C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5F5F4',
    marginBottom: 2,
  },
  cardSectionSub: {
    fontSize: 12,
    color: '#A8A29E',
    marginBottom: 12,
  },
  metricSubSection: {
    marginTop: 4,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  genderBtn: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  genderBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A8A29E',
  },
  genderBtnTextActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A8A29E',
  },
  unitToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  unitToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unitToggleBtnActive: {
    backgroundColor: '#F59E0B',
  },
  unitToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
  },
  unitToggleTextActive: {
    color: '#08090C',
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F5F5F4',
  },
  stepperValWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
  stepperInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F5F5F4',
    textAlign: 'center',
    minWidth: 40,
    paddingVertical: 4,
  },
  stepperUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A8A29E',
  },
  ftInRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ftInCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 4,
  },
  stepperMiniBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityList: {
    gap: 8,
    marginTop: 6,
  },
  activityItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 12,
  },
  activityItemActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  activityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5F5F4',
  },
  activityTitleActive: {
    color: '#F59E0B',
  },
  activityPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  activityPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  activityPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#A8A29E',
  },
  activityPillTextActive: {
    color: '#F59E0B',
  },
  activityDesc: {
    fontSize: 12,
    color: '#A8A29E',
    lineHeight: 16,
  },
  previewBox: {
    backgroundColor: '#08090C',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#A8A29E',
  },
  previewGoalBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  previewGoalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  previewCalorieVal: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F5F5F4',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  previewCalorieUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A8A29E',
  },
  macroSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  macroSplitItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroSplitNum: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  macroSplitLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
  },
  macroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#08090C',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
  },
  backBtnText: {
    color: '#F5F5F4',
    fontSize: 14,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#08090C',
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#08090C',
    fontSize: 14,
    fontWeight: '700',
  },
});
