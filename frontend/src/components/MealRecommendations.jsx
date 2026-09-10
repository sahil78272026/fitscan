"use client";

import { useState } from "react";
import { getMealRecommendations } from "@/lib/api";
import styles from "./MealRecommendations.module.css";

export default function MealRecommendations() {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);

  const fetchRecs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMealRecommendations();
      setRecommendations(data);
      setIsOpen(true);
    } catch (err) {
      setError(err.message || "Failed to fetch meal ideas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.bannerBtn}
        onClick={isOpen ? () => setIsOpen(false) : fetchRecs}
        disabled={loading}
      >
        <span className={styles.sparkle}>💡</span>
        <span>{loading ? "Finding Budget Meal Ideas..." : isOpen ? "Hide Curated Meal Ideas" : "Get Curated Budget Meal Ideas"}</span>
      </button>

      {error && <div className={styles.error}>{error}</div>}

      {isOpen && recommendations && (
        <div className={styles.grid}>
          {recommendations.recommendations?.map((item, idx) => (
            <div key={idx} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.mealBadge}>{item.meal_type}</span>
                <span className={styles.costBadge}>{item.estimated_cost}</span>
              </div>

              <h4 className={styles.dishName}>{item.dish_name}</h4>
              <p className={styles.desc}>{item.description}</p>

              <div className={styles.macroPills}>
                <span className={styles.pill}>{item.calories} kcal</span>
                <span className={styles.pill}>⚡ {item.protein}g P</span>
                <span className={styles.pill}>🌾 {item.carbs}g C</span>
                <span className={styles.pill}>🥑 {item.fat}g F</span>
              </div>

              <div className={styles.recipeBox}>
                <strong>Recipe Summary:</strong> {item.recipe_summary}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
