"use client";

import { useState } from "react";
import styles from "./MealCard.module.css";

const MEAL_ICONS = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍿",
};

export default function MealCard({ meal, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    await onDelete(meal.id);
  };

  const timeStr = new Date(meal.logged_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div
      className={`${styles.card} ${expanded ? styles.expanded : ""} ${deleting ? styles.deleting : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className={styles.header}>
        <div className={styles.left}>
          <span className={styles.icon}>{MEAL_ICONS[meal.meal_type] || "🍽️"}</span>
          <div className={styles.info}>
            <span className={styles.mealType}>{meal.meal_type}</span>
            <span className={styles.time}>{timeStr}</span>
          </div>
        </div>
        <div className={styles.right}>
          <span className={styles.calories}>{meal.total_calories}</span>
          <span className={styles.kcalLabel}>kcal</span>
          {onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={deleting}
              title="Delete meal"
              aria-label="Delete meal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,6 5,6 21,6" />
                <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className={styles.items}>
          <div className={styles.rawInput}>&ldquo;{meal.raw_input}&rdquo;</div>

          {/* Macro breakdown summary */}
          <div className={styles.macroSummaryRow}>
            <span style={{ color: "#3b82f6" }}>⚡ P: {meal.total_protein || 0}g</span>
            <span style={{ color: "#10b981" }}>🌾 C: {meal.total_carbs || 0}g</span>
            <span style={{ color: "#f59e0b" }}>🥑 F: {meal.total_fat || 0}g</span>
          </div>

          {meal.food_items.map((item) => (
            <div key={item.id} className={styles.foodItem}>
              <div className={styles.foodItemLeft}>
                <span className={styles.foodName}>
                  {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}
                </span>
                <span className={styles.foodMacros}>
                  P: {item.protein || 0}g · C: {item.carbs || 0}g · F: {item.fat || 0}g
                </span>
              </div>
              <span className={styles.foodCalories}>{item.calories} kcal</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.expandHint}>
        <svg
          className={styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </div>
    </div>
  );
}
