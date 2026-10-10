"use client";

import { useEffect } from "react";
import styles from "./ConfirmDeleteMealModal.module.css";

const MEAL_ICONS = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍿",
};

export default function ConfirmDeleteMealModal({
  isOpen,
  onClose,
  onConfirm,
  meal,
  isDeleting = false,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isDeleting]);

  if (!isOpen || !meal) return null;

  const mealIcon = MEAL_ICONS[meal.meal_type] || "🍽️";

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDeleting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-meal-title"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          disabled={isDeleting}
          aria-label="Close dialog"
        >
          ✕
        </button>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <span>🗑️</span>
          </div>
          <div className={styles.titleArea}>
            <h2 id="delete-meal-title" className={styles.modalTitle}>
              Delete Logged Meal?
            </h2>
            <p className={styles.modalSubtitle}>
              This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Meal Summary Preview */}
        <div className={styles.mealPreviewCard}>
          <div className={styles.mealPreviewLeft}>
            <span className={styles.previewIcon}>{mealIcon}</span>
            <div className={styles.previewInfo}>
              <span className={styles.previewType}>{meal.meal_type}</span>
              {meal.raw_input && (
                <span className={styles.previewDetail}>&ldquo;{meal.raw_input}&rdquo;</span>
              )}
            </div>
          </div>
          <div className={styles.previewRight}>
            <span className={styles.previewCalories}>{meal.total_calories}</span>
            <span className={styles.previewKcal}>kcal</span>
          </div>
        </div>

        {/* Warning Alert Box */}
        <div className={styles.warningBox}>
          <div className={styles.warningTitle}>
            <span>⚠️</span>
            <span>Warning</span>
          </div>
          <p className={styles.warningDetail}>
            Removing this meal will permanently deduct <strong>{meal.total_calories} kcal</strong> from your daily nutrition totals and update your macro progress.
          </p>
        </div>

        {/* Actions Row */}
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.deleteConfirmBtn}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Meal"}
          </button>
        </div>
      </div>
    </div>
  );
}
