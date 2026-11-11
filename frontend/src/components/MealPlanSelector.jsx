"use client";

import { useState, useEffect, useCallback } from "react";
import { getSuggestedMealPlans } from "@/lib/api";
import styles from "./MealPlanSelector.module.css";

const AI_STEPS = [
  {
    step: "01",
    title: "Analyzing Targets",
    detail: "Evaluating calories, protein ratio, and fitness goals...",
  },
  {
    step: "02",
    title: "Filtering Diet",
    detail: "Matching cuisine preferences, restrictions, and budget tier...",
  },
  {
    step: "03",
    title: "Balancing Meals",
    detail: "Designing optimal portions for breakfast, lunch, and dinner...",
  },
  {
    step: "04",
    title: "Auditing Macros",
    detail: "Validating macro distribution and ingredient estimates...",
  },
  {
    step: "05",
    title: "Finalizing Plans",
    detail: "Polishing menus and recipes for selection...",
  },
];

export default function MealPlanSelector({ initialPlans, onSelectPlan, onBackToWizard, onClose }) {
  const [plans, setPlans] = useState(initialPlans?.plans || []);
  const [loading, setLoading] = useState(!initialPlans?.plans?.length);
  const [error, setError] = useState(null);
  const [selectingId, setSelectingId] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const loadMealPlans = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getSuggestedMealPlans();
      setPlans(data.plans || []);
    } catch (err) {
      setError(err.message || "Failed to load meal plans. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialPlans?.plans?.length) return;
    let ignore = false;
    async function load() {
      setError(null);
      try {
        const data = await getSuggestedMealPlans();
        if (!ignore) setPlans(data.plans || []);
      } catch (err) {
        if (!ignore) setError(err.message || "Failed to load meal plans. Please try again.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [initialPlans]);

  // Step sequencer interval during AI generation
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < AI_STEPS.length - 1 ? prev + 1 : prev));
    }, 3600);

    return () => {
      clearInterval(interval);
      setActiveStepIndex(0);
    };
  }, [loading]);

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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary, #E8A020)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              <path d="M5 3v4"/>
              <path d="M19 17v4"/>
              <path d="M3 5h4"/>
              <path d="M17 19h4"/>
            </svg>
          </div>

          <h2 className={styles.loadingTitle}>Generating Meal Plans</h2>
          <p className={styles.loadingSubtitle}>
            Optimizing portions, macro splits, and ingredient targets.
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
                      <span className={styles.stepNumberBadge}>{step.step}</span>
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
            Macro optimization usually takes 5–10 seconds
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.selectorOverlay}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E05252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "0.85rem", lineHeight: "1.4" }}>
            {error}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", marginTop: "0.5rem" }}>
            <button className={styles.retryBtn} onClick={loadMealPlans}>
              Retry Generation
            </button>
            {onBackToWizard && (
              <button
                className={styles.changeMetricsBtn}
                onClick={onBackToWizard}
                style={{ width: "100%" }}
              >
                ← Back
              </button>
            )}
            {onClose && (
              <button
                className={styles.changeMetricsBtn}
                onClick={onClose}
                style={{ width: "100%" }}
              >
                ✕ Close
              </button>
            )}
          </div>
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
            <h2 className={styles.title}>Choose Your Daily Meal Plan</h2>
            <p className={styles.subtitle}>
              Select the plan that best fits your daily routine and budget.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {onBackToWizard && (
              <button className={styles.changeMetricsBtn} onClick={onBackToWizard}>
                Edit Targets
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className={styles.changeMetricsBtn}
                onClick={onClose}
                aria-label="Close"
              >
                ✕ Close
              </button>
            )}
          </div>
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

                      {/* Bulleted Ingredients */}
                      {m.ingredients && m.ingredients.length > 0 ? (
                        <ul className={styles.ingredientsList}>
                          {m.ingredients.map((ing, ingIdx) => (
                            <li key={ingIdx} className={styles.ingredientItem}>
                              • {ing}
                            </li>
                          ))}
                        </ul>
                      ) : m.description ? (
                        <p className={styles.mealDesc}>{m.description}</p>
                      ) : null}

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
                  {isSelected ? "Activating Plan..." : "Activate Meal Plan"}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.legalDisclaimerBox}>
          <strong>Disclaimer:</strong> AI suggestions and macro estimates are for general wellness and educational purposes only, not medical advice. Consult a healthcare provider for clinical needs.
        </div>
      </div>
    </div>
  );
}
