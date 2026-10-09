"use client";

import { useEffect } from "react";
import styles from "./ConfirmPlanChangeModal.module.css";

export default function ConfirmPlanChangeModal({
  isOpen,
  onClose,
  onConfirm,
  currentPlan,
  isPro = false,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close dialog"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <span>🤖</span>
          </div>
          <div className={styles.titleArea}>
            <h2 className={styles.modalTitle}>Generate New AI Meal Plans?</h2>
            <p className={styles.modalSubtitle}>
              Powered by Google Gemini Nutrition Engine
            </p>
          </div>
        </div>

        {/* Current Active Plan (if any) */}
        {currentPlan && (
          <div className={styles.currentPlanCard}>
            <span className={styles.planCardLabel}>Currently Active Plan</span>
            <div className={styles.planCardTitle}>{currentPlan.title}</div>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
              {currentPlan.daily_calories} kcal • {currentPlan.protein_g}g Protein
            </span>
          </div>
        )}

        {/* Cooldown & AI Warning Box */}
        {isPro ? (
          <div className={styles.warningBoxPro}>
            <div className={styles.warningTitle}>
              <span>👑</span>
              <span>CoreControl Pro Member</span>
            </div>
            <p className={styles.warningDetail}>
              As a Pro member, you have unlimited meal plan rotations. Clicking confirm will invoke Gemini AI to generate 3 fresh, tailored daily meal plans for your current calorie & macro targets.
            </p>
          </div>
        ) : (
          <div className={styles.warningBox}>
            <div className={styles.warningTitle}>
              <span>⚠️</span>
              <span>Free Tier Policy: 1 Rotation per 7 Days</span>
            </div>
            <p className={styles.warningDetail}>
              Generating new plans uses an intensive AI model to calculate custom meal options. On the Free Tier, you receive <strong>1 free meal plan rotation every 7 days</strong>.
            </p>
            <p className={styles.warningDetail} style={{ marginTop: "0.25rem", color: "#fef9c3" }}>
              Once you confirm and activate a new plan, your active plan will be replaced and your next rotation will enter a <strong>7-day cooldown</strong>.
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            Keep Current Plan
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
          >
            Yes, Generate New Plans ✨
          </button>
        </div>
      </div>
    </div>
  );
}
