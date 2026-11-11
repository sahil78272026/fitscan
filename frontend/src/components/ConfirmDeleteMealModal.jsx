"use client";

import { useEffect } from "react";
import styles from "./ConfirmDeleteMealModal.module.css";

function renderMealIcon(mealType) {
  const type = (mealType || "").toLowerCase();
  if (type === "breakfast") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6"/><path d="m4.93 10.93 4.24-4.24"/><path d="M2 18h20"/><path d="M20 18a8 8 0 0 0-16 0"/>
      </svg>
    );
  }
  if (type === "lunch") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
      </svg>
    );
  }
  if (type === "dinner") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    );
  }
  if (type === "snack") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  );
}

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

  const mealIcon = renderMealIcon(meal.meal_type);

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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
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
