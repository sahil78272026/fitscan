"use client";

import { useState, useRef } from "react";
import styles from "./MealInput.module.css";

const MEAL_TYPES = [
  { value: "breakfast", label: "🌅 Breakfast", icon: "🌅" },
  { value: "lunch", label: "☀️ Lunch", icon: "☀️" },
  { value: "dinner", label: "🌙 Dinner", icon: "🌙" },
  { value: "snack", label: "🍿 Snack", icon: "🍿" },
];

export default function MealInput({ onSubmit, onScanImage, isLoading }) {
  const [rawInput, setRawInput] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!rawInput.trim() && !selectedFile) || isLoading) return;

    if (selectedFile && onScanImage) {
      await onScanImage(selectedFile, rawInput.trim(), mealType);
    } else {
      await onSubmit(rawInput.trim(), mealType);
    }

    setRawInput("");
    clearFile();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Log a Meal</h3>
        <button
          type="button"
          className={styles.photoAttachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Snap/Upload food photo"
        >
          📷 Scan Food Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {previewUrl && (
        <div className={styles.previewContainer}>
          <img src={previewUrl} alt="Meal preview" className={styles.previewImage} />
          <button type="button" className={styles.removeImgBtn} onClick={clearFile}>✕ Remove Photo</button>
        </div>
      )}

      <div className={styles.inputWrapper}>
        <textarea
          id="meal-input"
          className={styles.textarea}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={selectedFile ? "Add optional note for AI (e.g. 2 pieces paratha, 1 cup dal)..." : "What did you eat? e.g. 2 roti, dal, rice..."}
          rows={2}
          maxLength={500}
          disabled={isLoading}
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.mealTypes}>
          {MEAL_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              className={`${styles.typeBtn} ${mealType === type.value ? styles.active : ""}`}
              onClick={() => setMealType(type.value)}
              disabled={isLoading}
            >
              <span className={styles.typeIcon}>{type.icon}</span>
              <span className={styles.typeLabel}>{type.value}</span>
            </button>
          ))}
        </div>

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={(!rawInput.trim() && !selectedFile) || isLoading}
        >
          {isLoading ? (
            <span className={styles.spinner} />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {selectedFile ? "Scan Image & Log" : "Add Meal"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

