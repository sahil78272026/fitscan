"use client";

import { useState } from "react";
import { updateSubscriptionTier } from "@/lib/api";
import styles from "./ProUpgradeModal.module.css";

export default function ProUpgradeModal({
  isOpen,
  onClose,
  currentTier = "free",
  daysRemaining = 0,
  onSuccess,
}) {
  const [billingCycle, setBillingCycle] = useState("annual"); // "annual" | "monthly"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const isPro = (currentTier || "free").toLowerCase() === "pro";

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateSubscriptionTier("pro");
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to activate Pro subscription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateSubscriptionTier("free");
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to switch tier. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Glow Header */}
        <div className={styles.header}>
          <div className={styles.proBadgeWrapper}>
            <div className={styles.glowPulse} />
            <span className={styles.proCrown}>👑</span>
          </div>
          <h2 className={styles.title}>
            {isPro ? "You are on CoreControl Pro!" : "Unlock CoreControl Pro"}
          </h2>
          <p className={styles.subtitle}>
            {daysRemaining > 0 && !isPro ? (
              <span className={styles.cooldownNotice}>
                ⏳ Next free plan rotation is in <strong>{daysRemaining} day{daysRemaining > 1 ? "s" : ""}</strong>. Skip the wait with Pro!
              </span>
            ) : (
              "Take total control of your nutrition with unlimited rotations & deep macro intelligence."
            )}
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className={styles.featuresList}>
          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🔄</span>
            <div className={styles.featureText}>
              <strong>Unlimited Meal Plan Rotations</strong>
              <p>Recalibrate goals and regenerate custom daily meal plans anytime without waiting for the 7-day cooldown.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🎯</span>
            <div className={styles.featureText}>
              <strong>Balanced Meal Macro Targets</strong>
              <p>Optimal macro breakdowns per meal (breakfast, lunch, dinner) to build sustainable eating habits.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🛒</span>
            <div className={styles.featureText}>
              <strong>Smart Automated Grocery List</strong>
              <p>Get a complete weekly ingredient checklist with local cost estimates.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🔬</span>
            <div className={styles.featureText}>
              <strong>Micronutrient & Clean Eating Index</strong>
              <p>Detailed tracking for fiber, sugar, sodium, and food quality scoring.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🛡️</span>
            <div className={styles.featureText}>
              <strong>Streak Freeze Protection</strong>
              <p>Protect your hard-earned logging streaks when traveling or busy.</p>
            </div>
          </div>
        </div>

        {/* Plan Selector */}
        {!isPro ? (
          <>
            <div className={styles.pricingSelector}>
              <div
                className={`${styles.pricingCard} ${
                  billingCycle === "annual" ? styles.selectedCard : ""
                }`}
                onClick={() => setBillingCycle("annual")}
              >
                <div className={styles.saveBadge}>SAVE 45% • BEST VALUE</div>
                <div className={styles.pricingRadio}>
                  <div className={styles.radioCircle}>
                    {billingCycle === "annual" && <div className={styles.radioDot} />}
                  </div>
                  <div>
                    <span className={styles.planDuration}>Annual Membership</span>
                    <span className={styles.planPerMonth}>~₹83 / month</span>
                  </div>
                </div>
                <div className={styles.priceAmount}>
                  <strong>₹999</strong>
                  <span>/ year</span>
                </div>
              </div>

              <div
                className={`${styles.pricingCard} ${
                  billingCycle === "monthly" ? styles.selectedCard : ""
                }`}
                onClick={() => setBillingCycle("monthly")}
              >
                <div className={styles.pricingRadio}>
                  <div className={styles.radioCircle}>
                    {billingCycle === "monthly" && <div className={styles.radioDot} />}
                  </div>
                  <div>
                    <span className={styles.planDuration}>Monthly Pass</span>
                    <span className={styles.planPerMonth}>Standard billing</span>
                  </div>
                </div>
                <div className={styles.priceAmount}>
                  <strong>₹149</strong>
                  <span>/ month</span>
                </div>
              </div>
            </div>

            {error && <p className={styles.errorMessage}>⚠️ {error}</p>}

            <button
              type="button"
              className={styles.upgradeBtn}
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading
                ? "Activating Pro..."
                : `Upgrade to Pro (${billingCycle === "annual" ? "₹999 / year" : "₹149 / month"}) ✨`}
            </button>
            <p className={styles.guaranteeNote}>
              🔒 Instant activation • Cancel or switch anytime
            </p>
          </>
        ) : (
          <div className={styles.alreadyProBox}>
            <p className={styles.proActiveMessage}>
              ✨ Your Pro subscription is active! You have unlimited meal plan rotations and smart features.
            </p>
            <button
              type="button"
              className={styles.switchFreeBtn}
              onClick={handleDowngrade}
              disabled={loading}
            >
              {loading ? "Switching..." : "Switch to Free Tier (For Testing)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
