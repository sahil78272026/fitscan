"use client";

import { useState } from "react";
import styles from "./GoalEditor.module.css";

export default function GoalEditor({ currentGoal, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentGoal);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const goal = parseInt(value, 10);
    if (isNaN(goal) || goal <= 0 || goal > 10000) return;
    setSaving(true);
    await onUpdate(goal);
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setValue(currentGoal);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <button
        className={styles.goalDisplay}
        onClick={() => setEditing(true)}
        title="Click to change daily goal"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
        <span>Goal: {currentGoal.toLocaleString()} kcal</span>
        <svg className={styles.editIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    );
  }

  return (
    <div className={styles.editMode}>
      <input
        type="number"
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        min={100}
        max={10000}
        autoFocus
        disabled={saving}
      />
      <span className={styles.kcalSuffix}>kcal</span>
      <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? "..." : "Save"}
      </button>
      <button
        className={styles.cancelBtn}
        onClick={() => {
          setValue(currentGoal);
          setEditing(false);
        }}
        disabled={saving}
      >
        ✕
      </button>
    </div>
  );
}
