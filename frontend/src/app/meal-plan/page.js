"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getSettings, selectMealPlan, swapMealPlan } from "@/lib/api";
import ProUpgradeModal from "@/components/ProUpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import styles from "./page.module.css";

const MEAL_TYPE_ICONS = {
  Breakfast: "•",
  Lunch: "•",
  Snack: "•",
  Dinner: "•",
};

export default function MealPlanPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    hasAccess,
    isPro,
    trialDaysRemaining,
    isPaywallOpen,
    openPaywall,
    closePaywall,
    refreshSubscription,
  } = useSubscription();
  const router = useRouter();

  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Drag-and-Drop and Swapping State
  const [draggedMealIndex, setDraggedMealIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [swapMenuOpenIndex, setSwapMenuOpenIndex] = useState(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [expandedRecipes, setExpandedRecipes] = useState(new Set());
  const [toast, setToast] = useState(null);

  const selectedPlan = userSettings?.selected_meal_plan;

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchSettings = useCallback(async () => {
    try {
      const settings = await getSettings();
      setUserSettings(settings);
    } catch (err) {
      // Fail silently or handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ignore = false;
    async function load() {
      try {
        const settings = await getSettings();
        if (!ignore) setUserSettings(settings);
      } catch (err) {
        // Fail silently
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  // Determine meal priority tier for differentiated visual hierarchy
  const getMealPriority = (meal) => {
    if (meal.priority) {
      const p = String(meal.priority).toLowerCase();
      if (p === "high" || p === "recovery") return "high";
      if (p === "low" || p === "snack") return "low";
      return "medium";
    }

    const type = (meal.meal_type || "").toLowerCase();
    const protein = Number(meal.protein) || 0;
    const calories = Number(meal.calories) || 0;

    // High Priority: Main recovery / high protein anchor (Dinner, protein >= 35g, or calories >= 550)
    if (type === "dinner" || protein >= 35 || calories >= 550) {
      return "high";
    }

    // Low Priority: Light snacks or mini-fuel
    if (type === "snack" || calories < 300) {
      return "low";
    }

    // Medium Priority: Balanced staples (e.g. Breakfast, Lunch)
    return "medium";
  };

  // Execute meal slot swapping (persisting to React state immediately and backend)
  const executeSwap = async (sourceIndex, targetIndex) => {
    if (!hasAccess) {
      setSwapMenuOpenIndex(null);
      openPaywall("swap_meal");
      return;
    }

    if (!selectedPlan?.meals || !selectedPlan.meals[sourceIndex] || !selectedPlan.meals[targetIndex]) return;
    if (sourceIndex === targetIndex) {
      setSwapMenuOpenIndex(null);
      return;
    }

    const currentMeals = selectedPlan.meals;
    const sourceMeal = currentMeals[sourceIndex];
    const targetMeal = currentMeals[targetIndex];

    const sourceMealType = sourceMeal.meal_type;
    const targetMealType = targetMeal.meal_type;

    // Build swapped meals: the dishes exchange slots, adopting the destination slot's meal_type
    const updatedMeals = [...currentMeals];
    updatedMeals[sourceIndex] = {
      ...targetMeal,
      meal_type: sourceMealType,
    };
    updatedMeals[targetIndex] = {
      ...sourceMeal,
      meal_type: targetMealType,
    };

    const updatedPlan = {
      ...selectedPlan,
      meals: updatedMeals,
    };

    // Optimistically update React state immediately
    const prevSettings = userSettings;
    setUserSettings((prev) => ({
      ...prev,
      selected_meal_plan: updatedPlan,
    }));

    showToast(`Swapped ${sourceMealType} with ${targetMealType}`);
    setIsSwapping(true);
    setSwapMenuOpenIndex(null);

    try {
      // Sync to backend via dedicated swap endpoint or select fallback
      try {
        await swapMealPlan(sourceMealType, targetMealType, updatedPlan);
      } catch (err) {
        if (err.status === 402 || err.code === "TRIAL_EXPIRED") {
          throw err;
        }
        await selectMealPlan(updatedPlan);
      }
    } catch (err) {
      // Revert if remote persistence failed
      setUserSettings(prevSettings);
      if (err.status === 402 || err.code === "TRIAL_EXPIRED") {
        openPaywall("trial_expired");
        return;
      }
      showToast(err.message || "Failed to persist meal swap", "error");
    } finally {
      setIsSwapping(false);
    }
  };

  // Drag and drop event handlers
  const handleDragStart = (e, index) => {
    setDraggedMealIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDragLeave = (e, index) => {
    if (dropTargetIndex === index) {
      setDropTargetIndex(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedMealIndex(null);
    setDropTargetIndex(null);
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex =
      draggedMealIndex !== null
        ? draggedMealIndex
        : parseInt(e.dataTransfer.getData("text/plain"), 10);

    setDraggedMealIndex(null);
    setDropTargetIndex(null);

    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    await executeSwap(sourceIndex, targetIndex);
  };

  // Toggle collapsible recipe details
  const toggleRecipe = (index) => {
    setExpandedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleDownloadMealPlan = () => {
    if (!selectedPlan) return;
    window.print();
  };

  const handleDownloadTextPlan = () => {
    if (!selectedPlan) return;
    const goal = (userSettings?.goal_type || "fat_loss").replace("_", " ").toUpperCase();
    const diet = (userSettings?.diet_type || "veg").toUpperCase();
    const calories = selectedPlan.daily_calories || userSettings?.calorie_goal || 2000;
    const protein = selectedPlan.protein_g || userSettings?.protein_goal || 150;
    const carbs = selectedPlan.carbs_g || userSettings?.carbs_goal || 200;
    const fat = selectedPlan.fat_g || userSettings?.fat_goal || 65;

    let content = `========================================\n`;
    content += ` CORECONTROL - MASTER NUTRITION BLUEPRINT\n`;
    content += `========================================\n\n`;
    content += `Plan Title: ${selectedPlan.title || "Custom AI Plan"}\n`;
    content += `Goal: ${goal} | Diet: ${diet}\n`;
    content += `Daily Targets: ${calories} kcal | ${protein}g Protein | ${carbs}g Carbs | ${fat}g Fat\n`;
    if (selectedPlan.estimated_cost) {
      content += `Estimated Cost: ${selectedPlan.estimated_cost}\n`;
    }
    content += `\n----------------------------------------\n`;
    content += ` MEAL SCHEDULE & INGREDIENTS\n`;
    content += `----------------------------------------\n\n`;

    (selectedPlan.meals || []).forEach((m, idx) => {
      content += `${idx + 1}. [${m.meal_type.toUpperCase()}] ${m.dish_name} (${m.calories} kcal)\n`;
      content += `   Macros: ${m.protein}g P | ${m.carbs}g C | ${m.fat}g F\n`;
      if (m.ingredients && m.ingredients.length > 0) {
        content += `   Ingredients:\n`;
        m.ingredients.forEach((ing) => {
          content += `    • ${ing}\n`;
        });
      } else if (m.description) {
        content += `   Notes: ${m.description}\n`;
      }
      content += `\n`;
    });

    content += `========================================\n`;
    content += `Generated with FitScan • www.fitscan.ai\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FitScan-MasterBlueprint-${selectedPlan.title ? selectedPlan.title.replace(/\s+/g, "_") : "Daily"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (authLoading || loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}>
          <div className={styles.loaderSpinner} />
          <span>Loading Nutrition Blueprint...</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Floating Toast Notification */}
        {toast && (
          <div
            className={`${styles.toast} ${
              toast.type === "error" ? styles.toastError : styles.toastSuccess
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Meal Schedule</h1>
            <p className={styles.pageSubtitle}>
              Interactive nutrition blueprint with drag-and-drop slot swapping
            </p>
          </div>
        </header>

        {!selectedPlan ? (
          /* Empty State if no meal plan active */
          <div className={styles.emptyCard}>
            <h2 className={styles.emptyTitle}>No Active Meal Plan Selected</h2>
            <p className={styles.emptyText}>
              Complete your onboarding metrics and select an AI-generated meal plan to view your full daily nutrition schedule.
            </p>
            <Link href="/profile" className={styles.primaryBtn}>
              Go to Profile & Select Meal Plan
            </Link>
          </div>
        ) : (
          <>
            {/* MASTER BLUEPRINT CONTAINER (Distinct from individual meal cards below) */}
            <section className={styles.blueprintContainer}>
              <div className={styles.blueprintHeaderRow}>
                <div className={styles.blueprintBadgeGroup}>
                  <span className={styles.blueprintArchitectBadge}>
                    MASTER NUTRITION BLUEPRINT
                  </span>
                  <span className={styles.activePlanBadge}>
                    Active Plan
                  </span>
                  {userSettings?.can_change_plan === false && (
                    <span className={styles.cooldownBadge}>
                      Next change in {userSettings.hours_until_next_plan_change || 1}h
                    </span>
                  )}
                </div>

                <div className={styles.blueprintMetaPills}>
                  <span className={styles.metaPill}>
                    {(userSettings?.goal_type || "fat_loss").replace("_", " ").toUpperCase()}
                  </span>
                  <span className={styles.metaPill}>
                    {(userSettings?.diet_type || "veg").toUpperCase()}
                  </span>
                  <span className={styles.metaPill}>
                    {(userSettings?.budget_tier || "moderate").replace("_", " ").toUpperCase()}
                  </span>
                  {selectedPlan.estimated_cost && (
                    <span className={`${styles.metaPill} ${styles.costMetaPill}`}>
                      {selectedPlan.estimated_cost}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.blueprintTitleArea}>
                <h2 className={styles.blueprintTitle}>
                  {selectedPlan.title || "Personalized AI Nutrition Blueprint"}
                </h2>
                <p className={styles.blueprintTagline}>
                  {selectedPlan.tagline || "Architected specifically to hit your target calories and macro ratios."}
                </p>
              </div>

              {/* Master Telemetry Grid: Target Specifications */}
              <div className={styles.telemetryGrid}>
                <div className={`${styles.telemetryCard} ${styles.caloriesTelemetry}`}>
                  <div className={styles.telemetryTop}>
                    <span className={styles.telemetryLabel}>Daily Calories</span>
                  </div>
                  <span className={styles.telemetryValue}>
                    {selectedPlan.daily_calories || userSettings?.calorie_goal} <small>kcal</small>
                  </span>
                  <div className={styles.telemetryBar}>
                    <div className={styles.telemetryFillCalories} style={{ width: "100%" }} />
                  </div>
                </div>

                <div className={`${styles.telemetryCard} ${styles.proteinTelemetry}`}>
                  <div className={styles.telemetryTop}>
                    <span className={styles.telemetryLabel}>Target Protein</span>
                  </div>
                  <span className={styles.telemetryValue}>
                    {selectedPlan.protein_g || userSettings?.protein_goal} <small>g</small>
                  </span>
                  <div className={styles.telemetryBar}>
                    <div className={styles.telemetryFillProtein} style={{ width: "100%" }} />
                  </div>
                </div>

                <div className={`${styles.telemetryCard} ${styles.carbsTelemetry}`}>
                  <div className={styles.telemetryTop}>
                    <span className={styles.telemetryLabel}>Target Carbs</span>
                  </div>
                  <span className={styles.telemetryValue}>
                    {selectedPlan.carbs_g || userSettings?.carbs_goal} <small>g</small>
                  </span>
                  <div className={styles.telemetryBar}>
                    <div className={styles.telemetryFillCarbs} style={{ width: "100%" }} />
                  </div>
                </div>

                <div className={`${styles.telemetryCard} ${styles.fatTelemetry}`}>
                  <div className={styles.telemetryTop}>
                    <span className={styles.telemetryLabel}>Target Fat</span>
                  </div>
                  <span className={styles.telemetryValue}>
                    {selectedPlan.fat_g || userSettings?.fat_goal} <small>g</small>
                  </span>
                  <div className={styles.telemetryBar}>
                    <div className={styles.telemetryFillFat} style={{ width: "100%" }} />
                  </div>
                </div>
              </div>

              {/* Pro-Tip Reorder & Swap Banner */}
              <div className={styles.swapHintBanner}>
                <span className={styles.swapHintText}>
                  <strong>Drag & Drop to Swap Slots:</strong> Grab any meal card by the <code>⠿</code> handle to swap its slot (e.g. Breakfast ⇄ Lunch), or tap <strong>⇄ Swap Slot</strong> for 1-click reordering.
                </span>
              </div>
            </section>

            {/* DAILY MEAL SCHEDULE SECTION: INDIVIDUAL MEAL CARDS */}
            <section className={styles.scheduleSection}>
              <div className={styles.scheduleHeader}>
                <div className={styles.scheduleTitleGroup}>
                  <h3 className={styles.scheduleTitle}>
                    Scheduled Meal Courses
                  </h3>
                  <span className={styles.courseCountBadge}>
                    {selectedPlan.meals?.length || 0} Slots Configured
                  </span>
                </div>

                <div className={styles.downloadButtonGroup}>
                  <button
                    type="button"
                    className={styles.downloadBtn}
                    onClick={handleDownloadMealPlan}
                    title="Print or Save as PDF"
                  >
                    Export Blueprint PDF
                  </button>
                  <button
                    type="button"
                    className={styles.downloadTextBtn}
                    onClick={handleDownloadTextPlan}
                    title="Download as clean text file"
                  >
                    Text Plan
                  </button>
                </div>
              </div>

              {/* Meal Cards Container */}
              <div className={styles.mealsContainer}>
                {selectedPlan.meals && selectedPlan.meals.length > 0 ? (
                  selectedPlan.meals.map((meal, idx) => {
                    const icon = MEAL_TYPE_ICONS[meal.meal_type] || "•";
                    const priority = getMealPriority(meal);
                    const isDragging = draggedMealIndex === idx;
                    const isDropTarget = dropTargetIndex === idx && draggedMealIndex !== idx;
                    const isExpanded = expandedRecipes.has(idx);
                    const isSwapMenuOpen = swapMenuOpenIndex === idx;

                    // Compute priority-specific visual elements
                    let priorityBadgeText = "Balanced Staple";
                    let priorityClass = styles.cardPriorityMedium;

                    if (priority === "high") {
                      priorityBadgeText = "Main Recovery Anchor";
                      priorityClass = styles.cardPriorityHigh;
                    } else if (priority === "low") {
                      priorityBadgeText = "Light Fuel / Snack";
                      priorityClass = styles.cardPriorityLow;
                    }

                    return (
                      <div
                        key={idx}
                        className={`${styles.mealCard} ${priorityClass} ${
                          isDragging ? styles.isDragging : ""
                        } ${isDropTarget ? styles.dropTargetActive : ""}`}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragLeave={(e) => handleDragLeave(e, idx)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, idx)}
                      >
                        {/* Dropzone Overlay Highlight */}
                        {isDropTarget && (
                          <div className={styles.dropzoneOverlay}>
                            <span>⇣ Drop here to swap with {meal.meal_type}</span>
                          </div>
                        )}

                        {/* Top Meta Bar: Drag Handle, Meal Type, Priority Badge, Swap Action, Calorie Pill */}
                        <div className={styles.cardTopBar}>
                          <div className={styles.cardTopLeft}>
                            <div
                              className={styles.dragHandle}
                              title="Click and drag to swap meal slot"
                              aria-label="Drag handle"
                            >
                              ⠿
                            </div>
                            <span className={styles.mealTypeTag}>
                              {icon} {meal.meal_type}
                            </span>
                            <span className={styles.priorityBadge}>
                              {priorityBadgeText}
                            </span>
                          </div>

                          <div className={styles.cardTopRight}>
                            {/* Accessible Swap Button & Dropdown Fallback */}
                            <div className={styles.accessibleSwapWrapper}>
                              <button
                                type="button"
                                className={styles.swapSlotBtn}
                                onClick={() =>
                                  setSwapMenuOpenIndex(isSwapMenuOpen ? null : idx)
                                }
                                disabled={isSwapping}
                                title={`Swap ${meal.meal_type} with another meal slot`}
                              >
                                ⇄ Swap
                              </button>

                              {isSwapMenuOpen && (
                                <div className={styles.swapDropdownMenu}>
                                  <div className={styles.swapDropdownHeader}>
                                    Swap {meal.meal_type} with:
                                  </div>
                                  {selectedPlan.meals.map((targetM, targetIdx) => {
                                    if (targetIdx === idx) return null;
                                    return (
                                      <button
                                        key={targetIdx}
                                        type="button"
                                        className={styles.swapDropdownItem}
                                        onClick={() => executeSwap(idx, targetIdx)}
                                      >
                                        <span className={styles.swapDropdownIcon}>
                                          {MEAL_TYPE_ICONS[targetM.meal_type] || "•"}
                                        </span>
                                        <span className={styles.swapDropdownText}>
                                          <strong>{targetM.meal_type}</strong>: {targetM.dish_name}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <span className={styles.mealCalsPill}>
                              {meal.calories} kcal
                            </span>
                          </div>
                        </div>

                        {/* Concise Dish Summary & Glanceable Layout */}
                        <div className={styles.cardBody}>
                          <div className={styles.dishHeaderRow}>
                            <h4 className={styles.dishName}>{meal.dish_name}</h4>
                            {priority === "high" && (
                              <span className={styles.prominentProteinPill}>
                                {meal.protein}g Protein Anchor
                              </span>
                            )}
                          </div>

                          {/* Compact Key Ingredients Pills (Glanceable preview) */}
                          {meal.ingredients && meal.ingredients.length > 0 && (
                            <div className={styles.ingredientsPillsRow}>
                              {meal.ingredients.slice(0, 3).map((ing, iIdx) => (
                                <span key={iIdx} className={styles.ingredientPill}>
                                  {ing.split("(")[0].trim()}
                                </span>
                              ))}
                              {meal.ingredients.length > 3 && (
                                <span className={styles.ingredientMoreCount}>
                                  +{meal.ingredients.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Concise Macro Pills Row */}
                          <div className={styles.compactMacroRow}>
                            <div className={styles.macroPill}>
                              <span className={styles.macroPillLabel}>P:</span>
                              <strong>{meal.protein}g</strong>
                            </div>
                            <span className={styles.macroDivider}>•</span>
                            <div className={styles.macroPill}>
                              <span className={styles.macroPillLabel}>C:</span>
                              <strong>{meal.carbs}g</strong>
                            </div>
                            <span className={styles.macroDivider}>•</span>
                            <div className={styles.macroPill}>
                              <span className={styles.macroPillLabel}>F:</span>
                              <strong>{meal.fat}g</strong>
                            </div>

                            {/* Collapsible Recipe & Ingredient Details Toggle Button */}
                            <button
                              type="button"
                              className={styles.toggleRecipeBtn}
                              onClick={() => toggleRecipe(idx)}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? "Collapse Recipe ▴" : "View Recipe & Ingredients ▾"}
                            </button>
                          </div>

                          {/* Expandable Recipe & Complete Ingredient Details Drawer */}
                          {isExpanded && (
                            <div className={styles.expandedRecipeDrawer}>
                              {meal.description && (
                                <p className={styles.dishDescription}>
                                  {meal.description}
                                </p>
                              )}

                              {meal.ingredients && meal.ingredients.length > 0 && (
                                <div className={styles.detailedIngredientsBlock}>
                                  <span className={styles.ingredientsSectionTitle}>
                                    Itemized Ingredients & Portions:
                                  </span>
                                  <ul className={styles.detailedIngredientsList}>
                                    {meal.ingredients.map((ing, iIdx) => (
                                      <li key={iIdx} className={styles.detailedIngredientItem}>
                                        • {ing}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className={styles.emptyText}>No meal items listed in this plan.</p>
                )}
              </div>
            </section>

            {/* Bottom Action Row */}
            <section className={styles.actionRow}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleDownloadMealPlan}
              >
                Export Complete Plan
              </button>
              <Link href="/profile" className={styles.primaryBtn}>
                Change Plan in Profile
              </Link>
            </section>
          </>
        )}
      </div>

      {/* Hard Paywall Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={isPaywallOpen}
        onClose={closePaywall}
        daysRemaining={trialDaysRemaining}
        currentTier={isPro ? "pro" : "free"}
        onSuccess={() => {
          refreshSubscription();
          fetchSettings();
        }}
      />
    </main>
  );
}
