"use client";

import styles from "./MacroProgressBar.module.css";

export default function MacroProgressBar({ summary }) {
  if (!summary) return null;

  const {
    total_calories = 0,
    calorie_goal = 2000,
    remaining_calories = 2000,
    total_protein = 0,
    protein_goal = 150,
    remaining_protein = 150,
    total_carbs = 0,
    carbs_goal = 200,
    remaining_carbs = 200,
    total_fat = 0,
    fat_goal = 65,
    remaining_fat = 65,
  } = summary;

  const proteinPct = Math.min(100, Math.round((total_protein / (protein_goal || 1)) * 100));
  const carbsPct = Math.min(100, Math.round((total_carbs / (carbs_goal || 1)) * 100));
  const fatPct = Math.min(100, Math.round((total_fat / (fat_goal || 1)) * 100));

  return (
    <div className={styles.macroCard}>
      <h3 className={styles.title}>Daily Target & Remaining Macros</h3>
      <div className={styles.macroGrid}>
        {/* Protein */}
        <div className={styles.macroItem}>
          <div className={styles.macroHeader}>
            <span className={styles.macroName} style={{ color: "#3b82f6" }}>⚡ Protein</span>
            <span className={styles.macroValue}>{total_protein} / {protein_goal}g</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${proteinPct}%`, backgroundColor: "#3b82f6" }} />
          </div>
          <div className={styles.macroFooter}>
            <span>{remaining_protein}g left</span>
            <span>{proteinPct}%</span>
          </div>
        </div>

        {/* Carbs */}
        <div className={styles.macroItem}>
          <div className={styles.macroHeader}>
            <span className={styles.macroName} style={{ color: "#10b981" }}>🌾 Carbs</span>
            <span className={styles.macroValue}>{total_carbs} / {carbs_goal}g</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${carbsPct}%`, backgroundColor: "#10b981" }} />
          </div>
          <div className={styles.macroFooter}>
            <span>{remaining_carbs}g left</span>
            <span>{carbsPct}%</span>
          </div>
        </div>

        {/* Fat */}
        <div className={styles.macroItem}>
          <div className={styles.macroHeader}>
            <span className={styles.macroName} style={{ color: "#f59e0b" }}>🥑 Fats</span>
            <span className={styles.macroValue}>{total_fat} / {fat_goal}g</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${fatPct}%`, backgroundColor: "#f59e0b" }} />
          </div>
          <div className={styles.macroFooter}>
            <span>{remaining_fat}g left</span>
            <span>{fatPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
