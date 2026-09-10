"use client";

import { useState, useEffect } from "react";
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
            <span className={styles.brandText}>FitScan Personalization</span>
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
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Current Weight (kg)</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    min="30"
                    max="250"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Height (cm)</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    min="100"
                    max="230"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Age</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min="12"
                    max="90"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Gender</label>
                  <select
                    className={styles.select}
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div className={styles.inputGroupFull}>
                  <label className={styles.inputLabel}>Activity Level</label>
                  <select
                    className={styles.select}
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                  >
                    <option value="sedentary">Desk Job / Sedentary (Little or no exercise)</option>
                    <option value="light">Lightly Active (1-3 workout days/week)</option>
                    <option value="moderate">Moderately Active (3-5 workout days/week)</option>
                    <option value="very_active">Very Active (6-7 intense workout days/week)</option>
                  </select>
                </div>
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
