import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubscriptionStatus } from '../services/api';

const TRIAL_DURATION_DAYS = 7;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export function useSubscription(userProp = null) {
  const [currentUser, setCurrentUser] = useState(userProp);
  const [subStatus, setSubStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);

  // Sync current user from prop or AsyncStorage
  useEffect(() => {
    if (userProp) {
      setCurrentUser(userProp);
    } else {
      AsyncStorage.getItem('fitscan_user').then((raw) => {
        if (raw) {
          try {
            setCurrentUser(JSON.parse(raw));
          } catch {
            // ignore JSON parse error
          }
        }
      });
    }
  }, [userProp]);

  // Synchronize subscription status with server
  const refreshSubscription = useCallback(async () => {
    try {
      const data = await getSubscriptionStatus();
      setSubStatus(data);

      // If server confirmed pro access, keep local AsyncStorage updated
      if (data?.subscription_tier === 'pro' || data?.has_active_subscription) {
        try {
          const raw = await AsyncStorage.getItem('fitscan_user');
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.subscription_tier = 'pro';
            parsed.is_subscription_active = true;
            await AsyncStorage.setItem('fitscan_user', JSON.stringify(parsed));
            setCurrentUser(parsed);
          }
        } catch {
          // ignore storage error
        }
      }
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function initSubscription() {
      try {
        const token = await AsyncStorage.getItem('fitscan_token');
        if (!token) {
          if (!ignore) setLoading(false);
          return;
        }

        const data = await getSubscriptionStatus();
        if (!ignore) {
          setSubStatus(data);
        }
      } catch {
        // Fallback offline calculation based on user.created_at
        if (!ignore) {
          let u = currentUser;
          if (!u) {
            const raw = await AsyncStorage.getItem('fitscan_user').catch(() => null);
            if (raw) {
              try {
                u = JSON.parse(raw);
              } catch {}
            }
          }

          if (u?.created_at) {
            const regTime = new Date(u.created_at).getTime();
            const elapsedMs = Math.max(0, Date.now() - regTime);
            const remainingMs = Math.max(0, TRIAL_DURATION_MS - elapsedMs);
            const isTrial = elapsedMs < TRIAL_DURATION_MS;
            const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
            const isProUser = (u?.subscription_tier || '').toLowerCase() === 'pro';

            setSubStatus({
              is_trial_active: isTrial,
              trial_days_remaining: Math.max(0, TRIAL_DURATION_DAYS - elapsedDays),
              trial_hours_remaining: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))),
              has_active_subscription: isProUser,
              subscription_tier: isProUser ? 'pro' : (isTrial ? 'trial' : 'expired'),
              subscription_status: isProUser ? 'active_paid' : (isTrial ? 'trial_active' : 'trial_expired'),
              can_access_premium: isTrial || isProUser,
            });
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    initSubscription();

    return () => {
      ignore = true;
    };
  }, [currentUser]);

  const openPaywall = useCallback((reason = null) => {
    setPaywallReason(reason);
    setIsPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setIsPaywallOpen(false);
    setPaywallReason(null);
  }, []);

  // Compute status: server-verified data takes absolute precedence
  const isUserPro = (currentUser?.subscription_tier || '').toLowerCase() === 'pro';
  const isPro = Boolean(subStatus?.has_active_subscription || subStatus?.subscription_tier === 'pro' || isUserPro);

  const isTrialActive = !isPro && (subStatus ? Boolean(subStatus.is_trial_active) : true);
  const trialDaysRemaining = subStatus ? Number(subStatus.trial_days_remaining ?? 0) : (isPro ? 0 : TRIAL_DURATION_DAYS);
  const trialHoursRemaining = subStatus ? Number(subStatus.trial_hours_remaining ?? 0) : trialDaysRemaining * 24;
  const hasAccess = isPro || (subStatus ? Boolean(subStatus.can_access_premium) : true);
  const subscriptionStatus = subStatus?.subscription_status || (isPro ? 'active_paid' : (isTrialActive ? 'trial_active' : 'trial_expired'));

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
    loading,
  };
}

export default useSubscription;
