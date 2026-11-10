import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  validateCoupon,
  redeemCoupon,
  createPaymentOrder,
  verifyPaymentSignature,
} from '../services/api';
import RazorpayCheckoutModal from './RazorpayCheckoutModal';

// --- Clean Semantic SVG Icons (Zero Raw Emojis) ---

function CrownIcon({ size = 26, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 18h18v2H3v-2zm1.5-9l3.5 4.5 4-8 4 8 3.5-4.5 1.5 7H3l1.5-7z"
        fill={color}
      />
    </Svg>
  );
}

function CheckIcon({ size = 16, color = '#4ADE80' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SparkleIcon({ size = 16, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill={color}
      />
    </Svg>
  );
}

function TagIcon({ size = 15, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ size = 18, color = '#A79A85' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShieldIcon({ size = 18, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TargetIcon({ size = 18, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

function RefreshIcon({ size = 18, color = '#E8A020' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const PLAN_PRICES = {
  annual: 999,
  monthly: 149,
};

export default function ProUpgradeModal({
  visible,
  onClose,
  currentTier = 'free',
  daysRemaining = 0,
  onSuccess,
}) {
  const [billingCycle, setBillingCycle] = useState('annual'); // 'annual' | 'monthly'
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Razorpay Checkout Modal State
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [activeOrderData, setActiveOrderData] = useState(null);

  if (!visible) return null;

  const isPro = (currentTier || 'free').toLowerCase() === 'pro';

  // Base price for selected plan
  const basePrice = PLAN_PRICES[billingCycle] || 999;

  // Compute final payable amount after coupon
  let finalAmount = basePrice;
  let discountAmount = 0;
  if (appliedCoupon && (appliedCoupon.valid || appliedCoupon.is_valid)) {
    if (appliedCoupon.discount_percentage === 100) {
      finalAmount = 0;
      discountAmount = basePrice;
    } else if (appliedCoupon.discount_percentage > 0) {
      discountAmount = Math.round((basePrice * appliedCoupon.discount_percentage) / 100);
      finalAmount = Math.max(0, basePrice - discountAmount);
    }
  }

  const is100PercentDiscount = appliedCoupon?.discount_percentage === 100 || finalAmount === 0;

  // Validate coupon handler
  const handleApplyCoupon = async () => {
    const trimmed = couponCode.trim().toUpperCase();
    if (!trimmed) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await validateCoupon(trimmed, billingCycle);
      if (res && (res.valid || res.is_valid)) {
        setAppliedCoupon(res);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(res?.message || 'Invalid or expired coupon code.');
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'Unable to validate coupon code.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  // Sync user profile to AsyncStorage upon upgrade
  const syncLocalProTier = async () => {
    try {
      const raw = await AsyncStorage.getItem('fitscan_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.subscription_tier = 'pro';
        parsed.is_subscription_active = true;
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(parsed));
      }
    } catch (storageErr) {
      if (__DEV__) {
        console.warn('Failed to update local user storage:', storageErr);
      }
    }
  };

  // Primary Action CTA
  const handlePrimaryAction = async () => {
    setError(null);

    // 100% Coupon Instant Unlock Branch (Bypasses Razorpay completely!)
    if (is100PercentDiscount && appliedCoupon?.code) {
      setLoading(true);
      try {
        const redeemRes = await redeemCoupon(appliedCoupon.code, billingCycle);
        await syncLocalProTier();

        Alert.alert(
          'Pro Access Unlocked',
          'Congratulations! Your 100% promo code has been redeemed. CoreControl Pro is now active.',
          [{ text: 'Start Using Pro', onPress: () => {
            if (onSuccess) onSuccess(redeemRes);
            onClose();
          }}]
        );
        return;
      } catch (err) {
        setError(err.message || 'Failed to redeem coupon. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Direct gateway checkout disabled for store compliance
    setError('Please enter a valid promo code to unlock Pro membership.');
  };

  // Razorpay Checkout Success Bridge Handler
  const handleCheckoutSuccess = async (response) => {
    setCheckoutVisible(false);
    setLoading(true);
    setError(null);

    try {
      const verifyRes = await verifyPaymentSignature({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });

      await syncLocalProTier();

      Alert.alert(
        'Payment Successful',
        'Your CoreControl Pro membership has been activated successfully.',
        [{ text: 'Continue', onPress: () => {
          if (onSuccess) onSuccess(verifyRes);
          onClose();
        }}]
      );
    } catch (err) {
      setError(err.message || 'Payment verification failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutFailure = (checkoutError) => {
    setCheckoutVisible(false);
    setError(checkoutError?.description || 'Payment was unsuccessful or cancelled.');
  };

  const handleCheckoutDismiss = () => {
    setCheckoutVisible(false);
  };

  return (
    <>
      <Modal
        visible={visible && !checkoutVisible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close paywall modal"
            >
              <CloseIcon size={16} color="#A79A85" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Crown Header */}
              <View style={styles.header}>
                <View style={styles.crownCircle}>
                  <CrownIcon size={28} color="#E8A020" />
                </View>
                <Text style={styles.title}>
                  {isPro ? 'CoreControl Pro Active' : 'Unlock CoreControl Pro'}
                </Text>
                <Text style={styles.subtitle}>
                  {daysRemaining > 0 && !isPro ? (
                    `Free trial active: ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining. Upgrade anytime for permanent Pro access.`
                  ) : isPro ? (
                    'Your membership gives you full AI intelligence and unlimited operations.'
                  ) : (
                    '7-day free trial expired. Upgrade to keep scanning meals, logging macros, and personalizing plans.'
                  )}
                </Text>
              </View>

              {/* Error Message */}
              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Feature Highlights Grid */}
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconBox}>
                    <RefreshIcon size={18} color="#E8A020" />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>Unlimited Meal Plan Rotations</Text>
                    <Text style={styles.featureDesc}>
                      Generate personalized recipes and shift goals on demand without waiting.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconBox}>
                    <TargetIcon size={18} color="#E8A020" />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>Deep Macro & Calorie Precision</Text>
                    <Text style={styles.featureDesc}>
                      Sub-dish macro breakdowns calibrated for sustainable fitness progress.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconBox}>
                    <SparkleIcon size={18} color="#E8A020" />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>Instant AI Photo Nutritionist</Text>
                    <Text style={styles.featureDesc}>
                      High-accuracy visual scanning for complex plates, mixed dishes, and ingredients.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={styles.featureIconBox}>
                    <ShieldIcon size={18} color="#E8A020" />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>Streak Protection & Full History</Text>
                    <Text style={styles.featureDesc}>
                      Permanent calendar logs, PDF meal plan exports, and automated grocery lists.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Pricing Selector (If Free Tier or Expired) */}
              {!isPro && (
                <View style={styles.pricingSection}>
                  {/* Annual Plan Card */}
                  <TouchableOpacity
                    style={[
                      styles.pricingCard,
                      billingCycle === 'annual' && styles.selectedPricingCard,
                    ]}
                    onPress={() => setBillingCycle('annual')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveBadgeText}>SAVE 45% • BEST VALUE</Text>
                    </View>
                    <View style={styles.pricingRow}>
                      <View style={styles.radioRow}>
                        <View style={styles.radioOuter}>
                          {billingCycle === 'annual' && <View style={styles.radioInner} />}
                        </View>
                        <View>
                          <Text style={styles.planDuration}>Annual Membership</Text>
                          <Text style={styles.planPerMonth}>~₹83 / month</Text>
                        </View>
                      </View>
                      <View style={styles.priceAmountWrapper}>
                        <Text style={styles.priceAmount}>₹999</Text>
                        <Text style={styles.pricePer}>/ year</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Monthly Plan Card */}
                  <TouchableOpacity
                    style={[
                      styles.pricingCard,
                      billingCycle === 'monthly' && styles.selectedPricingCard,
                    ]}
                    onPress={() => setBillingCycle('monthly')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pricingRow}>
                      <View style={styles.radioRow}>
                        <View style={styles.radioOuter}>
                          {billingCycle === 'monthly' && <View style={styles.radioInner} />}
                        </View>
                        <View>
                          <Text style={styles.planDuration}>Monthly Flex</Text>
                          <Text style={styles.planPerMonth}>Billed monthly</Text>
                        </View>
                      </View>
                      <View style={styles.priceAmountWrapper}>
                        <Text style={styles.priceAmount}>₹149</Text>
                        <Text style={styles.pricePer}>/ month</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Promo Code Input Section */}
                  <View style={styles.couponSection}>
                    <View style={styles.couponHeader}>
                      <TagIcon size={14} color="#E8A020" />
                      <Text style={styles.couponLabel}>Have a promo code?</Text>
                    </View>

                    {appliedCoupon ? (
                      <View style={styles.appliedCouponRow}>
                        <View style={styles.appliedPill}>
                          <CheckIcon size={14} color="#4ADE80" />
                          <Text style={styles.appliedPillText}>
                            {appliedCoupon.code} (
                            {appliedCoupon.discount_percentage === 100
                              ? '100% OFF • Free Pro Access'
                              : `${appliedCoupon.discount_percentage}% OFF`}
                            )
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeCouponBtn}
                          onPress={handleRemoveCoupon}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.removeCouponText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.couponInputRow}>
                        <TextInput
                          style={styles.couponInput}
                          placeholder="e.g. FITSCAN100"
                          placeholderTextColor="#6B5E4E"
                          value={couponCode}
                          onChangeText={(text) => {
                            setCouponCode(text.toUpperCase());
                            setCouponError(null);
                          }}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          editable={!couponLoading}
                        />
                        <TouchableOpacity
                          style={[
                            styles.applyCouponBtn,
                            (!couponCode.trim() || couponLoading) && styles.applyCouponBtnDisabled,
                          ]}
                          onPress={handleApplyCoupon}
                          disabled={!couponCode.trim() || couponLoading}
                          activeOpacity={0.8}
                        >
                          {couponLoading ? (
                            <ActivityIndicator size="small" color="#221803" />
                          ) : (
                            <Text style={styles.applyCouponBtnText}>Apply</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {couponError && (
                      <Text style={styles.couponErrorText}>{couponError}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Action Section */}
              <View style={styles.actionSection}>
                {!isPro ? (
                  is100PercentDiscount ? (
                    <TouchableOpacity
                      style={[
                        styles.upgradeBtn,
                        styles.freeClaimBtn,
                        loading && styles.upgradeBtnDisabled,
                      ]}
                      onPress={handlePrimaryAction}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#221803" size="small" />
                      ) : (
                        <Text style={styles.upgradeBtnText}>
                          Claim 100% Free Access Instantly
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.couponOnlyNoticeBox}>
                      <Text style={styles.couponOnlyNoticeText}>
                        Apply a promo code above to activate your complimentary Pro membership.
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={styles.proActiveBox}>
                    <CheckIcon size={20} color="#4ADE80" />
                    <Text style={styles.proActiveText}>Pro Membership Active</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* In-App Razorpay Checkout WebView Modal */}
      <RazorpayCheckoutModal
        visible={checkoutVisible}
        orderData={activeOrderData}
        onSuccess={handleCheckoutSuccess}
        onFailure={handleCheckoutFailure}
        onDismiss={handleCheckoutDismiss}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    backgroundColor: '#1E1914',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3A3128',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.6,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C251D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  header: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  crownCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(232, 160, 32, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E8A020',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F4ECDD',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#A79A85',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    textAlign: 'center',
  },
  featuresList: {
    gap: 12,
    marginBottom: 18,
    backgroundColor: '#181410',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2C251D',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 160, 32, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F4ECDD',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    color: '#A79A85',
    lineHeight: 15,
  },
  pricingSection: {
    gap: 12,
    marginBottom: 18,
  },
  pricingCard: {
    backgroundColor: '#181410',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2C251D',
    position: 'relative',
  },
  selectedPricingCard: {
    borderColor: '#E8A020',
    backgroundColor: 'rgba(232, 160, 32, 0.08)',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#E8A020',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  saveBadgeText: {
    color: '#221803',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A79A85',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E8A020',
  },
  planDuration: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4ECDD',
  },
  planPerMonth: {
    fontSize: 11,
    color: '#A79A85',
    marginTop: 2,
  },
  priceAmountWrapper: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E8A020',
  },
  pricePer: {
    fontSize: 10,
    color: '#A79A85',
  },
  couponSection: {
    backgroundColor: '#181410',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2C251D',
    gap: 8,
  },
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  couponLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A79A85',
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#221D17',
    borderWidth: 1,
    borderColor: '#3A3128',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#F4ECDD',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  applyCouponBtn: {
    backgroundColor: '#E8A020',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyCouponBtnDisabled: {
    opacity: 0.5,
  },
  applyCouponBtnText: {
    color: '#221803',
    fontWeight: '700',
    fontSize: 12,
  },
  appliedCouponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  appliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  appliedPillText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
  },
  removeCouponBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeCouponText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
  couponErrorText: {
    color: '#F87171',
    fontSize: 11,
  },
  actionSection: {
    gap: 8,
  },
  upgradeBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  freeClaimBtn: {
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80',
  },
  couponOnlyNoticeBox: {
    backgroundColor: '#1E1914',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3128',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponOnlyNoticeText: {
    fontSize: 13,
    color: '#D4C8B5',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  upgradeBtnDisabled: {
    opacity: 0.6,
  },
  upgradeBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  proActiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  proActiveText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '700',
  },
});
