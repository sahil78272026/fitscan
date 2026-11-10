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
  KeyboardAvoidingView,
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
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

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
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
                      '7-day free trial expired. Enter your Early Bird promo code to unlock instant access.'
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

                {/* Early Bird Access & Promo Code Section */}
                {!isPro && (
                  <View style={styles.earlyBirdSection}>
                    <View style={styles.earlyBirdBanner}>
                      <View style={styles.earlyBirdHeader}>
                        <View style={styles.earlyBirdBadge}>
                          <SparkleIcon size={12} color="#F59E0B" />
                          <Text style={styles.earlyBirdBadgeText}>EARLY BIRD SPECIAL ACCESS</Text>
                        </View>
                      </View>
                      <Text style={styles.earlyBirdTitle}>Complimentary Launch Access</Text>
                      <Text style={styles.earlyBirdDesc}>
                        Direct payment plans are upcoming soon. During our early bird launch period, unlock 100% free CoreControl Pro with your exclusive promo code.
                      </Text>
                    </View>

                    {/* Promo Code Input Section */}
                    <View style={styles.couponSection}>
                      <View style={styles.couponHeader}>
                        <TagIcon size={14} color="#E8A020" />
                        <Text style={styles.couponLabel}>Enter Early Bird Promo Code</Text>
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
                            placeholder="e.g. TESTFREE"
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
                          Enter code TESTFREE or your early bird promo code above to activate Pro membership.
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
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#111318',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222631',
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
    backgroundColor: '#1A1D24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222631',
  },
  scrollContent: {
    paddingBottom: 20,
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
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  errorText: {
    color: '#FB7185',
    fontSize: 12,
    textAlign: 'center',
  },
  featuresList: {
    gap: 12,
    marginBottom: 18,
    backgroundColor: '#08090C',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#222631',
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
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
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
    color: '#F8FAFC',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  earlyBirdSection: {
    gap: 12,
    marginBottom: 18,
  },
  earlyBirdBanner: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  earlyBirdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  earlyBirdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  earlyBirdBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  earlyBirdTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  earlyBirdDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  couponSection: {
    backgroundColor: '#08090C',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#222631',
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
    color: '#94A3B8',
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: '#222631',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  applyCouponBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyCouponBtnDisabled: {
    opacity: 0.4,
  },
  applyCouponBtnText: {
    color: '#08090C',
    fontWeight: '800',
    fontSize: 13,
  },
  appliedCouponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  appliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  appliedPillText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  removeCouponBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeCouponText: {
    color: '#FB7185',
    fontSize: 11,
    fontWeight: '600',
  },
  couponErrorText: {
    color: '#FB7185',
    fontSize: 11,
  },
  actionSection: {
    gap: 8,
  },
  upgradeBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  freeClaimBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  couponOnlyNoticeBox: {
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222631',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponOnlyNoticeText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  upgradeBtnDisabled: {
    opacity: 0.6,
  },
  upgradeBtnText: {
    color: '#08090C',
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
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
});
