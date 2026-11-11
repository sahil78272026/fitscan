"use client";

import styles from "./AdherenceWidget.module.css";

export default function AdherenceWidget({ stats }) {
  if (!stats) return null;

  const { current_streak, weekly_adherence_score, seven_day_grid, badges } = stats;

  // SVG ring stroke calculations for 48px circle (radius 20)
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (weekly_adherence_score / 100) * circumference;

  return (
    <div className={styles.card}>
      {/* Top Row: Streak & Adherence Score */}
      <div className={styles.topRow}>
        <div className={styles.streakBadge}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
          <span><strong className={styles.streakNumber}>{current_streak}</strong> Day Streak</span>
        </div>

        <div className={styles.scoreGroup}>
          <div className={styles.scoreRingContainer}>
            <svg className={styles.scoreSvg} viewBox="0 0 48 48">
              <circle
                className={styles.scoreCircleBg}
                cx="24"
                cy="24"
                r={radius}
              />
              <circle
                className={styles.scoreCircleFg}
                cx="24"
                cy="24"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <span className={styles.scoreValueText}>{Math.round(weekly_adherence_score)}%</span>
          </div>

          <div className={styles.scoreLabelGroup}>
            <span className={styles.scoreTitle}>7-Day Adherence</span>
            <span className={styles.scoreSubtitle}>Macro Consistency</span>
          </div>
        </div>
      </div>

      {/* 7-Day Consistency Dots */}
      <div className={styles.gridSection}>
        <span className={styles.gridHeader}>Last 7 Days Activity</span>
        <div className={styles.dayDotsRow}>
          {seven_day_grid?.map((day) => {
            let symbol = "•";
            if (day.status === "on_target") symbol = "✓";
            else if (day.status === "close") symbol = "∼";
            else if (day.status === "off_target") symbol = "!";

            return (
              <div key={day.date} className={styles.dayColumn} title={`${day.day_name}: ${day.calories} kcal (${day.status})`}>
                <span className={styles.dayName}>{day.day_name}</span>
                <div className={`${styles.dayDot} ${styles[day.status]}`}>
                  {symbol}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievement Badges */}
      {badges?.length > 0 && (
        <div className={styles.badgesSection}>
          <span className={styles.gridHeader}>Badges & Achievements</span>
          <div className={styles.badgesGrid}>
            {badges.map((b) => (
              <div
                key={b.id}
                className={`${styles.badgeCard} ${b.unlocked ? styles.unlocked : ""}`}
                title={b.description}
              >
                <span className={styles.badgeIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={b.unlocked ? "#F59E0B" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6"/>
                    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
                  </svg>
                </span>
                <div className={styles.badgeInfo}>
                  <span className={styles.badgeTitle}>{b.title}</span>
                  <span className={styles.badgeStatus}>
                    {b.unlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
