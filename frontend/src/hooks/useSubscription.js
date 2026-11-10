"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSubscriptionStatus } from "@/lib/api";

const TRIAL_DURATION_DAYS = 7;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export function useSubscription() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [subStatus, setSubStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);

  // Sync subscription status with server
  const refreshSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return null;
    }
    try {
      const data = await getSubscriptionStatus();
      setSubStatus(data);
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let ignore = false;
    async function initSubscription() {
      if (!isAuthenticated) {
        if (!ignore) setLoading(false);
        return;
      }
      try {
        const data = await getSubscriptionStatus();
        if (!ignore) {
          setSubStatus(data);
        }
      } catch {
        // Compute fallback offline estimates inside effect safely
        if (!ignore && user?.created_at) {
          const regTime = new Date(user.created_at).getTime();
          const elapsedMs = Math.max(0, Date.now() - regTime);
          const remainingMs = Math.max(0, TRIAL_DURATION_MS - elapsedMs);
          const isTrial = elapsedMs < TRIAL_DURATION_MS;
          const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
          setSubStatus({
            is_trial_active: isTrial,
            trial_days_remaining: Math.max(0, TRIAL_DURATION_DAYS - elapsedDays),
            trial_hours_remaining: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))),
            has_active_subscription: (user?.subscription_tier || "").toLowerCase() === "pro",
            subscription_tier: user?.subscription_tier || "free",
            subscription_status: isTrial ? "trial_active" : "trial_expired",
            can_access_premium: isTrial || (user?.subscription_tier || "").toLowerCase() === "pro",
          });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (!authLoading) {
      initSubscription();
    }

    return () => {
      ignore = true;
    };
  }, [authLoading, isAuthenticated, user]);

  const openPaywall = useCallback((reason = null) => {
    setPaywallReason(reason);
    setIsPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setIsPaywallOpen(false);
    setPaywallReason(null);
  }, []);

  // Compute status: server-verified data takes absolute precedence
  const isUserPro = (user?.subscription_tier || "").toLowerCase() === "pro";
  const isPro = Boolean(subStatus?.has_active_subscription || subStatus?.subscription_tier === "pro" || isUserPro);

  const isTrialActive = !isPro && (subStatus ? Boolean(subStatus.is_trial_active) : true);
  const trialDaysRemaining = subStatus ? Number(subStatus.trial_days_remaining ?? 0) : (isPro ? 0 : TRIAL_DURATION_DAYS);
  const trialHoursRemaining = subStatus ? Number(subStatus.trial_hours_remaining ?? 0) : trialDaysRemaining * 24;
  const hasAccess = isPro || (subStatus ? Boolean(subStatus.can_access_premium) : true);
  const subscriptionStatus = subStatus?.subscription_status || (isPro ? "active_paid" : (isTrialActive ? "trial_active" : "trial_expired"));

  return {
    isPro,
    isTrialActive,
    trialDaysRemaining,
    trialHoursRemaining,
    hasAccess,
    subscriptionStatus,
    refreshSubscription,
    openPaywall,
    closePaywall,
    isPaywallOpen,
    paywallReason,
    loading: authLoading || loading,
  };
}
