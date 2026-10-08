"use client";

import styles from "./FloatingScanButton.module.css";

export default function FloatingScanButton({ onClick, isLoading = false }) {
  return (
    <div className={styles.fabWrapper}>
      <div className={styles.fabGlowHalo} />
      <button
        type="button"
        className={styles.fabButton}
        onClick={onClick}
        disabled={isLoading}
        aria-label="Scan food photo with AI"
        title="Snap or upload a food photo"
      >
        <span className={styles.iconWrapper}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
        <span className={styles.label}>Scan Food</span>
        <span className={styles.sparkle}>✨</span>
      </button>
    </div>
  );
}
