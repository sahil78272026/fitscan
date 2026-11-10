"use client";

import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  validateCoupon,
  redeemCoupon,
  createPaymentOrder,
  verifyPaymentSignature,
} from "@/lib/api";
import { loadRazorpayScript } from "@/lib/razorpay";
import styles from "./ProUpgradeModal.module.css";

// Clean SVG Icons conforming strictly to NO EMOJIS IN UI rule
function CrownIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M5 20h14" />
    </svg>
  );
}

function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LockIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ShieldIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function RefreshIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function TargetIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function CartIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function MicroscopeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18h8" />
      <path d="M3 22h18" />
      <path d="M14 22a7 7 0 1 0 0-14h-1" />
      <path d="M9 14h2" />
      <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
      <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
    </svg>
  );
}

function CouponIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function AlertIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ClockIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function ProUpgradeModal({
  isOpen,
  onClose,
  currentTier = "free",
  daysRemaining = 0,
  onSuccess,
}) {
  const { user, token, login } = useAuth();
  const [billingCycle, setBillingCycle] = useState("annual"); // "annual" | "monthly"
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  const isPro = (currentTier || "free").toLowerCase() === "pro";

  // Base pricing
  const basePrice = billingCycle === "annual" ? 999 : 149;
  const planId = billingCycle === "annual" ? "pro_annual" : "pro_monthly";

  // Price with coupon calculation
  const discountPercent = appliedCoupon?.discount_percentage || 0;
  const isHundredPercent = discountPercent === 100;
  const discountAmount = Math.round(basePrice * (discountPercent / 100));
  const payableAmount = isHundredPercent ? 0 : Math.max(0, basePrice - discountAmount);

  // Apply Coupon
  const handleApplyCoupon = useCallback(async () => {
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) return;

    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(cleanCode, billingCycle);
      if (result.valid) {
        setAppliedCoupon(result);
        setError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError("This coupon code is not valid for this plan.");
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || "Invalid or expired coupon code.");
    } finally {
      setValidatingCoupon(false);
    }
  }, [couponCode, billingCycle]);

  // Remove Applied Coupon
  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  }, []);

  // Instant 100% Coupon Redemption (Zero payment gateway involved!)
  const handleRedeemFreeAccess = useCallback(async () => {
    if (!appliedCoupon || !isHundredPercent) return;
    setLoading(true);
    setError(null);
    try {
      const redeemResult = await redeemCoupon(appliedCoupon.code, billingCycle);
      if (token && user) {
        login({ token, user: { ...user, subscription_tier: "pro" } });
      }
      setSuccessNotice("100% Free Pro Access Activated!");
      if (onSuccess) onSuccess(redeemResult);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to redeem free access coupon.");
    } finally {
      setLoading(false);
    }
  }, [appliedCoupon, isHundredPercent, billingCycle, token, user, login, onSuccess, onClose]);

  // Standard Razorpay Checkout Flow
  const handleRazorpayPayment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Ensure dynamic Razorpay script is loaded safely
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to connect to payment checkout. Please check your internet connection.");
      }

      // 2. Create order on backend
      const order = await createPaymentOrder(planId, appliedCoupon?.code || null);

      // 3. Launch Razorpay modal
      const keyId = order.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "FitScan CoreControl",
        description: `${billingCycle === "annual" ? "Annual" : "Monthly"} Pro Subscription`,
        order_id: order.razorpay_order_id,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        theme: {
          color: "#E8A020",
        },
        handler: async function (response) {
          try {
            setLoading(true);
            const verifyRes = await verifyPaymentSignature({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.success) {
              if (token && user) {
                login({ token, user: { ...user, subscription_tier: "pro" } });
              }
              setSuccessNotice("Payment verified! Pro subscription activated.");
              if (onSuccess) onSuccess(verifyRes);
              setTimeout(() => {
                onClose();
              }, 1200);
            } else {
              setError("Payment verification failed. Please contact support.");
            }
          } catch (verifyErr) {
            setError(verifyErr.message || "Payment verification failed.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (failResponse) {
        setError(failResponse.error?.description || "Payment failed. Please try again.");
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || "Failed to initialize payment.");
      setLoading(false);
    }
  }, [planId, appliedCoupon, billingCycle, user, token, login, onSuccess, onClose]);

  if (!isOpen) return null;

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
            <div className={styles.proCrownIcon}>
              <CrownIcon size={32} />
            </div>
          </div>
          <h2 className={styles.title}>
            {isPro ? "You are on CoreControl Pro!" : "Unlock CoreControl Pro"}
          </h2>
          <p className={styles.subtitle}>
            {daysRemaining > 0 && !isPro ? (
              <span className={styles.cooldownNotice}>
                <ClockIcon size={14} />
                Trial active: <strong>{daysRemaining} day{daysRemaining > 1 ? "s" : ""} remaining</strong>. Upgrade now to preserve full AI access.
              </span>
            ) : isPro ? (
              "Your Pro subscription is fully active. Enjoy unrestricted AI intelligence."
            ) : (
              "Hard paywall active: Upgrade to Pro or redeem a coupon to continue AI meal scanning and meal planning."
            )}
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className={styles.featuresList}>
          <div className={styles.featureItem}>
            <div className={styles.featureIcon}>
              <RefreshIcon size={18} />
            </div>
            <div className={styles.featureText}>
              <strong>Unlimited AI Meal Scanning & Plans</strong>
              <p>Instant photo macro estimation, automated meal logging, and daily meal plan recalibration.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <div className={styles.featureIcon}>
              <TargetIcon size={18} />
            </div>
            <div className={styles.featureText}>
              <strong>Balanced Meal Macro Targets</strong>
              <p>Optimal macro breakdowns per course (breakfast, lunch, dinner) to build sustainable habits.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <div className={styles.featureIcon}>
              <CartIcon size={18} />
            </div>
            <div className={styles.featureText}>
              <strong>Smart Automated Grocery List</strong>
              <p>Itemized weekly ingredients with localized cost estimates.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <div className={styles.featureIcon}>
              <MicroscopeIcon size={18} />
            </div>
            <div className={styles.featureText}>
              <strong>Micronutrient & Clean Eating Index</strong>
              <p>Detailed tracking for fiber, sugar, sodium, and clean eating quality scores.</p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <div className={styles.featureIcon}>
              <ShieldIcon size={18} />
            </div>
            <div className={styles.featureText}>
              <strong>Streak Freeze Protection</strong>
              <p>Protect your hard-earned habit streaks when traveling or busy.</p>
            </div>
          </div>
        </div>

        {/* Plan Selector & Checkout */}
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
                  {appliedCoupon && billingCycle === "annual" ? (
                    <div>
                      <span className={styles.strikePrice}>₹999</span>
                      {isHundredPercent ? (
                        <span className={styles.freePriceTag}>FREE</span>
                      ) : (
                        <strong>₹{payableAmount}</strong>
                      )}
                      <span>/ year</span>
                    </div>
                  ) : (
                    <div>
                      <strong>₹999</strong>
                      <span>/ year</span>
                    </div>
                  )}
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
                  {appliedCoupon && billingCycle === "monthly" ? (
                    <div>
                      <span className={styles.strikePrice}>₹149</span>
                      {isHundredPercent ? (
                        <span className={styles.freePriceTag}>FREE</span>
                      ) : (
                        <strong>₹{payableAmount}</strong>
                      )}
                      <span>/ month</span>
                    </div>
                  ) : (
                    <div>
                      <strong>₹149</strong>
                      <span>/ month</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dynamic Coupon Input Section */}
            <div className={styles.couponSection}>
              <div className={styles.couponHeader}>
                <CouponIcon size={15} />
                <span>Have a Promo Code or Access Coupon?</span>
              </div>
              <div className={styles.couponInputRow}>
                <input
                  type="text"
                  className={styles.couponInput}
                  placeholder="e.g. LAUNCH100"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={validatingCoupon || Boolean(appliedCoupon)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    className={styles.applyCouponBtn}
                    onClick={handleRemoveCoupon}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.applyCouponBtn}
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponCode.trim()}
                  >
                    {validatingCoupon ? "Checking..." : "Apply"}
                  </button>
                )}
              </div>

              {appliedCoupon && (
                <div className={styles.couponAppliedBanner}>
                  <div className={styles.couponBannerContent}>
                    <CheckIcon size={14} />
                    <span>
                      {appliedCoupon.code}: {appliedCoupon.discount_percentage}% OFF
                      {appliedCoupon.description ? ` (${appliedCoupon.description})` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeCouponBtn}
                    onClick={handleRemoveCoupon}
                  >
                    Change
                  </button>
                </div>
              )}

              {couponError && (
                <div className={styles.couponError}>
                  <AlertIcon size={14} />
                  <span>{couponError}</span>
                </div>
              )}
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <AlertIcon size={15} />
                <span>{error}</span>
              </div>
            )}

            {successNotice && (
              <div className={styles.couponAppliedBanner} style={{ marginBottom: "0.75rem", justifyContent: "center" }}>
                <CheckIcon size={16} />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Action CTA: Transform to 100% Free Unlock when coupon is 100% */}
            {isHundredPercent ? (
              <button
                type="button"
                className={styles.freeAccessBtn}
                onClick={handleRedeemFreeAccess}
                disabled={loading}
              >
                {loading ? "Activating Pro Access..." : "Claim 100% Free Access Instantly"}
              </button>
            ) : (
              <button
                type="button"
                className={styles.upgradeBtn}
                onClick={handleRazorpayPayment}
                disabled={loading}
              >
                {loading
                  ? "Processing..."
                  : `Pay ₹${payableAmount} with Razorpay`}
              </button>
            )}

            <p className={styles.guaranteeNote}>
              <LockIcon size={13} />
              Secure 256-bit encrypted checkout • Instant Pro activation
            </p>
          </>
        ) : (
          <div className={styles.alreadyProBox}>
            <p className={styles.proActiveMessage}>
              <CheckIcon size={18} />
              Your Pro membership is active with unlimited scanning and meal rotations.
            </p>
            <button
              type="button"
              className={styles.switchFreeBtn}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
