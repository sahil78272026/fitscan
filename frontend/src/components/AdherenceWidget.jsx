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
          <span>🔥</span>
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
                <span className={styles.badgeIcon}>{b.icon}</span>
                <div className={styles.badgeInfo}>
                  <span className={styles.badgeTitle}>{b.title}</span>
                  <span className={styles.badgeStatus}>
                    {b.unlocked ? "Unlocked 🎉" : "Locked"}
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
