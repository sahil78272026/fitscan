"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import ProgressRing from "@/components/ProgressRing";
import MacroProgressBar from "@/components/MacroProgressBar";
import MealInput from "@/components/MealInput";
import MealCard from "@/components/MealCard";
import DateStrip from "@/components/DateStrip";
import CalendarGrid from "@/components/CalendarGrid";
import OnboardingWizard from "@/components/OnboardingWizard";
import MealPlanSelector from "@/components/MealPlanSelector";
import MissedMealBanner from "@/components/MissedMealBanner";
import FloatingScanButton from "@/components/FloatingScanButton";
import {
  getDailySummary,
  logMeal,
  scanMealImage,
  deleteMeal,
  getCalendarMonth,
  getSettings,
  getAdherenceStats,
  updateUserGoals,
  getSuggestedMealPlans,
  selectMealPlan,
} from "@/lib/api";
import styles from "./page.module.css";

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(d1, d2) {
  return formatDateStr(d1) === formatDateStr(d2);
}

export default function Home() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [summary, setSummary] = useState(null);
  const [adherenceStats, setAdherenceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarData, setCalendarData] = useState(null);
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1);

  // Onboarding & Meal Plan State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);
  const [userSettings, setUserSettings] = useState(null);
  const [suggestedPlans, setSuggestedPlans] = useState(null);
  const [dateLoading, setDateLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [targetMealType, setTargetMealType] = useState(null);
  const hasCheckedOnboarding = useRef(false);
  const initialLoadedRef = useRef(false);
  const loadedCalendarMonthRef = useRef({ year: today.getFullYear(), month: today.getMonth() + 1 });

  const isToday = isSameDay(selectedDate, today);

  // Track window scroll for dynamic sticky header streak transition
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Redirect to login if not authenticated
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

  const fetchSummary = useCallback(async (date) => {
    try {
      const dateStr = formatDateStr(date);
      const data = await getDailySummary(dateStr);
      setSummary(data);
    } catch (err) {
      if (err.message?.includes("Session expired")) return;
      showToast("Failed to load data", "error");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const stats = await getAdherenceStats();
      setAdherenceStats(stats);
    } catch (err) {
      // Fail silently
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const settings = await getSettings();
      setUserSettings(settings);
      if (!hasCheckedOnboarding.current) {
        hasCheckedOnboarding.current = true;
        // Prompt wizard if brand new user without metrics or meal plan
        if (!settings?.height_cm || !settings?.weight_kg || !settings?.selected_meal_plan) {
          setWizardOpen(true);
        }
      }
    } catch (err) {
      // Fail silently
    }
  }, []);

  // Handle Wizard Complete -> Save goals & generate meal plans
  const handleWizardComplete = async (goalData) => {
    try {
      const updatedSettings = await updateUserGoals(goalData);
      setUserSettings(updatedSettings);
      setWizardOpen(false);

      // Open Plan Selector & fetch AI suggestions
      setPlanSelectorOpen(true);
      showToast("Metrics updated! Generating meal plans... ✨");

      const plansData = await getSuggestedMealPlans();
      setSuggestedPlans(plansData);
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
      fetchSummary(selectedDate);
    } catch (err) {
      showToast(err.message || "Failed to activate meal plan", "error");
    }
  };

  const fetchCalendar = useCallback(async (year, month) => {
    try {
      const data = await getCalendarMonth(year, month);
      setCalendarData((prev) => {
        const prevDays = prev?.days || [];
        const newDays = data?.days || [];
        const map = new Map();
        prevDays.forEach((d) => map.set(d.date, d));
        newDays.forEach((d) => map.set(d.date, d));
        return {
          ...data,
          days: Array.from(map.values()),
        };
      });
    } catch (err) {
      // Calendar is non-critical, fail silently
    }
  }, []);

  // Initial load: Fetch summary, stats, settings, and calendar once upon authentication
  useEffect(() => {
    if (isAuthenticated && !initialLoadedRef.current) {
      initialLoadedRef.current = true;
      setLoading(true);

      const d = selectedDate || today;
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const promises = [
        fetchSummary(selectedDate),
        fetchStats(),
        fetchSettings(),
        fetchCalendar(calendarYear, calendarMonth),
      ];

      // If current week spans across two months (e.g. Sep 28 - Oct 4), fetch both months so all dots display!
      const monYear = monday.getFullYear();
      const monMonth = monday.getMonth() + 1;
      const sunYear = sunday.getFullYear();
      const sunMonth = sunday.getMonth() + 1;
      if (monYear !== calendarYear || monMonth !== calendarMonth) {
        promises.push(fetchCalendar(monYear, monMonth));
      }
      if (sunYear !== calendarYear || sunMonth !== calendarMonth) {
        promises.push(fetchCalendar(sunYear, sunMonth));
      }

      Promise.all(promises).finally(() => setLoading(false));
    }
  }, [isAuthenticated, selectedDate, today, calendarYear, calendarMonth, fetchSummary, fetchStats, fetchSettings, fetchCalendar]);

  // When selectedDate changes: ONLY fetch daily summary (avoids calling 4 APIs & keeps DOM mounted)
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    setDateLoading(true);
    fetchSummary(selectedDate).finally(() => setDateLoading(false));

    // Silently refresh calendar only if date crosses into a different month
    const newYear = selectedDate.getFullYear();
    const newMonth = selectedDate.getMonth() + 1;
    if (newYear !== loadedCalendarMonthRef.current.year || newMonth !== loadedCalendarMonthRef.current.month) {
      loadedCalendarMonthRef.current = { year: newYear, month: newMonth };
      setCalendarYear(newYear);
      setCalendarMonth(newMonth);
      fetchCalendar(newYear, newMonth);
    }
  }, [selectedDate, fetchSummary, fetchCalendar]);

  const handleWeekChange = useCallback((newWeekDates) => {
    if (!newWeekDates || newWeekDates.length === 0) return;
    const firstDay = newWeekDates[0];
    const lastDay = newWeekDates[newWeekDates.length - 1];
    const m1 = firstDay.getMonth() + 1;
    const y1 = firstDay.getFullYear();
    const m2 = lastDay.getMonth() + 1;
    const y2 = lastDay.getFullYear();

    fetchCalendar(y1, m1);
    if (m1 !== m2 || y1 !== y2) {
      fetchCalendar(y2, m2);
    }
  }, [fetchCalendar]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setCalendarOpen(false);
  };

  const handleMonthChange = (year, month) => {
    loadedCalendarMonthRef.current = { year, month };
    setCalendarYear(year);
    setCalendarMonth(month);
    fetchCalendar(year, month);
  };

  const handleLogMeal = async (rawInput, mealType) => {
    setSubmitting(true);
    try {
      const dateStr = formatDateStr(selectedDate);
      await logMeal(rawInput, mealType, dateStr);
      await fetchSummary(selectedDate);
      await fetchStats();
      await fetchCalendar(calendarYear, calendarMonth);
      showToast("Meal logged & macros updated! 🎉");
    } catch (err) {
      showToast(err.message || "Failed to log meal", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanMealImage = async (imageFile, rawInput, mealType) => {
    setSubmitting(true);
    try {
      const dateStr = formatDateStr(selectedDate);
      await scanMealImage(imageFile, rawInput, mealType, dateStr);
      await fetchSummary(selectedDate);
      await fetchStats();
      await fetchCalendar(calendarYear, calendarMonth);
      showToast("Photo analyzed & meal logged! 📷✨");
    } catch (err) {
      showToast(err.message || "Failed to analyze food photo", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    try {
      await deleteMeal(mealId);
      await fetchSummary(selectedDate);
      await fetchStats();
      await fetchCalendar(calendarYear, calendarMonth);
      showToast("Meal removed");
    } catch (err) {
      showToast("Failed to delete meal", "error");
    }
  };

  const handleTriggerMealLog = (mealType) => {
    setTargetMealType(mealType);
    const inputEl = document.getElementById("meal-input");
    if (inputEl) {
      inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => inputEl.focus(), 300);
    }
  };

  const handleFloatingScanClick = () => {
    if (!isToday) {
      setSelectedDate(today);
    }
    const fileInput = document.getElementById("meal-file-input");
    if (fileInput) {
      fileInput.click();
    }
  };

  const dateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}>
          <img
            src="/corecontrol_logo.webp"
            alt="CoreControl"
            style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "cover", marginBottom: "0.25rem", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}
          />
          <div className={styles.loaderSpinner} />
          <span>Loading CoreControl...</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {/* Onboarding Wizard Modal for New Users */}
      {wizardOpen && (
        <OnboardingWizard
          initialSettings={userSettings}
          onComplete={handleWizardComplete}
          onCancel={() => setWizardOpen(false)}
        />
      )}

      {/* Meal Plan Selector Modal */}
      {planSelectorOpen && (
        <MealPlanSelector
          initialPlans={suggestedPlans}
          onSelectPlan={handleSelectMealPlan}
          onBackToWizard={() => {
            setPlanSelectorOpen(false);
            setWizardOpen(true);
          }}
        />
      )}

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.logo}>
              <img
                src="/corecontrol_logo.webp"
                alt="CoreControl"
                className={styles.logoImage}
              />
              CoreControl
            </h1>
            <p className={styles.date}>{dateLabel}</p>
          </div>
        </header>

        {/* Date Strip (Sticky weekly bar) */}
        <section className={styles.stickyDateSection}>
          <DateStrip
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            calendarData={calendarData}
            calendarOpen={calendarOpen}
            onToggleCalendar={() => setCalendarOpen(!calendarOpen)}
            adherenceStats={adherenceStats}
            isScrolled={isScrolled}
            onWeekChange={handleWeekChange}
          />
        </section>

        {/* Calendar Grid (expandable) */}
        {calendarOpen && (
          <section>
            <CalendarGrid
              year={calendarYear}
              month={calendarMonth}
              calendarData={calendarData}
              selectedDate={selectedDate}
              calendarGoal={summary?.calorie_goal || 2000}
              onDateSelect={handleDateSelect}
              onMonthChange={handleMonthChange}
            />
          </section>
        )}

        {/* Progress Ring & Segregated Macro Progress Bars */}
        {loading ? (
          <div className={styles.loader} style={{ height: "200px" }}>
            <div className={styles.loaderSpinner} />
          </div>
        ) : (
          <div className={styles.mainContent} style={{ opacity: dateLoading ? 0.65 : 1, transition: "opacity 0.2s ease" }}>
            {/* Compact Streak Badge */}
            {adherenceStats && (
              <Link
                href="/progress"
                className={styles.streakBadge}
                style={{
                  opacity: isScrolled ? 0 : 1,
                  transform: isScrolled ? "scale(0.95) translateY(-8px)" : "scale(1) translateY(0)",
                  pointerEvents: isScrolled ? "none" : "auto",
                  transition: "opacity 0.25s ease, transform 0.25s ease",
                }}
              >
                <span>🔥 <strong>{adherenceStats.current_streak}</strong> day streak</span>
                <span className={styles.streakDot}>•</span>
                <span>{adherenceStats.weekly_adherence_score}% weekly</span>
                <span className={styles.streakArrow}>→</span>
              </Link>
            )}

            <section className={styles.progressSection}>
              <ProgressRing
                consumed={summary?.total_calories || 0}
                goal={summary?.calorie_goal || 2000}
              />
              <MacroProgressBar summary={summary} />
            </section>

            {/* Missed Meal Alert Banner (Personalized, randomized, with planned macros) */}
            {isToday && (
              <MissedMealBanner
                user={user}
                userSettings={userSettings}
                summary={summary}
                isToday={isToday}
                onLogMeal={handleTriggerMealLog}
              />
            )}

            {/* Meal Input (Text or Image Scan) — only for today */}
            {isToday && (
              <section className={styles.section}>
                <MealInput
                  onSubmit={handleLogMeal}
                  onScanImage={handleScanMealImage}
                  isLoading={submitting}
                  recentItems={summary?.recent_items || []}
                  activeMealType={targetMealType}
                />
              </section>
            )}

            {/* Meals List */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {isToday ? "Today's Meals" : `Meals on ${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {dateLoading && (
                    <span className={styles.loadingPill}>Updating...</span>
                  )}
                  {summary?.meal_count > 0 && (
                    <span className={styles.mealCount}>
                      {summary.meal_count} meal{summary.meal_count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {summary?.meals?.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🍽️</span>
                  <p className={styles.emptyText}>
                    {isToday ? "No meals logged yet today" : "No meals logged on this day"}
                  </p>
                  {isToday && (
                    <p className={styles.emptyHint}>Scan a photo or type a meal above to track macros</p>
                  )}
                </div>
              ) : (
                <div className={styles.mealsList}>
                  {summary?.meals?.map((meal) => (
                    <MealCard key={meal.id} meal={meal} onDelete={isToday ? handleDeleteMeal : null} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {/* Floating Glowing Scan Food Photo FAB */}
      <FloatingScanButton
        onClick={handleFloatingScanClick}
        isLoading={submitting}
      />
    </main>
  );
}


