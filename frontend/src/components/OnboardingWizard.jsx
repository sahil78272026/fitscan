"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./OnboardingWizard.module.css";

const GOALS = [
  { id: "fat_loss", label: "🔥 Fat Loss", desc: "Burn body fat while maintaining muscle mass", tag: "High Protein • Deficit" },
  { id: "weight_loss", label: "📉 Weight Loss", desc: "Steady caloric deficit for healthy weight drop", tag: "Caloric Deficit" },
  { id: "muscle_building", label: "💪 Muscle Building", desc: "Gain lean muscle mass with surplus protein", tag: "Surplus • High Protein" },
  { id: "muscle_maintain", label: "⚖️ Maintenance", desc: "Maintain current weight and optimize energy", tag: "Balanced Energy" },
];

const DIETS = [
  { id: "veg", label: "🥦 Vegetarian", desc: "Plant foods, lentils, dairy & legumes" },
  { id: "non_veg", label: "🍗 Non-Vegetarian", desc: "Chicken, fish, eggs & dairy" },
  { id: "vegan", label: "🌱 Vegan", desc: "100% plant-based, no dairy or eggs" },
  { id: "eggetarian", label: "🍳 Eggetarian", desc: "Vegetarian plus eggs" },
];

const BUDGETS = [
  { id: "low_budget", label: "🪙 Pocket Friendly", desc: "Budget staples: Chana, Rajma, Eggs, Rice & Seasonal Veggies", cost: "~₹100-140/day" },
  { id: "moderate", label: "💳 Moderate", desc: "Balanced variety: Paneer, Oats, Milk, Tofu, Local Chicken", cost: "~₹180-250/day" },
  { id: "flexible", label: "🌟 Flexible", desc: "High protein & gourmet items: Whey, Fish, Nuts, Avocados", cost: "~₹300+/day" },
];

const ACTIVITIES = [
  { id: "sedentary", icon: "🪑", title: "Sedentary", desc: "Desk job, little to no workout" },
  { id: "light", icon: "🚶", title: "Light", desc: "1–3 workouts or walks/week" },
  { id: "moderate", icon: "🏃", title: "Moderate", desc: "3–5 regular workout days/week" },
  { id: "very_active", icon: "⚡", title: "Very Active", desc: "6–7 intense workouts/heavy training" },
];

