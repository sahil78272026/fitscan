import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { updateSubscriptionTier } from '../services/api';

export default function ProUpgradeModal({
  visible,
  onClose,
  currentTier = 'free',
  daysRemaining = 0,
  onSuccess,
}) {
  const [billingCycle, setBillingCycle] = useState('annual'); // 'annual' | 'monthly'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!visible) return null;

  const isPro = (currentTier || 'free').toLowerCase() === 'pro';

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateSubscriptionTier('pro');
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to activate Pro subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateSubscriptionTier('free');
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to switch tier. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Crown Header */}
            <View style={styles.header}>
              <View style={styles.crownCircle}>
                <Text style={styles.crownText}>👑</Text>
              </View>
              <Text style={styles.title}>
                {isPro ? 'You are on CoreControl Pro!' : 'Unlock CoreControl Pro'}
              </Text>
              <Text style={styles.subtitle}>
                {daysRemaining > 0 && !isPro ? (
                  <Text style={styles.cooldownNotice}>
                    ⏳ Next free plan rotation in <Text style={styles.boldText}>{daysRemaining} day{daysRemaining > 1 ? 's' : ''}</Text>. Skip the wait with Pro!
                  </Text>
                ) : (
                  'Take total control of your nutrition with unlimited rotations & deep macro intelligence.'
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
                <Text style={styles.featureIcon}>🔄</Text>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureTitle}>Unlimited Meal Plan Rotations</Text>
                  <Text style={styles.featureDesc}>
                    Recalibrate goals and generate new AI plans anytime without waiting for the 7-day cooldown.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🎯</Text>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureTitle}>Balanced Meal Macro Targets</Text>
                  <Text style={styles.featureDesc}>
                    Optimal macro breakdowns per meal (breakfast, lunch, dinner) to build sustainable habits.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🛒</Text>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureTitle}>Smart Automated Grocery List</Text>
                  <Text style={styles.featureDesc}>
                    Get a complete weekly ingredient checklist with local market cost estimates.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🔬</Text>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureTitle}>Micronutrient & Clean Eating Index</Text>
                  <Text style={styles.featureDesc}>
                    Detailed tracking for fiber, sugar, sodium, and food quality scoring.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🛡️</Text>
                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureTitle}>Streak Freeze Protection</Text>
                  <Text style={styles.featureDesc}>
                    Protect your hard-earned logging streaks on travel or hectic days.
                  </Text>
                </View>
              </View>
            </View>

            {/* Pricing Selector (If Free Tier) */}
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
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionSection}>
              {!isPro ? (
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={handleUpgrade}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#221803" size="small" />
                  ) : (
                    <Text style={styles.upgradeBtnText}>
                      Unlock CoreControl Pro ✨
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.proActiveBox}>
                  <Text style={styles.proActiveText}>👑 Pro Membership Active</Text>
                  <TouchableOpacity
                    style={styles.downgradeBtn}
                    onPress={handleDowngrade}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#A79A85" size="small" />
                    ) : (
                      <Text style={styles.downgradeBtnText}>Switch to Free Tier (Testing)</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    backgroundColor: '#221D17',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3A3128',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 14,
      },
      android: {
        elevation: 10,
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
  },
  closeBtnText: {
    color: '#A79A85',
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(232, 160, 32, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E8A020',
  },
  crownText: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F4ECDD',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#A79A85',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  cooldownNotice: {
    color: '#FDE047',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
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
    borderColor: '#3A3128',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    color: '#A79A85',
    lineHeight: 15,
  },
  pricingSection: {
    gap: 10,
    marginBottom: 18,
  },
  pricingCard: {
    backgroundColor: '#181410',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#3A3128',
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
    fontSize: 10,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  planPerMonth: {
    fontSize: 11,
    color: '#A79A85',
    marginTop: 1,
  },
  priceAmountWrapper: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  pricePer: {
    fontSize: 10,
    color: '#A79A85',
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  upgradeBtnText: {
    color: '#221803',
    fontSize: 15,
    fontWeight: 'bold',
  },
  proActiveBox: {
    alignItems: 'center',
    gap: 10,
  },
  proActiveText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: 'bold',
  },
  downgradeBtn: {
    backgroundColor: '#2C251D',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  downgradeBtnText: {
    color: '#A79A85',
    fontSize: 12,
    fontWeight: '600',
  },
});
