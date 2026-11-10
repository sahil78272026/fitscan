"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import GoalEditor from "@/components/GoalEditor";
import OnboardingWizard from "@/components/OnboardingWizard";
import MealPlanSelector from "@/components/MealPlanSelector";
import WeightChart from "@/components/WeightChart";
import ConfirmPlanChangeModal from "@/components/ConfirmPlanChangeModal";
import ProUpgradeModal from "@/components/ProUpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import {
  getSettings,
  updateUserGoals,
  updateCalorieGoal,
  getSuggestedMealPlans,
  selectMealPlan,
  logWeight,
  getWeightHistory,
  deleteAccount,
} from "@/lib/api";
import { auth } from "@/lib/firebase";
import { deleteUser } from "firebase/auth";
import styles from "./page.module.css";

export default function ProfilePage() {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const {
    hasAccess,
    isPro,
    isTrialActive,
    trialDaysRemaining,
    isPaywallOpen,
    openPaywall,
    closePaywall,
    refreshSubscription,
  } = useSubscription();
  const router = useRouter();

  const [userSettings, setUserSettings] = useState(null);
  const [weightHistory, setWeightHistory] = useState(null);
  const [timeframe, setTimeframe] = useState(30);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);
  const [confirmChangeModalOpen, setConfirmChangeModalOpen] = useState(false);
  const [suggestedPlans, setSuggestedPlans] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [deleting, setDeleting] = useState(false);

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
      const settings = await getSettings();
      setUserSettings(settings);
    } catch (err) {
      showToast("Failed to load profile settings", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let ignore = false;
    async function loadProfile() {
      try {
        const [settings, weightData] = await Promise.all([
          getSettings(),
          getWeightHistory(timeframe),
        ]);
        if (!ignore) {
          setUserSettings(settings);
          setWeightHistory(weightData);
        }
      } catch (err) {
        showToast("Failed to load profile settings", "error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, timeframe]);

  // Handle Wizard Complete -> Save goals & generate meal plans
  const handleWizardComplete = async (goalData) => {
    try {
      const updatedSettings = await updateUserGoals(goalData);
      setUserSettings(updatedSettings);
      setWizardOpen(false);

      if (!hasAccess) {
        openPaywall("plan_change");
        return;
      }

      // Open Plan Selector & fetch AI suggestions
      setPlanSelectorOpen(true);
      showToast("Metrics updated! Generating meal plans...");

      const plansData = await getSuggestedMealPlans();
      setSuggestedPlans(plansData);
    } catch (err) {
      if (err.status === 402 || err.code === "TRIAL_EXPIRED") {
        setWizardOpen(false);
        openPaywall("plan_change");
        return;
      }
      showToast(err.message || "Failed to save goals", "error");
    }
  };

  // Handle Plan Selection -> Activate chosen plan
  const handleSelectMealPlan = async (chosenPlan) => {
    try {
      const updated = await selectMealPlan(chosenPlan);
      setUserSettings(updated);
      setPlanSelectorOpen(false);
      showToast(`Activated plan: ${chosenPlan.title}`);
    } catch (err) {
      if (err.status === 402 || err.code === "TRIAL_EXPIRED") {
        setPlanSelectorOpen(false);
        openPaywall("trial_expired");
        return;
      }
      showToast(err.message || "Failed to activate meal plan", "error");
    }
  };

  // Handle Quick Calorie Goal Update
  const handleUpdateCalorieGoal = async (newGoal) => {
    try {
      await updateCalorieGoal(newGoal);
      await fetchSettings();
      showToast("Calorie goal updated");
    } catch (err) {
      showToast("Failed to update calorie goal", "error");
    }
  };

  // Handle Permanent Account & Data Deletion
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account?\n\nThis will immediately and permanently erase all your meal logs, weight records, food photos, and personal targets. This action cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      // 1. Delete from PostgreSQL
      await deleteAccount();

      // 2. Delete from Firebase Auth
      if (auth?.currentUser) {
        try {
          await deleteUser(auth.currentUser);
        } catch (fbErr) {
          console.warn("Firebase Auth deletion error:", fbErr);
        }
      }

      showToast("Account and data permanently deleted.");
      setTimeout(() => {
        logout();
      }, 1000);
    } catch (err) {
      showToast(err.message || "Failed to delete account", "error");
      setDeleting(false);
    }
  };

  const handleOpenPlanSelector = () => {
    if (!hasAccess) {
      openPaywall("plan_change");
      return;
    }
    if (userSettings && userSettings.can_change_plan === false) {
      const hours = userSettings.hours_until_next_plan_change || 1;
      showToast(`Meal plans can be updated once every 24 hours. Next change available in ${hours} hour(s).`, "info");
      return;
    }
    // Require confirmation alert modal before executing Gemini AI call
    setConfirmChangeModalOpen(true);
  };

  const handleConfirmPlanChange = () => {
    if (!hasAccess) {
      setConfirmChangeModalOpen(false);
      openPaywall("plan_change");
      return;
    }
    setConfirmChangeModalOpen(false);
    setSuggestedPlans(null); // Clear previous cache so fresh plans are generated
    setPlanSelectorOpen(true);
  };

  const handleOpenWizard = () => {
    setWizardOpen(true);
  };

  const handleLogWeight = async (weightKg) => {
    try {
      await logWeight(weightKg);
      await fetchSettings();
      await fetchWeightHistory(timeframe);
      showToast("Weight logged successfully");
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
          <h1 className={styles.pageTitle}>Profile & Goals</h1>
        </header>

        {/* User Card */}
        <section className={styles.userCard}>
          <div className={styles.avatar}>
            {(user?.name || user?.email || user?.phone || "U")[0].toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userTopRow}>
              <h2 className={styles.userName}>{user?.name || "CoreControl User"}</h2>
            </div>
            <p className={styles.userPhone}>{user?.email || user?.phone || "Account Active"}</p>

            {/* Subscription & Trial Status Badge */}
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.65rem",
                  borderRadius: "999px",
                  border: isPro
                    ? "1px solid rgba(232, 160, 32, 0.45)"
                    : isTrialActive
                    ? "1px solid rgba(123, 160, 91, 0.45)"
                    : "1px solid rgba(199, 80, 47, 0.45)",
                  background: isPro
                    ? "rgba(232, 160, 32, 0.12)"
                    : isTrialActive
                    ? "rgba(123, 160, 91, 0.12)"
                    : "rgba(199, 80, 47, 0.12)",
                  color: isPro ? "#E8A020" : isTrialActive ? "#7BA05B" : "#C7502F",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                {isPro
                  ? "Pro Member"
                  : isTrialActive
                  ? `Free Trial: ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} remaining`
                  : "Trial Expired"}
              </span>

              {!isPro && (
                <button
                  type="button"
                  onClick={() => openPaywall("profile")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-primary, #E8A020)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: "0",
                  }}
                >
                  Upgrade to Pro →
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Active Selected Meal Plan Section */}
        <section className={styles.activePlanCard}>
          <div className={styles.planHeader}>
            <div>
              <div className={styles.planBadgeRow}>
                <span className={styles.planBadge}>Active Meal Plan</span>
                {userSettings?.can_change_plan === false && (
                  <span
                    className={styles.planBadge}
                    style={{
                      background: "rgba(234, 88, 12, 0.15)",
                      color: "#fb923c",
                      borderColor: "rgba(234, 88, 12, 0.35)",
                    }}
                  >
                    Next change in {userSettings.hours_until_next_plan_change || 1}h
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
                View Full Meal Plan Schedule →
              </Link>
            )}
            <button className={selectedPlan ? styles.secondaryBtn : styles.primaryBtn} onClick={handleOpenPlanSelector}>
              {selectedPlan ? (
                userSettings?.can_change_plan === false
                  ? `Change Plan (${userSettings.hours_until_next_plan_change || 1}h cooldown)`
                  : "Change Meal Plan"
              ) : "Generate Meal Plans"}
            </button>
            <button className={styles.secondaryBtn} onClick={handleOpenWizard}>
              Recalibrate Goals & Meal Plan
            </button>
          </div>
        </section>

        {/* User Physical Metrics & Preferences */}
        <section>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Personal Metrics & Preferences</h3>
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
            <h3 className={styles.sectionTitle}>Quick Calorie Goal Target</h3>
          </div>
          <div style={{ background: "var(--color-surface)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
            <GoalEditor
              currentGoal={userSettings?.calorie_goal || 2000}
              onUpdate={handleUpdateCalorieGoal}
            />
          </div>
        </section>

        {/* Account Management, Logout & Deletion */}
        <section style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "flex-start" }}>
          <button className={styles.logoutBtn} onClick={logout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout of Account
          </button>

          <button
            className={styles.deleteAccountBtn}
            onClick={handleDeleteAccount}
            disabled={deleting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            {deleting ? "Permanently Deleting..." : "Delete Account & All Data"}
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
            Permanently erases all meals, macro history, weight logs, and personal metrics.
          </span>
        </section>
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
