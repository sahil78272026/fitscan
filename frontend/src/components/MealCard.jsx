"use client";

import { useState } from "react";
import ConfirmDeleteMealModal from "./ConfirmDeleteMealModal";
import styles from "./MealCard.module.css";

function renderMealIcon(mealType) {
  const type = (mealType || "").toLowerCase();
  if (type === "breakfast") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6"/>
        <path d="m4.93 10.93 4.24-4.24"/>
        <path d="M2 18h20"/>
        <path d="M20 18a8 8 0 0 0-16 0"/>
      </svg>
    );
  }
  if (type === "lunch") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/>
        <path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
        <path d="m6.34 17.66-1.41 1.41"/>
        <path d="m19.07 4.93-1.41 1.41"/>
      </svg>
    );
  }
  if (type === "dinner") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    );
  }
  if (type === "snack") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
        <line x1="6" y1="2" x2="6" y2="4"/>
        <line x1="10" y1="2" x2="10" y2="4"/>
        <line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  );
}

export default function MealCard({ meal, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(meal.id);
    } finally {
      setDeleting(false);
      setShowConfirmModal(false);
    }
  };

  const timeStr = new Date(meal.logged_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const getMealPriority = (m) => {
    const type = (m.meal_type || "").toLowerCase();
    const protein = Number(m.total_protein) || 0;
    const calories = Number(m.total_calories) || 0;
    if (type === "dinner" || protein >= 35 || calories >= 550) return "high";
    if (type === "snack" || calories < 300) return "low";
    return "medium";
  };

  const priority = getMealPriority(meal);
  const priorityClass =
    priority === "high"
      ? styles.cardPriorityHigh
      : priority === "low"
      ? styles.cardPriorityLow
      : styles.cardPriorityMedium;

  const priorityBadge =
    priority === "high"
      ? "Recovery Anchor"
      : priority === "low"
      ? "Snack"
      : "Balanced";

  return (
    <div
      className={`${styles.card} ${priorityClass} ${expanded ? styles.expanded : ""} ${deleting ? styles.deleting : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className={styles.header}>
        <div className={styles.left}>
          {meal.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={meal.image_url}
              alt={meal.meal_type}
              className={styles.mealThumb}
            />
          ) : (
            <span className={styles.icon}>{renderMealIcon(meal.meal_type)}</span>
          )}
          <div className={styles.info}>
            <div className={styles.typeRow}>
              <span className={styles.mealType}>{meal.meal_type}</span>
              <span className={styles.priorityBadge}>{priorityBadge}</span>
            </div>
            <div className={styles.glanceableMacros}>
              P: {meal.total_protein || 0}g • C: {meal.total_carbs || 0}g • F: {meal.total_fat || 0}g
            </div>
            <span className={styles.time}>{timeStr}</span>
          </div>
        </div>
        <div className={styles.right}>
          <span className={styles.calories}>{meal.total_calories}</span>
          <span className={styles.kcalLabel}>kcal</span>
          {onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={handleDeleteClick}
              disabled={deleting}
              title="Delete meal"
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
          {meal.image_url && (
            <div className={styles.imageContainer}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meal.image_url}
                alt={meal.raw_input || meal.meal_type}
                className={styles.expandedImage}
              />
            </div>
          )}
          <div className={styles.rawInput}>&ldquo;{meal.raw_input}&rdquo;</div>

          {/* Macro breakdown summary */}
          <div className={styles.macroSummaryRow}>
            <span style={{ color: "#38BDF8" }}>P: {meal.total_protein || 0}g</span>
            <span style={{ color: "#10B981" }}>C: {meal.total_carbs || 0}g</span>
            <span style={{ color: "#F59E0B" }}>F: {meal.total_fat || 0}g</span>
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

      {showConfirmModal && (
        <ConfirmDeleteMealModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmDelete}
          meal={meal}
          isDeleting={deleting}
        />
      )}
    </div>
  );
}
