"use client";

import { useState, useEffect } from "react";
import styles from "./MorningBriefingCard.module.css";

export default function MorningBriefingCard({ briefingData, onDismiss, onLogBreakfast }) {
  if (!briefingData || !briefingData.briefing) return null;

  const { greeting, status_badge, feedback, improvements, focus_today } = briefingData.briefing;

  // Status badge color themes
  const getBadgeClass = (badge) => {
    const b = (badge || "").toLowerCase();
    if (b.includes("target")) return styles.badgeSuccess;
    if (b.includes("protein")) return styles.badgeWarning;
    if (b.includes("surplus")) return styles.badgeAlert;
    return styles.badgeInfo;
  };

  return (
    <aside className={styles.card} aria-label="Morning Nutrition Briefing">
      <div className={styles.header}>
        <div className={styles.greetingGroup}>
          <div className={styles.sunIcon}>☀️</div>
          <div>
            <h2 className={styles.greetingText}>{greeting || "Good morning! ☀️"}</h2>
            <p className={styles.subGreeting}>Yesterday's Recap & Today's Tips</p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {status_badge && (
            <span className={`${styles.statusBadge} ${getBadgeClass(status_badge)}`}>
              {status_badge}
            </span>
          )}
          {onDismiss && (
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={onDismiss}
              aria-label="Dismiss morning briefing"
              title="Dismiss for today"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <p className={styles.feedbackText}>
          {feedback}
        </p>
      )}

      {improvements && improvements.length > 0 && (
        <div className={styles.improvementsSection}>
          <div className={styles.improvementsHeader}>
            <span className={styles.sparkle}>💡</span>
            <span>Today's Improvements:</span>
          </div>
          <ul className={styles.improvementsList}>
            {improvements.map((tip, idx) => (
              <li key={idx} className={styles.improvementItem}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className={styles.footer}>
        {focus_today && (
          <div className={styles.focusToday}>
            <span className={styles.focusLabel}>Target Focus:</span> {focus_today}
          </div>
        )}
        {onLogBreakfast && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onLogBreakfast}
          >
            🍳 Log Breakfast
          </button>
        )}
      </footer>
    </aside>
  );
}