export default function OnboardingWizard({ initialSettings, onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState(initialSettings?.goal_type || "fat_loss");
  const [dietType, setDietType] = useState(initialSettings?.diet_type || "veg");
  const [budgetTier, setBudgetTier] = useState(initialSettings?.budget_tier || "moderate");
  const [weightKg, setWeightKg] = useState(initialSettings?.weight_kg || 70);
  const [heightCm, setHeightCm] = useState(initialSettings?.height_cm || 170);
  const [age, setAge] = useState(initialSettings?.age || 25);
  const [gender, setGender] = useState(initialSettings?.gender || "male");
  const [activityLevel, setActivityLevel] = useState(initialSettings?.activity_level || "moderate");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      if (initialSettings.goal_type) setGoalType(initialSettings.goal_type);
      if (initialSettings.diet_type) setDietType(initialSettings.diet_type);
      if (initialSettings.budget_tier) setBudgetTier(initialSettings.budget_tier);
      if (initialSettings.weight_kg) setWeightKg(initialSettings.weight_kg);
      if (initialSettings.height_cm) setHeightCm(initialSettings.height_cm);
      if (initialSettings.age) setAge(initialSettings.age);
      if (initialSettings.gender) setGender(initialSettings.gender);
      if (initialSettings.activity_level) setActivityLevel(initialSettings.activity_level);
    }
  }, [initialSettings]);

  const handleSelectGoal = (id) => {
    setGoalType(id);
    setTimeout(() => {
      setStep(2);
    }, 180);
  };

  const handleSelectDiet = (id) => {
    setDietType(id);
    setTimeout(() => {
      setStep(3);
    }, 180);
  };

  const handleSelectBudget = (id) => {
    setBudgetTier(id);
    setTimeout(() => {
      setStep(4);
    }, 180);
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // Weight display & handlers
  const displayWeight = weightUnit === "kg" ? weightKg : Math.round(weightKg * 2.20462 * 10) / 10;

  const handleWeightChange = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    if (weightUnit === "kg") {
      setWeightKg(Math.max(30, Math.min(250, num)));
    } else {
      setWeightKg(Math.max(30, Math.min(250, Math.round((num / 2.20462) * 10) / 10)));
    }
  };

  const stepWeight = (delta) => {
    if (weightUnit === "kg") {
      setWeightKg((prev) => Math.max(30, Math.min(250, Math.round((Number(prev) + delta) * 10) / 10)));
    } else {
      const currentLbs = weightKg * 2.20462;
      const newLbs = Math.max(66, Math.min(550, currentLbs + delta));
      setWeightKg(Math.round((newLbs / 2.20462) * 10) / 10);
    }
  };

  // Height display & handlers
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
    const clampedInches = Math.max(36, Math.min(95, totalInches)); // 3'0" to 7'11"
    const newFt = Math.floor(clampedInches / 12);
    const newIn = clampedInches % 12;
    handleHeightFtChange(newFt, newIn);
  };

  // Age step
  const stepAge = (delta) => {
    setAge((prev) => Math.max(12, Math.min(99, Number(prev) + delta)));
  };

  // Live metabolic and BMI calculation
  const liveStats = useMemo(() => {
    const w = parseFloat(weightKg) || 70;
    const h = parseFloat(heightCm) || 170;
    const a = parseInt(age, 10) || 25;

    // BMI
    const hMeter = h / 100;
    const bmiVal = w / (hMeter * hMeter);
    let bmiCategory = "Normal";
    let bmiColor = "#34d399";
    if (bmiVal < 18.5) {
      bmiCategory = "Underweight";
      bmiColor = "#60a5fa";
    } else if (bmiVal >= 25 && bmiVal < 30) {
      bmiCategory = "Overweight";
      bmiColor = "#fbbf24";
    } else if (bmiVal >= 30) {
      bmiCategory = "Obese";
      bmiColor = "#f87171";
    }

    // BMR (Mifflin-St Jeor)
    const bmr = gender === "male"
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;

    const mults = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725 };
    const tdee = Math.round(bmr * (mults[activityLevel] || 1.55));

    // Target based on goal
    let target = tdee;
    let goalLabel = "Maintenance Calories";
    if (goalType === "fat_loss") {
      target = Math.round(tdee * 0.8);
      goalLabel = "Target for Fat Loss (-20%)";
    } else if (goalType === "weight_loss") {
      target = Math.round(tdee * 0.85);
      goalLabel = "Target for Weight Loss (-15%)";
    } else if (goalType === "muscle_building") {
      target = Math.round(tdee * 1.12);
      goalLabel = "Target for Muscle Building (+12%)";
    }

    return {
      bmi: bmiVal.toFixed(1),
      bmiCategory,
      bmiColor,
      tdee,
      target,
      goalLabel,
    };
  }, [weightKg, heightCm, age, gender, activityLevel, goalType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onComplete({
        goal_type: goalType,
        diet_type: dietType,
        budget_tier: budgetTier,
        weight_kg: Number(weightKg),
        height_cm: Number(heightCm),
        age: Number(age),
        gender: gender,
        activity_level: activityLevel
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wizardOverlay}>
      <div className={styles.wizardContainer}>
        {/* Header & Step Bar */}
        <div className={styles.wizardHeader}>
          <div className={styles.brandTitle}>
            <span className={styles.brandIcon}>✨</span>
            <span className={styles.brandText}>CoreControl Personalization</span>
          </div>
          {onCancel && (
            <button className={styles.closeBtn} onClick={onCancel} title="Close">✕</button>
          )}
        </div>

        {/* Step Progress Bar */}
        <div className={styles.stepProgressContainer}>
          <div className={styles.stepTrack}>
            <div className={styles.stepFill} style={{ width: `${(step / 4) * 100}%` }} />
          </div>
          <div className={styles.stepLabels}>
            <span className={step >= 1 ? styles.activeStepLabel : ""}>1. Goal</span>
            <span className={step >= 2 ? styles.activeStepLabel : ""}>2. Diet</span>
            <span className={step >= 3 ? styles.activeStepLabel : ""}>3. Budget</span>
            <span className={step >= 4 ? styles.activeStepLabel : ""}>4. Body Metrics</span>
          </div>
        </div>

        {/* Step Content */}
        <div className={styles.wizardBody}>
          {/* SCREEN 1: GOAL */}
          {step === 1 && (
            <div className={styles.stepSlide}>
              <h2 className={styles.stepTitle}>🎯 What is your primary fitness goal?</h2>
              <p className={styles.stepSubtitle}>We will customize your daily calories & macros based on this target.</p>
              
              <div className={styles.cardGrid2}>
                {GOALS.map((g) => (
                  <div
                    key={g.id}
                    className={`${styles.optionCard} ${goalType === g.id ? styles.selectedCard : ""}`}
                    onClick={() => handleSelectGoal(g.id)}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardLabel}>{g.label}</span>
                      <span className={styles.cardTag}>{g.tag}</span>
                    </div>
                    <p className={styles.cardDesc}>{g.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 2: DIET PREFERENCE */}
          {step === 2 && (
            <div className={styles.stepSlide}>
              <h2 className={styles.stepTitle}>🥗 What is your dietary preference?</h2>
              <p className={styles.stepSubtitle}>AI meal suggestions will exclusively follow your food rules.</p>
              
              <div className={styles.cardGrid2}>
                {DIETS.map((d) => (
                  <div
                    key={d.id}
                    className={`${styles.optionCard} ${dietType === d.id ? styles.selectedCard : ""}`}
                    onClick={() => handleSelectDiet(d.id)}
                  >
                    <span className={styles.cardLabel}>{d.label}</span>
                    <p className={styles.cardDesc}>{d.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 3: BUDGET TIER */}
          {step === 3 && (
            <div className={styles.stepSlide}>
              <h2 className={styles.stepTitle}>🪙 What is your daily food budget preference?</h2>
              <p className={styles.stepSubtitle}>Get delicious meal options optimized for local market prices.</p>
              
              <div className={styles.cardGrid3}>
                {BUDGETS.map((b) => (
                  <div
                    key={b.id}
                    className={`${styles.optionCard} ${budgetTier === b.id ? styles.selectedCard : ""}`}
                    onClick={() => handleSelectBudget(b.id)}
                  >
                    <span className={styles.cardLabel}>{b.label}</span>
                    <span className={styles.costBadge}>{b.cost}</span>
                    <p className={styles.cardDesc}>{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 4: BODY METRICS */}
          {step === 4 && (
            <form onSubmit={handleSubmit} className={styles.stepSlide}>
              <h2 className={styles.stepTitle}>📏 What are your body metrics?</h2>
              <p className={styles.stepSubtitle}>Used for BMR & TDEE calculation to determine exact macronutrient splits.</p>

              <div className={styles.metricsFormGrid}>
                {/* Weight Input */}
                <div className={styles.metricCardBox}>
                  <div className={styles.metricHeader}>
                    <label className={styles.inputLabel}>⚖️ Current Weight</label>
                    <div className={styles.unitToggleGroup}>
                      <button
                        type="button"
                        className={`${styles.unitToggleBtn} ${weightUnit === "kg" ? styles.unitActive : ""}`}
                        onClick={() => setWeightUnit("kg")}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        className={`${styles.unitToggleBtn} ${weightUnit === "lbs" ? styles.unitActive : ""}`}
                        onClick={() => setWeightUnit("lbs")}
                      >
                        lbs
                      </button>
                    </div>
                  </div>
                  <div className={styles.stepperContainer}>
                    <button type="button" className={styles.stepBtn} onClick={() => stepWeight(weightUnit === "kg" ? -1 : -2)}>
                      –
                    </button>
                    <div className={styles.stepperValueWrapper}>
                      <input
                        type="number"
                        className={styles.stepperInput}
                        value={displayWeight}
                        onChange={(e) => handleWeightChange(e.target.value)}
                        step={weightUnit === "kg" ? "0.5" : "1"}
                        min="30"
                        max="500"
                        required
                      />
                      <span className={styles.stepperUnitLabel}>{weightUnit}</span>
                    </div>
                    <button type="button" className={styles.stepBtn} onClick={() => stepWeight(weightUnit === "kg" ? 1 : 2)}>
                      +
                    </button>
                  </div>
                </div>

                {/* Height Input */}
                <div className={styles.metricCardBox}>
                  <div className={styles.metricHeader}>
                    <label className={styles.inputLabel}>📏 Height</label>
                    <div className={styles.unitToggleGroup}>
                      <button
                        type="button"
                        className={`${styles.unitToggleBtn} ${heightUnit === "cm" ? styles.unitActive : ""}`}
                        onClick={() => setHeightUnit("cm")}
                      >
                        cm
                      </button>
                      <button
                        type="button"
                        className={`${styles.unitToggleBtn} ${heightUnit === "ft" ? styles.unitActive : ""}`}
                        onClick={() => setHeightUnit("ft")}
                      >
                        ft/in
                      </button>
                    </div>
                  </div>

                  {heightUnit === "cm" ? (
                    <div className={styles.stepperContainer}>
                      <button type="button" className={styles.stepBtn} onClick={() => stepHeight(-1)}>
                        –
                      </button>
                      <div className={styles.stepperValueWrapper}>
                        <input
                          type="number"
                          className={styles.stepperInput}
                          value={heightCm}
                          onChange={(e) => setHeightCm(Math.max(100, Math.min(240, parseInt(e.target.value, 10) || 170)))}
                          min="100"
                          max="240"
                          required
                        />
                        <span className={styles.stepperUnitLabel}>cm</span>
                      </div>
                      <button type="button" className={styles.stepBtn} onClick={() => stepHeight(1)}>
                        +
                      </button>
                    </div>
                  ) : (
                    <div className={styles.ftInRow}>
                      <div className={styles.ftInStepperBox}>
                        <button type="button" className={styles.miniStepBtn} onClick={() => stepFeet(-1)}>
                          –
                        </button>
                        <div className={styles.stepperValueWrapper}>
                          <input
                            type="number"
                            className={styles.ftInput}
                            value={feet}
                            onChange={(e) => handleHeightFtChange(e.target.value, inches)}
                            min="3"
                            max="7"
                            required
                          />
                          <span className={styles.stepperUnitLabel}>ft</span>
                        </div>
                        <button type="button" className={styles.miniStepBtn} onClick={() => stepFeet(1)}>
                          +
                        </button>
                      </div>

                      <div className={styles.ftInStepperBox}>
                        <button type="button" className={styles.miniStepBtn} onClick={() => stepInches(-1)}>
                          –
                        </button>
                        <div className={styles.stepperValueWrapper}>
                          <input
                            type="number"
                            className={styles.ftInput}
                            value={inches}
                            onChange={(e) => handleHeightFtChange(feet, e.target.value)}
                            min="0"
                            max="11"
                            required
                          />
                          <span className={styles.stepperUnitLabel}>in</span>
                        </div>
                        <button type="button" className={styles.miniStepBtn} onClick={() => stepInches(1)}>
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Age Input */}
                <div className={styles.metricCardBox}>
                  <label className={styles.inputLabel}>🎂 Age</label>
                  <div className={styles.stepperContainer}>
                    <button type="button" className={styles.stepBtn} onClick={() => stepAge(-1)}>
                      –
                    </button>
                    <div className={styles.stepperValueWrapper}>
                      <input
                        type="number"
                        className={styles.stepperInput}
                        value={age}
                        onChange={(e) => setAge(Math.max(12, Math.min(99, parseInt(e.target.value, 10) || 25)))}
                        min="12"
                        max="99"
                        required
                      />
                      <span className={styles.stepperUnitLabel}>years</span>
                    </div>
                    <button type="button" className={styles.stepBtn} onClick={() => stepAge(1)}>
                      +
                    </button>
                  </div>
                </div>

                {/* Gender Segmented Button */}
                <div className={styles.metricCardBox}>
                  <label className={styles.inputLabel}>⚧ Gender</label>
                  <div className={styles.genderPillGroup}>
                    <button
                      type="button"
                      className={`${styles.genderPill} ${gender === "male" ? styles.genderActive : ""}`}
                      onClick={() => setGender("male")}
                    >
                      <span className={styles.genderIcon}>👨</span> Male
                    </button>
                    <button
                      type="button"
                      className={`${styles.genderPill} ${gender === "female" ? styles.genderActive : ""}`}
                      onClick={() => setGender("female")}
                    >
                      <span className={styles.genderIcon}>👩</span> Female
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity Level Cards */}
              <div className={styles.activitySection}>
                <label className={styles.inputLabel}>🏃 Daily Activity Level</label>
                <div className={styles.activityGrid}>
                  {ACTIVITIES.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      className={`${styles.activityCard} ${activityLevel === act.id ? styles.activityActive : ""}`}
                      onClick={() => setActivityLevel(act.id)}
                    >
                      <div className={styles.activityIcon}>{act.icon}</div>
                      <div className={styles.activityInfo}>
                        <span className={styles.activityTitle}>{act.title}</span>
                        <span className={styles.activityDesc}>{act.desc}</span>
                      </div>
                      {activityLevel === act.id && <span className={styles.checkMark}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Calorie & BMI Card */}
              <div className={styles.liveCalculationBox}>
                <div className={styles.liveHeader}>
                  <span className={styles.liveTitle}>📊 Live Metabolic Estimate</span>
                  <span className={styles.bmiPill} style={{ backgroundColor: `${liveStats.bmiColor}20`, color: liveStats.bmiColor }}>
                    BMI: {liveStats.bmi} ({liveStats.bmiCategory})
                  </span>
                </div>
                <div className={styles.liveMetricsRow}>
                  <div className={styles.liveMetricCol}>
                    <span className={styles.liveMetricLabel}>Est. Maintenance (TDEE)</span>
                    <span className={styles.liveMetricValue}>~{liveStats.tdee.toLocaleString()} kcal/day</span>
                  </div>
                  <div className={styles.liveDivider} />
                  <div className={styles.liveMetricCol}>
                    <span className={styles.liveMetricLabel}>Target Calorie Goal</span>
                    <span className={styles.liveTargetValue}>~{liveStats.target.toLocaleString()} kcal/day</span>
                    <span className={styles.liveGoalTag}>{liveStats.goalLabel}</span>
                  </div>
                </div>
              </div>

              <div className={styles.legalDisclaimerBox}>
                ⚖️ <strong>Health & Medical Disclaimer:</strong> CoreControl generates AI meal suggestions and macro estimates for general wellness and educational purposes only. CoreControl is not a licensed medical provider and does not provide medical nutrition therapy. Consult a physician before beginning any diet program.
              </div>

              <div className={styles.wizardFooter}>
                <button type="button" className={styles.backBtn} onClick={handleBack}>
                  ← Back
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                  {submitting ? "Calculating & Generating Plans..." : "Generate Custom Meal Plans ✨"}
                </button>
              </div>
            </form>
          )}

          {/* Wizard Navigation Footer for Steps 1-3 */}
          {step < 4 && (
            <div className={styles.wizardFooter}>
              {step > 1 ? (
                <button type="button" className={styles.backBtn} onClick={handleBack}>
                  ← Back
                </button>
              ) : (
                <div />
              )}
              <button type="button" className={styles.primaryBtn} onClick={handleNext}>
                Next Step →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
