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
          <div className={styles.sunIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          </div>
          <div>
            <h2 className={styles.greetingText}>{(greeting || "Good morning").replace(/[^\x00-\x7F]/g, "").trim()}</h2>
            <p className={styles.subGreeting}>Yesterday&apos;s Recap &amp; Today&apos;s Tips</p>
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
            <span className={styles.sparkle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                <path d="M9 18h6"/>
                <path d="M10 22h4"/>
              </svg>
            </span>
            <span>Today&apos;s Improvements:</span>
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
            Log Breakfast
          </button>
        )}
      </footer>
    </aside>
  );
}
