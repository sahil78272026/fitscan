"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import ProgressRing from "@/components/ProgressRing";
import MacroProgressBar from "@/components/MacroProgressBar";
import MealInput from "@/components/MealInput";
import MealCard from "@/components/MealCard";
import DateStrip from "@/components/DateStrip";
import CalendarGrid from "@/components/CalendarGrid";
import AdherenceWidget from "@/components/AdherenceWidget";
import {
  getDailySummary,
  logMeal,
  scanMealImage,
  deleteMeal,
  getCalendarMonth,
  getSettings,
  getAdherenceStats,
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
  const { isAuthenticated, loading: authLoading } = useAuth();
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

  const isToday = isSameDay(selectedDate, today);

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
      await getSettings();
    } catch (err) {
      // Fail silently
    }
  }, []);

  const fetchCalendar = useCallback(async (year, month) => {
    try {
      const data = await getCalendarMonth(year, month);
      setCalendarData(data);
    } catch (err) {
      // Calendar is non-critical, fail silently
    }
  }, []);

  // Fetch summary, stats, and settings when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      Promise.all([fetchSummary(selectedDate), fetchStats(), fetchSettings()]).finally(() => setLoading(false));
    }
  }, [selectedDate, isAuthenticated, fetchSummary, fetchStats, fetchSettings]);

  // Fetch calendar data for current month
  useEffect(() => {
    if (isAuthenticated) {
      fetchCalendar(calendarYear, calendarMonth);
    }
  }, [calendarYear, calendarMonth, isAuthenticated, fetchCalendar]);

  // Also refresh calendar when the selected date's month changes
  useEffect(() => {
    const newYear = selectedDate.getFullYear();
    const newMonth = selectedDate.getMonth() + 1;
    if (newYear !== calendarYear || newMonth !== calendarMonth) {
      setCalendarYear(newYear);
      setCalendarMonth(newMonth);
    }
  }, [selectedDate]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setCalendarOpen(false);
  };

  const handleMonthChange = (year, month) => {
    setCalendarYear(year);
    setCalendarMonth(month);
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

  const dateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}>
          <div className={styles.loaderSpinner} />
          <span>Loading FitScan...</span>
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

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.logo}>
              <span className={styles.logoIcon}>🏋️</span>
              FitScan
            </h1>
            <p className={styles.date}>{dateLabel}</p>
          </div>
          <div className={styles.headerRight}>
            <Link href="/profile" className={styles.profileBtn} title="Profile & Settings">
              👤 Profile
            </Link>
          </div>
        </header>

        {/* Date Strip */}
        <section>
          <DateStrip
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            calendarData={calendarData}
            calendarOpen={calendarOpen}
            onToggleCalendar={() => setCalendarOpen(!calendarOpen)}
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
          <>
            <section>
              <AdherenceWidget stats={adherenceStats} />
            </section>

            <section className={styles.progressSection}>
              <ProgressRing
                consumed={summary?.total_calories || 0}
                goal={summary?.calorie_goal || 2000}
              />
              <MacroProgressBar summary={summary} />
            </section>

            {/* Meal Input (Text or Image Scan) — only for today */}
            {isToday && (
              <section className={styles.section}>
                <MealInput
                  onSubmit={handleLogMeal}
                  onScanImage={handleScanMealImage}
                  isLoading={submitting}
                />
              </section>
            )}

            {/* Meals List */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {isToday ? "Today's Meals" : `Meals on ${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </h2>
                {summary?.meal_count > 0 && (
                  <span className={styles.mealCount}>
                    {summary.meal_count} meal{summary.meal_count !== 1 ? "s" : ""}
                  </span>
                )}
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
          </>
        )}
      </div>
    </main>
  );
}


