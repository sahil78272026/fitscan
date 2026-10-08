"use client";

import { useState, useEffect } from "react";
import { getSuggestedMealPlans } from "@/lib/api";
import styles from "./MealPlanSelector.module.css";

const AI_STEPS = [
  {
    icon: "🎯",
    title: "Analyzing Nutrition Targets",
    detail: "Reading your daily calories, protein split, and fitness goal...",
  },
  {
    icon: "🥗",
    title: "Filtering Dietary Preferences",
    detail: "Matching cuisine styles, dietary restrictions, and budget tier...",
  },
  {
    icon: "🍳",
    title: "Balancing Daily Meals",
    detail: "Designing optimal portions for breakfast, lunch, and dinner...",
  },
  {
    icon: "💰",
    title: "Estimating Costs & Macros",
    detail: "Auditing ingredient pricing and macronutrient distribution...",
  },
  {
    icon: "✨",
    title: "Finalizing 3 Custom Plans",
    detail: "Polishing descriptions and recipes for your review...",
  },
];

export default function MealPlanSelector({ initialPlans, onSelectPlan, onBackToWizard }) {
  const [plans, setPlans] = useState(initialPlans?.plans || []);
  const [loading, setLoading] = useState(!initialPlans?.plans?.length);
  const [error, setError] = useState(null);
  const [selectingId, setSelectingId] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (!initialPlans?.plans?.length) {
      loadMealPlans();
    }
  }, [initialPlans]);

  // Step sequencer interval during AI generation
  useEffect(() => {
    if (!loading) {
      setActiveStepIndex(0);
      return;
    }
    setActiveStepIndex(0);
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < AI_STEPS.length - 1 ? prev + 1 : prev));
    }, 2400);

    return () => clearInterval(interval);
  }, [loading]);

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
    const progressPercent = Math.min(
      95,
      Math.round(((activeStepIndex + 1) / AI_STEPS.length) * 100)
    );

    return (
      <div className={styles.selectorOverlay}>
        <div className={styles.loadingContainer}>
          <div className={styles.aiGlowIconWrapper}>
            <div className={styles.aiGlowPulse} />
            <span className={styles.aiGlowEmoji}>✨</span>
          </div>

          <h2 className={styles.loadingTitle}>Crafting Your AI Meal Plans</h2>
          <p className={styles.loadingSubtitle}>
            Gemini is evaluating your target macros and local ingredient costs.
          </p>

          {/* Progress Bar */}
          <div className={styles.progressContainer}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>
                Step {activeStepIndex + 1} of {AI_STEPS.length}
              </span>
              <span className={styles.progressValue}>{progressPercent}%</span>
            </div>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Step Sequencer List */}
          <div className={styles.stepsList}>
            {AI_STEPS.map((step, idx) => {
              const isCompleted = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex;
              const isPending = idx > activeStepIndex;

              return (
                <div
                  key={step.title}
                  className={`${styles.stepItem} ${
                    isCompleted
                      ? styles.stepCompleted
                      : isCurrent
                      ? styles.stepActive
                      : styles.stepPending
                  }`}
                >
                  <div className={styles.stepStatusIcon}>
                    {isCompleted ? (
                      <span className={styles.checkIcon}>✓</span>
                    ) : isCurrent ? (
                      <span className={styles.stepMiniSpinner} />
                    ) : (
                      <span className={styles.pendingDot} />
                    )}
                  </div>

                  <div className={styles.stepContent}>
                    <div className={styles.stepTitleRow}>
                      <span className={styles.stepEmoji}>{step.icon}</span>
                      <span className={styles.stepTitleText}>{step.title}</span>
                    </div>
                    {isCurrent && (
                      <p className={styles.stepDetailText}>{step.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className={styles.loadingFooterNote}>
            ⏱️ High-precision macro calculation usually takes ~5–10 seconds
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
          ⚖️ <strong>Disclaimer:</strong> CoreControl AI meal suggestions and macro estimates are generated for general fitness, wellness, and educational purposes only. They do not constitute medical nutrition therapy or personalized medical advice. Please consult a qualified physician or dietitian regarding specific dietary needs, allergies, or medical conditions.
        </div>
      </div>
    </div>
  );
}
