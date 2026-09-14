"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getSettings } from "@/lib/api";
import styles from "./page.module.css";

const MEAL_TYPE_ICONS = {
  Breakfast: "🍳",
  Lunch: "🥗",
  Snack: "☕",
  Dinner: "🍲",
};

export default function MealPlanPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await getSettings();
      setUserSettings(settings);
    } catch (err) {
      // Fail silently or handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated, fetchSettings]);

  if (authLoading || loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}>
          <div className={styles.loaderSpinner} />
          <span>Loading Meal Plan...</span>
        </div>
      </main>
    );
  }

  const selectedPlan = userSettings?.selected_meal_plan;

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Navigation Header */}
        <header className={styles.header}>
          <div className={styles.navRow}>
            <Link href="/" className={styles.backBtn}>
              ← Tracker
            </Link>
            <Link href="/profile" className={styles.backBtn}>
              👤 Profile
            </Link>
          </div>
          <h1 className={styles.pageTitle}>Meal Plan Details</h1>
        </header>

        {!selectedPlan ? (
          /* Empty State if no meal plan active */
          <div className={styles.emptyCard}>
            <span className={styles.emptyIcon}>📋</span>
            <h2 className={styles.emptyTitle}>No Active Meal Plan Selected</h2>
            <p className={styles.emptyText}>
              Complete your onboarding metrics and select an AI-generated meal plan to view your full daily nutrition schedule.
            </p>
            <Link href="/profile" className={styles.primaryBtn}>
              🎯 Go to Profile & Select Meal Plan
            </Link>
          </div>
        ) : (
          <>
            {/* Hero Card */}
            <section className={styles.heroCard}>
              <div className={styles.badgeRow}>
                <span className={styles.planBadge}>
                  ✨ Active Plan
                </span>
                <span className={styles.planBadge}>
                  {(userSettings?.goal_type || "fat_loss").replace("_", " ").toUpperCase()}
                </span>
                <span className={styles.planBadge}>
                  {(userSettings?.diet_type || "veg").toUpperCase()}
                </span>
                <span className={styles.planBadge}>
                  {(userSettings?.budget_tier || "moderate").replace("_", " ").toUpperCase()}
                </span>
                {selectedPlan.estimated_cost && (
                  <span className={`${styles.planBadge} ${styles.costBadge}`}>
                    💰 {selectedPlan.estimated_cost}
                  </span>
                )}
              </div>

              <div>
                <h2 className={styles.planTitle}>{selectedPlan.title || "Personalized AI Meal Plan"}</h2>
                <p className={styles.planTagline}>{selectedPlan.tagline || "Tailored specifically to hit your daily macro targets."}</p>
              </div>

              {/* Macro Distribution Cards */}
              <div className={styles.macroGrid}>
                <div className={styles.macroCard}>
                  <span className={styles.macroLabel}>Daily Calories</span>
                  <span className={`${styles.macroVal} ${styles.caloriesVal}`}>
                    {selectedPlan.daily_calories || userSettings?.calorie_goal} kcal
                  </span>
                </div>
                <div className={styles.macroCard}>
                  <span className={styles.macroLabel}>Protein</span>
                  <span className={`${styles.macroVal} ${styles.proteinVal}`}>
                    {selectedPlan.protein_g || userSettings?.protein_goal}g
                  </span>
                </div>
                <div className={styles.macroCard}>
                  <span className={styles.macroLabel}>Carbs</span>
                  <span className={`${styles.macroVal} ${styles.carbsVal}`}>
                    {selectedPlan.carbs_g || userSettings?.carbs_goal}g
                  </span>
                </div>
                <div className={styles.macroCard}>
                  <span className={styles.macroLabel}>Fat</span>
                  <span className={`${styles.macroVal} ${styles.fatVal}`}>
                    {selectedPlan.fat_g || userSettings?.fat_goal}g
                  </span>
                </div>
              </div>
            </section>

            {/* Daily Meal Schedule */}
            <section>
              <div className={styles.scheduleHeader}>
                <h3 className={styles.scheduleTitle}>
                  🍽️ Daily Meal Schedule & Recipes
                </h3>
              </div>

              <div className={styles.mealsContainer}>
                {selectedPlan.meals && selectedPlan.meals.length > 0 ? (
                  selectedPlan.meals.map((meal, idx) => {
                    const icon = MEAL_TYPE_ICONS[meal.meal_type] || "🍱";
                    return (
                      <div key={idx} className={styles.mealCard}>
                        <div className={styles.mealHeader}>
                          <span className={styles.mealTypeTag}>
                            {icon} {meal.meal_type}
                          </span>
                          <span className={styles.mealCalsPill}>
                            {meal.calories} kcal
                          </span>
                        </div>

                        <div>
                          <h4 className={styles.dishName}>{meal.dish_name}</h4>
                          <p className={styles.dishDescription}>{meal.description}</p>
                        </div>

                        <div className={styles.mealMacroRow}>
                          <div className={styles.mealMacroItem}>
                            Protein: <strong>{meal.protein}g</strong>
                          </div>
                          <div className={styles.mealMacroItem}>
                            Carbs: <strong>{meal.carbs}g</strong>
                          </div>
                          <div className={styles.mealMacroItem}>
                            Fat: <strong>{meal.fat}g</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className={styles.emptyText}>No meal items listed in this plan.</p>
                )}
              </div>
            </section>

            {/* Action Bar */}
            <section className={styles.actionRow}>
              <Link href="/profile" className={styles.primaryBtn}>
                🔄 Change Meal Plan
              </Link>
              <Link href="/" className={styles.secondaryBtn}>
                🏋️ Back to Tracker
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
