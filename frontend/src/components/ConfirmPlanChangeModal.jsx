"use client";

import { useEffect } from "react";
import styles from "./ConfirmPlanChangeModal.module.css";

export default function ConfirmPlanChangeModal({
  isOpen,
  onClose,
  onConfirm,
  currentPlan,
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

        {/* Personalized AI Meal Plan Notice */}
        <div className={styles.warningBox}>
          <div className={styles.warningTitle}>
            <span>✨</span>
            <span>Personalized AI Nutrition</span>
          </div>
          <p className={styles.warningDetail}>
            Clicking confirm will invoke Google Gemini AI to generate 3 fresh, tailored daily meal plans matching your current physical metrics, cuisine preferences, and macro targets.
          </p>
          <p className={styles.warningDetail} style={{ marginTop: "0.4rem", color: "#fef08a" }}>
            ⏱️ Note: To keep your nutrition consistent and optimize AI calls, meal plans can be updated once every 24 hours.
          </p>
        </div>

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
