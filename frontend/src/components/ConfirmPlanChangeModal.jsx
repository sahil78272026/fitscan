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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span>Personalized AI Nutrition</span>
          </div>
          <p className={styles.warningDetail}>
            Clicking confirm will invoke Google Gemini AI to generate 3 fresh, tailored daily meal plans matching your current physical metrics, cuisine preferences, and macro targets.
          </p>
          <p className={styles.warningDetail} style={{ marginTop: "0.4rem", color: "#fef08a" }}>
            Note: Meal plans can be regenerated once every 24 hours.
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
            Generate New Plans
          </button>
        </div>
      </div>
    </div>
  );
}
