"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AdherenceWidget from "@/components/AdherenceWidget";
import WeightChart from "@/components/WeightChart";
import {
  getAdherenceStats,
  logWeight,
  getWeightHistory,
} from "@/lib/api";
import styles from "./page.module.css";

export default function ProgressPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [adherenceStats, setAdherenceStats] = useState(null);
  const [weightHistory, setWeightHistory] = useState(null);
  const [weightTimeframe, setWeightTimeframe] = useState(30);
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchStats = useCallback(async () => {
    try {
      const stats = await getAdherenceStats();
      setAdherenceStats(stats);
    } catch (err) {
      // Fail silently
    }
  }, []);

  const fetchWeight = useCallback(async (days) => {
    try {
      const history = await getWeightHistory(days);
      setWeightHistory(history);
    } catch (err) {
      // Fail silently
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      Promise.all([fetchStats(), fetchWeight(weightTimeframe)]).finally(() =>
        setLoading(false)
      );
    }
  }, [isAuthenticated, fetchStats, fetchWeight, weightTimeframe]);

  const handleLogWeight = async (weightKg) => {
    try {
      await logWeight(weightKg);
      await fetchWeight(weightTimeframe);
    } catch (err) {
      // Fail silently
    }
  };

  const handleWeightTimeframeChange = (days) => {
    setWeightTimeframe(days);
    fetchWeight(days);
  };

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}>
          <div className={styles.loaderSpinner} />
          <span>Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>📊 Progress & Adherence</h1>
        </header>

        {loading ? (
          <div className={styles.loader} style={{ height: "200px" }}>
            <div className={styles.loaderSpinner} />
          </div>
        ) : (
          <>
            <section className={styles.section}>
              <AdherenceWidget stats={adherenceStats} />
            </section>

            <section className={styles.section}>
              <WeightChart
                historyData={weightHistory}
                onLogWeight={handleLogWeight}
                onTimeframeChange={handleWeightTimeframeChange}
                currentTimeframe={weightTimeframe}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
