"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import GoalEditor from "@/components/GoalEditor";
import OnboardingWizard from "@/components/OnboardingWizard";
import MealPlanSelector from "@/components/MealPlanSelector";
import WeightChart from "@/components/WeightChart";
import ProUpgradeModal from "@/components/ProUpgradeModal";
import ConfirmPlanChangeModal from "@/components/ConfirmPlanChangeModal";
import {
  getSettings,
  updateUserGoals,
  updateCalorieGoal,
  getSuggestedMealPlans,
  selectMealPlan,
  logWeight,
  getWeightHistory,
} from "@/lib/api";
import styles from "./page.module.css";

export default function ProfilePage() {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const router = useRouter();

  const [userSettings, setUserSettings] = useState(null);
  const [weightHistory, setWeightHistory] = useState(null);
  const [timeframe, setTimeframe] = useState(30);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);
  const [confirmChangeModalOpen, setConfirmChangeModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [suggestedPlans, setSuggestedPlans] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const fetchWeightHistory = useCallback(async (days) => {
    try {
      const data = await getWeightHistory(days);
      setWeightHistory(data);
    } catch (err) {
      // Fail silently for weight history
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await getSettings();
      setUserSettings(settings);
    } catch (err) {
      showToast("Failed to load profile settings", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
      fetchWeightHistory(timeframe);
    }
  }, [isAuthenticated, fetchSettings, fetchWeightHistory, timeframe]);

  // Handle Wizard Complete -> Save goals & generate meal plans
  const handleWizardComplete = async (goalData) => {
    try {
      const updatedSettings = await updateUserGoals(goalData);
      setUserSettings(updatedSettings);
      setWizardOpen(false);

      const isProUser = (updatedSettings?.subscription_tier || "free").toLowerCase() === "pro";
      const canChange = updatedSettings?.can_change_plan !== false || !updatedSettings?.selected_meal_plan;

      if (isProUser || canChange) {
        // Open Plan Selector & fetch AI suggestions
        setPlanSelectorOpen(true);
        showToast("Metrics updated! Generating meal plans... ✨");

        const plansData = await getSuggestedMealPlans();
        setSuggestedPlans(plansData);
      } else {
        showToast("Body stats & macro targets updated! 🎯");
      }
    } catch (err) {
      showToast(err.message || "Failed to save goals", "error");
    }
  };

  // Handle Plan Selection -> Activate chosen plan
  const handleSelectMealPlan = async (chosenPlan) => {
    try {
      const updated = await selectMealPlan(chosenPlan);
      setUserSettings(updated);
      setPlanSelectorOpen(false);
      showToast(`Activated plan: ${chosenPlan.title}! 🎯`);
    } catch (err) {
      showToast(err.message || "Failed to activate meal plan", "error");
    }
  };

  // Handle Quick Calorie Goal Update
  const handleUpdateCalorieGoal = async (newGoal) => {
    try {
      await updateCalorieGoal(newGoal);
      await fetchSettings();
      showToast("Calorie goal updated! 🎯");
    } catch (err) {
      showToast("Failed to update calorie goal", "error");
    }
  };

  const isPro = (userSettings?.subscription_tier || "free").toLowerCase() === "pro";

  const handleOpenPlanSelector = () => {
    // If on cooldown on free tier, prompt pro upgrade modal directly!
    if (!isPro && userSettings && userSettings.can_change_plan === false) {
      setUpgradeModalOpen(true);
      return;
    }

    // Require confirmation alert modal before executing expensive Gemini AI call
    setConfirmChangeModalOpen(true);
  };

  const handleConfirmPlanChange = () => {
    setConfirmChangeModalOpen(false);
    setSuggestedPlans(null); // Clear previous cache so fresh plans are generated
    setPlanSelectorOpen(true);
  };

  const handleOpenWizard = () => {
    // If on cooldown on free tier, guide user with pro upgrade modal
    if (!isPro && userSettings && userSettings.can_change_plan === false) {
      setUpgradeModalOpen(true);
      return;
    }
    setWizardOpen(true);
  };

  const handleLogWeight = async (weightKg) => {
    try {
      await logWeight(weightKg);
      await fetchSettings();
      await fetchWeightHistory(timeframe);
      showToast("Weight logged successfully! ⚖️");
    } catch (err) {
      showToast(err.message || "Failed to log weight", "error");
    }
  };

  const handleTimeframeChange = (days) => {
    setTimeframe(days);
    fetchWeightHistory(days);
  };

  if (authLoading || loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}>
          <div className={styles.loaderSpinner} />
          <span>Loading Profile...</span>
        </div>
      </main>
    );
  }

  const selectedPlan = userSettings?.selected_meal_plan;

  return (
    <main className={styles.main}>
      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Onboarding Wizard Modal */}
      {wizardOpen && (
        <OnboardingWizard
          initialSettings={userSettings}
          onComplete={handleWizardComplete}
          onCancel={() => setWizardOpen(false)}
        />
      )}

      {/* Confirm Meal Plan Change Alert Modal */}
      <ConfirmPlanChangeModal
        isOpen={confirmChangeModalOpen}
        onClose={() => setConfirmChangeModalOpen(false)}
        onConfirm={handleConfirmPlanChange}
        currentPlan={selectedPlan}
        isPro={isPro}
      />

      {/* Meal Plan Selector Modal */}
      {planSelectorOpen && (
        <MealPlanSelector
          initialPlans={suggestedPlans}
          onSelectPlan={handleSelectMealPlan}
          onBackToWizard={() => {
            setPlanSelectorOpen(false);
            setWizardOpen(true);
          }}
          onClose={() => setPlanSelectorOpen(false)}
        />
      )}

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>👤 Profile & Goals</h1>
        </header>

        {/* User Card */}
        <section className={styles.userCard}>
          <div className={styles.avatar}>
            {(user?.name || user?.email || user?.phone || "U")[0].toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userTopRow}>
              <h2 className={styles.userName}>{user?.name || "CoreControl User"}</h2>
              {isPro ? (
                <span className={styles.proBadgePill}>👑 PRO MEMBER</span>
              ) : (
                <button
                  type="button"
                  className={styles.upgradeHeaderBtn}
                  onClick={() => setUpgradeModalOpen(true)}
                >
                  ⭐ Free Tier • Upgrade
                </button>
              )}
            </div>
            <p className={styles.userPhone}>{user?.email || user?.phone || "Account Active"}</p>
          </div>
        </section>

        {/* Active Selected Meal Plan Section */}
        <section className={styles.activePlanCard}>
          <div className={styles.planHeader}>
            <div>
              <div className={styles.planBadgeRow}>
                <span className={styles.planBadge}>Active Meal Plan</span>
                {isPro ? (
                  <span className={styles.rotationBadgePro}>👑 Pro • Unlimited Rotations</span>
                ) : userSettings?.can_change_plan ? (
                  <span className={styles.rotationBadgeReady}>🟢 1 Free Rotation Available</span>
                ) : (
                  <span className={styles.rotationBadgeCooldown}>
                    ⏳ Free rotation cooldown: {userSettings?.days_until_next_plan_change || 1}d left
                  </span>
                )}
              </div>
              <h3 className={styles.planTitle}>
                {selectedPlan?.title || "No Meal Plan Selected"}
              </h3>
              <p className={styles.planTagline}>
                {selectedPlan?.tagline || "Configure your onboarding goals to generate AI meal plans"}
              </p>
            </div>
          </div>

          {selectedPlan && (
            <div className={styles.macroPills}>
              <div className={styles.macroPill}>
                Target: <strong>{userSettings?.calorie_goal || selectedPlan.daily_calories} kcal</strong>
              </div>
              <div className={styles.macroPill}>
                Protein: <strong>{userSettings?.protein_goal || selectedPlan.protein_g}g</strong>
              </div>
              <div className={styles.macroPill}>
                Carbs: <strong>{userSettings?.carbs_goal || selectedPlan.carbs_g}g</strong>
              </div>
              <div className={styles.macroPill}>
                Fat: <strong>{userSettings?.fat_goal || selectedPlan.fat_g}g</strong>
              </div>
            </div>
          )}

          <div className={styles.actionBtnRow}>
            {selectedPlan && (
              <Link href="/meal-plan" className={styles.primaryBtn} style={{ textDecoration: "none", textAlign: "center" }}>
                📖 View Full Meal Plan Schedule →
              </Link>
            )}
            <button className={selectedPlan ? styles.secondaryBtn : styles.primaryBtn} onClick={handleOpenPlanSelector}>
              🔄 {selectedPlan ? (
                !isPro && userSettings && userSettings.can_change_plan === false
                  ? `Rotate Plan (${userSettings.days_until_next_plan_change}d cooldown) 👑`
                  : "Change Meal Plan"
              ) : "Generate Meal Plans"}
            </button>
            <button className={styles.secondaryBtn} onClick={handleOpenWizard}>
              ⚙️ {!isPro && userSettings?.can_change_plan === false
                ? `Recalibrate Goals & Plan (${userSettings.days_until_next_plan_change}d cooldown) 🔒`
                : "Recalibrate Goals & Meal Plan"}
            </button>
            {!isPro && userSettings?.can_change_plan === false && (
              <div className={styles.cooldownInlineHint}>
                🔒 <strong>7-Day Plan Cycle Active:</strong> Your meal plan and daily macro targets work as a synchronized unit. You can recalibrate both together in <strong>{userSettings.days_until_next_plan_change || 1} day(s)</strong> (or upgrade to CoreControl Pro to recalibrate anytime). Daily weight can be logged anytime in the <Link href="/progress" style={{ color: "#fbbf24", textDecoration: "underline", fontWeight: "600" }}>Progress</Link> tab.
              </div>
            )}
            {!isPro && (
              <button
                type="button"
                className={styles.proPerksBtn}
                onClick={() => setUpgradeModalOpen(true)}
              >
                👑 Unlock Unlimited Plan Rotations with Pro
              </button>
            )}
          </div>
        </section>

        {/* User Physical Metrics & Preferences */}
        <section>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>📋 Personal Metrics & Preferences</h3>
          </div>

          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Goal Type</span>
              <span className={styles.metricValue}>
                {(userSettings?.goal_type || "fat_loss").replace("_", " ").toUpperCase()}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Diet Type</span>
              <span className={styles.metricValue}>
                {(userSettings?.diet_type || "veg").replace("_", " ").toUpperCase()}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Budget Tier</span>
              <span className={styles.metricValue}>
                {(userSettings?.budget_tier || "moderate").replace("_", " ").toUpperCase()}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Current Weight</span>
              <span className={styles.metricValue}>
                {weightHistory?.current_weight !== null && weightHistory?.current_weight !== undefined
                  ? `${weightHistory.current_weight} kg`
                  : userSettings?.weight_kg
                  ? `${userSettings.weight_kg} kg`
                  : "Not Set"}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Height</span>
              <span className={styles.metricValue}>
                {userSettings?.height_cm ? `${userSettings.height_cm} cm` : "Not Set"}
              </span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Activity</span>
              <span className={styles.metricValue}>
                {(userSettings?.activity_level || "moderate").replace("_", " ").toUpperCase()}
              </span>
            </div>
          </div>
        </section>

        {/* Goal Quick Edit */}
        <section>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>🎯 Quick Calorie Goal Target</h3>
          </div>
          <div style={{ background: "var(--color-surface)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
            <GoalEditor
              currentGoal={userSettings?.calorie_goal || 2000}
              onUpdate={handleUpdateCalorieGoal}
            />
          </div>
        </section>

        {/* Account Management & Logout */}
        <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
          <button className={styles.logoutBtn} onClick={logout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout of Account
          </button>
        </section>
      </div>

      {/* CoreControl Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentTier={userSettings?.subscription_tier || "free"}
        daysRemaining={userSettings?.days_until_next_plan_change || 0}
        onSuccess={(updated) => {
          setUserSettings(updated);
          showToast(
            updated.subscription_tier === "pro"
              ? "Welcome to CoreControl Pro! 👑 Unlimited rotations unlocked."
              : "Switched to Free tier."
          );
        }}
      />
    </main>
  );
}
