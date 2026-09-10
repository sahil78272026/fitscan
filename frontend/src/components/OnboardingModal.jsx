"use client";

import { useState, useEffect } from "react";
import styles from "./OnboardingModal.module.css";

const GOALS = [
  { id: "fat_loss", label: "🔥 Fat Loss", desc: "Burn fat while keeping muscle" },
  { id: "weight_loss", label: "📉 Weight Loss", desc: "Steady caloric deficit" },
  { id: "muscle_building", label: "💪 Muscle Building", desc: "Gain lean muscle mass" },
  { id: "muscle_maintain", label: "⚖️ Maintenance", desc: "Maintain current weight" },
];

const DIETS = [
  { id: "veg", label: "🥦 Vegetarian" },
  { id: "non_veg", label: "🍗 Non-Vegetarian" },
  { id: "vegan", label: "🌱 Vegan" },
  { id: "eggetarian", label: "🍳 Eggetarian" },
];

const BUDGETS = [
  { id: "low_budget", label: "🪙 Pocket Friendly", desc: "Low cost local staples" },
  { id: "moderate", label: "💳 Moderate", desc: "Balanced variety & cost" },
  { id: "flexible", label: "🌟 Flexible", desc: "High protein, gourmet items" },
];

export default function OnboardingModal({ isOpen, onClose, initialSettings, onSave }) {
  const [goalType, setGoalType] = useState(initialSettings?.goal_type || "fat_loss");
  const [dietType, setDietType] = useState(initialSettings?.diet_type || "veg");
  const [budgetTier, setBudgetTier] = useState(initialSettings?.budget_tier || "moderate");
  const [weightKg, setWeightKg] = useState(initialSettings?.weight_kg || 70);
  const [heightCm, setHeightCm] = useState(initialSettings?.height_cm || 170);
  const [age, setAge] = useState(initialSettings?.age || 25);
  const [gender, setGender] = useState(initialSettings?.gender || "male");
  const [activityLevel, setActivityLevel] = useState(initialSettings?.activity_level || "moderate");
  const [saving, setSaving] = useState(false);

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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        goal_type: goalType,
        diet_type: dietType,
        budget_tier: budgetTier,
        weight_kg: Number(weightKg),
        height_cm: Number(heightCm),
        age: Number(age),
        gender: gender,
        activity_level: activityLevel
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>🎯 Setup Your Fitness Goals</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Goal selection */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Select Your Primary Goal</label>
            <div className={styles.grid2}>
              {GOALS.map((g) => (
                <div
                  key={g.id}
                  className={`${styles.card} ${goalType === g.id ? styles.activeCard : ""}`}
                  onClick={() => setGoalType(g.id)}
                >
                  <div className={styles.cardTitle}>{g.label}</div>
                  <div className={styles.cardDesc}>{g.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Diet Preference */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Dietary Preference</label>
            <div className={styles.grid4}>
              {DIETS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`${styles.pillBtn} ${dietType === d.id ? styles.activePill : ""}`}
                  onClick={() => setDietType(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Tier */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Food Budget Constraint</label>
            <div className={styles.grid3}>
              {BUDGETS.map((b) => (
                <div
                  key={b.id}
                  className={`${styles.card} ${budgetTier === b.id ? styles.activeCard : ""}`}
                  onClick={() => setBudgetTier(b.id)}
                >
                  <div className={styles.cardTitle}>{b.label}</div>
                  <div className={styles.cardDesc}>{b.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Physical Metrics */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Body Metrics (For Macro Math)</label>
            <div className={styles.metricsGrid}>
              <div>
                <span className={styles.inputLabel}>Weight (kg)</span>
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
              <div>
                <span className={styles.inputLabel}>Height (cm)</span>
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
              <div>
                <span className={styles.inputLabel}>Age</span>
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
              <div>
                <span className={styles.inputLabel}>Gender</span>
                <select
                  className={styles.select}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
          </div>

          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? "Calculating Macros..." : "Save & Generate Targets ✨"}
          </button>
        </form>
      </div>
    </div>
  );
}
