"use client";

import { useEffect, useRef } from "react";
import styles from "./ProgressRing.module.css";

export default function ProgressRing({ consumed, goal }) {
  const ringRef = useRef(null);
  const percentage = Math.min((consumed / goal) * 100, 100);
  const remaining = Math.max(0, goal - consumed);
  const isOver = consumed > goal;

  // SVG circle math
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on progress
  const getColor = () => {
    if (isOver) return "var(--color-danger)";
    if (percentage > 80) return "var(--color-warning)";
    if (percentage > 50) return "var(--color-accent)";
    return "var(--color-success)";
  };

  useEffect(() => {
    if (ringRef.current) {
      ringRef.current.style.strokeDashoffset = offset;
    }
  }, [offset]);

  return (
    <div className={styles.container}>
      <div className={styles.ringWrapper}>
        <svg className={styles.svg} viewBox="0 0 200 200">
          {/* Background track */}
          <circle
            className={styles.track}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            strokeWidth="12"
          />
          {/* Progress ring */}
          <circle
            ref={ringRef}
            className={styles.progress}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            style={{
              stroke: getColor(),
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className={styles.centerText}>
          <span className={styles.consumed}>{consumed.toLocaleString()}</span>
          <span className={styles.separator}>of {goal.toLocaleString()}</span>
          <span className={styles.unit}>kcal</span>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ color: getColor() }}>
            {isOver ? `+${(consumed - goal).toLocaleString()}` : remaining.toLocaleString()}
          </span>
          <span className={styles.statLabel}>
            {isOver ? "over" : "remaining"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{Math.round(percentage)}%</span>
          <span className={styles.statLabel}>consumed</span>
        </div>
      </div>
    </div>
  );
}
