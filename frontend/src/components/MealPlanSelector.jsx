"use client";

import { useState, useEffect } from "react";
import { getSuggestedMealPlans } from "@/lib/api";
import styles from "./MealPlanSelector.module.css";

export default function MealPlanSelector({ initialPlans, onSelectPlan, onBackToWizard }) {
  const [plans, setPlans] = useState(initialPlans?.plans || []);
  const [loading, setLoading] = useState(!initialPlans?.plans?.length);
  const [error, setError] = useState(null);
  const [selectingId, setSelectingId] = useState(null);

  useEffect(() => {
    if (!initialPlans?.plans?.length) {
      loadMealPlans();
    }
  }, [initialPlans]);

  const loadMealPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuggestedMealPlans();
      setPlans(data.plans || []);
    } catch (err) {
      setError(err.message || "Failed to load meal plans. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePlan = async (plan) => {
    setSelectingId(plan.plan_id || plan.title);
    try {
      await onSelectPlan(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setSelectingId(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.selectorOverlay}>
        <div className={styles.loadingContainer}>
          <div className={styles.aiSpinner} />
          <h2 className={styles.loadingTitle}>🤖 Generating Custom Meal Plans...</h2>
          <p className={styles.loadingSubtitle}>
            Gemini AI is analyzing local ingredient costs, your macronutrient targets, and dietary preference to craft 3 unique meal plans.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.selectorOverlay}>
        <div className={styles.errorContainer}>
          <span className={styles.errorIcon}>⚠️</span>
          <h3>{error}</h3>
          <button className={styles.retryBtn} onClick={loadMealPlans}>
            🔄 Retry AI Generation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.selectorOverlay}>
      <div className={styles.selectorContainer}>
        {/* Header */}
        <div className={styles.selectorHeader}>
          <div>
            <span className={styles.badge}>Step 5 • Select Active Plan</span>
            <h2 className={styles.title}>🍱 Choose Your Preferred Daily Meal Plan</h2>
            <p className={styles.subtitle}>
              Based on your metrics & budget, pick the plan that best fits your daily routine.
            </p>
          </div>
          {onBackToWizard && (
            <button className={styles.changeMetricsBtn} onClick={onBackToWizard}>
              ⚙️ Change Metrics
            </button>
          )}
        </div>

        {/* 3 Meal Plan Cards Grid */}
        <div className={styles.plansGrid}>
          {plans.map((plan, idx) => {
            const isSelected = selectingId === (plan.plan_id || plan.title);
            return (
              <div key={plan.plan_id || idx} className={styles.planCard}>
                <div className={styles.cardTop}>
                  <div className={styles.planBadge}>Plan #{idx + 1}</div>
                  <h3 className={styles.planTitle}>{plan.title}</h3>
                  <p className={styles.planTagline}>{plan.tagline}</p>
                  <span className={styles.costBadge}>{plan.estimated_cost}</span>
                </div>

                {/* Macro Summary Pill */}
                <div className={styles.macroPillGrid}>
                  <div className={styles.macroStat}>
                    <span className={styles.statVal}>{plan.daily_calories}</span>
                    <span className={styles.statLbl}>kcal</span>
                  </div>
                  <div className={styles.macroStat}>
                    <span className={styles.statVal}>{plan.protein_g}g</span>
                    <span className={styles.statLbl}>Protein</span>
                  </div>
                  <div className={styles.macroStat}>
                    <span className={styles.statVal}>{plan.carbs_g}g</span>
                    <span className={styles.statLbl}>Carbs</span>
                  </div>
                  <div className={styles.macroStat}>
                    <span className={styles.statVal}>{plan.fat_g}g</span>
                    <span className={styles.statLbl}>Fat</span>
                  </div>
                </div>

                {/* Meals Breakdown Preview */}
                <div className={styles.mealsList}>
                  <h4 className={styles.mealsListHeading}>Daily Meal Breakdown</h4>
                  {plan.meals?.map((m, mIdx) => (
                    <div key={mIdx} className={styles.mealItem}>
                      <div className={styles.mealItemHeader}>
                        <span className={styles.mealTypeBadge}>{m.meal_type}</span>
                        <span className={styles.mealDishName}>{m.dish_name}</span>
                      </div>
                      <p className={styles.mealDesc}>{m.description}</p>
                      <div className={styles.mealItemMacros}>
                        <span>{m.calories} kcal</span> • <span>{m.protein}g P</span> • <span>{m.carbs}g C</span> • <span>{m.fat}g F</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                <button
                  className={styles.selectPlanBtn}
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isSelected}
                >
                  {isSelected ? "Activating Plan..." : "Activate This Meal Plan ✨"}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.legalDisclaimerBox}>
          ⚖️ <strong>Disclaimer:</strong> FitScan AI meal suggestions and macro estimates are generated for general fitness, wellness, and educational purposes only. They do not constitute medical nutrition therapy or personalized medical advice. Please consult a qualified physician or dietitian regarding specific dietary needs, allergies, or medical conditions.
        </div>
      </div>
    </div>
  );
}
