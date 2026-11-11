"use client";

import { useState, useRef, useMemo } from "react";
import Image from "next/image";
import styles from "./MealInput.module.css";

const MEAL_TYPES = [
  {
    value: "breakfast",
    label: "Breakfast",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6"/>
        <path d="m4.93 10.93 4.24-4.24"/>
        <path d="M2 18h20"/>
        <path d="M20 18a8 8 0 0 0-16 0"/>
      </svg>
    ),
  },
  {
    value: "lunch",
    label: "Lunch",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    ),
  },
  {
    value: "dinner",
    label: "Dinner",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    ),
  },
  {
    value: "snack",
    label: "Snack",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
        <line x1="6" y1="2" x2="6" y2="4"/>
        <line x1="10" y1="2" x2="10" y2="4"/>
        <line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
    ),
  },
];

function getMealTypeFromTime() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  if (hour >= 18 && hour < 23) return "dinner";
  return "snack"; // late night
}

export default function MealInput({ onSubmit, onScanImage, isLoading, recentItems = [], activeMealType }) {
  const [rawInput, setRawInput] = useState("");
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [prevActiveMealType, setPrevActiveMealType] = useState(activeMealType);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  if (activeMealType !== prevActiveMealType) {
    setPrevActiveMealType(activeMealType);
    setSelectedMealType(activeMealType);
  }

  const mealType = selectedMealType ?? getMealTypeFromTime();
  const setMealType = (val) => setSelectedMealType(val);

  // Filter recent items to only show those matching the selected meal type
  const filteredRecentItems = useMemo(
    () => recentItems.filter((item) => item.meal_type === mealType),
    [recentItems, mealType]
  );

  const handleSuggestionClick = (itemName) => {
    setRawInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return itemName;
      return `${trimmed}, ${itemName}`;
    });
  };

// Compress and downscale captured image to prevent mobile browser memory crashes (OOM)
async function compressImageFile(file, maxWidth = 1280, maxHeight = 1280, quality = 0.75) {
  if (!file || !file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Only resize if image dimensions exceed maximum limits
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, ".jpg"),
            {
              type: "image/jpeg",
              lastModified: Date.now(),
            }
          );
          resolve(compressedFile);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Clear previous preview object URL to free memory
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      try {
        const compressed = await compressImageFile(file);
        setSelectedFile(compressed);
        setPreviewUrl(URL.createObjectURL(compressed));
      } catch (err) {
        console.warn("Client image compression error, using raw file:", err);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
      const formEl = document.getElementById("meal-input-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
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
    <form id="meal-input-form" className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Log a Meal</h3>
        <div className={styles.photoActions}>
          <button
            type="button"
            className={styles.photoAttachBtn}
            onClick={() => cameraInputRef.current?.click()}
            disabled={isLoading}
            title="Snap live food photo with camera"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            Camera
          </button>
          <button
            type="button"
            className={styles.galleryAttachBtn}
            onClick={() => galleryInputRef.current?.click()}
            disabled={isLoading}
            title="Choose food photo from gallery or files"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            Gallery
          </button>
        </div>

        {/* Live Camera input with capture="environment" */}
        <input
          ref={cameraInputRef}
          id="meal-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* File Browser / Gallery input without capture */}
        <input
          ref={galleryInputRef}
          id="meal-gallery-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {previewUrl && (
        <div className={styles.previewContainer}>
          <Image src={previewUrl} alt="Meal preview" width={50} height={50} unoptimized className={styles.previewImage} />
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

      {filteredRecentItems.length > 0 && (
        <div className={styles.suggestionsSection}>
          <span className={styles.suggestionsLabel}>Recent:</span>
          <div className={styles.suggestionsChips}>
            {filteredRecentItems.map((item, idx) => (
              <button
                key={`${item.name}-${idx}`}
                type="button"
                className={styles.suggestionChip}
                onClick={() => handleSuggestionClick(item.name)}
                disabled={isLoading}
                title={`${item.calories} kcal · P:${item.protein}g · C:${item.carbs}g · F:${item.fat}g`}
              >
                {item.name}
                <span className={styles.chipCal}>{item.calories}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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

