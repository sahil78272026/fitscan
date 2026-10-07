"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./MissedMealBanner.module.css";

const MEAL_CONFIG = {
  breakfast: {
    label: "Breakfast",
    icon: "🍳",
    ratio: 0.25,
    messages: [
      (name) => `Hey ${name}, looks like you missed your morning breakfast!`,
      (name) => `${name}, don't let your morning fuel slip away!`,
      (name) => `Rise and shine, ${name}! Your breakfast macros are still waiting.`,
      (name) => `Morning fuel check, ${name}: did you skip breakfast today?`,
      (name) => `${name}, power up your morning—hit your breakfast nutrition targets!`,
    ],
  },
  lunch: {
    label: "Lunch",
    icon: "☀️",
    ratio: 0.35,
    messages: [
      (name) => `${name}, did midday rush past? You haven't logged lunch yet!`,
      (name) => `Afternoon slump, ${name}? Refuel with your planned lunch macros:`,
      (name) => `Hey ${name}, lunch is calling! Keep your energy up for the rest of the day.`,
      (name) => `${name}, don't forget to refuel before the afternoon slips away!`,
      (name) => `Midday check-in, ${name}: time to lock in your lunch nutrition.`,
    ],
  },
  dinner: {
    label: "Dinner",
    icon: "🌙",
    ratio: 0.3,
    messages: [
      (name) => `${name}, winding down for the night? Don't forget your dinner macros!`,
      (name) => `Hey ${name}, finish strong tonight—log your dinner to lock in your streak!`,
      (name) => `${name}, you still have nutrition targets to hit before calling it a day:`,
      (name) => `Evening fuel check, ${name}: keep your streak alive with dinner!`,
      (name) => `Almost bedtime, ${name}! Make sure you don't miss your dinner nutrients.`,
    ],
  },
};

// Snooze duration: 45 minutes for frequent re-appearance
const SNOOZE_DURATION_MS = 45 * 60 * 1000;

// Cached module-level time store for hydration-safe external subscription
let clientTimeCache = null;
const listeners = new Set();
let timerId = null;

function subscribe(callback) {
  listeners.add(callback);
  if (listeners.size === 1 && typeof window !== "undefined") {
    clientTimeCache = Date.now();
    timerId = setInterval(() => {
      clientTimeCache = Date.now();
      listeners.forEach((cb) => cb());
    }, 30000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };
}

function getSnapshot() {
  if (clientTimeCache === null && typeof window !== "undefined") {
    clientTimeCache = Date.now();
  }
  return clientTimeCache;
}

function getServerSnapshot() {
  return null;
}

function useClientTime() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getStoredDismissals() {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem("fitscan_missed_meals_dismissed");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function MissedMealBanner({
  user,
  userSettings,
  summary,
  isToday,
  onLogMeal,
}) {
  const currentTime = useClientTime();
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [dismissedMeals, setDismissedMeals] = useState(getStoredDismissals);
  const [promptOffset, setPromptOffset] = useState(() => Math.floor(Math.random() * 5));

  if (!currentTime || !isToday) {
    return null;
  }

  const loggedMeals = summary?.meals || [];
  const now = new Date(currentTime);
  const currentHour = now.getHours();

  const hasBreakfast = loggedMeals.some(
    (m) => m.meal_type?.toLowerCase() === "breakfast"
  );
  const hasLunch = loggedMeals.some(
    (m) => m.meal_type?.toLowerCase() === "lunch"
  );
  const hasDinner = loggedMeals.some(
    (m) => m.meal_type?.toLowerCase() === "dinner"
  );

  const missedMeals = [];

  // Check breakfast: 11:00 AM or later, or if lunch/dinner logged
  if (!hasBreakfast && (currentHour >= 11 || hasLunch || hasDinner)) {
    const dismissedAt = dismissedMeals["breakfast"];
    if (!dismissedAt || currentTime - dismissedAt > SNOOZE_DURATION_MS) {
      missedMeals.push("breakfast");
    }
  }

  // Check lunch: 3:00 PM (15:00) or later, or if dinner logged
  if (!hasLunch && (currentHour >= 15 || hasDinner)) {
    const dismissedAt = dismissedMeals["lunch"];
    if (!dismissedAt || currentTime - dismissedAt > SNOOZE_DURATION_MS) {
      missedMeals.push("lunch");
    }
  }

  // Check dinner: 9:00 PM (21:00) or later
  if (!hasDinner && currentHour >= 21) {
    const dismissedAt = dismissedMeals["dinner"];
    if (!dismissedAt || currentTime - dismissedAt > SNOOZE_DURATION_MS) {
      missedMeals.push("dinner");
    }
  }

  if (missedMeals.length === 0) {
    return null;
  }

  // Active meal type (prefer explicitly selected tab if still missed, else latest missed)
  const activeMealType =
    selectedMealType && missedMeals.includes(selectedMealType)
      ? selectedMealType
      : missedMeals[missedMeals.length - 1];

  // User's name for personalization
  const rawName = user?.name || userSettings?.name || "";
  const firstName = rawName.trim() ? rawName.trim().split(" ")[0] : "there";

  const config = MEAL_CONFIG[activeMealType];
  const messages = config.messages;
  const messageGenerator = messages[promptOffset % messages.length];
  const promptTitle = messageGenerator(firstName);

  // Macro calculations
  const planMeals = userSettings?.selected_meal_plan?.meals || [];
  const planMeal = planMeals.find(
    (m) => m.meal_type?.toLowerCase() === activeMealType
  );

  let targetCalories, targetProtein, targetCarbs, targetFat, dishName;

  if (planMeal) {
    targetCalories = planMeal.calories;
    targetProtein = planMeal.protein;
    targetCarbs = planMeal.carbs;
    targetFat = planMeal.fat;
    dishName = planMeal.dish_name;
  } else {
    // Fallback: ratio from daily goals
    const calsGoal = summary?.calorie_goal || userSettings?.calorie_goal || 2000;
    const protGoal = summary?.protein_goal || userSettings?.protein_goal || 150;
    const carbsGoal = summary?.carbs_goal || userSettings?.carbs_goal || 200;
    const fatGoal = summary?.fat_goal || userSettings?.fat_goal || 65;

    targetCalories = Math.round(calsGoal * config.ratio);
    targetProtein = Math.round(protGoal * config.ratio);
    targetCarbs = Math.round(carbsGoal * config.ratio);
    targetFat = Math.round(fatGoal * config.ratio);
    dishName = null;
  }

  const handleDismiss = (mealToDismiss = activeMealType) => {
    const updated = {
      ...dismissedMeals,
      [mealToDismiss]: Date.now(),
    };
    setDismissedMeals(updated);
    try {
      sessionStorage.setItem("fitscan_missed_meals_dismissed", JSON.stringify(updated));
    } catch {
      // Ignore
    }
    setPromptOffset((prev) => prev + 1);
  };

  const handleLogClick = () => {
    if (onLogMeal) {
      onLogMeal(activeMealType);
    }
  };

  return (
    <div className={styles.banner} role="alert">
      <button
        type="button"
        className={styles.dismissBtn}
        onClick={() => handleDismiss(activeMealType)}
        aria-label="Dismiss banner"
        title="Dismiss reminder"
      >
        ✕
      </button>

      <div className={styles.topRow}>
        <span className={styles.badge}>
          <span>{config.icon}</span>
          <span>Missed {config.label}</span>
        </span>

        {missedMeals.length > 1 && (
          <div className={styles.multiMealTabs}>
            {missedMeals.map((type) => (
              <button
                key={type}
                type="button"
                className={`${styles.mealTab} ${
                  activeMealType === type ? styles.activeMealTab : ""
                }`}
                onClick={() => setSelectedMealType(type)}
              >
                <span>{MEAL_CONFIG[type].icon}</span>
                <span>{MEAL_CONFIG[type].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>{promptTitle}</h3>
        <p className={styles.subtitle}>
          {dishName ? (
            <>
              Planned dish: <span className={styles.planDishName}>{dishName}</span> · Missing macros:
            </>
          ) : (
            `Target macros for your ${config.label.toLowerCase()}:`
          )}
        </p>

        <div className={styles.macroGrid}>
          <div className={`${styles.macroPill} ${styles.caloriesPill}`}>
            <span className={styles.macroLabel}>Calories</span>
            <span className={styles.macroValue}>{targetCalories} kcal</span>
          </div>
          <div className={`${styles.macroPill} ${styles.proteinPill}`}>
            <span className={styles.macroLabel}>Protein</span>
            <span className={styles.macroValue}>{targetProtein}g</span>
          </div>
          <div className={`${styles.macroPill} ${styles.carbsPill}`}>
            <span className={styles.macroLabel}>Carbs</span>
            <span className={styles.macroValue}>{targetCarbs}g</span>
          </div>
          <div className={`${styles.macroPill} ${styles.fatPill}`}>
            <span className={styles.macroLabel}>Fat</span>
            <span className={styles.macroValue}>{targetFat}g</span>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.logNowBtn}
            onClick={handleLogClick}
          >
            <span>Log {config.label} Now</span>
            <span>→</span>
          </button>
          <button
            type="button"
            className={styles.snoozeBtn}
            onClick={() => handleDismiss(activeMealType)}
          >
            I&apos;ll Eat Later
          </button>
        </div>
      </div>
    </div>
  );
}
